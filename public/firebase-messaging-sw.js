/* eslint-disable no-undef */

/**
 * Firebase Cloud Messaging service worker.
 *
 * IMPORTANTE:
 * Sustituye los valores REEMPLAZAR_* con la misma
 * configuración pública utilizada en `.env.local`.
 *
 * La configuración de Firebase para aplicaciones web
 * es pública. Nunca coloques aquí credenciales de
 * Firebase Admin ni claves privadas.
 */

importScripts(
  "https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js",
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js",
);

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

const APP_NAME = "Presupuesto Felo";
const DEFAULT_URL = "/";
const DEFAULT_ICON = "/favicon.ico";
const DEFAULT_TAG = "presupuesto-felo";

/**
 * Nuestro backend enviará mensajes `data-only`.
 *
 * Esto evita que el navegador muestre una notificación
 * automática y luego este service worker muestre otra,
 * lo que produciría notificaciones duplicadas.
 */
messaging.onBackgroundMessage((payload) => {
  const notification =
    payload.notification ?? {};

  const data = payload.data ?? {};

  const title =
    notification.title ||
    data.title ||
    APP_NAME;

  const body =
    notification.body ||
    data.body ||
    "Tienes una nueva actualización de tu presupuesto.";

  const targetUrl = normalizeUrl(
    data.url ||
      data.link ||
      notification.click_action ||
      DEFAULT_URL,
  );

  const options = {
    body,

    icon:
      notification.icon ||
      data.icon ||
      DEFAULT_ICON,

    badge:
      data.badge ||
      DEFAULT_ICON,

    tag:
      data.tag ||
      DEFAULT_TAG,

    renotify:
      data.renotify !== "false",

    requireInteraction:
      data.requireInteraction === "true",

    timestamp: parseTimestamp(
      data.timestamp,
    ),

    data: {
      ...data,
      url: targetUrl,
    },
  };

  return self.registration.showNotification(
    title,
    options,
  );
});

/**
 * Abre o enfoca la aplicación cuando el usuario toca
 * una notificación.
 */
self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl = normalizeUrl(
      event.notification.data?.url ??
        DEFAULT_URL,
    );

    event.waitUntil(
      focusOrOpenApp(targetUrl),
    );
  },
);

/**
 * Permite activar inmediatamente una versión nueva
 * del service worker.
 */
self.addEventListener(
  "message",
  (event) => {
    if (
      event.data?.type ===
      "SKIP_WAITING"
    ) {
      self.skipWaiting();
    }
  },
);

self.addEventListener(
  "install",
  () => {
    self.skipWaiting();
  },
);

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      self.clients.claim(),
    );
  },
);

async function focusOrOpenApp(
  targetUrl,
) {
  const windows =
    await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

  const target = new URL(
    targetUrl,
    self.location.origin,
  );

  const sameOriginWindow =
    windows.find((client) => {
      try {
        return (
          new URL(client.url).origin ===
          target.origin
        );
      } catch {
        return false;
      }
    });

  if (sameOriginWindow) {
    if (
      "navigate" in sameOriginWindow &&
      sameOriginWindow.url !==
        target.href
    ) {
      await sameOriginWindow.navigate(
        target.href,
      );
    }

    return sameOriginWindow.focus();
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(
      target.href,
    );
  }

  return undefined;
}

function normalizeUrl(value) {
  try {
    const url = new URL(
      value,
      self.location.origin,
    );

    /**
     * Evita que una notificación abra un dominio externo.
     */
    if (
      url.origin !==
      self.location.origin
    ) {
      return DEFAULT_URL;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_URL;
  }
}

function parseTimestamp(value) {
  if (!value) {
    return Date.now();
  }

  const numericValue = Number(value);

  if (
    Number.isFinite(numericValue) &&
    numericValue > 0
  ) {
    return numericValue;
  }

  const parsedDate =
    Date.parse(value);

  return Number.isNaN(parsedDate)
    ? Date.now()
    : parsedDate;
}