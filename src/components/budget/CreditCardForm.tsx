"use client";

import {
  ArrowLeft,
  CreditCard,
  LoaderCircle,
  Save,
} from "lucide-react";

import type {
  Dispatch,
  FormEvent,
  SetStateAction,
} from "react";

import Campo from "../Campo";

import type {
  EstrategiaPagoTarjeta,
} from "@/lib/budget/types";

export interface CreditCardFormValues {
  nombre: string;
  ultimosCuatro: string;

  saldoInicial: string;
  fechaSaldoInicial: string;

  diaCorte: string;
  diaPago: string;

  estrategiaPago:
    EstrategiaPagoTarjeta;

  pagoObjetivo: string;
  limiteCredito: string;

  notas: string;
  activa: boolean;
}

interface CreditCardFormProps {
  titulo: string;
  descripcion: string;

  formulario:
    CreditCardFormValues;

  setFormulario:
    Dispatch<
      SetStateAction<
        CreditCardFormValues
      >
    >;

  error: string | null;
  guardando: boolean;
  editando: boolean;

  onVolver: () => void;

  onSubmit: (
    event:
      FormEvent<HTMLFormElement>,
  ) => void;
}

const INPUT_CLASS =
  "min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

/**
 * TARJETAS - 1. Define las estrategias disponibles
 * para el pago mensual de cada tarjeta.
 */
const ESTRATEGIAS: Array<{
  value: EstrategiaPagoTarjeta;
  label: string;
  helper: string;
}> = [
  {
    value: "saldo_completo",
    label: "Saldo completo",
    helper:
      "Planifica pagar todo el saldo registrado.",
  },
  {
    value: "pago_objetivo",
    label: "Pago objetivo",
    helper:
      "Utiliza un monto mensual definido por ti.",
  },
  {
    value: "pago_minimo",
    label: "Pago mínimo",
    helper:
      "Registra solamente el pago mínimo requerido.",
  },
];

/**
 * TARJETAS - 2. Actualiza un campo sin duplicar
 * la lógica de estado en cada control.
 */
function actualizarCampo<
  K extends keyof CreditCardFormValues,
>(
  setFormulario:
    CreditCardFormProps["setFormulario"],

  campo: K,
  valor:
    CreditCardFormValues[K],
) {
  setFormulario(
    (actual) => ({
      ...actual,
      [campo]: valor,
    }),
  );
}

/**
 * TARJETAS - 3. Captura la información financiera,
 * las fechas y la estrategia de pago.
 */
function CreditCardForm({
  titulo,
  descripcion,
  formulario,
  setFormulario,
  error,
  guardando,
  editando,
  onVolver,
  onSubmit,
}: CreditCardFormProps) {
  const usaPagoObjetivo =
    formulario
      .estrategiaPago ===
    "pago_objetivo";

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onVolver}
          disabled={guardando}
          aria-label="Volver a la lista"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
              <CreditCard className="h-4 w-4" />
            </div>

            <h3 className="font-black text-slate-950">
              {titulo}
            </h3>
          </div>

          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
            {descripcion}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Nombre"
          helper="Ejemplo: Walmart o Costco."
        >
          <input
            type="text"
            value={formulario.nombre}
            onChange={(event) =>
              actualizarCampo(
                setFormulario,
                "nombre",
                event.target.value,
              )
            }
            placeholder="Nombre de la tarjeta"
            maxLength={100}
            disabled={guardando}
            className={INPUT_CLASS}
            required
          />
        </Campo>

        <Campo
          label="Últimos cuatro"
          helper="Opcional. Nunca guardes el número completo."
        >
          <input
            type="text"
            inputMode="numeric"
            value={
              formulario
                .ultimosCuatro
            }
            onChange={(event) =>
              actualizarCampo(
                setFormulario,
                "ultimosCuatro",
                event.target.value
                  .replace(
                    /\D/g,
                    "",
                  )
                  .slice(
                    0,
                    4,
                  ),
              )
            }
            placeholder="1234"
            maxLength={4}
            disabled={guardando}
            className={INPUT_CLASS}
          />
        </Campo>

        <Campo
          label="Saldo inicial"
          helper="Saldo actual desde la fecha indicada."
        >
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={
              formulario
                .saldoInicial
            }
            onChange={(event) =>
              actualizarCampo(
                setFormulario,
                "saldoInicial",
                event.target.value,
              )
            }
            placeholder="0.00"
            disabled={guardando}
            className={INPUT_CLASS}
            required
          />
        </Campo>

        <Campo
          label="Fecha del saldo"
          helper="Punto de partida para calcular el saldo futuro."
        >
          <input
            type="date"
            value={
              formulario
                .fechaSaldoInicial
            }
            onChange={(event) =>
              actualizarCampo(
                setFormulario,
                "fechaSaldoInicial",
                event.target.value,
              )
            }
            disabled={guardando}
            className={INPUT_CLASS}
            required
          />
        </Campo>

        <Campo
          label="Día de corte"
          helper="Día del mes en que cierra el estado."
        >
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            step="1"
            value={
              formulario.diaCorte
            }
            onChange={(event) =>
              actualizarCampo(
                setFormulario,
                "diaCorte",
                event.target.value,
              )
            }
            disabled={guardando}
            className={INPUT_CLASS}
            required
          />
        </Campo>

        <Campo
          label="Día de pago"
          helper="Fecha límite habitual del pago."
        >
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            step="1"
            value={
              formulario.diaPago
            }
            onChange={(event) =>
              actualizarCampo(
                setFormulario,
                "diaPago",
                event.target.value,
              )
            }
            disabled={guardando}
            className={INPUT_CLASS}
            required
          />
        </Campo>

        <Campo
          label="Límite de crédito"
          helper="Opcional. Se usará para calcular utilización."
        >
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={
              formulario
                .limiteCredito
            }
            onChange={(event) =>
              actualizarCampo(
                setFormulario,
                "limiteCredito",
                event.target.value,
              )
            }
            placeholder="Opcional"
            disabled={guardando}
            className={INPUT_CLASS}
          />
        </Campo>

        <Campo
          label="Estrategia de pago"
          helper="Determina cómo se planificará el pago."
        >
          <select
            value={
              formulario
                .estrategiaPago
            }
            onChange={(event) =>
              actualizarCampo(
                setFormulario,
                "estrategiaPago",
                event.target
                  .value as EstrategiaPagoTarjeta,
              )
            }
            disabled={guardando}
            className={INPUT_CLASS}
          >
            {ESTRATEGIAS.map(
              (estrategia) => (
                <option
                  key={
                    estrategia.value
                  }
                  value={
                    estrategia.value
                  }
                >
                  {estrategia.label}
                </option>
              ),
            )}
          </select>
        </Campo>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {ESTRATEGIAS.map(
          (estrategia) => {
            const seleccionada =
              formulario
                .estrategiaPago ===
              estrategia.value;

            return (
              <button
                key={estrategia.value}
                type="button"
                onClick={() =>
                  actualizarCampo(
                    setFormulario,
                    "estrategiaPago",
                    estrategia.value,
                  )
                }
                disabled={guardando}
                className={`rounded-2xl border p-3 text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                  seleccionada
                    ? "border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <p
                  className={`text-xs font-black ${
                    seleccionada
                      ? "text-indigo-800"
                      : "text-slate-800"
                  }`}
                >
                  {estrategia.label}
                </p>

                <p className="mt-1 text-[10px] font-medium leading-relaxed text-slate-500">
                  {estrategia.helper}
                </p>
              </button>
            );
          },
        )}
      </div>

      {usaPagoObjetivo && (
        <Campo
          label="Pago objetivo mensual"
          helper="Monto que deseas pagar cada mes."
        >
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={
              formulario
                .pagoObjetivo
            }
            onChange={(event) =>
              actualizarCampo(
                setFormulario,
                "pagoObjetivo",
                event.target.value,
              )
            }
            placeholder="0.00"
            disabled={guardando}
            className={INPUT_CLASS}
            required
          />
        </Campo>
      )}

      <Campo
        label="Notas"
        helper="Información opcional sobre la tarjeta."
      >
        <textarea
          value={formulario.notas}
          onChange={(event) =>
            actualizarCampo(
              setFormulario,
              "notas",
              event.target.value,
            )
          }
          placeholder="Ejemplo: tarjeta usada para comida o gasolina."
          maxLength={1000}
          disabled={guardando}
          rows={4}
          className={`${INPUT_CLASS} resize-y py-3`}
        />
      </Campo>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-sm font-black text-slate-900">
            Tarjeta activa
          </p>

          <p className="mt-1 text-xs font-medium text-slate-500">
            Las tarjetas inactivas no aparecerán como opciones de uso.
          </p>
        </div>

        <input
          type="checkbox"
          checked={formulario.activa}
          onChange={(event) =>
            actualizarCampo(
              setFormulario,
              "activa",
              event.target.checked,
            )
          }
          disabled={guardando}
          className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      </label>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onVolver}
          disabled={guardando}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={guardando}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}

          {guardando
            ? "Guardando..."
            : editando
              ? "Guardar cambios"
              : "Crear tarjeta"}
        </button>
      </div>
    </form>
  );
}

export default CreditCardForm;