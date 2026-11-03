import type { Quincena } from "./types";
import type { AsignacionPresupuestaria } from "./pay-cycles";
import { fechaInputLocal, obtenerFechaCalendarioDesdeISO } from "./utils";

export interface CoberturaPresupuestaria { inicio: string; fin: string }

/** Food and gas always belong to the calendar half containing their date. */
export function asignarFechaAPresupuesto(fechaISO: string): AsignacionPresupuestaria | null {
  const fecha = obtenerFechaCalendarioDesdeISO(fechaISO);
  if (!fecha) return null;
  return { periodoPresupuestario: fecha.slice(0, 7), quincenaPresupuestaria: Number(fecha.slice(8)) <= 15 ? 1 : 2 };
}

export function obtenerCoberturaPresupuestaria(
  periodo: string, quincena: Quincena,
): CoberturaPresupuestaria | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return null;
  const [year, month] = periodo.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { inicio: `${periodo}-${quincena === 1 ? "01" : "16"}`, fin: `${periodo}-${quincena === 1 ? "15" : ultimoDia}` };
}

export function fechaSugeridaParaCobertura(cobertura: CoberturaPresupuestaria, hoy = fechaInputLocal()): string {
  return hoy >= cobertura.inicio && hoy <= cobertura.fin ? hoy : cobertura.inicio;
}
