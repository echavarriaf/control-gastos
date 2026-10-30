import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { ingresosDesdeSaldoInicial, movimientosDesdeSaldoInicial } from "@/lib/firestore/financial-queries";
import { calcularResumenCuentaGastos, type CuentaGastos, type MovimientoManualCuenta } from "@/lib/budget/expense-account";
import type { Ingreso } from "@/lib/budget/types";

const UID = "query-user";
const fecha = "2026-10-10";
let env: RulesTestEnvironment;
const cuenta: CuentaGastos = {
  id: "cuenta-gastos", nombre: "Cuenta", saldoInicial: 1000, fechaSaldoInicial: fecha, activa: true,
  ingresosIncluidosEnSaldoInicial: ["same-day"], gastosIncluidosEnSaldoInicial: [],
  pagosFijosIncluidosEnSaldoInicial: [], pagosTarjetaIncluidosEnSaldoInicial: [],
  movimientosManualesIncluidosEnSaldoInicial: ["same-day"],
};
function income(id: string, scheduled: string, received: string | null, estado: Ingreso["estado"] = "recibido"): Ingreso {
  return {
    id, configuracionIngresoId: null, cicloPagoId: id, descripcion: id, monto: 100,
    fechaProgramada: scheduled, fechaRecibida: received, periodoCalendario: scheduled.slice(0, 7),
    numeroPagoMes: 1, numeroPagoAnual: 1, fuente: "otro", estado, recurrente: false, notas: "",
  };
}
const ingresos = [
  ...Array.from({ length: 80 }, (_, index) => income(`old-${index}`, "2025-01-01", "2025-01-01")),
  income("same-day", fecha, fecha),
  income("late-receipt", "2025-01-01", "2026-10-12"),
  income("cancelled", fecha, fecha, "cancelado"),
  income("projected", "2026-10-20", null, "proyectado"),
  income("future", "2027-01-01", "2027-01-01"),
];
const manuales: MovimientoManualCuenta[] = [
  ...Array.from({ length: 80 }, (_, index) => ({
    id: `old-${index}`, direccion: "salida" as const, concepto: "Anterior", monto: 50, fecha: "2025-01-01", notas: "",
  })),
  { id: "same-day", direccion: "salida", concepto: "Ya incluido", monto: 50, fecha, notas: "" },
  { id: "after", direccion: "salida", concepto: "Salida", monto: 20, fecha: "2026-10-11", notas: "" },
  { id: "entry", direccion: "entrada", concepto: "Entrada", monto: 30, fecha: "2026-10-12", notas: "" },
];

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-presupuesto", firestore: {
    host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8"),
  } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, "allowedUsers", UID), { activo: true });
    for (const { id, ...data } of ingresos) batch.set(doc(db, "users", UID, "ingresos", id), data);
    for (const { id, ...data } of manuales) batch.set(doc(db, "users", UID, "movimientosCuenta", id), data);
    await batch.commit();
  });
});
afterAll(async () => { await env.cleanup(); });

describe("Financial query ranges", () => {
  it("reads only manual movements on or after the bank baseline", async () => {
    const db = env.authenticatedContext(UID).firestore();
    const result = await getDocs(movimientosDesdeSaldoInicial(collection(db, "users", UID, "movimientosCuenta"), fecha));
    expect(result.docs.map(document => document.id)).toEqual(["entry", "after", "same-day"]);
    expect(result.size).toBe(3);
    expect(manuales.length).toBe(83);
  });

  it("includes a deposit received after recalibration even if scheduled much earlier", async () => {
    const db = env.authenticatedContext(UID).firestore();
    const result = await getDocs(ingresosDesdeSaldoInicial(collection(db, "users", UID, "ingresos"), fecha));
    expect(result.docs.map(document => document.id)).toContain("late-receipt");
    expect(result.docs.map(document => document.id)).not.toContain("old-0");
    expect(result.size).toBe(4);
  });

  it("produces the same complete bank summary as loading the entire history", async () => {
    const db = env.authenticatedContext(UID).firestore();
    const [deposits, movements] = await Promise.all([
      getDocs(ingresosDesdeSaldoInicial(collection(db, "users", UID, "ingresos"), fecha)),
      getDocs(movimientosDesdeSaldoInicial(collection(db, "users", UID, "movimientosCuenta"), fecha)),
    ]);
    const idsDeposits = new Set(deposits.docs.map(document => document.id));
    const idsMovements = new Set(movements.docs.map(document => document.id));
    const summary = (values: Ingreso[], manual: MovimientoManualCuenta[]) => calcularResumenCuentaGastos(
      cuenta, values, [], [], [], [], [], null, new Date(2026, 9, 20, 12), manual,
    );
    expect(summary(ingresos.filter(value => idsDeposits.has(value.id)), manuales.filter(value => idsMovements.has(value.id))))
      .toEqual(summary(ingresos, manuales));
  });

  it("expands correctly when the baseline is moved backwards", async () => {
    const db = env.authenticatedContext(UID).firestore();
    const result = await getDocs(movimientosDesdeSaldoInicial(collection(db, "users", UID, "movimientosCuenta"), "2025-01-01"));
    expect(result.size).toBe(manuales.length);
  });

  it("keeps owner authorization on narrowed queries", async () => {
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "allowedUsers", "other"), { activo: true }));
    const db = env.authenticatedContext("other").firestore();
    await assertFails(getDocs(ingresosDesdeSaldoInicial(collection(db, "users", UID, "ingresos"), fecha)));
    await assertFails(getDocs(movimientosDesdeSaldoInicial(collection(db, "users", UID, "movimientosCuenta"), fecha)));
  });
});
