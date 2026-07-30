import { initializeApp,getApp, getApps, type FirebaseApp,
  type FirebaseOptions, } from "firebase/app";
import { getFirestore, type Firestore, } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Detecta inmediatamente variables faltantes.
 */
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

  const missingVariables = Object.entries(
    requiredValues,
  )
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

/**
 * Evita inicializar Firebase varias veces durante
 * el desarrollo con Next.js.
 */
export const app: FirebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

export const db: Firestore =
  getFirestore(app);

export { firebaseConfig };
