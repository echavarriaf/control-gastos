import { describe, expect, it } from "vitest";
import { proyectarSaldoCuenta } from "../cash-flow-projection";
import { calcularResumenCuentaGastos, type CuentaGastos } from "../expense-account";
import { generarCiclosPago } from "../pay-cycles";
import type { CompromisoFijo, GastoVariable, Ingreso, PagoFijo, PagoTarjeta, TarjetaCredito } from "../types";

const cuenta: CuentaGastos = { id: "cuenta-gastos", nombre: "Banco", saldoInicial: 1000, fechaSaldoInicial: "2026-10-01", activa: true,
  ingresosIncluidosEnSaldoInicial: [], gastosIncluidosEnSaldoInicial: [], pagosFijosIncluidosEnSaldoInicial: [], pagosTarjetaIncluidosEnSaldoInicial: [] };
const proximoCiclo = generarCiclosPago({ configuracion: { id: "ingresoPrincipal", fechaAncla: "2026-11-06", intervaloDias: 14 },
  fechaInicio: "2026-11-06", cantidad: 1, fechaReferencia: "2026-11-03" })[0];
const tarjeta: TarjetaCredito = { id: "card", nombre: "Visa", ultimosCuatro: "1234", saldoInicial: 100, fechaSaldoInicial: "2026-10-01",
  diaCorte: 10, diaPago: 20, activa: true, estrategiaPago: "saldo_completo", pagoObjetivo: null, limiteCredito: 1000, notas: "" };
const compromiso: CompromisoFijo = { id: "rent", descripcion: "Renta", monto: 300, diaVencimiento: 4, quincenaPresupuestaria: 1,
  prioridad: 1, metodoPagoPreferido: "transferencia", tarjetaId: null, activo: true };
function fijo(overrides: Partial<PagoFijo> = {}): PagoFijo {
  return { id: "fixed-paid", compromisoId: compromiso.id, descripcion: "Renta", monto: 300, fecha: "2026-11-03", metodo: "transferencia",
    periodicidad: "mensual", referencia: "", notas: "", ...overrides };
}
function pago(overrides: Partial<PagoTarjeta> = {}): PagoTarjeta {
  return { id: "paid", concepto: "Pago Visa", monto: 40, categoria: "general", fecha: "2026-11-03", creadoEn: "2026-11-03T12:00:00Z",
    tarjetaId: tarjeta.id, estadoTarjeta: "pendiente", referencia: "", notas: "", ...overrides };
}
function ingreso(overrides: Partial<Ingreso> = {}): Ingreso {
  return { id: proximoCiclo.id, cicloPagoId: proximoCiclo.id, configuracionIngresoId: "ingresoPrincipal", descripcion: "Salario", monto: 2000,
    fechaProgramada: "2026-11-06", fechaRecibida: null, periodoCalendario: "2026-11", numeroPagoMes: 1, numeroPagoAnual: 1,
    fuente: "salario", estado: "proyectado", recurrente: true, notas: "", ...overrides };
}
type Args = Parameters<typeof proyectarSaldoCuenta>[0];
function args(overrides: Partial<Args> = {}): Args {
  return { hoy: "2026-11-03", cuenta, resumenCuenta: { saldoActual: 1000 }, proximoCiclo, montoEstimado: 2000,
    ingresos: [], compromisos: [], pagosFijos: [], tarjetas: [], gastos: [], pagosTarjeta: [], ...overrides };
}
function proyectar(overrides: Partial<Args> = {}) { return proyectarSaldoCuenta(args(overrides)); }
function resumenReal(overrides: Partial<Args> = {}) {
  const values = args(overrides);
  return calcularResumenCuentaGastos(values.cuenta, values.ingresos, values.gastos, values.pagosFijos, values.compromisos, values.pagosTarjeta,
    [], null, new Date(2026, 10, 3, 12));
}

describe("Cash flow until next paycheck", () => {
  it("forecasts fixed payments and cards, then adds the paycheck without touching current cash", () => {
    const input = args({ compromisos: [compromiso], tarjetas: [tarjeta] });
    const copia = structuredClone(input);
    const result = proyectarSaldoCuenta(input);
    expect(result).toMatchObject({ saldoInicial: 1000, saldoAntesCobro: 600, saldoDespuesCobro: 2600, saldoMinimo: 600,
      fechaSaldoMinimo: "2026-11-05", entradasPrevistas: 2000, salidasPrevistas: 400 });
    expect(result.movimientos.map(movimiento => movimiento.tipo)).toEqual(["fijo", "tarjeta", "proximo_cobro"]);
    expect(input).toEqual(copia);
  });
  it("uses the edited projected paycheck amount rather than the configured default", () => {
    expect(proyectar({ ingresos: [ingreso({ monto: 2100 })] })).toMatchObject({ cobroPrevisto: 2100, saldoDespuesCobro: 3100 });
  });
  it("reports before and after balances at the actual scheduled deposit when its date is edited", () => {
    const result = proyectar({ ingresos: [ingreso({ fechaProgramada: "2026-11-04" })], otrosGastos: 100 });
    expect(result).toMatchObject({ saldoAntesCobro: 1000, saldoDespuesCobro: 3000, saldoFinal: 2900 });
  });
  it.each(["recibido", "cancelado"] as const)("does not add an already %s paycheck again", estado => {
    const ingresos = [ingreso({ estado, fechaRecibida: estado === "recibido" ? "2026-11-03" : null })];
    const resumenCuenta = resumenReal({ ingresos });
    expect(proyectar({ ingresos, resumenCuenta })).toMatchObject({ entradasPrevistas: 0, saldoDespuesCobro: resumenCuenta.saldoActual, estadoCobro: estado });
  });
  it("includes additional projected income once and omits cancelled, past or future income", () => {
    const manual = ingreso({ id: "manual", cicloPagoId: "manual", monto: 75, fechaProgramada: "2026-11-04", recurrente: false });
    const result = proyectar({ ingresos: [manual, { ...manual, id: "past", fechaProgramada: "2026-11-02" },
      { ...manual, id: "later", fechaProgramada: "2026-11-07" }, { ...manual, id: "cancelled", estado: "cancelado" }] });
    expect(result).toMatchObject({ entradasPrevistas: 2075, saldoAntesCobro: 1075, saldoDespuesCobro: 3075 });
  });
  it("does not subtract a completed fixed payment already in the bank balance", () => {
    const values = { compromisos: [compromiso], pagosFijos: [fijo()] };
    const resumenCuenta = resumenReal(values);
    expect(resumenCuenta.saldoActual).toBe(700);
    expect(proyectar({ ...values, resumenCuenta })).toMatchObject({ saldoAntesCobro: 700, salidasPrevistas: 0 });
  });
  it("applies a partially registered fixed payment only once under bank accounting", () => {
    const values = { compromisos: [compromiso], pagosFijos: [fijo({ monto: 100 })] };
    const resumenCuenta = resumenReal(values);
    expect(resumenCuenta.saldoActual).toBe(1000);
    expect(proyectar({ ...values, resumenCuenta })).toMatchObject({ saldoAntesCobro: 700, salidasPrevistas: 300 });
  });
  it("excludes partial amounts already included in a recalibrated bank balance", () => {
    const values = { compromisos: [compromiso], pagosFijos: [fijo({ monto: 100 })], cuenta: { ...cuenta, pagosFijosIncluidosEnSaldoInicial: ["fixed-paid"] } };
    expect(proyectar(values)).toMatchObject({ salidasPrevistas: 200, saldoAntesCobro: 800 });
  });
  it("does not turn card-funded fixed commitments into a direct bank withdrawal", () => {
    const values = { compromisos: [{ ...compromiso, metodoPagoPreferido: "tarjeta" as const, tarjetaId: tarjeta.id }],
      pagosFijos: [fijo({ monto: 100, metodo: "tarjeta", tarjetaId: tarjeta.id })], tarjetas: [tarjeta] };
    const result = proyectar(values);
    expect(result.movimientos.filter(movimiento => movimiento.tipo === "fijo")).toEqual([]);
    expect(result.salidasPrevistas).toBe(200); // $100 opening card debt + $100 registered card charge.
  });
  it("handles mixed partial methods without subtracting card-funded portions twice", () => {
    expect(proyectar({ compromisos: [compromiso], pagosFijos: [fijo({ monto: 100, metodo: "tarjeta", tarjetaId: tarjeta.id })], tarjetas: [tarjeta] }))
      .toMatchObject({ salidasPrevistas: 400 }); // Remaining $200 bank fixed + $200 card debt.
  });
  it("includes this month's overdue commitments today and skips inactive or later due dates", () => {
    const result = proyectar({ compromisos: [{ ...compromiso, diaVencimiento: 1 },
      { ...compromiso, id: "inactive", activo: false }, { ...compromiso, id: "later", diaVencimiento: 7 }] });
    expect(result.salidasPrevistas).toBe(300);
    expect(result.movimientos[0]).toMatchObject({ fecha: "2026-11-03", tipo: "fijo" });
  });
  it("handles the month boundary and clamps day 31 to February's last day", () => {
    const result = proyectar({ hoy: "2028-02-27", proximoCiclo: { ...proximoCiclo, fechaPagoProgramada: "2028-03-02" },
      compromisos: [{ ...compromiso, diaVencimiento: 31 }] });
    expect(result.movimientos.filter(movimiento => movimiento.tipo === "fijo")).toMatchObject([{ fecha: "2028-02-29", monto: 300 }]);
  });
  it("does not count a pending bank card payment again in the planned card payoff", () => {
    const result = proyectar({ tarjetas: [tarjeta], pagosTarjeta: [pago()] });
    expect(result.salidasPrevistas).toBe(100);
    expect(result.movimientos.filter(movimiento => movimiento.tipo !== "proximo_cobro").map(movimiento => movimiento.monto)).toEqual([40, 60]);
  });
  it("reduces the planned debt for external pending payments without withdrawing their cash", () => {
    const result = proyectar({ tarjetas: [tarjeta], pagosTarjeta: [pago({ origenFondos: "cuenta_externa" })] });
    expect(result.salidasPrevistas).toBe(60);
    expect(result.movimientos.some(movimiento => movimiento.tipo === "pago_pendiente")).toBe(false);
  });
  it("does not duplicate already posted card payments in the bank or card payoff", () => {
    const values = { tarjetas: [tarjeta], pagosTarjeta: [pago({ estadoTarjeta: "contabilizada" })] };
    const resumenCuenta = resumenReal(values);
    expect(resumenCuenta.saldoActual).toBe(960);
    expect(proyectar({ ...values, resumenCuenta })).toMatchObject({ salidasPrevistas: 60, saldoAntesCobro: 900 });
  });
  it("includes pending withdrawals even when the card's payment window is after the horizon", () => {
    expect(proyectar({ tarjetas: [{ ...tarjeta, diaCorte: 25 }], pagosTarjeta: [pago()] })).toMatchObject({ salidasPrevistas: 40 });
  });
  it("excludes inactive cards, credit balances and payment targets after the next paycheck", () => {
    expect(proyectar({ tarjetas: [{ ...tarjeta, activa: false }, { ...tarjeta, id: "credit", saldoInicial: -10 },
      { ...tarjeta, id: "later", diaCorte: 25 }] }).salidasPrevistas).toBe(0);
  });
  it("excludes new card charges dated after the projected payoff", () => {
    const gasto: GastoVariable = { id: "later", concepto: "Compra", monto: 500, categoria: "comida", fecha: "2026-11-06",
      creadoEn: "2026-11-06T12:00:00Z", metodoPago: "tarjeta_credito", tarjetaId: tarjeta.id, estadoTarjeta: "pendiente", comentario: "" };
    expect(proyectar({ tarjetas: [tarjeta], gastos: [gasto] }).salidasPrevistas).toBe(100);
  });
  it("shows deficits and orders same-day payments before the paycheck", () => {
    const result = proyectar({ otrosGastos: 1100 });
    expect(result).toMatchObject({ saldoAntesCobro: -100, saldoMinimo: -100, saldoDespuesCobro: 1900, fechaSaldoMinimo: "2026-11-06" });
    expect(result.movimientos.map(movimiento => movimiento.tipo)).toEqual(["variable", "proximo_cobro"]);
  });
  it("preserves negative opening balances and rounds estimated amounts to cents", () => {
    expect(proyectar({ resumenCuenta: { saldoActual: -10 }, otrosGastos: 0.1 + 0.2 }))
      .toMatchObject({ saldoAntesCobro: -10.3, saldoMinimo: -10.3, saldoDespuesCobro: 1989.7 });
  });
  it.each([{ hoy: "2026-02-30" }, { hoy: "2026-11-06" }, { otrosGastos: -1 }, { otrosGastos: NaN }, { montoEstimado: Infinity }])("rejects invalid projection input %j", input => {
    expect(() => proyectar(input)).toThrow();
  });
});
