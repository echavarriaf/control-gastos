import {
  LoaderCircle,
  Save,
} from "lucide-react";

import type {
  Dispatch,
  FormEvent,
  SetStateAction,
} from "react";

import Campo from "../Campo";

import {
  METODOS_PAGO,
} from "@/lib/budget/constants";

import type {
  MetodoPagoFijo,
  PrioridadPago,
  Quincena,
} from "@/lib/budget/types";

interface FormularioCompromiso {
  descripcion: string;
  monto: string;
  diaVencimiento: string;
  quincenaPresupuestaria: Quincena;
  prioridad: PrioridadPago;
  metodoPagoPreferido: MetodoPagoFijo;
  tarjetaId: string;
  activo: boolean;
}

interface FormularioCompromisoFijoProps {
  formulario: FormularioCompromiso;

  setFormulario: Dispatch<
    SetStateAction<FormularioCompromiso>
  >;

  errorLocal: string | null;
  editando: boolean;
  procesando: boolean;

  onCancelar: () => void;

  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
}

const PRIORIDADES: Array<{
  value: PrioridadPago;
  label: string;
}> = [
  {
    value: 1,
    label: "Alta",
  },
  {
    value: 2,
    label: "Media",
  },
  {
    value: 3,
    label: "Baja",
  },
];

const OPCIONES_METODO =
  Object.entries(
    METODOS_PAGO,
  ) as Array<
    [
      MetodoPagoFijo,
      string,
    ]
  >;

const INPUT_CLASS =
  "min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60";

function FormularioCompromisoFijo({
  formulario,
  setFormulario,
  errorLocal,
  editando,
  procesando,
  onCancelar,
  onSubmit,
}: FormularioCompromisoFijoProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5"
    >
      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5">
        <Campo
          label="Descripción"
          className="sm:col-span-2"
        >
          <input
            type="text"
            value={
              formulario.descripcion
            }
            onChange={(event) =>
              setFormulario(
                (actual) => ({
                  ...actual,
                  descripcion:
                    event.target.value,
                }),
              )
            }
            disabled={procesando}
            maxLength={250}
            placeholder="Ej. Pago del vehículo"
            className={INPUT_CLASS}
          />
        </Campo>

        <Campo label="Monto mensual">
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={formulario.monto}
            onChange={(event) =>
              setFormulario(
                (actual) => ({
                  ...actual,
                  monto:
                    event.target.value,
                }),
              )
            }
            disabled={procesando}
            placeholder="0.00"
            className={INPUT_CLASS}
          />
        </Campo>

        <Campo label="Día de vencimiento">
          <input
            type="number"
            min="1"
            max="31"
            step="1"
            inputMode="numeric"
            value={
              formulario
                .diaVencimiento
            }
            onChange={(event) =>
              setFormulario(
                (actual) => ({
                  ...actual,
                  diaVencimiento:
                    event.target.value,
                }),
              )
            }
            disabled={procesando}
            className={INPUT_CLASS}
          />
        </Campo>

        <Campo label="Quincena presupuestaria">
          <select
            value={
              formulario
                .quincenaPresupuestaria
            }
            onChange={(event) =>
              setFormulario(
                (actual) => ({
                  ...actual,
                  quincenaPresupuestaria:
                    Number(
                      event.target.value,
                    ) as Quincena,
                }),
              )
            }
            disabled={procesando}
            className={INPUT_CLASS}
          >
            <option value={1}>
              Primera quincena
            </option>

            <option value={2}>
              Segunda quincena
            </option>
          </select>
        </Campo>

        <Campo label="Prioridad">
          <select
            value={formulario.prioridad}
            onChange={(event) =>
              setFormulario(
                (actual) => ({
                  ...actual,
                  prioridad:
                    Number(
                      event.target.value,
                    ) as PrioridadPago,
                }),
              )
            }
            disabled={procesando}
            className={INPUT_CLASS}
          >
            {PRIORIDADES.map(
              (prioridad) => (
                <option
                  key={prioridad.value}
                  value={prioridad.value}
                >
                  {prioridad.label}
                </option>
              ),
            )}
          </select>
        </Campo>

        <Campo
          label="Método de pago preferido"
          className="sm:col-span-2"
        >
          <select
            value={
              formulario
                .metodoPagoPreferido
            }
            onChange={(event) =>
              setFormulario(
                (actual) => ({
                  ...actual,
                  metodoPagoPreferido:
                    event.target
                      .value as MetodoPagoFijo,
                }),
              )
            }
            disabled={procesando}
            className={INPUT_CLASS}
          >
            {OPCIONES_METODO.map(
              ([
                value,
                label,
              ]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              ),
            )}
          </select>
        </Campo>

        {formulario
          .metodoPagoPreferido ===
          "tarjeta" && (
          <Campo
            label="Tarjeta"
            className="sm:col-span-2"
            helper="Por ahora puedes escribir Walmart, Costco u otra tarjeta. Más adelante este campo se conectará al administrador de tarjetas."
          >
            <input
              type="text"
              value={
                formulario.tarjetaId
              }
              onChange={(event) =>
                setFormulario(
                  (actual) => ({
                    ...actual,
                    tarjetaId:
                      event.target.value,
                  }),
                )
              }
              disabled={procesando}
              maxLength={100}
              placeholder="Ej. Walmart"
              className={INPUT_CLASS}
            />
          </Campo>
        )}
      </div>

      {errorLocal && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
        >
          {errorLocal}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancelar}
          disabled={procesando}
          className="min-h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={procesando}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {procesando ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}

          {procesando
            ? "Guardando..."
            : editando
              ? "Guardar cambios"
              : "Crear gasto fijo"}
        </button>
      </div>
    </form>
  );
}

export default FormularioCompromisoFijo;