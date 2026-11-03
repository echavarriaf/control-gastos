import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MovimientoCuentaGastos } from "@/lib/budget/expense-account";

const hooks = vi.hoisted(() => ({ states: [] as unknown[], index: 0 }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.states)) hooks.states[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.states[index], (next: unknown) => { hooks.states[index] = typeof next === "function" ? next(hooks.states[index]) : next; }];
  },
}));
import { BankReconciliation } from "./BankReconciliation";

type Element = React.ReactElement<Record<string, unknown>>;
function walk(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...walk(node.props.children)];
}
function content(node: unknown): string {
  if (Array.isArray(node)) return node.map(content).join("");
  if (React.isValidElement<Record<string, unknown>>(node)) return content(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
const base: MovimientoCuentaGastos = { id: "base", tipo: "saldo_inicial", direccion: "base", fecha: "2026-01-01", monto: 1000, concepto: "Saldo inicial", detalle: "", saldoDespues: 1000 };
const salida: MovimientoCuentaGastos = { id: "manual:1", tipo: "movimiento_manual", direccion: "salida", fecha: "2026-01-02", monto: 100, concepto: "Retiro", detalle: "", saldoDespues: 900 };
let props: Parameters<typeof BankReconciliation>[0];
function render() { hooks.index = 0; return BankReconciliation(props); }
function field(type: string) {
  const result = walk(render()).find(element => element.type === "input" && element.props.type === type);
  if (!result) throw new Error(`Missing ${type}`);
  return result;
}
function change(type: string, value: Record<string, unknown>) {
  const handler = field(type).props.onChange;
  if (typeof handler !== "function") throw new Error("Missing input handler");
  handler({ target: value });
}
beforeEach(() => {
  hooks.states = [];
  props = { movimientos: [salida, base], fechaSaldoInicial: base.fecha, cargando: false };
});

describe("Bank reconciliation controls", () => {
  it("compares and completes only after the user checks the movement", () => {
    change("number", { value: "900" });
    expect(content(render())).toContain("Aún hay movimientos por revisar");
    change("checkbox", { checked: true });
    expect(content(render())).toContain("Conciliación completa");
    change("checkbox", { checked: false });
    expect(content(render())).not.toContain("Conciliación completa");
  });
  it("updates comparison when the bank balance changes and can restart review", () => {
    change("number", { value: "900" }); change("checkbox", { checked: true });
    change("number", { value: "950" });
    expect(content(render())).toContain("Hay una diferencia por investigar");
    const reset = walk(render()).find(element => element.type === "button")?.props.onClick;
    if (typeof reset !== "function") throw new Error("Missing reset");
    reset();
    expect(field("checkbox").props.checked).toBe(false);
  });
  it("does not calculate a result while financial sources are loading", () => {
    change("number", { value: "900" }); props.cargando = true;
    expect(content(render())).toContain("Cargando movimientos para comparar");
    expect(content(render())).not.toContain("Los saldos coinciden");
    expect(field("number").props.disabled).toBe(true);
  });
  it("supports historical dates and validates dates before the baseline", () => {
    change("number", { value: "1000" }); change("date", { value: "2026-01-01" });
    expect(content(render())).toContain("No hay movimientos posteriores");
    expect(content(render())).toContain("Conciliación completa");
    change("date", { value: "2025-12-31" });
    expect(content(render())).toContain("igual o posterior al saldo base");
  });
  it("hides a prior comparison when a financial source reports an error", () => {
    change("number", { value: "900" }); change("checkbox", { checked: true });
    props.errorDatos = "No se pudieron cargar los ingresos.";
    expect(content(render())).toContain("No se puede comparar hasta resolver el error");
    expect(content(render())).not.toContain("Conciliación completa");
    expect(field("number").props.disabled).toBe(true);
  });
  it("does not reuse a checked status for an edited movement", () => {
    change("number", { value: "900" }); change("checkbox", { checked: true });
    props.movimientos = [{ ...salida, monto: 120 }, base];
    expect(field("checkbox").props.checked).toBe(false);
    expect(content(render())).toContain("0 de 1 movimientos revisados");
  });
});
