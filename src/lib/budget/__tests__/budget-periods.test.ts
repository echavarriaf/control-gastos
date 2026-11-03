import { describe, expect, it } from "vitest";
import { asignarFechaAPresupuesto, fechaSugeridaParaCobertura, obtenerCoberturaPresupuestaria } from "../budget-periods";
import { agregarDiasUTC, convertirFechaAISO } from "../pay-cycles";

describe("Calendar budget periods", () => {
  it.each([
    ["2026-10-01", "2026-10", 1], ["2026-10-15", "2026-10", 1],
    ["2026-10-16", "2026-10", 2], ["2026-10-30", "2026-10", 2],
    ["2026-10-31", "2026-10", 2], ["2026-11-01", "2026-11", 1],
    ["2026-11-13", "2026-11", 1], ["2026-11-15", "2026-11", 1],
    ["2026-11-16", "2026-11", 2], ["2026-12-31", "2026-12", 2],
    ["2027-01-01", "2027-01", 1], ["2024-02-29", "2024-02", 2],
  ])("assigns %s to %s Q%s", (fecha, periodo, quincena) => {
    expect(asignarFechaAPresupuesto(fecha)).toEqual({ periodoPresupuestario: periodo, quincenaPresupuestaria: quincena });
  });
  it.each([["2026-02", "28"], ["2024-02", "29"], ["2026-11", "30"], ["2026-12", "31"]])("uses the actual last day of %s", (periodo, last) => {
    expect(obtenerCoberturaPresupuestaria(periodo, 1)).toEqual({ inicio: `${periodo}-01`, fin: `${periodo}-15` });
    expect(obtenerCoberturaPresupuestaria(periodo, 2)).toEqual({ inicio: `${periodo}-16`, fin: `${periodo}-${last}` });
  });
  it("covers each date across years without gaps or overlapping halves", () => {
    for (let day = 0; day < 430; day++) {
      const fecha = convertirFechaAISO(agregarDiasUTC("2023-12-01", day));
      const assignment = asignarFechaAPresupuesto(fecha)!;
      const coverage = obtenerCoberturaPresupuestaria(assignment.periodoPresupuestario, assignment.quincenaPresupuestaria)!;
      expect(fecha >= coverage.inicio && fecha <= coverage.fin).toBe(true);
    }
  });
  it("suggests today only within the selected calendar half", () => {
    const coverage = { inicio: "2026-11-01", fin: "2026-11-15" };
    expect(fechaSugeridaParaCobertura(coverage, "2026-11-13")).toBe("2026-11-13");
    expect(fechaSugeridaParaCobertura(coverage, "2026-10-30")).toBe("2026-11-01");
  });
  it("ignores invalid dates and months", () => {
    expect(asignarFechaAPresupuesto("invalid")).toBeNull();
    expect(asignarFechaAPresupuesto("2026-02-30")).toBeNull();
    expect(obtenerCoberturaPresupuestaria("2026-13", 1)).toBeNull();
  });
});
