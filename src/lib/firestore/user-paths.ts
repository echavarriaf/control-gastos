import {
  collection,
  doc,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type UserCollectionName =
  | "gastos"
  | "pagosTarjeta"
  | "pagosFijos"
  | "compromisosFijos"
  | "tarjetasCredito"
  | "ingresos"
  | "notificationDevices";

export type UserConfigDocumentId =
  | "presupuestoFelo"
  | "ingresoPrincipal";

/**
 * Devuelve la referencia al documento raíz del usuario:
 *
 * users/{uid}
 */
export function getUserRootDocument(
  uid: string,
): DocumentReference<DocumentData> {
  return doc(
    db,
    "users",
    validarSegmento(
      uid,
      "UID",
    ),
  );
}

/**
 * Devuelve una colección privada del usuario:
 *
 * users/{uid}/{collectionName}
 */
export function getUserCollection(
  uid: string,
  collectionName: UserCollectionName,
): CollectionReference<DocumentData> {
  return collection(
    db,
    "users",
    validarSegmento(
      uid,
      "UID",
    ),
    collectionName,
  );
}

/**
 * Devuelve un documento dentro de una colección privada:
 *
 * users/{uid}/{collectionName}/{documentId}
 */
export function getUserDocument(
  uid: string,
  collectionName: UserCollectionName,
  documentId: string,
): DocumentReference<DocumentData> {
  return doc(
    db,
    "users",
    validarSegmento(
      uid,
      "UID",
    ),
    collectionName,
    validarSegmento(
      documentId,
      "ID de documento",
    ),
  );
}

/**
 * Devuelve un documento privado de configuración:
 *
 * users/{uid}/configuracion/{documentId}
 */
export function getUserConfigDocument(
  uid: string,
  documentId: UserConfigDocumentId,
): DocumentReference<DocumentData> {
  return doc(
    db,
    "users",
    validarSegmento(
      uid,
      "UID",
    ),
    "configuracion",
    documentId,
  );
}

/**
 * Evita construir accidentalmente rutas Firestore inválidas
 * mediante segmentos vacíos o valores que contengan "/".
 */
function validarSegmento(
  value: string,
  label: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      `${label} no puede estar vacío.`,
    );
  }

  if (
    normalized.includes("/")
  ) {
    throw new Error(
      `${label} no puede contener '/'.`,
    );
  }

  return normalized;
}