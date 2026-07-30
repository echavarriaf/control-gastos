"use client";

import { CATEGORIAS_VARIABLES } from "@/lib/budget/constants";

import type {
  LimitesVariables,
  Quincena,
  ResumenCategoria,
} from "@/lib/budget/types";

import {
  anchoBarra,
  colorBarra,
  formatoMoneda,
} from "@/lib/budget/utils";

interface CategorySummaryGridProps {
  resumenCategorias: ResumenCategoria[];
  limites: LimitesVariables;
  quincenaSeleccionada: Quincena;
}

export function CategorySummaryGrid({
  resumenCategorias,
  limites,
  quincenaSeleccionada,
}: CategorySummaryGridProps) {
  return (
    <section
      aria-labelledby="resumen-categorias-title"
      className="space-y-3"
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          Gastos variables
        </p>

        <h2
          id="resumen-categorias-title"
          className="mt-1 text-lg font-black text-slate-900"
        >
          Comida y Gas
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {resumenCategorias.map((resumen) => (
          <CategoryCard
            key={resumen.key}
            resumen={resumen}
            limiteMensual={
              limites[resumen.key].mensual
            }
            limiteQuincenal={
              limites[resumen.key].quincenal
            }
            quincenaSeleccionada={
              quincenaSeleccionada
            }
          />
        ))}
      </div>
    </section>
  );
}

interface CategoryCardProps {
  resumen: ResumenCategoria;
  limiteMensual: number;
  limiteQuincenal: number;
  quincenaSeleccionada: Quincena;
}

function CategoryCard({
  resumen,
  limiteMensual,
  limiteQuincenal,
  quincenaSeleccionada,
}: CategoryCardProps) {
  const configuracion =
    CATEGORIAS_VARIABLES[resumen.key];

  const Icono = configuracion.icon;

  return (
    <article
      className={`rounded-3xl border p-4 shadow-sm ${configuracion.light} ${configuracion.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm ${configuracion.color}`}
          >
            <Icono className="h-5 w-5" />
          </div>

          <div>
            <h3 className="text-base font-black text-slate-900">
              {configuracion.label}
            </h3>

            <p className="text-xs font-semibold text-slate-500">
              Límite mensual{" "}
              {formatoMoneda.format(
                limiteMensual,
              )}
            </p>
          </div>
        </div>

        <span
          className={`rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black ${configuracion.text}`}
        >
          {resumen.porcentajeMes.toFixed(0)}%
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric
          label="Saldo mensual"
          value={resumen.saldoMes}
        />

        <Metric
          label="Disponible"
          value={resumen.disponibleMes}
          valueClassName="text-emerald-700"
        />
      </div>

      <ProgressBlock
        label="Uso mensual"
        porcentaje={resumen.porcentajeMes}
      />

      <div className="my-4 border-t border-slate-200/80" />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Quincena{" "}
            {quincenaSeleccionada}
          </p>

          <p className="mt-1 text-sm font-black text-slate-900">
            {formatoMoneda.format(
              resumen.saldoQuincena,
            )}{" "}
            usados
          </p>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Disponible
          </p>

          <p className="mt-1 text-sm font-black text-emerald-700">
            {formatoMoneda.format(
              resumen.disponibleQuincena,
            )}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBlock
          label={`Límite ${formatoMoneda.format(
            limiteQuincenal,
          )}`}
          porcentaje={
            resumen.porcentajeQuincena
          }
        />
      </div>
    </article>
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
  valueClassName = "text-slate-900",
}: MetricProps) {
  return (
    <div className="rounded-2xl bg-white/75 p-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 text-base font-black ${valueClassName}`}
      >
        {formatoMoneda.format(value)}
      </p>
    </div>
  );
}

interface ProgressBlockProps {
  label: string;
  porcentaje: number;
}

function ProgressBlock({
  label,
  porcentaje,
}: ProgressBlockProps) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-slate-500">
        <span>{label}</span>

        <span>{porcentaje.toFixed(0)}%</span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-white/80">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorBarra(
            porcentaje,
          )}`}
          style={{
            width: `${anchoBarra(
              porcentaje,
            )}%`,
          }}
        />
      </div>
    </div>
  );
}