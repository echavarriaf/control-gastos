export const COLECCIONES_EXPORTABLES = ["gastos", "pagosTarjeta", "pagosFijos", "movimientosCuenta", "ingresos"] as const;
export type ColeccionExportable = typeof COLECCIONES_EXPORTABLES[number];
export interface OpcionesExportacion { desde: string; hasta: string; zonaHoraria: string; formato: "movimientos" | "resumen" }
export interface RegistroExportable { id: string; coleccion: ColeccionExportable; datos: Record<string, unknown> }
export interface FilaExportacion {
  id: string; coleccion: ColeccionExportable; fecha: string; concepto: string; monto: number | null;
  tipo: string; direccion: string; categoria: string; categoriaTarjeta: string; metodo: string; estado: string;
  origen: string; tarjetaId: string; tarjeta: string; compromisoId: string; referencia: string; notas: string;
  fechaProgramada: string; fechaRecibida: string;
}
