import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ db: null as Firestore | null }));
vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => { if (!state.db) throw new Error("Missing emulator"); return state.db; },
  getAdminAuth: () => ({ verifyIdToken: async (token: string, revoked: boolean) => {
    expect(revoked).toBe(true);
    if (token === "invalid") throw new Error("Invalid token");
    return { uid: token };
  } }),
}));
import { DELETE, GET, POST } from "@/app/api/movements/trash/route";
import { COLECCIONES_RECUPERABLES, type MovimientoEliminado, type PaginaPapelera } from "@/lib/movement-trash/types";
import { calcularResumenCuentaGastos, type CuentaGastos } from "@/lib/budget/expense-account";
import { crearResumenTarjeta } from "@/lib/budget/credit-cards/summary";
import { normalizarCreadoEn } from "@/lib/budget/budget-data-normalizers";
import type { GastoVariable, PagoTarjeta, TarjetaCredito } from "@/lib/budget/types";

let app: App;
let db: Firestore;
let env: RulesTestEnvironment;
let uid: string;
let other: string;
const original = { concepto: "Movimiento histórico", monto: 100, fecha: "2026-11-03", metodoPago: "debito",
  creadoEn: Timestamp.fromDate(new Date("2026-11-03T12:00:00Z")), campoLegacy: "Conservar" };
const request = (method: string, body?: unknown, user = uid, cursor?: string) => new NextRequest(
  `http://localhost:3000/api/movements/trash${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {
    method, headers: { Authorization: `Bearer ${user}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const source = (coleccion = "gastos", id = "movement", user = uid) => db.doc(`users/${user}/${coleccion}/${id}`);
const archive = (id: string, user = uid) => db.doc(`users/${user}/papeleraMovimientos/${id}`);
async function eliminar(coleccion = "gastos", id = "movement"): Promise<MovimientoEliminado> {
  const response = await DELETE(request("DELETE", { coleccion, documentoId: id }));
  expect(response.status).toBe(200);
  return (await response.json()).movimiento;
}
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Firestore emulator required");
  app = initializeApp({ projectId: "demo-presupuesto" }, `trash-${randomUUID()}`);
  db = getFirestore(app); state.db = db;
  env = await initializeTestEnvironment({ projectId: "demo-presupuesto", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
beforeEach(async () => {
  uid = `trash-${randomUUID()}`; other = `other-${randomUUID()}`;
  await Promise.all([db.doc(`allowedUsers/${uid}`).set({ activo: true }), db.doc(`allowedUsers/${other}`).set({ activo: true })]);
});
afterAll(async () => { await env.cleanup(); await db.terminate(); await deleteApp(app); });

describe("Persistent movement trash API", () => {
  it("restores the same bank balance after deleting and recovering a debit expense", async () => {
    const cuenta: CuentaGastos = { id: "cuenta-gastos", nombre: "Banco", saldoInicial: 1000, fechaSaldoInicial: "2026-11-01", activa: true,
      ingresosIncluidosEnSaldoInicial: [], gastosIncluidosEnSaldoInicial: [], pagosFijosIncluidosEnSaldoInicial: [], pagosTarjetaIncluidosEnSaldoInicial: [] };
    const gasto: GastoVariable = { id: "movement", concepto: "Comida", monto: 100, categoria: "comida", fecha: "2026-11-03", creadoEn: "2026-11-03T12:00:00Z",
      metodoPago: "debito", tarjetaId: null, estadoTarjeta: null, comentario: "" };
    await db.doc(`users/${uid}/cuentas/cuenta-gastos`).set(cuenta);
    await source().set(gasto);
    const saldo = async () => {
      const snapshot = await source().get();
      const data = snapshot.data();
      const gastos = data ? [{ ...data, id: snapshot.id, creadoEn: normalizarCreadoEn(data.creadoEn, data.fecha) } as GastoVariable] : [];
      return calcularResumenCuentaGastos(cuenta, [], gastos, [], [], [], [], null, new Date(2026, 10, 3, 12)).saldoActual;
    };
    expect(await saldo()).toBe(900);
    const item = await eliminar(); expect(await saldo()).toBe(1000);
    expect((await POST(request("POST", { id: item.id }))).status).toBe(200);
    expect(await saldo()).toBe(900);
  });
  it.each(["cuenta_gastos", "cuenta_externa"] as const)("restores card debt and the correct bank effect for %s", async origenFondos => {
    const tarjeta: TarjetaCredito = { id: "card", nombre: "Visa", ultimosCuatro: "1234", saldoInicial: 200, fechaSaldoInicial: "2026-11-01",
      diaCorte: 25, diaPago: 20, activa: true, estrategiaPago: "saldo_completo", pagoObjetivo: null, limiteCredito: 1000, notas: "" };
    const cuenta: CuentaGastos = { id: "cuenta-gastos", nombre: "Banco", saldoInicial: 1000, fechaSaldoInicial: "2026-11-01", activa: true,
      ingresosIncluidosEnSaldoInicial: [], gastosIncluidosEnSaldoInicial: [], pagosFijosIncluidosEnSaldoInicial: [], pagosTarjetaIncluidosEnSaldoInicial: [] };
    const pago: PagoTarjeta = { id: "movement", concepto: "Pago Visa", monto: 50, fecha: "2026-11-03", creadoEn: "2026-11-03T12:00:00Z",
      categoria: "general", tarjetaId: "card", estadoTarjeta: "contabilizada", origenFondos };
    await source("tarjetasCredito", "card").set(tarjeta); await source("pagosTarjeta").set(pago);
    const saldos = async () => {
      const data = (await source("pagosTarjeta").get()).data();
      const pagos = data ? [data as PagoTarjeta] : [];
      const reference = new Date(2026, 10, 3, 12);
      return { banco: calcularResumenCuentaGastos(cuenta, [], [], [], [], pagos, [], null, reference).saldoActual,
        tarjeta: crearResumenTarjeta(tarjeta, [], [], pagos, reference).saldoActual };
    };
    const inicial = await saldos();
    expect(inicial).toEqual({ banco: origenFondos === "cuenta_gastos" ? 950 : 1000, tarjeta: 150 });
    const item = await eliminar("pagosTarjeta"); expect(await saldos()).toEqual({ banco: 1000, tarjeta: 200 });
    expect((await POST(request("POST", { id: item.id }))).status).toBe(200);
    expect(await saldos()).toEqual(inicial);
  });
  it.each(COLECCIONES_RECUPERABLES)("archives and restores %s atomically with its exact ID, timestamps and legacy data", async coleccion => {
    await source(coleccion).set(original);
    const item = await eliminar(coleccion);
    expect((await source(coleccion).get()).exists).toBe(false);
    expect((await archive(item.id).get()).data()?.datos).toEqual(original);
    const result = await POST(request("POST", { id: item.id }));
    expect(result.status).toBe(200);
    expect((await source(coleccion).get()).data()).toEqual(original);
    expect((await archive(item.id).get()).exists).toBe(false);
    const eventos = await db.collection(`users/${uid}/historialCambios`).orderBy("fecha", "asc").get();
    expect(eventos.docs.map(documento => documento.data().accion)).toEqual(["eliminado", "recuperado"]);
    expect(eventos.docs[0].data()).toMatchObject({ actorUid: uid, coleccion, documentoId: "movement", antes: original, despues: null });
    expect(eventos.docs[1].data()).toMatchObject({ antes: null, despues: original });
  });
  it("does not trust a UID or replacement document supplied by the browser", async () => {
    await source().set(original); await source("gastos", "movement", other).set({ ...original, monto: 999 });
    const result = await DELETE(request("DELETE", { coleccion: "gastos", documentoId: "movement", uid: other, datos: { monto: 1 } }));
    const item = (await result.json()).movimiento;
    expect((await archive(item.id).get()).data()?.datos).toEqual(original);
    expect((await source("gastos", "movement", other).get()).data()?.monto).toBe(999);
    expect((await POST(request("POST", { id: item.id, uid, datos: original }, other))).status).toBe(404);
    expect((await archive(item.id).get()).exists).toBe(true);
  });
  it("does not overwrite a document recreated in another tab", async () => {
    await source().set(original); const item = await eliminar();
    await source().set({ ...original, monto: 55 });
    const result = await POST(request("POST", { id: item.id }));
    expect(result.status).toBe(409);
    expect((await source().get()).data()?.monto).toBe(55);
    expect((await archive(item.id).get()).exists).toBe(true);
  });
  it("allows only one concurrent deletion and one concurrent restore", async () => {
    await source().set(original);
    const deleted = await Promise.all([DELETE(request("DELETE", { coleccion: "gastos", documentoId: "movement" })), DELETE(request("DELETE", { coleccion: "gastos", documentoId: "movement" }))]);
    expect(deleted.map(result => result.status).sort()).toEqual([200, 404]);
    const archives = await db.collection(`users/${uid}/papeleraMovimientos`).get();
    expect(archives.size).toBe(1);
    const restored = await Promise.all([POST(request("POST", { id: archives.docs[0].id })), POST(request("POST", { id: archives.docs[0].id }))]);
    expect(restored.map(result => result.status).sort()).toEqual([200, 404]);
    expect((await source().get()).data()).toEqual(original);
  }, 20_000);
  it("keeps the bank snapshot IDs intact when restoring a previously included movement", async () => {
    const cuenta = { saldoInicial: 1000, fechaSaldoInicial: "2026-11-03", gastosIncluidosEnSaldoInicial: ["movement"] };
    await db.doc(`users/${uid}/cuentas/cuenta-gastos`).set(cuenta);
    await source().set(original); const item = await eliminar();
    expect((await POST(request("POST", { id: item.id }))).status).toBe(200);
    expect((await db.doc(`users/${uid}/cuentas/cuenta-gastos`).get()).data()).toEqual(cuenta);
  });
  it("blocks bank restores after recalibration but preserves the archived copy", async () => {
    await source().set(original); const item = await eliminar();
    await db.doc(`users/${uid}/cuentas/cuenta-gastos`).set({ saldoInicial: 500, fechaSaldoInicial: "2026-11-03" });
    expect((await POST(request("POST", { id: item.id }))).status).toBe(409);
    expect((await archive(item.id).get()).exists).toBe(true);
    expect((await source().get()).exists).toBe(false);
  });
  it("permits a bank account name change without treating it as recalibration", async () => {
    const cuenta = db.doc(`users/${uid}/cuentas/cuenta-gastos`);
    await cuenta.set({ saldoInicial: 1000, fechaSaldoInicial: "2026-11-01", nombre: "Banco" });
    await source().set(original); const item = await eliminar();
    await cuenta.update({ nombre: "Mi banco" });
    expect((await POST(request("POST", { id: item.id }))).status).toBe(200);
  });
  it("preserves an external card payment's origin and pending state across deletion", async () => {
    await source("tarjetasCredito", "card").set({ saldoInicial: 200, fechaSaldoInicial: "2026-11-01" });
    const payment = { ...original, tarjetaId: "card", estadoTarjeta: "pendiente", origenFondos: "cuenta_externa" };
    await source("pagosTarjeta").set(payment); const item = await eliminar("pagosTarjeta");
    await db.doc(`users/${uid}/cuentas/cuenta-gastos`).set({ saldoInicial: 500, fechaSaldoInicial: "2026-11-03" });
    expect((await POST(request("POST", { id: item.id }))).status).toBe(200);
    expect((await source("pagosTarjeta").get()).data()).toEqual(payment);
  });
  it("does not restore a card movement after that card was recalibrated", async () => {
    await source("tarjetasCredito", "card").set({ saldoInicial: 200, fechaSaldoInicial: "2026-11-01" });
    await source().set({ ...original, metodoPago: "tarjeta_credito", tarjetaId: "card" }); const item = await eliminar();
    await source("tarjetasCredito", "card").update({ saldoInicial: 100 });
    expect((await POST(request("POST", { id: item.id }))).status).toBe(409);
    expect((await archive(item.id).get()).exists).toBe(true);
  });
  it.each([["tarjetaId", "tarjetasCredito"], ["compromisoId", "compromisosFijos"]])("rejects restoration when the owning user's %s is missing", async (campo, coleccion) => {
    await source(coleccion, "dependency").set({ saldoInicial: 0 });
    await source().set({ ...original, [campo]: "dependency" }); const item = await eliminar();
    await source(coleccion, "dependency").delete();
    await source(coleccion, "dependency", other).set({ saldoInicial: 0 });
    expect((await POST(request("POST", { id: item.id }))).status).toBe(409);
    expect((await archive(item.id).get()).exists).toBe(true);
  });
  it("paginates without exposing archived payloads or other users' trash", async () => {
    const batch = db.batch();
    for (let index = 0; index < 23; index++) {
      batch.set(archive(`page-${String(index).padStart(2, "0")}`), { datos: original, coleccion: "gastos", documentoId: `original-${index}`, eliminadoEn: Timestamp.fromMillis(1000 + index) });
    }
    batch.set(archive("secret", other), { datos: original, coleccion: "gastos", documentoId: "secret", eliminadoEn: Timestamp.now() });
    await batch.commit();
    const first: PaginaPapelera = await (await GET(request("GET"))).json();
    expect(first.movimientos).toHaveLength(20); expect(first.movimientos[0].id).toBe("page-22");
    expect(first.movimientos[0]).not.toHaveProperty("datos");
    const second: PaginaPapelera = await (await GET(request("GET", undefined, uid, first.siguiente ?? undefined))).json();
    expect(second.movimientos).toHaveLength(3); expect(second.siguiente).toBeNull();
    expect(new Set([...first.movimientos, ...second.movimientos].map(item => item.id)).size).toBe(23);
  });
  it.each(["allowedUsers", "cuentas", "papeleraMovimientos", "gastos/other", "../ingresos"])("rejects unsupported collection %s", async coleccion => {
    expect((await DELETE(request("DELETE", { coleccion, documentoId: "movement" }))).status).toBe(400);
  });
  it.each(["", "../movement", "x/y", "..", "__hidden__"])("rejects invalid document path %j", async documentoId => {
    expect((await DELETE(request("DELETE", { coleccion: "gastos", documentoId }))).status).toBe(400);
  });
  it("requires a valid session and active authorization for every action", async () => {
    expect((await GET(new NextRequest("http://localhost/api/movements/trash"))).status).toBe(401);
    expect((await GET(request("GET", undefined, "invalid"))).status).toBe(401);
    await source().set(original); const item = await eliminar();
    await db.doc(`allowedUsers/${uid}`).update({ activo: false });
    expect((await GET(request("GET"))).status).toBe(403);
    expect((await POST(request("POST", { id: item.id }))).status).toBe(403);
    expect((await DELETE(request("DELETE", { coleccion: "gastos", documentoId: "other" }))).status).toBe(403);
    expect((await archive(item.id).get()).exists).toBe(true);
  });
  it("keeps the archive unreadable and unforgeable through the browser Firestore SDK", async () => {
    await source().set(original); const item = await eliminar();
    for (const user of [uid, other]) {
      const ref = doc(env.authenticatedContext(user).firestore(), "users", uid, "papeleraMovimientos", item.id);
      await assertFails(getDoc(ref)); await assertFails(setDoc(ref, { datos: { monto: 1 } })); await assertFails(deleteDoc(ref));
    }
  });
});
