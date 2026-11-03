export const COLECCIONES_HISTORIAL = ["gastos", "pagosTarjeta", "pagosFijos", "movimientosCuenta", "ingresos", "metasAhorro", "tarjetasCredito", "compromisosFijos", "configuracion", "cuentas"] as const;
export type ColeccionHistorial = typeof COLECCIONES_HISTORIAL[number];
export type AccionHistorial = "creado" | "editado" | "eliminado" | "recuperado" | "recalibrado";
export interface EventoHistorial {
  actorUid: string; coleccion: ColeccionHistorial; documentoId: string; accion: AccionHistorial;
  antes: Record<string, unknown> | null; despues: Record<string, unknown> | null; fecha: unknown;
}
export const ETIQUETAS_HISTORIAL: Record<ColeccionHistorial, string> = {
  gastos: "Gasto", pagosTarjeta: "Pago a tarjeta", pagosFijos: "Pago fijo", movimientosCuenta: "Movimiento de cuenta", ingresos: "Ingreso",
  metasAhorro: "Meta de ahorro", tarjetasCredito: "Tarjeta", compromisosFijos: "Compromiso fijo", configuracion: "Configuración", cuentas: "Cuenta bancaria",
};
export function esColeccionHistorial(value: unknown): value is ColeccionHistorial {
  return typeof value === "string" && (COLECCIONES_HISTORIAL as readonly string[]).includes(value);
}
export const CAMPOS_HISTORIAL: Record<string, string> = {
  concepto: "Concepto", descripcion: "Descripción", nombre: "Nombre", monto: "Monto", fecha: "Fecha", categoria: "Categoría de presupuesto",
  categoriaTarjetaNombre: "Categoría de tarjeta", comentario: "Comentario", metodoPago: "Método de pago", metodo: "Método de pago",
  estadoTarjeta: "Estado en la tarjeta", origenFondos: "Cuenta de origen", tarjetaId: "Tarjeta", compromisoId: "Compromiso fijo",
  referencia: "Referencia", notas: "Notas", fechaProgramada: "Fecha programada", fechaRecibida: "Fecha recibida", estado: "Estado",
  direccion: "Dirección", objetivo: "Objetivo de ahorro", apartado: "Dinero apartado", fechaObjetivo: "Fecha objetivo", archivada: "Archivada",
  saldoInicial: "Saldo base", fechaSaldoInicial: "Fecha del saldo base", limiteCredito: "Límite de crédito", ultimosCuatro: "Últimos cuatro dígitos",
  diaCorte: "Día de corte", diaPago: "Día de pago", activa: "Activa", activo: "Activo", estrategiaPago: "Estrategia de pago", pagoObjetivo: "Pago objetivo",
  diaVencimiento: "Día de vencimiento", quincenaPresupuestaria: "Quincena", prioridad: "Prioridad", metodoPagoPreferido: "Método preferido",
  limites: "Límites del presupuesto", montoEstimado: "Ingreso estimado", frecuencia: "Frecuencia", fechaAncla: "Fecha ancla", intervaloDias: "Intervalo de días",
  fuente: "Fuente", recurrente: "Recurrente", periodicidad: "Periodicidad",
};

function canonico(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonico);
  if (value && typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString();
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonico(item)]));
  }
  return value;
}
export function cambiosHistorial(antes: Record<string, unknown> | null, despues: Record<string, unknown> | null) {
  return Object.entries(CAMPOS_HISTORIAL).flatMap(([campo, etiqueta]) =>
    JSON.stringify(canonico(antes?.[campo])) === JSON.stringify(canonico(despues?.[campo])) ? []
      : [{ campo, etiqueta, antes: antes?.[campo] ?? null, despues: despues?.[campo] ?? null }]);
}
export function mismosDatosHistorial(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));
}
export function mezclarDatos(antes: Record<string, unknown>, cambios: Record<string, unknown>): Record<string, unknown> {
  const resultado = { ...antes };
  for (const [campo, valor] of Object.entries(cambios)) {
    if (valor && typeof valor === "object" && Object.getPrototypeOf(valor) === Object.prototype && Object.keys(valor).length) {
      const anterior = resultado[campo];
      resultado[campo] = mezclarDatos(anterior && typeof anterior === "object" && Object.getPrototypeOf(anterior) === Object.prototype ? anterior as Record<string, unknown> : {}, valor as Record<string, unknown>);
    } else resultado[campo] = valor;
  }
  return resultado;
}
