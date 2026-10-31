import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { FidMulticastMessage } from "firebase-admin/messaging";

const state = vi.hoisted(() => ({ db: null as Firestore | null, send: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => {
    if (!state.db) throw new Error("Missing emulator");
    return state.db;
  },
  getAdminMessaging: () => ({ sendEachForMulticast: state.send }),
}));
import { evaluarAlertasUsuario } from "@/lib/push/evaluate-user-alerts";

let app: App;
let db: Firestore;
let uid: string;
const now = new Date("2026-10-20T12:00:00.000Z");
function success(message: FidMulticastMessage) {
  return Promise.resolve({ successCount: message.fids.length, failureCount: 0,
    responses: message.fids.map(() => ({ success: true, messageId: "test-message" })),
  });
}
async function device(fid = "test-device") {
  await db.doc(`users/${uid}/notificationDevices/${encodeURIComponent(fid)}`).set({ activo: true, installationId: fid });
}
async function spending() {
  await db.doc(`users/${uid}/configuracion/presupuestoFelo`).set({ limites: {
    comida: { mensual: 100, quincenal: 100 }, gas: { mensual: 100, quincenal: 100 },
  } });
  await db.doc(`users/${uid}/gastos/food`).set({ categoria: "comida", monto: 95, fecha: now.toISOString() });
}
async function card() {
  await db.doc(`users/${uid}/tarjetasCredito/card`).set({ nombre: "Tarjeta test", ultimosCuatro: "1234",
    saldoInicial: 100, fechaSaldoInicial: "2026-10-01", diaCorte: 25, activa: true,
  });
}

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("These tests require the Firestore emulator");
  app = initializeApp({ projectId: "demo-presupuesto" }, `push-tests-${randomUUID()}`);
  db = getFirestore(app); state.db = db;
});
beforeEach(() => { uid = `push-test-${randomUUID()}`; state.send.mockReset().mockImplementation(success); });
afterEach(async () => { vi.restoreAllMocks(); await db.recursiveDelete(db.doc(`users/${uid}`)); });
afterAll(async () => { await db.terminate(); await deleteApp(app); });

describe("Push evaluation with emulated storage and simulated messaging", () => {
  it("returns no alerts for an empty budget", async () => {
    const result = await evaluarAlertasUsuario(uid, now);
    expect(result).toMatchObject({ periodo: "2026-10", quincena: 2, evaluadas: 4, alertas: 0, enviadas: 0 });
    expect(state.send).not.toHaveBeenCalled();
  });

  it("delivers monthly and quincenal alerts and deduplicates a second evaluation", async () => {
    await spending(); await device();
    const result = await evaluarAlertasUsuario(uid, now);
    expect(result).toMatchObject({ alertasPresupuesto: 2, alertasTarjetas: 0, enviadas: 2, fallidas: 0 });
    expect(state.send).toHaveBeenCalledTimes(2);
    const messages = state.send.mock.calls.map(([message]) => message);
    expect(messages.map(message => message.data.alcance).sort()).toEqual(["mensual", "quincenal"]);
    expect(messages[0]).toMatchObject({ fids: ["test-device"], data: { nivel: "90", saldo: "95.00", tipo: "presupuesto", url: "/" } });
    const repeated = await evaluarAlertasUsuario(uid, now);
    expect(repeated.alertas).toBe(0);
    expect(state.send).toHaveBeenCalledTimes(2);
  });

  it("leaves alerts retryable when no device exists", async () => {
    await spending();
    expect(await evaluarAlertasUsuario(uid, now)).toMatchObject({ alertas: 2, enviadas: 0, dispositivos: 0 });
    const pending = await db.collection(`users/${uid}/notificationAlertStates`).get();
    expect(pending.docs.every(document => document.data().deliveryPending === true)).toBe(true);
    await device();
    expect(await evaluarAlertasUsuario(uid, now)).toMatchObject({ alertas: 2, enviadas: 2 });
  });

  it("releases a failed delivery for a later successful retry", async () => {
    await spending(); await device();
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.send.mockRejectedValue(new Error("simulated FCM failure"));
    expect(await evaluarAlertasUsuario(uid, now)).toMatchObject({ enviadas: 0, fallidas: 2 });
    state.send.mockImplementation(success);
    expect(await evaluarAlertasUsuario(uid, now)).toMatchObject({ alertas: 2, enviadas: 2, fallidas: 0 });
  });

  it("deactivates an invalid installation without sending any real notification", async () => {
    await spending(); await device("invalid/device");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    state.send.mockResolvedValue({ successCount: 0, failureCount: 1,
      responses: [{ success: false, error: { code: "messaging/registration-token-not-registered", message: "invalid" } }],
    });
    expect(await evaluarAlertasUsuario(uid, now)).toMatchObject({ enviadas: 0, fallidas: 2 });
    expect((await db.doc(`users/${uid}/notificationDevices/invalid%2Fdevice`).get()).data()).toMatchObject({ activo: false });
  });

  it("prepares the principal card payment in its five-day window", async () => {
    await card(); await device();
    expect(await evaluarAlertasUsuario(uid, now)).toMatchObject({ alertasTarjetas: 1, enviadas: 1 });
    expect(state.send.mock.calls[0][0]).toMatchObject({ data: {
      tipo: "tarjeta", clase: "principal", monto: "100.00", fechaCorteISO: "2026-10-25", estadoVentana: "pagar_ahora",
    } });
  });

  it("does not prepare card payments outside their payment window", async () => {
    await card(); await device();
    expect(await evaluarAlertasUsuario(uid, new Date("2026-10-15T12:00:00Z"))).toMatchObject({ alertasTarjetas: 0, enviadas: 0 });
    expect(state.send).not.toHaveBeenCalled();
  });

  it("assigns third-paycheck spending and calendar-only dates to the next budget month", async () => {
    await db.doc(`users/${uid}/configuracion/ingresoPrincipal`).set({ descripcion: "Salario", montoEstimado: 1000,
      fuente: "salario", frecuencia: "cada_2_semanas", fechaAncla: "2026-10-02", intervaloDias: 14, activa: true, notas: "" });
    await db.doc(`users/${uid}/configuracion/presupuestoFelo`).set({ limites: {
      comida: { mensual: 100, quincenal: 100 }, gas: { mensual: 100, quincenal: 100 },
    } });
    await db.doc(`users/${uid}/gastos/third-paycheck`).set({ categoria: "comida", monto: 95, fecha: "2026-10-30" });
    await device();
    expect(await evaluarAlertasUsuario(uid, new Date("2026-10-30T12:00:00Z")))
      .toMatchObject({ periodo: "2026-11", quincena: 1, alertasPresupuesto: 2 });
    expect(state.send.mock.calls.map(([message]) => message.data.tag).sort())
      .toEqual(["2026-11_comida_mensual_90", "2026-11_comida_q1_90"]);
  });

  it("includes prior-cycle overspending in a paycheck's quincenal alert", async () => {
    await db.doc(`users/${uid}/configuracion/ingresoPrincipal`).set({ descripcion: "Salario", montoEstimado: 1000,
      fuente: "salario", frecuencia: "cada_2_semanas", fechaAncla: "2026-10-02", intervaloDias: 14, activa: true, notas: "" });
    await db.doc(`users/${uid}/configuracion/presupuestoFelo`).set({ limites: {
      comida: { mensual: 1200, quincenal: 600 }, gas: { mensual: 200, quincenal: 100 },
    } });
    await db.doc(`users/${uid}/gastos/previous`).set({ categoria: "comida", monto: 650, fecha: "2026-10-20T12:00:00Z" });
    await db.doc(`users/${uid}/gastos/current`).set({ categoria: "comida", monto: 500, fecha: "2026-10-30T12:00:00Z" });
    await device();
    expect(await evaluarAlertasUsuario(uid, new Date("2026-10-30T12:00:00Z")))
      .toMatchObject({ periodo: "2026-11", quincena: 1, alertasPresupuesto: 1, enviadas: 1 });
    expect(state.send.mock.calls[0][0].data).toMatchObject({ alcance: "quincenal", nivel: "90", saldo: "550.00", limite: "600.00" });
  });

  it("does not apply next-paycheck expenses to the current quincena", async () => {
    await db.doc(`users/${uid}/configuracion/ingresoPrincipal`).set({ descripcion: "Salario", montoEstimado: 1000,
      fuente: "salario", frecuencia: "cada_2_semanas", fechaAncla: "2026-10-02", intervaloDias: 14, activa: true, notas: "" });
    await db.doc(`users/${uid}/configuracion/presupuestoFelo`).set({ limites: {
      comida: { mensual: 100, quincenal: 100 }, gas: { mensual: 100, quincenal: 100 },
    } });
    await db.doc(`users/${uid}/gastos/future-paycheck`).set({ categoria: "comida", monto: 1000, fecha: "2026-10-30T12:00:00Z" });
    await device();
    expect(await evaluarAlertasUsuario(uid, new Date("2026-10-29T12:00:00Z")))
      .toMatchObject({ periodo: "2026-10", quincena: 2, alertasPresupuesto: 0 });
    expect(state.send).not.toHaveBeenCalled();
  });
});
