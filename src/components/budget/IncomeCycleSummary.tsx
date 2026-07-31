"use client";

import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Settings2,
} from "lucide-react";

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
      day: "numeric",
      month: "short",
    },
  );

function fechaCiclo(
  fechaISO: string,
): string {
  const [
    anio,
    mes,
    dia,
  ] =
    fechaISO
      .split("-")
      .map(Number);

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
  montoEstimado: number;
  cargando: boolean;
  cicloActual: CicloPago | null;
  proximoCiclo: CicloPago | null;
  pagosMes: number;
  ingresoActual: Ingreso | null;
  cargandoIngreso: boolean;
  guardandoIngreso: boolean;
  onRegistrarDeposito: () => void;
  onConfigurar: () => void;
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

  return (
    <section
      aria-labelledby="income-cycle-title"
      className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-5 text-white shadow-lg shadow-emerald-950/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-2xl bg-white/10 p-3 text-emerald-200 ring-1 ring-white/10">
            <Banknote className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
              Flujo de efectivo
            </p>

            <h2
              id="income-cycle-title"
              className="mt-1 text-lg font-black"
            >
              Ingreso por ciclo
            </h2>

            <p className="mt-1 text-xs font-medium text-emerald-100/75">
              Cada 14 días
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={
            onConfigurar
          }
          className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black text-white transition hover:bg-white/15 active:scale-[0.98]"
        >
          <Settings2 className="h-4 w-4" />
          Configurar
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
            {ingresoRecibido
              ? "Monto recibido"
              : "Monto estimado"}
          </p>

          <p className="mt-1 text-3xl font-black tracking-tight">
            {formatoMoneda.format(
              montoCiclo,
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-white/10 px-4 py-3 text-right ring-1 ring-white/10">
          <p className="text-[9px] font-black uppercase tracking-wider text-emerald-300">
            Proyección del mes
          </p>

          <p className="mt-1 text-base font-black">
            {cargando
              ? "Cargando..."
              : formatoMoneda.format(
                  proyeccionMes,
                )}
          </p>

          <p className="mt-0.5 text-[10px] font-bold text-emerald-100/70">
            {pagosMes}{" "}
            {pagosMes === 1
              ? "pago"
              : "pagos"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-2 text-emerald-300">
            <CalendarDays className="h-4 w-4" />

            <p className="text-[10px] font-black uppercase tracking-wider">
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

            <p className="text-[10px] font-black uppercase tracking-wider">
              Próximo ingreso
            </p>
          </div>

          <p className="mt-2 text-sm font-black">
            {cargando
              ? "Calculando..."
              : proximoCiclo
                ? fechaCiclo(
                    proximoCiclo
                      .fechaPagoProgramada,
                  )
                : "No disponible"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />

            <p className="text-[10px] font-black uppercase tracking-wider">
              Estado del depósito
            </p>
          </div>

          <p className="mt-2 text-sm font-black">
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

          <p className="mt-1 text-[11px] font-medium text-emerald-100/70">
            El efectivo disponible utilizará el monto confirmado.
          </p>
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
          className="shrink-0 rounded-2xl bg-emerald-400 px-4 py-3 text-xs font-black text-emerald-950 transition hover:bg-emerald-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardandoIngreso
            ? "Guardando..."
            : ingresoRecibido
              ? "Actualizar depósito"
              : "Registrar depósito"}
        </button>
      </div>

      {pagosMes === 3 ? (
        <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs font-bold leading-relaxed text-amber-100">
          Este mes tiene un tercer pago. El dinero se considerará disponible solamente después de reservar los gastos fijos y las tarjetas próximas.
        </p>
      ) : null}
    </section>
  );
}