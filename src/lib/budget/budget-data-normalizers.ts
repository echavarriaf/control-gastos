import type {
  EstadoTransaccionTarjeta,
  MetodoPagoMovimiento,
} from "@/lib/budget/types";

export interface RegistroOrdenable {
  id: string;
  fecha: string;
  creadoEn: string;
}

/**
 * Convierte creadoEn de Firestore a ISO.
 *
 * Acepta:
 * - string ya normalizado;
 * - objetos compatibles con Timestamp que expongan toDate();
 * - fallback cuando el valor no sea válido.
 *
 * No importa Firebase para mantener este módulo puro y testeable.
 */
export function normalizarCreadoEn(
  value: unknown,
  fallback: string,
): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const fecha =
      value.toDate();

    if (
      fecha instanceof Date &&
      !Number.isNaN(
        fecha.getTime(),
      )
    ) {
      return fecha.toISOString();
    }
  }

  return fallback;
}

/**
 * Normaliza la referencia de tarjeta.
 */
export function normalizarTarjetaId(
  value: unknown,
): string | null {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  )
    ? value.trim()
    : null;
}

/**
 * Normaliza el método usado por un movimiento variable.
 */
export function normalizarMetodoMovimiento(
  value: unknown,
): MetodoPagoMovimiento | undefined {
  return (
    value === "efectivo" ||
    value === "debito" ||
    value === "cuenta_bancaria" ||
    value === "tarjeta_credito"
  )
    ? value
    : undefined;
}

/**
 * Compatibilidad de estado de tarjeta.
 *
 * - Sin tarjeta -> null.
 * - pendiente -> pendiente.
 * - contabilizada -> contabilizada.
 * - histórico sin estado -> contabilizada.
 * - valor inválido en una transacción de tarjeta -> contabilizada.
 */
export function normalizarEstadoTarjeta(
  value: unknown,
  usaTarjeta: boolean,
): EstadoTransaccionTarjeta | null {
  if (!usaTarjeta) {
    return null;
  }

  if (
    value === "pendiente" ||
    value === "contabilizada"
  ) {
    return value;
  }

  return "contabilizada";
}

/**
 * Historial:
 *
 * 1. fecha financiera descendente;
 * 2. fecha/hora de creación descendente;
 * 3. id descendente como desempate estable.
 */
export function ordenarPorFechaYCreacion<
  T extends RegistroOrdenable,
>(
  a: T,
  b: T,
): number {
  const diferenciaFecha =
    new Date(
      b.fecha,
    ).getTime() -
    new Date(
      a.fecha,
    ).getTime();

  if (
    diferenciaFecha !== 0
  ) {
    return diferenciaFecha;
  }

  const diferenciaCreacion =
    new Date(
      b.creadoEn,
    ).getTime() -
    new Date(
      a.creadoEn,
    ).getTime();

  if (
    diferenciaCreacion !== 0
  ) {
    return diferenciaCreacion;
  }

  return b.id.localeCompare(
    a.id,
  );
}