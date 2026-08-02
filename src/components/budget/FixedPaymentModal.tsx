"use client";

import {
  CalendarDays,
  CreditCard,
  FileText,
  Hash,
  Landmark,
  LoaderCircle,
  Wallet,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { METODOS_PAGO } from "@/lib/budget/constants";

import type {
  CompromisoFijo,
  MetodoPagoFijo,
  NuevoPagoFijo,
  PeriodicidadPagoFijo,
  Quincena,
} from "@/lib/budget/types";

import {
  fechaParaPeriodo,
  formatoMoneda,
  montoSeguro,
} from "@/lib/budget/utils";

type OpcionMontoPago =
  | "total"
  | "mitad"
  | "otro";

interface FixedPaymentModalProps {
  compromiso: CompromisoFijo | null;
  montoPendiente?: number;
  mesSeleccionado: string;
  quincenaSeleccionada: Quincena;
  guardando: boolean;
  onCerrar: () => void;
  onRegistrar: (
    pago: NuevoPagoFijo,
  ) => Promise<boolean>;
}

export function FixedPaymentModal({
  compromiso,
  montoPendiente,
  mesSeleccionado,
  quincenaSeleccionada,
  guardando,
  onCerrar,
  onRegistrar,
}: FixedPaymentModalProps) {
  const [opcionMonto, setOpcionMonto] =
    useState<OpcionMontoPago>("total");

  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [metodo, setMetodo] =
    useState<MetodoPagoFijo>("transferencia");

  const [periodicidad, setPeriodicidad] =
    useState<PeriodicidadPagoFijo>(
      "mensual",
    );

  const [referencia, setReferencia] =
    useState("");

  const [notas, setNotas] = useState("");

  const [errorLocal, setErrorLocal] =
    useState<string | null>(null);

  useEffect(() => {
    if (!compromiso) {
      return;
    }

    const totalPendiente =
      typeof montoPendiente === "number" &&
        Number.isFinite(montoPendiente)
        ? Math.max(montoPendiente, 0)
        : compromiso.monto;

    setOpcionMonto("total");

    setMonto(
      totalPendiente.toFixed(2),
    );

    setFecha(
      fechaParaPeriodo(
        mesSeleccionado,
        quincenaSeleccionada,
      ),
    );

    setMetodo("transferencia");
    setPeriodicidad("mensual");
    setReferencia("");
    setNotas("");
    setErrorLocal(null);
  }, [
    compromiso,
    montoPendiente,
    mesSeleccionado,
    quincenaSeleccionada,
  ]);

  useEffect(() => {
    if (!compromiso) {
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
  }, [
    compromiso,
    guardando,
    onCerrar,
  ]);

  if (!compromiso) {
    return null;
  }

  const totalPendiente =
    typeof montoPendiente === "number" &&
      Number.isFinite(montoPendiente)
      ? Math.max(montoPendiente, 0)
      : compromiso.monto;

  const mitadPendiente =
    Math.round(
      (totalPendiente / 2) * 100,
    ) / 100;

  const seleccionarMonto = (
    opcion: OpcionMontoPago,
  ) => {
    setOpcionMonto(opcion);
    setErrorLocal(null);

    if (opcion === "total") {
      setMonto(
        totalPendiente.toFixed(2),
      );
      return;
    }

    if (opcion === "mitad") {
      setMonto(
        mitadPendiente.toFixed(2),
      );
      return;
    }

    setMonto("");
  };

  const enviarFormulario = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setErrorLocal(null);

    const montoValidado =
      montoSeguro(monto);

    if (!montoValidado) {
      setErrorLocal(
        "Ingresa un monto mayor que cero.",
      );
      return;
    }

    if (!fecha) {
      setErrorLocal(
        "Selecciona la fecha del pago.",
      );
      return;
    }

    if (!fecha.startsWith(mesSeleccionado)) {
      setErrorLocal(
        "La fecha debe pertenecer al mes seleccionado.",
      );
      return;
    }

    const guardado = await onRegistrar({
      compromiso,
      monto: montoValidado,
      fecha,
      metodo,
      periodicidad,
      referencia,
      notas,
    });

    if (guardado) {
      onCerrar();
    }
  };

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
        aria-labelledby="fixed-payment-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">
              Pago o transferencia
            </p>

            <h2
              id="fixed-payment-modal-title"
              className="mt-1 text-xl font-black text-slate-900"
            >
              {compromiso.descripcion}
            </h2>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              Compromiso mensual de{" "}
              {formatoMoneda.format(
                compromiso.monto,
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            aria-label="Cerrar formulario"
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
          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-xs font-black text-slate-700">
              <Wallet className="h-3.5 w-3.5 text-slate-400" />
              Monto a pagar
            </legend>

            <div className="grid gap-2 sm:grid-cols-3">
              <AmountOption
                id="pago-fijo-monto-total"
                name="pago-fijo-opcion-monto"
                label="Total"
                amount={totalPendiente}
                checked={opcionMonto === "total"}
                disabled={guardando}
                onChange={() =>
                  seleccionarMonto("total")
                }
              />

              <AmountOption
                id="pago-fijo-monto-mitad"
                name="pago-fijo-opcion-monto"
                label="Mitad"
                amount={mitadPendiente}
                checked={opcionMonto === "mitad"}
                disabled={guardando}
                onChange={() =>
                  seleccionarMonto("mitad")
                }
              />

              <AmountOption
                id="pago-fijo-monto-otro"
                name="pago-fijo-opcion-monto"
                label="Otro"
                checked={opcionMonto === "otro"}
                disabled={guardando}
                onChange={() =>
                  seleccionarMonto("otro")
                }
              />
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            {opcionMonto === "otro" ? (
              <Field
                id="pago-fijo-monto"
                label="Otro monto"
                icon={Wallet}
              >
                <input
                  id="pago-fijo-monto"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={monto}
                  onChange={(event) =>
                    setMonto(
                      event.target.value,
                    )
                  }
                  placeholder="Escribe el monto"
                  autoFocus
                  disabled={guardando}
                  className={inputClassName}
                />
              </Field>
            ) : (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500">
                  Monto seleccionado
                </p>

                <p className="mt-1 text-lg font-black text-indigo-950">
                  {formatoMoneda.format(
                    montoSeguro(monto) ?? 0,
                  )}
                </p>
              </div>
            )}

            <Field
              id="pago-fijo-fecha"
              label="Fecha"
              icon={CalendarDays}
            >
              <input
                id="pago-fijo-fecha"
                type="date"
                value={fecha}
                onChange={(event) =>
                  setFecha(
                    event.target.value,
                  )
                }
                disabled={guardando}
                className={inputClassName}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="pago-fijo-metodo"
              label="Método"
              icon={CreditCard}
            >
              <select
                id="pago-fijo-metodo"
                value={metodo}
                onChange={(event) =>
                  setMetodo(
                    event.target
                      .value as MetodoPagoFijo,
                  )
                }
                disabled={guardando}
                className={inputClassName}
              >
                {Object.entries(
                  METODOS_PAGO,
                ).map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field
              id="pago-fijo-periodicidad"
              label="Control del pago"
              icon={Landmark}
            >
              <select
                id="pago-fijo-periodicidad"
                value={periodicidad}
                onChange={(event) =>
                  setPeriodicidad(
                    event.target
                      .value as PeriodicidadPagoFijo,
                  )
                }
                disabled={guardando}
                className={inputClassName}
              >
                <option value="mensual">
                  Pago mensual
                </option>

                <option value="quincenal">
                  Pago quincenal
                </option>
              </select>
            </Field>
          </div>

          <Field
            id="pago-fijo-referencia"
            label="Confirmación o referencia"
            icon={Hash}
            optional
          >
            <input
              id="pago-fijo-referencia"
              type="text"
              value={referencia}
              onChange={(event) =>
                setReferencia(
                  event.target.value,
                )
              }
              placeholder="Ej. 083729 o AMEX-2026-07"
              disabled={guardando}
              className={inputClassName}
            />
          </Field>

          <Field
            id="pago-fijo-notas"
            label="Notas"
            icon={FileText}
            optional
          >
            <textarea
              id="pago-fijo-notas"
              value={notas}
              onChange={(event) =>
                setNotas(
                  event.target.value,
                )
              }
              placeholder="Detalles adicionales del pago"
              rows={3}
              disabled={guardando}
              className={`${inputClassName} min-h-24 resize-y py-3`}
            />
          </Field>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
            <p className="text-xs font-black text-indigo-900">
              Período seleccionado
            </p>

            <p className="mt-1 text-[11px] font-semibold leading-relaxed text-indigo-700">
              Este pago se registrará para{" "}
              <strong>
                {mesSeleccionado}
              </strong>
              . La fecha seleccionada determinará
              si corresponde a la primera o segunda
              quincena.
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
                <Landmark className="h-4 w-4" />
              )}

              {guardando
                ? "Guardando..."
                : "Registrar pago"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

interface AmountOptionProps {
  id: string;
  name: string;
  label: string;
  amount?: number;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}

function AmountOption({
  id,
  name,
  label,
  amount,
  checked,
  disabled,
  onChange,
}: AmountOptionProps) {
  return (
    <label
      htmlFor={id}
      className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 transition ${checked
          ? "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100"
          : "border-slate-200 bg-slate-50 hover:border-indigo-200 hover:bg-white"
        } ${disabled
          ? "cursor-not-allowed opacity-60"
          : ""
        }`}
    >
      <input
        id={id}
        name={name}
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="h-4 w-4 shrink-0 accent-indigo-600"
      />

      <span className="min-w-0">
        <span className="block text-xs font-black text-slate-800">
          {label}
        </span>

        {typeof amount === "number" ? (
          <span className="mt-0.5 block text-[11px] font-bold text-slate-500">
            {formatoMoneda.format(amount)}
          </span>
        ) : (
          <span className="mt-0.5 block text-[11px] font-semibold text-slate-400">
            Escribir cantidad
          </span>
        )}
      </span>
    </label>
  );
}

interface FieldProps {
  id: string;
  label: string;
  icon: typeof Wallet;
  optional?: boolean;
  children: ReactNode;
}

function Field({
  id,
  label,
  icon: Icono,
  optional = false,
  children,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-slate-700"
      >
        <Icono className="h-3.5 w-3.5 text-slate-400" />

        {label}

        {optional && (
          <span className="font-semibold text-slate-400">
            (opcional)
          </span>
        )}
      </label>

      {children}
    </div>
  );
}

const inputClassName =
  "h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60";