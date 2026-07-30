import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}.`,
    );
  }

  return value;
}

export async function GET(): Promise<NextResponse> {
  const firebaseConfig = {
    apiKey: requiredEnv(
      "NEXT_PUBLIC_FIREBASE_API_KEY",
    ),

    authDomain: requiredEnv(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    ),

    projectId: requiredEnv(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    ),

    storageBucket: requiredEnv(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    ),

    messagingSenderId: requiredEnv(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    ),

    appId: requiredEnv(
      "NEXT_PUBLIC_FIREBASE_APP_ID",
    ),
  };

  const script = `
/* eslint-disable no-undef */

importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js"
);

firebase.initializeApp(${JSON.stringify(firebaseConfig)});

const messaging = firebase.messaging();

const APP_NAME = "Presupuesto Felo";
const DEFAULT_URL = "/";
const DEFAULT_ICON = "/icons/icon-192.png";
const DEFAULT_BADGE = "/icons/icon-192.png";
const DEFAULT_TAG = "presupuesto-felo";

messaging.onBackgroundMessage((payload) => {
  const notification =
    payload.notification || {};

  const data =
    payload.data || {};

  const title =
    notification.title ||
    data.title ||
    APP_NAME;

  const body =
    notification.body ||
    data.body ||
    "Tienes una actualización de tu presupuesto.";

  const targetUrl = normalizeUrl(
    data.url ||
      data.link ||
      notification.click_action ||
      DEFAULT_URL
  );

  return self.registration.showNotification(
    title,
    {
      body,

      icon:
        notification.icon ||
        data.icon ||
        DEFAULT_ICON,

      badge:
        data.badge ||
        DEFAULT_BADGE,

      tag:
        data.tag ||
        DEFAULT_TAG,

      renotify:
        data.renotify !== "false",

      requireInteraction:
        data.requireInteraction === "true",

      timestamp:
        parseTimestamp(
          data.timestamp
        ),

      data: {
        ...data,
        url: targetUrl,
      },
    }
  );
});

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl = normalizeUrl(
      event.notification.data?.url ||
        DEFAULT_URL
    );

    event.waitUntil(
      focusOrOpenApp(targetUrl)
    );
  }
);

self.addEventListener(
  "install",
  () => {
    self.skipWaiting();
  }
);

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      self.clients.claim()
    );
  }
);

self.addEventListener(
  "message",
  (event) => {
    if (
      event.data?.type ===
      "SKIP_WAITING"
    ) {
      self.skipWaiting();
    }
  }
);

async function focusOrOpenApp(
  targetUrl
) {
  const windows =
    await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

  const target = new URL(
    targetUrl,
    self.location.origin
  );

  const existingWindow =
    windows.find(
      (client) => {
        try {
          return (
            new URL(client.url).origin ===
            target.origin
          );
        } catch {
          return false;
        }
      }
    );

  if (existingWindow) {
    if (
      "navigate" in existingWindow &&
      existingWindow.url !==
        target.href
    ) {
      await existingWindow.navigate(
        target.href
      );
    }

    return existingWindow.focus();
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(
      target.href
    );
  }

  return undefined;
}

function normalizeUrl(value) {
  try {
    const url = new URL(
      value,
      self.location.origin
    );

    if (
      url.origin !==
      self.location.origin
    ) {
      return DEFAULT_URL;
    }

    return (
      url.pathname +
      url.search +
      url.hash
    );
  } catch {
    return DEFAULT_URL;
  }
}

function parseTimestamp(value) {
  if (!value) {
    return Date.now();
  }

  const numericValue =
    Number(value);

  if (
    Number.isFinite(
      numericValue
    ) &&
    numericValue > 0
  ) {
    return numericValue;
  }

  const parsedDate =
    Date.parse(value);

  return Number.isNaN(
    parsedDate
  )
    ? Date.now()
    : parsedDate;
}
`;

  return new NextResponse(
    script,
    {
      status: 200,

      headers: {
        "Content-Type":
          "application/javascript; charset=utf-8",

        "Cache-Control":
          "no-cache, no-store, must-revalidate",

        "Service-Worker-Allowed":
          "/",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}