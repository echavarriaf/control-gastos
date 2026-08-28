"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import type {
  AccionSolicitudAcceso,
  EstadoSolicitudAcceso,
  SolicitudAcceso,
} from "@/lib/auth/types";

type FiltroSolicitudes = "pendiente" | "aprobada" | "rechazada";

interface AdminApiSuccess {
  ok: true;
  total?: number;
  solicitudes?: SolicitudAcceso[];
  solicitud?: SolicitudAcceso;
  accion?: AccionSolicitudAcceso;
  usuarioAutorizado?: boolean;
  usuarioPresupuestoCreado?: boolean;
}

interface AdminApiFailure {
  ok: false;
  error: string;
}

type AdminApiResponse = AdminApiSuccess | AdminApiFailure;

interface AccionEnCurso {
  uid: string;
  accion: AccionSolicitudAcceso;
}

const FILTROS: Array<{ id: FiltroSolicitudes; label: string }> = [
  { id: "pendiente", label: "Pendientes" },
  { id: "aprobada", label: "Aprobadas" },
  { id: "rechazada", label: "Rechazadas" },
];

export function AdminUsersView() {
  const { user } = useAuth();

  const [solicitudes, setSolicitudes] = useState<SolicitudAcceso[]>([]);
  const [filtro, setFiltro] = useState<FiltroSolicitudes>("pendiente");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [accionEnCurso, setAccionEnCurso] =
    useState<AccionEnCurso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargarSolicitudes = useCallback(
    async (mostrarRefresco = false): Promise<void> => {
      if (!user) {
        setSolicitudes([]);
        setCargando(false);
        return;
      }

      if (mostrarRefresco) {
        setRefrescando(true);
      } else {
        setCargando(true);
      }

      setError(null);

      try {
        const token = await user.getIdToken();

        const response = await fetch(
          "/api/admin/access-requests?estado=todas",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        const payload = await leerRespuestaApi(response);

        if (!response.ok) {
          throw new Error(
            obtenerErrorApi(
              payload,
              "No se pudieron cargar las solicitudes.",
            ),
          );
        }

        if (!payload.ok || !Array.isArray(payload.solicitudes)) {
          throw new Error(
            "La respuesta administrativa no contiene una lista válida de solicitudes.",
          );
        }

        setSolicitudes(payload.solicitudes);
      } catch (loadError) {
        console.error(
          "No se pudieron cargar las solicitudes administrativas:",
          loadError,
        );

        setError(obtenerMensajeError(loadError));
      } finally {
        setCargando(false);
        setRefrescando(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void cargarSolicitudes();
  }, [cargarSolicitudes]);

  const conteos = useMemo(
    () => ({
      pendiente: solicitudes.filter(
        (item) => item.estado === "pendiente",
      ).length,

      aprobada: solicitudes.filter(
        (item) => item.estado === "aprobada",
      ).length,

      rechazada: solicitudes.filter(
        (item) => item.estado === "rechazada",
      ).length,
    }),
    [solicitudes],
  );

  const solicitudesVisibles = useMemo(
    () => solicitudes.filter((item) => item.estado === filtro),
    [filtro, solicitudes],
  );

  const revisarSolicitud = async (
    solicitud: SolicitudAcceso,
    accion: AccionSolicitudAcceso,
  ): Promise<void> => {
    if (!user) {
      setError("No existe una sesión administrativa activa.");
      return;
    }

    setAccionEnCurso({
      uid: solicitud.uid,
      accion,
    });

    setError(null);
    setMensaje(null);

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/admin/access-requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: solicitud.uid,
          accion,
        }),
      });

      const payload = await leerRespuestaApi(response);

      if (!response.ok) {
        throw new Error(
          obtenerErrorApi(
            payload,
            "No se pudo revisar la solicitud.",
          ),
        );
      }

      if (!payload.ok || !payload.solicitud) {
        throw new Error(
          "La respuesta administrativa no contiene la solicitud actualizada.",
        );
      }

      const actualizada = payload.solicitud;

      setSolicitudes((actuales) =>
        actuales.map((item) =>
          item.uid === actualizada.uid
            ? actualizada
            : item,
        ),
      );

      if (accion === "aprobar") {
        setMensaje(
          payload.usuarioPresupuestoCreado
            ? `${actualizada.nombre} fue aprobado y su presupuesto privado fue creado.`
            : `${actualizada.nombre} fue aprobado correctamente.`,
        );

        setFiltro("aprobada");
      } else {
        setMensaje(
          `${actualizada.nombre} fue rechazado. No se creó acceso al presupuesto.`,
        );

        setFiltro("rechazada");
      }
    } catch (actionError) {
      console.error(
        "No se pudo revisar la solicitud administrativa:",
        actionError,
      );

      setError(obtenerMensajeError(actionError));
    } finally {
      setAccionEnCurso(null);
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
                  Revisa las cuentas que solicitaron acceso. Las aprobaciones
                  se procesan mediante la API administrativa segura.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={cargando || refrescando}
              onClick={() => void cargarSolicitudes(true)}
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
          <section className="grid gap-3 sm:grid-cols-3">
            <StatusMetric
              icon={Clock3}
              label="Pendientes"
              value={conteos.pendiente}
              className="border-amber-200 bg-amber-50 text-amber-800"
            />

            <StatusMetric
              icon={UserCheck}
              label="Aprobadas"
              value={conteos.aprobada}
              className="border-emerald-200 bg-emerald-50 text-emerald-800"
            />

            <StatusMetric
              icon={UserX}
              label="Rechazadas"
              value={conteos.rechazada}
              className="border-rose-200 bg-rose-50 text-rose-800"
            />
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
                onClick={() => setMensaje(null)}
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

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-2">
              <div
                role="tablist"
                aria-label="Estado de solicitudes"
                className="grid grid-cols-3 gap-2"
              >
                {FILTROS.map((item) => {
                  const activo = filtro === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={activo}
                      onClick={() => {
                        setFiltro(item.id);
                        setMensaje(null);
                      }}
                      className={`rounded-2xl px-3 py-3 text-xs font-black transition sm:text-sm ${
                        activo
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {item.label}

                      <span
                        className={`ml-2 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] ${
                          activo
                            ? "bg-white/15 text-white"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {conteos[item.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {cargando ? (
                <AdminLoadingState />
              ) : solicitudesVisibles.length === 0 ? (
                <EmptyState filtro={filtro} />
              ) : (
                <div className="space-y-3">
                  {solicitudesVisibles.map((solicitud) => (
                    <AccessRequestCard
                      key={solicitud.uid}
                      solicitud={solicitud}
                      accionEnCurso={accionEnCurso}
                      onRevisar={revisarSolicitud}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

interface StatusMetricProps {
  icon: LucideIcon;
  label: string;
  value: number;
  className: string;
}

function StatusMetric({
  icon: Icon,
  label,
  value,
  className,
}: StatusMetricProps) {
  return (
    <article className={`rounded-2xl border p-4 ${className}`}>
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
  solicitud: SolicitudAcceso;
  accionEnCurso: AccionEnCurso | null;

  onRevisar: (
    solicitud: SolicitudAcceso,
    accion: AccionSolicitudAcceso,
  ) => Promise<void>;
}

function AccessRequestCard({
  solicitud,
  accionEnCurso,
  onRevisar,
}: AccessRequestCardProps) {
  const procesando =
    accionEnCurso?.uid === solicitud.uid;

  const accionActual =
    procesando
      ? accionEnCurso?.accion ?? null
      : null;

  const inicial =
    solicitud.nombre
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

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
                {solicitud.nombre}
              </h2>

              <EstadoBadge estado={solicitud.estado} />
            </div>

            <p className="mt-1 break-all text-sm font-semibold text-slate-600">
              {solicitud.email}
            </p>

            <div className="mt-3 grid gap-1 text-xs font-medium text-slate-500">
              <p>
                Solicitado: {formatearFecha(solicitud.solicitadoEn)}
              </p>

              {solicitud.revisadoEn ? (
                <p>
                  Revisado: {formatearFecha(solicitud.revisadoEn)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          {solicitud.estado !== "aprobada" ? (
            <button
              type="button"
              disabled={procesando}
              onClick={() => void onRevisar(solicitud, "aprobar")}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {accionActual === "aprobar" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}

              Aprobar
            </button>
          ) : null}

          {solicitud.estado === "pendiente" ? (
            <button
              type="button"
              disabled={procesando}
              onClick={() => void onRevisar(solicitud, "rechazar")}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {accionActual === "rechazar" ? (
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

function EstadoBadge({
  estado,
}: {
  estado: EstadoSolicitudAcceso;
}) {
  const config =
    estado === "aprobada"
      ? {
          label: "Aprobada",
          className: "bg-emerald-100 text-emerald-700",
        }
      : estado === "rechazada"
        ? {
            label: "Rechazada",
            className: "bg-rose-100 text-rose-700",
          }
        : {
            label: "Pendiente",
            className: "bg-amber-100 text-amber-700",
          };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function AdminLoadingState() {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center text-center">
      <LoaderCircle className="h-7 w-7 animate-spin text-indigo-600" />

      <p className="mt-3 text-sm font-black text-slate-700">
        Cargando solicitudes
      </p>

      <p className="mt-1 text-xs font-medium text-slate-500">
        Verificando la sesión administrativa y consultando el servidor.
      </p>
    </div>
  );
}

function EmptyState({
  filtro,
}: {
  filtro: FiltroSolicitudes;
}) {
  const texto =
    filtro === "pendiente"
      ? "No hay solicitudes pendientes."
      : filtro === "aprobada"
        ? "Todavía no hay solicitudes aprobadas."
        : "No hay solicitudes rechazadas.";

  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <UserRound className="h-8 w-8 text-slate-300" />

      <p className="mt-3 text-sm font-black text-slate-700">
        {texto}
      </p>
    </div>
  );
}

async function leerRespuestaApi(
  response: Response,
): Promise<AdminApiResponse> {
  let raw: unknown;

  try {
    raw = await response.json();
  } catch {
    return {
      ok: false,
      error:
        "El servidor devolvió una respuesta inválida.",
    };
  }

  if (!esObjeto(raw)) {
    return {
      ok: false,
      error:
        "El servidor devolvió una respuesta inválida.",
    };
  }

  if (raw.ok === true) {
    return {
      ok: true,

      total:
        typeof raw.total === "number"
          ? raw.total
          : undefined,

      solicitudes:
        Array.isArray(raw.solicitudes)
          ? raw.solicitudes.filter(esSolicitudAcceso)
          : undefined,

      solicitud:
        esSolicitudAcceso(raw.solicitud)
          ? raw.solicitud
          : undefined,

      accion:
        raw.accion === "aprobar" ||
        raw.accion === "rechazar"
          ? raw.accion
          : undefined,

      usuarioAutorizado:
        typeof raw.usuarioAutorizado === "boolean"
          ? raw.usuarioAutorizado
          : undefined,

      usuarioPresupuestoCreado:
        typeof raw.usuarioPresupuestoCreado === "boolean"
          ? raw.usuarioPresupuestoCreado
          : undefined,
    };
  }

  return {
    ok: false,

    error:
      typeof raw.error === "string" &&
      raw.error.trim()
        ? raw.error.trim()
        : "La operación administrativa falló.",
  };
}

function esSolicitudAcceso(
  value: unknown,
): value is SolicitudAcceso {
  if (!esObjeto(value)) {
    return false;
  }

  return (
    typeof value.uid === "string" &&
    typeof value.nombre === "string" &&
    typeof value.email === "string" &&
    (
      value.fotoUrl === null ||
      typeof value.fotoUrl === "string"
    ) &&
    (
      value.estado === "pendiente" ||
      value.estado === "aprobada" ||
      value.estado === "rechazada"
    ) &&
    typeof value.solicitadoEn === "string" &&
    typeof value.actualizadoEn === "string" &&
    (
      value.revisadoEn === null ||
      typeof value.revisadoEn === "string"
    ) &&
    (
      value.revisadoPor === null ||
      typeof value.revisadoPor === "string"
    ) &&
    typeof value.correoNotificacionEnviado === "boolean" &&
    (
      value.correoNotificacionEnviadoEn === null ||
      typeof value.correoNotificacionEnviadoEn === "string"
    )
  );
}

function obtenerErrorApi(
  payload: AdminApiResponse,
  fallback: string,
): string {
  return payload.ok
    ? fallback
    : payload.error;
}

function obtenerMensajeError(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error administrativo inesperado.";
}

function esObjeto(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function formatearFecha(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "es-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}