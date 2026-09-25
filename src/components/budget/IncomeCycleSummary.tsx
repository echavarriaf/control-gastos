"use client";

/*
 * Nombre: Resumen del ciclo de ingreso
 * Ruta: src/components/budget/IncomeCycleSummary.tsx
 * Autor: Felix Echavarria
 *
 * Descripción:
 * Presenta un resumen compacto del ingreso actual.
 *
 * Los detalles del ciclo y el administrador completo de depósitos
 * permanecen cerrados por defecto para reducir significativamente
 * la altura del dashboard.
 */

import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Settings2,
} from "lucide-react";

import {
  useState,
} from "react";

import {
  IncomeDepositsManager,
} from "@/components/budget/IncomeDepositsManager";

import type {
  CicloPago,
  Ingreso,
} from "@/lib/budget/types";

import {
  formatoMoneda,
} from "@/lib/budget/utils";

const formatoFechaCiclo =
  new Intl.DateTimeFormat(
    "es-US",
    {
      day:
        "numeric",

      month:
        "short",
    },
  );

function fechaCiclo(
  fechaISO:
    string,
): string {
  const [
    anio,
    mes,
    dia,
  ] =
    fechaISO
      .split("-")
      .map(
        Number,
      );

  if (
    !anio ||
    !mes ||
    !dia
  ) {
    return fechaISO;
  }

  return formatoFechaCiclo.format(
    new Date(
      anio,
      mes - 1,
      dia,
    ),
  );
}

interface IncomeCycleSummaryProps {
  montoEstimado:
    number;

  cargando:
    boolean;

  cicloActual:
    CicloPago | null;

  proximoCiclo:
    CicloPago | null;

  pagosMes:
    number;

  ingresoActual:
    Ingreso | null;

  cargandoIngreso:
    boolean;

  guardandoIngreso:
    boolean;

  onRegistrarDeposito:
    () => void;

  onConfigurar:
    () => void;
}

export function IncomeCycleSummary({
  montoEstimado,
  cargando,
  cicloActual,
  proximoCiclo,
  pagosMes,
  ingresoActual,
  cargandoIngreso,
  guardandoIngreso,
  onRegistrarDeposito,
  onConfigurar,
}: IncomeCycleSummaryProps) {
  const [
    abierto,
    setAbierto,
  ] =
    useState(
      false,
    );

  const proyeccionMes =
    montoEstimado *
    pagosMes;

  const ingresoRecibido =
    ingresoActual?.estado ===
    "recibido";

  const montoCiclo =
    ingresoRecibido
      ? ingresoActual.monto
      : montoEstimado;

  const estadoLabel =
    cargandoIngreso
      ? "Consultando..."
      : ingresoRecibido
        ? "Recibido"
        : "Pendiente";

  const fechaProximoIngreso =
    cargando
      ? "Calculando..."
      : proximoCiclo
        ? fechaCiclo(
            proximoCiclo
              .fechaPagoProgramada,
          )
        : "No disponible";

  return (
    <div className="space-y-3">
      <section
        aria-labelledby="income-cycle-title"
        className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 text-white shadow-lg shadow-emerald-950/10"
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-200 ring-1 ring-white/10">
                <Banknote className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">
                  Flujo de efectivo
                </p>

                <h2
                  id="income-cycle-title"
                  className="mt-0.5 text-base font-black"
                >
                  Ingreso por ciclo
                </h2>

                <p className="mt-0.5 text-[10px] font-semibold text-emerald-100/65">
                  Cada 14 días
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={
                  onConfigurar
                }
                aria-label="Configurar ingresos"
                title="Configurar ingresos"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-emerald-100 transition hover:bg-white/15 active:scale-95"
              >
                <Settings2 className="h-4 w-4" />
              </button>

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
                aria-controls="income-cycle-details"
                className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 text-[10px] font-black text-white transition hover:bg-white/15 active:scale-[0.98]"
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
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/10">
              <p className="text-[8px] font-black uppercase tracking-wider text-emerald-300">
                {ingresoRecibido
                  ? "Recibido"
                  : "Estimado"}
              </p>

              <p className="mt-1 text-lg font-black tracking-tight">
                {formatoMoneda.format(
                  montoCiclo,
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/10">
              <p className="text-[8px] font-black uppercase tracking-wider text-emerald-300">
                Próximo
              </p>

              <p className="mt-1 text-sm font-black">
                {
                  fechaProximoIngreso
                }
              </p>
            </div>

            <div className="col-span-2 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/10 sm:col-span-1">
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-wider text-emerald-300">
                  Estado
                </p>

                <div className="mt-1 flex items-center gap-1.5">
                  <CheckCircle2
                    className={`h-3.5 w-3.5 ${
                      ingresoRecibido
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }`}
                  />

                  <p className="truncate text-xs font-black">
                    {
                      estadoLabel
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {ingresoRecibido &&
              ingresoActual
                .fechaRecibida ? (
                <p className="text-[10px] font-semibold text-emerald-100/70">
                  Depósito confirmado el{" "}
                  {fechaCiclo(
                    ingresoActual
                      .fechaRecibida,
                  )}
                </p>
              ) : (
                <p className="text-[10px] font-semibold text-emerald-100/70">
                  El depósito de este ciclo todavía no está confirmado.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={
                onRegistrarDeposito
              }
              disabled={
                !cicloActual ||
                cargando ||
                cargandoIngreso ||
                guardandoIngreso
              }
              className="shrink-0 rounded-xl bg-emerald-400 px-4 py-2.5 text-[10px] font-black text-emerald-950 transition hover:bg-emerald-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardandoIngreso
                ? "Guardando..."
                : ingresoRecibido
                  ? "Actualizar depósito"
                  : "Registrar depósito"}
            </button>
          </div>
        </div>

        <div
          id="income-cycle-details"
          className={`grid transition-all duration-300 ease-out ${
            abierto
              ? "visible grid-rows-[1fr] opacity-100"
              : "invisible grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-white/10 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/10">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CalendarDays className="h-4 w-4" />

                    <p className="text-[9px] font-black uppercase tracking-wider">
                      Ciclo actual
                    </p>
                  </div>

                  <p className="mt-2 text-sm font-black">
                    {cargando
                      ? "Calculando..."
                      : cicloActual
                        ? `${fechaCiclo(
                            cicloActual
                              .inicioCobertura,
                          )} – ${fechaCiclo(
                            cicloActual
                              .finCobertura,
                          )}`
                        : "No disponible"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/10">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <Banknote className="h-4 w-4" />

                    <p className="text-[9px] font-black uppercase tracking-wider">
                      Proyección del mes
                    </p>
                  </div>

                  <p className="mt-2 text-sm font-black">
                    {cargando
                      ? "Calculando..."
                      : formatoMoneda.format(
                          proyeccionMes,
                        )}
                  </p>

                  <p className="mt-1 text-[10px] font-semibold text-emerald-100/65">
                    {pagosMes}{" "}
                    {pagosMes ===
                    1
                      ? "pago"
                      : "pagos"}{" "}
                    este mes
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />

                  <p className="text-[9px] font-black uppercase tracking-wider">
                    Estado del depósito
                  </p>
                </div>

                <p className="mt-2 text-xs font-black">
                  {cargandoIngreso
                    ? "Consultando ingreso..."
                    : ingresoRecibido
                      ? `${formatoMoneda.format(
                          ingresoActual.monto,
                        )} recibido${
                          ingresoActual
                            .fechaRecibida
                            ? ` el ${fechaCiclo(
                                ingresoActual
                                  .fechaRecibida,
                              )}`
                            : ""
                        }`
                      : "Pendiente de registrar"}
                </p>

                <p className="mt-1 text-[10px] font-medium text-emerald-100/65">
                  El efectivo disponible utiliza el monto confirmado.
                </p>
              </div>

              {pagosMes ===
              3 ? (
                <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs font-bold leading-relaxed text-amber-100">
                  Este mes tiene un tercer pago. El dinero se considerará disponible solamente después de reservar los gastos fijos y las tarjetas próximas.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div
        className={`grid transition-all duration-300 ease-out ${
          abierto
            ? "visible grid-rows-[1fr] opacity-100"
            : "invisible grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <IncomeDepositsManager />
        </div>
      </div>
    </div>
  );
}