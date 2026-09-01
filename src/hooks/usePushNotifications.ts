"use client";

import {
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useAuth,
} from "@/contexts/AuthContext";

import {
  getUserDocument,
} from "@/lib/firestore/user-paths";

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

const INSTALLATION_STORAGE_KEY_PREFIX =
  "presupuesto-felo-fcm-installation-id";

const PUSH_EVALUATION_INTERVAL_MS =
  60 *
  60 *
  1000;

interface RespuestaEvaluacionPush {
  ok?:
    boolean;

  error?:
    unknown;
}

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
  titulo:
    string;

  cuerpo:
    string;

  url:
    string;

  recibidoEn:
    string;
}

interface UsePushNotificationsResult {
  estado:
    EstadoPush;

  permiso:
    EstadoPermisoPush;

  installationId:
    string | null;

  requiereInstalacionIOS:
    boolean;

  error:
    string | null;

  ultimoMensaje:
    MensajePushRecibido | null;

  activarPush:
    () => Promise<boolean>;

  desactivarPush:
    () => Promise<boolean>;

  limpiarError:
    () => void;

  limpiarUltimoMensaje:
    () => void;
}

/**
 * Administra el registro push del dispositivo.
 *
 * También solicita periódicamente al servidor
 * que vuelva a evaluar las alertas financieras.
 */
export function usePushNotifications():
  UsePushNotificationsResult {
  const {
    user,
    authorized,
  } =
    useAuth();

  const uid =
    authorized
      ? user?.uid ??
        null
      : null;

  const storageKey =
    uid
      ? `${INSTALLATION_STORAGE_KEY_PREFIX}:${uid}`
      : null;

  const [
    estado,
    setEstado,
  ] =
    useState<EstadoPush>(
      "comprobando",
    );

  const [
    permiso,
    setPermiso,
  ] =
    useState<EstadoPermisoPush>(
      "default",
    );

  const [
    installationId,
    setInstallationId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    requiereInstalacionIOS,
    setRequiereInstalacionIOS,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

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

  const montadoRef =
    useRef(
      true,
    );

  /**
   * ============================================================
   * 1C.2H
   * EVALUACIÓN SERVER-SIDE
   * ============================================================
   */
  const evaluarAlertasPush =
    useCallback(
      async (): Promise<void> => {
        if (
          !user ||
          !authorized
        ) {
          return;
        }

        const idToken =
          await user
            .getIdToken();

        const response =
          await fetch(
            "/api/push/evaluate",
            {
              method:
                "POST",

              credentials:
                "same-origin",

              cache:
                "no-store",

              keepalive:
                true,

              headers: {
                Accept:
                  "application/json",

                Authorization:
                  `Bearer ${idToken}`,
              },
            },
          );

        const payload =
          (
            await response
              .json()
              .catch(
                () =>
                  null,
              )
          ) as
            | RespuestaEvaluacionPush
            | null;

        if (
          !response.ok
        ) {
          const mensaje =
            typeof payload
              ?.error ===
            "string"
              ? payload.error
              : `La evaluación push respondió con HTTP ${response.status}.`;

          throw new Error(
            mensaje,
          );
        }

        if (
          payload?.ok !==
          true
        ) {
          throw new Error(
            "La evaluación push no confirmó una respuesta válida.",
          );
        }
      },
      [
        authorized,
        user,
      ],
    );

  /**
   * Guarda o actualiza el dispositivo
   * dentro del namespace privado del usuario.
   */
  const actualizarRegistroFirestore =
    useCallback(
      async (
        fid:
          string,

        activo:
          boolean,
      ) => {
        if (
          !uid
        ) {
          throw new Error(
            "No existe un usuario autorizado para guardar el dispositivo push.",
          );
        }

        const referencia =
          getUserDocument(
            uid,
            "notificationDevices",
            encodeURIComponent(
              fid,
            ),
          );

        await setDoc(
          referencia,
          {
            uid,

            installationId:
              fid,

            activo,

            app:
              "presupuesto-felo",

            permiso:
              "Notification" in
              window
                ? Notification
                    .permission
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
              Intl
                .DateTimeFormat()
                .resolvedOptions()
                .timeZone ||
              "desconocida",

            userAgent:
              navigator
                .userAgent,

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
            merge:
              true,
          },
        );
      },
      [
        uid,
      ],
    );

  const manejarRegistro =
    useCallback(
      async (
        fid:
          string,
      ) => {
        await actualizarRegistroFirestore(
          fid,
          true,
        );

        if (
          storageKey
        ) {
          window
            .localStorage
            .setItem(
              storageKey,
              fid,
            );
        }

        if (
          !montadoRef.current
        ) {
          return;
        }

        setInstallationId(
          fid,
        );

        setEstado(
          "activo",
        );

        setError(
          null,
        );
      },
      [
        actualizarRegistroFirestore,
        storageKey,
      ],
    );

  const manejarDesregistro =
    useCallback(
      async (
        fid:
          string,
      ) => {
        await actualizarRegistroFirestore(
          fid,
          false,
        );

        const guardado =
          storageKey
            ? window
                .localStorage
                .getItem(
                  storageKey,
                )
            : null;

        if (
          storageKey &&
          guardado ===
            fid
        ) {
          window
            .localStorage
            .removeItem(
              storageKey,
            );
        }

        if (
          !montadoRef.current
        ) {
          return;
        }

        setInstallationId(
          null,
        );

        setEstado(
          "inactivo",
        );
      },
      [
        actualizarRegistroFirestore,
        storageKey,
      ],
    );

  const iniciarRegistro =
    useCallback(
      async (): Promise<boolean> => {
        if (
          !uid
        ) {
          setError(
            "No existe un usuario autorizado para activar las notificaciones.",
          );

          setEstado(
            "error",
          );

          return false;
        }

        setEstado(
          "registrando",
        );

        setError(
          null,
        );

        try {
          controlRegistroRef
            .current
            ?.detenerEscucha();

          const control =
            await registrarDispositivoPush({
              onRegistrado:
                manejarRegistro,

              onDesregistrado:
                manejarDesregistro,

              onError: (
                callbackError,
              ) => {
                if (
                  !montadoRef.current
                ) {
                  return;
                }

                setError(
                  callbackError
                    .message,
                );

                setEstado(
                  "error",
                );
              },
            });

          controlRegistroRef.current =
            control;

          return true;
        } catch (
          registrationError
        ) {
          const mensaje =
            registrationError instanceof
              Error
              ? registrationError
                  .message
              : "No se pudo activar el push.";

          if (
            montadoRef.current
          ) {
            setError(
              mensaje,
            );

            setEstado(
              "error",
            );
          }

          return false;
        }
      },
      [
        manejarDesregistro,
        manejarRegistro,
        uid,
      ],
    );

  const activarPush =
    useCallback(
      async (): Promise<boolean> => {
        setError(
          null,
        );

        const compatibilidad =
          await obtenerEstadoPush();

        setPermiso(
          compatibilidad
            .permiso,
        );

        if (
          !compatibilidad
            .soportado
        ) {
          setEstado(
            "no_soportado",
          );

          setError(
            !compatibilidad
              .contextoSeguro
              ? "Las notificaciones push requieren HTTPS o localhost."
              : "Este navegador no soporta Firebase Cloud Messaging.",
          );

          return false;
        }

        if (
          esDispositivoIOS() &&
          !estaEjecutandoseComoPWA()
        ) {
          setRequiereInstalacionIOS(
            true,
          );

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

        setPermiso(
          nuevoPermiso,
        );

        if (
          nuevoPermiso ===
          "denied"
        ) {
          setEstado(
            "denegado",
          );

          setError(
            "El permiso fue bloqueado. Debes habilitar las notificaciones desde los ajustes del navegador o del teléfono.",
          );

          return false;
        }

        if (
          nuevoPermiso !==
          "granted"
        ) {
          setEstado(
            "inactivo",
          );

          return false;
        }

        return iniciarRegistro();
      },
      [
        iniciarRegistro,
      ],
    );

  const desactivarPush =
    useCallback(
      async (): Promise<boolean> => {
        setError(
          null,
        );

        const fid =
          installationId ??
          (
            storageKey
              ? window
                  .localStorage
                  .getItem(
                    storageKey,
                  )
              : null
          );

        try {
          if (
            fid
          ) {
            await actualizarRegistroFirestore(
              fid,
              false,
            );
          }

          await desregistrarDispositivoPush();

          if (
            storageKey
          ) {
            window
              .localStorage
              .removeItem(
                storageKey,
              );
          }

          controlRegistroRef
            .current
            ?.detenerEscucha();

          controlRegistroRef.current =
            null;

          if (
            montadoRef.current
          ) {
            setInstallationId(
              null,
            );

            setEstado(
              "inactivo",
            );
          }

          return true;
        } catch (
          unregisterError
        ) {
          const mensaje =
            unregisterError instanceof
              Error
              ? unregisterError
                  .message
              : "No se pudieron desactivar las notificaciones.";

          if (
            montadoRef.current
          ) {
            setError(
              mensaje,
            );

            setEstado(
              "error",
            );
          }

          return false;
        }
      },
      [
        actualizarRegistroFirestore,
        installationId,
        storageKey,
      ],
    );

  /**
   * Inicialización del soporte push.
   */
  useEffect(
    () => {
      montadoRef.current =
        true;

      let cancelarPrimerPlano:
        | (() => void)
        | undefined;

      const inicializar =
        async () => {
          if (
            !uid ||
            !storageKey
          ) {
            setInstallationId(
              null,
            );

            setEstado(
              "comprobando",
            );

            return;
          }

          const compatibilidad =
            await obtenerEstadoPush();

          if (
            !montadoRef.current
          ) {
            return;
          }

          setPermiso(
            compatibilidad
              .permiso,
          );

          if (
            !compatibilidad
              .soportado
          ) {
            setEstado(
              "no_soportado",
            );

            return;
          }

          const requiereInstalacion =
            esDispositivoIOS() &&
            !estaEjecutandoseComoPWA();

          setRequiereInstalacionIOS(
            requiereInstalacion,
          );

          if (
            requiereInstalacion
          ) {
            setEstado(
              "requiere_instalacion",
            );

            return;
          }

          const fidGuardado =
            window
              .localStorage
              .getItem(
                storageKey,
              );

          if (
            compatibilidad
              .permiso ===
            "denied"
          ) {
            setEstado(
              "denegado",
            );
          } else if (
            compatibilidad
              .permiso ===
            "granted"
          ) {
            setInstallationId(
              fidGuardado,
            );

            await iniciarRegistro();
          } else {
            setEstado(
              "inactivo",
            );
          }

          cancelarPrimerPlano =
            await escucharMensajesEnPrimerPlano(
              async (
                payload,
              ) => {
                const titulo =
                  payload.notification
                    ?.title ??
                  payload.data
                    ?.title ??
                  "Presupuesto Felo";

                const cuerpo =
                  payload.notification
                    ?.body ??
                  payload.data
                    ?.body ??
                  "Tienes una actualización de tu presupuesto.";

                const url =
                  normalizarRutaInterna(
                    payload.data
                      ?.url ??
                      payload.data
                        ?.link ??
                      "/",
                  );

                if (
                  montadoRef.current
                ) {
                  setUltimoMensaje({
                    titulo,

                    cuerpo,

                    url,

                    recibidoEn:
                      new Date()
                        .toISOString(),
                  });
                }

                try {
                  const registro =
                    controlRegistroRef
                      .current
                      ?.serviceWorkerRegistration ??
                    (
                      await registrarServiceWorkerPush()
                    );

                  await registro
                    .showNotification(
                      titulo,
                      {
                        body:
                          cuerpo,

                        icon:
                          payload.data
                            ?.icon ??
                          "/favicon.ico",

                        badge:
                          payload.data
                            ?.badge ??
                          "/favicon.ico",

                        tag:
                          payload.data
                            ?.tag ??
                          "presupuesto-felo-foreground",

                        data: {
                          ...payload.data,

                          url,
                        },
                      },
                    );
                } catch (
                  notificationError
                ) {
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
        montadoRef.current =
          false;

        cancelarPrimerPlano
          ?.();

        controlRegistroRef
          .current
          ?.detenerEscucha();

        controlRegistroRef.current =
          null;
      };
    },
    [
      iniciarRegistro,
      storageKey,
      uid,
    ],
  );

  /**
   * ============================================================
   * 1C.2H
   * REEVALUACIÓN POR PASO DEL TIEMPO
   * ============================================================
   *
   * Antes dependíamos principalmente de registrar movimientos.
   *
   * Una fecha de corte puede acercarse aunque no se registre
   * ninguna compra ese día.
   *
   * Mientras la aplicación está abierta:
   *
   * - evalúa inmediatamente;
   * - vuelve a evaluar cada hora;
   * - vuelve a evaluar al regresar a la pestaña.
   */
  useEffect(
    () => {
      if (
        !uid ||
        !authorized ||
        !user ||
        estado !==
          "activo"
      ) {
        return;
      }

      let cancelado =
        false;

      const evaluar =
        async () => {
          try {
            await evaluarAlertasPush();
          } catch (
            evaluationError
          ) {
            if (
              !cancelado
            ) {
              console.error(
                "No se pudieron evaluar las alertas push periódicas:",
                evaluationError,
              );
            }
          }
        };

      void evaluar();

      const intervalId =
        window.setInterval(
          () => {
            void evaluar();
          },
          PUSH_EVALUATION_INTERVAL_MS,
        );

      const manejarVisibilidad =
        () => {
          if (
            document
              .visibilityState ===
            "visible"
          ) {
            void evaluar();
          }
        };

      document.addEventListener(
        "visibilitychange",
        manejarVisibilidad,
      );

      return () => {
        cancelado =
          true;

        window.clearInterval(
          intervalId,
        );

        document.removeEventListener(
          "visibilitychange",
          manejarVisibilidad,
        );
      };
    },
    [
      authorized,
      estado,
      evaluarAlertasPush,
      uid,
      user,
    ],
  );

  return {
    estado,

    permiso,

    installationId,

    requiereInstalacionIOS,

    error,

    ultimoMensaje,

    activarPush,

    desactivarPush,

    limpiarError:
      () =>
        setError(
          null,
        ),

    limpiarUltimoMensaje:
      () =>
        setUltimoMensaje(
          null,
        ),
  };
}

function esDispositivoIOS():
  boolean {
  if (
    typeof navigator ===
    "undefined"
  ) {
    return false;
  }

  return /iPad|iPhone|iPod/i.test(
    navigator.userAgent,
  );
}

function estaEjecutandoseComoPWA():
  boolean {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  const navigatorStandalone =
    navigator as
      Navigator & {
        standalone?:
          boolean;
      };

  return (
    window.matchMedia(
      "(display-mode: standalone)",
    ).matches ||
    navigatorStandalone
      .standalone ===
      true
  );
}

function detectarTipoDispositivo():
  string {
  const userAgent =
    navigator.userAgent;

  if (
    /iPhone/i.test(
      userAgent,
    )
  ) {
    return "iPhone";
  }

  if (
    /iPad/i.test(
      userAgent,
    )
  ) {
    return "iPad";
  }

  if (
    /Android/i.test(
      userAgent,
    )
  ) {
    return "Android";
  }

  return "Escritorio";
}

function normalizarRutaInterna(
  value:
    string,
): string {
  try {
    const url =
      new URL(
        value,
        window.location
          .origin,
      );

    if (
      url.origin !==
      window.location
        .origin
    ) {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}