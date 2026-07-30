"use client";

import {
  LoaderCircle,
  Save,
  Settings,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  CATEGORIA_KEYS,
  CATEGORIAS_VARIABLES,
} from "@/lib/budget/constants";

import type {
  CategoriaVariable,
  LimitesVariables,
} from "@/lib/budget/types";

import { formatoMoneda } from "@/lib/budget/utils";

interface BudgetSettingsModalProps {
  abierto: boolean;
  limites: LimitesVariables;
  guardando: boolean;
  onCerrar: () => void;
  onGuardar: (
    limites: LimitesVariables,
  ) => Promise<boolean>;
}

export function BudgetSettingsModal({
  abierto,
  limites,
  guardando,
  onCerrar,
  onGuardar,
}: BudgetSettingsModalProps) {
  const [valores, setValores] =
    useState<LimitesVariables>(limites);

  const [errorLocal, setErrorLocal] =
    useState<string | null>(null);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    setValores({
      comida: {
        mensual: limites.comida.mensual,
        quincenal: limites.comida.quincenal,
      },
      gas: {
        mensual: limites.gas.mensual,
        quincenal: limites.gas.quincenal,
      },
    });

    setErrorLocal(null);
  }, [abierto, limites]);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    const cerrarConEscape = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape" &&
        !guardando
      ) {
        onCerrar();
      }
    };

    window.addEventListener(
      "keydown",
      cerrarConEscape,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        cerrarConEscape,
      );
    };
  }, [abierto, guardando, onCerrar]);

  if (!abierto) {
    return null;
  }

  const actualizarValor = (
    categoria: CategoriaVariable,
    tipo: "mensual" | "quincenal",
    value: string,
  ) => {
    const numero = Number(value);

    setValores((actuales) => ({
      ...actuales,
      [categoria]: {
        ...actuales[categoria],
        [tipo]: Number.isFinite(numero)
          ? numero
          : 0,
      },
    }));
  };

  const enviarFormulario = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setErrorLocal(null);

    for (const categoria of CATEGORIA_KEYS) {
      const limite = valores[categoria];

      if (
        limite.mensual <= 0 ||
        limite.quincenal <= 0
      ) {
        setErrorLocal(
          "Todos los límites deben ser mayores que cero.",
        );
        return;
      }

      if (
        limite.quincenal >
        limite.mensual
      ) {
        setErrorLocal(
          `El límite quincenal de ${
            CATEGORIAS_VARIABLES[categoria]
              .label
          } no puede ser mayor que el mensual.`,
        );
        return;
      }
    }

    const guardado =
      await onGuardar(valores);

    if (guardado) {
      onCerrar();
    }
  };

  const totalMensual =
    CATEGORIA_KEYS.reduce(
      (total, categoria) =>
        total +
        valores[categoria].mensual,
      0,
    );

  const totalQuincenal =
    CATEGORIA_KEYS.reduce(
      (total, categoria) =>
        total +
        valores[categoria].quincenal,
      0,
    );

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !guardando
        ) {
          onCerrar();
        }
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-settings-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-indigo-100 p-2.5 text-indigo-700">
              <Settings className="h-5 w-5" />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">
                Configuración
              </p>

              <h2
                id="budget-settings-title"
                className="mt-1 text-xl font-black text-slate-900"
              >
                Límites variables
              </h2>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Ajusta los límites de Comida y
                Gas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            aria-label="Cerrar configuración"
            title="Cerrar"
            className="rounded-2xl bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          onSubmit={enviarFormulario}
          className="space-y-5 p-5"
        >
          <div className="space-y-4">
            {CATEGORIA_KEYS.map(
              (categoria) => {
                const configuracion =
                  CATEGORIAS_VARIABLES[
                    categoria
                  ];

                const Icono =
                  configuracion.icon;

                return (
                  <fieldset
                    key={categoria}
                    className={`rounded-3xl border p-4 ${configuracion.light} ${configuracion.border}`}
                  >
                    <legend className="sr-only">
                      Límites de{" "}
                      {configuracion.label}
                    </legend>

                    <div className="mb-4 flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl text-white ${configuracion.color}`}
                      >
                        <Icono className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="text-sm font-black text-slate-900">
                          {configuracion.label}
                        </h3>

                        <p className="text-[10px] font-semibold text-slate-500">
                          Control mensual y
                          quincenal
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <LimitInput
                        id={`${categoria}-limite-mensual`}
                        label="Límite mensual"
                        value={
                          valores[categoria]
                            .mensual
                        }
                        disabled={guardando}
                        onChange={(value) =>
                          actualizarValor(
                            categoria,
                            "mensual",
                            value,
                          )
                        }
                      />

                      <LimitInput
                        id={`${categoria}-limite-quincenal`}
                        label="Límite quincenal"
                        value={
                          valores[categoria]
                            .quincenal
                        }
                        disabled={guardando}
                        onChange={(value) =>
                          actualizarValor(
                            categoria,
                            "quincenal",
                            value,
                          )
                        }
                      />
                    </div>
                  </fieldset>
                );
              },
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SummaryBox
              label="Total mensual"
              value={totalMensual}
            />

            <SummaryBox
              label="Total quincenal"
              value={totalQuincenal}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black text-slate-800">
              Alertas automáticas
            </p>

            <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
              La aplicación mostrará una alerta
              cuando Comida o Gas alcance el 90%
              del límite mensual o quincenal
              guardado aquí.
            </p>
          </div>

          {errorLocal && (
            <p
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700"
            >
              {errorLocal}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="h-12 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              {guardando
                ? "Guardando..."
                : "Guardar límites"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

interface LimitInputProps {
  id: string;
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: string) => void;
}

function LimitInput({
  id,
  label,
  value,
  disabled,
  onChange,
}: LimitInputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-black text-slate-700"
      >
        {label}
      </label>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
          $
        </span>

        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          disabled={disabled}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-8 pr-4 text-sm font-black text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </div>
  );
}

interface SummaryBoxProps {
  label: string;
  value: number;
}

function SummaryBox({
  label,
  value,
}: SummaryBoxProps) {
  return (
    <div className="rounded-2xl bg-slate-900 p-3 text-white">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-base font-black">
        {formatoMoneda.format(value)}
      </p>
    </div>
  );
}