import { orderBy, query, where, type CollectionReference, type DocumentData } from "firebase/firestore";

/** Manual movements before the baseline never participate in the bank ledger. */
export function movimientosDesdeSaldoInicial(reference: CollectionReference<DocumentData>, fecha: string) {
  return query(reference, where("fecha", ">=", fecha), orderBy("fecha", "desc"));
}

/** Use the receipt date, including deposits scheduled before recalibration. */
export function ingresosDesdeSaldoInicial(reference: CollectionReference<DocumentData>, fecha: string) {
  return query(reference, where("fechaRecibida", ">=", fecha), orderBy("fechaRecibida", "desc"));
}

/** Only the projection interval is needed, including edited or cancelled paychecks. */
export function ingresosProgramadosEntre(reference: CollectionReference<DocumentData>, inicio: string, fin: string) {
  return query(reference, where("fechaProgramada", ">=", inicio), where("fechaProgramada", "<=", fin), orderBy("fechaProgramada", "asc"));
}
