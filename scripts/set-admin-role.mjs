import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

const args =
  process.argv.slice(
    2,
  );

const uid =
  args
    .find(
      (arg) =>
        !arg.startsWith(
          "--",
        ),
    )
    ?.trim();

const execute =
  args.includes(
    "--execute",
  );

if (!uid) {
  printUsage();
  process.exit(1);
}

initializeFirebaseAdmin();

const db =
  getFirestore();

const adminAuth =
  getAuth();

await main();

async function main() {
  console.log("");
  console.log(
    "============================================================",
  );
  console.log(
    " Configurar rol administrador",
  );
  console.log(
    "============================================================",
  );
  console.log(
    `UID: ${uid}`,
  );
  console.log(
    `Modo: ${
      execute
        ? "EJECUCIÓN"
        : "SIMULACIÓN"
    }`,
  );
  console.log("");

  const allowedRef =
    db
      .collection(
        "allowedUsers",
      )
      .doc(
        uid,
      );

  const [
    allowedSnapshot,
    authUser,
  ] =
    await Promise.all([
      allowedRef.get(),
      adminAuth.getUser(
        uid,
      ),
    ]);

  if (
    !allowedSnapshot.exists
  ) {
    throw new Error(
      `El UID ${uid} no existe en allowedUsers. Autoriza primero la cuenta antes de convertirla en administrador.`,
    );
  }

  const current =
    allowedSnapshot.data() ??
    {};

  const payload = {
    uid,
    activo:
      true,
    rol:
      "admin",
    nombre:
      authUser.displayName
        ?.trim() ||
      normalizarTexto(
        current.nombre,
      ) ||
      "Administrador",
    email:
      authUser.email
        ?.trim()
        .toLowerCase() ||
      normalizarTexto(
        current.email,
      ).toLowerCase(),
    fotoUrl:
      authUser.photoURL ??
      normalizarTextoONull(
        current.fotoUrl,
      ),
  };

  console.log(
    "Estado actual:",
  );
  console.log(
    `  activo: ${String(
      current.activo,
    )}`,
  );
  console.log(
    `  rol: ${String(
      current.rol ??
        "sin rol",
    )}`,
  );
  console.log("");

  console.log(
    "Estado destino:",
  );
  console.log(
    "  activo: true",
  );
  console.log(
    "  rol: admin",
  );
  console.log(
    `  nombre: ${payload.nombre}`,
  );
  console.log(
    `  email: ${payload.email}`,
  );
  console.log("");

  if (!execute) {
    console.log(
      "🧪 SIMULACIÓN COMPLETADA.",
    );
    console.log(
      "No se escribió ningún documento.",
    );
    console.log("");
    console.log(
      "Para ejecutar realmente:",
    );
    console.log(
      `node --env-file=.env.local scripts/set-admin-role.mjs ${uid} --execute`,
    );
    console.log("");
    return;
  }

  await allowedRef.set(
    {
      ...payload,
      administradorDesde:
        current
          .administradorDesde ??
        FieldValue
          .serverTimestamp(),
      actualizadoEn:
        FieldValue
          .serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  console.log(
    "✅ Rol admin configurado correctamente.",
  );
  console.log(
    `✅ allowedUsers/${uid} ahora tiene activo=true y rol=admin.`,
  );
  console.log("");
}

function initializeFirebaseAdmin() {
  if (
    getApps().length >
    0
  ) {
    return;
  }

  const projectId =
    requiredEnv(
      "FIREBASE_ADMIN_PROJECT_ID",
    );

  const clientEmail =
    requiredEnv(
      "FIREBASE_ADMIN_CLIENT_EMAIL",
    );

  const privateKey =
    normalizePrivateKey(
      requiredEnv(
        "FIREBASE_ADMIN_PRIVATE_KEY",
      ),
    );

  initializeApp({
    credential:
      cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    projectId,
  });
}

function requiredEnv(
  name,
) {
  const value =
    process.env[name]
      ?.trim();

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

  const unquoted =
    (
      trimmed.startsWith(
        '"',
      ) &&
      trimmed.endsWith(
        '"',
      )
    ) ||
    (
      trimmed.startsWith(
        "'",
      ) &&
      trimmed.endsWith(
        "'",
      )
    )
      ? trimmed.slice(
          1,
          -1,
        )
      : trimmed;

  return unquoted.replace(
    /\\n/g,
    "\n",
  );
}

function normalizarTexto(
  value,
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function normalizarTextoONull(
  value,
) {
  const text =
    normalizarTexto(
      value,
    );

  return text ||
    null;
}

function printUsage() {
  console.log("");
  console.log(
    "Uso:",
  );
  console.log(
    "node --env-file=.env.local scripts/set-admin-role.mjs UID [--execute]",
  );
  console.log("");
}