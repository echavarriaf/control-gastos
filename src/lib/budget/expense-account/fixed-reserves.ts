// Agrupación de pagos fijos, reservas y solapamiento por tarjeta.
import type { CompromisoFijo, PagoFijo, Quincena } from "@/lib/budget/types";
import type { GrupoPagoFijo, ReservaCompromisoCuenta, SaldoTarjetaCuenta } from "./types";
import { obtenerPeriodoCalendario, redondearMoneda } from "./utils";
import { TOLERANCIA_MONEDA } from "./constants";

export function construirGruposPagosFijos(
  pagosFijos:
    PagoFijo[],

  compromisosFijos:
    CompromisoFijo[],
): GrupoPagoFijo[] {
  const compromisosPorId =
    new Map(
      compromisosFijos.map(
        (compromiso) => [
          compromiso.id,
          compromiso,
        ],
      ),
    );

  const grupos =
    new Map<
      string,
      {
        compromiso:
        CompromisoFijo;

        periodo:
        string;

        pagos:
        PagoFijo[];
      }
    >();

  for (
    const pago
    of pagosFijos
  ) {
    const compromiso =
      compromisosPorId.get(
        pago.compromisoId,
      );

    if (
      !compromiso
    ) {
      continue;
    }

    const periodo =
      obtenerPeriodoCalendario(
        pago.fecha,
      );

    if (
      !periodo
    ) {
      continue;
    }

    const key =
      `${compromiso.id}:${periodo}`;

    const existente =
      grupos.get(
        key,
      );

    if (
      existente
    ) {
      existente
        .pagos
        .push(
          pago,
        );

      continue;
    }

    grupos.set(
      key,
      {
        compromiso,

        periodo,

        pagos: [
          pago,
        ],
      },
    );
  }

  return Array
    .from(
      grupos.entries(),
    )
    .map(
      ([
        key,
        grupo,
      ]) => {
        const totalPagado =
          redondearMoneda(
            grupo.pagos.reduce(
              (
                total,
                pago,
              ) =>
                total +
                pago.monto,
              0,
            ),
          );

        const completo =
          (
            totalPagado +
            TOLERANCIA_MONEDA
          ) >=
          grupo
            .compromiso
            .monto;

        return {
          key,

          compromiso:
            grupo.compromiso,

          periodo:
            grupo.periodo,

          pagos:
            grupo.pagos,

          totalPagado,

          completo,
        };
      },
    );
}

/**
 * Calcula el dinero que debe permanecer reservado.
 *
 * Regla:
 *
 * - compromiso inactivo => $0 reservado;
 * - compromiso totalmente pagado => $0 reservado;
 * - compromiso pendiente => monto completo reservado;
 * - compromiso parcial => monto completo reservado.
 *
 * Mantener el total completo durante un pago parcial es
 * intencional. La Cuenta de gastos tampoco reconoce esa salida
 * hasta completar el compromiso, por lo que liberar el parcial
 * aquí inflaría artificialmente el Disponible real.
 */
export function construirReservasCompromisos(
  compromisosFijos:
    CompromisoFijo[],

  pagosFijos:
    PagoFijo[],

  periodo:
    string,

  quincena:
    Quincena,
): ReservaCompromisoCuenta[] {
  const pagosPeriodo =
    pagosFijos.filter(
      (pago) =>
        obtenerPeriodoCalendario(
          pago.fecha,
        ) ===
        periodo,
    );

  return compromisosFijos
    .filter(
      (
        compromiso,
      ) =>
        compromiso.activo &&
        compromiso
          .quincenaPresupuestaria ===
        quincena,
    )
    .flatMap(
      (
        compromiso,
      ): ReservaCompromisoCuenta[] => {
        const pagosCompromiso =
          pagosPeriodo.filter(
            (pago) =>
              pago.compromisoId ===
              compromiso.id,
          );

        const montoPagadoRegistrado =
          redondearMoneda(
            pagosCompromiso.reduce(
              (
                total,
                pago,
              ) =>
                total +
                pago.monto,
              0,
            ),
          );

        const completo =
          (
            montoPagadoRegistrado +
            TOLERANCIA_MONEDA
          ) >=
          compromiso.monto;

        if (
          completo
        ) {
          return [];
        }

        const montoPendienteRegistrado =
          redondearMoneda(
            Math.max(
              compromiso.monto -
              montoPagadoRegistrado,
              0,
            ),
          );

        return [
          {
            id:
              compromiso.id,

            descripcion:
              compromiso.descripcion,

            montoCompromiso:
              redondearMoneda(
                compromiso.monto,
              ),

            montoPagadoRegistrado,

            montoPendienteRegistrado,

            /*
             * Mantiene el total completo reservado hasta
             * que el compromiso pase a pagado.
             */
            montoReservado:
              redondearMoneda(
                compromiso.monto,
              ),

            diaVencimiento:
              compromiso
                .diaVencimiento,

            prioridad:
              compromiso
                .prioridad,

            estado:
              montoPagadoRegistrado >
                0
                ? "parcial"
                : "pendiente",
          },
        ];
      },
    )
    .sort(
      (
        a,
        b,
      ) => {
        if (
          a.prioridad !==
          b.prioridad
        ) {
          return (
            a.prioridad -
            b.prioridad
          );
        }

        if (
          a.diaVencimiento !==
          b.diaVencimiento
        ) {
          return (
            a.diaVencimiento -
            b.diaVencimiento
          );
        }

        return a.descripcion.localeCompare(
          b.descripcion,
          "es",
        );
      },
    );
}

/**
 * ============================================================
 * 2B.2
 * DEUDA DE TARJETAS Y SOLAPAMIENTO CON COMPROMISOS FIJOS
 * ============================================================
 *
 * Un compromiso parcial continúa reservando su monto completo.
 *
 * Sin embargo, si una parte ya fue cargada a una tarjeta,
 * esa misma cantidad también aparece dentro del saldo de la
 * tarjeta.
 *
 * Ejemplo:
 *
 * compromiso                  $145
 * cargado a Apple              $50
 * deuda Apple                  $50
 *
 * Sin corrección:
 *
 * reserva fija                $145
 * deuda tarjeta                $50
 * total                       $195  <- incorrecto
 *
 * Con solapamiento:
 *
 * reserva fija                $145
 * deuda tarjeta                $50
 * solapamiento                -$50
 * total                       $145
 */
export function calcularCompromisoTarjetas(
  pagosFijos:
    PagoFijo[],

  reservasCompromisos:
    ReservaCompromisoCuenta[],

  periodo:
    string,

  saldosTarjetas:
    SaldoTarjetaCuenta[],
): {
  totalDeudaTarjetas:
  number;

  totalSolapamientoTarjetas:
  number;
} {
  /**
   * Solamente los compromisos todavía reservados
   * pueden generar doble conteo.
   */
  const compromisosReservados =
    new Set(
      reservasCompromisos.map(
        (
          reserva,
        ) =>
          reserva.id,
      ),
    );

  /**
   * Cantidad ya cargada a cada tarjeta proveniente
   * de compromisos que continúan reservados.
   */
  const cargosFijosPorTarjeta =
    new Map<
      string,
      number
    >();

  for (
    const pago
    of pagosFijos
  ) {
    if (
      obtenerPeriodoCalendario(
        pago.fecha,
      ) !==
      periodo
    ) {
      continue;
    }

    if (
      !compromisosReservados.has(
        pago.compromisoId,
      )
    ) {
      continue;
    }

    if (
      pago.metodo !==
      "tarjeta"
    ) {
      continue;
    }

    if (
      !pago.tarjetaId
    ) {
      continue;
    }

    if (
      !Number.isFinite(
        pago.monto,
      ) ||
      pago.monto <=
      0
    ) {
      continue;
    }

    const acumulado =
      cargosFijosPorTarjeta.get(
        pago.tarjetaId,
      ) ??
      0;

    cargosFijosPorTarjeta.set(
      pago.tarjetaId,
      redondearMoneda(
        acumulado +
        pago.monto,
      ),
    );
  }

  let totalDeudaTarjetas =
    0;

  let totalSolapamientoTarjetas =
    0;

  for (
    const saldoTarjeta
    of saldosTarjetas
  ) {
    const deuda =
      redondearMoneda(
        Math.max(
          saldoTarjeta
            .montoReservarCuenta,
          0,
        ),
      );

    totalDeudaTarjetas =
      redondearMoneda(
        totalDeudaTarjetas +
        deuda,
      );

    /**
     * Solamente podemos descontar como solapamiento
     * una cantidad que todavía exista dentro de la
     * deuda actual de ESA tarjeta.
     *
     * Si el usuario ya pagó parte o toda la tarjeta,
     * no descontamos más de lo que sigue pendiente.
     */
    const cargosFijosReservados =
      redondearMoneda(
        cargosFijosPorTarjeta.get(
          saldoTarjeta
            .tarjetaId,
        ) ??
        0,
      );

    const solapamientoTarjeta =
      redondearMoneda(
        Math.min(
          deuda,
          cargosFijosReservados,
        ),
      );

    totalSolapamientoTarjetas =
      redondearMoneda(
        totalSolapamientoTarjetas +
        solapamientoTarjeta,
      );
  }

  return {
    totalDeudaTarjetas,

    totalSolapamientoTarjetas,
  };
}
