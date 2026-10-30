// Construcción y orden del historial bancario a partir de movimientos aplicables.
import type { CuentaGastos, MovimientoCuentaGastos, MovimientoPendienteSaldo } from "./types";
import { redondearMoneda } from "./utils";

export function construirLedger(
  cuenta:
    CuentaGastos,

  movimientosPendientes:
    MovimientoPendienteSaldo[],
): MovimientoCuentaGastos[] {
  const ordenados =
    [
      ...movimientosPendientes,
    ].sort(
      (
        a,
        b,
      ) => {
        const porFecha =
          a.fecha.localeCompare(
            b.fecha,
          );

        if (
          porFecha !== 0
        ) {
          return porFecha;
        }

        const creadoA =
          a.creadoEn ??
          "";

        const creadoB =
          b.creadoEn ??
          "";

        if (
          creadoA &&
          creadoB &&
          creadoA !==
          creadoB
        ) {
          return creadoA.localeCompare(
            creadoB,
          );
        }

        if (
          a.orden !==
          b.orden
        ) {
          return (
            a.orden -
            b.orden
          );
        }

        return a.id.localeCompare(
          b.id,
        );
      },
    );

  let saldo =
    cuenta.saldoInicial;

  const ledger:
    MovimientoCuentaGastos[] =
    [
      {
        id:
          `saldo-inicial:${cuenta.fechaSaldoInicial}`,

        tipo:
          "saldo_inicial",

        direccion:
          "base",

        fecha:
          cuenta.fechaSaldoInicial,

        concepto:
          "Saldo inicial",

        detalle:
          "Punto de partida de la Cuenta de gastos",

        monto:
          cuenta.saldoInicial,

        saldoDespues:
          cuenta.saldoInicial,
      },
    ];

  for (
    const movimiento
    of ordenados
  ) {
    if (
      movimiento.direccion ===
      "entrada"
    ) {
      saldo =
        redondearMoneda(
          saldo +
          movimiento.monto,
        );
    } else {
      saldo =
        redondearMoneda(
          saldo -
          movimiento.monto,
        );
    }

    ledger.push({
      id:
        movimiento.id,

      tipo:
        movimiento.tipo,

      direccion:
        movimiento.direccion,

      fecha:
        movimiento.fecha,

      concepto:
        movimiento.concepto,

      detalle:
        movimiento.detalle,

      monto:
        movimiento.monto,

      saldoDespues:
        saldo,
    });
  }

  return ledger.reverse();
}
