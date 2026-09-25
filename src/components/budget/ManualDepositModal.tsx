"use client";

import {
  Banknote,
  LoaderCircle,
  X,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  GuardarDepositoManualInput,
} from "@/hooks/useIncomeTransactions";

import type {
  Ingreso,
} from "@/lib/budget/types";

interface ManualDepositModalProps {
  abierto:
    boolean;

  deposito:
    Ingreso | null;

  guardando:
    boolean;

  error:
    string | null;

  onCerrar:
    () => void;

  onGuardar: (
    input:
      GuardarDepositoManualInput,

    ingresoExistente?:
      Ingreso | null,
  ) => Promise<boolean>;
}

function fechaHoyISO(): string {
  const fecha =
    new Date();

  const year =
    fecha.getFullYear();

  const month =
    String(
      fecha.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      fecha.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

export function ManualDepositModal({
  abierto,
  deposito,
  guardando,
  error,
  onCerrar,
  onGuardar,
}: ManualDepositModalProps) {
  const [
    descripcion,
    setDescripcion,
  ] =
    useState(
      "",
    );

  const [
    monto,
    setMonto,
  ] =
    useState(
      "",
    );

  const [
    fecha,
    setFecha,
  ] =
    useState(
      fechaHoyISO,
    );

  const [
    fuente,
    setFuente,
  ] =
    useState<
      Ingreso["fuente"]
    >(
      "otro",
    );

  const [
    notas,
    setNotas,
  ] =
    useState(
      "",
    );

  const [
    errorLocal,
    setErrorLocal,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const editando =
    Boolean(
      deposito,
    );

  useEffect(
    () => {
      if (
        !abierto
      ) {
        return;
      }

      setDescripcion(
        deposito
          ?.descripcion ??
          "",
      );

      setMonto(
        deposito
          ? String(
              deposito.monto,
            )
          : "",
      );

      setFecha(
        deposito
          ?.fechaRecibida ??
          deposito
            ?.fechaProgramada ??
          fechaHoyISO(),
      );

      setFuente(
        deposito
          ?.fuente ??
          "otro",
      );

      setNotas(
        deposito
          ?.notas ??
          "",
      );

      setErrorLocal(
        null,
      );
    },
    [
      abierto,
      deposito,
    ],
  );

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
    !abierto
  ) {
    return null;
  }

  const guardar =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      const descripcionLimpia =
        descripcion.trim();

      if (
        !descripcionLimpia
      ) {
        setErrorLocal(
          "Escribe una descripción para el depósito.",
        );

        return;
      }

      if (
        !Number.isFinite(
          montoNumerico,
        ) ||
        montoNumerico <=
          0
      ) {
        setErrorLocal(
          "Escribe un monto mayor que cero.",
        );

        return;
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          fecha,
        )
      ) {
        setErrorLocal(
          "Selecciona una fecha válida.",
        );

        return;
      }

      if (
        notas.length >
        1000
      ) {
        setErrorLocal(
          "Las notas no pueden superar 1000 caracteres.",
        );

        return;
      }

      setErrorLocal(
        null,
      );

      const guardado =
        await onGuardar(
          {
            descripcion:
              descripcionLimpia,

            monto:
              montoNumerico,

            fechaRecibida:
              fecha,

            fuente,

            notas:
              notas.trim(),
          },

          deposito,
        );

      if (
        guardado
      ) {
        onCerrar();
      }
    };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-deposit-title"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onCerrar();
        }
      }}
    >
      <section className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Banknote className="h-5 w-5" />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">
                Cuenta de gastos
              </p>

              <h2
                id="manual-deposit-title"
                className="mt-1 text-xl font-black text-white"
              >
                {editando
                  ? "Editar depósito"
                  : "Otro depósito"}
              </h2>

              <p className="mt-1 text-xs font-medium leading-5 text-slate-400">
                {editando
                  ? "Corrige el depósito registrado."
                  : "Registra dinero recibido fuera del ciclo de nómina."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={
              onCerrar
            }
            disabled={
              guardando
            }
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={
            guardar
          }
          className="mt-6 space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-slate-200">
              Descripción
            </span>

            <input
              type="text"
              value={
                descripcion
              }
              onChange={(
                event,
              ) =>
                setDescripcion(
                  event
                    .target
                    .value,
                )
              }
              maxLength={
                200
              }
              placeholder="Ej. Reembolso, transferencia, venta..."
              disabled={
                guardando
              }
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500 disabled:opacity-60"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-slate-200">
                Monto
              </span>

              <div className="flex h-12 rounded-2xl border border-white/10 bg-white/5 focus-within:border-emerald-500">
                <span className="flex items-center pl-4 font-black text-slate-500">
                  $
                </span>

                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  value={
                    monto
                  }
                  onChange={(
                    event,
                  ) =>
                    setMonto(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="0.00"
                  disabled={
                    guardando
                  }
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm font-black text-white outline-none placeholder:text-slate-500 disabled:opacity-60"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-slate-200">
                Fecha recibida
              </span>

              <input
                type="date"
                value={
                  fecha
                }
                onChange={(
                  event,
                ) =>
                  setFecha(
                    event
                      .target
                      .value,
                  )
                }
                disabled={
                  guardando
                }
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-emerald-500 disabled:opacity-60"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-slate-200">
              Tipo de ingreso
            </span>

            <select
              value={
                fuente
              }
              onChange={(
                event,
              ) =>
                setFuente(
                  event
                    .target
                    .value as Ingreso["fuente"],
                )
              }
              disabled={
                guardando
              }
              className="h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-bold text-white outline-none transition focus:border-emerald-500 disabled:opacity-60"
            >
              <option value="otro">
                Otro / transferencia
              </option>

              <option value="reembolso">
                Reembolso
              </option>

              <option value="bono">
                Bono
              </option>

              <option value="horas_extra">
                Horas extra
              </option>

              <option value="salario">
                Salario adicional
              </option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-slate-200">
              Notas
            </span>

            <textarea
              value={
                notas
              }
              onChange={(
                event,
              ) =>
                setNotas(
                  event
                    .target
                    .value,
                )
              }
              rows={
                3
              }
              maxLength={
                1000
              }
              placeholder="Opcional"
              disabled={
                guardando
              }
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500 disabled:opacity-60"
            />

            <p className="mt-1 text-right text-[10px] font-semibold text-slate-500">
              {
                notas.length
              }
              /1000
            </p>
          </label>

          {(errorLocal ||
            error) && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200"
            >
              {errorLocal ??
                error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={
                onCerrar
              }
              disabled={
                guardando
              }
              className="rounded-2xl border border-white/10 px-5 py-3 text-xs font-black text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                guardando
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-xs font-black text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
            >
              {guardando && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}

              {guardando
                ? "Guardando..."
                : editando
                  ? "Guardar cambios"
                  : "Registrar depósito"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default ManualDepositModal;