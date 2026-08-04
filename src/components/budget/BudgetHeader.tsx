"use client";

import {
  Bell,
  BellOff,
  LoaderCircle,
  Settings,
  X,
} from "lucide-react";

import {
  useState,
} from "react";

import {
  AuthUserMenu,
} from "@/components/auth/AuthUserMenu";

import {
  PushNotificationButton,
} from "@/components/budget/PushNotificationButton";

import type {
  EstadoPush,
} from "@/hooks/usePushNotifications";

import {
  formatoMoneda,
} from "@/lib/budget/utils";

interface BudgetHeaderProps {
  totalPlanMensual: number;
  totalFijo: number;
  limiteVariableMensual: number;
  saldoVariableMes: number;
  disponibleVariableMes: number;
  totalPagadoFijoMes: number;
  totalPendienteFijoMes: number;

  estadoPush: EstadoPush;

  permisoPush:
    | NotificationPermission
    | "no_soportado";

  installationId: string | null;
  requiereInstalacionIOS: boolean;
  errorPush: string | null;

  onActivarPush: () => Promise<boolean>;
  onDesactivarPush: () => Promise<boolean>;
  onLimpiarErrorPush?: () => void;

  onAbrirConfiguracion: () => void;
}

export function BudgetHeader({
  totalPlanMensual,
  totalFijo,
  limiteVariableMensual,
  saldoVariableMes,
  disponibleVariableMes,
  totalPagadoFijoMes,
  totalPendienteFijoMes,

  estadoPush,
  permisoPush,
  installationId,
  requiereInstalacionIOS,
  errorPush,

  onActivarPush,
  onDesactivarPush,
  onLimpiarErrorPush,

  onAbrirConfiguracion,
}: BudgetHeaderProps) {
  const [
    mostrarPanelPush,
    setMostrarPanelPush,
  ] =
    useState(false);

  const pushActivo =
    estadoPush === "activo" &&
    permisoPush === "granted" &&
    Boolean(
      installationId,
    );

  const pushProcesando =
    estadoPush === "comprobando" ||
    estadoPush === "registrando";

  const pushNoDisponible =
    estadoPush === "no_soportado";

  const tituloPush =
    pushProcesando
      ? "Comprobando notificaciones"
      : pushActivo
        ? "Notificaciones push activadas"
        : pushNoDisponible
          ? "Notificaciones push no disponibles"
          : "Configurar notificaciones push";

  return (
    <header className="relative overflow-visible bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-5 text-white sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
            Presupuesto mensual
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
            {formatoMoneda.format(
              totalPlanMensual,
            )}
          </h1>

          <p className="mt-1 text-xs text-slate-300">
            {formatoMoneda.format(
              totalFijo,
            )}{" "}
            fijos +{" "}
            {formatoMoneda.format(
              limiteVariableMensual,
            )}{" "}
            variables
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMostrarPanelPush(
                (actual) =>
                  !actual,
              );
            }}
            aria-label={
              tituloPush
            }
            aria-expanded={
              mostrarPanelPush
            }
            aria-controls="panel-notificaciones-push"
            title={
              tituloPush
            }
            className={`rounded-2xl border p-3 transition active:scale-95 ${
              pushActivo
                ? "border-emerald-300/30 bg-emerald-400/10"
                : mostrarPanelPush
                  ? "border-indigo-300/40 bg-white/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            {pushProcesando ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-indigo-200" />
            ) : mostrarPanelPush ? (
              <X className="h-4 w-4 text-indigo-100" />
            ) : pushActivo ? (
              <Bell className="h-4 w-4 text-emerald-300" />
            ) : (
              <BellOff className="h-4 w-4 text-indigo-200" />
            )}
          </button>

          <button
            type="button"
            onClick={
              onAbrirConfiguracion
            }
            aria-label="Configurar límites"
            title="Configurar límites"
            className="rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10 active:scale-95"
          >
            <Settings className="h-4 w-4 text-indigo-200" />
          </button>

          <AuthUserMenu />
        </div>
      </div>

      {mostrarPanelPush ? (
        <div
          id="panel-notificaciones-push"
          className="relative z-20 mt-4 rounded-3xl border border-white/10 bg-slate-50 p-3 text-slate-900 shadow-2xl"
        >
          <PushNotificationButton
            estado={
              estadoPush
            }
            permiso={
              permisoPush
            }
            installationId={
              installationId
            }
            requiereInstalacionIOS={
              requiereInstalacionIOS
            }
            error={
              errorPush
            }
            onActivar={
              onActivarPush
            }
            onDesactivar={
              onDesactivarPush
            }
            onLimpiarError={
              onLimpiarErrorPush
            }
          />
        </div>
      ) : null}

      <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Saldo variable"
          value={
            saldoVariableMes
          }
        />

        <Metric
          label="Disponible"
          value={
            disponibleVariableMes
          }
          valueClassName="text-emerald-300"
        />

        <Metric
          label="Fijos pagados"
          value={
            totalPagadoFijoMes
          }
          valueClassName="text-cyan-200"
        />

        <Metric
          label="Fijos pendientes"
          value={
            totalPendienteFijoMes
          }
          valueClassName="text-amber-200"
        />
      </div>
    </header>
  );
}

interface MetricProps {
  label: string;
  value: number;
  valueClassName?: string;
}

function Metric({
  label,
  value,
  valueClassName = "",
}: MetricProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-lg font-black ${valueClassName}`}
      >
        {formatoMoneda.format(
          value,
        )}
      </p>
    </div>
  );
}