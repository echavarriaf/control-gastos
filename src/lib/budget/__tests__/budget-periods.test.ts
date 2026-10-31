import { describe, expect, it } from "vitest";
import { asignarFechaAPresupuesto, fechaSugeridaParaCobertura, obtenerCoberturaPresupuestaria, obtenerReglaPresupuestaria } from "../budget-periods";
import { agregarDiasUTC, convertirFechaAISO } from "../pay-cycles";
import type { ConfiguracionIngreso } from "../types";

const regla = { fechaAncla: "2026-10-02", intervaloDias: 14 };
const config: ConfiguracionIngreso = { id: "ingresoPrincipal", descripcion: "Salario", montoEstimado: 1000,
  fuente: "salario", frecuencia: "cada_2_semanas", fechaAncla: regla.fechaAncla, intervaloDias: 14, activa: true, notas: "" };

describe("Pay-funded budget periods", () => {
  it.each([
    ["2026-10-01", "2026-09", 2], ["2026-10-02", "2026-10", 1], ["2026-10-15", "2026-10", 1],
    ["2026-10-16", "2026-10", 2], ["2026-10-29", "2026-10", 2],
    ["2026-10-30", "2026-11", 1], ["2026-11-12", "2026-11", 1],
    ["2026-11-13", "2026-11", 2], ["2026-11-26", "2026-11", 2], ["2026-11-27", "2026-12", 1],
  ])("assigns %s to %s Q%s", (fecha, periodo, quincena) => {
    expect(asignarFechaAPresupuesto(fecha, regla)).toEqual({ periodoPresupuestario: periodo, quincenaPresupuestaria: quincena });
  });

  it("calculates the full fourteen-day coverage including a third calendar paycheck", () => {
    expect(obtenerCoberturaPresupuestaria("2026-11", 1, regla)).toEqual({ inicio: "2026-10-30", fin: "2026-11-12" });
    expect(obtenerCoberturaPresupuestaria("2026-11", 2, regla)).toEqual({ inicio: "2026-11-13", fin: "2026-11-26" });
  });

  it("round-trips every day across years and DST without missing or overlapping cycles", () => {
    for (let day = -60; day < 430; day++) {
      const fecha = convertirFechaAISO(agregarDiasUTC(regla.fechaAncla, day));
      const assignment = asignarFechaAPresupuesto(fecha, regla);
      if (!assignment) throw new Error("Missing assignment");
      const coverage = obtenerCoberturaPresupuestaria(assignment.periodoPresupuestario, assignment.quincenaPresupuestaria, regla);
      if (!coverage) throw new Error("Missing coverage");
      expect(fecha >= coverage.inicio && fecha <= coverage.fin).toBe(true);
    }
  });

  it("preserves the leap day and assigns negative offsets before the anchor", () => {
    const leap = { fechaAncla: "2024-02-29", intervaloDias: 14 };
    expect(asignarFechaAPresupuesto("2024-02-29", leap)).toMatchObject({ periodoPresupuestario: "2024-03", quincenaPresupuestaria: 1 });
    expect(obtenerCoberturaPresupuestaria("2024-03", 1, leap)).toEqual({ inicio: "2024-02-29", fin: "2024-03-13" });
    expect(asignarFechaAPresupuesto("2024-02-28", leap)).toMatchObject({ periodoPresupuestario: "2024-02", quincenaPresupuestaria: 2 });
  });

  it("uses today's actual date when it is inside the selected future-named budget period", () => {
    const coverage = { inicio: "2026-10-30", fin: "2026-11-12" };
    expect(fechaSugeridaParaCobertura(coverage, "2026-10-31")).toBe("2026-10-31");
    expect(fechaSugeridaParaCobertura(coverage, "2026-11-15")).toBe("2026-10-30");
  });

  it("uses only an active, configured fourteen-day salary rule", () => {
    expect(obtenerReglaPresupuestaria(config)).toEqual(regla);
    expect(obtenerReglaPresupuestaria({ ...config, intervaloDias: null })).toEqual(regla);
    for (const overrides of [{ activa: false }, { fechaAncla: "" }, { fechaAncla: "2026-02-30" }, { intervaloDias: 7 }]) {
      expect(obtenerReglaPresupuestaria({ ...config, ...overrides })).toBeNull();
    }
    expect(obtenerReglaPresupuestaria({ ...config, frecuencia: "semanal" })).toBeNull();
  });

  it("keeps calendar fallback for unconfigured income and ignores invalid dates", () => {
    expect(asignarFechaAPresupuesto("2026-10-30")).toEqual({ periodoPresupuestario: "2026-10", quincenaPresupuestaria: 2 });
    expect(obtenerCoberturaPresupuestaria("2026-02", 2)).toEqual({ inicio: "2026-02-16", fin: "2026-02-28" });
    expect(asignarFechaAPresupuesto("invalid", regla)).toBeNull();
    expect(asignarFechaAPresupuesto("2026-02-30", regla)).toBeNull();
    expect(obtenerCoberturaPresupuestaria("2026-13", 1, regla)).toBeNull();
  });
});
