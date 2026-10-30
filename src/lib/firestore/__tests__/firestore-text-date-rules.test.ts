import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";

const UID = "date-validation-user";
const ISO = "2026-10-10T12:00:00.000Z";
let env: RulesTestEnvironment;

const expense = {
  concepto: "Compra", monto: 10, categoria: "comida", categoriaTarjetaId: "comida",
  categoriaTarjetaNombre: "Comida", comentario: "", fecha: ISO,
  metodoPago: "debito", tarjetaId: null, estadoTarjeta: null, creadoEn: Timestamp.now(),
};
const cardPayment = {
  concepto: "Pago tarjeta", tarjeta: "Tarjeta", monto: 10, categoria: "general", fecha: ISO,
  tarjetaId: "card", estadoTarjeta: "contabilizada", referencia: "", notas: "", creadoEn: Timestamp.now(),
};
const fixedPayment = {
  compromisoId: "fixed", descripcion: "Pago fijo", monto: 10, fecha: ISO, metodo: "transferencia",
  periodicidad: "mensual", quincena: 1, periodo: "2026-10", tarjetaId: null,
  estadoTarjeta: null, referencia: "", notas: "", creadoEn: Timestamp.now(),
};
const income = {
  configuracionIngresoId: "ingresoPrincipal", cicloPagoId: "income", descripcion: "Ingreso", monto: 10,
  fechaProgramada: "2026-10-10", fechaRecibida: null, periodoCalendario: "2026-10",
  numeroPagoMes: 1, numeroPagoAnual: 1, fuente: "salario", estado: "proyectado", recurrente: true,
  notas: "", creadoEn: ISO, actualizadoEn: ISO,
};
const accessRequest = {
  uid: UID, nombre: "Usuario", email: "usuario@example.com", fotoUrl: null, estado: "pendiente",
  solicitadoEn: ISO, actualizadoEn: ISO, revisadoEn: null, revisadoPor: null,
  correoNotificacionEnviado: false, correoNotificacionEnviadoEn: null,
};

interface Target {
  name: string;
  collection: string;
  field: string;
  base: Record<string, unknown>;
  configId?: string;
}
const targets: Target[] = [
  { name: "gasto.fecha", collection: "gastos", field: "fecha", base: expense },
  { name: "pagoTarjeta.fecha", collection: "pagosTarjeta", field: "fecha", base: cardPayment },
  { name: "pagoFijo.fecha", collection: "pagosFijos", field: "fecha", base: fixedPayment },
  { name: "presupuesto.actualizadoEn", collection: "configuracion", configId: "presupuestoFelo", field: "actualizadoEn", base: {
    limites: { comida: { mensual: 100, quincenal: 50 }, gas: { mensual: 100, quincenal: 50 } }, actualizadoEn: ISO,
  } },
  { name: "ingresoPrincipal.actualizadoEn", collection: "configuracion", configId: "ingresoPrincipal", field: "actualizadoEn", base: {
    descripcion: "Salario", montoEstimado: 100, fuente: "salario", frecuencia: "cada_2_semanas",
    fechaAncla: "2026-10-10", intervaloDias: 14, activa: true, notas: "", actualizadoEn: ISO,
  } },
  { name: "ingreso.creadoEn", collection: "ingresos", field: "creadoEn", base: income },
  { name: "ingreso.actualizadoEn", collection: "ingresos", field: "actualizadoEn", base: income },
  { name: "solicitud.solicitadoEn", collection: "accessRequests", field: "solicitadoEn", base: accessRequest },
  { name: "solicitud.actualizadoEn", collection: "accessRequests", field: "actualizadoEn", base: accessRequest },
];

const valid = [
  "2026-10-10", ISO, "2026-10-10T00:00:00Z", "2026-10-10T23:59:59.123456789Z",
  "2026-10-10T12:00:00-04:00", "2026-10-10T12:00:00+05:30",
  "2028-02-29T12:00:00.000Z", "2000-02-29T12:00:00Z",
];
const invalid: unknown[] = [
  "not-a-date", "abcdefghij", "2026-00-10", "2026-13-10", "2026-10-00", "2026-04-31",
  "2026-02-29T12:00:00Z", "2100-02-29T12:00:00Z", "2028-02-30T12:00:00Z",
  "2026-10-10T24:00:00Z", "2026-10-10T12:60:00Z", "2026-10-10T12:00:60Z",
  "2026-10-10T12:00:00", "2026-10-10T12:00:00+24:00", "2026-10-10T12:00:00+04:60",
  "2026-10-10T12:00:00.Z", "2026-10-10T12:00:00.1234567890Z",
  "2026-10-10garbage", "2026-10-10T12:00:00Zgarbage", " 2026-10-10", "2026-10-10 ",
  "2026-1-10", "2026-10-1", "", null, 1234567890, Timestamp.now(),
];

function write(target: Target, value: unknown, suffix: string) {
  if (target.collection === "accessRequests") {
    const uid = `request-${suffix}`;
    const db = env.authenticatedContext(uid).firestore();
    return setDoc(doc(db, "accessRequests", uid), { ...target.base, uid, [target.field]: value });
  }
  const db = env.authenticatedContext(UID).firestore();
  return setDoc(doc(db, "users", UID, target.collection, target.configId ?? suffix), {
    ...target.base,
    ...(target.collection === "ingresos" ? { cicloPagoId: suffix } : {}),
    [target.field]: value,
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-presupuesto", firestore: { host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "allowedUsers", UID), { activo: true });
    await setDoc(doc(db, "users", UID, "categoriasTarjeta", "comida"), {
      nombre: "Comida", categoriaPresupuesto: "comida", activa: true, requiereComentario: false,
    });
    await setDoc(doc(db, "users", UID, "tarjetasCredito", "card"), { activa: true });
  });
});
afterAll(async () => { await env.cleanup(); });

describe("Calendar and ISO text dates in every formerly length-only field", () => {
  it.each(targets)("accepts existing supported formats in $name", async target => {
    for (const [index, value] of valid.entries()) {
      await assertSucceeds(write(target, value, `valid-${index}`));
    }
  });
  it.each(targets)("rejects malformed dates, impossible days and invalid times in $name", async target => {
    for (const [index, value] of invalid.entries()) {
      await assertFails(write(target, value, `invalid-${index}`));
    }
  });
  it.each(targets.filter(target => target.collection !== "accessRequests"))("rejects an invalid date on update in $name", async target => {
    await assertSucceeds(write(target, ISO, "existing"));
    const db = env.authenticatedContext(UID).firestore();
    await assertFails(updateDoc(doc(db, "users", UID, target.collection, target.configId ?? "existing"), {
      [target.field]: "2026-02-30T12:00:00Z",
    }));
  });
});
