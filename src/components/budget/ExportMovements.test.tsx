import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const hooks = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0, uid: "owner" as string | null, descargar: vi.fn() }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [hooks.states[index], (next: unknown) => { hooks.states[index] = next; }];
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: hooks.uid ? { uid: hooks.uid } : null, authorized: Boolean(hooks.uid) }) }));
vi.mock("@/lib/export/client", () => ({ descargarExportacion: hooks.descargar }));
import { ExportMovements } from "./ExportMovements";

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
function render(mes = "2026-11") {
  hooks.cursor = 0;
  const wrapper = ExportMovements({ mesSeleccionado: mes });
  if (!wrapper) return null;
  if (typeof wrapper.type !== "function") throw new Error("Missing scoped export form");
  return (wrapper.type as (props: unknown) => React.ReactNode)(wrapper.props);
}
function submit() {
  const handler = walk(render()).find(element => element.type === "form")?.props.onSubmit;
  if (typeof handler !== "function") throw new Error("Missing submit");
  return handler({ preventDefault() {} });
}
beforeEach(() => {
  hooks.states = []; hooks.cursor = 0; hooks.uid = "owner";
  hooks.descargar.mockReset().mockResolvedValue({ nombre: "export.csv", registros: 4 });
});
describe("CSV export form", () => {
  it("defaults to the selected full calendar month and submits summary selection", async () => {
    const dates = walk(render()).filter(element => element.props.type === "date");
    expect(dates.map(element => element.props.value)).toEqual(["2026-11-01", "2026-11-30"]);
    const select = walk(render()).find(element => element.type === "select")?.props.onChange;
    if (typeof select !== "function") throw new Error("Missing format selector");
    select({ target: { value: "resumen" } });
    await submit();
    expect(hooks.descargar).toHaveBeenCalledWith("owner", expect.objectContaining({ desde: "2026-11-01", hasta: "2026-11-30", formato: "resumen" }));
    expect(content(render())).toContain("Descarga iniciada: export.csv (4 registros de origen)");
  });
  it("uses the leap month's actual final day", () => {
    expect(walk(render("2024-02")).filter(element => element.props.type === "date").map(element => element.props.value)).toEqual(["2024-02-01", "2024-02-29"]);
  });
  it("disables fields while downloading and exposes server failures", async () => {
    let rechazar: (error: Error) => void = () => {};
    hooks.descargar.mockImplementation(() => new Promise((_, reject) => { rechazar = reject; }));
    const pendiente = submit();
    expect(walk(render()).find(element => element.props.type === "submit")?.props.disabled).toBe(true);
    rechazar(new Error("Exporta hasta 366 días por archivo.")); await pendiente;
    expect(content(render())).toContain("Exporta hasta 366 días por archivo");
    expect(walk(render()).find(element => element.props.type === "submit")?.props.disabled).toBe(false);
  });
  it("does not render private export controls without an authenticated user", () => {
    hooks.uid = null; expect(render()).toBeNull(); expect(hooks.descargar).not.toHaveBeenCalled();
  });
});
