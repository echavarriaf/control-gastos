"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  CicloPago,
  ConfiguracionIngreso,
  Ingreso,
} from "@/lib/budget/types";

interface IncomeReceiptModalProps {
  abierto: boolean;
  ciclo: CicloPago | null;
  configuracion: ConfiguracionIngreso;
  ingresoExistente?: Ingreso | null;
  guardando: boolean;
  error?: string | null;
  onCerrar: () => void;
  onGuardar: (
    ciclo: CicloPago,
    configuracion: ConfiguracionIngreso,
    monto: number,
    fechaRecibida: string,
  ) => Promise<boolean>;
}

function formatearMoneda(
  valor: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    },
  ).format(valor);
}

function formatearFecha(
  fechaISO: string,
): string {
  const [
    anio,
    mes,
    dia,
  ] = fechaISO
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    "es-US",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(
    new Date(
      anio,
      mes - 1,
      dia,
    ),
  );
}

export default function IncomeReceiptModal({
  abierto,
  ciclo,
  configuracion,
  ingresoExistente = null,
  guardando,
  error = null,
  onCerrar,
  onGuardar,
}: IncomeReceiptModalProps) {
  const [
    monto,
    setMonto,
  ] =
    useState(
      String(
        configuracion.montoEstimado,
      ),
    );

  const [
    fechaRecibida,
    setFechaRecibida,
  ] =
    useState(
      ciclo?.fechaPagoProgramada ??
        "",
    );

  const [
    errorLocal,
    setErrorLocal,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    if (
      !abierto ||
      !ciclo
    ) {
      return;
    }

    setMonto(
      String(
        ingresoExistente?.monto ??
          configuracion.montoEstimado,
      ),
    );

    setFechaRecibida(
      ingresoExistente
        ?.fechaRecibida ??
        ciclo.fechaPagoProgramada,
    );

    setErrorLocal(
      null,
    );
  }, [
    abierto,
    ciclo,
    configuracion.montoEstimado,
    ingresoExistente,
  ]);

  const montoNumerico =
    useMemo(
      () =>
        Number(
          monto,
        ),
      [
        monto,
      ],
    );

  if (
    !abierto ||
    !ciclo
  ) {
    return null;
  }

  const guardar =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !Number.isFinite(
          montoNumerico,
        ) ||
        montoNumerico <= 0
      ) {
        setErrorLocal(
          "Escribe un monto mayor que cero.",
        );

        return;
      }

      if (
        !fechaRecibida
      ) {
        setErrorLocal(
          "Selecciona la fecha en que recibiste el depósito.",
        );

        return;
      }

      setErrorLocal(
        null,
      );

      const guardado =
        await onGuardar(
          ciclo,
          configuracion,
          montoNumerico,
          fechaRecibida,
        );

      if (
        guardado
      ) {
        onCerrar();
      }
    };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="income-receipt-title"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onCerrar();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-400">
              Ingreso del ciclo
            </p>

            <h2
              id="income-receipt-title"
              className="mt-1 text-2xl font-bold text-white"
            >
              Registrar depósito
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Pago programado para{" "}
              {formatearFecha(
                ciclo.fechaPagoProgramada,
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="rounded-full border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Estimado
            </p>

            <p className="mt-1 text-lg font-bold text-white">
              {formatearMoneda(
                configuracion.montoEstimado,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Cobertura
            </p>

            <p className="mt-1 text-sm font-semibold text-white">
              {formatearFecha(
                ciclo.inicioCobertura,
              )}
            </p>

            <p className="text-xs text-slate-400">
              hasta{" "}
              {formatearFecha(
                ciclo.finCobertura,
              )}
            </p>
          </div>
        </div>

        <form
          onSubmit={guardar}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">
              Monto neto recibido
            </span>

            <div className="flex rounded-2xl border border-white/10 bg-white/5 focus-within:border-emerald-500">
              <span className="flex items-center pl-4 text-slate-400">
                $
              </span>

              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={monto}
                onChange={(event) =>
                  setMonto(
                    event.target.value,
                  )
                }
                disabled={guardando}
                className="w-full bg-transparent px-3 py-3.5 text-lg font-semibold text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="1600.00"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">
              Fecha recibida
            </span>

            <input
              type="date"
              value={fechaRecibida}
              onChange={(event) =>
                setFechaRecibida(
                  event.target.value,
                )
              }
              disabled={guardando}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white outline-none transition focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              required
            />
          </label>

          {(errorLocal || error) && (
            <div
              className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {errorLocal ?? error}
            </div>
          )}

          {ingresoExistente?.estado ===
            "recibido" && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Este ingreso ya fue marcado como recibido.
              Guardar nuevamente actualizará el monto y la
              fecha.
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="rounded-2xl border border-white/10 px-5 py-3 font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className="rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando
                ? "Guardando..."
                : ingresoExistente?.estado ===
                    "recibido"
                  ? "Actualizar ingreso"
                  : "Confirmar depósito"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}