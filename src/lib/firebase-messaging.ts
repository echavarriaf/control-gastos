import type {
  MessagePayload,
  Messaging,
} from "firebase/messaging";

import { app } from "@/lib/firebase";

const SERVICE_WORKER_URL =
  "/firebase-messaging-sw.js";

const SERVICE_WORKER_SCOPE =
  "/";

const vapidKey =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export type EstadoPermisoPush =
  | NotificationPermission
  | "no_soportado";

export type CodigoErrorPush =
  | "no_soportado"
  | "contexto_inseguro"
  | "permiso_denegado"
  | "vapid_faltante"
  | "service_worker"
  | "registro_fcm";

export interface EstadoPush {
  soportado: boolean;
  contextoSeguro: boolean;
  serviceWorkerSoportado: boolean;
  notificacionesSoportadas: boolean;
  permiso: EstadoPermisoPush;
}

export interface RegistroPushCallbacks {
  onRegistrado: (
    installationId: string,
  ) => void | Promise<void>;

  onDesregistrado?: (
    installationId: string,
  ) => void | Promise<void>;

  onError?: (error: Error) => void;
}

export interface ControlRegistroPush {
  serviceWorkerRegistration:
    ServiceWorkerRegistration;

  detenerEscucha: () => void;
}

export class PushNotificationError extends Error {
  public readonly originalError?: unknown;

  constructor(
    public readonly code: CodigoErrorPush,
    message: string,
    originalError?: unknown,
  ) {
    super(message);

    this.name = "PushNotificationError";
    this.originalError = originalError;
  }
}

let messagingPromise:
  | Promise<Messaging | null>
  | null = null;

/**
 * Comprueba si el navegador dispone de todas las APIs
 * necesarias para Firebase Cloud Messaging.
 */
export async function obtenerEstadoPush(): Promise<EstadoPush> {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined"
  ) {
    return {
      soportado: false,
      contextoSeguro: false,
      serviceWorkerSoportado: false,
      notificacionesSoportadas: false,
      permiso: "no_soportado",
    };
  }

  const contextoSeguro =
    window.isSecureContext;

  const serviceWorkerSoportado =
    "serviceWorker" in navigator;

  const notificacionesSoportadas =
    "Notification" in window;

  let firebaseMessagingSoportado = false;

  if (
    contextoSeguro &&
    serviceWorkerSoportado &&
    notificacionesSoportadas
  ) {
    try {
      const { isSupported } =
        await import("firebase/messaging");

      firebaseMessagingSoportado =
        await isSupported();
    } catch (error) {
      console.error(
        "No se pudo comprobar la compatibilidad de FCM:",
        error,
      );
    }
  }

  return {
    soportado:
      contextoSeguro &&
      serviceWorkerSoportado &&
      notificacionesSoportadas &&
      firebaseMessagingSoportado,

    contextoSeguro,
    serviceWorkerSoportado,
    notificacionesSoportadas,

    permiso: notificacionesSoportadas
      ? Notification.permission
      : "no_soportado",
  };
}

/**
 * Obtiene Firebase Messaging solamente en el navegador.
 * La importación dinámica evita problemas durante SSR.
 */
export async function obtenerMessaging(): Promise<Messaging | null> {
  if (messagingPromise) {
    return messagingPromise;
  }

  messagingPromise = (async () => {
    const estado =
      await obtenerEstadoPush();

    if (!estado.soportado) {
      return null;
    }

    const { getMessaging } =
      await import("firebase/messaging");

    return getMessaging(app);
  })();

  return messagingPromise;
}

/**
 * Solicita permiso para mostrar notificaciones.
 *
 * Debe ejecutarse como respuesta directa a una acción
 * del usuario, como presionar "Activar notificaciones".
 */
export async function solicitarPermisoPush(): Promise<EstadoPermisoPush> {
  const estado =
    await obtenerEstadoPush();

  if (!estado.soportado) {
    return "no_soportado";
  }

  if (
    Notification.permission === "granted"
  ) {
    return "granted";
  }

  if (
    Notification.permission === "denied"
  ) {
    return "denied";
  }

  return Notification.requestPermission();
}

/**
 * Registra el service worker que recibirá mensajes
 * cuando la aplicación esté cerrada o en segundo plano.
 */
export async function registrarServiceWorkerPush(): Promise<ServiceWorkerRegistration> {
  const estado =
    await obtenerEstadoPush();

  if (!estado.contextoSeguro) {
    throw new PushNotificationError(
      "contexto_inseguro",
      "Las notificaciones push requieren HTTPS o localhost.",
    );
  }

  if (!estado.serviceWorkerSoportado) {
    throw new PushNotificationError(
      "service_worker",
      "Este navegador no soporta service workers.",
    );
  }

  try {
    const existente =
      await navigator.serviceWorker.getRegistration(
        SERVICE_WORKER_SCOPE,
      );

    if (existente) {
      await existente.update();

      await esperarServiceWorkerActivo(
        existente,
      );

      return existente;
    }

    const registro =
      await navigator.serviceWorker.register(
        SERVICE_WORKER_URL,
        {
          scope: SERVICE_WORKER_SCOPE,
          updateViaCache: "none",
          type:"classic",
        },
      );

    await esperarServiceWorkerActivo(
      registro,
    );

    return registro;
  } catch (error) {
    if (
      error instanceof
      PushNotificationError
    ) {
      throw error;
    }

    throw new PushNotificationError(
      "service_worker",
      "No se pudo registrar el service worker de notificaciones.",
      error,
    );
  }
}

/**
 * Registra esta instalación con Firebase Cloud Messaging.
 *
 * Firebase entrega el Firebase Installation ID mediante
 * onRegistered(). El callback debe guardar ese FID en
 * Firestore o enviarlo al backend.
 */
export async function registrarDispositivoPush(
  callbacks: RegistroPushCallbacks,
): Promise<ControlRegistroPush> {
  const estado =
    await obtenerEstadoPush();

  if (!estado.soportado) {
    throw new PushNotificationError(
      "no_soportado",
      "Firebase Cloud Messaging no está disponible en este navegador.",
    );
  }

  if (
    Notification.permission !== "granted"
  ) {
    throw new PushNotificationError(
      "permiso_denegado",
      "Primero debes permitir las notificaciones.",
    );
  }

  if (!vapidKey) {
    throw new PushNotificationError(
      "vapid_faltante",
      "Falta NEXT_PUBLIC_FIREBASE_VAPID_KEY en .env.local.",
    );
  }

  const messaging =
    await obtenerMessaging();

  if (!messaging) {
    throw new PushNotificationError(
      "no_soportado",
      "No se pudo inicializar Firebase Messaging.",
    );
  }

  const serviceWorkerRegistration =
    await registrarServiceWorkerPush();

  const {
    onRegistered,
    onUnregistered,
    register,
  } = await import("firebase/messaging");

  const unsubscribeRegistered =
    onRegistered(
      messaging,
      (installationId) => {
        Promise.resolve(
          callbacks.onRegistrado(
            installationId,
          ),
        ).catch((error: unknown) => {
          const callbackError =
            error instanceof Error
              ? error
              : new Error(
                  "No se pudo guardar el Firebase Installation ID.",
                );

          callbacks.onError?.(
            callbackError,
          );
        });
      },
    );

  const unsubscribeUnregistered =
    onUnregistered(
      messaging,
      (installationId) => {
        Promise.resolve(
          callbacks.onDesregistrado?.(
            installationId,
          ),
        ).catch((error: unknown) => {
          const callbackError =
            error instanceof Error
              ? error
              : new Error(
                  "No se pudo eliminar el Firebase Installation ID.",
                );

          callbacks.onError?.(
            callbackError,
          );
        });
      },
    );

  try {
    await register(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });
  } catch (error) {
    unsubscribeRegistered();
    unsubscribeUnregistered();

    throw new PushNotificationError(
      "registro_fcm",
      "Firebase no pudo registrar este dispositivo para notificaciones push.",
      error,
    );
  }

  return {
    serviceWorkerRegistration,

    detenerEscucha: () => {
      unsubscribeRegistered();
      unsubscribeUnregistered();
    },
  };
}

/**
 * Escucha mensajes mientras la aplicación está abierta.
 */
export async function escucharMensajesEnPrimerPlano(
  callback: (
    payload: MessagePayload,
  ) => void,
): Promise<() => void> {
  const messaging =
    await obtenerMessaging();

  if (!messaging) {
    return () => undefined;
  }

  const { onMessage } =
    await import("firebase/messaging");

  return onMessage(
    messaging,
    callback,
  );
}

/**
 * Elimina el registro FCM de esta instalación.
 *
 * Conserva el FID antes de llamar esta función para poder
 * marcar también su documento como inactivo en Firestore.
 */
export async function desregistrarDispositivoPush(): Promise<void> {
  const messaging =
    await obtenerMessaging();

  if (!messaging) {
    return;
  }

  const { unregister } =
    await import("firebase/messaging");

  await unregister(messaging);
}

/**
 * Espera a que el service worker llegue al estado activo.
 *
 * No usamos navigator.serviceWorker.ready porque el worker
 * tiene un scope dedicado y puede no controlar la página /.
 */
async function esperarServiceWorkerActivo(
  registro: ServiceWorkerRegistration,
): Promise<void> {
  if (registro.active) {
    return;
  }

  const worker =
    registro.installing ??
    registro.waiting;

  if (!worker) {
    throw new PushNotificationError(
      "service_worker",
      "El service worker no llegó a un estado activo.",
    );
  }

  if (
    worker.state === "activated"
  ) {
    return;
  }

  await new Promise<void>(
    (resolve, reject) => {
      const timeoutId =
        window.setTimeout(() => {
          limpiar();

          reject(
            new PushNotificationError(
              "service_worker",
              "El service worker tardó demasiado en activarse.",
            ),
          );
        }, 15_000);

      const manejarCambioEstado =
        () => {
          if (
            worker.state ===
            "activated"
          ) {
            limpiar();
            resolve();
            return;
          }

          if (
            worker.state ===
            "redundant"
          ) {
            limpiar();

            reject(
              new PushNotificationError(
                "service_worker",
                "El service worker fue descartado antes de activarse.",
              ),
            );
          }
        };

      const limpiar = () => {
        window.clearTimeout(
          timeoutId,
        );

        worker.removeEventListener(
          "statechange",
          manejarCambioEstado,
        );
      };

      worker.addEventListener(
        "statechange",
        manejarCambioEstado,
      );

      manejarCambioEstado();
    },
  );
}