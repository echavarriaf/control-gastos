import {
  collection,
  doc,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

/**
 * ============================================================
 * COLECCIONES PRIVADAS POR USUARIO
 * ============================================================
 *
 * Todas las colecciones financieras y de configuración
 * pertenecen exclusivamente a:
 *
 * users/{uid}/...
 *
 * Mantener los nombres dentro de este union evita que los
 * componentes y hooks construyan rutas privadas manualmente.
 */
export type UserCollectionName =
  | "gastos"
  | "pagosTarjeta"
  | "pagosFijos"
  | "compromisosFijos"
  | "tarjetasCredito"
  | "categoriasTarjeta"
  | "ingresos"
  | "notificationDevices";

export type UserConfigDocumentId =
  | "presupuestoFelo"
  | "ingresoPrincipal";

/**
 * Devuelve la referencia raíz del usuario.
 *
 * users/{uid}
 *
 * La aplicación financiera nunca debe construir rutas privadas
 * concatenando strings manualmente. Todas las referencias deben
 * pasar por estas funciones para mantener el aislamiento por UID.
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
 *
 * Ejemplos:
 *
 * users/{uid}/gastos
 * users/{uid}/tarjetasCredito
 * users/{uid}/categoriasTarjeta
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
 * Devuelve un documento de configuración privado:
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
 * Valida un segmento individual de una ruta de Firestore.
 *
 * No acepta:
 *
 * - valores vacíos;
 * - segmentos que contengan "/".
 *
 * Esto evita construir accidentalmente rutas que escapen
 * del namespace esperado.
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
    normalized.includes(
      "/",
    )
  ) {
    throw new Error(
      `${label} no puede contener '/'.`,
    );
  }

  return normalized;
}