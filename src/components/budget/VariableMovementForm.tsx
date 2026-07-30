"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  LoaderCircle,
  Plus,
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
  CategoriaPago,
  CategoriaVariable,
  NuevoMovimiento,
  Quincena,
  TipoMovimiento,
} from "@/lib/budget/types";

import {
  fechaParaPeriodo,
  montoSeguro,
} from "@/lib/budget/utils";

interface VariableMovementFormProps {
  mesSeleccionado: string;
  quincenaSeleccionada: Quincena;
  guardando: boolean;
  onRegistrar: (
    movimiento: NuevoMovimiento,
  ) => Promise<boolean>;
}

export function VariableMovementForm({
  mesSeleccionado,
  quincenaSeleccionada,
  guardando,
  onRegistrar,
}: VariableMovementFormProps) {
  const [tipo, setTipo] =
    useState<TipoMovimiento>("gasto");

  const [concepto, setConcepto] =
    useState("");

  const [monto, setMonto] =
    useState("");

  const [categoriaGasto, setCategoriaGasto] =
    useState<CategoriaVariable>("comida");

  const [categoriaPago, setCategoriaPago] =
    useState<CategoriaPago>("general");

  const [fecha, setFecha] = useState(() =>
    fechaParaPeriodo(
      mesSeleccionado,
      quincenaSeleccionada,
    ),
  );

  const [errorLocal, setErrorLocal] =
    useState<string | null>(null);

  useEffect(() => {
    setFecha(
      fechaParaPeriodo(
        mesSeleccionado,
        quincenaSeleccionada,
      ),
    );
  }, [
    mesSeleccionado,
    quincenaSeleccionada,
  ]);

  const enviarFormulario = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setErrorLocal(null);

    const montoValidado = montoSeguro(monto);

    if (!concepto.trim()) {
      setErrorLocal(
        "Escribe una descripción para el movimiento.",
      );
      return;
    }

    if (!montoValidado) {
      setErrorLocal(
        "Ingresa un monto mayor que cero.",
      );
      return;
    }

    if (!fecha) {
      setErrorLocal(
        "Selecciona la fecha del movimiento.",
      );
      return;
    }

    const movimiento: NuevoMovimiento =
      tipo === "gasto"
        ? {
            tipo: "gasto",
            concepto: concepto.trim(),
            monto: montoValidado,
            categoria: categoriaGasto,
            fecha,
          }
        : {
            tipo: "pago",
            concepto: concepto.trim(),
            monto: montoValidado,
            categoria: categoriaPago,
            fecha,
          };

    const guardado =
      await onRegistrar(movimiento);

    if (!guardado) {
      return;
    }

    setConcepto("");
    setMonto("");
    setErrorLocal(null);
  };

  const esGasto = tipo === "gasto";

  return (
    <section
      aria-labelledby="variable-form-title"
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          Nuevo movimiento
        </p>

        <h2
          id="variable-form-title"
          className="mt-1 text-lg font-black text-slate-900"
        >
          Registrar Comida o Gas
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
        <TypeButton
          tipo="gasto"
          seleccionado={tipo === "gasto"}
          onSelect={setTipo}
        />

        <TypeButton
          tipo="pago"
          seleccionado={tipo === "pago"}
          onSelect={setTipo}
        />
      </div>

      <form
        onSubmit={enviarFormulario}
        className="mt-4 space-y-4"
      >
        <div>
          <label
            htmlFor="movimiento-concepto"
            className="mb-1.5 block text-xs font-black text-slate-700"
          >
            Descripción
          </label>

          <input
            id="movimiento-concepto"
            type="text"
            value={concepto}
            onChange={(event) =>
              setConcepto(event.target.value)
            }
            placeholder={
              esGasto
                ? "Ej. Supermercado o combustible"
                : "Ej. Pago tarjeta AMEX"
            }
            disabled={guardando}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="movimiento-monto"
              className="mb-1.5 block text-xs font-black text-slate-700"
            >
              Monto
            </label>

            <input
              id="movimiento-monto"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={monto}
              onChange={(event) =>
                setMonto(event.target.value)
              }
              placeholder="0.00"
              disabled={guardando}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="movimiento-fecha"
              className="mb-1.5 block text-xs font-black text-slate-700"
            >
              Fecha
            </label>

            <input
              id="movimiento-fecha"
              type="date"
              value={fecha}
              onChange={(event) =>
                setFecha(event.target.value)
              }
              disabled={guardando}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        {esGasto ? (
          <fieldset>
            <legend className="mb-2 text-xs font-black text-slate-700">
              Categoría del gasto
            </legend>

            <div className="grid grid-cols-2 gap-2">
              {CATEGORIA_KEYS.map((key) => {
                const configuracion =
                  CATEGORIAS_VARIABLES[key];

                const Icono =
                  configuracion.icon;

                const seleccionada =
                  categoriaGasto === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setCategoriaGasto(key)
                    }
                    disabled={guardando}
                    aria-pressed={seleccionada}
                    className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                      seleccionada
                        ? `${configuracion.color} border-transparent text-white shadow-sm`
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icono className="h-4 w-4" />
                    {configuracion.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <div>
            <label
              htmlFor="pago-categoria"
              className="mb-1.5 block text-xs font-black text-slate-700"
            >
              Aplicar el pago a
            </label>

            <select
              id="pago-categoria"
              value={categoriaPago}
              onChange={(event) =>
                setCategoriaPago(
                  event.target
                    .value as CategoriaPago,
                )
              }
              disabled={guardando}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="general">
                Saldo variable general
              </option>

              {CATEGORIA_KEYS.map((key) => (
                <option key={key} value={key}>
                  {
                    CATEGORIAS_VARIABLES[key]
                      .label
                  }
                </option>
              ))}
            </select>

            <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-slate-500">
              Un pago general reduce el saldo
              combinado de Comida y Gas. Un pago
              por categoría aumenta nuevamente el
              disponible de esa categoría.
            </p>
          </div>
        )}

        {errorLocal && (
          <p
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700"
          >
            {errorLocal}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
            esGasto
              ? "bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700"
              : "bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700"
          }`}
        >
          {guardando ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}

          {guardando
            ? "Guardando..."
            : esGasto
              ? "Registrar gasto"
              : "Registrar pago"}
        </button>
      </form>
    </section>
  );
}

interface TypeButtonProps {
  tipo: TipoMovimiento;
  seleccionado: boolean;
  onSelect: (tipo: TipoMovimiento) => void;
}

function TypeButton({
  tipo,
  seleccionado,
  onSelect,
}: TypeButtonProps) {
  const esGasto = tipo === "gasto";

  const Icono = esGasto
    ? ArrowDownCircle
    : ArrowUpCircle;

  return (
    <button
      type="button"
      onClick={() => onSelect(tipo)}
      aria-pressed={seleccionado}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition active:scale-[0.98] ${
        seleccionado
          ? esGasto
            ? "bg-white text-indigo-700 shadow-sm"
            : "bg-white text-emerald-700 shadow-sm"
          : "text-slate-500 hover:text-slate-800"
      }`}
    >
      <Icono
        aria-hidden="true"
        className="h-4 w-4"
      />

      {esGasto ? "Gasto" : "Pago"}
    </button>
  );
}