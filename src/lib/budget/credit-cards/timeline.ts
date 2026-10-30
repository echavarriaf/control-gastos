// Línea de tiempo de compras, cargos fijos y pagos de tarjeta.
import type { GastoVariable, PagoFijo, PagoTarjeta, TarjetaCredito } from "@/lib/budget/types";
import type { MovimientoCronologicoTarjeta } from "./types";
import { redondearMoneda } from "./money";

/**
 * Devuelve YYYY-MM-DD.
 */
function obtenerFechaCalendario(
  fecha:
    string,
): string {
  return fecha.slice(
    0,
    10,
  );
}

/**
 * Obtiene la marca temporal más precisa disponible.
 */
function obtenerCreadoEn(
  movimiento:
    GastoVariable | PagoTarjeta,
): string {
  const creadoEn =
    movimiento.creadoEn;

  if (
    typeof creadoEn ===
    "string" &&
    creadoEn.trim()
  ) {
    return creadoEn;
  }

  return movimiento.fecha;
}

/**
 * Unifica compras y pagos de una tarjeta
 * en una sola línea de tiempo.
 */
export function construirMovimientosTarjeta(
  tarjeta:
    TarjetaCredito,

  gastos:
    GastoVariable[],

  pagosFijos:
    PagoFijo[],

  pagos:
    PagoTarjeta[],
): MovimientoCronologicoTarjeta[] {
  const fechaInicial =
    obtenerFechaCalendario(
      tarjeta
        .fechaSaldoInicial,
    );

  /**
   * Compras variables normales.
   */
  const compras:
    MovimientoCronologicoTarjeta[] =
    gastos.flatMap(
      (
        gasto,
      ) => {
        if (
          gasto.tarjetaId !==
          tarjeta.id
        ) {
          return [];
        }

        const fecha =
          obtenerFechaCalendario(
            gasto.fecha,
          );

        if (
          fecha <
          fechaInicial
        ) {
          return [];
        }

        return [
          {
            id:
              gasto.id,

            tipo:
              "gasto",

            monto:
              redondearMoneda(
                gasto.monto,
              ),

            fecha,

            creadoEn:
              obtenerCreadoEn(
                gasto,
              ),
          },
        ];
      },
    );

  /**
   * ============================================================
   * 2B.2 — GASTOS FIJOS PAGADOS CON TARJETA
   * ============================================================
   *
   * Registrar un compromiso como pagado con tarjeta NO significa
   * que salió dinero de la cuenta bancaria.
   *
   * Significa que apareció una nueva deuda en esa tarjeta.
   */
  const cargosFijos:
    MovimientoCronologicoTarjeta[] =
    pagosFijos.flatMap(
      (
        pago,
      ) => {
        if (
          pago.metodo !==
          "tarjeta"
        ) {
          return [];
        }

        if (
          pago.tarjetaId !==
          tarjeta.id
        ) {
          return [];
        }

        const fecha =
          obtenerFechaCalendario(
            pago.fecha,
          );

        if (
          fecha <
          fechaInicial
        ) {
          return [];
        }

        if (
          !Number.isFinite(
            pago.monto,
          ) ||
          pago.monto <=
          0
        ) {
          return [];
        }

        return [
          {
            /**
             * Prefijo para evitar una posible colisión
             * entre IDs de colecciones distintas.
             */
            id:
              `pago-fijo:${pago.id}`,

            tipo:
              "gasto",

            monto:
              redondearMoneda(
                pago.monto,
              ),

            fecha,

            /**
             * PagoFijo todavía no conserva creadoEn en
             * el modelo público.
             *
             * Lo colocamos al inicio del día para que,
             * cuando exista un pago de tarjeta el mismo
             * día, la interpretación conservadora sea:
             *
             * cargo primero -> pago después.
             */
            creadoEn:
              `${fecha}T00:00:00.000Z`,
          },
        ];
      },
    );

  /**
   * Pagos reales realizados A la tarjeta.
   */
  const pagosTarjeta:
    MovimientoCronologicoTarjeta[] =
    pagos.flatMap(
      (
        pago,
      ) => {
        if (
          pago.tarjetaId !==
          tarjeta.id
        ) {
          return [];
        }

        const fecha =
          obtenerFechaCalendario(
            pago.fecha,
          );

        if (
          fecha <
          fechaInicial
        ) {
          return [];
        }

        return [
          {
            id:
              pago.id,

            tipo:
              "pago",

            monto:
              redondearMoneda(
                pago.monto,
              ),

            fecha,

            creadoEn:
              obtenerCreadoEn(
                pago,
              ),
          },
        ];
      },
    );

  return [
    ...compras,
    ...cargosFijos,
    ...pagosTarjeta,
  ].sort(
    (
      a,
      b,
    ) => {
      const fechaComparacion =
        a.fecha.localeCompare(
          b.fecha,
        );

      if (
        fechaComparacion !==
        0
      ) {
        return fechaComparacion;
      }

      const creadoComparacion =
        a.creadoEn.localeCompare(
          b.creadoEn,
        );

      if (
        creadoComparacion !==
        0
      ) {
        return creadoComparacion;
      }

      /**
       * Interpretación conservadora:
       *
       * cuando no podemos conocer un orden más preciso,
       * primero aplicamos el cargo y después el pago.
       */
      if (
        a.tipo !==
        b.tipo
      ) {
        return a.tipo ===
          "gasto"
          ? -1
          : 1;
      }

      return a.id.localeCompare(
        b.id,
      );
    },
  );
}

/**
 * Total de compras desde el saldo inicial.
 */
export function sumarComprasDesdeSaldo(
  tarjeta:
    TarjetaCredito,

  gastos:
    GastoVariable[],
): number {
  const fechaInicial =
    obtenerFechaCalendario(
      tarjeta
        .fechaSaldoInicial,
    );

  const total =
    gastos.reduce(
      (
        acumulado,
        gasto,
      ) => {
        if (
          gasto.tarjetaId !==
          tarjeta.id
        ) {
          return acumulado;
        }

        if (
          obtenerFechaCalendario(
            gasto.fecha,
          ) <
          fechaInicial
        ) {
          return acumulado;
        }

        return (
          acumulado +
          gasto.monto
        );
      },
      0,
    );

  return redondearMoneda(
    total,
  );
}

/**
 * ============================================================
 * 2B.2
 * CARGOS FIJOS DESDE EL SALDO INICIAL DE LA TARJETA
 * ============================================================
 */
export function sumarCargosFijosDesdeSaldo(
  tarjeta:
    TarjetaCredito,

  pagosFijos:
    PagoFijo[],
): number {
  const fechaInicial =
    obtenerFechaCalendario(
      tarjeta
        .fechaSaldoInicial,
    );

  const total =
    pagosFijos.reduce(
      (
        acumulado,
        pago,
      ) => {
        if (
          pago.metodo !==
          "tarjeta"
        ) {
          return acumulado;
        }

        if (
          pago.tarjetaId !==
          tarjeta.id
        ) {
          return acumulado;
        }

        if (
          obtenerFechaCalendario(
            pago.fecha,
          ) <
          fechaInicial
        ) {
          return acumulado;
        }

        if (
          !Number.isFinite(
            pago.monto,
          ) ||
          pago.monto <=
          0
        ) {
          return acumulado;
        }

        return (
          acumulado +
          pago.monto
        );
      },
      0,
    );

  return redondearMoneda(
    total,
  );
}

/**
 * Total de pagos desde el saldo inicial.
 */
export function sumarPagosDesdeSaldo(
  tarjeta:
    TarjetaCredito,

  pagos:
    PagoTarjeta[],
): number {
  const fechaInicial =
    obtenerFechaCalendario(
      tarjeta
        .fechaSaldoInicial,
    );

  const total =
    pagos.reduce(
      (
        acumulado,
        pago,
      ) => {
        if (
          pago.tarjetaId !==
          tarjeta.id
        ) {
          return acumulado;
        }

        if (
          obtenerFechaCalendario(
            pago.fecha,
          ) <
          fechaInicial
        ) {
          return acumulado;
        }

        return (
          acumulado +
          pago.monto
        );
      },
      0,
    );

  return redondearMoneda(
    total,
  );
}
