import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CambioPapelera } from "./client";

const state = vi.hoisted(() => ({ user: { uid: "owner", getIdToken: vi.fn().mockResolvedValue("token") } as { uid: string; getIdToken: ReturnType<typeof vi.fn> } | null }));
vi.mock("@/lib/firebase", () => ({ auth: { get currentUser() { return state.user; } } }));
import { enviarAPapelera, EVENTO_PAPELERA, obtenerPapelera, recuperarDePapelera } from "./client";

const item = { id: "trash", coleccion: "gastos", documentoId: "original", concepto: "Compra", monto: 50, fecha: "2026-11-03", eliminadoEn: "2026-11-03T12:00:00Z" };
let fetchMock: ReturnType<typeof vi.fn>;
let events: CambioPapelera[];
beforeEach(() => {
  state.user = { uid: "owner", getIdToken: vi.fn().mockResolvedValue("token") };
  fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true, movimiento: item }));
  vi.stubGlobal("fetch", fetchMock);
  events = [];
  const target = new EventTarget();
  target.addEventListener(EVENTO_PAPELERA, event => events.push((event as CustomEvent<CambioPapelera>).detail));
  vi.stubGlobal("window", target);
});
afterEach(() => vi.unstubAllGlobals());

describe("Movement trash client", () => {
  it("sends only the source ID and collection, and announces deletion after server confirmation", async () => {
    await enviarAPapelera("owner", "gastos", "original");
    expect(fetchMock).toHaveBeenCalledWith("/api/movements/trash", expect.objectContaining({ method: "DELETE", cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" }, body: JSON.stringify({ coleccion: "gastos", documentoId: "original" }) }));
    expect(events).toEqual([{ uid: "owner", accion: "eliminado", movimiento: item }]);
  });
  it("restores by archive ID and announces the original owner's result", async () => {
    await recuperarDePapelera("owner", "trash");
    expect(fetchMock).toHaveBeenCalledWith("/api/movements/trash", expect.objectContaining({ method: "POST", body: JSON.stringify({ id: "trash" }) }));
    expect(events[0]).toMatchObject({ uid: "owner", accion: "restaurado" });
  });
  it.each([null, "other"])("does not delete through a missing or switched session %s", async uid => {
    state.user = uid ? { uid, getIdToken: vi.fn() } : null;
    await expect(enviarAPapelera("owner", "gastos", "original")).rejects.toThrow("La sesión cambió");
    expect(fetchMock).not.toHaveBeenCalled(); expect(events).toEqual([]);
  });
  it("does not announce an operation that the server rejected", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false, error: "Ya existe un movimiento con ese ID." }, { status: 409 }));
    await expect(recuperarDePapelera("owner", "trash")).rejects.toThrow("Ya existe un movimiento");
    expect(events).toEqual([]);
  });
  it("keeps the requested scope on paginated reads and does not emit deletion events", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, movimientos: [item], siguiente: "next" }));
    expect(await obtenerPapelera("owner", "cursor/value")).toEqual({ movimientos: [item], siguiente: "next" });
    expect(fetchMock).toHaveBeenCalledWith("/api/movements/trash?cursor=cursor%2Fvalue", expect.objectContaining({ method: "GET" }));
    expect(events).toEqual([]);
  });
  it("does not announce deletion when the response is incomplete or unreadable", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    await expect(enviarAPapelera("owner", "gastos", "original")).rejects.toThrow("Actualiza la papelera");
    fetchMock.mockResolvedValue(new Response("offline", { status: 500 }));
    await expect(enviarAPapelera("owner", "gastos", "original")).rejects.toThrow("No se pudo completar");
    expect(events).toEqual([]);
  });
});
