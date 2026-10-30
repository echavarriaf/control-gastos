// Validación de entradas y compatibilidad de documentos históricos de la cuenta.
import { EXPENSE_ACCOUNT_ID, SALDO_MAXIMO, SALDO_MINIMO } from "./constants";
import { redondearMoneda } from "./utils";
import type {
  CuentaGastos,
  GuardarCuentaGastosInput,
  GuardarMovimientoManualCuentaInput,
  MovimientoManualCuenta,
} from "./types";

function esObjeto(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
    "object" &&
    value !== null
  );
}

export function esFechaCalendarioValida(
  value: unknown,
): value is string {
  if (
    typeof value !==
    "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }

  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  const fecha =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  return (
    fecha.getUTCFullYear() ===
    year &&
    fecha.getUTCMonth() + 1 ===
    month &&
    fecha.getUTCDate() ===
    day
  );
}

function normalizarSaldo(
  value: unknown,
): number | null {
  const numero =
    Number(value);

  if (
    !Number.isFinite(
      numero,
    ) ||
    numero <
    SALDO_MINIMO ||
    numero >
    SALDO_MAXIMO
  ) {
    return null;
  }

  return redondearMoneda(
    numero,
  );
}

function normalizarIds(
  value: unknown,
): string[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(
          (
            item,
          ): item is string =>
            typeof item ===
            "string" &&
            item
              .trim()
              .length >
            0,
        )
        .map(
          (item) =>
            item.trim(),
        ),
    ),
  ];
}

export function validarCuentaGastos(
  input: unknown,
): GuardarCuentaGastosInput {
  if (
    !esObjeto(
      input,
    )
  ) {
    throw new Error(
      "Los datos de la cuenta no son válidos.",
    );
  }

  const nombre =
    typeof input.nombre ===
      "string"
      ? input.nombre.trim()
      : "";

  if (
    !nombre ||
    nombre.length >
    100
  ) {
    throw new Error(
      "El nombre de la cuenta debe contener entre 1 y 100 caracteres.",
    );
  }

  const saldoInicial =
    normalizarSaldo(
      input.saldoInicial,
    );

  if (
    saldoInicial ===
    null
  ) {
    throw new Error(
      "El saldo inicial de la cuenta no es válido.",
    );
  }

  if (
    !esFechaCalendarioValida(
      input
        .fechaSaldoInicial,
    )
  ) {
    throw new Error(
      "Selecciona una fecha válida para el saldo inicial.",
    );
  }

  const activa =
    input.activa ===
      undefined
      ? true
      : input.activa;

  if (
    typeof activa !==
    "boolean"
  ) {
    throw new Error(
      "El estado de la cuenta no es válido.",
    );
  }

  return {
    nombre,

    saldoInicial,

    fechaSaldoInicial:
      input
        .fechaSaldoInicial,

    activa,
  };
}

export function validarMovimientoManualCuenta(
  input: unknown,
): GuardarMovimientoManualCuentaInput {
  if (
    !esObjeto(
      input,
    )
  ) {
    throw new Error(
      "Los datos del movimiento no son válidos.",
    );
  }

  const direccion =
    input.direccion;

  if (
    direccion !==
    "entrada" &&
    direccion !==
    "salida"
  ) {
    throw new Error(
      "Selecciona si el movimiento es una entrada o una salida.",
    );
  }

  const concepto =
    typeof input.concepto ===
      "string"
      ? input.concepto.trim()
      : "";

  if (
    !concepto ||
    concepto.length >
    120
  ) {
    throw new Error(
      "El concepto debe contener entre 1 y 120 caracteres.",
    );
  }

  const monto =
    normalizarSaldo(
      input.monto,
    );

  if (
    monto ===
    null ||
    monto <=
    0
  ) {
    throw new Error(
      "El monto del movimiento debe ser mayor que cero.",
    );
  }

  if (
    !esFechaCalendarioValida(
      input.fecha,
    )
  ) {
    throw new Error(
      "Selecciona una fecha válida para el movimiento.",
    );
  }

  const notas =
    typeof input.notas ===
      "string"
      ? input.notas.trim()
      : "";

  if (
    notas.length >
    500
  ) {
    throw new Error(
      "Las notas no pueden exceder 500 caracteres.",
    );
  }

  return {
    direccion,

    concepto,

    monto,

    fecha:
      input.fecha,

    notas,
  };
}

export function normalizarMovimientoManualCuenta(
  id: string,
  data: unknown,
): MovimientoManualCuenta | null {
  if (
    !id.trim() ||
    !esObjeto(
      data,
    )
  ) {
    return null;
  }

  try {
    const movimiento =
      validarMovimientoManualCuenta(
        data,
      );

    return {
      id:
        id.trim(),

      ...movimiento,

      creadoEn:
        typeof data.creadoEn ===
          "string"
          ? data.creadoEn
          : undefined,

      actualizadoEn:
        typeof data.actualizadoEn ===
          "string"
          ? data.actualizadoEn
          : undefined,
    };
  } catch {
    return null;
  }
}

export function normalizarCuentaGastos(
  data: unknown,
): CuentaGastos | null {
  if (
    !esObjeto(
      data,
    )
  ) {
    return null;
  }

  try {
    const normalizada =
      validarCuentaGastos(
        data,
      );

    return {
      id:
        EXPENSE_ACCOUNT_ID,

      ...normalizada,

      ingresosIncluidosEnSaldoInicial:
        normalizarIds(
          data
            .ingresosIncluidosEnSaldoInicial,
        ),

      gastosIncluidosEnSaldoInicial:
        normalizarIds(
          data
            .gastosIncluidosEnSaldoInicial,
        ),

      pagosFijosIncluidosEnSaldoInicial:
        normalizarIds(
          data
            .pagosFijosIncluidosEnSaldoInicial,
        ),

      pagosTarjetaIncluidosEnSaldoInicial:
        normalizarIds(
          data
            .pagosTarjetaIncluidosEnSaldoInicial,
        ),
      movimientosManualesIncluidosEnSaldoInicial:
        normalizarIds(
          data
            .movimientosManualesIncluidosEnSaldoInicial,
        ),
    };
  } catch {
    return null;
  }
}
