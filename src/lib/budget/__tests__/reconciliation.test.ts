import { describe, expect, it } from "vitest";
import { claveRevisionMovimiento, conciliarCuenta } from "../reconciliation";
import type { MovimientoCuentaGastos } from "../expense-account";

const base: MovimientoCuentaGastos = { id: "base", tipo: "saldo_inicial", direccion: "base", fecha: "2026-11-01", monto: 1000, concepto: "Saldo inicial", detalle: "", saldoDespues: 1000 };
const entrada: MovimientoCuentaGastos = { id: "deposito:1", tipo: "deposito", direccion: "entrada", fecha: "2026-11-02", monto: 500, concepto: "Cobro", detalle: "", saldoDespues: 1500 };
const salida: MovimientoCuentaGastos = { id: "manual:1", tipo: "movimiento_manual", direccion: "salida", fecha: "2026-11-03", monto: 100, concepto: "Retiro", detalle: "", saldoDespues: 1400 };
function comparar(saldoBanco: number, revisados: MovimientoCuentaGastos[] = [], movimientos = [salida, entrada, base], fechaCorte = "2026-11-03") {
  return conciliarCuenta({ saldoBanco, fechaCorte, movimientos, revisados: new Set(revisados.map(claveRevisionMovimiento)) });
}

describe("Bank reconciliation", () => {
  it("does not claim a full reconciliation from equal balances alone", () => {
    expect(comparar(1400)).toMatchObject({ saldoCalculado: 1400, saldoRevisado: 1000, diferencia: 0, coincideSaldo: true, revisionCompleta: false, cantidadRevisada: 0 });
  });
  it("completes only after all applicable movements have been reviewed", () => {
    expect(comparar(1400, [entrada, salida])).toMatchObject({ revisionCompleta: true, saldoRevisado: 1400, diferenciaRevisada: 0 });
  });
  it("identifies the net unreviewed withdrawal as a possible explanation", () => {
    expect(comparar(1500, [entrada])).toMatchObject({ diferencia: 100, diferenciaRevisada: 0, partidasPendientesExplicanDiferencia: true, entradasSinRevisar: 0, salidasSinRevisar: 100, sinRevisar: [salida] });
  });
  it("handles unreviewed deposits and a bank balance lower than the application", () => {
    expect(comparar(900, [salida])).toMatchObject({ diferencia: -500, saldoRevisado: 900, partidasPendientesExplicanDiferencia: true, entradasSinRevisar: 500, salidasSinRevisar: 0 });
  });
  it("keeps unexplained differences visible after checking all movements", () => {
    expect(comparar(1390, [entrada, salida])).toMatchObject({ diferencia: -10, diferenciaRevisada: -10, revisionCompleta: false, partidasPendientesExplicanDiferencia: false });
  });
  it("uses only movements through the selected date, independent of ledger order", () => {
    expect(comparar(1500, [entrada, salida], [base, salida, entrada], "2026-11-02")).toMatchObject({ saldoCalculado: 1500, revisionCompleta: true, partidas: [entrada] });
  });
  it("requires a fresh review after a movement amount or date changes", () => {
    const cambiado = { ...salida, monto: 120 };
    expect(comparar(1380, [entrada, salida], [cambiado, entrada, base])).toMatchObject({ cantidadRevisada: 1, sinRevisar: [cambiado], revisionCompleta: false });
    expect(claveRevisionMovimiento(salida)).not.toBe(claveRevisionMovimiento({ ...salida, fecha: "2026-11-04" }));
    expect(claveRevisionMovimiento(salida)).not.toBe(claveRevisionMovimiento({ ...salida, direccion: "entrada" }));
  });
  it("ignores stale reviewed IDs from removed transactions", () => {
    expect(comparar(1500, [entrada, salida], [entrada, base])).toMatchObject({ cantidadRevisada: 1, revisionCompleta: true });
  });
  it("rounds to cents and accepts zero or negative bank balances", () => {
    const centimos = { ...base, monto: 0.1 };
    const gasto = { ...salida, monto: 0.3 };
    expect(comparar(-0.2, [gasto], [centimos, gasto])).toMatchObject({ saldoCalculado: -0.2, diferencia: 0, revisionCompleta: true });
    expect(comparar(0, [], [{ ...base, monto: 0 }])).toMatchObject({ revisionCompleta: true, diferencia: 0 });
  });
  it.each(["2026-10-31", "2026-02-30", "", "2026-11-03T12:00:00Z"])("rejects invalid or pre-baseline cutoff %s", fecha => {
    expect(() => comparar(1400, [], undefined, fecha)).toThrow();
  });
  it.each([NaN, Infinity, -Infinity])("rejects non-finite bank balance %s", valor => {
    expect(() => comparar(valor)).toThrow("saldo bancario válido");
  });
  it("requires exactly one baseline and preserves the input ledger", () => {
    expect(() => comparar(1400, [], [entrada, salida])).toThrow();
    expect(() => comparar(1400, [], [base, base, entrada])).toThrow();
    const movimientos = [salida, entrada, base];
    const copia = structuredClone(movimientos);
    comparar(1400, [entrada], movimientos);
    expect(movimientos).toEqual(copia);
  });
});
