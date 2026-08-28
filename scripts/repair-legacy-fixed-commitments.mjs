import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

const LEGACY_COMMITMENTS = [
  {
    id: "iul-kids",
    descripcion: "IUL kids",
    monto: 65,
  },
  {
    id: "prestamo-amex",
    descripcion: "Préstamo Felo AMEX",
    monto: 145,
  },
  {
    id: "vehiculo-2",
    descripcion: "Vehículo 2 (F)",
    monto: 555,
  },
  {
    id: "ahorro-comun",
    descripcion: "Ahorro común",
    monto: 200,
  },
  {
    id: "ayuda-maria",
    descripcion: "Ayuda María Casa",
    monto: 60,
  },
  {
    id: "celular",
    descripcion: "Celular",
    monto: 25,
  },
  {
    id: "solar-tia-mise",
    descripcion: "Solar Tía Mise / AMEX F. Mariel",
    monto: 150,
  },
  {
    id: "iul-ea",
    descripcion: "IUL E/A",
    monto: 300,
  },
];

const VALID_PAYMENT_METHODS =
  new Set([
    "debito_automatico",
    "transferencia",
    "tarjeta",
    "efectivo",
    "otro",
  ]);

const DEFAULT_PAYMENT_METHOD =
  "transferencia";

const DEFAULT_PRIORITY =
  2;

const DEFAULT_DUE_DAY =
  1;

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

const overwrite =
  args.includes(
    "--overwrite",
  );

const referencedOnly =
  args.includes(
    "--referenced-only",
  );

if (!uid) {
  printUsage();
  process.exit(1);
}

initializeFirebaseAdmin();

const db =
  getFirestore();

await main();

async function main() {
  console.log("");
  console.log(
    "============================================================",
  );
  console.log(
    " Reparación de compromisos fijos legacy",
  );
  console.log(
    "============================================================",
  );

  console.log(
    `UID destino: ${uid}`,
  );

  console.log(
    `Modo: ${
      execute
        ? "EJECUCIÓN"
        : "SIMULACIÓN"
    }`,
  );

  console.log(
    `Sobrescribir existentes: ${
      overwrite
        ? "SÍ"
        : "NO"
    }`,
  );

  console.log(
    `Solo IDs referenciados por pagos: ${
      referencedOnly
        ? "SÍ"
        : "NO"
    }`,
  );

  console.log("");

  await validarUsuarioAutorizado();

  const userRef =
    db
      .collection(
        "users",
      )
      .doc(
        uid,
      );

  const commitmentsRef =
    userRef.collection(
      "compromisosFijos",
    );

  const paymentsRef =
    userRef.collection(
      "pagosFijos",
    );

  const [
    commitmentsSnapshot,
    paymentsSnapshot,
  ] =
    await Promise.all([
      commitmentsRef.get(),
      paymentsRef.get(),
    ]);

  const existingCommitmentIds =
    new Set(
      commitmentsSnapshot.docs.map(
        (documento) =>
          documento.id,
      ),
    );

  const payments =
    paymentsSnapshot.docs.map(
      (documento) => ({
        id:
          documento.id,

        ...documento.data(),
      }),
    );

  const paymentsByCommitmentId =
    groupPaymentsByCommitmentId(
      payments,
    );

  console.log(
    `Compromisos actuales en users/${uid}: ${commitmentsSnapshot.size}`,
  );

  console.log(
    `Pagos fijos históricos en users/${uid}: ${paymentsSnapshot.size}`,
  );

  console.log("");

  const plan = [];

  for (
    const legacy
    of LEGACY_COMMITMENTS
  ) {
    const relatedPayments =
      paymentsByCommitmentId.get(
        legacy.id,
      ) ?? [];

    const exists =
      existingCommitmentIds.has(
        legacy.id,
      );

    if (
      referencedOnly &&
      relatedPayments.length ===
        0
    ) {
      console.log(
        `⏭️  ${legacy.id} — sin pagos históricos; omitido por --referenced-only`,
      );

      continue;
    }

    if (
      exists &&
      !overwrite
    ) {
      console.log(
        `✅ ${legacy.id} — ya existe; no se modifica (${relatedPayments.length} pagos históricos)`,
      );

      continue;
    }

    const inferred =
      inferCommitmentMetadata(
        legacy,
        relatedPayments,
      );

    plan.push({
      legacy,
      relatedPayments,
      data:
        inferred,
      exists,
    });

    console.log(
      `${
        exists
          ? "♻️ "
          : "➕"
      } ${legacy.id} — ${legacy.descripcion}`,
    );

    console.log(
      `   monto: $${legacy.monto.toFixed(
        2,
      )}`,
    );

    console.log(
      `   pagos históricos enlazados: ${relatedPayments.length}`,
    );

    console.log(
      `   día vencimiento inferido: ${inferred.diaVencimiento}`,
    );

    console.log(
      `   quincena: Q${inferred.quincenaPresupuestaria}`,
    );

    console.log(
      `   método preferido: ${inferred.metodoPagoPreferido}`,
    );

    console.log(
      `   acción: ${
        exists
          ? "sobrescribir"
          : "crear"
      }`,
    );
  }

  const orphanIds =
    findUnknownPaymentCommitmentIds(
      paymentsByCommitmentId,
      existingCommitmentIds,
    );

  console.log("");
  console.log(
    "------------------------------------------------------------",
  );

  console.log(
    `Documentos a ${
      execute
        ? "escribir"
        : "crear/sobrescribir"
    }: ${plan.length}`,
  );

  console.log(
    `IDs huérfanos no reconocidos: ${orphanIds.length}`,
  );

  if (
    orphanIds.length >
    0
  ) {
    console.log("");

    console.log(
      "⚠️  Pagos con compromisoId que no pertenece al catálogo legacy",
    );

    console.log(
      "   ni a un compromiso actual:",
    );

    for (
      const orphan
      of orphanIds
    ) {
      console.log(
        `   - ${orphan.id}: ${orphan.count} pago(s)`,
      );
    }
  }

  if (!execute) {
    console.log("");

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
      `node --env-file=.env.local scripts/repair-legacy-fixed-commitments.mjs ${uid} --execute`,
    );

    console.log("");

    return;
  }

  if (
    plan.length ===
    0
  ) {
    console.log("");

    console.log(
      "✅ No hay nada que reparar.",
    );

    console.log("");

    return;
  }

  const batch =
    db.batch();

  for (
    const item
    of plan
  ) {
    const targetRef =
      commitmentsRef.doc(
        item.legacy.id,
      );

    const dataToWrite = {
      ...item.data,

      actualizadoEn:
        FieldValue
          .serverTimestamp(),
    };

    if (
      !item.exists
    ) {
      dataToWrite.creadoEn =
        FieldValue
          .serverTimestamp();
    }

    batch.set(
      targetRef,
      dataToWrite,
      {
        merge:
          item.exists,
      },
    );
  }

  await batch.commit();

  console.log("");

  console.log(
    `✅ Reparación completada: ${plan.length} compromiso(s) escrito(s).`,
  );

  console.log(
    "✅ pagosFijos NO fue modificado.",
  );

  console.log("");

  console.log(
    "Verifica ahora en Firestore:",
  );

  console.log(
    `users/${uid}/compromisosFijos`,
  );

  console.log("");
}

async function validarUsuarioAutorizado() {
  const allowedRef =
    db
      .collection(
        "allowedUsers",
      )
      .doc(
        uid,
      );

  const snapshot =
    await allowedRef.get();

  if (
    !snapshot.exists
  ) {
    throw new Error(
      `El UID ${uid} no existe en allowedUsers. Se cancela la reparación.`,
    );
  }

  if (
    snapshot.data()
      ?.activo !==
    true
  ) {
    throw new Error(
      `El UID ${uid} existe en allowedUsers, pero activo !== true. Se cancela la reparación.`,
    );
  }

  console.log(
    "✅ Usuario autorizado encontrado.",
  );

  console.log("");
}

function inferCommitmentMetadata(
  legacy,
  payments,
) {
  const dueDay =
    inferMostCommonDueDay(
      payments,
    ) ??
    DEFAULT_DUE_DAY;

  const paymentMethod =
    inferMostCommonPaymentMethod(
      payments,
    ) ??
    DEFAULT_PAYMENT_METHOD;

  return {
    descripcion:
      inferDescription(
        legacy,
        payments,
      ),

    monto:
      legacy.monto,

    diaVencimiento:
      dueDay,

    quincenaPresupuestaria:
      dueDay <= 15
        ? 1
        : 2,

    prioridad:
      DEFAULT_PRIORITY,

    metodoPagoPreferido:
      paymentMethod,

    tarjetaId:
      null,

    activo:
      true,
  };
}

function inferDescription(
  legacy,
  payments,
) {
  const descriptions =
    payments
      .map(
        (
          payment,
        ) =>
          typeof payment
            .descripcion ===
          "string"
            ? payment
                .descripcion
                .trim()
            : "",
      )
      .filter(
        Boolean,
      );

  if (
    descriptions.length ===
    0
  ) {
    return legacy.descripcion;
  }

  return (
    mostCommon(
      descriptions,
    ) ??
    legacy.descripcion
  );
}

function inferMostCommonDueDay(
  payments,
) {
  const days =
    payments
      .map(
        (
          payment,
        ) =>
          parseDayFromStoredDate(
            payment.fecha,
          ),
      )
      .filter(
        (
          value,
        ) =>
          Number.isInteger(
            value,
          ) &&
          value >= 1 &&
          value <= 31,
      );

  return mostCommon(
    days,
  );
}

function inferMostCommonPaymentMethod(
  payments,
) {
  const methods =
    payments
      .map(
        (
          payment,
        ) =>
          typeof payment
            .metodo ===
          "string"
            ? payment
                .metodo
                .trim()
            : "",
      )
      .filter(
        (
          method,
        ) =>
          VALID_PAYMENT_METHODS.has(
            method,
          ),
      );

  return mostCommon(
    methods,
  );
}

function parseDayFromStoredDate(
  value,
) {
  if (
    typeof value ===
    "string"
  ) {
    const yyyyMmDd =
      /^(\d{4})-(\d{2})-(\d{2})/.exec(
        value,
      );

    if (yyyyMmDd) {
      return Number(
        yyyyMmDd[3],
      );
    }

    const parsed =
      new Date(
        value,
      );

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      return parsed.getUTCDate();
    }
  }

  if (
    value &&
    typeof value ===
      "object" &&
    typeof value.toDate ===
      "function"
  ) {
    const parsed =
      value.toDate();

    if (
      parsed instanceof
        Date &&
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      return parsed.getUTCDate();
    }
  }

  return null;
}

function groupPaymentsByCommitmentId(
  payments,
) {
  const grouped =
    new Map();

  for (
    const payment
    of payments
  ) {
    const commitmentId =
      typeof payment
        .compromisoId ===
      "string"
        ? payment
            .compromisoId
            .trim()
        : "";

    if (!commitmentId) {
      continue;
    }

    const current =
      grouped.get(
        commitmentId,
      ) ?? [];

    current.push(
      payment,
    );

    grouped.set(
      commitmentId,
      current,
    );
  }

  return grouped;
}

function findUnknownPaymentCommitmentIds(
  paymentsByCommitmentId,
  existingCommitmentIds,
) {
  const legacyIds =
    new Set(
      LEGACY_COMMITMENTS.map(
        (
          commitment,
        ) =>
          commitment.id,
      ),
    );

  const unknown =
    [];

  for (
    const [
      id,
      payments,
    ]
    of paymentsByCommitmentId.entries()
  ) {
    if (
      legacyIds.has(
        id,
      ) ||
      existingCommitmentIds.has(
        id,
      )
    ) {
      continue;
    }

    unknown.push({
      id,

      count:
        payments.length,
    });
  }

  return unknown.sort(
    (
      a,
      b,
    ) =>
      b.count -
        a.count ||
      a.id.localeCompare(
        b.id,
      ),
  );
}

function mostCommon(
  values,
) {
  if (
    values.length ===
    0
  ) {
    return null;
  }

  const counts =
    new Map();

  for (
    const value
    of values
  ) {
    counts.set(
      value,

      (
        counts.get(
          value,
        ) ??
        0
      ) + 1,
    );
  }

  let bestValue =
    null;

  let bestCount =
    -1;

  for (
    const [
      value,
      count,
    ]
    of counts.entries()
  ) {
    if (
      count >
      bestCount
    ) {
      bestValue =
        value;

      bestCount =
        count;
    }
  }

  return bestValue;
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

function printUsage() {
  console.log("");

  console.log(
    "Uso:",
  );

  console.log(
    "node --env-file=.env.local scripts/repair-legacy-fixed-commitments.mjs UID [--execute] [--overwrite] [--referenced-only]",
  );

  console.log("");

  console.log(
    "Opciones:",
  );

  console.log(
    "  --execute          Escribe realmente en Firestore.",
  );

  console.log(
    "  --overwrite        Actualiza también IDs legacy que ya existan.",
  );

  console.log(
    "  --referenced-only  Solo crea compromisos legacy que tengan pagos históricos.",
  );

  console.log("");
}