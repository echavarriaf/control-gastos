"use client";

import {
  Bell,
  BellOff,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Smartphone,
} from "lucide-react";

import type {
  EstadoPush,
} from "@/hooks/usePushNotifications";

interface PushNotificationButtonProps {
  estado: EstadoPush;
  permiso:
    | NotificationPermission
    | "no_soportado";
  installationId: string | null;
  requiereInstalacionIOS: boolean;
  error: string | null;

  onActivar: () => Promise<boolean>;
  onDesactivar: () => Promise<boolean>;
  onLimpiarError?: () => void;
}

export function PushNotificationButton({
  estado,
  permiso,
  installationId,
  requiereInstalacionIOS,
  error,
  onActivar,
  onDesactivar,
  onLimpiarError,
}: PushNotificationButtonProps) {
  const activo =
    estado === "activo" &&
    permiso === "granted" &&
    Boolean(installationId);

  const procesando =
    estado === "comprobando" ||
    estado === "registrando";

  const deshabilitado =
    estado === "no_soportado" ||
    estado === "denegado";

  const manejarClick = async () => {
    onLimpiarError?.();

    if (activo) {
      await onDesactivar();
      return;
    }

    await onActivar();
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          void manejarClick();
        }}
        disabled={
          procesando ||
          deshabilitado ||
          requiereInstalacionIOS
        }
        aria-pressed={activo}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
          activo
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-white text-slate-800 hover:border-indigo-200 hover:bg-indigo-50"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              activo
                ? "bg-emerald-500 text-white"
                : "bg-indigo-100 text-indigo-700"
            }`}
          >
            {procesando ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : activo ? (
              <Bell className="h-5 w-5" />
            ) : (
              <BellOff className="h-5 w-5" />
            )}
          </span>

          <span className="min-w-0">
            <span className="block text-sm font-black">
              {obtenerTitulo({
                estado,
                activo,
              })}
            </span>

            <span className="mt-0.5 block text-[11px] font-semibold leading-relaxed text-slate-500">
              {obtenerDescripcion({
                estado,
                activo,
                requiereInstalacionIOS,
              })}
            </span>
          </span>
        </span>

        {activo && (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        )}
      </button>

      {requiereInstalacionIOS && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
          <div className="flex items-start gap-2.5">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />

            <div>
              <p className="text-xs font-black text-indigo-900">
                Instala la aplicación en el iPhone
              </p>

              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-indigo-700">
                En Safari, toca Compartir y selecciona
                “Agregar a pantalla de inicio”. Abre la
                aplicación desde el nuevo ícono y vuelve
                a activar las notificaciones.
              </p>
            </div>
          </div>
        </div>
      )}

      {estado === "denegado" && (
        <StatusMessage
          tone="warning"
          message="Las notificaciones están bloqueadas. Habilítalas desde los ajustes del navegador o del teléfono."
        />
      )}

      {estado === "no_soportado" && (
        <StatusMessage
          tone="warning"
          message="Este navegador o dispositivo no soporta Firebase Cloud Messaging."
        />
      )}

      {error && (
        <StatusMessage
          tone="error"
          message={error}
        />
      )}

      {activo && installationId && (
        <p className="px-1 text-[9px] font-semibold text-slate-400">
          Dispositivo registrado:{" "}
          {abreviarInstallationId(
            installationId,
          )}
        </p>
      )}
    </div>
  );
}

interface ObtenerTextoArgs {
  estado: EstadoPush;
  activo: boolean;
  requiereInstalacionIOS?: boolean;
}

function obtenerTitulo({
  estado,
  activo,
}: ObtenerTextoArgs): string {
  if (estado === "comprobando") {
    return "Comprobando compatibilidad";
  }

  if (estado === "registrando") {
    return "Activando notificaciones";
  }

  if (activo) {
    return "Push activado";
  }

  if (estado === "denegado") {
    return "Permiso bloqueado";
  }

  if (estado === "no_soportado") {
    return "Push no disponible";
  }

  if (
    estado === "requiere_instalacion"
  ) {
    return "Instala la aplicación";
  }

  return "Activar notificaciones push";
}

function obtenerDescripcion({
  estado,
  activo,
  requiereInstalacionIOS,
}: ObtenerTextoArgs): string {
  if (estado === "comprobando") {
    return "Validando navegador y service worker.";
  }

  if (estado === "registrando") {
    return "Registrando este dispositivo con Firebase.";
  }

  if (activo) {
    return "Toca para desactivar las alertas en este dispositivo.";
  }

  if (
    estado === "requiere_instalacion" ||
    requiereInstalacionIOS
  ) {
    return "iPhone requiere abrir la PWA desde la pantalla de inicio.";
  }

  if (estado === "denegado") {
    return "Debes cambiar el permiso desde los ajustes.";
  }

  if (estado === "no_soportado") {
    return "Prueba con Safari, Chrome o Edge actualizado.";
  }

  if (estado === "error") {
    return "Ocurrió un problema durante el registro.";
  }

  return "Recibe alertas aunque la aplicación esté cerrada.";
}

interface StatusMessageProps {
  tone: "warning" | "error";
  message: string;
}

function StatusMessage({
  tone,
  message,
}: StatusMessageProps) {
  const esError = tone === "error";

  return (
    <div
      role={esError ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-2xl border px-3 py-2.5 ${
        esError
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />

      <p className="text-[11px] font-bold leading-relaxed">
        {message}
      </p>
    </div>
  );
}

function abreviarInstallationId(
  value: string,
): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(
    0,
    9,
  )}…${value.slice(-7)}`;
}