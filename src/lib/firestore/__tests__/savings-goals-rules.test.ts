import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where } from "firebase/firestore";
import { cambiarApartado, normalizarMetaAhorro } from "@/lib/budget/savings-goals";

let env: RulesTestEnvironment;
const uid = "savings-owner";
const base = () => ({ nombre: "Emergencias", objetivo: 1000, apartado: 0, fechaObjetivo: null, notas: "", archivada: false,
  creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp() });
const ref = (user = uid) => doc(env.authenticatedContext(user).firestore(), "users", uid, "metasAhorro", "goal");
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-presupuesto", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), "allowedUsers", uid), { activo: true });
    await setDoc(doc(context.firestore(), "allowedUsers", "other"), { activo: true });
    await setDoc(doc(context.firestore(), "allowedUsers", "disabled"), { activo: false });
    await setDoc(doc(context.firestore(), "users", uid, "cuentas", "cuenta-gastos"), { saldoInicial: 1000 });
  });
});
afterAll(async () => { await env.cleanup(); });

describe("Savings goal schemas and isolation", () => {
  it("creates a zero-funded goal and reads the complete active reserve list without a row limit", async () => {
    await assertSucceeds(setDoc(ref(), base()));
    const db = env.authenticatedContext(uid).firestore();
    const result = await assertSucceeds(getDocs(query(collection(db, "users", uid, "metasAhorro"), where("archivada", "==", false))));
    expect(result.size).toBe(1);
    expect(result.docs[0].data()).toMatchObject({ apartado: 0, objetivo: 1000, archivada: false });
  });
  it("allocates, releases and edits the target while preserving the original creation timestamp", async () => {
    await setDoc(ref(), base()); const creadoEn = (await getDoc(ref())).data()?.creadoEn;
    await assertSucceeds(updateDoc(ref(), { apartado: 250.25, actualizadoEn: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(), { apartado: 100, objetivo: 1200, fechaObjetivo: "2028-02-29", actualizadoEn: serverTimestamp() }));
    expect((await getDoc(ref())).data()).toMatchObject({ apartado: 100, objetivo: 1200, creadoEn });
  });
  it("requires an operating account before creating a goal", async () => {
    await env.withSecurityRulesDisabled(context => deleteDoc(doc(context.firestore(), "users", uid, "cuentas", "cuenta-gastos")));
    await assertFails(setDoc(ref(), base()));
  });
  it.each([{ objetivo: 0 }, { objetivo: 0.004 }, { objetivo: 1000001 }, { objetivo: "1000" }, { apartado: 1 }, { apartado: -1 },
    { fechaObjetivo: "2026-02-29" }, { fechaObjetivo: "2026-11-03T12:00:00Z" }, { nombre: "" }, { nombre: "x".repeat(101) },
    { notas: "x".repeat(501) }, { archivada: true }, { uid: "other" }])("rejects invalid initial goal %j", cambios => {
    return assertFails(setDoc(ref(), { ...base(), ...cambios }));
  });
  it.each([{ apartado: -1 }, { apartado: 1001 }, { apartado: "100" }, { objetivo: 0 }, { fechaObjetivo: "2026-02-30" },
    { creadoEn: Timestamp.fromMillis(0) }, { actualizadoEn: Timestamp.fromMillis(0) }])("rejects invalid goal update %j", async cambios => {
    await setDoc(ref(), base());
    await assertFails(updateDoc(ref(), { actualizadoEn: serverTimestamp(), ...cambios }));
  });
  it("does not allow reducing the target below the reserved amount or archiving funded goals", async () => {
    await setDoc(ref(), base());
    await updateDoc(ref(), { apartado: 500, actualizadoEn: serverTimestamp() });
    await assertFails(updateDoc(ref(), { objetivo: 400, actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(ref(), { archivada: true, actualizadoEn: serverTimestamp() }));
  });
  it("preserves archived goals as immutable history and forbids deletion", async () => {
    await setDoc(ref(), base());
    await assertSucceeds(updateDoc(ref(), { archivada: true, actualizadoEn: serverTimestamp() }));
    await assertFails(updateDoc(ref(), { nombre: "Cambio", actualizadoEn: serverTimestamp() }));
    await assertFails(deleteDoc(ref()));
    expect((await getDoc(ref())).data()?.archivada).toBe(true);
  });
  it.each(["other", "disabled"])("does not expose or modify another user's goals through %s", async user => {
    await setDoc(ref(), base());
    await assertFails(getDoc(ref(user)));
    await assertFails(updateDoc(ref(user), { apartado: 10, actualizadoEn: serverTimestamp() }));
    await assertFails(deleteDoc(ref(user)));
    await assertFails(setDoc(doc(env.authenticatedContext(user).firestore(), "users", uid, "metasAhorro", "forged"), base()));
  });
  it("requires authorization for both listing and allocating", async () => {
    await setDoc(ref(), base());
    await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), "allowedUsers", uid), { activo: false }));
    await assertFails(getDocs(collection(env.authenticatedContext(uid).firestore(), "users", uid, "metasAhorro")));
    await assertFails(updateDoc(ref(), { apartado: 10, actualizadoEn: serverTimestamp() }));
  });
});

describe("Concurrent savings allocations", () => {
  async function cambiar(accion: "apartar" | "liberar", importe: number) {
    const referencia = ref();
    await runTransaction(referencia.firestore, async transaction => {
      const snapshot = await transaction.get(referencia);
      const meta = normalizarMetaAhorro(snapshot.id, snapshot.data()!);
      if (!meta) throw new Error("Invalid goal");
      transaction.update(referencia, { apartado: cambiarApartado(meta, accion, importe), actualizadoEn: serverTimestamp() });
    });
  }
  it("keeps both contributions and subsequent releases across concurrent transactions", async () => {
    await setDoc(ref(), base());
    await Promise.all([cambiar("apartar", 30.1), cambiar("apartar", 40.2)]);
    expect((await getDoc(ref())).data()?.apartado).toBe(70.3);
    await cambiar("liberar", 20.1);
    expect((await getDoc(ref())).data()?.apartado).toBe(50.2);
  }, 20_000);
  it("does not exceed the target when two tabs try to reserve the same remaining funds", async () => {
    await setDoc(ref(), { ...base(), objetivo: 100 });
    const results = await Promise.allSettled([cambiar("apartar", 70), cambiar("apartar", 70)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await getDoc(ref())).data()?.apartado).toBe(70);
  }, 20_000);
});
