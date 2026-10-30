import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface TestDocument { id: string; data: () => Record<string, unknown> }
interface Listener {
  reference: { kind?: string; path?: string; fecha?: string };
  next: (snapshot: unknown) => void;
  error: (error: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}
const state = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, uid: "user-a" as string | null,
  effect: undefined as (() => void | (() => void)) | undefined,
  listeners: [] as Listener[],
}));

vi.mock("react", async importOriginal => {
  const original = await importOriginal<typeof import("react")>();
  return { ...original,
    useMemo: (calculate: () => unknown) => calculate(),
    useEffect: (effect: () => void | (() => void)) => { state.effect = effect; },
    useState: (initial: unknown) => {
      const index = state.cursor++;
      if (!(index in state.slots)) state.slots[index] = initial;
      return [state.slots[index], (next: unknown) => { state.slots[index] = next; }];
    },
  };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.uid ? { uid: state.uid } : null, authorized: true }) }));
vi.mock("@/lib/firestore/user-paths", () => ({
  getUserCollection: (uid: string, collection: string) => ({ path: `${uid}/${collection}` }),
  getUserDocument: (uid: string, collection: string, id: string) => ({ path: `${uid}/${collection}/${id}` }),
}));
vi.mock("@/lib/firestore/financial-queries", () => ({
  ingresosDesdeSaldoInicial: (reference: object, fecha: string) => ({ ...reference, kind: "bank", fecha }),
}));
vi.mock("firebase/firestore", () => ({
  query: (reference: object) => ({ ...reference, kind: "history" }), orderBy: vi.fn(),
  onSnapshot: (reference: Listener["reference"], next: Listener["next"], error: Listener["error"]) => {
    const unsubscribe = vi.fn();
    state.listeners.push({ reference, next, error, unsubscribe });
    return unsubscribe;
  },
  doc: vi.fn(), deleteDoc: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(),
}));

import { useIncomeTransactions } from "@/hooks/useIncomeTransactions";
type Scope = Parameters<typeof useIncomeTransactions>[0];
const scope: Scope = { modo: "cuenta", fechaSaldoInicial: "2026-10-10", cicloActualId: "cycle" };
function render(options: Scope = scope) {
  state.cursor = 0;
  const box: { current?: ReturnType<typeof useIncomeTransactions> } = {};
  function Harness() { box.current = useIncomeTransactions(options); return null; }
  renderToStaticMarkup(<Harness />);
  if (!box.current) throw new Error("Missing hook result");
  return box.current;
}
function document(id: string, overrides: Record<string, unknown> = {}): TestDocument {
  return { id, data: () => ({
    cicloPagoId: id, descripcion: "Ingreso", monto: 100, fechaProgramada: "2026-10-10",
    fechaRecibida: "2026-10-10", periodoCalendario: "2026-10", numeroPagoMes: 1,
    numeroPagoAnual: 1, fuente: "salario", estado: "recibido", recurrente: true, notas: "", ...overrides,
  }) };
}
function receiveCollection(index: number, docs: TestDocument[]) { state.listeners[index].next({ docs }); }
function receiveDocument(index: number, data: TestDocument | null) {
  state.listeners[index].next({ ...data, exists: () => data !== null });
}

beforeEach(() => {
  state.slots = []; state.cursor = 0; state.uid = "user-a"; state.effect = undefined; state.listeners = [];
});

describe("Scoped income subscriptions", () => {
  it("subscribes only to bank receipts and the requested cycle on the dashboard", () => {
    render(); state.effect?.();
    expect(state.listeners.map(listener => listener.reference)).toEqual([
      { path: "user-a/ingresos", kind: "bank", fecha: "2026-10-10" },
      { path: "user-a/ingresos/cycle" },
    ]);
  });

  it("waits for both initial results and never counts a deposit twice", () => {
    render(); state.effect?.();
    receiveCollection(0, [document("cycle"), document("manual")]);
    expect(render().cargando).toBe(true);
    receiveDocument(1, document("cycle"));
    const result = render();
    expect(result.cargando).toBe(false);
    expect(result.ingresos.map(ingreso => ingreso.id).sort()).toEqual(["cycle", "manual"]);
  });

  it("keeps projected cycles visible even though they have no bank receipt date", () => {
    render(); state.effect?.();
    receiveCollection(0, []);
    receiveDocument(1, document("cycle", { estado: "proyectado", fechaRecibida: null }));
    expect(render().ingresosPorCiclo.get("cycle")?.estado).toBe("proyectado");
  });

  it("uses the latest observed value when a deposit is updated in either source", () => {
    render(); state.effect?.();
    receiveCollection(0, [document("cycle")]); receiveDocument(1, document("cycle"));
    receiveDocument(1, document("cycle", { monto: 200 }));
    expect(render().ingresos[0].monto).toBe(200);
    receiveCollection(0, [document("cycle", { monto: 300 })]);
    expect(render().ingresos[0].monto).toBe(300);
  });

  it("hides the previous baseline immediately while a new range is loading", () => {
    render(); state.effect?.();
    receiveCollection(0, [document("old")]); receiveDocument(1, null);
    const result = render({ ...scope, fechaSaldoInicial: "2026-11-01" });
    expect(result.ingresos).toEqual([]);
    expect(result.cargando).toBe(true);
  });

  it("deduplicates cycle subscriptions and keeps a separately selected cycle", () => {
    render({ ...scope, cicloSeleccionadoId: "cycle" }); state.effect?.();
    expect(state.listeners).toHaveLength(2);
    state.listeners = [];
    render({ ...scope, cicloSeleccionadoId: "old-cycle" }); state.effect?.();
    expect(state.listeners.map(listener => listener.reference.path)).toContain("user-a/ingresos/old-cycle");
  });

  it("does not read the collection before an account or cycle exists", () => {
    const empty: Scope = { modo: "cuenta" };
    render(empty); state.effect?.();
    expect(state.listeners).toHaveLength(0);
    expect(render(empty).cargando).toBe(false);
  });

  it("unsubscribes and ignores callbacks after switching the user or scope", () => {
    render(); const cleanup = state.effect?.();
    if (typeof cleanup !== "function") throw new Error("Missing subscription cleanup");
    cleanup();
    receiveCollection(0, [document("stale")]);
    receiveDocument(1, document("cycle"));
    expect(render().ingresos).toEqual([]);
    expect(state.listeners.every(listener => listener.unsubscribe.mock.calls.length === 1)).toBe(true);
  });

  it("clears the previous user and does not subscribe when signed out", () => {
    render(); state.effect?.();
    receiveCollection(0, [document("old")]); receiveDocument(1, null);
    state.uid = null;
    const previousSubscriptions = state.listeners.length;
    render(); state.effect?.();
    expect(render().ingresos).toEqual([]);
    expect(render().cargando).toBe(false);
    expect(state.listeners.length).toBe(previousSubscriptions);
  });

  it("keeps the complete collection available to the history manager", () => {
    render({ modo: "historial" }); state.effect?.();
    expect(state.listeners).toHaveLength(1);
    expect(state.listeners[0].reference.kind).toBe("history");
  });

  it("reports a failed source and finishes loading after the other source responds", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(); state.effect?.();
      state.listeners[0].error(new Error("permission-denied"));
      expect(render().cargando).toBe(true);
      receiveDocument(1, null);
      expect(render().cargando).toBe(false);
      expect(render().error).toBe("No se pudieron cargar los ingresos.");
    } finally { log.mockRestore(); }
  });
});
