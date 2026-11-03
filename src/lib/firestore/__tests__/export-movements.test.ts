import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ db: null as Firestore | null }));
vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => { if (!state.db) throw new Error("Missing emulator"); return state.db; },
  getAdminAuth: () => ({ verifyIdToken: async (token: string, revoked: boolean) => {
    expect(revoked).toBe(true); if (token === "invalid") throw new Error("Invalid token"); return { uid: token };
  } }),
}));
import { GET } from "@/app/api/export/movements/route";

let app: App; let db: Firestore; let uid: string;
const ref = (coleccion: string, id: string, user = uid) => db.doc(`users/${user}/${coleccion}/${id}`);
function request(params: Record<string, string> = {}, user = uid) {
  const query = new URLSearchParams({ desde: "2026-11-01", hasta: "2026-11-30", zonaHoraria: "America/New_York", ...params });
  return new NextRequest(`http://localhost:3000/api/export/movements?${query}`, { headers: { Authorization: `Bearer ${user}` } });
}
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Firestore emulator required");
  app = initializeApp({ projectId: "demo-presupuesto" }, `export-${randomUUID()}`);
  db = getFirestore(app); state.db = db;
});
beforeEach(async () => { uid = `export-${randomUUID()}`; await db.doc(`allowedUsers/${uid}`).set({ activo: true }); });
afterAll(async () => { await db.terminate(); await deleteApp(app); });

describe("Financial CSV export API", () => {
  it("exports the five movement types independently of dashboard scope and account baseline", async () => {
    await ref("cuentas", "cuenta-gastos").set({ saldoInicial: 1000, fechaSaldoInicial: "2026-11-20" });
    await Promise.all([
      ref("gastos", "expense").set({ fecha: "2026-11-03", monto: 10, concepto: "Café", categoria: "comida", metodoPago: "debito" }),
      ref("pagosTarjeta", "card-payment").set({ fecha: "2026-11-04", monto: 50, tarjetaId: "card", origenFondos: "cuenta_externa", estadoTarjeta: "pendiente" }),
      ref("pagosFijos", "fixed").set({ fecha: "2026-11-05T12:00:00Z", monto: 100, descripcion: "Renta", metodo: "transferencia" }),
      ref("movimientosCuenta", "manual").set({ fecha: "2026-11-06", monto: 25, concepto: "Entrada manual", direccion: "entrada" }),
      ref("ingresos", "late").set({ fechaProgramada: "2025-01-01", fechaRecibida: "2026-11-07", monto: 2000, estado: "recibido" }),
      ref("tarjetasCredito", "card").set({ nombre: "Visa propia" }),
      ref("papeleraMovimientos", "deleted").set({ datos: { fecha: "2026-11-08", monto: 100 }, eliminadoEn: Timestamp.now() }),
    ]);
    const result = await GET(request());
    expect(result.status).toBe(200); expect(result.headers.get("X-Export-Record-Count")).toBe("5");
    expect(result.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(result.headers.get("Content-Disposition")).toContain("movimientos_2026-11-01_2026-11-30.csv");
    expect(result.headers.get("Cache-Control")).toContain("no-store");
    const csv = await result.text();
    for (const id of ["expense", "card-payment", "fixed", "manual", "late"]) expect(csv).toContain(`"${id}"`);
    expect(csv).toContain("Otra cuenta externa"); expect(csv).toContain("Visa propia"); expect(csv).toContain("pendiente");
    expect(csv).not.toContain('"deleted"');
  });
  it("includes native timestamps and ISO boundaries only on their actual local calendar date", async () => {
    await Promise.all([
      ref("gastos", "first").set({ fecha: "2026-11-01", monto: 1 }),
      ref("gastos", "before").set({ fecha: "2026-11-01T02:00:00Z", monto: 1 }),
      ref("gastos", "last-instant").set({ fecha: "2026-12-01T02:00:00Z", monto: 1 }),
      ref("gastos", "last-timestamp").set({ fecha: Timestamp.fromDate(new Date("2026-12-01T02:00:00Z")), monto: 1 }),
      ref("gastos", "after").set({ fecha: "2026-12-01", monto: 1 }),
    ]);
    const result = await GET(request());
    expect(result.headers.get("X-Export-Record-Count")).toBe("3");
    const csv = await result.text(); expect(csv).toContain('"first"'); expect(csv).toContain('"last-timestamp"');
    expect(csv).not.toContain('"before"'); expect(csv).not.toContain('"after"');
  });
  it("does not duplicate received income found by both scheduled and receipt queries", async () => {
    await ref("ingresos", "both").set({ fechaProgramada: "2026-11-03", fechaRecibida: "2026-11-04", monto: 2000, estado: "recibido" });
    const result = await GET(request());
    expect(result.headers.get("X-Export-Record-Count")).toBe("1");
  });
  it("reads beyond a 500-document page without silently truncating the export", async () => {
    for (let start = 0; start < 503; start += 400) {
      const batch = db.batch();
      for (let index = start; index < Math.min(503, start + 400); index++) {
        batch.set(ref("gastos", `row-${String(index).padStart(4, "0")}`), { fecha: "2026-11-03", monto: 1 });
      }
      await batch.commit();
    }
    const result = await GET(request());
    expect(result.headers.get("X-Export-Record-Count")).toBe("503");
    const csv = await result.text(); expect(csv).toContain('"row-0502"');
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(504);
  }, 15_000);
  it("summarizes calendar halves without mixing purchases and card payments", async () => {
    await Promise.all([
      ref("gastos", "one").set({ fecha: "2026-11-13", monto: 10, categoria: "comida", metodoPago: "debito" }),
      ref("gastos", "two").set({ fecha: "2026-11-16", monto: 20, categoria: "comida", metodoPago: "debito" }),
      ref("pagosTarjeta", "pay").set({ fecha: "2026-11-13", monto: 10 }),
    ]);
    const result = await GET(request({ formato: "resumen" })); const csv = await result.text();
    expect(csv).toContain('"Q1 (1–15)","Gasto"'); expect(csv).toContain('"Q2 (16–fin)","Gasto"'); expect(csv).toContain('"Pago a tarjeta"');
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(4);
  });
  it("derives the owner from the token and never uses another user's movement or card name", async () => {
    const other = `other-${randomUUID()}`;
    await ref("gastos", "own").set({ fecha: "2026-11-03", monto: 10, tarjetaId: "card" });
    await ref("gastos", "foreign", other).set({ fecha: "2026-11-03", monto: 9999 });
    await ref("tarjetasCredito", "card", other).set({ nombre: "Nombre privado ajeno" });
    const result = await GET(request({ uid: other })); const csv = await result.text();
    expect(csv).toContain('"own"'); expect(csv).not.toContain('"foreign"'); expect(csv).not.toContain("Nombre privado ajeno");
  });
  it("rejects missing, invalid and disabled sessions", async () => {
    expect((await GET(new NextRequest("http://localhost:3000/api/export/movements"))).status).toBe(401);
    expect((await GET(request({}, "invalid"))).status).toBe(401);
    await db.doc(`allowedUsers/${uid}`).update({ activo: false });
    expect((await GET(request())).status).toBe(403);
  });
  it("rejects invalid dates and unsupported formats without producing a download", async () => {
    for (const params of [{ desde: "2026-02-30" }, { desde: "2020-01-01" }, { formato: "xlsx" }]) {
      const result = await GET(request(params)); expect(result.status).toBe(400);
      expect(result.headers.get("Content-Type")).toContain("application/json");
      expect(result.headers.get("Content-Disposition")).toBeNull();
    }
  });
  it("returns a valid header-only CSV for an empty interval", async () => {
    const result = await GET(request());
    expect(result.headers.get("X-Export-Record-Count")).toBe("0");
    expect((await result.text()).split("\r\n").filter(Boolean)).toHaveLength(1);
  });
});
