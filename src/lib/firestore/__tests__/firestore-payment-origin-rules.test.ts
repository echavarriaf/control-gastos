import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;
const uid = "payment-origin-owner";
function base() {
  return { concepto: "Pago", tarjeta: "Tarjeta", monto: 100, categoria: "general", fecha: "2026-10-20T12:00:00Z",
    tarjetaId: "card", estadoTarjeta: "contabilizada", referencia: "", notas: "", creadoEn: Timestamp.now() };
}
function ref(user = uid) { return doc(env.authenticatedContext(user).firestore(), "users", uid, "pagosTarjeta", "payment"); }
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-presupuesto", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "allowedUsers", uid), { activo: true });
    await setDoc(doc(db, "allowedUsers", "other"), { activo: true });
    await setDoc(doc(db, "users", uid, "tarjetasCredito", "card"), { nombre: "Tarjeta" });
    await setDoc(doc(db, "users", "other", "tarjetasCredito", "foreign-card"), { nombre: "Otra tarjeta" });
  });
});
afterAll(async () => { await env.cleanup(); });

describe("Card payment origin rules", () => {
  it.each(["cuenta_gastos", "cuenta_externa"])("accepts and persists %s", async origenFondos => {
    await assertSucceeds(setDoc(ref(), { ...base(), origenFondos }));
    expect((await getDoc(ref())).data()?.origenFondos).toBe(origenFondos);
  });
  it("keeps historical payments without an origin readable and editable", async () => {
    await assertSucceeds(setDoc(ref(), base()));
    await assertSucceeds(updateDoc(ref(), { monto: 50, actualizadoEn: Timestamp.now() }));
    expect((await getDoc(ref())).data()?.monto).toBe(50);
  });
  it("allows selecting or changing the source on an existing payment", async () => {
    await setDoc(ref(), base());
    await assertSucceeds(updateDoc(ref(), { origenFondos: "cuenta_externa", actualizadoEn: Timestamp.now() }));
    await assertSucceeds(updateDoc(ref(), { origenFondos: "cuenta_gastos", actualizadoEn: Timestamp.now() }));
  });
  it.each([null, "", "external", "other-user-account", 12, {}, []])("rejects invalid origin %j on creation and update", async origenFondos => {
    await assertFails(setDoc(ref(), { ...base(), origenFondos }));
    await setDoc(ref(), base());
    await assertFails(updateDoc(ref(), { origenFondos, actualizadoEn: Timestamp.now() }));
  });
  it("does not allow another authorized user to modify the payment", async () => {
    await setDoc(ref(), base());
    await assertFails(updateDoc(ref("other"), { origenFondos: "cuenta_externa", actualizadoEn: Timestamp.now() }));
  });
  it("does not allow an external payment to reference someone else's card", async () => {
    await assertFails(setDoc(ref(), { ...base(), origenFondos: "cuenta_externa", tarjetaId: "foreign-card" }));
  });
});
