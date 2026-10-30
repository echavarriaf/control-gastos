// Cálculos de pago de tarjetas para push, sin acceso a Firestore ni FCM.
import type {
  CalcularEstadoPagoTarjetaArgs,
  CalcularSaldoAdicionalArgs,
  CoberturaPrincipalPush,
  EstadoPagoTarjetaPush,
  EstadoVentanaTarjeta,
  EvaluarCoberturaPrincipalArgs,
  MovimientoTarjetaPush,
  PagoPrincipalDetectadoPush,
  TarjetaPush,
} from "./types";
import { calcularCalendarioTarjeta } from "./dates";
import { redondearMoneda } from "./utils";
import { TOLERANCIA_SALDO } from "./constants";

export function calcularEstadoPagoTarjeta({
  tarjeta,
  movimientos,
  hoyISO,
}: CalcularEstadoPagoTarjetaArgs): EstadoPagoTarjetaPush {
  const calendario =
    calcularCalendarioTarjeta(
      tarjeta.diaCorte,
      hoyISO,
    );

  const movimientosOrdenados =
    movimientos
      .filter(
        (
          movimiento,
        ) =>
          movimiento.fecha >=
            tarjeta.fechaSaldoInicial &&
          movimiento.fecha <=
            hoyISO,
      )
      .sort(
        ordenarMovimientosTarjeta,
      );

  const saldoActual =
    calcularSaldoActualTarjeta(
      tarjeta,
      movimientosOrdenados,
    );

  const dentroVentana =
    calendario
      .diasHastaPagoObjetivo <=
      0 &&
    calendario
      .diasHastaCorte >=
      0;

  const estadoVentana:
    EstadoVentanaTarjeta | null =
      !dentroVentana
        ? null
        : calendario
              .diasHastaCorte ===
            0
          ? "corte_hoy"
          : "pagar_ahora";

  if (
    !tarjeta.activa ||
    !dentroVentana ||
    !estadoVentana
  ) {
    return {
      calendario,

      saldoActual,

      corteCubierto:
        false,

      montoPrincipal:
        0,

      montoAdicional:
        0,

      requierePrincipal:
        false,

      requiereAdicional:
        false,

      estadoVentana:
        null,
    };
  }

  const cobertura =
    evaluarCoberturaPrincipal({
      tarjeta,

      movimientos:
        movimientosOrdenados,

      hoyISO,

      calendario,
    });

  if (
    !cobertura
      .corteCubierto
  ) {
    const montoPrincipal =
      redondearMoneda(
        Math.max(
          saldoActual,
          0,
        ),
      );

    return {
      calendario,

      saldoActual,

      corteCubierto:
        false,

      montoPrincipal,

      montoAdicional:
        0,

      requierePrincipal:
        montoPrincipal >
        TOLERANCIA_SALDO,

      requiereAdicional:
        false,

      estadoVentana,
    };
  }

  const montoAdicional =
    calcularSaldoAdicional({
      movimientos:
        movimientosOrdenados,

      hoyISO,

      calendario,

      cobertura,
    });

  return {
    calendario,

    saldoActual,

    corteCubierto:
      true,

    montoPrincipal:
      0,

    montoAdicional,

    requierePrincipal:
      false,

    requiereAdicional:
      montoAdicional >
      TOLERANCIA_SALDO,

    estadoVentana,
  };
}

function calcularSaldoActualTarjeta(
  tarjeta:
    TarjetaPush,

  movimientos:
    MovimientoTarjetaPush[],
): number {
  let saldo =
    redondearMoneda(
      tarjeta.saldoInicial,
    );

  for (
    const movimiento of
    movimientos
  ) {
    saldo =
      redondearMoneda(
        movimiento.tipo ===
        "gasto"
          ? saldo +
              movimiento.monto
          : saldo -
              movimiento.monto,
      );
  }

  return redondearMoneda(
    Math.max(
      saldo,
      0,
    ),
  );
}

function evaluarCoberturaPrincipal({
  tarjeta,
  movimientos,
  hoyISO,
  calendario,
}: EvaluarCoberturaPrincipalArgs): CoberturaPrincipalPush {
  const fechaObjetivoISO =
    calendario
      .fechaObjetivoPagoISO;

  const fechaCorteISO =
    calendario
      .fechaCorteISO;

  let saldo =
    redondearMoneda(
      tarjeta.saldoInicial,
    );

  let ultimoPagoAnterior:
    PagoPrincipalDetectadoPush | null =
      null;

  for (
    const movimiento of
    movimientos
  ) {
    if (
      movimiento.fecha >=
      fechaObjetivoISO
    ) {
      break;
    }

    if (
      movimiento.fecha >
      hoyISO
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
      ultimoPagoAnterior =
        crearPagoPrincipalPush(
          movimiento,
          saldoAntesPago,
          saldo,
        );
    }
  }

  const saldoAlInicioVentana =
    redondearMoneda(
      Math.max(
        saldo,
        0,
      ),
    );

  if (
    saldoAlInicioVentana <=
    TOLERANCIA_SALDO
  ) {
    return {
      corteCubierto:
        true,

      pagoPrincipal:
        ultimoPagoAnterior,
    };
  }

  for (
    const movimiento of
    movimientos
  ) {
    if (
      movimiento.fecha <
      fechaObjetivoISO
    ) {
      continue;
    }

    if (
      movimiento.fecha >
      hoyISO
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
        corteCubierto:
          true,

        pagoPrincipal:
          crearPagoPrincipalPush(
            movimiento,
            saldoAntesPago,
            saldo,
          ),
      };
    }
  }

  return {
    corteCubierto:
      false,

    pagoPrincipal:
      null,
  };
}

function crearPagoPrincipalPush(
  movimiento:
    MovimientoTarjetaPush,

  saldoAntesPago:
    number,

  saldoDespuesPago:
    number,
): PagoPrincipalDetectadoPush {
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

function calcularSaldoAdicional({
  movimientos,
  hoyISO,
  calendario,
  cobertura,
}: CalcularSaldoAdicionalArgs): number {
  let indiceInicio =
    0;

  if (
    cobertura.pagoPrincipal
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
              .pagoPrincipal
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
      indiceInicio =
        obtenerIndiceInicioPorFecha(
          movimientos,
          calendario
            .fechaObjetivoPagoISO,
        );
    }
  } else {
    indiceInicio =
      obtenerIndiceInicioPorFecha(
        movimientos,
        calendario
          .fechaObjetivoPagoISO,
      );
  }

  let saldoPosterior =
    cobertura
      .pagoPrincipal
      ?.saldoDespuesPago ??
    0;

  for (
    let index =
      indiceInicio;

    index <
    movimientos.length;

    index +=
      1
  ) {
    const movimiento =
      movimientos[
        index
      ];

    if (
      movimiento.fecha >
      hoyISO
    ) {
      break;
    }

    if (
      movimiento.fecha >
      calendario
        .fechaCorteISO
    ) {
      break;
    }

    saldoPosterior =
      redondearMoneda(
        movimiento.tipo ===
        "gasto"
          ? saldoPosterior +
              movimiento.monto
          : saldoPosterior -
              movimiento.monto,
      );
  }

  return redondearMoneda(
    Math.max(
      saldoPosterior,
      0,
    ),
  );
}

function obtenerIndiceInicioPorFecha(
  movimientos:
    MovimientoTarjetaPush[],

  fechaISO:
    string,
): number {
  const index =
    movimientos.findIndex(
      (
        movimiento,
      ) =>
        movimiento.fecha >=
        fechaISO,
    );

  return index >=
    0
    ? index
    : movimientos.length;
}

function ordenarMovimientosTarjeta(
  a:
    MovimientoTarjetaPush,

  b:
    MovimientoTarjetaPush,
): number {
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
}
