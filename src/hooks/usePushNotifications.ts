"use client";

import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { db } from "@/lib/firebase";

import {
  desregistrarDispositivoPush,
  escucharMensajesEnPrimerPlano,
  obtenerEstadoPush,
  registrarDispositivoPush,
  registrarServiceWorkerPush,
  solicitarPermisoPush,
  type ControlRegistroPush,
  type EstadoPermisoPush,
} from "@/lib/firebase-messaging";

const DEVICE_COLLECTION =
  "notificationDevices";

const INSTALLATION_STORAGE_KEY =
  "presupuesto-felo-fcm-installation-id";

export type EstadoPush =
  | "comprobando"
  | "no_soportado"
  | "requiere_instalacion"
  | "inactivo"
  | "denegado"
  | "registrando"
  | "activo"
  | "error";

export interface MensajePushRecibido {
  titulo: string;
  cuerpo: string;
  url: string;
  recibidoEn: string;
}

interface UsePushNotificationsResult {
  estado: EstadoPush;
  permiso: EstadoPermisoPush;
  installationId: string | null;
  requiereInstalacionIOS: boolean;
  error: string | null;
  ultimoMensaje: MensajePushRecibido | null;

  activarPush: () => Promise<boolean>;
  desactivarPush: () => Promise<boolean>;
  limpiarError: () => void;
  limpiarUltimoMensaje: () => void;
}

/**
 * Administra el registro push del dispositivo.
 *
 * El hook:
 * - comprueba compatibilidad;
 * - solicita permiso mediante una acción del usuario;
 * - registra el FID con Firebase Cloud Messaging;
 * - guarda el FID en Firestore;
 * - escucha mensajes recibidos con la app abierta;
 * - permite desactivar las notificaciones.
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const [estado, setEstado] =
    useState<EstadoPush>("comprobando");

  const [permiso, setPermiso] =
    useState<EstadoPermisoPush>("default");

  const [
    installationId,
    setInstallationId,
  ] = useState<string | null>(null);

  const [
    requiereInstalacionIOS,
    setRequiereInstalacionIOS,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    ultimoMensaje,
    setUltimoMensaje,
  ] =
    useState<MensajePushRecibido | null>(
      null,
    );

  const controlRegistroRef =
    useRef<ControlRegistroPush | null>(
      null,
    );

  const montadoRef = useRef(true);

  const actualizarRegistroFirestore =
    useCallback(
      async (
        fid: string,
        activo: boolean,
      ) => {
        const referencia = doc(
          db,
          DEVICE_COLLECTION,
          encodeURIComponent(fid),
        );

        await setDoc(
          referencia,
          {
            installationId: fid,
            activo,
            app: "presupuesto-felo",

            permiso:
              "Notification" in window
                ? Notification.permission
                : "no_soportado",

            dispositivo:
              detectarTipoDispositivo(),

            plataforma:
              navigator.platform ||
              "desconocida",

            idioma:
              navigator.language ||
              "es",

            zonaHoraria:
              Intl.DateTimeFormat()
                .resolvedOptions()
                .timeZone ||
              "desconocida",

            userAgent:
              navigator.userAgent,

            actualizadoEn:
              serverTimestamp(),

            registradoEn:
              activo
                ? serverTimestamp()
                : null,

            desactivadoEn:
              activo
                ? null
                : serverTimestamp(),
          },
          {
            merge: true,
          },
        );
      },
      [],
    );

  const manejarRegistro =
    useCallback(
      async (fid: string) => {
        await actualizarRegistroFirestore(
          fid,
          true,
        );

        window.localStorage.setItem(
          INSTALLATION_STORAGE_KEY,
          fid,
        );

        if (!montadoRef.current) {
          return;
        }

        setInstallationId(fid);
        setEstado("activo");
        setError(null);
      },
      [actualizarRegistroFirestore],
    );

  const manejarDesregistro =
    useCallback(
      async (fid: string) => {
        await actualizarRegistroFirestore(
          fid,
          false,
        );

        const guardado =
          window.localStorage.getItem(
            INSTALLATION_STORAGE_KEY,
          );

        if (guardado === fid) {
          window.localStorage.removeItem(
            INSTALLATION_STORAGE_KEY,
          );
        }

        if (!montadoRef.current) {
          return;
        }

        setInstallationId(null);
        setEstado("inactivo");
      },
      [actualizarRegistroFirestore],
    );

  const iniciarRegistro =
    useCallback(async (): Promise<boolean> => {
      setEstado("registrando");
      setError(null);

      try {
        controlRegistroRef.current?.detenerEscucha();

        const control =
          await registrarDispositivoPush({
            onRegistrado:
              manejarRegistro,

            onDesregistrado:
              manejarDesregistro,

            onError: (
              callbackError,
            ) => {
              if (!montadoRef.current) {
                return;
              }

              setError(
                callbackError.message,
              );

              setEstado("error");
            },
          });

        controlRegistroRef.current =
          control;

        return true;
      } catch (registrationError) {
        const mensaje =
          registrationError instanceof Error
            ? registrationError.message
            : "No se pudo activar el push.";

        if (montadoRef.current) {
          setError(mensaje);
          setEstado("error");
        }

        return false;
      }
    }, [
      manejarDesregistro,
      manejarRegistro,
    ]);

  const activarPush =
    useCallback(async (): Promise<boolean> => {
      setError(null);

      const compatibilidad =
        await obtenerEstadoPush();

      setPermiso(
        compatibilidad.permiso,
      );

      if (!compatibilidad.soportado) {
        setEstado("no_soportado");

        setError(
          !compatibilidad.contextoSeguro
            ? "Las notificaciones push requieren HTTPS o localhost."
            : "Este navegador no soporta Firebase Cloud Messaging.",
        );

        return false;
      }

      if (
        esDispositivoIOS() &&
        !estaEjecutandoseComoPWA()
      ) {
        setRequiereInstalacionIOS(true);
        setEstado(
          "requiere_instalacion",
        );

        setError(
          "En iPhone o iPad debes agregar la aplicación a la pantalla de inicio antes de activar las notificaciones.",
        );

        return false;
      }

      const nuevoPermiso =
        await solicitarPermisoPush();

      setPermiso(nuevoPermiso);

      if (nuevoPermiso === "denied") {
        setEstado("denegado");

        setError(
          "El permiso fue bloqueado. Debes habilitar las notificaciones desde los ajustes del navegador o del teléfono.",
        );

        return false;
      }

      if (nuevoPermiso !== "granted") {
        setEstado("inactivo");

        return false;
      }

      return iniciarRegistro();
    }, [iniciarRegistro]);

  const desactivarPush =
    useCallback(async (): Promise<boolean> => {
      setError(null);

      const fid =
        installationId ??
        window.localStorage.getItem(
          INSTALLATION_STORAGE_KEY,
        );

      try {
        if (fid) {
          await actualizarRegistroFirestore(
            fid,
            false,
          );
        }

        await desregistrarDispositivoPush();

        window.localStorage.removeItem(
          INSTALLATION_STORAGE_KEY,
        );

        controlRegistroRef.current?.detenerEscucha();
        controlRegistroRef.current = null;

        if (montadoRef.current) {
          setInstallationId(null);
          setEstado("inactivo");
        }

        return true;
      } catch (unregisterError) {
        const mensaje =
          unregisterError instanceof Error
            ? unregisterError.message
            : "No se pudieron desactivar las notificaciones.";

        if (montadoRef.current) {
          setError(mensaje);
          setEstado("error");
        }

        return false;
      }
    }, [
      actualizarRegistroFirestore,
      installationId,
    ]);

  useEffect(() => {
    montadoRef.current = true;

    let cancelarPrimerPlano:
      | (() => void)
      | undefined;

    const inicializar = async () => {
      const compatibilidad =
        await obtenerEstadoPush();

      if (!montadoRef.current) {
        return;
      }

      setPermiso(
        compatibilidad.permiso,
      );

      if (!compatibilidad.soportado) {
        setEstado("no_soportado");
        return;
      }

      const requiereInstalacion =
        esDispositivoIOS() &&
        !estaEjecutandoseComoPWA();

      setRequiereInstalacionIOS(
        requiereInstalacion,
      );

      if (requiereInstalacion) {
        setEstado(
          "requiere_instalacion",
        );

        return;
      }

      const fidGuardado =
        window.localStorage.getItem(
          INSTALLATION_STORAGE_KEY,
        );

      if (
        compatibilidad.permiso ===
        "denied"
      ) {
        setEstado("denegado");
      } else if (
        compatibilidad.permiso ===
        "granted"
      ) {
        setInstallationId(
          fidGuardado,
        );

        await iniciarRegistro();
      } else {
        setEstado("inactivo");
      }

      cancelarPrimerPlano =
        await escucharMensajesEnPrimerPlano(
          async (payload) => {
            const titulo =
              payload.notification
                ?.title ??
              payload.data?.title ??
              "Presupuesto Felo";

            const cuerpo =
              payload.notification
                ?.body ??
              payload.data?.body ??
              "Tienes una actualización de tu presupuesto.";

            const url =
              normalizarRutaInterna(
                payload.data?.url ??
                  payload.data?.link ??
                  "/",
              );

            if (montadoRef.current) {
              setUltimoMensaje({
                titulo,
                cuerpo,
                url,
                recibidoEn:
                  new Date().toISOString(),
              });
            }

            try {
              const registro =
                controlRegistroRef
                  .current
                  ?.serviceWorkerRegistration ??
                (await registrarServiceWorkerPush());

              await registro.showNotification(
                titulo,
                {
                  body: cuerpo,
                  icon:
                    payload.data?.icon ??
                    "/favicon.ico",
                  badge:
                    payload.data?.badge ??
                    "/favicon.ico",
                  tag:
                    payload.data?.tag ??
                    "presupuesto-felo-foreground",
                  data: {
                    ...payload.data,
                    url,
                  },
                },
              );
            } catch (notificationError) {
              console.error(
                "No se pudo mostrar la notificación en primer plano:",
                notificationError,
              );
            }
          },
        );
    };

    void inicializar();

    return () => {
      montadoRef.current = false;

      cancelarPrimerPlano?.();

      controlRegistroRef.current?.detenerEscucha();
      controlRegistroRef.current = null;
    };
  }, [iniciarRegistro]);

  return {
    estado,
    permiso,
    installationId,
    requiereInstalacionIOS,
    error,
    ultimoMensaje,

    activarPush,
    desactivarPush,

    limpiarError: () =>
      setError(null),

    limpiarUltimoMensaje: () =>
      setUltimoMensaje(null),
  };
}

function esDispositivoIOS(): boolean {
  if (
    typeof navigator === "undefined"
  ) {
    return false;
  }

  return /iPad|iPhone|iPod/i.test(
    navigator.userAgent,
  );
}

function estaEjecutandoseComoPWA(): boolean {
  if (
    typeof window === "undefined"
  ) {
    return false;
  }

  const navigatorStandalone =
    navigator as Navigator & {
      standalone?: boolean;
    };

  return (
    window.matchMedia(
      "(display-mode: standalone)",
    ).matches ||
    navigatorStandalone.standalone ===
      true
  );
}

function detectarTipoDispositivo(): string {
  const userAgent =
    navigator.userAgent;

  if (/iPhone/i.test(userAgent)) {
    return "iPhone";
  }

  if (/iPad/i.test(userAgent)) {
    return "iPad";
  }

  if (/Android/i.test(userAgent)) {
    return "Android";
  }

  return "Escritorio";
}

function normalizarRutaInterna(
  value: string,
): string {
  try {
    const url = new URL(
      value,
      window.location.origin,
    );

    if (
      url.origin !==
      window.location.origin
    ) {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}