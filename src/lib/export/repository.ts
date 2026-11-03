import "server-only";
import { Timestamp, type Firestore, type Query, type QueryDocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { COLECCIONES_EXPORTABLES, type OpcionesExportacion, type RegistroExportable } from "./types";

/** Fetch each bounded query in pages; never truncate the financial export at a row limit. */
async function leerPaginas(consulta: Query, transaction: Transaction): Promise<QueryDocumentSnapshot[]> {
  const documentos: QueryDocumentSnapshot[] = [];
  let cursor: QueryDocumentSnapshot | undefined;
  while (true) {
    const pagina = await transaction.get((cursor ? consulta.startAfter(cursor) : consulta).limit(500));
    documentos.push(...pagina.docs);
    if (pagina.size < 500) return documentos;
    cursor = pagina.docs[pagina.docs.length - 1];
  }
}
export async function cargarExportacion(db: Firestore, uid: string, opciones: OpcionesExportacion) {
  return db.runTransaction(async transaction => {
    // A two-day margin includes every supported time-zone offset and ISO textual representation.
    // Exact calendar filtering happens after conversion to the requested zone.
    const desdeUTC = new Date(Date.parse(`${opciones.desde}T00:00:00Z`) - 2 * 86_400_000);
    const hastaUTC = new Date(Date.parse(`${opciones.hasta}T00:00:00Z`) + 3 * 86_400_000);
    const desdeTexto = desdeUTC.toISOString().slice(0, 10);
    const hastaTexto = hastaUTC.toISOString().slice(0, 10);
    const resultados = await Promise.all(COLECCIONES_EXPORTABLES.map(async coleccion => {
      const referencia = db.collection(`users/${uid}/${coleccion}`);
      const campos = coleccion === "ingresos" ? ["fechaRecibida", "fechaProgramada"] : ["fecha"];
      const consultas = campos.flatMap(campo => [
        referencia.where(campo, ">=", desdeTexto).where(campo, "<", hastaTexto).orderBy(campo),
        referencia.where(campo, ">=", Timestamp.fromDate(desdeUTC)).where(campo, "<", Timestamp.fromDate(hastaUTC)).orderBy(campo),
      ]);
      const documentos = (await Promise.all(consultas.map(consulta => leerPaginas(consulta, transaction)))).flat();
      return documentos.map(documento => ({ id: documento.id, coleccion, datos: documento.data() } satisfies RegistroExportable));
    }));
    const registros = resultados.flat();
    const idsTarjetas = Array.from(new Set(registros.map(registro => typeof registro.datos.tarjetaId === "string" ? registro.datos.tarjetaId.trim() : null)
      .filter((value): value is string => typeof value === "string" && value.length > 0 && value.length <= 1500 && !value.includes("/") && value !== "." && value !== "..")));
    const tarjetas = new Map<string, string>();
    for (let index = 0; index < idsTarjetas.length; index += 100) {
      const referencias = idsTarjetas.slice(index, index + 100).map(id => db.doc(`users/${uid}/tarjetasCredito/${id}`));
      const documentos = await transaction.getAll(...referencias);
      for (const documento of documentos) {
        const nombre: unknown = documento.data()?.nombre;
        if (typeof nombre === "string") tarjetas.set(documento.id, nombre);
      }
    }
    return { registros, tarjetas };
  }, { readOnly: true });
}
