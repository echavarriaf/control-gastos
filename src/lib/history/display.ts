const moneda = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const monetarios = new Set(["monto", "objetivo", "apartado", "saldoInicial", "limiteCredito", "pagoObjetivo", "montoEstimado", "limites"]);
const enumerados = new Set(["categoria", "metodo", "metodoPago", "estado", "estadoTarjeta", "direccion", "origenFondos", "fuente", "frecuencia", "estrategiaPago", "periodicidad", "metodoPagoPreferido"]);
const etiquetas: Record<string, string> = { cuenta_gastos: "Cuenta configurada", cuenta_externa: "Otra cuenta externa", pendiente: "Pendiente",
  contabilizada: "Contabilizada", debito: "Débito", cuenta_bancaria: "Cuenta bancaria", efectivo: "Efectivo", tarjeta_credito: "Tarjeta de crédito",
  tarjeta: "Tarjeta", transferencia: "Transferencia", debito_automatico: "Débito automático", comida: "Comida", gas: "Gas", general: "General",
  entrada: "Entrada", salida: "Salida", recibido: "Recibido", proyectado: "Proyectado", cancelado: "Cancelado", cada_2_semanas: "Cada dos semanas",
  semanal: "Semanal", mensual: "Mensual", quincenal: "Quincenal", porCicloPago: "Por ciclo", saldo_completo: "Saldo completo", pago_objetivo: "Pago objetivo" };
export function fechaHistorial(value: unknown): string {
  let fecha: Date | null = typeof value === "string" ? new Date(value) : value instanceof Date ? value : null;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") fecha = value.toDate();
  return fecha instanceof Date && Number.isFinite(fecha.getTime())
    ? new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeStyle: "short" }).format(fecha) : "Fecha no disponible";
}
export function valorHistorial(campo: string, value: unknown, referencias: ReadonlyMap<string, string> = new Map()): string {
  if (value === null || value === undefined) return "Sin valor registrado";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return monetarios.has(campo) ? moneda.format(value) : String(value);
  if (typeof value === "string") {
    if (!value) return "Vacío";
    if (campo === "tarjetaId" || campo === "compromisoId") return referencias.get(`${campo}:${value}`) ?? "Referencia no disponible";
    if (campo.startsWith("fecha") && value.includes("T")) return fechaHistorial(value);
    return enumerados.has(campo) ? etiquetas[value] ?? value : value;
  }
  if (Array.isArray(value)) return value.map(item => valorHistorial(campo, item, referencias)).join(", ");
  if (typeof value === "object") {
    if ("toDate" in value) return fechaHistorial(value);
    return Object.entries(value).map(([key, item]) => `${etiquetas[key] ?? key}: ${valorHistorial(campo, item, referencias)}`).join(" · ");
  }
  return "Valor no disponible";
}
