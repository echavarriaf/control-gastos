import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { EXPENSE_ACCOUNT_ID } from "@/lib/budget/expense-account";

const state = vi.hoisted(() => ({ uid: "", db: null as Firestore | null }));
vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => {
    if (!state.db) throw new Error("Emulator not initialized");
    return state.db;
  },
  getAdminAuth: () => ({ verifyIdToken: async () => ({ uid: state.uid }) }),
}));

import { GET, PUT } from "@/app/api/account/expense/route";

let app: App;
let db: Firestore;
const baseline = { nombre: "Cuenta de prueba", saldoInicial: 1000, fechaSaldoInicial: "2026-10-10", activa: true };
const fields = [
  "ingresosIncluidosEnSaldoInicial",
  "gastosIncluidosEnSaldoInicial",
  "pagosFijosIncluidosEnSaldoInicial",
  "pagosTarjetaIncluidosEnSaldoInicial",
  "movimientosManualesIncluidosEnSaldoInicial",
] as const;

function accountRef() {
  return db.doc(`users/${state.uid}/cuentas/${EXPENSE_ACCOUNT_ID}`);
}

function request(method: "GET" | "PUT", data = baseline) {
  return new NextRequest("http://localhost:3000/api/account/expense", {
    method,
    headers: { Authorization: "Bearer emulator-test", "Content-Type": "application/json" },
    ...(method === "PUT" ? { body: JSON.stringify(data) } : {}),
  });
}

async function seedMovements() {
  for (const [id, fecha] of [["before", "2026-10-09"], ["same-day", "2026-10-10"], ["after", "2026-10-11"]]) {
    const root = db.doc(`users/${state.uid}`);
    await Promise.all([
      root.collection("ingresos").doc(id).set({ estado: "recibido", fechaRecibida: fecha, monto: 50 }),
      root.collection("gastos").doc(id).set({ metodoPago: "debito", fecha, monto: 20 }),
      root.collection("pagosFijos").doc(id).set({ metodo: "transferencia", fecha, monto: 20 }),
      root.collection("pagosTarjeta").doc(id).set({ fecha, monto: 20 }),
      root.collection("movimientosCuenta").doc(id).set({ fecha, monto: 20 }),
    ]);
  }
}

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("These tests require the Firestore emulator");
  app = initializeApp({ projectId: "demo-presupuesto" }, `account-consistency-${randomUUID()}`);
  db = getFirestore(app);
  state.db = db;
});

beforeEach(async () => {
  state.uid = `account-test-${randomUUID()}`;
  await db.doc(`allowedUsers/${state.uid}`).set({ activo: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.recursiveDelete(db.doc(`users/${state.uid}`));
  await db.doc(`allowedUsers/${state.uid}`).delete();
});

afterAll(async () => {
  await db.terminate();
  await deleteApp(app);
});

describe("Expense account atomic baseline", () => {
  it("commits all five movement snapshots and the balance in a transaction", async () => {
    await seedMovements();
    const transaction = vi.spyOn(db, "runTransaction");
    const response = await PUT(request("PUT"));
    expect(response.status).toBe(200);
    expect(transaction).toHaveBeenCalledTimes(1);
    const stored = (await accountRef().get()).data();
    expect(stored).toMatchObject(baseline);
    for (const field of fields) expect(stored?.[field]).toEqual(["before", "same-day"]);
    const payload = await response.json();
    for (const field of fields) expect(payload.cuenta[field]).toEqual(stored?.[field]);
    expect(stored?.creadoEn).toBeDefined();
  });

  it("backfills legacy snapshots atomically and preserves existing snapshots", async () => {
    await seedMovements();
    await accountRef().set({ ...baseline, gastosIncluidosEnSaldoInicial: ["historical-id"] });
    const transaction = vi.spyOn(db, "runTransaction");
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(transaction).toHaveBeenCalledTimes(1);
    const stored = (await accountRef().get()).data();
    expect(stored?.gastosIncluidosEnSaldoInicial).toEqual(["historical-id"]);
    for (const field of fields.filter(field => field !== "gastosIncluidosEnSaldoInicial")) {
      expect(stored?.[field]).toEqual(["before", "same-day"]);
    }
  });

  it("keeps a complete baseline unchanged when reading it again", async () => {
    await seedMovements();
    await PUT(request("PUT"));
    await db.doc(`users/${state.uid}/gastos/new-same-day`).set({ metodoPago: "debito", fecha: baseline.fechaSaldoInicial, monto: 5 });
    const before = await accountRef().get();
    await GET(request("GET"));
    const after = await accountRef().get();
    expect(after.data()).toEqual(before.data());
    expect(after.updateTime).toEqual(before.updateTime);
  });

  it("cannot mix a legacy GET backfill with a concurrent recalibration", async () => {
    await seedMovements();
    await accountRef().set(baseline);
    const revised = { ...baseline, saldoInicial: 2500, fechaSaldoInicial: "2026-10-11" };
    const results = await Promise.all([GET(request("GET")), PUT(request("PUT", revised))]);
    expect(results.map(result => result.status)).toEqual([200, 200]);
    const stored = (await accountRef().get()).data();
    expect(stored).toMatchObject(revised);
    for (const field of fields) expect(stored?.[field]).toEqual(["after", "before", "same-day"]);
  }, 15000);

  it("keeps concurrent recalibrations internally consistent and preserves creation time", async () => {
    await seedMovements();
    await accountRef().set({ ...baseline, creadoEn: FieldValue.serverTimestamp() });
    const created = (await accountRef().get()).data()?.creadoEn;
    const earlier = { ...baseline, saldoInicial: 700, fechaSaldoInicial: "2026-10-09" };
    const later = { ...baseline, saldoInicial: 1700, fechaSaldoInicial: "2026-10-11" };
    const results = await Promise.all([PUT(request("PUT", earlier)), PUT(request("PUT", later))]);
    expect(results.map(result => result.status)).toEqual([200, 200]);
    const stored = (await accountRef().get()).data();
    const winner = stored?.fechaSaldoInicial === earlier.fechaSaldoInicial ? earlier : later;
    expect(stored).toMatchObject(winner);
    expect(stored?.creadoEn).toEqual(created);
    for (const field of fields) {
      expect(stored?.[field]).toEqual(winner === earlier ? ["before"] : ["after", "before", "same-day"]);
    }
  }, 15000);

  it("does not change a baseline when the transaction fails", async () => {
    await accountRef().set(baseline);
    const previous = (await accountRef().get()).data();
    const runTransaction = db.runTransaction.bind(db);
    vi.spyOn(db, "runTransaction").mockImplementation((update, options) =>
      runTransaction(async transaction => {
        await update(transaction);
        // Fail after the route has queued its write, before Firestore commits.
        throw new Error("emulator transaction failure");
      }, options),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await PUT(request("PUT", { ...baseline, saldoInicial: 10 }));
    expect(response.status).toBe(500);
    expect((await accountRef().get()).data()).toEqual(previous);
    expect(log).toHaveBeenCalled();
  });

  it("does not leave a partial legacy backfill when its transaction fails", async () => {
    await seedMovements();
    await accountRef().set(baseline);
    const runTransaction = db.runTransaction.bind(db);
    vi.spyOn(db, "runTransaction").mockImplementation((update, options) =>
      runTransaction(async transaction => {
        await update(transaction);
        throw new Error("abort legacy backfill");
      }, options),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await GET(request("GET"))).status).toBe(500);
    expect((await accountRef().get()).data()).toEqual(baseline);
  });

  it("rejects a deactivated account before starting a financial transaction", async () => {
    await db.doc(`allowedUsers/${state.uid}`).update({ activo: false });
    const transaction = vi.spyOn(db, "runTransaction");
    expect((await PUT(request("PUT"))).status).toBe(403);
    expect((await GET(request("GET"))).status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
    expect((await accountRef().get()).exists).toBe(false);
  });

  it("rejects invalid input without starting a financial transaction", async () => {
    const transaction = vi.spyOn(db, "runTransaction");
    expect((await PUT(request("PUT", { ...baseline, fechaSaldoInicial: "invalid-date" }))).status).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
    expect((await accountRef().get()).exists).toBe(false);
  });
});
