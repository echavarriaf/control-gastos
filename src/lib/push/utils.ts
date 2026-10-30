// Conversión de valores, niveles de alerta y presentación monetaria.
import type { EstadoVentanaTarjeta, MovimientoPresupuestoNormalizado, NivelAlerta } from "./types";
import { ALERT_THRESHOLD, EXCEEDED_THRESHOLD } from "./constants";

export function normalizarFaseTarjeta(
  value:
    unknown,
): EstadoVentanaTarjeta | null {
  return (
    value ===
      "pagar_ahora" ||
    value ===
      "corte_hoy"
  )
    ? value
    : null;
}

/**
 * ============================================================
 * UTILIDADES
 * ============================================================
 */

export function obtenerNivelAlerta(
  porcentaje:
    number,
): NivelAlerta {
  if (
    porcentaje >=
    EXCEEDED_THRESHOLD
  ) {
    return "100";
  }

  if (
    porcentaje >=
    ALERT_THRESHOLD
  ) {
    return "90";
  }

  return "normal";
}

export function nivelNumerico(
  nivel:
    NivelAlerta,
): number {
  switch (
    nivel
  ) {
    case "100":
      return 2;

    case "90":
      return 1;

    default:
      return 0;
  }
}

export function normalizarNivel(
  value:
    unknown,
): NivelAlerta {
  if (
    value ===
      "90" ||
    value ===
      "100"
  ) {
    return value;
  }

  return "normal";
}

export function sumarMontos(
  movimientos:
    MovimientoPresupuestoNormalizado[],
): number {
  return movimientos.reduce(
    (
      total,
      movimiento,
    ) =>
      total +
      movimiento.monto,
    0,
  );
}

export function normalizarNumero(
  value:
    unknown,

  fallback:
    number,
): number {
  const numero =
    Number(
      value,
    );

  return (
    Number.isFinite(
      numero,
    ) &&
    numero >=
      0
  )
    ? numero
    : fallback;
}

export function redondearMoneda(
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

export function esObjeto(
  value:
    unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !==
      null
  );
}

export function esFidInvalido(
  code:
    string,
): boolean {
  return (
    code.includes(
      "installation-id-not-registered",
    ) ||
    code.includes(
      "registration-token-not-registered",
    ) ||
    code.includes(
      "invalid-registration-token",
    )
  );
}

export function formatoMoneda(
  value:
    number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      minimumFractionDigits:
        2,
    },
  ).format(
    value,
  );
}

export function obtenerMensajeError(
  error:
    unknown,
): string {
  return error instanceof
    Error
    ? error.message
    : "Error desconocido.";
}
