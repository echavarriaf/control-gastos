import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Movimiento, TarjetaCredito } from "@/lib/budget/types";

const hooks = vi.hoisted(() => ({
  states: [] as unknown[], stateIndex: 0, memoIndex: 0, effectIndex: 0,
  memos: [] as Array<{ deps: unknown[]; value: unknown }>,
  effects: [] as unknown[][], pending: [] as Array<() => void>,
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states)) hooks.states[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.states[index], (next: unknown) => { hooks.states[index] = typeof next === "function" ? next(hooks.states[index]) : next; }];
  },
  useMemo: (calculate: () => unknown, deps: unknown[]) => {
    const index = hooks.memoIndex++;
    if (!hooks.memos[index] || deps.some((value, position) => value !== hooks.memos[index].deps[position])) {
      hooks.memos[index] = { deps, value: calculate() };
    }
    return hooks.memos[index].value;
  },
  useEffect: (effect: () => void, deps: unknown[]) => {
    const index = hooks.effectIndex++;
    if (!hooks.effects[index] || deps.some((value, position) => value !== hooks.effects[index][position])) {
      hooks.effects[index] = deps;
      hooks.pending.push(effect);
    }
  },
}));
vi.mock("./CardCategoriesManager", () => ({ CardCategoriesManager: () => null }));
import { VariableMovementForm } from "./VariableMovementForm";

const tarjeta: TarjetaCredito = { id: "card", nombre: "Tarjeta", ultimosCuatro: "1234", saldoInicial: 100,
  fechaSaldoInicial: "2026-01-01", diaCorte: 25, diaPago: 20, activa: true,
  estrategiaPago: "saldo_completo", pagoObjetivo: null, limiteCredito: 1000, notas: "" };
type Props = Parameters<typeof VariableMovementForm>[0];
let props: Props;
type Element = React.ReactElement<Record<string, unknown>>;
function walk(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...walk(node.props.children)];
}
function render() {
  hooks.stateIndex = 0; hooks.memoIndex = 0; hooks.effectIndex = 0;
  return VariableMovementForm(props);
}
function settle() {
  let tree = render();
  for (let attempt = 0; hooks.pending.length && attempt < 5; attempt++) {
    hooks.pending.splice(0).forEach(effect => effect());
    tree = render();
  }
  return tree;
}
function find(predicate: (element: Element) => boolean) {
  const result = walk(settle()).find(predicate);
  if (!result) throw new Error("Missing form element");
  return result;
}
function field(id: string) { return find(element => element.props.id === id); }
function change(id: string, value: string) {
  const handler = field(id).props.onChange;
  if (typeof handler !== "function") throw new Error("Missing change handler");
  handler({ target: { value } });
}
async function submit() {
  const handler = find(element => element.type === "form").props.onSubmit;
  if (typeof handler !== "function") throw new Error("Missing submit handler");
  await handler({ preventDefault() {} });
}
function editedPayment(origenFondos?: "cuenta_gastos" | "cuenta_externa"): Movimiento {
  return { tipo: "pago", id: "payment", concepto: "Pago", monto: 50, categoria: "general", fecha: "2026-10-20",
    creadoEn: "2026-10-20T12:00:00Z", tarjetaId: "card", estadoTarjeta: "contabilizada", origenFondos };
}
beforeEach(() => {
  hooks.states = []; hooks.memos = []; hooks.effects = []; hooks.pending = [];
  props = { mesSeleccionado: "2026-10", quincenaSeleccionada: 2, guardando: false, movimientoEditando: null,
    nombreCuentaGastos: "Mi banco", tarjetasActivas: [tarjeta], categoriasTarjeta: [], cargandoCategorias: false,
    guardandoCategoria: false, actualizandoCategoriaId: null, reordenandoCategorias: false,
    onRegistrar: vi.fn().mockResolvedValue(true), onActualizar: vi.fn().mockResolvedValue(true), onCancelarEdicion: vi.fn(),
    onCrearCategoria: vi.fn().mockResolvedValue(true), onActualizarCategoria: vi.fn().mockResolvedValue(true),
    onCambiarEstadoCategoria: vi.fn().mockResolvedValue(true), onMoverCategoria: vi.fn().mockResolvedValue(true),
  };
});

describe("Payment source selector", () => {
  it("sends the external origin when recording a card payment and resets the next payment", async () => {
    const selectType = find(element => element.props.tipo === "pago").props.onSelect;
    if (typeof selectType !== "function") throw new Error("Missing payment tab");
    selectType("pago");
    expect(field("movimiento-origen-fondos").props.value).toBe("cuenta_gastos");
    expect(walk(field("movimiento-origen-fondos")).some(element => element.props.children === "Mi banco")).toBe(true);
    change("movimiento-concepto", "Pago externo"); change("movimiento-monto", "50");
    change("movimiento-origen-fondos", "cuenta_externa");
    await submit();
    expect(props.onRegistrar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "pago", origenFondos: "cuenta_externa", tarjetaId: "card", monto: 50 }));
    expect(field("movimiento-origen-fondos").props.value).toBe("cuenta_gastos");
  });

  it("preserves an external source when editing the amount", async () => {
    props.movimientoEditando = editedPayment("cuenta_externa");
    expect(field("movimiento-origen-fondos").props.value).toBe("cuenta_externa");
    change("movimiento-monto", "75"); await submit();
    expect(props.onActualizar).toHaveBeenCalledWith(props.movimientoEditando,
      expect.objectContaining({ tipo: "pago", monto: 75, origenFondos: "cuenta_externa" }));
  });

  it("allows changing the origin of a historical payment", async () => {
    props.movimientoEditando = editedPayment();
    expect(field("movimiento-origen-fondos").props.value).toBe("cuenta_gastos");
    change("movimiento-origen-fondos", "cuenta_externa"); await submit();
    expect(props.onActualizar).toHaveBeenCalledWith(props.movimientoEditando,
      expect.objectContaining({ origenFondos: "cuenta_externa" }));
  });

  it("does not inherit an external origin after cancelling an edit", () => {
    props.movimientoEditando = editedPayment("cuenta_externa");
    expect(field("movimiento-origen-fondos").props.value).toBe("cuenta_externa");
    const cancel = find(element => element.type === "button" && element.props["aria-controls"] === "variable-movement-form-content").props.onClick;
    if (typeof cancel !== "function") throw new Error("Missing cancel button");
    cancel(); props.movimientoEditando = null;
    expect(field("movimiento-origen-fondos").props.value).toBe("cuenta_gastos");
  });

  it("does not add a funding source to purchase forms", () => {
    expect(walk(settle()).some(element => element.props.id === "movimiento-origen-fondos")).toBe(false);
  });
});
