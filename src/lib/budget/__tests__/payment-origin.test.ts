import { describe, expect, it } from "vitest";
import { calcularResumenCuentaGastos, type CuentaGastos } from "../expense-account";
import { crearResumenTarjeta } from "../credit-cards/summary";
import { normalizarOrigenFondosPago, pagoTarjetaSaleDeCuenta, validarOrigenFondosPago } from "../payment-origin";
import type { PagoTarjeta, TarjetaCredito } from "../types";

const cuenta: CuentaGastos = { id: "cuenta-gastos", nombre: "Banco", saldoInicial: 1000, fechaSaldoInicial: "2026-10-01", activa: true,
  ingresosIncluidosEnSaldoInicial: [], gastosIncluidosEnSaldoInicial: [], pagosFijosIncluidosEnSaldoInicial: [], pagosTarjetaIncluidosEnSaldoInicial: [] };
const tarjeta: TarjetaCredito = { id: "card", nombre: "Tarjeta", ultimosCuatro: "1234", saldoInicial: 100, fechaSaldoInicial: "2026-10-01",
  diaCorte: 25, diaPago: 20, activa: true, estrategiaPago: "saldo_completo", pagoObjetivo: null, limiteCredito: 1000, notas: "" };
function payment(overrides: Partial<PagoTarjeta> = {}): PagoTarjeta {
  return { id: "payment", concepto: "Pago", monto: 100, categoria: "general", fecha: "2026-10-20", creadoEn: "2026-10-20T12:00:00Z",
    tarjetaId: "card", estadoTarjeta: "contabilizada", referencia: "", notas: "", ...overrides };
}
function balances(pagos: PagoTarjeta[]) {
  const reference = new Date(2026, 9, 22, 12);
  const card = crearResumenTarjeta(tarjeta, [], [], pagos, reference);
  const bank = calcularResumenCuentaGastos(cuenta, [], [], [], [], pagos, [{ tarjetaId: tarjeta.id, montoReservarCuenta: card.montoReservarCuenta }], 2, reference);
  return { card, bank };
}

describe("Card payment funding source", () => {
  it("preserves historical payments as withdrawals from the configured account", () => {
    expect(normalizarOrigenFondosPago(undefined)).toBe("cuenta_gastos");
    expect(validarOrigenFondosPago(undefined)).toBe("cuenta_gastos");
    expect(pagoTarjetaSaleDeCuenta({})).toBe(true);
    expect(balances([payment()]).bank.saldoActual).toBe(900);
  });

  it("reduces card debt without reducing configured bank cash when paid externally", () => {
    const { bank, card } = balances([payment({ origenFondos: "cuenta_externa" })]);
    expect(card.saldoActual).toBe(0);
    expect(card.pagosDesdeSaldo).toBe(100);
    expect(bank.saldoActual).toBe(1000);
    expect(bank.totalEgresosTarjetas).toBe(0);
    expect(bank.disponibleReal).toBe(1000);
    expect(bank.movimientos.filter(movement => movement.tipo === "pago_tarjeta")).toEqual([]);
  });

  it("subtracts only the portion funded by the configured account", () => {
    const { bank, card } = balances([
      payment({ id: "own", monto: 75, origenFondos: "cuenta_gastos" }),
      payment({ id: "external", monto: 25, origenFondos: "cuenta_externa" }),
    ]);
    expect(card.saldoActual).toBe(0);
    expect(bank.saldoActual).toBe(925);
    expect(bank.cantidadPagosTarjeta).toBe(1);
    expect(bank.totalEgresosTarjetas).toBe(75);
  });

  it("changes bank accounting when editing the origin, while preserving the same card payment", () => {
    const external = payment({ origenFondos: "cuenta_externa" });
    const own = { ...external, origenFondos: "cuenta_gastos" as const };
    expect(balances([external]).bank.saldoActual).toBe(1000);
    expect(balances([own]).bank.saldoActual).toBe(900);
    expect(balances([external]).card.saldoActual).toBe(balances([own]).card.saldoActual);
  });

  it("does not post a pending external payment prematurely", () => {
    const { bank, card } = balances([payment({ origenFondos: "cuenta_externa", estadoTarjeta: "pendiente" })]);
    expect(bank.saldoActual).toBe(1000);
    expect(card.saldoActual).toBe(100);
    expect(card.pagosPendientes).toBe(100);
  });

  it.each([null, "", "other-user-account", 7, {}, []])("rejects invalid new source %j while conservatively reading historical data", value => {
    expect(() => validarOrigenFondosPago(value)).toThrow("origen válido");
    expect(normalizarOrigenFondosPago(value)).toBe("cuenta_gastos");
  });
});
