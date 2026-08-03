"use client";

import {
  CalendarClock,
  CreditCard,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ReceiptText,
} from "lucide-react";

import type {
  EstrategiaPagoTarjeta,
  TarjetaCredito,
} from "@/lib/budget/types";

import {
  formatoMoneda,
} from "@/lib/budget/utils";

interface CreditCardsListProps {
  tarjetas: TarjetaCredito[];
  cargando: boolean;
  procesando: boolean;
  actualizandoId: string | null;

  onCrear: () => void;

  onEditar: (
    tarjeta: TarjetaCredito,
  ) => void;

  onAlternarEstado: (
    tarjeta: TarjetaCredito,
  ) => void;
}

/**
 * TARJETAS - 1. Traduce la estrategia técnica
 * a una etiqueta clara para la interfaz.
 */
const ETIQUETAS_ESTRATEGIA:
  Record<
    EstrategiaPagoTarjeta,
    string
  > = {
    saldo_completo:
      "Pagar saldo completo",

    pago_objetivo:
      "Pago objetivo",

    pago_minimo:
      "Pago mínimo",
  };

/**
 * TARJETAS - 2. Construye una referencia visible
 * sin mostrar números completos de la tarjeta.
 */
function obtenerReferenciaTarjeta(
  tarjeta: TarjetaCredito,
): string {
  return tarjeta.ultimosCuatro
    ? `•••• ${tarjeta.ultimosCuatro}`
    : "Sin últimos cuatro";
}

/**
 * TARJETAS - 3. Presenta las tarjetas y permite
 * crear, editar, activar o desactivar registros.
 */
function CreditCardsList({
  tarjetas,
  cargando,
  procesando,
  actualizandoId,
  onCrear,
  onEditar,
  onAlternarEstado,
}: CreditCardsListProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-black text-slate-900">
            Tarjetas administradas
          </h3>

          <p className="mt-1 text-xs font-medium text-slate-500">
            Las tarjetas desactivadas conservan su información e historial.
          </p>
        </div>

        <button
          type="button"
          onClick={onCrear}
          disabled={procesando}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Agregar tarjeta
        </button>
      </div>

      {cargando ? (
        <div className="flex min-h-48 items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="text-center">
            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-indigo-600" />

            <p className="mt-3 text-sm font-bold text-slate-600">
              Cargando tarjetas
            </p>
          </div>
        </div>
      ) : tarjetas.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <ReceiptText className="mx-auto h-9 w-9 text-slate-400" />

          <h3 className="mt-4 font-black text-slate-900">
            No hay tarjetas registradas
          </h3>

          <p className="mt-2 text-sm font-medium text-slate-500">
            Agrega Walmart, Costco u otra tarjeta para comenzar.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tarjetas.map(
            (tarjeta) => {
              const actualizando =
                actualizandoId ===
                tarjeta.id;

              return (
                <article
                  key={tarjeta.id}
                  className={`rounded-3xl border bg-white p-4 shadow-sm transition ${
                    tarjeta.activa
                      ? "border-slate-200"
                      : "border-slate-200 opacity-65"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-2xl bg-indigo-100 p-2 text-indigo-700">
                          <CreditCard className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <h4 className="truncate font-black text-slate-950">
                            {tarjeta.nombre}
                          </h4>

                          <p className="text-[11px] font-bold text-slate-500">
                            {obtenerReferenciaTarjeta(
                              tarjeta,
                            )}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                            tarjeta.activa
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {tarjeta.activa
                            ? "Activa"
                            : "Inactiva"}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                            Saldo inicial
                          </p>

                          <p className="mt-1 text-base font-black text-slate-900">
                            {formatoMoneda.format(
                              tarjeta.saldoInicial,
                            )}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-indigo-50 p-3">
                          <p className="text-[9px] font-black uppercase tracking-wider text-indigo-500">
                            Día de corte
                          </p>

                          <p className="mt-1 text-base font-black text-indigo-900">
                            Día {tarjeta.diaCorte}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-amber-50 p-3">
                          <p className="text-[9px] font-black uppercase tracking-wider text-amber-600">
                            Día de pago
                          </p>

                          <p className="mt-1 text-base font-black text-amber-900">
                            Día {tarjeta.diaPago}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Saldo desde{" "}
                          {tarjeta.fechaSaldoInicial}
                        </span>

                        <span>
                          {
                            ETIQUETAS_ESTRATEGIA[
                              tarjeta.estrategiaPago
                            ]
                          }
                        </span>

                        {tarjeta.limiteCredito !==
                          null && (
                          <span>
                            Límite{" "}
                            {formatoMoneda.format(
                              tarjeta.limiteCredito,
                            )}
                          </span>
                        )}

                        {tarjeta.pagoObjetivo !==
                          null && (
                          <span>
                            Objetivo{" "}
                            {formatoMoneda.format(
                              tarjeta.pagoObjetivo,
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onEditar(
                            tarjeta,
                          )
                        }
                        disabled={procesando}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onAlternarEstado(
                            tarjeta,
                          )
                        }
                        disabled={procesando}
                        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                          tarjeta.activa
                            ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {actualizando ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : tarjeta.activa ? (
                          <PowerOff className="h-3.5 w-3.5" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}

                        {tarjeta.activa
                          ? "Desactivar"
                          : "Activar"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

export default CreditCardsList;