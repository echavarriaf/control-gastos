// Orden y totales de tarjetas, independientes de React y del acceso a datos.
import type { UseCreditCardSummariesParams } from "./types";
import { crearResumenTarjeta } from "./summary";
import { redondearMoneda } from "./money";

export function crearResumenTarjetas(
  { tarjetas, gastos, pagosFijos, pagos }: UseCreditCardSummariesParams,
  fechaReferencia: Date,
) {
  const resumenes = tarjetas
    .map((tarjeta) => crearResumenTarjeta(tarjeta, gastos, pagosFijos, pagos, fechaReferencia))
    .sort((a, b) => {
      if (a.tarjeta.activa !== b.tarjeta.activa) {
        return a.tarjeta.activa ? -1 : 1;
      }
      return a.tarjeta.nombre.localeCompare(b.tarjeta.nombre, "es", { sensitivity: "base" });
    });

  const totalSaldoActual = redondearMoneda(
    resumenes.reduce((total, resumen) => total + resumen.saldoActual, 0),
  );
  const totalPagoTotal = redondearMoneda(
    resumenes.reduce((total, resumen) => total + resumen.montoPagoTotal, 0),
  );
  const totalCreditoAFavor = redondearMoneda(
    resumenes.reduce((total, resumen) => total + resumen.creditoAFavor, 0),
  );
  const totalCompras = redondearMoneda(
    resumenes.reduce((total, resumen) => total + resumen.comprasDesdeSaldo, 0),
  );
  const totalCargosFijos = redondearMoneda(
    resumenes.reduce((total, resumen) => total + resumen.cargosFijosDesdeSaldo, 0),
  );
  const totalPagos = redondearMoneda(
    resumenes.reduce((total, resumen) => total + resumen.pagosDesdeSaldo, 0),
  );
  const totalPagoAdicionalAntesCorte = redondearMoneda(
    resumenes.reduce((total, resumen) => total + resumen.saldoAdicionalAntesCorte, 0),
  );

  return {
    resumenes,
    totalSaldoActual,
    totalPagoTotal,
    totalCreditoAFavor,
    totalCompras,
    totalCargosFijos,
    totalPagos,
    totalPagoAdicionalAntesCorte,
  };
}
