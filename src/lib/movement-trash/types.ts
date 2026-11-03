export const COLECCIONES_RECUPERABLES = ["gastos", "pagosTarjeta", "pagosFijos", "movimientosCuenta", "ingresos"] as const;
export type ColeccionRecuperable = typeof COLECCIONES_RECUPERABLES[number];

export interface MovimientoEliminado {
  id: string;
  coleccion: ColeccionRecuperable;
  documentoId: string;
  concepto: string;
  monto: number | null;
  fecha: string;
  eliminadoEn: string;
}
export interface PaginaPapelera {
  movimientos: MovimientoEliminado[];
  siguiente: string | null;
}

export function esColeccionRecuperable(value: unknown): value is ColeccionRecuperable {
  return typeof value === "string" && (COLECCIONES_RECUPERABLES as readonly string[]).includes(value);
}
export function esIdDocumento(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1500
    && value !== "." && value !== ".." && !/[\/\u0000-\u001f]/.test(value) && !/^__.*__$/.test(value);
}
export const ETIQUETAS_PAPELERA: Record<ColeccionRecuperable, string> = {
  gastos: "Gasto", pagosTarjeta: "Pago a tarjeta", pagosFijos: "Pago fijo", movimientosCuenta: "Movimiento de cuenta", ingresos: "Ingreso",
};
