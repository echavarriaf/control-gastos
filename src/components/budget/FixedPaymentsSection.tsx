"use client";

import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
} from "lucide-react";

import { FixedPaymentCard } from "./FixedPaymentCard";

import type {
  CompromisoFijo,
  PagoFijo,
  Quincena,
  ResumenFijo,
} from "@/lib/budget/types";

import {
  anchoBarra,
  formatoMoneda,
} from "@/lib/budget/utils";

interface FixedPaymentsSectionProps {
  resumenFijos: ResumenFijo[];
  quincenaSeleccionada: Quincena;

  totalFijo: number;
  totalPagadoFijoMes: number;
  totalPendienteFijoMes: number;
  totalPagadoFijoQuincena: number;
  porcentajeFijoPagado: number;

  eliminandoPagoFijoId: string | null;

  onRegistrarPago: (
    compromiso: CompromisoFijo,
  ) => void;

  onEliminarPago: (
    pago: PagoFijo,
  ) => void | Promise<void>;
}

export function FixedPaymentsSection({
  resumenFijos,
  quincenaSeleccionada,
  totalFijo,
  totalPagadoFijoMes,
  totalPendienteFijoMes,
  totalPagadoFijoQuincena,
  porcentajeFijoPagado,
  eliminandoPagoFijoId,
  onRegistrarPago,
  onEliminarPago,
}: FixedPaymentsSectionProps) {
  const compromisosPagados =
    resumenFijos.filter(
      (resumen) =>
        resumen.estado === "pagado",
    ).length;

  const compromisosParciales =
    resumenFijos.filter(
      (resumen) =>
        resumen.estado === "parcial",
    ).length;

  const compromisosPendientes =
    resumenFijos.filter(
      (resumen) =>
        resumen.estado === "pendiente",
    ).length;

  return (
    <section
      aria-labelledby="gastos-fijos-title"
      className="space-y-4"
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Compromisos recurrentes
            </p>

            <h2
              id="gastos-fijos-title"
              className="mt-1 text-lg font-black text-slate-900"
            >
              Gastos fijos mensuales
            </h2>

            <p className="mt-1 max-w-xl text-xs font-medium leading-relaxed text-slate-500">
              Registra cada pago o transferencia
              para verificar qué compromisos ya
              fueron cubiertos durante el mes.
            </p>
          </div>

          <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-right">
            <p className="text-[9px] font-black uppercase tracking-wider text-indigo-500">
              Total mensual
            </p>

            <p className="mt-1 text-xl font-black text-indigo-900">
              {formatoMoneda.format(totalFijo)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryMetric
            icon={CheckCircle2}
            label="Pagado este mes"
            value={totalPagadoFijoMes}
            helper={`${compromisosPagados} completos`}
            wrapperClassName="bg-emerald-50"
            iconClassName="bg-emerald-100 text-emerald-700"
            valueClassName="text-emerald-700"
          />

          <SummaryMetric
            icon={Clock3}
            label="Pendiente"
            value={totalPendienteFijoMes}
            helper={`${compromisosPendientes} pendientes · ${compromisosParciales} parciales`}
            wrapperClassName="bg-amber-50"
            iconClassName="bg-amber-100 text-amber-700"
            valueClassName="text-amber-700"
          />

          <SummaryMetric
            icon={CircleDollarSign}
            label={`Pagado Q${quincenaSeleccionada}`}
            value={totalPagadoFijoQuincena}
            helper={`Quincena ${quincenaSeleccionada}`}
            wrapperClassName="bg-indigo-50"
            iconClassName="bg-indigo-100 text-indigo-700"
            valueClassName="text-indigo-700"
          />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black text-slate-500">
            <span>Progreso mensual</span>

            <span>
              {porcentajeFijoPagado.toFixed(0)}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{
                width: `${anchoBarra(
                  porcentajeFijoPagado,
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {resumenFijos.map((resumen) => (
          <FixedPaymentCard
            key={resumen.compromiso.id}
            resumen={resumen}
            quincenaSeleccionada={
              quincenaSeleccionada
            }
            eliminandoPagoFijoId={
              eliminandoPagoFijoId
            }
            onRegistrar={onRegistrarPago}
            onEliminar={onEliminarPago}
          />
        ))}
      </div>
    </section>
  );
}

interface SummaryMetricProps {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  helper: string;
  wrapperClassName: string;
  iconClassName: string;
  valueClassName: string;
}

function SummaryMetric({
  icon: Icono,
  label,
  value,
  helper,
  wrapperClassName,
  iconClassName,
  valueClassName,
}: SummaryMetricProps) {
  return (
    <article
      className={`rounded-2xl p-3 ${wrapperClassName}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`rounded-xl p-2 ${iconClassName}`}
        >
          <Icono className="h-4 w-4" />
        </div>

        <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
          {label}
        </p>
      </div>

      <p
        className={`mt-3 text-lg font-black ${valueClassName}`}
      >
        {formatoMoneda.format(value)}
      </p>

      <p className="mt-1 text-[10px] font-semibold text-slate-500">
        {helper}
      </p>
    </article>
  );
}