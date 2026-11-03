import type { MovimientoCuentaGastos } from "./expense-account";
import { redondearMoneda } from "./expense-account/utils";
import { obtenerFechaCalendarioDesdeISO } from "./utils";

/** A changed amount/date/direction must be checked against the bank again. */
export function claveRevisionMovimiento(movimiento: MovimientoCuentaGastos): string {
  return JSON.stringify([movimiento.id, movimiento.fecha, movimiento.direccion, movimiento.monto]);
}

export function conciliarCuenta({ movimientos, fechaCorte, saldoBanco, revisados }: {
  movimientos: MovimientoCuentaGastos[];
  fechaCorte: string;
  saldoBanco: number;
  revisados: ReadonlySet<string>;
}) {
  if (!Number.isFinite(saldoBanco)) throw new Error("Escribe un saldo bancario válido.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCorte) || obtenerFechaCalendarioDesdeISO(fechaCorte) !== fechaCorte) {
    throw new Error("Selecciona una fecha válida.");
  }
  const bases = movimientos.filter(movimiento => movimiento.tipo === "saldo_inicial");
  const base = bases[0];
  if (bases.length !== 1 || !base || fechaCorte < base.fecha.slice(0, 10)) {
    throw new Error("La fecha debe ser igual o posterior al saldo base de la cuenta.");
  }
  const partidas = movimientos.filter(movimiento => movimiento.tipo !== "saldo_inicial" && movimiento.fecha.slice(0, 10) <= fechaCorte);
  let saldoCalculado = base.monto;
  let saldoRevisado = base.monto;
  let entradasSinRevisar = 0;
  let salidasSinRevisar = 0;
  const sinRevisar: MovimientoCuentaGastos[] = [];
  for (const movimiento of partidas) {
    const importe = movimiento.direccion === "entrada" ? movimiento.monto : -movimiento.monto;
    saldoCalculado = redondearMoneda(saldoCalculado + importe);
    if (revisados.has(claveRevisionMovimiento(movimiento))) {
      saldoRevisado = redondearMoneda(saldoRevisado + importe);
    } else {
      sinRevisar.push(movimiento);
      if (movimiento.direccion === "entrada") entradasSinRevisar = redondearMoneda(entradasSinRevisar + movimiento.monto);
      else salidasSinRevisar = redondearMoneda(salidasSinRevisar + movimiento.monto);
    }
  }
  const diferencia = redondearMoneda(saldoBanco - saldoCalculado);
  const diferenciaRevisada = redondearMoneda(saldoBanco - saldoRevisado);
  return {
    saldoBase: base.monto, saldoCalculado, saldoRevisado, diferencia, diferenciaRevisada,
    partidas, sinRevisar, entradasSinRevisar, salidasSinRevisar,
    cantidadRevisada: partidas.length - sinRevisar.length,
    coincideSaldo: diferencia === 0,
    revisionCompleta: diferencia === 0 && sinRevisar.length === 0,
    partidasPendientesExplicanDiferencia: diferencia !== 0 && diferenciaRevisada === 0 && sinRevisar.length > 0,
  };
}
