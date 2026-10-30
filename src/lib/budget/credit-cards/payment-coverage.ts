// Cobertura del corte y actividad posterior al pago principal.
import type {
  ActividadPosteriorCobertura,
  CoberturaCorteTarjeta,
  MovimientoCronologicoTarjeta,
  PagoPrincipalCorteDetectado,
} from "./types";
import { TOLERANCIA_SALDO, redondearMoneda } from "./money";
import type { GastoVariable, PagoFijo, PagoTarjeta, TarjetaCredito } from "@/lib/budget/types";
import {
  calcularCalendarioPagoTarjeta,
  fechaCalendarioAISO,
} from "@/lib/budget/credit-card-payment-calendar";
import { construirMovimientosTarjeta } from "./timeline";

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
export function evaluarCoberturaCorte(
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
export function evaluarActividadPosteriorCobertura(
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
