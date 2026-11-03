import { describe, expect, it } from "vitest";
import { cambiarApartado, normalizarMetaAhorro, totalAhorroApartado, validarMetaAhorro, type MetaAhorro } from "../savings-goals";
import { calcularResumenCuentaGastos, type CuentaGastos } from "../expense-account";
import type { CompromisoFijo } from "../types";

const meta: MetaAhorro = { id: "goal", nombre: "Emergencias", objetivo: 1000, apartado: 200, fechaObjetivo: null, notas: "", archivada: false };
const cuenta: CuentaGastos = { id: "cuenta-gastos", nombre: "Banco", saldoInicial: 1000, fechaSaldoInicial: "2026-11-01", activa: true,
  ingresosIncluidosEnSaldoInicial: [], gastosIncluidosEnSaldoInicial: [], pagosFijosIncluidosEnSaldoInicial: [], pagosTarjetaIncluidosEnSaldoInicial: [] };
function resumen(metas: MetaAhorro[], compromisos: CompromisoFijo[] = [], deuda = 0) {
  return calcularResumenCuentaGastos(cuenta, [], [], [], compromisos, [], [{ tarjetaId: "card", montoReservarCuenta: deuda }],
    1, new Date(2026, 10, 3, 12), [], metas);
}
describe("Savings goal accounting", () => {
  it("reserves only allocated money without altering bank cash or its ledger", () => {
    const sinMetas = resumen([]); const conMeta = resumen([meta]);
    expect(conMeta).toMatchObject({ saldoActual: 1000, totalAhorroApartado: 200, totalComprometido: 200, disponibleReal: 800 });
    expect(conMeta.movimientos).toEqual(sinMetas.movimientos);
    expect(conMeta.totalEgresos).toBe(sinMetas.totalEgresos);
  });
  it("keeps unfunded targets out of reserved cash and completed goals reserved until released", () => {
    expect(resumen([{ ...meta, apartado: 0 }]).disponibleReal).toBe(1000);
    expect(resumen([{ ...meta, apartado: 1000 }]).disponibleReal).toBe(0);
  });
  it("combines fixed and card obligations with goals while preserving deficits", () => {
    const fijo: CompromisoFijo = { id: "rent", descripcion: "Renta", monto: 700, diaVencimiento: 5, quincenaPresupuestaria: 1, prioridad: 1,
      metodoPagoPreferido: "transferencia", tarjetaId: null, activo: true };
    expect(resumen([meta], [fijo], 200)).toMatchObject({ saldoActual: 1000, totalReservasFijas: 700, totalDeudaTarjetas: 200,
      totalAhorroApartado: 200, totalComprometido: 1100, disponibleReal: -100, faltanteReal: 100 });
  });
  it("releases allocated money without creating a bank deposit", () => {
    const actualizado = { ...meta, apartado: cambiarApartado(meta, "liberar", 50) };
    expect(resumen([actualizado])).toMatchObject({ saldoActual: 1000, totalAhorroApartado: 150, disponibleReal: 850, cantidadDepositos: 0 });
  });
  it("rounds cents consistently and excludes archived goals", () => {
    expect(cambiarApartado({ ...meta, apartado: 0.1 }, "apartar", 0.2)).toBe(0.3);
    expect(totalAhorroApartado([{ apartado: 0.1, archivada: false }, { apartado: 0.2, archivada: false }, { apartado: 100, archivada: true }])).toBe(0.3);
  });
  it.each([["apartar", 801], ["liberar", 201], ["apartar", -1], ["apartar", 0], ["apartar", NaN], ["apartar", Infinity], ["apartar", 0.004]] as const)("rejects invalid allocation %s %s", (accion, importe) => {
    expect(() => cambiarApartado(meta, accion, importe)).toThrow();
  });
  it("does not allocate to archived goals", () => {
    expect(() => cambiarApartado({ ...meta, archivada: true }, "apartar", 10)).toThrow("archivada");
  });
});
describe("Savings goal data validation", () => {
  it("trims text, rounds money and accepts optional dates or a real leap day", () => {
    expect(validarMetaAhorro({ nombre: " Viaje ", objetivo: 123.456, fechaObjetivo: "2028-02-29", notas: " Nota " }))
      .toEqual({ nombre: "Viaje", objetivo: 123.46, fechaObjetivo: "2028-02-29", notas: "Nota" });
    expect(validarMetaAhorro(meta).fechaObjetivo).toBeNull();
  });
  it.each([{ nombre: " " }, { objetivo: 0 }, { objetivo: -1 }, { objetivo: Infinity }, { objetivo: 0.004 },
    { objetivo: 1_000_001 }, { fechaObjetivo: "2026-02-29" }, { notas: "x".repeat(501) }])("rejects invalid goal %j", overrides => {
    expect(() => validarMetaAhorro({ ...meta, ...overrides })).toThrow();
  });
  it("rejects malformed persisted reserves rather than inflating spendable cash", () => {
    expect(normalizarMetaAhorro("goal", { ...meta, apartado: -1 })).toBeNull();
    expect(normalizarMetaAhorro("goal", { ...meta, apartado: 1001 })).toBeNull();
    expect(normalizarMetaAhorro("goal", { ...meta, apartado: "200" })).toBeNull();
    expect(normalizarMetaAhorro("goal", { ...meta, archivada: true })).toBeNull();
    expect(normalizarMetaAhorro("goal", { ...meta })).toEqual(meta);
  });
});
