import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, uid: "owner" as string | null, leer: vi.fn() }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++; if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (next: unknown) => { hooks.slots[index] = typeof next === "function" ? next(hooks.slots[index]) : next; }];
  },
  useRef: (initial: unknown) => { const index = hooks.cursor++; hooks.slots[index] ??= { current: initial }; return hooks.slots[index]; },
  useCallback: (callback: unknown) => callback, useEffect: () => {},
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: hooks.uid ? { uid: hooks.uid } : null, authorized: Boolean(hooks.uid) }) }));
vi.mock("@/lib/history/read", () => ({ leerHistorial: hooks.leer }));
import { ChangeHistory } from "./ChangeHistory";
type Element = React.ReactElement<Record<string, unknown>>;
function walk(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...walk(node.props.children)];
}
function content(node: unknown): string {
  if (Array.isArray(node)) return node.map(content).join("");
  if (React.isValidElement<Record<string, unknown>>(node)) return content(node.props.children);
  return typeof node === "string" ? node : "";
}
function render() {
  hooks.cursor = 0; const wrapper = ChangeHistory({ tarjetas: [], compromisos: [] });
  if (!wrapper) return null;
  if (typeof wrapper.type !== "function") throw new Error("Missing scoped history");
  return (wrapper.type as (props: unknown) => React.ReactNode)(wrapper.props);
}
async function click(label: string) {
  const handler = walk(render()).find(element => element.type === "button" && content(element).includes(label))?.props.onClick;
  if (typeof handler !== "function") throw new Error(`Missing ${label}`);
  await handler(); await Promise.resolve(); await Promise.resolve();
}
const evento = { id: "event", actorUid: "owner", coleccion: "pagosTarjeta", documentoId: "payment", accion: "editado", fecha: "2026-11-03T12:00:00Z",
  antes: { concepto: "Pago Visa", monto: 10, origenFondos: "cuenta_gastos" }, despues: { concepto: "Pago Visa", monto: 20, origenFondos: "cuenta_externa" } };
beforeEach(() => {
  hooks.uid = "owner"; hooks.slots = []; hooks.cursor = 0;
  hooks.leer.mockReset().mockResolvedValue({ eventos: [evento], siguiente: undefined });
});
describe("Change history controls", () => {
  it("loads only on opening and shows actual before and after values", async () => {
    render(); expect(hooks.leer).not.toHaveBeenCalled();
    await click("Historial de cambios");
    const text = content(render());
    expect(hooks.leer).toHaveBeenCalledWith("owner", undefined);
    expect(text).toContain("Edición · Pago a tarjeta · Pago Visa");
    expect(text).toContain("Antes: $10.00"); expect(text).toContain("Después: $20.00");
    expect(text).toContain("Otra cuenta externa"); expect(text).not.toContain("Cargando historial");
  });
  it("appends a subsequent page and deduplicates events", async () => {
    const cursor = { id: "cursor" };
    hooks.leer.mockResolvedValueOnce({ eventos: [evento], siguiente: cursor })
      .mockResolvedValueOnce({ eventos: [evento, { ...evento, id: "second", accion: "recuperado" }], siguiente: undefined });
    await click("Historial de cambios"); await click("Cargar más cambios");
    expect(hooks.leer).toHaveBeenLastCalledWith("owner", cursor);
    expect(walk(render()).filter(element => element.type === "li")).toHaveLength(2);
  });
  it("shows a loading error and allows retry instead of inventing an empty history", async () => {
    hooks.leer.mockRejectedValueOnce(new Error("No se pudo cargar el historial."));
    await click("Historial de cambios"); expect(content(render())).toContain("No se pudo cargar");
    expect(content(render())).not.toContain("Todavía no hay cambios");
    await click("Actualizar historial"); expect(content(render())).toContain("Pago Visa");
  });
  it("does not expose private history controls while signed out", () => {
    hooks.uid = null; expect(render()).toBeNull(); expect(hooks.leer).not.toHaveBeenCalled();
  });
});
