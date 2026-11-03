import "server-only";
import { FieldValue, type DocumentData, type Firestore, type Transaction } from "firebase-admin/firestore";
import { cambiosHistorial, type AccionHistorial, type ColeccionHistorial } from "./types";

export function registrarHistorialServidor(transaction: Transaction, db: Firestore, uid: string, coleccion: ColeccionHistorial,
  documentoId: string, antes: DocumentData | null, despues: DocumentData | null, accion: AccionHistorial) {
  if (accion === "editado" && cambiosHistorial(antes, despues).length === 0) return;
  transaction.create(db.collection(`users/${uid}/historialCambios`).doc(), {
    actorUid: uid, coleccion, documentoId, antes, despues, accion, fecha: FieldValue.serverTimestamp(),
  });
}
