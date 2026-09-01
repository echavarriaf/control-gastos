"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserCog,
  UserRound,
  UsersRound,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "@/contexts/AuthContext";

import type {
  AccionSolicitudAcceso,
  EstadoSolicitudAcceso,
  RolUsuario,
  SolicitudAcceso,
} from "@/lib/auth/types";

type SeccionAdmin =
  | "solicitudes"
  | "usuarios";

type FiltroSolicitudes =
  | "pendiente"
  | "aprobada"
  | "rechazada";

type FiltroUsuarios =
  | "activos"
  | "desactivados";

type AccionUsuarioAdmin =
  | "activar"
  | "desactivar";

interface UsuarioAdministrado {
  uid: string;
  nombre: string;
  email: string;
  fotoUrl: string | null;

  activo: boolean;
  rol: RolUsuario;

  autorizadoEn:
    string | null;

  actualizadoEn:
    string | null;

  administradorDesde:
    string | null;

  desactivadoEn:
    string | null;

  desactivadoPor:
    string | null;

  reactivadoEn:
    string | null;

  reactivadoPor:
    string | null;
}

type OperacionEnCurso =
  | {
      tipo:
        "solicitud";

      uid:
        string;

      accion:
        AccionSolicitudAcceso;
    }
  | {
      tipo:
        "usuario";

      uid:
        string;

      accion:
        AccionUsuarioAdmin;
    };

const FILTROS_SOLICITUDES:
  Array<{
    id:
      FiltroSolicitudes;

    label:
      string;
  }> = [
    {
      id:
        "pendiente",

      label:
        "Pendientes",
    },

    {
      id:
        "aprobada",

      label:
        "Aprobadas",
    },

    {
      id:
        "rechazada",

      label:
        "Rechazadas",
    },
  ];

const FILTROS_USUARIOS:
  Array<{
    id:
      FiltroUsuarios;

    label:
      string;
  }> = [
    {
      id:
        "activos",

      label:
        "Activos",
    },

    {
      id:
        "desactivados",

      label:
        "Desactivados",
    },
  ];

export function AdminUsersView() {
  const {
    user,
  } =
    useAuth();

  const [
    seccion,
    setSeccion,
  ] =
    useState<SeccionAdmin>(
      "solicitudes",
    );

  const [
    filtroSolicitudes,
    setFiltroSolicitudes,
  ] =
    useState<FiltroSolicitudes>(
      "pendiente",
    );

  const [
    filtroUsuarios,
    setFiltroUsuarios,
  ] =
    useState<FiltroUsuarios>(
      "activos",
    );

  const [
    solicitudes,
    setSolicitudes,
  ] =
    useState<
      SolicitudAcceso[]
    >(
      [],
    );

  const [
    usuarios,
    setUsuarios,
  ] =
    useState<
      UsuarioAdministrado[]
    >(
      [],
    );

  const [
    cargando,
    setCargando,
  ] =
    useState(
      true,
    );

  const [
    refrescando,
    setRefrescando,
  ] =
    useState(
      false,
    );

  const [
    operacionEnCurso,
    setOperacionEnCurso,
  ] =
    useState<
      OperacionEnCurso | null
    >(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    mensaje,
    setMensaje,
  ] =
    useState<string | null>(
      null,
    );

  const cargarDatos =
    useCallback(
      async (
        mostrarRefresco =
          false,
      ): Promise<void> => {
        if (
          !user
        ) {
          setSolicitudes(
            [],
          );

          setUsuarios(
            [],
          );

          setCargando(
            false,
          );

          return;
        }

        if (
          mostrarRefresco
        ) {
          setRefrescando(
            true,
          );
        } else {
          setCargando(
            true,
          );
        }

        setError(
          null,
        );

        try {
          const token =
            await user
              .getIdToken();

          const headers = {
            Authorization:
              `Bearer ${token}`,
          };

          const [
            solicitudesResponse,
            usuariosResponse,
          ] =
            await Promise.all(
              [
                fetch(
                  "/api/admin/access-requests?estado=todas",
                  {
                    method:
                      "GET",

                    headers,

                    cache:
                      "no-store",
                  },
                ),

                fetch(
                  "/api/admin/users",
                  {
                    method:
                      "GET",

                    headers,

                    cache:
                      "no-store",
                  },
                ),
              ],
            );

          const solicitudesPayload =
            await leerObjetoJson(
              solicitudesResponse,
            );

          const usuariosPayload =
            await leerObjetoJson(
              usuariosResponse,
            );

          if (
            !solicitudesResponse.ok
          ) {
            throw new Error(
              obtenerErrorApi(
                solicitudesPayload,

                "No se pudieron cargar las solicitudes.",
              ),
            );
          }

          if (
            !usuariosResponse.ok
          ) {
            throw new Error(
              obtenerErrorApi(
                usuariosPayload,

                "No se pudieron cargar los usuarios.",
              ),
            );
          }

          if (
            !Array.isArray(
              solicitudesPayload
                .solicitudes,
            )
          ) {
            throw new Error(
              "La API administrativa no devolvió una lista válida de solicitudes.",
            );
          }

          if (
            !Array.isArray(
              usuariosPayload
                .usuarios,
            )
          ) {
            throw new Error(
              "La API administrativa no devolvió una lista válida de usuarios.",
            );
          }

          setSolicitudes(
            solicitudesPayload
              .solicitudes
              .filter(
                esSolicitudAcceso,
              ),
          );

          setUsuarios(
            usuariosPayload
              .usuarios
              .filter(
                esUsuarioAdministrado,
              ),
          );
        } catch (
          loadError
        ) {
          console.error(
            "No se pudieron cargar los datos administrativos:",
            loadError,
          );

          setError(
            obtenerMensajeError(
              loadError,
            ),
          );
        } finally {
          setCargando(
            false,
          );

          setRefrescando(
            false,
          );
        }
      },
      [
        user,
      ],
    );

  useEffect(
    () => {
      void cargarDatos();
    },
    [
      cargarDatos,
    ],
  );

  const conteosSolicitudes =
    useMemo(
      () => ({
        pendiente:
          solicitudes.filter(
            (
              item,
            ) =>
              item.estado ===
              "pendiente",
          ).length,

        aprobada:
          solicitudes.filter(
            (
              item,
            ) =>
              item.estado ===
              "aprobada",
          ).length,

        rechazada:
          solicitudes.filter(
            (
              item,
            ) =>
              item.estado ===
              "rechazada",
          ).length,
      }),
      [
        solicitudes,
      ],
    );

  const conteosUsuarios =
    useMemo(
      () => ({
        activos:
          usuarios.filter(
            (
              item,
            ) =>
              item.activo,
          ).length,

        desactivados:
          usuarios.filter(
            (
              item,
            ) =>
              !item.activo,
          ).length,

        admins:
          usuarios.filter(
            (
              item,
            ) =>
              item.rol ===
              "admin",
          ).length,
      }),
      [
        usuarios,
      ],
    );

  const solicitudesVisibles =
    useMemo(
      () =>
        solicitudes.filter(
          (
            item,
          ) =>
            item.estado ===
            filtroSolicitudes,
        ),
      [
        filtroSolicitudes,
        solicitudes,
      ],
    );

  const usuariosVisibles =
    useMemo(
      () =>
        usuarios.filter(
          (
            item,
          ) =>
            filtroUsuarios ===
            "activos"
              ? item.activo
              : !item.activo,
        ),
      [
        filtroUsuarios,
        usuarios,
      ],
    );

  const revisarSolicitud =
    async (
      solicitud:
        SolicitudAcceso,

      accion:
        AccionSolicitudAcceso,
    ): Promise<void> => {
      if (
        !user
      ) {
        setError(
          "No existe una sesión administrativa activa.",
        );

        return;
      }

      setOperacionEnCurso({
        tipo:
          "solicitud",

        uid:
          solicitud.uid,

        accion,
      });

      setError(
        null,
      );

      setMensaje(
        null,
      );

      try {
        const token =
          await user
            .getIdToken();

        const response =
          await fetch(
            "/api/admin/access-requests",
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  uid:
                    solicitud.uid,

                  accion,
                }),
            },
          );

        const payload =
          await leerObjetoJson(
            response,
          );

        if (
          !response.ok
        ) {
          throw new Error(
            obtenerErrorApi(
              payload,
              "No se pudo revisar la solicitud.",
            ),
          );
        }

        if (
          !esSolicitudAcceso(
            payload.solicitud,
          )
        ) {
          throw new Error(
            "La API no devolvió la solicitud actualizada.",
          );
        }

        const actualizada =
          payload.solicitud;

        setSolicitudes(
          (
            actuales,
          ) =>
            actuales.map(
              (
                item,
              ) =>
                item.uid ===
                actualizada.uid
                  ? actualizada
                  : item,
            ),
        );

        if (
          accion ===
          "aprobar"
        ) {
          setMensaje(
            `${actualizada.nombre} fue aprobado correctamente.`,
          );

          setFiltroSolicitudes(
            "aprobada",
          );

          /*
           * La aprobación crea allowedUsers/{uid}.
           * Refrescamos la sección Usuarios.
           */
          await cargarDatos(
            true,
          );
        } else {
          setMensaje(
            `${actualizada.nombre} fue rechazado.`,
          );

          setFiltroSolicitudes(
            "rechazada",
          );
        }
      } catch (
        actionError
      ) {
        console.error(
          "No se pudo revisar la solicitud administrativa:",
          actionError,
        );

        setError(
          obtenerMensajeError(
            actionError,
          ),
        );
      } finally {
        setOperacionEnCurso(
          null,
        );
      }
    };

  const cambiarEstadoUsuario =
    async (
      usuario:
        UsuarioAdministrado,

      accion:
        AccionUsuarioAdmin,
    ): Promise<void> => {
      if (
        !user
      ) {
        setError(
          "No existe una sesión administrativa activa.",
        );

        return;
      }

      setOperacionEnCurso({
        tipo:
          "usuario",

        uid:
          usuario.uid,

        accion,
      });

      setError(
        null,
      );

      setMensaje(
        null,
      );

      try {
        const token =
          await user
            .getIdToken();

        const response =
          await fetch(
            "/api/admin/users",
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  uid:
                    usuario.uid,

                  accion,
                }),
            },
          );

        const payload =
          await leerObjetoJson(
            response,
          );

        if (
          !response.ok
        ) {
          throw new Error(
            obtenerErrorApi(
              payload,

              "No se pudo actualizar el acceso del usuario.",
            ),
          );
        }

        if (
          !esUsuarioAdministrado(
            payload.usuario,
          )
        ) {
          throw new Error(
            "La API no devolvió el usuario actualizado.",
          );
        }

        const actualizado =
          payload.usuario;

        setUsuarios(
          (
            actuales,
          ) =>
            actuales.map(
              (
                item,
              ) =>
                item.uid ===
                actualizado.uid
                  ? actualizado
                  : item,
            ),
        );

        if (
          accion ===
          "desactivar"
        ) {
          setMensaje(
            `${actualizado.nombre} fue desactivado. Su presupuesto e historial permanecen guardados.`,
          );

          setFiltroUsuarios(
            "desactivados",
          );
        } else {
          setMensaje(
            `${actualizado.nombre} fue reactivado y recuperó acceso a su mismo presupuesto.`,
          );

          setFiltroUsuarios(
            "activos",
          );
        }
      } catch (
        actionError
      ) {
        console.error(
          "No se pudo cambiar el acceso del usuario:",
          actionError,
        );

        setError(
          obtenerMensajeError(
            actionError,
          ),
        );
      } finally {
        setOperacionEnCurso(
          null,
        );
      }
    };

  return (
    <main className="min-h-screen bg-slate-950 p-0 text-slate-900 antialiased sm:p-5">
      <div className="mx-auto min-h-screen w-full max-w-5xl overflow-hidden bg-slate-50 shadow-2xl sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[2rem]">
        <header className="bg-slate-900 px-4 py-5 text-white sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Link
                href="/"
                aria-label="Volver al presupuesto"
                title="Volver al presupuesto"
                className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>

              <div>
                <div className="flex items-center gap-2 text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />

                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Administración
                  </p>
                </div>

                <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                  Usuarios y solicitudes
                </h1>

                <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-400">
                  Aprueba nuevas cuentas y administra el acceso de usuarios
                  existentes sin borrar sus datos.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={
                cargando ||
                refrescando ||
                operacionEnCurso !==
                  null
              }
              onClick={() =>
                void cargarDatos(
                  true,
                )
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refrescando ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}

              Actualizar
            </button>
          </div>
        </header>

        <div className="space-y-5 p-4 sm:p-6">
          <section className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-200 p-1.5">
            <button
              type="button"
              onClick={() => {
                setSeccion(
                  "solicitudes",
                );

                setMensaje(
                  null,
                );
              }}
              className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                seccion ===
                "solicitudes"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Solicitudes

              {conteosSolicitudes.pendiente >
              0 ? (
                <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                  {
                    conteosSolicitudes
                      .pendiente
                  }
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => {
                setSeccion(
                  "usuarios",
                );

                setMensaje(
                  null,
                );
              }}
              className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                seccion ===
                "usuarios"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Usuarios

              <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                {
                  conteosUsuarios
                    .activos
                }
              </span>
            </button>
          </section>

          {mensaje ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

              <p className="flex-1">
                {mensaje}
              </p>

              <button
                type="button"
                onClick={() =>
                  setMensaje(
                    null,
                  )
                }
                aria-label="Cerrar mensaje"
                className="rounded-lg p-1 transition hover:bg-emerald-100"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-800"
            >
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />

              <div className="flex-1">
                <p className="font-black">
                  No se pudo completar la operación
                </p>

                <p className="mt-1">
                  {error}
                </p>
              </div>
            </div>
          ) : null}

          {seccion ===
          "solicitudes" ? (
            <SolicitudesSection
              cargando={
                cargando
              }
              solicitudes={
                solicitudesVisibles
              }
              conteos={
                conteosSolicitudes
              }
              filtro={
                filtroSolicitudes
              }
              operacionEnCurso={
                operacionEnCurso
              }
              onFiltro={
                setFiltroSolicitudes
              }
              onRevisar={
                revisarSolicitud
              }
            />
          ) : (
            <UsuariosSection
              cargando={
                cargando
              }
              usuarios={
                usuariosVisibles
              }
              conteos={
                conteosUsuarios
              }
              filtro={
                filtroUsuarios
              }
              currentUid={
                user?.uid ??
                null
              }
              operacionEnCurso={
                operacionEnCurso
              }
              onFiltro={
                setFiltroUsuarios
              }
              onCambiarEstado={
                cambiarEstadoUsuario
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}

interface SolicitudesSectionProps {
  cargando:
    boolean;

  solicitudes:
    SolicitudAcceso[];

  conteos:
    Record<
      FiltroSolicitudes,
      number
    >;

  filtro:
    FiltroSolicitudes;

  operacionEnCurso:
    OperacionEnCurso | null;

  onFiltro:
    (
      filtro:
        FiltroSolicitudes,
    ) => void;

  onRevisar:
    (
      solicitud:
        SolicitudAcceso,

      accion:
        AccionSolicitudAcceso,
    ) => Promise<void>;
}

function SolicitudesSection({
  cargando,
  solicitudes,
  conteos,
  filtro,
  operacionEnCurso,
  onFiltro,
  onRevisar,
}: SolicitudesSectionProps) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        <StatusMetric
          icon={
            Clock3
          }
          label="Pendientes"
          value={
            conteos.pendiente
          }
          className="border-amber-200 bg-amber-50 text-amber-800"
        />

        <StatusMetric
          icon={
            UserCheck
          }
          label="Aprobadas"
          value={
            conteos.aprobada
          }
          className="border-emerald-200 bg-emerald-50 text-emerald-800"
        />

        <StatusMetric
          icon={
            UserX
          }
          label="Rechazadas"
          value={
            conteos.rechazada
          }
          className="border-rose-200 bg-rose-50 text-rose-800"
        />
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-2">
          <div
            role="tablist"
            aria-label="Estado de solicitudes"
            className="grid grid-cols-3 gap-2"
          >
            {FILTROS_SOLICITUDES.map(
              (
                item,
              ) => {
                const activo =
                  filtro ===
                  item.id;

                return (
                  <button
                    key={
                      item.id
                    }
                    type="button"
                    role="tab"
                    aria-selected={
                      activo
                    }
                    onClick={() =>
                      onFiltro(
                        item.id,
                      )
                    }
                    className={`rounded-2xl px-3 py-3 text-xs font-black transition sm:text-sm ${
                      activo
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {
                      item.label
                    }

                    <span
                      className={`ml-2 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] ${
                        activo
                          ? "bg-white/15 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {
                        conteos[
                          item.id
                        ]
                      }
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {cargando ? (
            <AdminLoadingState
              texto="Cargando solicitudes"
            />
          ) : solicitudes.length ===
            0 ? (
            <EmptyState
              texto={
                filtro ===
                "pendiente"
                  ? "No hay solicitudes pendientes."
                  : filtro ===
                      "aprobada"
                    ? "Todavía no hay solicitudes aprobadas."
                    : "No hay solicitudes rechazadas."
              }
            />
          ) : (
            <div className="space-y-3">
              {solicitudes.map(
                (
                  solicitud,
                ) => (
                  <AccessRequestCard
                    key={
                      solicitud.uid
                    }
                    solicitud={
                      solicitud
                    }
                    operacionEnCurso={
                      operacionEnCurso
                    }
                    onRevisar={
                      onRevisar
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

interface UsuariosSectionProps {
  cargando:
    boolean;

  usuarios:
    UsuarioAdministrado[];

  conteos: {
    activos:
      number;

    desactivados:
      number;

    admins:
      number;
  };

  filtro:
    FiltroUsuarios;

  currentUid:
    string | null;

  operacionEnCurso:
    OperacionEnCurso | null;

  onFiltro:
    (
      filtro:
        FiltroUsuarios,
    ) => void;

  onCambiarEstado:
    (
      usuario:
        UsuarioAdministrado,

      accion:
        AccionUsuarioAdmin,
    ) => Promise<void>;
}

function UsuariosSection({
  cargando,
  usuarios,
  conteos,
  filtro,
  currentUid,
  operacionEnCurso,
  onFiltro,
  onCambiarEstado,
}: UsuariosSectionProps) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        <StatusMetric
          icon={
            UsersRound
          }
          label="Activos"
          value={
            conteos.activos
          }
          className="border-emerald-200 bg-emerald-50 text-emerald-800"
        />

        <StatusMetric
          icon={
            ShieldOff
          }
          label="Desactivados"
          value={
            conteos.desactivados
          }
          className="border-slate-200 bg-slate-100 text-slate-700"
        />

        <StatusMetric
          icon={
            ShieldCheck
          }
          label="Administradores"
          value={
            conteos.admins
          }
          className="border-indigo-200 bg-indigo-50 text-indigo-800"
        />
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-2">
          <div
            role="tablist"
            aria-label="Estado de usuarios"
            className="grid grid-cols-2 gap-2"
          >
            {FILTROS_USUARIOS.map(
              (
                item,
              ) => {
                const activo =
                  filtro ===
                  item.id;

                const cantidad =
                  item.id ===
                  "activos"
                    ? conteos.activos
                    : conteos.desactivados;

                return (
                  <button
                    key={
                      item.id
                    }
                    type="button"
                    role="tab"
                    aria-selected={
                      activo
                    }
                    onClick={() =>
                      onFiltro(
                        item.id,
                      )
                    }
                    className={`rounded-2xl px-3 py-3 text-xs font-black transition sm:text-sm ${
                      activo
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {
                      item.label
                    }

                    <span
                      className={`ml-2 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] ${
                        activo
                          ? "bg-white/15 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {
                        cantidad
                      }
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {cargando ? (
            <AdminLoadingState
              texto="Cargando usuarios"
            />
          ) : usuarios.length ===
            0 ? (
            <EmptyState
              texto={
                filtro ===
                "activos"
                  ? "No hay usuarios activos."
                  : "No hay usuarios desactivados."
              }
            />
          ) : (
            <div className="space-y-3">
              {usuarios.map(
                (
                  usuario,
                ) => (
                  <UserAccessCard
                    key={
                      usuario.uid
                    }
                    usuario={
                      usuario
                    }
                    esCuentaActual={
                      usuario.uid ===
                      currentUid
                    }
                    operacionEnCurso={
                      operacionEnCurso
                    }
                    onCambiarEstado={
                      onCambiarEstado
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

interface StatusMetricProps {
  icon:
    LucideIcon;

  label:
    string;

  value:
    number;

  className:
    string;
}

function StatusMetric({
  icon:
    Icon,

  label,
  value,
  className,
}: StatusMetricProps) {
  return (
    <article
      className={`rounded-2xl border p-4 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">
            {label}
          </p>

          <p className="mt-2 text-3xl font-black">
            {value}
          </p>
        </div>

        <Icon className="h-7 w-7 opacity-70" />
      </div>
    </article>
  );
}

interface AccessRequestCardProps {
  solicitud:
    SolicitudAcceso;

  operacionEnCurso:
    OperacionEnCurso | null;

  onRevisar:
    (
      solicitud:
        SolicitudAcceso,

      accion:
        AccionSolicitudAcceso,
    ) => Promise<void>;
}

function AccessRequestCard({
  solicitud,
  operacionEnCurso,
  onRevisar,
}: AccessRequestCardProps) {
  const accionActual =
    operacionEnCurso?.tipo ===
      "solicitud" &&
    operacionEnCurso.uid ===
      solicitud.uid
      ? operacionEnCurso.accion
      : null;

  const procesando =
    accionActual !==
    null;

  const inicial =
    solicitud.nombre
      .trim()
      .charAt(
        0,
      )
      .toUpperCase() ||
    "U";

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-base font-black text-indigo-700">
            {inicial}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-black text-slate-950">
                {
                  solicitud.nombre
                }
              </h2>

              <EstadoSolicitudBadge
                estado={
                  solicitud.estado
                }
              />
            </div>

            <p className="mt-1 break-all text-sm font-semibold text-slate-600">
              {
                solicitud.email
              }
            </p>

            <div className="mt-3 grid gap-1 text-xs font-medium text-slate-500">
              <p>
                Solicitado:{" "}
                {formatearFecha(
                  solicitud.solicitadoEn,
                )}
              </p>

              {solicitud.revisadoEn ? (
                <p>
                  Revisado:{" "}
                  {formatearFecha(
                    solicitud.revisadoEn,
                  )}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          {solicitud.estado !==
          "aprobada" ? (
            <button
              type="button"
              disabled={
                procesando
              }
              onClick={() =>
                void onRevisar(
                  solicitud,
                  "aprobar",
                )
              }
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {accionActual ===
              "aprobar" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}

              Aprobar
            </button>
          ) : null}

          {solicitud.estado ===
          "pendiente" ? (
            <button
              type="button"
              disabled={
                procesando
              }
              onClick={() =>
                void onRevisar(
                  solicitud,
                  "rechazar",
                )
              }
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {accionActual ===
              "rechazar" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <UserX className="h-4 w-4" />
              )}

              Rechazar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

interface UserAccessCardProps {
  usuario:
    UsuarioAdministrado;

  esCuentaActual:
    boolean;

  operacionEnCurso:
    OperacionEnCurso | null;

  onCambiarEstado:
    (
      usuario:
        UsuarioAdministrado,

      accion:
        AccionUsuarioAdmin,
    ) => Promise<void>;
}

function UserAccessCard({
  usuario,
  esCuentaActual,
  operacionEnCurso,
  onCambiarEstado,
}: UserAccessCardProps) {
  const accionActual =
    operacionEnCurso?.tipo ===
      "usuario" &&
    operacionEnCurso.uid ===
      usuario.uid
      ? operacionEnCurso.accion
      : null;

  const procesando =
    accionActual !==
    null;

  const inicial =
    usuario.nombre
      .trim()
      .charAt(
        0,
      )
      .toUpperCase() ||
    "U";

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-black ${
              usuario.rol ===
              "admin"
                ? "bg-indigo-100 text-indigo-700"
                : usuario.activo
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-500"
            }`}
          >
            {inicial}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-black text-slate-950">
                {
                  usuario.nombre
                }
              </h2>

              <RolBadge
                rol={
                  usuario.rol
                }
              />

              <EstadoUsuarioBadge
                activo={
                  usuario.activo
                }
              />

              {esCuentaActual ? (
                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700">
                  Tu cuenta
                </span>
              ) : null}
            </div>

            <p className="mt-1 break-all text-sm font-semibold text-slate-600">
              {
                usuario.email ||
                "Sin correo guardado"
              }
            </p>

            <div className="mt-3 grid gap-1 text-xs font-medium text-slate-500">
              {usuario.autorizadoEn ? (
                <p>
                  Autorizado:{" "}
                  {formatearFecha(
                    usuario.autorizadoEn,
                  )}
                </p>
              ) : null}

              {!usuario.activo &&
              usuario.desactivadoEn ? (
                <p>
                  Desactivado:{" "}
                  {formatearFecha(
                    usuario.desactivadoEn,
                  )}
                </p>
              ) : null}

              {usuario.activo &&
              usuario.reactivadoEn ? (
                <p>
                  Reactivado:{" "}
                  {formatearFecha(
                    usuario.reactivadoEn,
                  )}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 sm:text-right">
          {esCuentaActual ? (
            <div className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-xs font-black text-indigo-700">
              <ShieldCheck className="h-4 w-4" />

              Protegida
            </div>
          ) : usuario.activo ? (
            <button
              type="button"
              disabled={
                procesando
              }
              onClick={() =>
                void onCambiarEstado(
                  usuario,
                  "desactivar",
                )
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {accionActual ===
              "desactivar" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldOff className="h-4 w-4" />
              )}

              Desactivar
            </button>
          ) : (
            <button
              type="button"
              disabled={
                procesando
              }
              onClick={() =>
                void onCambiarEstado(
                  usuario,
                  "activar",
                )
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {accionActual ===
              "activar" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <UserCog className="h-4 w-4" />
              )}

              Reactivar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function EstadoSolicitudBadge({
  estado,
}: {
  estado:
    EstadoSolicitudAcceso;
}) {
  const config =
    estado ===
    "aprobada"
      ? {
          label:
            "Aprobada",

          className:
            "bg-emerald-100 text-emerald-700",
        }
      : estado ===
          "rechazada"
        ? {
            label:
              "Rechazada",

            className:
              "bg-rose-100 text-rose-700",
          }
        : {
            label:
              "Pendiente",

            className:
              "bg-amber-100 text-amber-700",
          };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function EstadoUsuarioBadge({
  activo,
}: {
  activo:
    boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
        activo
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-200 text-slate-600"
      }`}
    >
      {activo
        ? "Activo"
        : "Desactivado"}
    </span>
  );
}

function RolBadge({
  rol,
}: {
  rol:
    RolUsuario;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
        rol ===
        "admin"
          ? "bg-indigo-100 text-indigo-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {rol ===
      "admin"
        ? "Admin"
        : "Usuario"}
    </span>
  );
}

function AdminLoadingState({
  texto,
}: {
  texto:
    string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center text-center">
      <LoaderCircle className="h-7 w-7 animate-spin text-indigo-600" />

      <p className="mt-3 text-sm font-black text-slate-700">
        {texto}
      </p>

      <p className="mt-1 text-xs font-medium text-slate-500">
        Verificando la sesión administrativa y consultando el servidor.
      </p>
    </div>
  );
}

function EmptyState({
  texto,
}: {
  texto:
    string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <UserRound className="h-8 w-8 text-slate-300" />

      <p className="mt-3 text-sm font-black text-slate-700">
        {texto}
      </p>
    </div>
  );
}

async function leerObjetoJson(
  response:
    Response,
): Promise<
  Record<
    string,
    unknown
  >
> {
  let raw:
    unknown;

  try {
    raw =
      await response.json();
  } catch {
    throw new Error(
      `El servidor devolvió una respuesta inválida (${response.status}).`,
    );
  }

  if (
    !esObjeto(
      raw,
    )
  ) {
    throw new Error(
      "El servidor devolvió una respuesta inválida.",
    );
  }

  return raw;
}

function obtenerErrorApi(
  payload:
    Record<
      string,
      unknown
    >,

  fallback:
    string,
): string {
  return (
    typeof payload.error ===
      "string" &&
    payload.error.trim()
  )
    ? payload.error.trim()
    : fallback;
}

function esSolicitudAcceso(
  value:
    unknown,
): value is SolicitudAcceso {
  if (
    !esObjeto(
      value,
    )
  ) {
    return false;
  }

  return (
    typeof value.uid ===
      "string" &&

    typeof value.nombre ===
      "string" &&

    typeof value.email ===
      "string" &&

    (
      value.fotoUrl ===
        null ||
      typeof value.fotoUrl ===
        "string"
    ) &&

    (
      value.estado ===
        "pendiente" ||
      value.estado ===
        "aprobada" ||
      value.estado ===
        "rechazada"
    ) &&

    typeof value.solicitadoEn ===
      "string" &&

    typeof value.actualizadoEn ===
      "string" &&

    (
      value.revisadoEn ===
        null ||
      typeof value.revisadoEn ===
        "string"
    ) &&

    (
      value.revisadoPor ===
        null ||
      typeof value.revisadoPor ===
        "string"
    ) &&

    typeof value.correoNotificacionEnviado ===
      "boolean" &&

    (
      value.correoNotificacionEnviadoEn ===
        null ||
      typeof value.correoNotificacionEnviadoEn ===
        "string"
    )
  );
}

function esUsuarioAdministrado(
  value:
    unknown,
): value is UsuarioAdministrado {
  if (
    !esObjeto(
      value,
    )
  ) {
    return false;
  }

  return (
    typeof value.uid ===
      "string" &&

    typeof value.nombre ===
      "string" &&

    typeof value.email ===
      "string" &&

    (
      value.fotoUrl ===
        null ||
      typeof value.fotoUrl ===
        "string"
    ) &&

    typeof value.activo ===
      "boolean" &&

    (
      value.rol ===
        "admin" ||
      value.rol ===
        "usuario"
    ) &&

    esTextoNullable(
      value.autorizadoEn,
    ) &&

    esTextoNullable(
      value.actualizadoEn,
    ) &&

    esTextoNullable(
      value.administradorDesde,
    ) &&

    esTextoNullable(
      value.desactivadoEn,
    ) &&

    esTextoNullable(
      value.desactivadoPor,
    ) &&

    esTextoNullable(
      value.reactivadoEn,
    ) &&

    esTextoNullable(
      value.reactivadoPor,
    )
  );
}

function esTextoNullable(
  value:
    unknown,
): value is string | null {
  return (
    value ===
      null ||
    typeof value ===
      "string"
  );
}

function obtenerMensajeError(
  error:
    unknown,
): string {
  return error instanceof
    Error
    ? error.message
    : "Ocurrió un error administrativo inesperado.";
}

function esObjeto(
  value:
    unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null
  );
}

function formatearFecha(
  value:
    string,
): string {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "es-US",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    },
  ).format(
    date,
  );
}