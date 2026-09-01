"use client";

/*
 * Nombre: Resúmenes financieros de tarjetas
 * Ruta: src/hooks/useCreditCardSummaries.ts
 * Autor: Felix Echavarria
 * Fecha: 2026-09-01
 *
 * Descripción:
 * Calcula el saldo actual de cada tarjeta usando:
 *
 *   saldo inicial
 * + compras registradas
 * - pagos registrados
 *
 * También calcula:
 *
 * - crédito disponible;
 * - utilización;
 * - crédito a favor;
 * - monto para llevar la tarjeta a $0;
 * - saldo existente al abrir la ventana de pago;
 * - detección del pago principal del corte;
 * - compras y pagos posteriores a esa cobertura;
 * - pago adicional necesario antes del corte.
 *
 * 1C.2F:
 * Reconoce cuándo quedó cubierto el pago principal.
 *
 * 1C.2G:
 * Una vez cubierto ese pago, reconstruye solamente
 * los movimientos posteriores y calcula un saldo adicional.
 *
 * Ejemplo:
 *
 * saldo principal      $500
 * pago principal      -$500
 * nueva compra          +$40
 * pago adicional        -$10
 *
 * saldo adicional        $30
 */

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  calcularCalendarioPagoTarjeta,
  fechaCalendarioAISO,
} from "@/lib/budget/credit-card-payment-calendar";

import type {
  GastoVariable,
  PagoTarjeta,
  TarjetaCredito,
} from "@/lib/budget/types";

/**
 * Información del pago que consiguió cubrir
 * completamente la obligación principal.
 */
export interface PagoPrincipalCorteDetectado {
  pagoId:
    string;

  fecha:
    string;

  creadoEn:
    string;

  montoPago:
    number;

  saldoAntesPago:
    number;

  saldoDespuesPago:
    number;
}

/**
 * Resultado interno de 1C.2F.
 */
interface CoberturaCorteTarjeta {
  saldoAlInicioVentana:
    number | null;

  montoObjetivoVentana:
    number | null;

  corteCubierto:
    boolean;

  pagoPrincipalCorteRealizado:
    boolean;

  pagoPrincipalCorte:
    PagoPrincipalCorteDetectado | null;
}

/**
 * Resultado interno de 1C.2G.
 */
interface ActividadPosteriorCobertura {
  /**
   * Compras realizadas después de quedar cubierta
   * la obligación principal.
   */
  comprasPosterioresCobertura:
    number;

  /**
   * Pagos realizados después de quedar cubierta
   * la obligación principal.
   */
  pagosPosterioresCobertura:
    number;

  /**
   * Deuda adicional neta pendiente antes del corte.
   *
   * Este será el monto de:
   *
   * "PAGO ADICIONAL"
   */
  saldoAdicionalAntesCorte:
    number;

  /**
   * true cuando queda una deuda posterior positiva.
   */
  requierePagoAdicionalAntesCorte:
    boolean;
}

/**
 * Resumen financiero público.
 */
export interface ResumenTarjetaActual {
  tarjeta:
    TarjetaCredito;

  comprasDesdeSaldo:
    number;

  pagosDesdeSaldo:
    number;

  saldoActual:
    number;

  creditoAFavor:
    number;

  montoPagoTotal:
    number;

  creditoDisponible:
    number | null;

  porcentajeUtilizado:
    number | null;

  /**
   * ============================================================
   * 1C.2F
   * ============================================================
   */

  saldoAlInicioVentana:
    number | null;

  montoObjetivoVentana:
    number | null;

  corteCubierto:
    boolean;

  pagoPrincipalCorteRealizado:
    boolean;

  pagoPrincipalCorte:
    PagoPrincipalCorteDetectado | null;

  /**
   * ============================================================
   * 1C.2G
   * ============================================================
   */

  comprasPosterioresCobertura:
    number;

  pagosPosterioresCobertura:
    number;

  saldoAdicionalAntesCorte:
    number;

  requierePagoAdicionalAntesCorte:
    boolean;
}

interface UseCreditCardSummariesParams {
  tarjetas:
    TarjetaCredito[];

  gastos:
    GastoVariable[];

  pagos:
    PagoTarjeta[];
}

/**
 * Movimiento financiero interno ordenable.
 */
interface MovimientoCronologicoTarjeta {
  id:
    string;

  tipo:
    "gasto" | "pago";

  monto:
    number;

  fecha:
    string;

  creadoEn:
    string;
}

const TOLERANCIA_SALDO =
  0.005;

/**
 * Redondea a centavos.
 */
function redondearMoneda(
  value:
    number,
): number {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        100,
    ) /
    100
  );
}

/**
 * Devuelve YYYY-MM-DD.
 */
function obtenerFechaCalendario(
  fecha:
    string,
): string {
  return fecha.slice(
    0,
    10,
  );
}

/**
 * Obtiene la marca temporal más precisa disponible.
 */
function obtenerCreadoEn(
  movimiento:
    GastoVariable | PagoTarjeta,
): string {
  const creadoEn =
    movimiento.creadoEn;

  if (
    typeof creadoEn ===
      "string" &&
    creadoEn.trim()
  ) {
    return creadoEn;
  }

  return movimiento.fecha;
}

/**
 * Unifica compras y pagos de una tarjeta
 * en una sola línea de tiempo.
 */
function construirMovimientosTarjeta(
  tarjeta:
    TarjetaCredito,

  gastos:
    GastoVariable[],

  pagos:
    PagoTarjeta[],
): MovimientoCronologicoTarjeta[] {
  const fechaInicial =
    obtenerFechaCalendario(
      tarjeta
        .fechaSaldoInicial,
    );

  const compras:
    MovimientoCronologicoTarjeta[] =
      gastos.flatMap(
        (
          gasto,
        ) => {
          if (
            gasto.tarjetaId !==
            tarjeta.id
          ) {
            return [];
          }

          const fecha =
            obtenerFechaCalendario(
              gasto.fecha,
            );

          if (
            fecha <
            fechaInicial
          ) {
            return [];
          }

          return [
            {
              id:
                gasto.id,

              tipo:
                "gasto",

              monto:
                redondearMoneda(
                  gasto.monto,
                ),

              fecha,

              creadoEn:
                obtenerCreadoEn(
                  gasto,
                ),
            },
          ];
        },
      );

  const pagosTarjeta:
    MovimientoCronologicoTarjeta[] =
      pagos.flatMap(
        (
          pago,
        ) => {
          if (
            pago.tarjetaId !==
            tarjeta.id
          ) {
            return [];
          }

          const fecha =
            obtenerFechaCalendario(
              pago.fecha,
            );

          if (
            fecha <
            fechaInicial
          ) {
            return [];
          }

          return [
            {
              id:
                pago.id,

              tipo:
                "pago",

              monto:
                redondearMoneda(
                  pago.monto,
                ),

              fecha,

              creadoEn:
                obtenerCreadoEn(
                  pago,
                ),
            },
          ];
        },
      );

  return [
    ...compras,
    ...pagosTarjeta,
  ].sort(
    (
      a,
      b,
    ) => {
      const fechaComparacion =
        a.fecha.localeCompare(
          b.fecha,
        );

      if (
        fechaComparacion !==
        0
      ) {
        return fechaComparacion;
      }

      const creadoComparacion =
        a.creadoEn.localeCompare(
          b.creadoEn,
        );

      if (
        creadoComparacion !==
        0
      ) {
        return creadoComparacion;
      }

      /**
       * Para documentos históricos sin hora precisa:
       *
       * gasto antes de pago.
       *
       * Es la interpretación conservadora porque
       * exige que el pago cubra también la compra.
       */
      if (
        a.tipo !==
        b.tipo
      ) {
        return a.tipo ===
          "gasto"
          ? -1
          : 1;
      }

      return a.id.localeCompare(
        b.id,
      );
    },
  );
}

/**
 * Total de compras desde el saldo inicial.
 */
function sumarComprasDesdeSaldo(
  tarjeta:
    TarjetaCredito,

  gastos:
    GastoVariable[],
): number {
  const fechaInicial =
    obtenerFechaCalendario(
      tarjeta
        .fechaSaldoInicial,
    );

  const total =
    gastos.reduce(
      (
        acumulado,
        gasto,
      ) => {
        if (
          gasto.tarjetaId !==
          tarjeta.id
        ) {
          return acumulado;
        }

        if (
          obtenerFechaCalendario(
            gasto.fecha,
          ) <
          fechaInicial
        ) {
          return acumulado;
        }

        return (
          acumulado +
          gasto.monto
        );
      },
      0,
    );

  return redondearMoneda(
    total,
  );
}

/**
 * Total de pagos desde el saldo inicial.
 */
function sumarPagosDesdeSaldo(
  tarjeta:
    TarjetaCredito,

  pagos:
    PagoTarjeta[],
): number {
  const fechaInicial =
    obtenerFechaCalendario(
      tarjeta
        .fechaSaldoInicial,
    );

  const total =
    pagos.reduce(
      (
        acumulado,
        pago,
      ) => {
        if (
          pago.tarjetaId !==
          tarjeta.id
        ) {
          return acumulado;
        }

        if (
          obtenerFechaCalendario(
            pago.fecha,
          ) <
          fechaInicial
        ) {
          return acumulado;
        }

        return (
          acumulado +
          pago.monto
        );
      },
      0,
    );

  return redondearMoneda(
    total,
  );
}

/**
 * Construye el registro del pago que consiguió
 * llevar el saldo a cero.
 */
function crearPagoPrincipalDetectado({
  movimiento,
  saldoAntesPago,
  saldoDespuesPago,
}: {
  movimiento:
    MovimientoCronologicoTarjeta;

  saldoAntesPago:
    number;

  saldoDespuesPago:
    number;
}): PagoPrincipalCorteDetectado {
  return {
    pagoId:
      movimiento.id,

    fecha:
      movimiento.fecha,

    creadoEn:
      movimiento.creadoEn,

    montoPago:
      movimiento.monto,

    saldoAntesPago:
      redondearMoneda(
        Math.max(
          saldoAntesPago,
          0,
        ),
      ),

    saldoDespuesPago:
      redondearMoneda(
        saldoDespuesPago,
      ),
  };
}

/**
 * ============================================================
 * 1C.2F
 * COBERTURA DEL PAGO PRINCIPAL
 * ============================================================
 */
function evaluarCoberturaCorte(
  tarjeta:
    TarjetaCredito,

  gastos:
    GastoVariable[],

  pagos:
    PagoTarjeta[],

  fechaReferencia:
    Date,
): CoberturaCorteTarjeta {
  const calendario =
    calcularCalendarioPagoTarjeta(
      tarjeta.diaCorte,
      fechaReferencia,
    );

  const fechaActualISO =
    fechaCalendarioAISO(
      fechaReferencia,
    );

  const fechaObjetivoISO =
    calendario
      .fechaObjetivoPagoISO;

  const fechaCorteISO =
    calendario
      .fechaCorteISO;

  /**
   * Todavía no abrió la ventana.
   */
  if (
    fechaActualISO <
    fechaObjetivoISO
  ) {
    return {
      saldoAlInicioVentana:
        null,

      montoObjetivoVentana:
        null,

      corteCubierto:
        false,

      pagoPrincipalCorteRealizado:
        false,

      pagoPrincipalCorte:
        null,
    };
  }

  const movimientos =
    construirMovimientosTarjeta(
      tarjeta,
      gastos,
      pagos,
    );

  let saldo =
    redondearMoneda(
      tarjeta.saldoInicial,
    );

  let ultimoPagoLiquidacionAnterior:
    PagoPrincipalCorteDetectado | null =
      null;

  /**
   * Calcula el saldo justo antes de comenzar
   * el día objetivo.
   */
  for (
    const movimiento of movimientos
  ) {
    if (
      movimiento.fecha >=
      fechaObjetivoISO
    ) {
      break;
    }

    if (
      movimiento.fecha >
      fechaActualISO
    ) {
      break;
    }

    if (
      movimiento.tipo ===
      "gasto"
    ) {
      saldo =
        redondearMoneda(
          saldo +
            movimiento.monto,
        );

      continue;
    }

    const saldoAntesPago =
      saldo;

    saldo =
      redondearMoneda(
        saldo -
          movimiento.monto,
      );

    if (
      saldo <=
      TOLERANCIA_SALDO
    ) {
      ultimoPagoLiquidacionAnterior =
        crearPagoPrincipalDetectado({
          movimiento,

          saldoAntesPago,

          saldoDespuesPago:
            saldo,
        });
    }
  }

  const saldoAlInicioVentana =
    redondearMoneda(
      Math.max(
        saldo,
        0,
      ),
    );

  const montoObjetivoVentana =
    saldoAlInicioVentana;

  /**
   * La ventana abrió sin deuda.
   */
  if (
    saldoAlInicioVentana <=
    TOLERANCIA_SALDO
  ) {
    return {
      saldoAlInicioVentana,

      montoObjetivoVentana,

      corteCubierto:
        true,

      pagoPrincipalCorteRealizado:
        ultimoPagoLiquidacionAnterior !==
        null,

      pagoPrincipalCorte:
        ultimoPagoLiquidacionAnterior,
    };
  }

  /**
   * Procesa movimientos dentro de la ventana.
   */
  for (
    const movimiento of movimientos
  ) {
    if (
      movimiento.fecha <
      fechaObjetivoISO
    ) {
      continue;
    }

    if (
      movimiento.fecha >
      fechaActualISO
    ) {
      break;
    }

    if (
      movimiento.fecha >
      fechaCorteISO
    ) {
      break;
    }

    if (
      movimiento.tipo ===
      "gasto"
    ) {
      saldo =
        redondearMoneda(
          saldo +
            movimiento.monto,
        );

      continue;
    }

    const saldoAntesPago =
      saldo;

    saldo =
      redondearMoneda(
        saldo -
          movimiento.monto,
      );

    if (
      saldo <=
      TOLERANCIA_SALDO
    ) {
      return {
        saldoAlInicioVentana,

        montoObjetivoVentana,

        corteCubierto:
          true,

        pagoPrincipalCorteRealizado:
          true,

        pagoPrincipalCorte:
          crearPagoPrincipalDetectado({
            movimiento,

            saldoAntesPago,

            saldoDespuesPago:
              saldo,
          }),
      };
    }
  }

  return {
    saldoAlInicioVentana,

    montoObjetivoVentana,

    corteCubierto:
      false,

    pagoPrincipalCorteRealizado:
      false,

    pagoPrincipalCorte:
      null,
  };
}

/**
 * ============================================================
 * 1C.2G
 * ACTIVIDAD DESPUÉS DE CUBRIR EL PAGO PRINCIPAL
 * ============================================================
 *
 * Caso A:
 *
 * Existe un pago principal detectado.
 *
 * Empezamos inmediatamente DESPUÉS de ese pago y
 * conservamos cualquier crédito generado por sobrepago.
 *
 * Caso B:
 *
 * La ventana abrió con saldo $0 y no existió un pago
 * específico que detectar.
 *
 * Empezamos desde el inicio de la fecha objetivo con
 * saldo base $0.
 */
function evaluarActividadPosteriorCobertura(
  tarjeta:
    TarjetaCredito,

  gastos:
    GastoVariable[],

  pagos:
    PagoTarjeta[],

  fechaReferencia:
    Date,

  cobertura:
    CoberturaCorteTarjeta,
): ActividadPosteriorCobertura {
  const vacio:
    ActividadPosteriorCobertura = {
      comprasPosterioresCobertura:
        0,

      pagosPosterioresCobertura:
        0,

      saldoAdicionalAntesCorte:
        0,

      requierePagoAdicionalAntesCorte:
        false,
    };

  if (
    !cobertura
      .corteCubierto
  ) {
    return vacio;
  }

  const calendario =
    calcularCalendarioPagoTarjeta(
      tarjeta.diaCorte,
      fechaReferencia,
    );

  const fechaActualISO =
    fechaCalendarioAISO(
      fechaReferencia,
    );

  const fechaObjetivoISO =
    calendario
      .fechaObjetivoPagoISO;

  const fechaCorteISO =
    calendario
      .fechaCorteISO;

  if (
    fechaActualISO <
    fechaObjetivoISO
  ) {
    return vacio;
  }

  const movimientos =
    construirMovimientosTarjeta(
      tarjeta,
      gastos,
      pagos,
    );

  let indiceInicio =
    0;

  /**
   * Si hubo un pago principal específico,
   * empezamos exactamente después de él.
   */
  if (
    cobertura
      .pagoPrincipalCorte
  ) {
    const indicePago =
      movimientos.findIndex(
        (
          movimiento,
        ) =>
          movimiento.tipo ===
            "pago" &&
          movimiento.id ===
            cobertura
              .pagoPrincipalCorte
              ?.pagoId,
      );

    if (
      indicePago >=
      0
    ) {
      indiceInicio =
        indicePago +
        1;
    } else {
      /**
       * Fallback defensivo.
       *
       * Si por alguna razón no encontramos el documento,
       * comenzamos por la fecha objetivo.
       */
      indiceInicio =
        movimientos.findIndex(
          (
            movimiento,
          ) =>
            movimiento.fecha >=
            fechaObjetivoISO,
        );

      if (
        indiceInicio <
        0
      ) {
        indiceInicio =
          movimientos.length;
      }
    }
  } else {
    /**
     * No existía saldo al comenzar la ventana.
     *
     * Toda actividad desde ese momento es posterior
     * a la cobertura inicial.
     */
    indiceInicio =
      movimientos.findIndex(
        (
          movimiento,
        ) =>
          movimiento.fecha >=
          fechaObjetivoISO,
      );

    if (
      indiceInicio <
      0
    ) {
      indiceInicio =
        movimientos.length;
    }
  }

  /**
   * Si el pago principal generó crédito a favor,
   * las compras posteriores deben consumir primero
   * ese crédito.
   *
   * Ejemplo:
   *
   * saldo antes      $100
   * pago             $120
   * saldo base       -$20
   * compra            $30
   *
   * adicional real    $10
   */
  let saldoPosterior =
    cobertura
      .pagoPrincipalCorte
      ?.saldoDespuesPago ??
    0;

  let comprasPosteriores =
    0;

  let pagosPosteriores =
    0;

  for (
    let indice =
      indiceInicio;
    indice <
    movimientos.length;
    indice +=
      1
  ) {
    const movimiento =
      movimientos[indice];

    /**
     * Nunca incluimos movimientos futuros.
     */
    if (
      movimiento.fecha >
      fechaActualISO
    ) {
      break;
    }

    /**
     * Solamente queremos actividad antes o durante
     * el corte actual.
     */
    if (
      movimiento.fecha >
      fechaCorteISO
    ) {
      break;
    }

    if (
      movimiento.tipo ===
      "gasto"
    ) {
      comprasPosteriores =
        redondearMoneda(
          comprasPosteriores +
            movimiento.monto,
        );

      saldoPosterior =
        redondearMoneda(
          saldoPosterior +
            movimiento.monto,
        );

      continue;
    }

    pagosPosteriores =
      redondearMoneda(
        pagosPosteriores +
          movimiento.monto,
      );

    saldoPosterior =
      redondearMoneda(
        saldoPosterior -
          movimiento.monto,
      );
  }

  const saldoAdicionalAntesCorte =
    redondearMoneda(
      Math.max(
        saldoPosterior,
        0,
      ),
    );

  return {
    comprasPosterioresCobertura:
      comprasPosteriores,

    pagosPosterioresCobertura:
      pagosPosteriores,

    saldoAdicionalAntesCorte,

    requierePagoAdicionalAntesCorte:
      saldoAdicionalAntesCorte >
      TOLERANCIA_SALDO,
  };
}

/**
 * Construye el resumen completo.
 */
function crearResumenTarjeta(
  tarjeta:
    TarjetaCredito,

  gastos:
    GastoVariable[],

  pagos:
    PagoTarjeta[],

  fechaReferencia:
    Date,
): ResumenTarjetaActual {
  const comprasDesdeSaldo =
    sumarComprasDesdeSaldo(
      tarjeta,
      gastos,
    );

  const pagosDesdeSaldo =
    sumarPagosDesdeSaldo(
      tarjeta,
      pagos,
    );

  const saldoCalculado =
    redondearMoneda(
      tarjeta.saldoInicial +
        comprasDesdeSaldo -
        pagosDesdeSaldo,
    );

  const saldoActual =
    redondearMoneda(
      Math.max(
        saldoCalculado,
        0,
      ),
    );

  const creditoAFavor =
    redondearMoneda(
      Math.max(
        -saldoCalculado,
        0,
      ),
    );

  const montoPagoTotal =
    saldoActual;

  const creditoDisponible =
    tarjeta.limiteCredito ===
    null
      ? null
      : redondearMoneda(
          Math.max(
            tarjeta
              .limiteCredito -
              saldoCalculado,
            0,
          ),
        );

  const porcentajeUtilizado =
    tarjeta.limiteCredito ===
      null ||
    tarjeta.limiteCredito <=
      0
      ? null
      : Math.max(
          0,
          (
            saldoActual /
            tarjeta
              .limiteCredito
          ) *
            100,
        );

  /**
   * 1C.2F
   */
  const cobertura =
    evaluarCoberturaCorte(
      tarjeta,
      gastos,
      pagos,
      fechaReferencia,
    );

  /**
   * 1C.2G
   */
  const actividadPosterior =
    evaluarActividadPosteriorCobertura(
      tarjeta,
      gastos,
      pagos,
      fechaReferencia,
      cobertura,
    );

  return {
    tarjeta,

    comprasDesdeSaldo,

    pagosDesdeSaldo,

    saldoActual,

    creditoAFavor,

    montoPagoTotal,

    creditoDisponible,

    porcentajeUtilizado,

    saldoAlInicioVentana:
      cobertura
        .saldoAlInicioVentana,

    montoObjetivoVentana:
      cobertura
        .montoObjetivoVentana,

    corteCubierto:
      cobertura
        .corteCubierto,

    pagoPrincipalCorteRealizado:
      cobertura
        .pagoPrincipalCorteRealizado,

    pagoPrincipalCorte:
      cobertura
        .pagoPrincipalCorte,

    comprasPosterioresCobertura:
      actividadPosterior
        .comprasPosterioresCobertura,

    pagosPosterioresCobertura:
      actividadPosterior
        .pagosPosterioresCobertura,

    saldoAdicionalAntesCorte:
      actividadPosterior
        .saldoAdicionalAntesCorte,

    requierePagoAdicionalAntesCorte:
      actividadPosterior
        .requierePagoAdicionalAntesCorte,
  };
}

/**
 * Mantiene actualizado el día financiero.
 */
function useFechaFinancieraActual(): Date {
  const [
    fecha,
    setFecha,
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
            setFecha(
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

  return fecha;
}

/**
 * Hook público.
 */
export function useCreditCardSummaries({
  tarjetas,
  gastos,
  pagos,
}: UseCreditCardSummariesParams) {
  const fechaReferencia =
    useFechaFinancieraActual();

  const resumenes =
    useMemo(
      () =>
        tarjetas
          .map(
            (
              tarjeta,
            ) =>
              crearResumenTarjeta(
                tarjeta,
                gastos,
                pagos,
                fechaReferencia,
              ),
          )
          .sort(
            (
              a,
              b,
            ) => {
              if (
                a.tarjeta
                  .activa !==
                b.tarjeta
                  .activa
              ) {
                return a.tarjeta
                  .activa
                  ? -1
                  : 1;
              }

              return a.tarjeta
                .nombre
                .localeCompare(
                  b.tarjeta
                    .nombre,
                  "es",
                  {
                    sensitivity:
                      "base",
                  },
                );
            },
          ),
      [
        tarjetas,
        gastos,
        pagos,
        fechaReferencia,
      ],
    );

  const totalSaldoActual =
    useMemo(
      () =>
        redondearMoneda(
          resumenes.reduce(
            (
              total,
              resumen,
            ) =>
              total +
              resumen
                .saldoActual,
            0,
          ),
        ),
      [
        resumenes,
      ],
    );

  const totalPagoTotal =
    useMemo(
      () =>
        redondearMoneda(
          resumenes.reduce(
            (
              total,
              resumen,
            ) =>
              total +
              resumen
                .montoPagoTotal,
            0,
          ),
        ),
      [
        resumenes,
      ],
    );

  const totalCreditoAFavor =
    useMemo(
      () =>
        redondearMoneda(
          resumenes.reduce(
            (
              total,
              resumen,
            ) =>
              total +
              resumen
                .creditoAFavor,
            0,
          ),
        ),
      [
        resumenes,
      ],
    );

  const totalCompras =
    useMemo(
      () =>
        redondearMoneda(
          resumenes.reduce(
            (
              total,
              resumen,
            ) =>
              total +
              resumen
                .comprasDesdeSaldo,
            0,
          ),
        ),
      [
        resumenes,
      ],
    );

  const totalPagos =
    useMemo(
      () =>
        redondearMoneda(
          resumenes.reduce(
            (
              total,
              resumen,
            ) =>
              total +
              resumen
                .pagosDesdeSaldo,
            0,
          ),
        ),
      [
        resumenes,
      ],
    );

  /**
   * Total adicional actualmente pendiente
   * después de pagos principales cubiertos.
   */
  const totalPagoAdicionalAntesCorte =
    useMemo(
      () =>
        redondearMoneda(
          resumenes.reduce(
            (
              total,
              resumen,
            ) =>
              total +
              resumen
                .saldoAdicionalAntesCorte,
            0,
          ),
        ),
      [
        resumenes,
      ],
    );

  return {
    resumenes,

    totalSaldoActual,

    totalPagoTotal,

    totalCreditoAFavor,

    totalCompras,

    totalPagos,

    totalPagoAdicionalAntesCorte,
  };
}

export type CreditCardSummariesController =
  ReturnType<
    typeof useCreditCardSummaries
  >;