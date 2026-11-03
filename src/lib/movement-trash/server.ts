import "server-only";
import { createHash } from "node:crypto";
import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { esColeccionRecuperable, esIdDocumento, type ColeccionRecuperable, type MovimientoEliminado, type PaginaPapelera } from "./types";

export class ErrorPapelera extends Error {
  constructor(message: string, public status: number) { super(message); }
}
function comprobarAutorizacion(data?: DocumentData) {
  if (data?.activo !== true) throw new ErrorPapelera("Usuario no autorizado.", 403);
}
function versionCuenta(data?: DocumentData): string {
  const campos = ["ingresosIncluidosEnSaldoInicial", "gastosIncluidosEnSaldoInicial", "pagosFijosIncluidosEnSaldoInicial",
    "pagosTarjetaIncluidosEnSaldoInicial", "movimientosManualesIncluidosEnSaldoInicial"];
  return createHash("sha256").update(JSON.stringify(data ? [data.saldoInicial ?? null, data.fechaSaldoInicial ?? null,
    ...campos.map(campo => Array.isArray(data[campo]) ? [...data[campo]].sort() : null)] : null)).digest("hex");
}
function afectaBanco(coleccion: ColeccionRecuperable, data: DocumentData): boolean {
  if (coleccion === "gastos") return ["debito", "cuenta_bancaria"].includes(data.metodoPago);
  if (coleccion === "pagosTarjeta") return data.origenFondos !== "cuenta_externa";
  if (coleccion === "pagosFijos") return ["debito_automatico", "transferencia"].includes(data.metodo);
  if (coleccion === "ingresos") return data.estado === "recibido";
  return true;
}
function versionTarjeta(data?: DocumentData): string {
  return JSON.stringify(data ? [data.saldoInicial ?? null, data.fechaSaldoInicial ?? null] : null);
}
function resumen(id: string, data: DocumentData): MovimientoEliminado {
  const original: DocumentData = data.datos;
  return { id, coleccion: data.coleccion, documentoId: data.documentoId,
    concepto: typeof original.concepto === "string" ? original.concepto : typeof original.descripcion === "string" ? original.descripcion : "Movimiento",
    monto: typeof original.monto === "number" && Number.isFinite(original.monto) ? original.monto : null,
    fecha: typeof original.fecha === "string" ? original.fecha : typeof original.fechaRecibida === "string" ? original.fechaRecibida : original.fechaProgramada ?? "",
    eliminadoEn: data.eliminadoEn?.toDate?.().toISOString() ?? "" };
}

export async function archivarMovimiento(db: Firestore, uid: string, coleccion: unknown, documentoId: unknown): Promise<MovimientoEliminado> {
  if (!esColeccionRecuperable(coleccion) || !esIdDocumento(documentoId)) throw new ErrorPapelera("Movimiento no válido.", 400);
  const usuario = db.doc(`allowedUsers/${uid}`);
  const origen = db.doc(`users/${uid}/${coleccion}/${documentoId}`);
  const cuenta = db.doc(`users/${uid}/cuentas/cuenta-gastos`);
  const copia = db.collection(`users/${uid}/papeleraMovimientos`).doc();
  const resultado = await db.runTransaction(async transaction => {
    const [permiso, documento, saldo] = await transaction.getAll(usuario, origen, cuenta);
    comprobarAutorizacion(permiso.data());
    if (!documento.exists) throw new ErrorPapelera("El movimiento ya no existe. Actualiza la papelera.", 404);
    const datos = documento.data()!;
    const tarjeta = esIdDocumento(datos.tarjetaId) ? await transaction.get(db.doc(`users/${uid}/tarjetasCredito/${datos.tarjetaId}`)) : null;
    const archivo = { coleccion, documentoId, datos, eliminadoEn: FieldValue.serverTimestamp(), versionCuenta: versionCuenta(saldo.data()),
      versionTarjeta: versionTarjeta(tarjeta?.data()) };
    transaction.create(copia, archivo);
    transaction.delete(origen);
    return resumen(copia.id, archivo);
  });
  return resultado;
}

export async function restaurarMovimiento(db: Firestore, uid: string, archivoId: unknown): Promise<MovimientoEliminado> {
  if (!esIdDocumento(archivoId)) throw new ErrorPapelera("Movimiento eliminado no válido.", 400);
  const copia = db.doc(`users/${uid}/papeleraMovimientos/${archivoId}`);
  return db.runTransaction(async transaction => {
    const [permiso, documento, saldo] = await transaction.getAll(db.doc(`allowedUsers/${uid}`), copia, db.doc(`users/${uid}/cuentas/cuenta-gastos`));
    comprobarAutorizacion(permiso.data());
    if (!documento.exists) throw new ErrorPapelera("El movimiento ya fue recuperado o no está en tu papelera.", 404);
    const archivo = documento.data()!;
    if (!esColeccionRecuperable(archivo.coleccion) || !esIdDocumento(archivo.documentoId) || !archivo.datos || typeof archivo.datos !== "object") {
      throw new ErrorPapelera("La copia del movimiento no es válida.", 409);
    }
    const origen = db.doc(`users/${uid}/${archivo.coleccion}/${archivo.documentoId}`);
    if ((await transaction.get(origen)).exists) throw new ErrorPapelera("Ya existe un movimiento con ese ID. No se ha sobrescrito.", 409);
    if (afectaBanco(archivo.coleccion, archivo.datos) && archivo.versionCuenta !== versionCuenta(saldo.data())) {
      throw new ErrorPapelera("La cuenta fue recalibrada desde la eliminación. Revisa este movimiento antes de registrarlo de nuevo; la copia permanece en la papelera.", 409);
    }
    // Restore the exact original record, including legacy fields and native timestamps.
    // The archive is writable only by this authenticated server flow, never by clients.
    for (const [campo, coleccion] of [["tarjetaId", "tarjetasCredito"], ["compromisoId", "compromisosFijos"]] as const) {
      const id = archivo.datos[campo];
      if (typeof id === "string" && id) {
        const referencia = esIdDocumento(id) ? await transaction.get(db.doc(`users/${uid}/${coleccion}/${id}`)) : null;
        if (!referencia?.exists) {
          throw new ErrorPapelera(`No se puede recuperar porque falta la ${campo === "tarjetaId" ? "tarjeta" : "definición del compromiso fijo"} asociada. La copia permanece en la papelera.`, 409);
        }
        if (campo === "tarjetaId" && archivo.versionTarjeta !== versionTarjeta(referencia.data())) {
          throw new ErrorPapelera("La tarjeta fue recalibrada desde la eliminación. Revisa el movimiento antes de registrarlo de nuevo; la copia permanece en la papelera.", 409);
        }
      }
    }
    transaction.create(origen, archivo.datos);
    transaction.delete(copia);
    return resumen(documento.id, archivo);
  });
}

export async function listarPapelera(db: Firestore, uid: string, cursor: string | null): Promise<PaginaPapelera> {
  comprobarAutorizacion((await db.doc(`allowedUsers/${uid}`).get()).data());
  let consulta = db.collection(`users/${uid}/papeleraMovimientos`).orderBy("eliminadoEn", "desc").limit(21);
  if (cursor) {
    if (!esIdDocumento(cursor)) throw new ErrorPapelera("Página no válida.", 400);
    const punto = await db.doc(`users/${uid}/papeleraMovimientos/${cursor}`).get();
    if (!punto.exists) throw new ErrorPapelera("La lista cambió. Actualiza la papelera.", 409);
    consulta = consulta.startAfter(punto);
  }
  const documentos = (await consulta.get()).docs;
  return { movimientos: documentos.slice(0, 20).map(documento => resumen(documento.id, documento.data())),
    siguiente: documentos.length > 20 ? documentos[19].id : null };
}
