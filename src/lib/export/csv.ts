import { esFechaCalendarioValida } from "@/lib/budget/expense-account/validation";
import { redondearMoneda } from "@/lib/budget/expense-account/utils";
import { etiquetaOrigenFondosPago } from "@/lib/budget/payment-origin";
import { normalizarEstadoTarjeta } from "@/lib/budget/budget-data-normalizers";
import type { FilaExportacion, OpcionesExportacion, RegistroExportable } from "./types";

const texto = (value: unknown): string => typeof value === "string" ? value : "";
const formateadores = new Map<string, Intl.DateTimeFormat>();
export function validarOpcionesExportacion(params: URLSearchParams): OpcionesExportacion {
  const desde = params.get("desde"); const hasta = params.get("hasta");
  if (!esFechaCalendarioValida(desde) || !esFechaCalendarioValida(hasta) || desde > hasta) {
    throw new Error("Selecciona un intervalo de fechas válido, con el inicio anterior o igual al final.");
  }
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000 + 1;
  if (dias > 366) throw new Error("Exporta hasta 366 días por archivo.");
  const zonaHoraria = params.get("zonaHoraria") || "America/New_York";
  try {
    if (zonaHoraria.length > 100) throw new Error();
    new Intl.DateTimeFormat("en-US", { timeZone: zonaHoraria });
  } catch { throw new Error("La zona horaria no es válida."); }
  const formato = params.get("formato") || "movimientos";
  if (formato !== "movimientos" && formato !== "resumen") throw new Error("El tipo de exportación no es válido.");
  return { desde, hasta, zonaHoraria, formato };
}

/** Calendar dates remain literal; instants use the same time zone as the user's screen. */
export function fechaDeExportacion(value: unknown, zonaHoraria: string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return esFechaCalendarioValida(value) ? value : "";
  if (typeof value === "string" && !esFechaCalendarioValida(value.slice(0, 10))) return "";
  let fecha: Date | null = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!fecha && value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const convertido: unknown = value.toDate();
    fecha = convertido instanceof Date ? convertido : null;
  }
  if (!fecha || !Number.isFinite(fecha.getTime())) return "";
  let formato = formateadores.get(zonaHoraria);
  if (!formato) {
    formato = new Intl.DateTimeFormat("en-US", { timeZone: zonaHoraria, year: "numeric", month: "2-digit", day: "2-digit" });
    formateadores.set(zonaHoraria, formato);
  }
  const partes = formato.formatToParts(fecha);
  return ["year", "month", "day"].map(tipo => partes.find(parte => parte.type === tipo)?.value.padStart(tipo === "year" ? 4 : 2, "0")).join("-");
}

export function prepararFilasExportacion(registros: RegistroExportable[], opciones: OpcionesExportacion, tarjetas: ReadonlyMap<string, string> = new Map()): FilaExportacion[] {
  const filas: FilaExportacion[] = [];
  const vistos = new Set<string>();
  for (const { id, coleccion, datos: data } of registros) {
    const clave = `${coleccion}/${id}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const ingreso = coleccion === "ingresos";
    const fechaProgramada = fechaDeExportacion(data.fechaProgramada, opciones.zonaHoraria);
    const fechaRecibida = fechaDeExportacion(data.fechaRecibida, opciones.zonaHoraria);
    const fecha = ingreso ? data.estado === "recibido" ? fechaRecibida : fechaProgramada : fechaDeExportacion(data.fecha, opciones.zonaHoraria);
    if (!fecha || fecha < opciones.desde || fecha > opciones.hasta) continue;
    const monto = typeof data.monto === "number" ? data.monto : typeof data.monto === "string" && data.monto.trim() ? Number(data.monto) : NaN;
    const tarjetaId = texto(data.tarjetaId).trim();
    const esPago = coleccion === "pagosTarjeta";
    const esFijo = coleccion === "pagosFijos";
    const esManual = coleccion === "movimientosCuenta";
    const usaTarjeta = esPago || (esFijo ? data.metodo === "tarjeta" : data.metodoPago === "tarjeta_credito") && Boolean(tarjetaId);
    const categoria = data.categoria === "comida" ? "Comida" : data.categoria === "gas" ? "Gas" : coleccion === "gastos" ? "Sin presupuesto" : "";
    filas.push({ id, coleccion, fecha, concepto: texto(data.concepto) || texto(data.descripcion) || texto(data.tarjeta) || "Movimiento",
      monto: Number.isFinite(monto) ? redondearMoneda(monto) : null,
      tipo: ingreso ? "Ingreso" : esPago ? "Pago a tarjeta" : esFijo ? "Pago fijo" : esManual ? "Movimiento de cuenta" : "Gasto",
      direccion: ingreso ? "Entrada" : esManual ? data.direccion === "entrada" ? "Entrada" : data.direccion === "salida" ? "Salida" : "Sin dirección válida" : "Salida",
      categoria, categoriaTarjeta: texto(data.categoriaTarjetaNombre),
      metodo: esPago ? "Pago a tarjeta" : esFijo ? texto(data.metodo) : esManual || ingreso ? "Cuenta bancaria" : texto(data.metodoPago) || "Sin método registrado",
      estado: ingreso ? texto(data.estado) : usaTarjeta ? esFijo ? "contabilizada" : normalizarEstadoTarjeta(data.estadoTarjeta, true) || "" : "registrado",
      origen: esPago ? etiquetaOrigenFondosPago(data.origenFondos) : "", tarjetaId,
      tarjeta: tarjetas.get(tarjetaId) || (tarjetaId ? "Tarjeta sin nombre disponible" : ""),
      compromisoId: texto(data.compromisoId), referencia: texto(data.referencia), notas: [texto(data.comentario), texto(data.notas)].filter(Boolean).join("\n"),
      fechaProgramada, fechaRecibida });
  }
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.coleccion.localeCompare(b.coleccion) || a.id.localeCompare(b.id));
}

/** Quote every field, preserve multiline text and prevent spreadsheet formulas in user text. */
export function celdaCSV(value: string | number | null): string {
  let contenido = value === null ? "" : typeof value === "number" ? value.toFixed(2) : value;
  if (typeof value === "string" && /^[\s\u0000-\u001f\u007f\uFEFF]*[=+\-@]/.test(contenido)) contenido = `'${contenido}`;
  return `"${contenido.replaceAll('"', '""')}"`;
}
function documentoCSV(filas: Array<Array<string | number | null>>): string {
  return "\uFEFF" + filas.map(fila => fila.map(celdaCSV).join(",")).join("\r\n") + "\r\n";
}
export function generarCSV(filas: FilaExportacion[], formato: OpcionesExportacion["formato"]): string {
  if (formato === "movimientos") return documentoCSV([
    ["Fecha", "Tipo", "Concepto", "Monto USD", "Dirección", "Categoría de presupuesto", "Categoría de tarjeta", "Método", "Estado", "Cuenta de origen", "Tarjeta", "Tarjeta ID", "Compromiso ID", "Referencia", "Notas", "Movimiento ID", "Colección", "Fecha programada", "Fecha recibida"],
    ...filas.map(fila => [fila.fecha, fila.tipo, fila.concepto, fila.monto, fila.direccion, fila.categoria, fila.categoriaTarjeta, fila.metodo,
      fila.estado, fila.origen, fila.tarjeta, fila.tarjetaId, fila.compromisoId, fila.referencia, fila.notas, fila.id, fila.coleccion, fila.fechaProgramada, fila.fechaRecibida]),
  ]);
  const grupos = new Map<string, { campos: string[]; cantidad: number; sinMonto: number; centavos: number }>();
  for (const fila of filas) {
    const campos = [fila.fecha.slice(0, 7), Number(fila.fecha.slice(8)) <= 15 ? "Q1 (1–15)" : "Q2 (16–fin)", fila.tipo,
      fila.direccion, fila.categoria, fila.categoriaTarjeta, fila.estado, fila.origen];
    const key = JSON.stringify(campos);
    const grupo = grupos.get(key) || { campos, cantidad: 0, sinMonto: 0, centavos: 0 };
    grupo.cantidad++;
    if (fila.monto === null) grupo.sinMonto++;
    else grupo.centavos += Math.round(fila.monto * 100);
    grupos.set(key, grupo);
  }
  return documentoCSV([
    ["Mes", "Quincena calendario", "Tipo", "Dirección", "Categoría de presupuesto", "Categoría de tarjeta", "Estado", "Cuenta de origen", "Cantidad de registros", "Total registrado USD", "Registros sin importe válido"],
    ...Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, grupo]) => [...grupo.campos, String(grupo.cantidad), grupo.centavos / 100, String(grupo.sinMonto)]),
  ]);
}
