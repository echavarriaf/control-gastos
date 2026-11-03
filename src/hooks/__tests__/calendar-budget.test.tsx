import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useBudgetSummary } from "@/hooks/useBudgetSummary";
import { PeriodSelector } from "@/components/budget/PeriodSelector";
import type { GastoVariable, Quincena } from "@/lib/budget/types";

function expense(id: string, fecha: string, monto: number, categoria: "comida" | "gas" | null = "comida"): GastoVariable {
  return { id, fecha, monto, categoria, concepto: id, creadoEn: `${fecha}T12:00:00Z`, metodoPago: "debito", tarjetaId: null,
    estadoTarjeta: null, categoriaTarjetaId: categoria ?? "otro", categoriaTarjetaNombre: categoria ?? "Otro", comentario: "" };
}
function summary(gastos: GastoVariable[], periodo = "2026-11", quincena: Quincena = 1) {
  const box: { value?: ReturnType<typeof useBudgetSummary> } = {};
  function Probe() {
    box.value = useBudgetSummary({ gastos, pagos: [], pagosFijos: [], compromisosFijos: [],
      limites: { comida: { mensual: 1200, quincenal: 600 }, gas: { mensual: 200, quincenal: 100 } },
      mesSeleccionado: periodo, periodoActual: periodo, quincenaSeleccionada: quincena,
    });
    return null;
  }
  renderToStaticMarkup(<Probe />);
  if (!box.value) throw new Error("Missing summary");
  return box.value;
}

describe("Budget follows calendar halves", () => {
  it("keeps third-paycheck expenses in the calendar month", () => {
    const gastos = [expense("food", "2026-10-30", 40), expense("gas", "2026-10-30", 5, "gas")];
    const result = summary(gastos, "2026-10", 2);
    expect(result.resumenCategorias[0]).toMatchObject({ saldoQuincena: 40, disponibleQuincena: 560, saldoMes: 40 });
    expect(result.resumenCategorias[1]).toMatchObject({ saldoQuincena: 5, disponibleQuincena: 95, saldoMes: 5 });
    expect(result.movimientosQuincena.map(value => value.id)).toEqual(expect.arrayContaining(["food", "gas"]));
    expect(result.mesesDisponibles).toContain("2026-10");
    expect(summary(gastos).saldoVariableMes).toBe(0);
    expect(gastos[0].fecha).toBe("2026-10-30");
  });

  it("changes to Q2 on the sixteenth regardless of payday", () => {
    const gastos = [expense("q1-last", "2026-11-15", 40), expense("q2-first", "2026-11-16", 25)];
    expect(summary(gastos).saldoVariableQuincena).toBe(40);
    const q2 = summary(gastos, "2026-11", 2);
    expect(q2.saldoVariableQuincena).toBe(25);
    expect(q2.movimientosQuincena.map(value => value.id)).toEqual(["q2-first"]);
  });

  it("keeps a November thirteenth payday purchase in Q1", () => {
    const gastos = [expense("payday", "2026-11-13", 40)];
    expect(summary(gastos).saldoVariableQuincena).toBe(40);
    expect(summary(gastos, "2026-11", 2).saldoVariableQuincena).toBe(0);
  });

  it("carries overspending from October Q2 into November Q1", () => {
    const gastos = [expense("old-food", "2026-10-20", 650), expense("old-gas", "2026-10-20", 120, "gas"),
      expense("new-food", "2026-11-01", 40), expense("new-gas", "2026-11-01", 5, "gas")];
    const result = summary(gastos);
    expect(result.resumenCategorias[0]).toMatchObject({ excedenteAnterior: 50, saldoQuincena: 40, disponibleQuincena: 510, saldoMes: 40 });
    expect(result.resumenCategorias[1]).toMatchObject({ excedenteAnterior: 20, saldoQuincena: 5, disponibleQuincena: 75, saldoMes: 5 });
  });

  it("excludes future cycles and non-budgeted purchases from the current category balance", () => {
    const result = summary([expense("future", "2026-11-16", 1000), expense("other", "2026-11-13", 1000, null)]);
    expect(result.saldoVariableQuincena).toBe(0);
    expect(result.excedenteVariableAnterior).toBe(0);
    expect(result.disponibleVariableQuincena).toBe(700);
    expect(result.movimientosQuincena.map(value => value.id)).toEqual(["other"]);
  });

  it("shows calendar-half labels and coverage", () => {
    const coverage = summary([]).coberturaQuincena;
    const html = renderToStaticMarkup(<PeriodSelector cobertura={coverage} mesesDisponibles={["2026-11"]}
      mesSeleccionado="2026-11" quincenaSeleccionada={1} onCambiarMes={() => {}} onCambiarQuincena={() => {}} />);
    expect(html).toContain("Quincena");
    expect(html).toContain("1–15");
    expect(coverage).toEqual({ inicio: "2026-11-01", fin: "2026-11-15" });
  });
});
