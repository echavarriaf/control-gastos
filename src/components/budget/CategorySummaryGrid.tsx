"use client";

/*
 * Nombre: Resumen de categorías variables
 * Ruta: src/components/budget/CategorySummaryGrid.tsx
 *
 * Descripción:
 * Muestra un resumen compacto de Comida y Gas.
 *
 * El detalle financiero completo de cada categoría permanece
 * plegado por defecto para reducir la altura total del dashboard.
 */

import {
  ChevronDown,
} from "lucide-react";

import {
  useState,
} from "react";

import {
  CATEGORIAS_VARIABLES,
} from "@/lib/budget/constants";

import type {
  ResumenCategoriaConCarryOver,
} from "@/lib/budget/carry-over";

import type {
  LimitesVariables,
  Quincena,
} from "@/lib/budget/types";

import {
  anchoBarra,
  colorBarra,
  formatoMoneda,
} from "@/lib/budget/utils";

interface CategorySummaryGridProps {
  resumenCategorias:
    ResumenCategoriaConCarryOver[];

  limites:
    LimitesVariables;

  quincenaSeleccionada:
    Quincena;
}

export function CategorySummaryGrid({
  resumenCategorias,
  limites,
  quincenaSeleccionada,
}: CategorySummaryGridProps) {
  const [
    abierto,
    setAbierto,
  ] =
    useState(
      false,
    );

  return (
    <section
      aria-labelledby="resumen-categorias-title"
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
              Gastos variables
            </p>

            <h2
              id="resumen-categorias-title"
              className="mt-0.5 text-base font-black text-slate-900"
            >
              Comida y Gas
            </h2>

            <p className="mt-1 text-[10px] font-semibold text-slate-500">
              Quincena{" "}
              {
                quincenaSeleccionada
              }
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setAbierto(
                (
                  actual,
                ) =>
                  !actual,
              )
            }
            aria-expanded={
              abierto
            }
            aria-controls="category-summary-details"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-[10px] font-black text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
          >
            {abierto
              ? "Ocultar"
              : "Detalles"}

            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${
                abierto
                  ? "rotate-180"
                  : ""
              }`}
            />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {resumenCategorias.map(
            (
              resumen,
            ) => {
              const configuracion =
                CATEGORIAS_VARIABLES[
                  resumen.key
                ];

              const Icono =
                configuracion.icon;

              return (
                <div
                  key={
                    resumen.key
                  }
                  className={`rounded-2xl border p-3 ${configuracion.light} ${configuracion.border}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white ${configuracion.color}`}
                    >
                      <Icono className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-slate-900">
                        {
                          configuracion.label
                        }
                      </p>

                      <p className="text-[8px] font-black uppercase tracking-wider text-slate-500">
                        Disponible
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-2">
                    <p
                      className={`text-base font-black ${
                        resumen
                          .disponibleQuincena >=
                        0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {formatoMoneda.format(
                        resumen
                          .disponibleQuincena,
                      )}
                    </p>

                    <span
                      className={`rounded-full bg-white/80 px-2 py-1 text-[9px] font-black ${configuracion.text}`}
                    >
                      {resumen
                        .porcentajeQuincena
                        .toFixed(
                          0,
                        )}
                      %
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${colorBarra(
                        resumen
                          .porcentajeQuincena,
                      )}`}
                      style={{
                        width:
                          `${anchoBarra(
                            resumen
                              .porcentajeQuincena,
                          )}%`,
                      }}
                    />
                  </div>

                  {resumen
                    .excedenteSiguiente >
                    0 && (
                    <p className="mt-2 truncate text-[9px] font-black text-rose-600">
                      {formatoMoneda.format(
                        resumen
                          .excedenteSiguiente,
                      )}{" "}
                      de arrastre
                    </p>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>

      <div
        id="category-summary-details"
        className={`grid transition-all duration-300 ease-out ${
          abierto
            ? "visible grid-rows-[1fr] opacity-100"
            : "invisible grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {resumenCategorias.map(
                (
                  resumen,
                ) => (
                  <CategoryCard
                    key={
                      resumen.key
                    }
                    resumen={
                      resumen
                    }
                    limiteMensual={
                      limites[
                        resumen.key
                      ].mensual
                    }
                    quincenaSeleccionada={
                      quincenaSeleccionada
                    }
                  />
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface CategoryCardProps {
  resumen:
    ResumenCategoriaConCarryOver;

  limiteMensual:
    number;

  quincenaSeleccionada:
    Quincena;
}

function CategoryCard({
  resumen,
  limiteMensual,
  quincenaSeleccionada,
}: CategoryCardProps) {
  const configuracion =
    CATEGORIAS_VARIABLES[
      resumen.key
    ];

  const Icono =
    configuracion.icon;

  const tieneArrastre =
    resumen
      .excedenteAnterior >
    0;

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
              {
                configuracion.label
              }
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
          {resumen
            .porcentajeMes
            .toFixed(
              0,
            )}
          %
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric
          label="Saldo mensual"
          value={
            resumen
              .saldoMes
          }
        />

        <Metric
          label="Disponible"
          value={
            resumen
              .disponibleMes
          }
          valueClassName="text-emerald-700"
        />
      </div>

      <ProgressBlock
        label="Uso mensual"
        porcentaje={
          resumen
            .porcentajeMes
        }
      />

      <div className="my-4 border-t border-slate-200/80" />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Quincena{" "}
            {
              quincenaSeleccionada
            }
          </p>

          <p className="mt-1 text-sm font-black text-slate-900">
            {formatoMoneda.format(
              resumen
                .saldoQuincena,
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
              resumen
                .disponibleQuincena,
            )}
          </p>
        </div>
      </div>

      {tieneArrastre && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-amber-700">
              Arrastre anterior
            </p>

            <p className="mt-1 text-sm font-black text-amber-900">
              {formatoMoneda.format(
                resumen
                  .excedenteAnterior,
              )}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-wider text-amber-700">
              Límite efectivo
            </p>

            <p className="mt-1 text-sm font-black text-amber-900">
              {formatoMoneda.format(
                resumen
                  .limiteQuincenalEfectivo,
              )}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3">
        <ProgressBlock
          label={
            tieneArrastre
              ? `Uso + arrastre / límite ${formatoMoneda.format(
                  resumen
                    .limiteQuincenalBase,
                )}`
              : `Límite ${formatoMoneda.format(
                  resumen
                    .limiteQuincenalBase,
                )}`
          }
          porcentaje={
            resumen
              .porcentajeQuincena
          }
        />
      </div>

      {resumen
        .excedenteSiguiente >
        0 && (
        <p className="mt-3 rounded-xl bg-white/75 px-3 py-2 text-[10px] font-bold text-rose-700">
          {formatoMoneda.format(
            resumen
              .excedenteSiguiente,
          )}{" "}
          pasarán a la próxima quincena.
        </p>
      )}
    </article>
  );
}

interface MetricProps {
  label:
    string;

  value:
    number;

  valueClassName?:
    string;
}

function Metric({
  label,
  value,
  valueClassName =
    "text-slate-900",
}: MetricProps) {
  return (
    <div className="rounded-2xl bg-white/75 p-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 text-base font-black ${valueClassName}`}
      >
        {formatoMoneda.format(
          value,
        )}
      </p>
    </div>
  );
}

interface ProgressBlockProps {
  label:
    string;

  porcentaje:
    number;
}

function ProgressBlock({
  label,
  porcentaje,
}: ProgressBlockProps) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-slate-500">
        <span>
          {label}
        </span>

        <span>
          {porcentaje.toFixed(
            0,
          )}
          %
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-white/80">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorBarra(
            porcentaje,
          )}`}
          style={{
            width:
              `${anchoBarra(
                porcentaje,
              )}%`,
          }}
        />
      </div>
    </div>
  );
}