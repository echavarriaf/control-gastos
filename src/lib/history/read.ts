"use client";
import { getDocsFromServer, limit, orderBy, query, startAfter, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { getUserCollection } from "@/lib/firestore/user-paths";
import { esColeccionHistorial, type EventoHistorial } from "./types";

export async function leerHistorial(uid: string, cursor?: QueryDocumentSnapshot<DocumentData>) {
  const consulta = query(getUserCollection(uid, "historialCambios"), orderBy("fecha", "desc"), ...(cursor ? [startAfter(cursor)] : []), limit(21));
  const snapshot = await getDocsFromServer(consulta);
  const eventos = snapshot.docs.slice(0, 20).map(documento => {
    const data = documento.data();
    if (!esColeccionHistorial(data.coleccion) || typeof data.documentoId !== "string" || data.actorUid !== uid ||
      !["creado", "editado", "eliminado", "recuperado", "recalibrado"].includes(data.accion)) throw new Error("Hay un registro de historial que no se pudo interpretar.");
    return { id: documento.id, ...data as EventoHistorial };
  });
  return { eventos, siguiente: snapshot.size > 20 ? snapshot.docs[19] : undefined };
}
