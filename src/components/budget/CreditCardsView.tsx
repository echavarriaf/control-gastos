"use client";

/*
 * Nombre: Vista financiera de tarjetas
 * Ruta: src/components/budget/CreditCardsView.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-08-02
 *
 * Descripción:
 * Presenta el saldo actual, compras, pagos, crédito disponible
 * y porcentaje utilizado de cada tarjeta. Recibe los cálculos
 * preparados por useCreditCardSummaries y permite abrir el
 * administrador para crear o editar tarjetas.
 */

import {
  CalendarClock,
  CreditCard,
  LoaderCircle,
  Settings2,
  ShoppingCart,
  WalletCards,
} from "lucide-react";

import type {
  ResumenTarjetaActual,
} from "@/hooks/useCreditCardSummaries";

import {
  formatoMoneda,
} from "@/lib/budget/utils";

interface CreditCardsViewProps {
  resumenes:
    ResumenTarjetaActual[];

  totalSaldoActual:
    number;

  totalCompras:
    number;

  totalPagos:
    number;

  cargando:
    boolean;

  onConfigurar:
    () => void;
}

interface SummaryMetricProps {
  label:
    string;

  value:
    number;

  icon:
    typeof WalletCards;

  detail?:
    string;
}

interface CreditCardSummaryCardProps {
  resumen:
    ResumenTarjetaActual;
}

/**
 * Convierte la estrategia interna de pago en un texto entendible.
 *
 * Compara el valor configurado en la tarjeta con las estrategias
 * admitidas y devuelve la etiqueta que debe mostrarse en pantalla.
 */
function obtenerEtiquetaEstrategia(
  estrategia:
    ResumenTarjetaActual[
      "tarjeta"
    ][
      "estrategiaPago"
    ],
): string {
  switch (estrategia) {
    case "saldo_completo":
      return "Pagar saldo completo";

    case "pago_objetivo":
      return "Pago objetivo";

    case "pago_minimo":
      return "Pago mínimo";
  }
}

/**
 * Devuelve los estilos visuales según el porcentaje utilizado.
 *
 * Usa niveles de advertencia para distinguir una utilización normal,
 * elevada o crítica del límite de crédito de la tarjeta.
 */
function obtenerEstiloUtilizacion(
  porcentaje:
    number,
): {
  barra:
    string;

  texto:
    string;
} {
  if (porcentaje >= 90) {
    return {
      barra:
        "bg-rose-500",
      texto:
        "text-rose-700",
    };
  }

  if (porcentaje >= 70) {
    return {
      barra:
        "bg-amber-400",
      texto:
        "text-amber-700",
    };
  }

  return {
    barra:
      "bg-emerald-500",
    texto:
      "text-emerald-700",
  };
}

/**
 * Renderiza la vista completa de tarjetas.
 *
 * Muestra un resumen general y luego crea una tarjeta visual por
 * cada resumen financiero recibido. Mientras los datos se cargan,
 * presenta un indicador; si no existen tarjetas, muestra un estado vacío.
 */
export function CreditCardsView({
  resumenes,
  totalSaldoActual,
  totalCompras,
  totalPagos,
  cargando,
  onConfigurar,
}: CreditCardsViewProps) {
  if (cargando) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-indigo-600" />

          <p className="mt-3 text-sm font-bold text-slate-600">
            Cargando tarjetas
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="tarjetas-title"
      className="space-y-5"
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Deuda y utilización
            </p>

            <h2
              id="tarjetas-title"
              className="mt-1 text-xl font-black text-slate-950"
            >
              Tarjetas de crédito
            </h2>

            <p className="mt-1 max-w-xl text-xs font-medium leading-relaxed text-slate-500">
              El saldo actual se calcula sumando las compras al saldo
              inicial y restando los pagos registrados.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onConfigurar
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            <Settings2 className="h-4 w-4" />
            Administrar
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryMetric
            label="Saldo total"
            value={
              totalSaldoActual
            }
            icon={
              WalletCards
            }
            detail="Deuda actual"
          />

          <SummaryMetric
            label="Compras"
            value={
              totalCompras
            }
            icon={
              ShoppingCart
            }
            detail="Desde los saldos iniciales"
          />

          <SummaryMetric
            label="Pagos"
            value={
              totalPagos
            }
            icon={
              CreditCard
            }
            detail="Aplicados a las tarjetas"
          />
        </div>
      </div>

      {resumenes.length ===
      0 ? (
        <EmptyState
          onConfigurar={
            onConfigurar
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {resumenes.map(
            (resumen) => (
              <CreditCardSummaryCard
                key={
                  resumen.tarjeta.id
                }
                resumen={
                  resumen
                }
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Muestra una métrica del resumen general.
 *
 * Recibe un monto, una etiqueta y un icono para mantener una
 * presentación uniforme entre saldo, compras y pagos.
 */
function SummaryMetric({
  label,
  value,
  icon: Icono,
  detail,
}: SummaryMetricProps) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icono className="h-4 w-4" />

        <p className="text-[10px] font-black uppercase tracking-wider">
          {label}
        </p>
      </div>

      <p className="mt-2 text-xl font-black text-slate-950">
        {formatoMoneda.format(
          value,
        )}
      </p>

      {detail && (
        <p className="mt-1 text-[11px] font-semibold text-slate-500">
          {detail}
        </p>
      )}
    </article>
  );
}

/**
 * Presenta el resumen financiero de una tarjeta.
 *
 * Muestra saldo, compras, pagos, fechas configuradas y límite.
 * Cuando existe límite de crédito, representa la utilización con
 * una barra cuyo ancho está limitado visualmente al cien por ciento.
 */
function CreditCardSummaryCard({
  resumen,
}: CreditCardSummaryCardProps) {
  const {
    tarjeta,
    comprasDesdeSaldo,
    pagosDesdeSaldo,
    saldoActual,
    creditoDisponible,
    porcentajeUtilizado,
  } = resumen;

  const estiloUtilizacion =
    porcentajeUtilizado ===
    null
      ? null
      : obtenerEstiloUtilizacion(
          porcentajeUtilizado,
        );

  const anchoBarra =
    porcentajeUtilizado ===
    null
      ? 0
      : Math.min(
          Math.max(
            porcentajeUtilizado,
            0,
          ),
          100,
        );

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${
        tarjeta.activa
          ? "border-slate-200"
          : "border-slate-200 opacity-65"
      }`}
    >
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-black">
                {
                  tarjeta.nombre
                }
              </h3>

              <span
                className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
                  tarjeta.activa
                    ? "bg-emerald-400/20 text-emerald-200"
                    : "bg-white/10 text-slate-300"
                }`}
              >
                {
                  tarjeta.activa
                    ? "Activa"
                    : "Inactiva"
                }
              </span>
            </div>

            <p className="mt-1 text-xs font-semibold text-slate-300">
              {tarjeta
                .ultimosCuatro
                ? `•••• ${tarjeta.ultimosCuatro}`
                : "Número no registrado"}
            </p>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <CreditCard className="h-5 w-5 text-indigo-200" />
          </div>
        </div>

        <div className="mt-6">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-indigo-300">
            Saldo actual
          </p>

          <p className="mt-1 text-3xl font-black tracking-tight">
            {formatoMoneda.format(
              saldoActual,
            )}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-slate-300">
          <span>
            Corte: día{" "}
            {
              tarjeta.diaCorte
            }
          </span>

          <span>
            Pago: día{" "}
            {
              tarjeta.diaPago
            }
          </span>

          <span>
            {
              obtenerEtiquetaEstrategia(
                tarjeta
                  .estrategiaPago,
              )
            }
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-rose-50 p-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-rose-600">
              Compras
            </p>

            <p className="mt-1 text-sm font-black text-rose-800">
              {formatoMoneda.format(
                comprasDesdeSaldo,
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600">
              Pagos
            </p>

            <p className="mt-1 text-sm font-black text-emerald-800">
              {formatoMoneda.format(
                pagosDesdeSaldo,
              )}
            </p>
          </div>
        </div>

        {porcentajeUtilizado !==
        null &&
        estiloUtilizacion &&
        creditoDisponible !==
          null ? (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Utilización
              </p>

              <p
                className={`text-xs font-black ${estiloUtilizacion.texto}`}
              >
                {porcentajeUtilizado.toFixed(
                  1,
                )}
                %
              </p>
            </div>

            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${estiloUtilizacion.barra}`}
                style={{
                  width:
                    `${anchoBarra}%`,
                }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
              <span>
                Límite{" "}
                {formatoMoneda.format(
                  tarjeta
                    .limiteCredito ??
                    0,
                )}
              </span>

              <span>
                Disponible{" "}
                {formatoMoneda.format(
                  creditoDisponible,
                )}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Límite no configurado
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-600">
              Agrega el límite para calcular crédito disponible
              y porcentaje utilizado.
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
          <CalendarClock className="h-4 w-4" />

          <span>
            Saldo inicial del{" "}
            {
              tarjeta
                .fechaSaldoInicial
            }
            :{" "}
            {formatoMoneda.format(
              tarjeta
                .saldoInicial,
            )}
          </span>
        </div>

        {tarjeta.notas && (
          <p className="mt-3 rounded-2xl bg-indigo-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-indigo-700">
            {
              tarjeta.notas
            }
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * Muestra una invitación cuando no existen tarjetas configuradas.
 *
 * El botón reutiliza la misma acción de administración para abrir
 * el modal y permitir que el usuario cree su primera tarjeta.
 */
function EmptyState({
  onConfigurar,
}: {
  onConfigurar:
    () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <CreditCard className="h-7 w-7" />
      </div>

      <h3 className="mt-4 text-base font-black text-slate-900">
        No hay tarjetas configuradas
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-relaxed text-slate-500">
        Agrega una tarjeta para controlar su saldo, compras,
        pagos y utilización del límite.
      </p>

      <button
        type="button"
        onClick={
          onConfigurar
        }
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.98]"
      >
        <Settings2 className="h-4 w-4" />
        Agregar tarjeta
      </button>
    </div>
  );
}