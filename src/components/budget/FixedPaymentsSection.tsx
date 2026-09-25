"use client";

/*
 * Nombre: Sección de pagos fijos
 * Ruta: src/components/budget/FixedPaymentsSection.tsx
 * Autor: Felix Echavarria
 *
 * Descripción:
 * Presenta el resumen mensual de compromisos fijos, su progreso
 * de pago y una lista compacta de cada compromiso.
 *
 * Los detalles completos de cada gasto fijo permanecen plegados
 * por defecto. Solo un compromiso puede estar abierto a la vez.
 *
 * Mantiene:
 * - historial centralizado;
 * - configuración de gastos fijos;
 * - registro de pagos;
 * - eliminación de pagos;
 * - orden de pendientes/parciales antes de pagados;
 * - orden por vencimiento y prioridad.
 */

import {
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  History,
  Settings2,
} from "lucide-react";

import {
  FixedPaymentCard,
} from "./FixedPaymentCard";

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
  resumenFijos:
    ResumenFijo[];

  quincenaSeleccionada:
    Quincena;

  totalFijo:
    number;

  totalPagadoFijoMes:
    number;

  totalPendienteFijoMes:
    number;

  totalPagadoFijoQuincena:
    number;

  porcentajeFijoPagado:
    number;

  eliminandoPagoFijoId:
    string | null;

  onAbrirHistorial:
    () => void;

  onConfigurar:
    () => void;

  onRegistrarPago: (
    compromiso:
      CompromisoFijo,
  ) => void;

  onEliminarPago: (
    pago:
      PagoFijo,
  ) =>
    | void
    | Promise<void>;
}

interface SummaryMetricProps {
  icon:
    typeof CheckCircle2;

  label:
    string;

  value:
    number;

  helper:
    string;

  wrapperClassName:
    string;

  iconClassName:
    string;

  valueClassName:
    string;
}

interface FixedPaymentAccordionItemProps {
  resumen:
    ResumenFijo;

  abierto:
    boolean;

  quincenaSeleccionada:
    Quincena;

  eliminandoPagoFijoId:
    string | null;

  onToggle:
    () => void;

  onRegistrar: (
    compromiso:
      CompromisoFijo,
  ) => void;

  onEliminar: (
    pago:
      PagoFijo,
  ) =>
    | void
    | Promise<void>;
}

type EstadoResumenFijo =
  ResumenFijo[
    "estado"
  ];

/**
 * Devuelve el texto corto utilizado en la fila plegada.
 */
function obtenerEtiquetaEstado(
  estado:
    EstadoResumenFijo,
): string {
  switch (
    estado
  ) {
    case "pagado":
      return "Pagado";

    case "parcial":
      return "Parcial";

    case "pendiente":
      return "Pendiente";
  }
}

/**
 * Devuelve los colores correspondientes al estado del compromiso.
 */
function obtenerEstiloEstado(
  estado:
    EstadoResumenFijo,
): {
  icono:
    string;

  badge:
    string;

  texto:
    string;
} {
  switch (
    estado
  ) {
    case "pagado":
      return {
        icono:
          "bg-emerald-100 text-emerald-700",

        badge:
          "bg-emerald-100 text-emerald-700",

        texto:
          "text-emerald-700",
      };

    case "parcial":
      return {
        icono:
          "bg-indigo-100 text-indigo-700",

        badge:
          "bg-indigo-100 text-indigo-700",

        texto:
          "text-indigo-700",
      };

    case "pendiente":
      return {
        icono:
          "bg-amber-100 text-amber-700",

        badge:
          "bg-amber-100 text-amber-700",

        texto:
          "text-amber-700",
      };
  }
}

/**
 * Renderiza el resumen y la lista de compromisos fijos.
 */
export function FixedPaymentsSection({
  resumenFijos,
  quincenaSeleccionada,
  totalFijo,
  totalPagadoFijoMes,
  totalPendienteFijoMes,
  totalPagadoFijoQuincena,
  porcentajeFijoPagado,
  eliminandoPagoFijoId,
  onAbrirHistorial,
  onConfigurar,
  onRegistrarPago,
  onEliminarPago,
}: FixedPaymentsSectionProps) {
  const [
    compromisoAbiertoId,
    setCompromisoAbiertoId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const compromisosPagados =
    resumenFijos.filter(
      (
        resumen,
      ) =>
        resumen.estado ===
        "pagado",
    ).length;

  const compromisosParciales =
    resumenFijos.filter(
      (
        resumen,
      ) =>
        resumen.estado ===
        "parcial",
    ).length;

  const compromisosPendientes =
    resumenFijos.filter(
      (
        resumen,
      ) =>
        resumen.estado ===
        "pendiente",
    ).length;

  const resumenFijosOrdenados =
    useMemo(
      () => {
        return [
          ...resumenFijos,
        ].sort(
          (
            a,
            b,
          ) => {
            const aPagado =
              a.estado ===
              "pagado";

            const bPagado =
              b.estado ===
              "pagado";

            /*
             * Todo compromiso pagado se mueve después
             * de los pendientes y parciales.
             */
            if (
              aPagado !==
              bPagado
            ) {
              return aPagado
                ? 1
                : -1;
            }

            /*
             * Dentro de cada grupo se ordena por
             * el día de vencimiento.
             */
            const diferenciaVencimiento =
              a.compromiso
                .diaVencimiento -
              b.compromiso
                .diaVencimiento;

            if (
              diferenciaVencimiento !==
              0
            ) {
              return diferenciaVencimiento;
            }

            /*
             * Si vencen el mismo día, primero
             * se muestra el de mayor prioridad.
             *
             * Prioridad 1 = alta
             * Prioridad 2 = media
             * Prioridad 3 = baja
             */
            const diferenciaPrioridad =
              a.compromiso
                .prioridad -
              b.compromiso
                .prioridad;

            if (
              diferenciaPrioridad !==
              0
            ) {
              return diferenciaPrioridad;
            }

            /*
             * Último criterio estable:
             * descripción alfabética.
             */
            return a.compromiso
              .descripcion
              .localeCompare(
                b.compromiso
                  .descripcion,
                "es",
              );
          },
        );
      },
      [
        resumenFijos,
      ],
    );

  const alternarCompromiso =
    (
      compromisoId:
        string,
    ) => {
      setCompromisoAbiertoId(
        (
          actual,
        ) =>
          actual ===
          compromisoId
            ? null
            : compromisoId,
      );
    };

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
              Registra cada pago o transferencia para verificar qué compromisos ya fueron cubiertos durante el mes.
            </p>
          </div>

          <div className="flex flex-wrap items-stretch gap-2 sm:items-start">
            <button
              type="button"
              onClick={
                onAbrirHistorial
              }
              aria-label="Abrir historial de gastos fijos"
              title="Historial de gastos fijos"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-black text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95"
            >
              <History className="h-4 w-4" />

              <span className="hidden sm:inline">
                Historial
              </span>
            </button>

            <button
              type="button"
              onClick={
                onConfigurar
              }
              aria-label="Configurar gastos fijos"
              title="Configurar gastos fijos"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-black text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95"
            >
              <Settings2 className="h-4 w-4" />

              <span className="hidden sm:inline">
                Configurar
              </span>
            </button>

            <div className="flex-1 rounded-2xl bg-indigo-50 px-4 py-3 text-right sm:flex-none">
              <p className="text-[9px] font-black uppercase tracking-wider text-indigo-500">
                Total mensual
              </p>

              <p className="mt-1 text-xl font-black text-indigo-900">
                {formatoMoneda.format(
                  totalFijo,
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryMetric
            icon={
              CheckCircle2
            }
            label="Pagado este mes"
            value={
              totalPagadoFijoMes
            }
            helper={`${compromisosPagados} completos`}
            wrapperClassName="bg-emerald-50"
            iconClassName="bg-emerald-100 text-emerald-700"
            valueClassName="text-emerald-700"
          />

          <SummaryMetric
            icon={
              Clock3
            }
            label="Pendiente"
            value={
              totalPendienteFijoMes
            }
            helper={`${compromisosPendientes} pendientes · ${compromisosParciales} parciales`}
            wrapperClassName="bg-amber-50"
            iconClassName="bg-amber-100 text-amber-700"
            valueClassName="text-amber-700"
          />

          <SummaryMetric
            icon={
              CircleDollarSign
            }
            label={`Pagado Q${quincenaSeleccionada}`}
            value={
              totalPagadoFijoQuincena
            }
            helper={`Quincena ${quincenaSeleccionada}`}
            wrapperClassName="bg-indigo-50"
            iconClassName="bg-indigo-100 text-indigo-700"
            valueClassName="text-indigo-700"
          />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black text-slate-500">
            <span>
              Progreso mensual
            </span>

            <span>
              {porcentajeFijoPagado.toFixed(
                0,
              )}
              %
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{
                width:
                  `${anchoBarra(
                    porcentajeFijoPagado,
                  )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {resumenFijosOrdenados.length >
      0 ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                Compromisos
              </p>

              <p className="mt-0.5 text-xs font-bold text-slate-700">
                {resumenFijosOrdenados.length}{" "}
                {resumenFijosOrdenados.length ===
                1
                  ? "gasto fijo"
                  : "gastos fijos"}
              </p>
            </div>

            {compromisoAbiertoId !==
              null && (
              <button
                type="button"
                onClick={() =>
                  setCompromisoAbiertoId(
                    null,
                  )
                }
                className="rounded-xl bg-white px-3 py-2 text-[10px] font-black text-indigo-600 shadow-sm transition hover:bg-indigo-50 active:scale-[0.98]"
              >
                Cerrar detalle
              </button>
            )}
          </div>

          <div>
            {resumenFijosOrdenados.map(
              (
                resumen,
                indice,
              ) => (
                <FixedPaymentAccordionItem
                  key={
                    resumen
                      .compromiso
                      .id
                  }
                  resumen={
                    resumen
                  }
                  abierto={
                    compromisoAbiertoId ===
                    resumen
                      .compromiso
                      .id
                  }
                  quincenaSeleccionada={
                    quincenaSeleccionada
                  }
                  eliminandoPagoFijoId={
                    eliminandoPagoFijoId
                  }
                  onToggle={() =>
                    alternarCompromiso(
                      resumen
                        .compromiso
                        .id,
                    )
                  }
                  onRegistrar={
                    onRegistrarPago
                  }
                  onEliminar={
                    onEliminarPago
                  }
                  esPrimero={
                    indice ===
                    0
                  }
                />
              ),
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <CircleDollarSign className="mx-auto h-7 w-7 text-slate-300" />

          <p className="mt-3 text-sm font-black text-slate-700">
            No hay gastos fijos configurados
          </p>

          <button
            type="button"
            onClick={
              onConfigurar
            }
            className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            Configurar gastos fijos
          </button>
        </div>
      )}
    </section>
  );
}

function FixedPaymentAccordionItem({
  resumen,
  abierto,
  quincenaSeleccionada,
  eliminandoPagoFijoId,
  onToggle,
  onRegistrar,
  onEliminar,
  esPrimero,
}: FixedPaymentAccordionItemProps & {
  esPrimero:
    boolean;
}) {
  const {
    compromiso,
    estado,
    pagadoMes,
    pendienteMes,
    porcentajePagado,
  } =
    resumen;

  const estilo =
    obtenerEstiloEstado(
      estado,
    );

  const IconoEstado =
    estado ===
    "pagado"
      ? CheckCircle2
      : Clock3;

  return (
    <article
      className={
        esPrimero
          ? ""
          : "border-t border-slate-100"
      }
    >
      <button
        type="button"
        onClick={
          onToggle
        }
        aria-expanded={
          abierto
        }
        aria-controls={`detalle-gasto-fijo-${compromiso.id}`}
        className="group w-full px-4 py-3.5 text-left transition hover:bg-slate-50 active:bg-slate-100 sm:px-5"
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${estilo.icono}`}
          >
            <IconoEstado className="h-4.5 w-4.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-black text-slate-900">
                {
                  compromiso
                    .descripcion
                }
              </h3>

              <span
                className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider ${estilo.badge}`}
              >
                {
                  obtenerEtiquetaEstado(
                    estado,
                  )
                }
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-semibold text-slate-500">
              <span>
                Día{" "}
                {
                  compromiso
                    .diaVencimiento
                }
              </span>

              <span>
                Pagado{" "}
                {formatoMoneda.format(
                  pagadoMes,
                )}
              </span>

              {pendienteMes >
                0 && (
                <span
                  className={`font-black ${estilo.texto}`}
                >
                  Pendiente{" "}
                  {formatoMoneda.format(
                    pendienteMes,
                  )}
                </span>
              )}
            </div>

            <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width:
                    `${anchoBarra(
                      porcentajePagado,
                    )}%`,
                }}
              />
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-black text-slate-900">
              {formatoMoneda.format(
                compromiso.monto,
              )}
            </p>

            <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-slate-400">
              mensual
            </p>
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-indigo-50 group-hover:text-indigo-600">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${
                abierto
                  ? "rotate-180"
                  : ""
              }`}
            />
          </div>
        </div>
      </button>

      <div
        id={`detalle-gasto-fijo-${compromiso.id}`}
        className={`grid transition-all duration-300 ease-out ${
          abierto
            ? "visible grid-rows-[1fr] opacity-100"
            : "invisible grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-4">
            <FixedPaymentCard
              resumen={
                resumen
              }
              quincenaSeleccionada={
                quincenaSeleccionada
              }
              eliminandoPagoFijoId={
                eliminandoPagoFijoId
              }
              onRegistrar={
                onRegistrar
              }
              onEliminar={
                onEliminar
              }
            />
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Renderiza una métrica visual del resumen de gastos fijos.
 */
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
          {
            label
          }
        </p>
      </div>

      <p
        className={`mt-3 text-lg font-black ${valueClassName}`}
      >
        {formatoMoneda.format(
          value,
        )}
      </p>

      <p className="mt-1 text-[10px] font-semibold text-slate-500">
        {
          helper
        }
      </p>
    </article>
  );
}