"use client";

import {
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  Landmark,
  RefreshCw,
  Trash2,
  WalletCards,
} from "lucide-react";

import { METODOS_PAGO } from "@/lib/budget/constants";

import type {
  CompromisoFijo,
  PagoFijo,
  Quincena,
  ResumenFijo,
} from "@/lib/budget/types";

import {
  anchoBarra,
  fechaCorta,
  formatoMoneda,
  obtenerQuincenaDesdeISO,
} from "@/lib/budget/utils";

interface FixedPaymentCardProps {
  resumen: ResumenFijo;
  quincenaSeleccionada: Quincena;
  eliminandoPagoFijoId: string | null;
  onRegistrar: (
    compromiso: CompromisoFijo,
  ) => void;
  onEliminar: (pago: PagoFijo) => void;
}

export function FixedPaymentCard({
  resumen,
  quincenaSeleccionada,
  eliminandoPagoFijoId,
  onRegistrar,
  onEliminar,
}: FixedPaymentCardProps) {
  const pagado =
    resumen.estado === "pagado";

  const parcial =
    resumen.estado === "parcial";

  const cardClass = pagado
    ? "border-emerald-200 bg-emerald-50/70"
    : parcial
      ? "border-amber-200 bg-amber-50/70"
      : "border-slate-200 bg-white";

  const iconClass = pagado
    ? "bg-emerald-500"
    : parcial
      ? "bg-amber-500"
      : "bg-slate-400";

  return (
    <article
      className={`rounded-3xl border p-4 shadow-sm ${cardClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`rounded-2xl p-2.5 text-white ${iconClass}`}
          >
            {pagado ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Clock3 className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-900">
              {resumen.compromiso.descripcion}
            </h3>

            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
              Compromiso mensual{" "}
              {formatoMoneda.format(
                resumen.compromiso.monto,
              )}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${
            pagado
              ? "bg-emerald-100 text-emerald-700"
              : parcial
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {pagado
            ? "Pagado"
            : parcial
              ? "Pago parcial"
              : "Pendiente"}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full ${
            pagado
              ? "bg-emerald-500"
              : parcial
                ? "bg-amber-400"
                : "bg-slate-300"
          }`}
          style={{
            width: `${anchoBarra(
              resumen.porcentajePagado,
            )}%`,
          }}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <PaymentMetric
          label="Pagado mes"
          value={resumen.pagadoMes}
          valueClassName="text-emerald-700"
        />

        <PaymentMetric
          label={`Quincena ${quincenaSeleccionada}`}
          value={resumen.pagadoQuincena}
          valueClassName="text-indigo-700"
        />

        <PaymentMetric
          label="Pendiente"
          value={resumen.pendienteMes}
          valueClassName="text-slate-800"
        />
      </div>

      {resumen.ultimoPago && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white bg-white/70 p-3 text-[10px] font-semibold text-slate-600">
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />

          <span>
            Último:{" "}
            {fechaCorta(
              resumen.ultimoPago.fecha,
            )}{" "}
            ·{" "}
            {
              METODOS_PAGO[
                resumen.ultimoPago.metodo
              ]
            }{" "}
            ·{" "}
            {formatoMoneda.format(
              resumen.ultimoPago.monto,
            )}
            {resumen.ultimoPago.referencia
              ? ` · Ref. ${resumen.ultimoPago.referencia}`
              : ""}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          onRegistrar(resumen.compromiso)
        }
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-xs font-black text-white transition hover:bg-indigo-700 active:scale-[0.99]"
      >
        <Banknote className="h-4 w-4" />

        {pagado
          ? "Registrar otro pago"
          : "Registrar pago o transferencia"}
      </button>

      {resumen.registrosMes.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            Pagos registrados este mes
          </p>

          {resumen.registrosMes.map(
            (pago) => (
              <div
                key={pago.id}
                className="flex items-center gap-3 rounded-2xl bg-white/80 p-2.5"
              >
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                  {pago.metodo ===
                    "transferencia" ||
                  pago.metodo ===
                    "debito_automatico" ? (
                    <Landmark className="h-3.5 w-3.5" />
                  ) : (
                    <WalletCards className="h-3.5 w-3.5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-black text-slate-800">
                    {
                      METODOS_PAGO[
                        pago.metodo
                      ]
                    }{" "}
                    ·{" "}
                    {pago.periodicidad ===
                    "mensual"
                      ? "Mensual"
                      : `${obtenerQuincenaDesdeISO(
                          pago.fecha,
                        )}.ª quincena`}
                  </p>

                  <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">
                    {fechaCorta(pago.fecha)}
                    {pago.referencia
                      ? ` · Ref. ${pago.referencia}`
                      : ""}
                    {pago.notas
                      ? ` · ${pago.notas}`
                      : ""}
                  </p>
                </div>

                <strong className="text-xs text-emerald-700">
                  {formatoMoneda.format(
                    pago.monto,
                  )}
                </strong>

                <button
                  type="button"
                  onClick={() =>
                    onEliminar(pago)
                  }
                  disabled={
                    eliminandoPagoFijoId ===
                    pago.id
                  }
                  className="rounded-lg p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
                  title="Eliminar pago fijo"
                  aria-label={`Eliminar pago de ${pago.descripcion}`}
                >
                  {eliminandoPagoFijoId ===
                  pago.id ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </article>
  );
}

interface PaymentMetricProps {
  label: string;
  value: number;
  valueClassName: string;
}

function PaymentMetric({
  label,
  value,
  valueClassName,
}: PaymentMetricProps) {
  return (
    <div className="rounded-2xl bg-white/80 p-2.5">
      <p className="text-[9px] font-bold uppercase text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-xs font-black ${valueClassName}`}
      >
        {formatoMoneda.format(value)}
      </p>
    </div>
  );
}