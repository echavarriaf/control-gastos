import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ run: vi.fn(), refresh: vi.fn() }));
vi.mock("firebase/firestore", () => ({ runTransaction: state.run, getDocFromServer: state.refresh, collection: vi.fn(), doc: vi.fn(), serverTimestamp: vi.fn() }));
import { transaccionConHistorial } from "./client-writes";
import type { DocumentReference } from "firebase/firestore";

const referencia = { firestore: {} } as DocumentReference;
const snapshot = (monto: number) => ({ exists: () => true, data: () => ({ monto }) });
const denegado = Object.assign(new Error("Permission denied"), { code: "permission-denied" });
beforeEach(() => { state.run.mockReset(); state.refresh.mockReset(); });
describe("Verified stale-transaction retry", () => {
  it("retries a rejected stale before-image only after confirming another committed change", async () => {
    let llamadas = 0;
    state.run.mockImplementation(async (_db, callback) => {
      const result = await callback({ get: async () => snapshot(llamadas++ === 0 ? 50 : 60) });
      if (llamadas === 1) throw denegado;
      return result;
    });
    state.refresh.mockResolvedValue(snapshot(60));
    expect(await transaccionConHistorial(referencia, async (_transaction, data) => data.data()?.monto)).toBe(60);
    expect(state.run).toHaveBeenCalledTimes(2);
  });
  it("does not retry unchanged permission failures", async () => {
    state.run.mockImplementation(async (_db, callback) => { await callback({ get: async () => snapshot(50) }); throw denegado; });
    state.refresh.mockResolvedValue(snapshot(50));
    await expect(transaccionConHistorial(referencia, async () => {})).rejects.toBe(denegado);
    expect(state.run).toHaveBeenCalledOnce();
  });
  it("preserves permission failures when the session cannot read the latest document", async () => {
    state.run.mockImplementation(async (_db, callback) => { await callback({ get: async () => snapshot(50) }); throw denegado; });
    state.refresh.mockRejectedValue(denegado);
    await expect(transaccionConHistorial(referencia, async () => {})).rejects.toBe(denegado);
    expect(state.run).toHaveBeenCalledOnce();
  });
  it("limits retries even if the source keeps changing", async () => {
    state.run.mockImplementation(async (_db, callback) => { await callback({ get: async () => snapshot(50) }); throw denegado; });
    state.refresh.mockResolvedValue(snapshot(60));
    await expect(transaccionConHistorial(referencia, async () => {})).rejects.toBe(denegado);
    expect(state.run).toHaveBeenCalledTimes(3);
  });
  it("never retries validation failures as permission conflicts", async () => {
    const error = new Error("Target exceeded");
    state.run.mockImplementation(async (_db, callback) => callback({ get: async () => snapshot(50) }));
    await expect(transaccionConHistorial(referencia, async () => { throw error; })).rejects.toBe(error);
    expect(state.refresh).not.toHaveBeenCalled();
  });
});
