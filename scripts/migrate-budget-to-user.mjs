import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

/**
 * ============================================================
 * PRESUPUESTO FELO
 * Migración de datos globales -> datos privados por usuario
 * ============================================================
 *
 * Ejecutar primero en modo simulación:
 *
 * node --env-file=.env.local \
 *   scripts/migrate-budget-to-user.mjs TU_UID
 *
 * Ejecutar la migración real:
 *
 * node --env-file=.env.local \
 *   scripts/migrate-budget-to-user.mjs TU_UID --execute
 *
 * Si necesitas sobrescribir documentos que ya existen:
 *
 * node --env-file=.env.local \
 *   scripts/migrate-budget-to-user.mjs TU_UID --execute --overwrite
 *
 * IMPORTANTE:
 * - NO elimina las colecciones originales.
 * - Conserva los IDs de todos los documentos.
 * - Es seguro ejecutarlo primero sin --execute.
 * - Por defecto NO sobrescribe documentos existentes.
 */

const args =
  process.argv.slice(2);

const uid =
  args.find(
    (arg) =>
      !arg.startsWith("--"),
  )?.trim() ?? "";

const execute =
  args.includes("--execute");

const overwrite =
  args.includes("--overwrite");

if (!uid) {
  console.error(
    "\n❌ Debes indicar el UID del usuario.\n",
  );

  console.error(
    "Ejemplo:\n",
  );

  console.error(
    "node --env-file=.env.local scripts/migrate-budget-to-user.mjs ABC123\n",
  );

  process.exit(1);
}

const projectId =
  getRequiredEnv(
    "FIREBASE_ADMIN_PROJECT_ID",
  );

const clientEmail =
  getRequiredEnv(
    "FIREBASE_ADMIN_CLIENT_EMAIL",
  );

const privateKey =
  normalizePrivateKey(
    getRequiredEnv(
      "FIREBASE_ADMIN_PRIVATE_KEY",
    ),
  );

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),

        projectId,
      });

const db =
  getFirestore(app);

/**
 * Colecciones financieras que actualmente
 * viven en la raíz de Firestore.
 */
const COLLECTIONS = [
  "gastos",
  "pagosTarjeta",
  "pagosFijos",
  "compromisosFijos",
  "tarjetasCredito",
  "ingresos",
];

/**
 * Documentos de configuración que deben pasar:
 *
 * configuracion/{id}
 *
 * a:
 *
 * users/{uid}/configuracion/{id}
 */
const CONFIG_DOCUMENTS = [
  "presupuestoFelo",
  "ingresoPrincipal",
];

/**
 * Firestore acepta hasta 500 operaciones
 * en un batch.
 *
 * Usamos 400 para dejar margen.
 */
const BATCH_LIMIT = 400;

console.log(
  "\n============================================",
);

console.log(
  " PRESUPUESTO FELO - MIGRACIÓN MULTIUSUARIO",
);

console.log(
  "============================================\n",
);

console.log(
  `UID destino: ${uid}`,
);

console.log(
  `Modo: ${
    execute
      ? "EJECUCIÓN REAL"
      : "SIMULACIÓN"
  }`,
);

console.log(
  `Sobrescribir existentes: ${
    overwrite
      ? "SÍ"
      : "NO"
  }\n`,
);

/**
 * Antes de copiar cualquier información
 * verificamos que el UID exista en allowedUsers
 * y que siga activo.
 */
const allowedUserRef =
  db
    .collection(
      "allowedUsers",
    )
    .doc(uid);

const allowedUserSnapshot =
  await allowedUserRef.get();

if (
  !allowedUserSnapshot.exists
) {
  console.error(
    `❌ No existe allowedUsers/${uid}.`,
  );

  console.error(
    "La migración fue cancelada.\n",
  );

  process.exit(1);
}

const allowedUserData =
  allowedUserSnapshot.data();

if (
  allowedUserData?.activo !==
  true
) {
  console.error(
    `❌ allowedUsers/${uid} no tiene activo=true.`,
  );

  console.error(
    "La migración fue cancelada.\n",
  );

  process.exit(1);
}

console.log(
  "✅ Usuario autorizado encontrado.\n",
);

const stats = {
  sourceDocuments: 0,
  copiedDocuments: 0,
  skippedDocuments: 0,
  overwrittenDocuments: 0,
  configCopied: 0,
  configSkipped: 0,
};

/**
 * ------------------------------------------------------------
 * COPIA DE COLECCIONES
 * ------------------------------------------------------------
 */
for (
  const collectionName
  of COLLECTIONS
) {
  await migrateCollection(
    collectionName,
  );
}

/**
 * ------------------------------------------------------------
 * COPIA DE CONFIGURACIÓN
 * ------------------------------------------------------------
 */
for (
  const documentId
  of CONFIG_DOCUMENTS
) {
  await migrateConfigDocument(
    documentId,
  );
}

/**
 * ------------------------------------------------------------
 * CREAR/MARCAR EL CONTENEDOR DEL USUARIO
 * ------------------------------------------------------------
 *
 * Este documento no contiene el presupuesto.
 * Solo identifica que el namespace fue preparado.
 */
const userRootRef =
  db
    .collection("users")
    .doc(uid);

if (execute) {
  await userRootRef.set(
    {
      uid,

      presupuestoInicializado:
        true,

      migracionLegacy:
        true,

      migradoEn:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );
}

console.log(
  "\n============================================",
);

console.log(
  " RESUMEN",
);

console.log(
  "============================================",
);

console.log(
  `Documentos origen:       ${stats.sourceDocuments}`,
);

console.log(
  `Copiados:                ${stats.copiedDocuments}`,
);

console.log(
  `Omitidos existentes:     ${stats.skippedDocuments}`,
);

console.log(
  `Sobrescritos:            ${stats.overwrittenDocuments}`,
);

console.log(
  `Configuraciones copiadas:${stats.configCopied}`,
);

console.log(
  `Configuraciones omitidas:${stats.configSkipped}`,
);

console.log("");

if (!execute) {
  console.log(
    "ℹ️ No se modificó Firestore.",
  );

  console.log(
    "La ejecución fue solamente una simulación.\n",
  );

  console.log(
    "Si todo se ve correcto ejecuta:\n",
  );

  console.log(
    `node --env-file=.env.local scripts/migrate-budget-to-user.mjs ${uid} --execute\n`,
  );
} else {
  console.log(
    "✅ Migración completada.",
  );

  console.log(
    "Las colecciones antiguas NO fueron eliminadas.\n",
  );

  console.log(
    "Nueva estructura:",
  );

  console.log(
    `users/${uid}/gastos`,
  );

  console.log(
    `users/${uid}/pagosTarjeta`,
  );

  console.log(
    `users/${uid}/pagosFijos`,
  );

  console.log(
    `users/${uid}/compromisosFijos`,
  );

  console.log(
    `users/${uid}/tarjetasCredito`,
  );

  console.log(
    `users/${uid}/ingresos`,
  );

  console.log(
    `users/${uid}/configuracion/presupuestoFelo`,
  );

  console.log(
    `users/${uid}/configuracion/ingresoPrincipal\n`,
  );
}

/**
 * ============================================================
 * FUNCIONES
 * ============================================================
 */

async function migrateCollection(
  collectionName,
) {
  console.log(
    `📦 ${collectionName}`,
  );

  const sourceRef =
    db.collection(
      collectionName,
    );

  const destinationRef =
    db
      .collection("users")
      .doc(uid)
      .collection(
        collectionName,
      );

  const [
    sourceSnapshot,
    destinationSnapshot,
  ] = await Promise.all([
    sourceRef.get(),
    destinationRef.get(),
  ]);

  const existingIds =
    new Set(
      destinationSnapshot.docs.map(
        (document) =>
          document.id,
      ),
    );

  stats.sourceDocuments +=
    sourceSnapshot.size;

  console.log(
    `   origen: ${sourceSnapshot.size}`,
  );

  console.log(
    `   destino existente: ${destinationSnapshot.size}`,
  );

  if (
    sourceSnapshot.empty
  ) {
    console.log(
      "   → sin documentos\n",
    );

    return;
  }

  const operations = [];

  for (
    const document
    of sourceSnapshot.docs
  ) {
    const alreadyExists =
      existingIds.has(
        document.id,
      );

    if (
      alreadyExists &&
      !overwrite
    ) {
      stats.skippedDocuments +=
        1;

      continue;
    }

    if (alreadyExists) {
      stats.overwrittenDocuments +=
        1;
    }

    operations.push({
      reference:
        destinationRef.doc(
          document.id,
        ),

      data:
        document.data(),
    });
  }

  console.log(
    `   a copiar: ${operations.length}`,
  );

  if (!execute) {
    console.log(
      "   → simulación\n",
    );

    return;
  }

  await commitOperations(
    operations,
  );

  stats.copiedDocuments +=
    operations.length;

  const verification =
    await destinationRef.get();

  console.log(
    `   destino final: ${verification.size}`,
  );

  console.log(
    "   ✅ completado\n",
  );
}

async function migrateConfigDocument(
  documentId,
) {
  console.log(
    `⚙️ configuracion/${documentId}`,
  );

  const sourceRef =
    db
      .collection(
        "configuracion",
      )
      .doc(documentId);

  const destinationRef =
    db
      .collection("users")
      .doc(uid)
      .collection(
        "configuracion",
      )
      .doc(documentId);

  const [
    sourceSnapshot,
    destinationSnapshot,
  ] = await Promise.all([
    sourceRef.get(),
    destinationRef.get(),
  ]);

  if (
    !sourceSnapshot.exists
  ) {
    console.log(
      "   → no existe en origen\n",
    );

    return;
  }

  if (
    destinationSnapshot.exists &&
    !overwrite
  ) {
    stats.configSkipped +=
      1;

    console.log(
      "   → ya existe en destino; omitido\n",
    );

    return;
  }

  if (!execute) {
    console.log(
      "   → se copiaría\n",
    );

    return;
  }

  await destinationRef.set(
    sourceSnapshot.data(),
  );

  stats.configCopied += 1;

  console.log(
    "   ✅ copiado\n",
  );
}

async function commitOperations(
  operations,
) {
  if (
    operations.length === 0
  ) {
    return;
  }

  for (
    let index = 0;
    index <
    operations.length;
    index += BATCH_LIMIT
  ) {
    const chunk =
      operations.slice(
        index,
        index +
          BATCH_LIMIT,
      );

    const batch =
      db.batch();

    for (
      const operation
      of chunk
    ) {
      batch.set(
        operation.reference,
        operation.data,
      );
    }

    await batch.commit();
  }
}

function getRequiredEnv(
  name,
) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}.`,
    );
  }

  return value;
}

function normalizePrivateKey(
  value,
) {
  const trimmed =
    value.trim();

  const firstCharacter =
    trimmed.at(0);

  const lastCharacter =
    trimmed.at(-1);

  const wrapped =
    (
      firstCharacter ===
        '"' &&
      lastCharacter ===
        '"'
    ) ||
    (
      firstCharacter ===
        "'" &&
      lastCharacter ===
        "'"
    );

  const withoutQuotes =
    wrapped
      ? trimmed.slice(
          1,
          -1,
        )
      : trimmed;

  return withoutQuotes.replace(
    /\\n/g,
    "\n",
  );
}