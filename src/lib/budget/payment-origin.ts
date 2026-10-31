import type { OrigenFondosPago } from "./types";

/** Only an explicit external source can exclude a historical payment from bank cash. */
export function normalizarOrigenFondosPago(value: unknown): OrigenFondosPago {
  return value === "cuenta_externa" ? "cuenta_externa" : "cuenta_gastos";
}

export function validarOrigenFondosPago(value: unknown): OrigenFondosPago {
  if (value === undefined) return "cuenta_gastos";
  if (value === "cuenta_gastos" || value === "cuenta_externa") return value;
  throw new Error("Selecciona un origen válido para el pago.");
}

export function pagoTarjetaSaleDeCuenta(pago: { origenFondos?: unknown }): boolean {
  return normalizarOrigenFondosPago(pago.origenFondos) === "cuenta_gastos";
}

export function etiquetaOrigenFondosPago(value: unknown): string {
  return normalizarOrigenFondosPago(value) === "cuenta_externa" ? "Otra cuenta externa" : "Cuenta configurada";
}
