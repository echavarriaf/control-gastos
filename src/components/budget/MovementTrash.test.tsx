import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MovimientoEliminado } from "@/lib/movement-trash/types";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, pending: [] as Array<() => void>, uid: "owner" as string | null,
  cargar: vi.fn(), recuperar: vi.fn() }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.slots[index], (next: unknown) => { hooks.slots[index] = typeof next === "function" ? next(hooks.slots[index]) : next; }];
  },
  useRef: (initial: unknown) => {
    const index = hooks.cursor++;
    hooks.slots[index] ??= { current: initial };
    return hooks.slots[index];
  },
  useCallback: (fn: unknown, deps: unknown[]) => {
    const index = hooks.cursor++;
    const previous = hooks.slots[index] as { fn: unknown; deps: unknown[] } | undefined;
    if (!previous || deps.some((value, i) => value !== previous.deps[i])) hooks.slots[index] = { fn, deps };
    return (hooks.slots[index] as { fn: unknown }).fn;
  },
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const index = hooks.cursor++;
    const previous = hooks.slots[index] as { deps: unknown[]; cleanup?: () => void } | undefined;
    if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
      const slot = { deps, cleanup: undefined as undefined | (() => void) };
      hooks.slots[index] = slot;
      hooks.pending.push(() => { previous?.cleanup?.(); slot.cleanup = effect() || undefined; });
    }
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: hooks.uid ? { uid: hooks.uid } : null, authorized: Boolean(hooks.uid) }) }));
vi.mock("@/lib/movement-trash/client", () => ({ EVENTO_PAPELERA: "test:trash", obtenerPapelera: hooks.cargar, recuperarDePapelera: hooks.recuperar }));
import { MovementTrash } from "./MovementTrash";

const item: MovimientoEliminado = { id: "trash", coleccion: "gastos", documentoId: "original", concepto: "Compra", monto: 50, fecha: "2026-11-03", eliminadoEn: "2026-11-03T12:00:00Z" };
type Element = React.ReactElement<Record<string, unknown>>;
function walk(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...walk(node.props.children)];
}
function text(node: unknown): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (React.isValidElement<Record<string, unknown>>(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
function render() {
  hooks.cursor = 0;
  const wrapper = MovementTrash();
  if (!wrapper) return null;
  if (typeof wrapper.type !== "function") throw new Error("Missing scoped trash view");
  const tree = (wrapper.type as (props: unknown) => React.ReactNode)(wrapper.props);
  hooks.pending.splice(0).forEach(effect => effect());
  return tree;
}
async function click(label: string) {
  const handler = walk(render()).find(element => element.type === "button" && text(element).includes(label))?.props.onClick;
  if (typeof handler !== "function") throw new Error(`Missing ${label}`);
  await handler();
  render();
  await Promise.resolve(); await Promise.resolve();
}
beforeEach(() => {
  hooks.slots = []; hooks.cursor = 0; hooks.pending = []; hooks.uid = "owner";
  hooks.cargar.mockReset().mockResolvedValue({ movimientos: [item], siguiente: null });
  hooks.recuperar.mockReset().mockResolvedValue(item);
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe("Movement trash controls", () => {
  it("loads and displays the first page after opening instead of remaining stuck loading", async () => {
    render(); await click("Movimientos eliminados");
    expect(hooks.cargar).toHaveBeenCalledWith("owner", undefined);
    expect(text(render())).toContain("Compra");
    expect(text(render())).not.toContain("Cargando papelera");
  });
  it("shows undo for this user's deletion and ignores events from another user", async () => {
    render();
    window.dispatchEvent(new CustomEvent("test:trash", { detail: { uid: "other", accion: "eliminado", movimiento: item } }));
    expect(text(render())).not.toContain("Deshacer");
    window.dispatchEvent(new CustomEvent("test:trash", { detail: { uid: "owner", accion: "eliminado", movimiento: item } }));
    await click("Deshacer");
    expect(hooks.recuperar).toHaveBeenCalledWith("owner", "trash");
  });
  it("preserves the recovery option and shows a conflict returned by the server", async () => {
    render(); await click("Movimientos eliminados");
    hooks.recuperar.mockRejectedValue(new Error("La cuenta fue recalibrada."));
    await click("Recuperar");
    expect(text(render())).toContain("La cuenta fue recalibrada.");
    expect(text(render())).toContain("Compra");
  });
  it("does not expose the trash panel without an authenticated user", () => {
    hooks.uid = null;
    expect(render()).toBeNull();
    expect(hooks.cargar).not.toHaveBeenCalled();
  });
});
