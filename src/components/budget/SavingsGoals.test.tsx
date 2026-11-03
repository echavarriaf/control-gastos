import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SavingsGoals } from "./SavingsGoals";
import type { SavingsGoalsController } from "@/hooks/useSavingsGoals";

function controller(overrides: Partial<SavingsGoalsController> = {}): SavingsGoalsController {
  return { metas: [{ id: "goal", nombre: "Viaje", objetivo: 1000, apartado: 1000, fechaObjetivo: "2026-11-01", notas: "", archivada: false }],
    cargando: false, error: null, errorCarga: null, guardandoId: null, crear: vi.fn(), cambiar: vi.fn(), reintentar: vi.fn(), limpiarError: vi.fn(), ...overrides };
}
describe("Savings goal presentation", () => {
  it("keeps a completed goal reserved, with release available and archive disabled", () => {
    const html = renderToStaticMarkup(<SavingsGoals ahorros={controller()} hoy="2026-11-03" disponibleReal={0} />);
    expect(html).toContain("Meta alcanzada");
    expect(html).toContain("$1,000.00 apartado de $1,000.00");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Archivar<\/button>/);
    expect(html).toMatch(/<button(?![^>]*\sdisabled=)[^>]*>Liberar apartado<\/button>/);
    expect(html).not.toContain("Fecha vencida");
  });
  it("marks overdue incomplete goals without pretending that a target is already funded", () => {
    const ahorros = controller(); ahorros.metas[0].apartado = 100;
    const html = renderToStaticMarkup(<SavingsGoals ahorros={ahorros} hoy="2026-11-03" disponibleReal={900} />);
    expect(html).toContain("Faltan $900.00"); expect(html).toContain("Fecha vencida");
  });
  it("offers retry and disables new goals when reserves could not be loaded", () => {
    const html = renderToStaticMarkup(<SavingsGoals ahorros={controller({ metas: [], errorCarga: "Error de carga", error: "Error de carga" })} hoy="2026-11-03" disponibleReal={null} />);
    expect(html).toContain("Volver a cargar metas"); expect(html).toContain("Error de carga");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Nueva meta<\/button>/);
  });
});
