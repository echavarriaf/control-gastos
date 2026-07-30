"use client";

import {
  AlertTriangle,
  CircleAlert,
  X,
} from "lucide-react";

import type { AlertaPresupuesto } from "@/hooks/useBudgetNotifications";

interface FeedbackBannersProps {
  error: string | null;
  alertas: AlertaPresupuesto[];
  onCerrarError: () => void;
}

export function FeedbackBanners({
  error,
  alertas,
  onCerrarError,
}: FeedbackBannersProps) {
  if (!error && alertas.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Avisos del presupuesto"
      className="space-y-3"
    >
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-800"
        >
          <div className="flex items-start gap-2.5">
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0"
            />

            <p className="text-sm font-semibold">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={onCerrarError}
            aria-label="Cerrar mensaje de error"
            title="Cerrar"
            className="shrink-0 rounded-lg p-1 text-rose-500 transition hover:bg-rose-100 hover:text-rose-800 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {alertas.map((alerta) => {
        const excedido =
          alerta.nivel === "excedido";

        return (
          <div
            key={`${alerta.id}-${alerta.nivel}`}
            role="status"
            className={`flex items-start gap-3 rounded-2xl border p-3 ${
              excedido
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0"
            />

            <div>
              <p className="text-sm font-black">
                {alerta.titulo}
              </p>

              <p className="mt-0.5 text-xs font-semibold leading-relaxed">
                {alerta.mensaje}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}