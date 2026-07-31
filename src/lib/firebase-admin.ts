import "server-only";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";

import {
  getAuth,
  type Auth,
} from "firebase-admin/auth";

import {
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";

import {
  getMessaging,
  type Messaging,
} from "firebase-admin/messaging";

const ADMIN_APP_NAME =
  "presupuesto-felo-admin";

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedMessaging: Messaging | null = null;

/**
 * Obtiene o inicializa Firebase Admin.
 *
 * Este módulo solo puede importarse desde código
 * ejecutado en el servidor.
 */
export function getFirebaseAdminApp(): App {
  if (cachedApp) {
    return cachedApp;
  }

  const existingApp = getApps().find(
    (firebaseApp) =>
      firebaseApp.name ===
      ADMIN_APP_NAME,
  );

  if (existingApp) {
    cachedApp = getApp(
      ADMIN_APP_NAME,
    );

    return cachedApp;
  }

  const projectId =
    getRequiredServerEnv(
      "FIREBASE_ADMIN_PROJECT_ID",
    );

  const clientEmail =
    getRequiredServerEnv(
      "FIREBASE_ADMIN_CLIENT_EMAIL",
    );

  const privateKey =
    normalizePrivateKey(
      getRequiredServerEnv(
        "FIREBASE_ADMIN_PRIVATE_KEY",
      ),
    );

  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };

  cachedApp = initializeApp(
    {
      credential: cert(
        serviceAccount,
      ),
      projectId,
    },
    ADMIN_APP_NAME,
  );

  return cachedApp;
}

/**
 * Firebase Authentication con permisos administrativos.
 *
 * Se utiliza en el servidor para verificar los ID tokens
 * enviados por usuarios autenticados.
 */
export function getAdminAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth =
      getAuth(
        getFirebaseAdminApp(),
      );
  }

  return cachedAuth;
}

/**
 * Firestore con permisos administrativos.
 *
 * Solo debe utilizarse desde Route Handlers,
 * Server Actions u otro código del servidor.
 */
export function getAdminDb(): Firestore {
  if (!cachedDb) {
    cachedDb = getFirestore(
      getFirebaseAdminApp(),
    );
  }

  return cachedDb;
}

/**
 * Firebase Cloud Messaging del lado del servidor.
 */
export function getAdminMessaging(): Messaging {
  if (!cachedMessaging) {
    cachedMessaging = getMessaging(
      getFirebaseAdminApp(),
    );
  }

  return cachedMessaging;
}

function getRequiredServerEnv(
  name:
    | "FIREBASE_ADMIN_PROJECT_ID"
    | "FIREBASE_ADMIN_CLIENT_EMAIL"
    | "FIREBASE_ADMIN_PRIVATE_KEY",
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}.`,
    );
  }

  return value;
}

/**
 * Vercel y los archivos .env suelen almacenar
 * los saltos de línea como caracteres "\\n".
 */
function normalizePrivateKey(
  value: string,
): string {
  const withoutWrappingQuotes =
    removeWrappingQuotes(value);

  return withoutWrappingQuotes.replace(
    /\\n/g,
    "\n",
  );
}

function removeWrappingQuotes(
  value: string,
): string {
  const firstCharacter =
    value.at(0);

  const lastCharacter =
    value.at(-1);

  const wrappedWithDoubleQuotes =
    firstCharacter === '"' &&
    lastCharacter === '"';

  const wrappedWithSingleQuotes =
    firstCharacter === "'" &&
    lastCharacter === "'";

  if (
    wrappedWithDoubleQuotes ||
    wrappedWithSingleQuotes
  ) {
    return value.slice(1, -1);
  }

  return value;
}