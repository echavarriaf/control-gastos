"use client";

/*
 * Nombre: Vista financiera de tarjetas
 * Ruta: src/components/budget/CreditCardsView.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-09-01
 *
 * Descripción:
 * Presenta saldo, compras, pagos, crédito disponible,
 * utilización y calendario de tarjetas.
 *
 * 1C.2A:
 * Próxima fecha de corte.
 *
 * 1C.2B:
 * Fecha objetivo cinco días antes.
 *
 * 1C.2C:
 * Monto total pendiente.
 *
 * 1C.2D:
 * Ventana de pago.
 *
 * 1C.2E:
 * Alerta PAGAR AHORA.
 *
 * 1C.2F:
 * Detecta que el pago principal fue cubierto.
 *
 * 1C.2G:
 * Separa las compras posteriores al pago principal
 * y muestra un PAGO ADICIONAL cuando queda deuda
 * nueva antes del corte.
 */

import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  LoaderCircle,
  PlusCircle,
  Settings2,
  ShoppingCart,
  WalletCards,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  ResumenTarjetaActual,
} from "@/hooks/useCreditCardSummaries";

import {
  calcularCalendarioPagoTarjeta,
  DIAS_ANTICIPACION_PAGO_TARJETA,
  evaluarVentanaPagoTarjeta,
  formatearFechaTarjeta,
  type EvaluacionVentanaPagoTarjeta,
} from "@/lib/budget/credit-card-payment-calendar";

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

  fechaReferencia:
    Date;
}

type TipoAlertaPagoTarjeta =
  | "principal"
  | "adicional";

interface AlertaPagoTarjeta {
  tarjetaId:
    string;

  nombre:
    string;

  ultimosCuatro:
    string;

  monto:
    number;

  tipo:
    TipoAlertaPagoTarjeta;

  evaluacion:
    EvaluacionVentanaPagoTarjeta;
}

function obtenerEtiquetaEstrategia(
  estrategia:
    ResumenTarjetaActual[
      "tarjeta"
    ][
      "estrategiaPago"
    ],
): string {
  switch (
    estrategia
  ) {
    case "saldo_completo":
      return "Pagar saldo completo";

    case "pago_objetivo":
      return "Pago objetivo";

    case "pago_minimo":
      return "Pago mínimo";
  }
}

function obtenerEstiloUtilizacion(
  porcentaje:
    number,
): {
  barra:
    string;

  texto:
    string;
} {
  if (
    porcentaje >=
    90
  ) {
    return {
      barra:
        "bg-rose-500",

      texto:
        "text-rose-700",
    };
  }

  if (
    porcentaje >=
    70
  ) {
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

function useFechaReferenciaActual(): Date {
  const [
    fechaReferencia,
    setFechaReferencia,
  ] =
    useState<Date>(
      () =>
        new Date(),
    );

  useEffect(
    () => {
      const intervalId =
        window.setInterval(
          () => {
            setFechaReferencia(
              new Date(),
            );
          },
          60_000,
        );

      return () => {
        window.clearInterval(
          intervalId,
        );
      };
    },
    [],
  );

  return fechaReferencia;
}

export function CreditCardsView({
  resumenes,
  totalSaldoActual,
  totalCompras,
  totalPagos,
  cargando,
  onConfigurar,
}: CreditCardsViewProps) {
  const fechaReferencia =
    useFechaReferenciaActual();

  /**
   * ============================================================
   * 1C.2E + 1C.2G
   * ALERTAS ACTIVAS
   * ============================================================
   *
   * Cada tarjeta puede tener:
   *
   * - pago principal pendiente;
   *
   * o
   *
   * - pago principal cubierto + pago adicional pendiente.
   *
   * Nunca mostramos ambos al mismo tiempo.
   */
  const alertasPago =
    useMemo(
      () =>
        resumenes.flatMap(
          (
            resumen,
          ): AlertaPagoTarjeta[] => {
            const {
              tarjeta,
              montoPagoTotal,
              corteCubierto,
              saldoAdicionalAntesCorte,
              requierePagoAdicionalAntesCorte,
            } =
              resumen;

            const calendario =
              calcularCalendarioPagoTarjeta(
                tarjeta.diaCorte,
                fechaReferencia,
              );

            /**
             * ==================================================
             * PAGO PRINCIPAL
             * ==================================================
             */
            if (
              !corteCubierto
            ) {
              const evaluacion =
                evaluarVentanaPagoTarjeta({
                  calendario,

                  montoPagoTotal,

                  activa:
                    tarjeta.activa,
                });

              if (
                evaluacion
                  .requiereAccion &&
                montoPagoTotal >
                  0
              ) {
                return [
                  {
                    tarjetaId:
                      tarjeta.id,

                    nombre:
                      tarjeta.nombre,

                    ultimosCuatro:
                      tarjeta
                        .ultimosCuatro,

                    monto:
                      montoPagoTotal,

                    tipo:
                      "principal",

                    evaluacion,
                  },
                ];
              }

              return [];
            }

            /**
             * ==================================================
             * 1C.2G
             * PAGO ADICIONAL
             * ==================================================
             */
            if (
              !requierePagoAdicionalAntesCorte ||
              saldoAdicionalAntesCorte <=
                0
            ) {
              return [];
            }

            const evaluacion =
              evaluarVentanaPagoTarjeta({
                calendario,

                montoPagoTotal:
                  saldoAdicionalAntesCorte,

                activa:
                  tarjeta.activa,
              });

            if (
              !evaluacion
                .requiereAccion
            ) {
              return [];
            }

            return [
              {
                tarjetaId:
                  tarjeta.id,

                nombre:
                  tarjeta.nombre,

                ultimosCuatro:
                  tarjeta
                    .ultimosCuatro,

                monto:
                  saldoAdicionalAntesCorte,

                tipo:
                  "adicional",

                evaluacion,
              },
            ];
          },
        ),
      [
        resumenes,
        fechaReferencia,
      ],
    );

  const totalPagosRequeridos =
    useMemo(
      () =>
        alertasPago.reduce(
          (
            total,
            alerta,
          ) =>
            total +
            alerta.monto,
          0,
        ),
      [
        alertasPago,
      ],
    );

  if (
    cargando
  ) {
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
      {alertasPago.length >
        0 && (
        <ResumenAlertasPago
          alertas={
            alertasPago
          }
          total={
            totalPagosRequeridos
          }
        />
      )}

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
              inicial y restando todos los pagos registrados.
            </p>

            <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-indigo-50 px-3 py-2 text-[11px] font-bold text-indigo-700">
              <CalendarCheck2 className="h-4 w-4 shrink-0" />

              <span>
                Objetivo: pagar el saldo completo{" "}
                {
                  DIAS_ANTICIPACION_PAGO_TARJETA
                }{" "}
                días antes de cada corte.
              </span>
            </div>
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
            detail="Monto pendiente conocido"
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
            (
              resumen,
            ) => (
              <CreditCardSummaryCard
                key={
                  resumen
                    .tarjeta
                    .id
                }
                resumen={
                  resumen
                }
                fechaReferencia={
                  fechaReferencia
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
 * ============================================================
 * RESUMEN GENERAL DE ALERTAS
 * ============================================================
 */
function ResumenAlertasPago({
  alertas,
  total,
}: {
  alertas:
    AlertaPagoTarjeta[];

  total:
    number;
}) {
  const existeCorteHoy =
    alertas.some(
      (
        alerta,
      ) =>
        alerta.evaluacion
          .estado ===
        "corte_hoy",
    );

  return (
    <section
      aria-live="polite"
      className={`overflow-hidden rounded-3xl border shadow-sm ${
        existeCorteHoy
          ? "border-rose-300 bg-rose-50"
          : "border-amber-300 bg-amber-50"
      }`}
    >
      <div
        className={`px-4 py-4 sm:px-5 ${
          existeCorteHoy
            ? "bg-rose-600 text-white"
            : "bg-amber-500 text-slate-950"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              existeCorteHoy
                ? "bg-white/15"
                : "bg-white/40"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em]">
              Pagos de tarjeta
            </p>

            <h2 className="mt-1 text-xl font-black">
              {alertas.length ===
              1
                ? "Hay un pago pendiente"
                : `Hay ${alertas.length} pagos pendientes`}
            </h2>

            <p
              className={`mt-1 text-xs font-semibold ${
                existeCorteHoy
                  ? "text-rose-100"
                  : "text-amber-950"
              }`}
            >
              Total requerido ahora:{" "}
              <span className="font-black">
                {formatoMoneda.format(
                  total,
                )}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {alertas.map(
          (
            alerta,
          ) => {
            const corteHoy =
              alerta
                .evaluacion
                .estado ===
              "corte_hoy";

            const adicional =
              alerta.tipo ===
              "adicional";

            return (
              <article
                key={`${alerta.tarjetaId}-${alerta.tipo}`}
                className="rounded-2xl border border-white bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CreditCard className="h-4 w-4 text-indigo-600" />

                      <p className="truncate text-sm font-black text-slate-900">
                        {
                          alerta.nombre
                        }

                        {alerta
                          .ultimosCuatro && (
                          <span className="ml-2 font-bold text-slate-400">
                            ••••{" "}
                            {
                              alerta
                                .ultimosCuatro
                            }
                          </span>
                        )}
                      </p>
                    </div>

                    <p
                      className={`mt-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                        corteHoy
                          ? "text-rose-600"
                          : adicional
                            ? "text-indigo-600"
                            : "text-amber-600"
                      }`}
                    >
                      {corteHoy
                        ? adicional
                          ? "Pago adicional · corte hoy"
                          : "Pagar hoy · corte hoy"
                        : adicional
                          ? "Pago adicional antes del corte"
                          : "Pagar ahora"}
                    </p>

                    <p className="mt-1 text-2xl font-black text-slate-950">
                      {formatoMoneda.format(
                        alerta.monto,
                      )}
                    </p>

                    {adicional && (
                      <p className="mt-1 text-[10px] font-semibold text-indigo-600">
                        Actividad registrada después de cubrir el pago principal.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3 sm:text-right">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Fecha de corte
                    </p>

                    <p className="mt-1 text-xs font-black text-slate-800">
                      {formatearFechaTarjeta(
                        alerta
                          .evaluacion
                          .fechaCorte,
                      )}
                    </p>
                  </div>
                </div>
              </article>
            );
          },
        )}
      </div>
    </section>
  );
}

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
          {
            label
          }
        </p>
      </div>

      <p className="mt-2 text-xl font-black text-slate-950">
        {formatoMoneda.format(
          value,
        )}
      </p>

      {detail && (
        <p className="mt-1 text-[11px] font-semibold text-slate-500">
          {
            detail
          }
        </p>
      )}
    </article>
  );
}

function EstadoVentanaPago({
  evaluacion,
}: {
  evaluacion:
    EvaluacionVentanaPagoTarjeta;
}) {
  switch (
    evaluacion.estado
  ) {
    case "inactiva":
      return (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-600">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />

          <p className="text-[11px] font-semibold leading-5">
            Tarjeta inactiva. No se generarán recordatorios de pago.
          </p>
        </div>
      );

    case "sin_saldo":
      return (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

          <p className="text-[11px] font-bold leading-5">
            Sin saldo pendiente para este corte.
          </p>
        </div>
      );

    case "corte_hoy":
      return (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

          <div>
            <p className="text-[11px] font-black leading-5">
              PAGAR HOY
            </p>

            <p className="text-[10px] font-semibold leading-5 text-rose-600">
              El corte es hoy y todavía existe saldo pendiente.
            </p>
          </div>
        </div>
      );

    case "pagar_ahora":
      return (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-800">
          <CalendarCheck2 className="mt-0.5 h-4 w-4 shrink-0" />

          <div>
            <p className="text-[11px] font-black leading-5">
              PAGAR AHORA
            </p>

            <p className="text-[10px] font-semibold leading-5 text-amber-700">
              {evaluacion
                .diasDesdeInicioVentana ===
              0
                ? "Hoy comienza la ventana de pago."
                : `La ventana comenzó hace ${evaluacion.diasDesdeInicioVentana} día${
                    evaluacion.diasDesdeInicioVentana ===
                    1
                      ? ""
                      : "s"
                  }.`}
            </p>
          </div>
        </div>
      );

    case "antes_de_ventana":
      return (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5 text-indigo-700">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />

          <p className="text-[11px] font-semibold leading-5">
            {evaluacion
              .diasParaAbrirVentana ===
            1
              ? "La ventana de pago abre mañana."
              : `La ventana de pago abre en ${evaluacion.diasParaAbrirVentana} días.`}
          </p>
        </div>
      );
  }
}

/**
 * 1C.2F
 */
function EstadoCoberturaCorte({
  resumen,
}: {
  resumen:
    ResumenTarjetaActual;
}) {
  if (
    !resumen.corteCubierto
  ) {
    return null;
  }

  const pago =
    resumen
      .pagoPrincipalCorte;

  if (
    pago
  ) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

          <div className="min-w-0">
            <p className="text-[11px] font-black text-emerald-800">
              Pago principal del corte cubierto
            </p>

            <p className="mt-1 text-[10px] font-semibold leading-5 text-emerald-700">
              Pago registrado el{" "}
              {formatearFechaTarjeta(
                new Date(
                  `${pago.fecha}T12:00:00`,
                ),
              )}
              .
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-emerald-700">
                Pago{" "}
                {formatoMoneda.format(
                  pago.montoPago,
                )}
              </span>

              <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-slate-600">
                Saldo previo{" "}
                {formatoMoneda.format(
                  pago
                    .saldoAntesPago,
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-700">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

      <div>
        <p className="text-[11px] font-black leading-5">
          Corte cubierto
        </p>

        <p className="text-[10px] font-semibold leading-5 text-emerald-600">
          No había saldo pendiente cuando comenzó la ventana de pago.
        </p>
      </div>
    </div>
  );
}

/**
 * ============================================================
 * 1C.2G
 * ACTIVIDAD POSTERIOR
 * ============================================================
 */
function ActividadPosteriorCobertura({
  resumen,
}: {
  resumen:
    ResumenTarjetaActual;
}) {
  if (
    !resumen.corteCubierto
  ) {
    return null;
  }

  const {
    comprasPosterioresCobertura,
    pagosPosterioresCobertura,
    saldoAdicionalAntesCorte,
    requierePagoAdicionalAntesCorte,
  } =
    resumen;

  const tieneActividad =
    comprasPosterioresCobertura >
      0 ||
    pagosPosterioresCobertura >
      0;

  if (
    !tieneActividad
  ) {
    return null;
  }

  return (
    <div
      className={`mt-4 rounded-3xl border p-4 ${
        requierePagoAdicionalAntesCorte
          ? "border-indigo-200 bg-indigo-50"
          : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            requierePagoAdicionalAntesCorte
              ? "bg-indigo-600 text-white"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {requierePagoAdicionalAntesCorte ? (
            <PlusCircle className="h-5 w-5" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-[10px] font-black uppercase tracking-[0.14em] ${
              requierePagoAdicionalAntesCorte
                ? "text-indigo-700"
                : "text-emerald-700"
            }`}
          >
            Actividad después del pago principal
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                Compras nuevas
              </p>

              <p className="mt-1 text-sm font-black text-rose-700">
                {formatoMoneda.format(
                  comprasPosterioresCobertura,
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                Pagos adicionales
              </p>

              <p className="mt-1 text-sm font-black text-emerald-700">
                {formatoMoneda.format(
                  pagosPosterioresCobertura,
                )}
              </p>
            </div>
          </div>

          {requierePagoAdicionalAntesCorte ? (
            <div className="mt-3 rounded-2xl bg-white p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-indigo-500">
                Pago adicional recomendado
              </p>

              <p className="mt-1 text-2xl font-black text-indigo-950">
                {formatoMoneda.format(
                  saldoAdicionalAntesCorte,
                )}
              </p>

              <p className="mt-1 text-[10px] font-semibold leading-5 text-indigo-600">
                Este monto corresponde solamente a la actividad posterior
                a la cobertura principal.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-[11px] font-bold text-emerald-700">
              ✓ La actividad posterior también está cubierta.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CreditCardSummaryCard({
  resumen,
  fechaReferencia,
}: CreditCardSummaryCardProps) {
  const {
    tarjeta,

    comprasDesdeSaldo,

    pagosDesdeSaldo,

    saldoActual,

    creditoAFavor,

    montoPagoTotal,

    creditoDisponible,

    porcentajeUtilizado,

    saldoAlInicioVentana,

    montoObjetivoVentana,

    corteCubierto,

    saldoAdicionalAntesCorte,

    requierePagoAdicionalAntesCorte,
  } =
    resumen;

  const calendario =
    calcularCalendarioPagoTarjeta(
      tarjeta.diaCorte,
      fechaReferencia,
    );

  const evaluacionVentana =
    evaluarVentanaPagoTarjeta({
      calendario,

      montoPagoTotal,

      activa:
        tarjeta.activa,
    });

  const evaluacionAdicional =
    evaluarVentanaPagoTarjeta({
      calendario,

      montoPagoTotal:
        saldoAdicionalAntesCorte,

      activa:
        tarjeta.activa,
    });

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

  const debePagarPrincipal =
    !corteCubierto &&
    evaluacionVentana
      .requiereAccion &&
    montoPagoTotal >
      0;

  const debePagarAdicional =
    corteCubierto &&
    requierePagoAdicionalAntesCorte &&
    evaluacionAdicional
      .requiereAccion &&
    saldoAdicionalAntesCorte >
      0;

  const corteHoyPrincipal =
    debePagarPrincipal &&
    evaluacionVentana
      .estado ===
    "corte_hoy";

  const corteHoyAdicional =
    debePagarAdicional &&
    evaluacionAdicional
      .estado ===
    "corte_hoy";

  const requiereAccion =
    debePagarPrincipal ||
    debePagarAdicional;

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${
        corteHoyPrincipal ||
        corteHoyAdicional
          ? "border-rose-300 ring-2 ring-rose-100"
          : requiereAccion
            ? "border-amber-300 ring-2 ring-amber-100"
            : corteCubierto
              ? "border-emerald-200 ring-1 ring-emerald-100"
              : tarjeta.activa
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
                {tarjeta.activa
                  ? "Activa"
                  : "Inactiva"}
              </span>

              {corteCubierto && (
                <span className="rounded-full bg-emerald-400 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-950">
                  Principal cubierto
                </span>
              )}

              {debePagarPrincipal && (
                <span
                  className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
                    corteHoyPrincipal
                      ? "bg-rose-500 text-white"
                      : "bg-amber-400 text-slate-950"
                  }`}
                >
                  {corteHoyPrincipal
                    ? "Pagar hoy"
                    : "Pagar ahora"}
                </span>
              )}

              {debePagarAdicional && (
                <span
                  className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
                    corteHoyAdicional
                      ? "bg-rose-500 text-white"
                      : "bg-indigo-300 text-indigo-950"
                  }`}
                >
                  Pago adicional
                </span>
              )}
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

          {creditoAFavor >
            0 && (
            <p className="mt-1 text-xs font-bold text-emerald-300">
              Crédito a favor:{" "}
              {formatoMoneda.format(
                creditoAFavor,
              )}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-slate-300">
          <span>
            Corte configurado: día{" "}
            {
              tarjeta.diaCorte
            }
          </span>

          <span>
            Vencimiento: día{" "}
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
        {/*
         * ======================================================
         * PAGO PRINCIPAL
         * ======================================================
         */}
        {debePagarPrincipal && (
          <div
            aria-live="polite"
            className={`mb-4 rounded-3xl border p-4 ${
              corteHoyPrincipal
                ? "border-rose-300 bg-rose-50"
                : "border-amber-300 bg-amber-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  corteHoyPrincipal
                    ? "bg-rose-600 text-white"
                    : "bg-amber-400 text-slate-950"
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                    corteHoyPrincipal
                      ? "text-rose-600"
                      : "text-amber-700"
                  }`}
                >
                  {corteHoyPrincipal
                    ? "Pagar hoy"
                    : "Pagar ahora"}
                </p>

                <p className="mt-1 text-3xl font-black text-slate-950">
                  {formatoMoneda.format(
                    montoPagoTotal,
                  )}
                </p>

                <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-700">
                  Paga el saldo principal antes del corte del{" "}
                  {formatearFechaTarjeta(
                    calendario
                      .fechaCorte,
                  )}
                  .
                </p>
              </div>
            </div>
          </div>
        )}

        {/*
         * ======================================================
         * 1C.2G
         * ALERTA ADICIONAL
         * ======================================================
         */}
        {debePagarAdicional && (
          <div
            aria-live="polite"
            className={`mb-4 rounded-3xl border p-4 ${
              corteHoyAdicional
                ? "border-rose-300 bg-rose-50"
                : "border-indigo-300 bg-indigo-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  corteHoyAdicional
                    ? "bg-rose-600 text-white"
                    : "bg-indigo-600 text-white"
                }`}
              >
                <PlusCircle className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                    corteHoyAdicional
                      ? "text-rose-600"
                      : "text-indigo-700"
                  }`}
                >
                  {corteHoyAdicional
                    ? "Pago adicional hoy"
                    : "Pago adicional antes del corte"}
                </p>

                <p className="mt-1 text-3xl font-black text-slate-950">
                  {formatoMoneda.format(
                    saldoAdicionalAntesCorte,
                  )}
                </p>

                <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-700">
                  El pago principal ya está cubierto. Este monto corresponde
                  a compras posteriores y debe pagarse antes del corte del{" "}
                  {formatearFechaTarjeta(
                    calendario
                      .fechaCorte,
                  )}
                  .
                </p>
              </div>
            </div>
          </div>
        )}

        {/*
         * ======================================================
         * CALENDARIO
         * ======================================================
         */}
        <div className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-indigo-600" />

            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700">
              Calendario de pago
            </p>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                Próximo corte
              </p>

              <p className="mt-1 text-sm font-black text-slate-900">
                {formatearFechaTarjeta(
                  calendario
                    .fechaCorte,
                )}
              </p>

              <p className="mt-1 text-[10px] font-semibold text-slate-500">
                {calendario
                  .diasHastaCorte ===
                0
                  ? "El corte es hoy"
                  : `En ${calendario.diasHastaCorte} día${
                      calendario.diasHastaCorte ===
                      1
                        ? ""
                        : "s"
                    }`}
              </p>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-white p-3 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-wider text-indigo-500">
                Pagar saldo
              </p>

              <p className="mt-1 text-sm font-black text-indigo-900">
                {formatearFechaTarjeta(
                  calendario
                    .fechaObjetivoPago,
                )}
              </p>

              <p className="mt-1 text-[10px] font-semibold text-indigo-600">
                {
                  DIAS_ANTICIPACION_PAGO_TARJETA
                }{" "}
                días antes del corte
              </p>
            </div>
          </div>

          {saldoAlInicioVentana !==
            null && (
            <div className="mt-3 rounded-2xl bg-white px-3 py-2.5">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                Saldo al abrir la ventana
              </p>

              <p className="mt-1 text-sm font-black text-slate-800">
                {formatoMoneda.format(
                  montoObjetivoVentana ??
                    0,
                )}
              </p>
            </div>
          )}

          {corteCubierto ? (
            <EstadoCoberturaCorte
              resumen={
                resumen
              }
            />
          ) : (
            <EstadoVentanaPago
              evaluacion={
                evaluacionVentana
              }
            />
          )}

          {calendario
            .ajustadoPorFinDeMes && (
            <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-[10px] font-semibold leading-relaxed text-amber-700">
              El día de corte configurado es{" "}
              {
                calendario
                  .diaCorteConfigurado
              }
              , pero este mes termina el día{" "}
              {
                calendario
                  .diaCorteEfectivo
              }
              . Se utilizó automáticamente el último día disponible.
            </p>
          )}
        </div>

        <ActividadPosteriorCobertura
          resumen={
            resumen
          }
        />

        {/*
         * ======================================================
         * SALDO GENERAL
         * ======================================================
         */}
        <div
          className={`mt-4 rounded-3xl border p-4 ${
            montoPagoTotal >
            0
              ? corteCubierto
                ? "border-indigo-200 bg-indigo-50"
                : "border-emerald-200 bg-emerald-50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  montoPagoTotal >
                  0
                    ? corteCubierto
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-emerald-100 text-emerald-700"
                    : "bg-white text-slate-400"
                }`}
              >
                <CircleDollarSign className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p
                  className={`text-[10px] font-black uppercase tracking-[0.14em] ${
                    montoPagoTotal >
                    0
                      ? corteCubierto
                        ? "text-indigo-700"
                        : "text-emerald-700"
                      : "text-slate-500"
                  }`}
                >
                  {corteCubierto &&
                  montoPagoTotal >
                    0
                    ? "Saldo actual posterior"
                    : "Pago total calculado"}
                </p>

                <p className="mt-1 text-2xl font-black text-slate-900">
                  {formatoMoneda.format(
                    montoPagoTotal,
                  )}
                </p>
              </div>
            </div>

            {montoPagoTotal <=
              0 && (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                Sin saldo
              </span>
            )}
          </div>

          <p className="mt-3 text-[11px] font-semibold leading-5 text-slate-600">
            {corteCubierto &&
            montoPagoTotal >
              0
              ? "El pago principal ya está cubierto. Este saldo corresponde a actividad posterior."
              : montoPagoTotal >
                  0
                ? "Este es el monto que llevaría la tarjeta a $0 con las compras y pagos registrados hasta ahora."
                : creditoAFavor >
                    0
                  ? `No necesitas realizar un pago. Existe un crédito a favor de ${formatoMoneda.format(
                      creditoAFavor,
                    )}.`
                  : "No existe saldo pendiente para pagar."}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
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