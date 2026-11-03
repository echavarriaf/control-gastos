import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Listener { reference: { uid: string }; next: (snapshot: unknown) => void; error: () => void; unsubscribe: ReturnType<typeof vi.fn> }
const state = vi.hoisted(() => ({ uid: "owner" as string | null, slots: [] as unknown[], cursor: 0,
  effect: undefined as (() => void | (() => void)) | undefined, listeners: [] as Listener[],
  crear: vi.fn(), actualizar: vi.fn(), transaction: vi.fn(), latest: {} as Record<string, unknown>, exists: true }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => { state.effect = effect; },
  useCallback: (callback: unknown) => callback,
  useRef: (initial: unknown) => { const index = state.cursor++; state.slots[index] ??= { current: initial }; return state.slots[index]; },
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.slots)) state.slots[index] = initial;
    return [state.slots[index], (next: unknown) => { state.slots[index] = typeof next === "function" ? next(state.slots[index]) : next; }];
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.uid ? { uid: state.uid } : null, authorized: Boolean(state.uid) }) }));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/history/client-writes", () => ({ addDocConHistorial: state.crear, registrarCambioEnTransaccion: vi.fn(),
  transaccionConHistorial: (ref: unknown, callback: (transaction: unknown, snapshot: unknown) => unknown) => state.transaction({}, async (transaction: { get: (ref: unknown) => Promise<unknown> }) => callback(transaction, await transaction.get(ref))) }));
vi.mock("@/lib/firestore/user-paths", () => ({ getUserCollection: (uid: string, collection: string) => ({ uid, collection }),
  getUserDocument: (uid: string, collection: string, id: string) => ({ uid, collection, id }) }));
vi.mock("firebase/firestore", () => ({ addDoc: state.crear, serverTimestamp: () => "server-time", where: vi.fn(),
  query: (reference: object) => reference, runTransaction: state.transaction,
  onSnapshot: (reference: Listener["reference"], next: Listener["next"], error: Listener["error"]) => {
    const unsubscribe = vi.fn(); state.listeners.push({ reference, next, error, unsubscribe }); return unsubscribe;
  },
}));
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
const meta = { nombre: "Emergencias", objetivo: 1000, apartado: 100, fechaObjetivo: null, notas: "", archivada: false };
function render() {
  state.cursor = 0;
  let result: ReturnType<typeof useSavingsGoals> | undefined;
  function Probe() { result = useSavingsGoals(); return null; }
  renderToStaticMarkup(<Probe />);
  if (!result) throw new Error("Missing savings controller");
  return result;
}
function recibir(data = meta) { state.listeners[0].next({ docs: [{ id: "goal", data: () => data }] }); }
beforeEach(() => {
  state.uid = "owner"; state.slots = []; state.cursor = 0; state.effect = undefined; state.listeners = [];
  state.crear.mockReset().mockResolvedValue({ id: "new" }); state.actualizar.mockReset(); state.latest = { ...meta }; state.exists = true;
  state.transaction.mockReset().mockImplementation(async (_db, callback) => callback({
    get: async () => ({ id: "goal", exists: () => state.exists, data: () => state.latest }), update: state.actualizar,
  }));
});
describe("Savings goal subscriptions and mutations", () => {
  it("loads only the current user's active goals", () => {
    expect(render().cargando).toBe(true); state.effect?.(); recibir();
    expect(state.listeners[0].reference).toEqual({ uid: "owner", collection: "metasAhorro" });
    expect(render().metas[0]).toMatchObject({ id: "goal", apartado: 100 }); expect(render().cargando).toBe(false);
  });
  it("hides previous reserves immediately on a session change and ignores stale callbacks", () => {
    render(); const cleanup = state.effect?.(); recibir(); state.uid = "other";
    expect(render().metas).toEqual([]); expect(render().cargando).toBe(true);
    if (typeof cleanup !== "function") throw new Error("Missing cleanup"); cleanup(); recibir({ ...meta, apartado: 900 });
    expect(render().metas).toEqual([]); expect(state.listeners[0].unsubscribe).toHaveBeenCalledOnce();
  });
  it("does not treat invalid or failed reserves as a valid zero savings balance", () => {
    render(); state.effect?.(); recibir({ ...meta, apartado: -1 });
    expect(render().errorCarga).toContain("datos inválidos");
    state.listeners[0].error(); expect(render().errorCarga).toContain("No se pudieron cargar");
    render().reintentar(); expect(render().cargando).toBe(true);
  });
  it("creates targets with zero reserved cash and trusted timestamps", async () => {
    expect(await render().crear({ nombre: " Viaje ", objetivo: 123.456, fechaObjetivo: null, notas: "" })).toBe(true);
    expect(state.crear).toHaveBeenCalledWith({ uid: "owner", collection: "metasAhorro" }, expect.objectContaining({ nombre: "Viaje", objetivo: 123.46,
      apartado: 0, archivada: false, creadoEn: "server-time", actualizadoEn: "server-time" }));
  });
  it("reads the latest transactional value instead of overwriting another tab's allocation", async () => {
    render(); state.effect?.(); recibir(); state.latest.apartado = 200;
    expect(await render().cambiar("goal", "apartar", 50)).toBe(true);
    expect(state.actualizar).toHaveBeenCalledWith({ uid: "owner", collection: "metasAhorro", id: "goal" }, { apartado: 250, actualizadoEn: "server-time" });
  });
  it("keeps invalid target edits and funded archives out of Firestore", async () => {
    expect(await render().cambiar("goal", "editar", { nombre: "Meta", objetivo: 50, fechaObjetivo: null, notas: "" })).toBe(false);
    expect(render().error).toContain("Libera primero");
    expect(await render().cambiar("goal", "archivar")).toBe(false);
    expect(state.actualizar).not.toHaveBeenCalled();
  });
  it("prevents duplicate submissions from the same tab while a mutation is pending", async () => {
    let resolver: () => void = () => {};
    state.crear.mockImplementation(() => new Promise<void>(resolve => { resolver = resolve; }));
    const controller = render();
    const datos = { nombre: "Viaje", objetivo: 100, fechaObjetivo: null, notas: "" };
    const first = controller.crear(datos);
    expect(await controller.crear(datos)).toBe(false); expect(state.crear).toHaveBeenCalledOnce();
    resolver(); expect(await first).toBe(true); expect(render().guardandoId).toBeNull();
  });
  it("does not load or save goals while signed out", async () => {
    state.uid = null; const controller = render(); state.effect?.();
    expect(controller.metas).toEqual([]); expect(controller.cargando).toBe(false); expect(state.listeners).toHaveLength(0);
    expect(await controller.cambiar("goal", "apartar", 10)).toBe(false); expect(state.transaction).not.toHaveBeenCalled();
  });
});
