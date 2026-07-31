import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import {
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,

  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,

  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,

  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,

  messagingSenderId:
    process.env
      .NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,

  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function validateFirebaseConfig(
  config: FirebaseOptions,
): void {
  const requiredValues = {
    NEXT_PUBLIC_FIREBASE_API_KEY:
      config.apiKey,

    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      config.authDomain,

    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      config.projectId,

    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      config.messagingSenderId,

    NEXT_PUBLIC_FIREBASE_APP_ID:
      config.appId,
  };

  const missingVariables =
    Object.entries(requiredValues)
      .filter(([, value]) => !value)
      .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new Error(
      `Faltan variables de Firebase: ${missingVariables.join(
        ", ",
      )}`,
    );
  }
}

validateFirebaseConfig(firebaseConfig);

export const app: FirebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

declare global {
  // eslint-disable-next-line no-var
  var __presupuestoFeloFirestore:
    | Firestore
    | undefined;
}

function crearFirestore(): Firestore {
  /*
   * Estas opciones de transporte solamente aplican
   * en el navegador.
   */
  if (typeof window === "undefined") {
    return getFirestore(app);
  }

  return initializeFirestore(app, {
    experimentalForceLongPolling: true,

    experimentalLongPollingOptions: {
      timeoutSeconds: 25,
    },

    ignoreUndefinedProperties: true,
  });
}

/**
 * Firebase Authentication.
 *
 * Se utilizará para iniciar sesión con Google y proteger
 * el acceso a Firestore.
 */
export const auth: Auth =
  getAuth(app);

/**
 * Firestore utilizado por la aplicación.
 */
export const db: Firestore =
  globalThis.__presupuestoFeloFirestore ??
  crearFirestore();

if (typeof window !== "undefined") {
  globalThis.__presupuestoFeloFirestore =
    db;
}

export { firebaseConfig };