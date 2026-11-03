"use client";
import { collection, doc, getDocFromServer, runTransaction, serverTimestamp, type CollectionReference, type DocumentData, type DocumentReference, type DocumentSnapshot, type Transaction } from "firebase/firestore";
import { cambiosHistorial, esColeccionHistorial, mezclarDatos, mismosDatosHistorial, type EventoHistorial } from "./types";

export async function transaccionConHistorial<T>(referencia: DocumentReference<DocumentData>, operacion: (transaction: Transaction, snapshot: DocumentSnapshot<DocumentData>) => Promise<T>): Promise<T> {
  for (let intento = 0; ; intento++) {
    let leido: DocumentData | null | undefined;
    try {
      return await runTransaction(referencia.firestore, async transaction => {
        const snapshot = await transaction.get(referencia);
        leido = snapshot.exists() ? snapshot.data() : null;
        return operacion(transaction, snapshot);
      });
    } catch (error) {
      // Before-image security checks can reject a stale client transaction before
      // Firestore reports its optimistic conflict. Retry only a verified change,
      // never an unchanged permission failure or a rejected financial operation.
      if (intento >= 2 || !error || typeof error !== "object" || !("code" in error) || error.code !== "permission-denied" || leido === undefined) throw error;
      let actual: DocumentData | null;
      try { const snapshot = await getDocFromServer(referencia); actual = snapshot.exists() ? snapshot.data() : null; }
      catch { throw error; }
      if (mismosDatosHistorial(leido, actual)) throw error;
    }
  }
}

export function registrarCambioEnTransaccion(transaction: Transaction, referencia: DocumentReference<DocumentData>, antes: DocumentData | null, despues: DocumentData) {
  const partes = referencia.path.split("/");
  if (partes.length !== 4 || partes[0] !== "users" || !esColeccionHistorial(partes[2]) || !referencia.parent.parent) throw new Error("Referencia financiera no válida para el historial.");
  if (antes && cambiosHistorial(antes, despues).length === 0) return;
  const evento: EventoHistorial = { actorUid: partes[1], coleccion: partes[2], documentoId: partes[3], accion: antes ? "editado" : "creado",
    antes, despues, fecha: serverTimestamp() };
  // The owner root comes from the validated financial reference, never from user input.
  transaction.set(doc(collection(referencia.parent.parent, "historialCambios")), evento);
}
export async function addDocConHistorial(referencia: CollectionReference<DocumentData>, datos: DocumentData) {
  const documento = doc(referencia);
  await transaccionConHistorial(documento, async (transaction, snapshot) => {
    if (snapshot.exists()) throw new Error("Ya existe el registro.");
    transaction.set(documento, datos);
    registrarCambioEnTransaccion(transaction, documento, null, datos);
  });
  return documento;
}
export async function setDocConHistorial(referencia: DocumentReference<DocumentData>, datos: DocumentData, opciones?: { merge: boolean }) {
  await transaccionConHistorial(referencia, async (transaction, snapshot) => {
    const antes = snapshot.exists() ? snapshot.data() : null;
    const despues = opciones?.merge ? mezclarDatos(antes ?? {}, datos) : { ...datos };
    if (antes?.creadoEn != null) despues.creadoEn = antes.creadoEn;
    transaction.set(referencia, despues);
    registrarCambioEnTransaccion(transaction, referencia, antes, despues);
  });
}
export async function updateDocConHistorial(referencia: DocumentReference<DocumentData>, datos: DocumentData) {
  await transaccionConHistorial(referencia, async (transaction, snapshot) => {
    if (!snapshot.exists()) throw new Error("El registro ya no existe. Actualiza la pantalla.");
    if (Object.keys(datos).some(campo => campo.includes("."))) throw new Error("El historial requiere campos completos.");
    const antes = snapshot.data(); const despues = { ...antes, ...datos };
    transaction.update(referencia, datos);
    registrarCambioEnTransaccion(transaction, referencia, antes, despues);
  });
}
