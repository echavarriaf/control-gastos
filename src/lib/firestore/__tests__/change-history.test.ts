import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from "firebase/firestore";
import { addDocConHistorial, registrarCambioEnTransaccion, setDocConHistorial, transaccionConHistorial, updateDocConHistorial } from "@/lib/history/client-writes";
import { cambiosHistorial } from "@/lib/history/types";
import { cambiarApartado, normalizarMetaAhorro } from "@/lib/budget/savings-goals";

const state = vi.hoisted(() => ({ client: null as Firestore | null }));
vi.mock("@/lib/firestore/user-paths", () => ({ getUserCollection: (uid: string, name: string) => {
  if (!state.client) throw new Error("Missing client"); return collection(state.client, "users", uid, name);
} }));
import { leerHistorial } from "@/lib/history/read";
let env: RulesTestEnvironment;
const uid = "history-owner";
const manual = () => ({ direccion: "salida", concepto: "Compra", monto: 50, fecha: "2026-11-03", notas: "", creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp() });
const pago = () => ({ concepto: "Pago Visa", tarjeta: "Visa", monto: 100, categoria: "general", fecha: "2026-11-03", tarjetaId: "card",
  estadoTarjeta: "contabilizada", origenFondos: "cuenta_gastos", referencia: "", notas: "", creadoEn: serverTimestamp() });
const ref = (collectionName = "movimientosCuenta", id = "source") => doc(state.client!, "users", uid, collectionName, id);
const historial = () => collection(state.client!, "users", uid, "historialCambios");
const eventos = async () => (await getDocs(query(historial(), orderBy("fecha", "asc")))).docs;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-presupuesto", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
beforeEach(async () => {
  await env.clearFirestore(); state.client = env.authenticatedContext(uid).firestore();
  await env.withSecurityRulesDisabled(async context => {
    for (const user of [uid, "other"]) await setDoc(doc(context.firestore(), "allowedUsers", user), { activo: true });
    await setDoc(doc(context.firestore(), "users", uid, "tarjetasCredito", "card"), { nombre: "Visa" });
    await setDoc(doc(context.firestore(), "users", uid, "cuentas", "cuenta-gastos"), { saldoInicial: 1000 });
  });
});
afterAll(async () => { await env.cleanup(); });

describe("Atomic financial history", () => {
  it("creates the record and matching history with trusted timestamps in one transaction", async () => {
    const source = await addDocConHistorial(collection(state.client!, "users", uid, "movimientosCuenta"), manual());
    const data = (await getDoc(source)).data(); const history = await eventos();
    expect(history).toHaveLength(1);
    expect(history[0].data()).toMatchObject({ actorUid: uid, coleccion: "movimientosCuenta", documentoId: source.id, accion: "creado", antes: null, despues: data });
    expect(history[0].data().fecha).toBeInstanceOf(Timestamp);
  });
  it("records actual persisted before/after values when amount, date or payment origin changes", async () => {
    await setDocConHistorial(ref("pagosTarjeta"), pago());
    const original = (await getDoc(ref("pagosTarjeta"))).data();
    await updateDocConHistorial(ref("pagosTarjeta"), { monto: 125, fecha: "2026-11-04", origenFondos: "cuenta_externa", actualizadoEn: serverTimestamp() });
    const history = await eventos(); expect(history).toHaveLength(2);
    expect(history[1].data()).toMatchObject({ accion: "editado", antes: original, despues: (await getDoc(ref("pagosTarjeta"))).data() });
    expect(cambiosHistorial(history[1].data().antes, history[1].data().despues).map(value => value.campo)).toEqual(["monto", "fecha", "origenFondos"]);
  });
  it("preserves fields in merge writes and omits timestamp-only history noise", async () => {
    await setDocConHistorial(ref(), manual());
    await setDocConHistorial(ref(), { concepto: "Editada", actualizadoEn: serverTimestamp() }, { merge: true });
    expect((await getDoc(ref())).data()).toMatchObject({ monto: 50, concepto: "Editada" });
    await updateDocConHistorial(ref(), { actualizadoEn: serverTimestamp() });
    expect(await eventos()).toHaveLength(2);
  });
  it("preserves the original creation timestamp even if another stale form considers the record new", async () => {
    await setDocConHistorial(ref(), manual());
    const original = (await getDoc(ref())).data()?.creadoEn;
    await setDocConHistorial(ref(), { ...manual(), creadoEn: serverTimestamp(), monto: 75 }, { merge: true });
    expect((await getDoc(ref())).data()?.creadoEn).toEqual(original);
  });
  it("rolls back both the financial record and event if source validation fails", async () => {
    await assertFails(addDocConHistorial(collection(state.client!, "users", uid, "movimientosCuenta"), { ...manual(), monto: -1 }));
    expect((await getDocs(collection(state.client!, "users", uid, "movimientosCuenta"))).size).toBe(0);
    expect(await eventos()).toHaveLength(0);
  });
  it("rolls back a valid financial change if its history is invalid", async () => {
    await setDoc(ref(), manual()); const before = (await getDoc(ref())).data()!;
    const batch = writeBatch(state.client!);
    batch.update(ref(), { monto: 60, actualizadoEn: serverTimestamp() });
    batch.set(doc(historial(), "forged"), { actorUid: "other", coleccion: "movimientosCuenta", documentoId: "source", accion: "editado", antes: before,
      despues: { ...before, monto: 60 }, fecha: serverTimestamp() });
    await assertFails(batch.commit());
    expect((await getDoc(ref())).data()?.monto).toBe(50); expect(await eventos()).toHaveLength(0);
  });
  it("does not permit forged, replayed or mutable audit events", async () => {
    await setDocConHistorial(ref(), manual()); const [event] = await eventos(); const data = event.data();
    await assertFails(setDoc(doc(historial(), "replay"), { ...data, fecha: serverTimestamp() }));
    await assertFails(updateDoc(event.ref, { accion: "eliminado" }));
    await assertFails(deleteDoc(event.ref));
    await assertFails(setDoc(doc(historial(), "invented"), { ...data, accion: "recuperado", fecha: serverTimestamp() }));
  });
  it("rejects incorrect before/after values even when the record update itself is valid", async () => {
    await setDoc(ref(), manual()); const before = (await getDoc(ref())).data()!;
    const batch = writeBatch(state.client!); batch.update(ref(), { monto: 70, actualizadoEn: serverTimestamp() });
    batch.set(doc(historial(), "incorrect"), { actorUid: uid, coleccion: "movimientosCuenta", documentoId: "source", accion: "editado", antes: before,
      despues: { ...before, monto: 999, actualizadoEn: serverTimestamp() }, fecha: serverTimestamp() });
    await assertFails(batch.commit()); expect((await getDoc(ref())).data()?.monto).toBe(50);
  });
  it("keeps snapshots and event chronology consistent under concurrent writes", async () => {
    await setDocConHistorial(ref(), manual());
    await Promise.all([updateDocConHistorial(ref(), { monto: 60, actualizadoEn: serverTimestamp() }), updateDocConHistorial(ref(), { monto: 70, actualizadoEn: serverTimestamp() })]);
    const history = await eventos(); expect(history).toHaveLength(3);
    expect(history[2].data().antes).toEqual(history[1].data().despues);
    expect(history[2].data().despues).toEqual((await getDoc(ref())).data());
  }, 20_000);
  it("audits savings goal allocation without creating bank movements", async () => {
    const source = ref("metasAhorro", "goal");
    await setDocConHistorial(source, { nombre: "Viaje", objetivo: 1000, apartado: 0, fechaObjetivo: null, notas: "", archivada: false,
      creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp() });
    await updateDocConHistorial(source, { apartado: 200, actualizadoEn: serverTimestamp() });
    expect((await eventos())[1].data()).toMatchObject({ coleccion: "metasAhorro", antes: { apartado: 0 }, despues: { apartado: 200 } });
    expect((await getDocs(collection(state.client!, "users", uid, "movimientosCuenta"))).size).toBe(0);
  });
  it("keeps both savings contributions and their audit chain under concurrent edits", async () => {
    const source = ref("metasAhorro", "goal");
    await setDocConHistorial(source, { nombre: "Viaje", objetivo: 1000, apartado: 0, fechaObjetivo: null, notas: "", archivada: false,
      creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp() });
    const contribuir = (monto: number) => transaccionConHistorial(source, async (transaction, snapshot) => {
      const meta = normalizarMetaAhorro(snapshot.id, snapshot.data()!);
      if (!meta) throw new Error("Invalid goal");
      const cambios = { apartado: cambiarApartado(meta, "apartar", monto), actualizadoEn: serverTimestamp() };
      transaction.update(source, cambios);
      registrarCambioEnTransaccion(transaction, source, snapshot.data()!, { ...snapshot.data(), ...cambios });
    });
    await Promise.all([contribuir(30.1), contribuir(40.2)]);
    expect((await getDoc(source)).data()?.apartado).toBe(70.3);
    const history = await eventos(); expect(history).toHaveLength(3);
    expect(history[2].data().antes).toEqual(history[1].data().despues);
  }, 20_000);
  it("paginates all immutable events in server order without duplicates or other users' data", async () => {
    await env.withSecurityRulesDisabled(async context => {
      const batch = writeBatch(context.firestore());
      for (let index = 0; index < 23; index++) batch.set(doc(context.firestore(), "users", uid, "historialCambios", `event-${index}`), {
        actorUid: uid, coleccion: "movimientosCuenta", documentoId: `record-${index}`, accion: "editado", antes: { monto: 1 }, despues: { monto: 2 }, fecha: Timestamp.fromMillis(index + 1),
      });
      await batch.commit();
    });
    const first = await leerHistorial(uid); expect(first.eventos).toHaveLength(20);
    const second = await leerHistorial(uid, first.siguiente); expect(second.eventos).toHaveLength(3);
    expect(new Set([...first.eventos, ...second.eventos].map(event => event.id)).size).toBe(23);
    expect(second.siguiente).toBeUndefined();
    const other = env.authenticatedContext("other").firestore();
    await assertFails(getDocs(query(collection(other, "users", uid, "historialCambios"), limit(20))));
  });
  it("does not fabricate entries for financial records from before this feature", async () => {
    await setDoc(ref(), manual()); expect(await eventos()).toHaveLength(0);
    await updateDocConHistorial(ref(), { monto: 75, actualizadoEn: serverTimestamp() });
    expect(await eventos()).toHaveLength(1); expect((await eventos())[0].data()).toMatchObject({ accion: "editado", antes: { monto: 50 } });
  });
  it("keeps nested configuration merge values and their matching event intact", async () => {
    const source = ref("configuracion", "presupuestoFelo");
    await setDocConHistorial(source, { limites: { comida: { mensual: 1000, quincenal: 500 }, gas: { mensual: 200, quincenal: 100 } }, actualizadoEn: "2026-11-03T12:00:00Z" });
    await setDocConHistorial(source, { limites: { comida: { mensual: 1200 } }, actualizadoEn: "2026-11-03T13:00:00Z" }, { merge: true });
    expect((await getDoc(source)).data()?.limites).toEqual({ comida: { mensual: 1200, quincenal: 500 }, gas: { mensual: 200, quincenal: 100 } });
    expect(await eventos()).toHaveLength(2);
  });
});
