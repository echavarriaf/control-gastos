import { describe, expect, it } from "vitest";
import { crearResumenTarjetas } from "@/lib/budget/credit-cards/aggregate";
import type { GastoVariable, PagoFijo, PagoTarjeta, TarjetaCredito } from "@/lib/budget/types";

function card(id: string, nombre: string, saldoInicial: number, activa = true): TarjetaCredito {
  return { id, nombre, saldoInicial, activa, ultimosCuatro: "1234", fechaSaldoInicial: "2026-10-01",
    diaCorte: 25, diaPago: 20, estrategiaPago: "saldo_completo", pagoObjetivo: null, limiteCredito: 1000, notas: "",
  };
}
const now = new Date(2026, 9, 10, 12);
describe("Pure aggregate card summary", () => {
  it("starts every aggregate at zero without cards", () => {
    expect(crearResumenTarjetas({ tarjetas: [], gastos: [], pagosFijos: [], pagos: [] }, now)).toEqual({
      resumenes: [], totalSaldoActual: 0, totalPagoTotal: 0, totalCreditoAFavor: 0,
      totalCompras: 0, totalCargosFijos: 0, totalPagos: 0, totalPagoAdicionalAntesCorte: 0,
    });
  });

  it("keeps active cards first and sorts by name without mutating the supplied list", () => {
    const tarjetas = [card("inactive", "Alfa", 0, false), card("beta", "Beta", 0), card("alfa", "Alfa", 0)];
    const result = crearResumenTarjetas({ tarjetas, gastos: [], pagosFijos: [], pagos: [] }, now);
    expect(result.resumenes.map(value => value.tarjeta.id)).toEqual(["alfa", "beta", "inactive"]);
    expect(tarjetas.map(value => value.id)).toEqual(["inactive", "beta", "alfa"]);
  });

  it("preserves purchases, fixed charges, overpayment credit and pending exclusions in totals", () => {
    const tarjetas = [card("b", "Beta", 100), card("inactive", "Inactiva", 50, false), card("a", "Alfa", 0)];
    const gastos: GastoVariable[] = [
      { id: "posted", concepto: "Compra", monto: 20, categoria: null, fecha: "2026-10-05", creadoEn: "2026-10-05T12:00:00Z",
        metodoPago: "tarjeta_credito", tarjetaId: "a", estadoTarjeta: "contabilizada", categoriaTarjetaId: "other", categoriaTarjetaNombre: "Otro", comentario: "Compra" },
      { id: "pending", concepto: "Pendiente", monto: 500, categoria: null, fecha: "2026-10-05", creadoEn: "2026-10-05T12:00:00Z",
        metodoPago: "tarjeta_credito", tarjetaId: "a", estadoTarjeta: "pendiente", categoriaTarjetaId: "other", categoriaTarjetaNombre: "Otro", comentario: "Compra" },
    ];
    const pagosFijos: PagoFijo[] = [{ id: "fixed", compromisoId: "bill", descripcion: "Cargo fijo", monto: 10,
      fecha: "2026-10-05", metodo: "tarjeta", tarjetaId: "a", estadoTarjeta: "contabilizada", periodicidad: "mensual", referencia: "", notas: "" }];
    const pagos: PagoTarjeta[] = [{ id: "payment", concepto: "Abono", monto: 150, categoria: "general", fecha: "2026-10-06",
      creadoEn: "2026-10-06T12:00:00Z", tarjetaId: "b", estadoTarjeta: "contabilizada", referencia: "", notas: "" }];
    const result = crearResumenTarjetas({ tarjetas, gastos, pagosFijos, pagos }, now);
    // Credit remains separate; an overpaid card does not offset another card's debt.
    expect(result).toMatchObject({ totalSaldoActual: 80, totalPagoTotal: 80, totalCreditoAFavor: 50,
      totalCompras: 20, totalCargosFijos: 10, totalPagos: 150, totalPagoAdicionalAntesCorte: 0,
    });
    expect(result.resumenes.find(value => value.tarjeta.id === "a")?.comprasPendientes).toBe(500);
  });
});
