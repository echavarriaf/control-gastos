/* eslint-disable no-undef */

importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js",
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyCE-9wKX3TJohjIF8GrgOV5LW12Q99Bm-0",
  authDomain: "control-gastos-f89e4.firebaseapp.com",
  projectId: "control-gastos-f89e4",
  storageBucket: "control-gastos-f89e4.firebasestorage.app",
  messagingSenderId: "734344657994",
  appId: "1:734344657994:web:aa0c920ea17d56f613fab3",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};

  const title =
    notification.title ||
    data.title ||
    "Presupuesto Felo";

  const body =
    notification.body ||
    data.body ||
    "Tienes una actualización de tu presupuesto.";

  return self.registration.showNotification(title, {
    body,
    icon: data.icon || "/icons/notification-icon-v2.png",
    badge: data.badge || "/icons/notification-icon-v2.png",
    tag: data.tag || "presupuesto-felo",
    data: {
      ...data,
      url: data.url || "/",
    },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url =
    event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clients) => {
        const existingClient = clients.find(
          (client) =>
            new URL(client.url).origin ===
            self.location.origin,
        );

        if (existingClient) {
          existingClient.navigate(url);
          return existingClient.focus();
        }

        return self.clients.openWindow(url);
      }),
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});