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
  evaluarVentanaPagoTarjeta,
  fechaCalendarioAISO,
} from "@/lib/budget/credit-card-payment-calendar";

import type {
  GastoVariable,
  PagoFijo,
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

  /**
* 2B.2
*
* Gastos fijos registrados directamente contra
* esta tarjeta desde su saldo inicial.
*/
  cargosFijosDesdeSaldo:
  number;

  pagosDesdeSaldo:
  number;

  /**
 * ============================================================
 * 2B.2B — TRANSACCIONES PENDIENTES
 * ============================================================
 *
 * Estos movimientos todavía no forman parte del saldo
 * contabilizado de la tarjeta.
 */
  comprasPendientes:
  number;

  cargosFijosPendientes:
  number;

  pagosPendientes:
  number;

  /**
   * Total de cargos pendientes:
   *
   * compras variables pendientes
   * + cargos fijos pendientes.
   */
  totalCargosPendientes:
  number;

  /**
   * Saldo esperado cuando todas las transacciones
   * pendientes sean contabilizadas.
   */
  saldoProyectado:
  number;

  saldoActual:
  number;

  creditoAFavor:
  number;

  montoPagoTotal:
  number;

  /**
  * 2B.2A
  *
  * Deuda positiva actual de la tarjeta que debe formar
  * parte del dinero comprometido de la Cuenta de gastos.
  *
  * No reduce el Saldo actual hasta que se registre
  * un pago real a la tarjeta.
  */
  montoReservarCuenta:
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

  /**
   * 2B.2
   *
   * Pagos de compromisos fijos. Los que tengan
   * metodo === "tarjeta" se comportan como cargos
   * sobre la tarjeta indicada.
   */
  pagosFijos:
  PagoFijo[];

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

  pagosFijos:
    PagoFijo[],

  pagos:
    PagoTarjeta[],
): MovimientoCronologicoTarjeta[] {
  const fechaInicial =
    obtenerFechaCalendario(
      tarjeta
        .fechaSaldoInicial,
    );

  /**
   * Compras variables normales.
   */
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

  /**
   * ============================================================
   * 2B.2 — GASTOS FIJOS PAGADOS CON TARJETA
   * ============================================================
   *
   * Registrar un compromiso como pagado con tarjeta NO significa
   * que salió dinero de la cuenta bancaria.
   *
   * Significa que apareció una nueva deuda en esa tarjeta.
   */
  const cargosFijos:
    MovimientoCronologicoTarjeta[] =
    pagosFijos.flatMap(
      (
        pago,
      ) => {
        if (
          pago.metodo !==
          "tarjeta"
        ) {
          return [];
        }

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

        if (
          !Number.isFinite(
            pago.monto,
          ) ||
          pago.monto <=
          0
        ) {
          return [];
        }

        return [
          {
            /**
             * Prefijo para evitar una posible colisión
             * entre IDs de colecciones distintas.
             */
            id:
              `pago-fijo:${pago.id}`,

            tipo:
              "gasto",

            monto:
              redondearMoneda(
                pago.monto,
              ),

            fecha,

            /**
             * PagoFijo todavía no conserva creadoEn en
             * el modelo público.
             *
             * Lo colocamos al inicio del día para que,
             * cuando exista un pago de tarjeta el mismo
             * día, la interpretación conservadora sea:
             *
             * cargo primero -> pago después.
             */
            creadoEn:
              `${fecha}T00:00:00.000Z`,
          },
        ];
      },
    );

  /**
   * Pagos reales realizados A la tarjeta.
   */
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
    ...cargosFijos,
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
       * Interpretación conservadora:
       *
       * cuando no podemos conocer un orden más preciso,
       * primero aplicamos el cargo y después el pago.
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
 * ============================================================
 * 2B.2
 * CARGOS FIJOS DESDE EL SALDO INICIAL DE LA TARJETA
 * ============================================================
 */
function sumarCargosFijosDesdeSaldo(
  tarjeta:
    TarjetaCredito,

  pagosFijos:
    PagoFijo[],
): number {
  const fechaInicial =
    obtenerFechaCalendario(
      tarjeta
        .fechaSaldoInicial,
    );

  const total =
    pagosFijos.reduce(
      (
        acumulado,
        pago,
      ) => {
        if (
          pago.metodo !==
          "tarjeta"
        ) {
          return acumulado;
        }

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

        if (
          !Number.isFinite(
            pago.monto,
          ) ||
          pago.monto <=
          0
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

  pagosFijos:
    PagoFijo[],

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
      pagosFijos,
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

  pagosFijos:
    PagoFijo[],

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
      pagosFijos,
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

  pagosFijos:
    PagoFijo[],

  pagos:
    PagoTarjeta[],

  fechaReferencia:
    Date,
): ResumenTarjetaActual {
  /**
   * ============================================================
   * 2B.2B — SEPARACIÓN CONTABILIZADO / PENDIENTE
   * ============================================================
   *
   * Compatibilidad:
   * cualquier registro que no sea explícitamente "pendiente"
   * se considera contabilizado.
   */
  const gastosContabilizados =
    gastos.filter(
      (gasto) =>
        gasto.estadoTarjeta !==
        "pendiente",
    );

  const gastosPendientes =
    gastos.filter(
      (gasto) =>
        gasto.estadoTarjeta ===
        "pendiente",
    );

  const pagosFijosContabilizados =
    pagosFijos.filter(
      (pago) =>
        pago.estadoTarjeta !==
        "pendiente",
    );

  const pagosFijosPendientes =
    pagosFijos.filter(
      (pago) =>
        pago.estadoTarjeta ===
        "pendiente",
    );

  const pagosContabilizados =
    pagos.filter(
      (pago) =>
        pago.estadoTarjeta !==
        "pendiente",
    );

  const pagosPendientesTarjeta =
    pagos.filter(
      (pago) =>
        pago.estadoTarjeta ===
        "pendiente",
    );

  /**
 * Solo las transacciones contabilizadas modifican
 * el saldo oficial de la tarjeta.
 */
  const comprasDesdeSaldo =
    sumarComprasDesdeSaldo(
      tarjeta,
      gastosContabilizados,
    );

  const cargosFijosDesdeSaldo =
    sumarCargosFijosDesdeSaldo(
      tarjeta,
      pagosFijosContabilizados,
    );

  const pagosDesdeSaldo =
    sumarPagosDesdeSaldo(
      tarjeta,
      pagosContabilizados,
    );

  /**
   * Las pendientes se calculan aparte.
   */
  const comprasPendientes =
    sumarComprasDesdeSaldo(
      tarjeta,
      gastosPendientes,
    );

  const cargosFijosPendientes =
    sumarCargosFijosDesdeSaldo(
      tarjeta,
      pagosFijosPendientes,
    );

  const pagosPendientes =
    sumarPagosDesdeSaldo(
      tarjeta,
      pagosPendientesTarjeta,
    );

  const totalCargosPendientes =
    redondearMoneda(
      comprasPendientes +
      cargosFijosPendientes,
    );

  const saldoCalculado =
    redondearMoneda(
      tarjeta.saldoInicial +
      comprasDesdeSaldo +
      cargosFijosDesdeSaldo -
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

  /**
 * Saldo esperado cuando las transacciones pendientes
 * terminen de contabilizarse.
 *
 * Este valor NO sustituye saldoActual.
 */
  const saldoProyectadoCalculado =
    redondearMoneda(
      saldoCalculado +
      totalCargosPendientes -
      pagosPendientes,
    );

  const saldoProyectado =
    redondearMoneda(
      Math.max(
        saldoProyectadoCalculado,
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
      gastosContabilizados,
      pagosFijosContabilizados,
      pagosContabilizados,
      fechaReferencia,
    );

  /**
   * 1C.2G
   */
  const actividadPosterior =
    evaluarActividadPosteriorCobertura(
      tarjeta,
      gastosContabilizados,
      pagosFijosContabilizados,
      pagosContabilizados,
      fechaReferencia,
      cobertura,
    );

  /**
* ============================================================
* 2B.2B
* MONTO QUE REALMENTE DEBE RESERVAR LA CUENTA
* ============================================================
*
* Separamos:
*
* 1. deuda contabilizada que ya está dentro de su ventana
*    de pago;
*
* 2. cargos pendientes, que todavía no forman parte del
*    saldo oficial pero ya representan dinero comprometido;
*
* 3. pagos pendientes, que todavía no han salido del banco
*    pero ya deben considerarse comprometidos.
*/

  const calendarioPago =
    calcularCalendarioPagoTarjeta(
      tarjeta.diaCorte,
      fechaReferencia,
    );

  const evaluacionPagoPrincipal =
    evaluarVentanaPagoTarjeta({
      calendario:
        calendarioPago,

      montoPagoTotal,

      activa:
        tarjeta.activa,
    });

  const evaluacionPagoAdicional =
    evaluarVentanaPagoTarjeta({
      calendario:
        calendarioPago,

      montoPagoTotal:
        actividadPosterior
          .saldoAdicionalAntesCorte,

      activa:
        tarjeta.activa,
    });

  /**
   * Parte CONTABILIZADA de la deuda que ya requiere
   * reserva bancaria según la ventana de pago.
   */
  let montoReservaContabilizada =
    0;

  /**
   * El pago principal todavía está pendiente.
   */
  if (
    !cobertura.corteCubierto &&
    evaluacionPagoPrincipal
      .requiereAccion &&
    montoPagoTotal >
    TOLERANCIA_SALDO
  ) {
    montoReservaContabilizada =
      montoPagoTotal;
  }

  /**
   * El pago principal ya fue cubierto, pero aparecieron
   * nuevos cargos contabilizados que también necesitan
   * pagarse antes del corte.
   */
  if (
    cobertura.corteCubierto &&
    actividadPosterior
      .requierePagoAdicionalAntesCorte &&
    evaluacionPagoAdicional
      .requiereAccion &&
    actividadPosterior
      .saldoAdicionalAntesCorte >
    TOLERANCIA_SALDO
  ) {
    montoReservaContabilizada =
      actividadPosterior
        .saldoAdicionalAntesCorte;
  }

  montoReservaContabilizada =
    redondearMoneda(
      Math.max(
        montoReservaContabilizada,
        0,
      ),
    );

  /**
   * ============================================================
   * 2B.2B — RESERVA INCLUYENDO TRANSACCIONES PENDIENTES
   * ============================================================
   *
   * Los cargos pendientes aumentan el dinero comprometido.
   *
   * Los pagos pendientes representan dinero que todavía
   * aparece en el banco, pero que ya está en proceso de salir.
   *
   * Usamos Math.max para evitar contar dos veces un pago
   * pendiente que precisamente está cubriendo la deuda
   * de la tarjeta.
   *
   * Ejemplo:
   *
   * deuda exigible              $486.45
   * pago pendiente              $486.45
   *
   * reserva real                $486.45
   *
   * NO $972.90.
   */
  const montoReservarCuenta =
    redondearMoneda(
      Math.max(
        montoReservaContabilizada +
        totalCargosPendientes,

        pagosPendientes,

        0,
      ),
    );

  return {
    tarjeta,

    comprasDesdeSaldo,
    cargosFijosDesdeSaldo,
    pagosDesdeSaldo,

    comprasPendientes,
    cargosFijosPendientes,
    pagosPendientes,
    totalCargosPendientes,
    saldoProyectado,

    saldoActual,
    creditoAFavor,
    montoPagoTotal,
    montoReservarCuenta,
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
  pagosFijos,
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
                pagosFijos,
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
        pagosFijos,
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
    useMemo
      (
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

  const totalCargosFijos =
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
                .cargosFijosDesdeSaldo,
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
    totalCargosFijos,
    totalPagos,
    totalPagoAdicionalAntesCorte,
  };
}

export type CreditCardSummariesController =
  ReturnType<
    typeof useCreditCardSummaries
  >;