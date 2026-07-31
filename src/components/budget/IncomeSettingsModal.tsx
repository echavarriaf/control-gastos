"use client";

import {
  CalendarDays,
  DollarSign,
  LoaderCircle,
  Save,
  WalletCards,
  X,
} from "lucide-react";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import type {
  ConfiguracionIngreso,
} from "@/lib/budget/types";

interface IncomeSettingsModalProps {
  abierta: boolean;

  configuracion:
    ConfiguracionIngreso;

  guardando: boolean;

  onCerrar: () => void;

  onGuardar: (
    configuracion:
      ConfiguracionIngreso,
  ) => Promise<boolean>;
}

function normalizarMontoInput(
  value: string,
): number {
  const monto =
    Number.parseFloat(value);

  if (
    !Number.isFinite(monto) ||
    monto <= 0
  ) {
    return 0;
  }

  return Math.round(
    monto * 100,
  ) / 100;
}

export function IncomeSettingsModal({
  abierta,
  configuracion,
  guardando,
  onCerrar,
  onGuardar,
}: IncomeSettingsModalProps) {
  const [
    descripcion,
    setDescripcion,
  ] =
    useState(
      configuracion.descripcion,
    );

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
    fechaAncla,
    setFechaAncla,
  ] =
    useState(
      configuracion.fechaAncla,
    );

  const [
    notas,
    setNotas,
  ] =
    useState(
      configuracion.notas,
    );

  const [
    errorFormulario,
    setErrorFormulario,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    if (!abierta) {
      return;
    }

    setDescripcion(
      configuracion.descripcion,
    );

    setMonto(
      String(
        configuracion.montoEstimado,
      ),
    );

    setFechaAncla(
      configuracion.fechaAncla,
    );

    setNotas(
      configuracion.notas,
    );

    setErrorFormulario(
      null,
    );
  }, [
    abierta,
    configuracion,
  ]);

  if (!abierta) {
    return null;
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const montoNormalizado =
      normalizarMontoInput(
        monto,
      );

    if (
      descripcion.trim().length === 0
    ) {
      setErrorFormulario(
        "Escribe una descripción para el ingreso.",
      );

      return;
    }

    if (
      montoNormalizado <= 0
    ) {
      setErrorFormulario(
        "El monto debe ser mayor que cero.",
      );

      return;
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        fechaAncla,
      )
    ) {
      setErrorFormulario(
        "Selecciona una fecha de pago válida.",
      );

      return;
    }

    setErrorFormulario(
      null,
    );

    const guardado =
      await onGuardar({
        ...configuracion,

        descripcion:
          descripcion.trim(),

        montoEstimado:
          montoNormalizado,

        fechaAncla,

        frecuencia:
          "cada_2_semanas",

        intervaloDias:
          14,

        activa:
          true,

        notas:
          notas.trim(),
      });

    if (guardado) {
      onCerrar();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="income-settings-title"
    >
      <button
        type="button"
        aria-label="Cerrar configuración de ingreso"
        className="absolute inset-0 cursor-default"
        onClick={onCerrar}
      />

      <section className="relative z-10 w-full max-w-lg rounded-t-4xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-4xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <WalletCards className="h-5 w-5" />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
                Flujo de efectivo
              </p>

              <h2
                id="income-settings-title"
                className="mt-1 text-xl font-black text-slate-950"
              >
                Configurar ingreso
              </h2>

              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                El presupuesto generará un ciclo nuevo cada 14 días.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            aria-label="Cerrar"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={handleSubmit}
        >
          <label className="block">
            <span className="text-xs font-black text-slate-700">
              Descripción
            </span>

            <input
              type="text"
              value={descripcion}
              maxLength={200}
              onChange={(event) =>
                setDescripcion(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              placeholder="Salario principal"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-700">
              Monto neto aproximado
            </span>

            <div className="relative mt-2">
              <DollarSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

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
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-black text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                placeholder="1600"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-700">
              Fecha real conocida de pago
            </span>

            <div className="relative mt-2">
              <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="date"
                value={fechaAncla}
                onChange={(event) =>
                  setFechaAncla(
                    event.target.value,
                  )
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-bold text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </label>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-indigo-600">
              Frecuencia
            </p>

            <p className="mt-1 text-sm font-black text-indigo-950">
              Cada 2 semanas
            </p>

            <p className="mt-1 text-xs font-medium leading-relaxed text-indigo-700">
              La aplicación sumará 14 días desde la fecha ancla y detectará automáticamente los meses con tres pagos.
            </p>
          </div>

          <label className="block">
            <span className="text-xs font-black text-slate-700">
              Notas
            </span>

            <textarea
              value={notas}
              maxLength={1000}
              rows={3}
              onChange={(event) =>
                setNotas(
                  event.target.value,
                )
              }
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              placeholder="Opcional"
            />
          </label>

          {errorFormulario ? (
            <p
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700"
            >
              {errorFormulario}
            </p>
          ) : null}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              {guardando
                ? "Guardando..."
                : "Guardar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}