import type { ConfiguracionIngreso, Quincena } from "./types";
import {
  agregarDiasUTC, convertirAFechaUTC, convertirFechaAISO,
  obtenerAsignacionPresupuestaria, obtenerPagoEnOAntesDe,
  type AsignacionPresupuestaria,
} from "./pay-cycles";
import { fechaInputLocal, obtenerFechaCalendarioDesdeISO } from "./utils";

export interface ReglaPresupuestaria {
  fechaAncla: string;
  intervaloDias: number;
}
export interface CoberturaPresupuestaria { inicio: string; fin: string }

/** Other income frequencies keep the existing calendar behavior. */
export function obtenerReglaPresupuestaria(configuracion?: ConfiguracionIngreso | null): ReglaPresupuestaria | null {
  if (!configuracion?.activa || configuracion.frecuencia !== "cada_2_semanas" ||
      (configuracion.intervaloDias ?? 14) !== 14) return null;
  try {
    return { fechaAncla: convertirFechaAISO(configuracion.fechaAncla), intervaloDias: 14 };
  } catch { return null; }
}

/** A purchase belongs to the cycle that was open on its actual calendar date. */
export function asignarFechaAPresupuesto(fechaISO: string, regla?: ReglaPresupuestaria | null): AsignacionPresupuestaria | null {
  const fecha = obtenerFechaCalendarioDesdeISO(fechaISO);
  if (!fecha) return null;
  if (!regla) return { periodoPresupuestario: fecha.slice(0, 7), quincenaPresupuestaria: Number(fecha.slice(8)) <= 15 ? 1 : 2 };
  const pago = obtenerPagoEnOAntesDe(fecha, regla.fechaAncla, regla.intervaloDias);
  return obtenerAsignacionPresupuestaria(pago, regla.fechaAncla, regla.intervaloDias);
}

/** Inverse assignment; each budget month contains two consecutive pay cycles. */
export function obtenerCoberturaPresupuestaria(
  periodo: string, quincena: Quincena, regla?: ReglaPresupuestaria | null,
): CoberturaPresupuestaria | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return null;
  const [year, month] = periodo.split("-").map(Number);
  if (!regla) {
    const ultimoDia = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { inicio: `${periodo}-${quincena === 1 ? "01" : "16"}`, fin: `${periodo}-${quincena === 1 ? "15" : ultimoDia}` };
  }
  const ancla = convertirAFechaUTC(regla.fechaAncla);
  const periodoAncla = obtenerAsignacionPresupuestaria(ancla, ancla, regla.intervaloDias).periodoPresupuestario;
  const [anchorYear, anchorMonth] = periodoAncla.split("-").map(Number);
  const desplazamiento = ((year - anchorYear) * 12 + month - anchorMonth) * 2 + quincena - 1;
  const inicio = agregarDiasUTC(ancla, desplazamiento * regla.intervaloDias);
  return { inicio: convertirFechaAISO(inicio), fin: convertirFechaAISO(agregarDiasUTC(inicio, regla.intervaloDias - 1)) };
}

export function fechaSugeridaParaCobertura(cobertura: CoberturaPresupuestaria, hoy = fechaInputLocal()): string {
  return hoy >= cobertura.inicio && hoy <= cobertura.fin ? hoy : cobertura.inicio;
}
