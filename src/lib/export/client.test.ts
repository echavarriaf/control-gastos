import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpcionesExportacion } from "./types";
const state = vi.hoisted(() => ({ user: { uid: "owner", getIdToken: vi.fn().mockResolvedValue("token") } as { uid: string; getIdToken: ReturnType<typeof vi.fn> } | null }));
vi.mock("@/lib/firebase", () => ({ auth: { get currentUser() { return state.user; } } }));
import { descargarExportacion } from "./client";

const opciones: OpcionesExportacion = { desde: "2026-11-01", hasta: "2026-11-30", zonaHoraria: "America/New_York", formato: "movimientos" };
let fetchMock: ReturnType<typeof vi.fn>;
let anchor: { href: string; download: string; click: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
let crearURL: ReturnType<typeof vi.fn>;
let revocarURL: ReturnType<typeof vi.fn>;
beforeEach(() => {
  state.user = { uid: "owner", getIdToken: vi.fn().mockResolvedValue("token") };
  fetchMock = vi.fn().mockResolvedValue(new Response('\uFEFF"Fecha"\r\n', { headers: { "Content-Type": "text/csv; charset=utf-8", "X-Export-Record-Count": "0" } }));
  vi.stubGlobal("fetch", fetchMock);
  anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
  vi.stubGlobal("document", { createElement: vi.fn(() => anchor), body: { appendChild: vi.fn() } });
  vi.useFakeTimers(); vi.stubGlobal("window", { setTimeout: globalThis.setTimeout });
  crearURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  revocarURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("CSV browser download", () => {
  it("uses authenticated parameters and keeps the Blob URL alive while Safari starts the download", async () => {
    expect(await descargarExportacion("owner", opciones)).toEqual({ nombre: "movimientos_2026-11-01_2026-11-30.csv", registros: 0 });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("zonaHoraria=America%2FNew_York"), expect.objectContaining({ cache: "no-store", headers: { Authorization: "Bearer token" } }));
    expect(anchor.click).toHaveBeenCalledOnce(); expect(anchor.download).toBe("movimientos_2026-11-01_2026-11-30.csv");
    expect(anchor.remove).toHaveBeenCalledOnce(); expect(revocarURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(revocarURL).toHaveBeenCalledWith("blob:test");
  });
  it.each([null, "other"])("does not fetch with missing or changed authentication %s", async uid => {
    state.user = uid ? { uid, getIdToken: vi.fn() } : null;
    await expect(descargarExportacion("owner", opciones)).rejects.toThrow("La sesión cambió");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not download after a session change while the response is arriving", async () => {
    fetchMock.mockImplementation(async () => { state.user = null; return new Response("csv", { headers: { "Content-Type": "text/csv" } }); });
    await expect(descargarExportacion("owner", opciones)).rejects.toThrow("No se ha iniciado la descarga");
    expect(crearURL).not.toHaveBeenCalled();
  });
  it("rejects JSON and HTML errors instead of saving them as CSV", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Usuario no autorizado." }, { status: 403 }));
    await expect(descargarExportacion("owner", opciones)).rejects.toThrow("Usuario no autorizado");
    fetchMock.mockResolvedValue(new Response("<html>Error</html>", { headers: { "Content-Type": "text/html" } }));
    await expect(descargarExportacion("owner", opciones)).rejects.toThrow("CSV válido");
    expect(anchor.click).not.toHaveBeenCalled();
  });
  it("rejects invalid ranges before sending a request", async () => {
    await expect(descargarExportacion("owner", { ...opciones, hasta: "2026-10-01" })).rejects.toThrow("intervalo");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
