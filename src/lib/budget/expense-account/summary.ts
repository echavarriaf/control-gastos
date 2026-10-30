// Resumen bancario y dinero disponible; conserva límites de recalibración y reglas de reserva.
import type {
  CuentaGastos,
  MovimientoManualCuenta,
  MovimientoPendienteSaldo,
  ResumenCuentaGastos,
  SaldoTarjetaCuenta,
} from "./types";
import type {
  CompromisoFijo,
  GastoVariable,
  Ingreso,
  PagoFijo,
  PagoTarjeta,
  Quincena,
} from "@/lib/budget/types";
import {
  etiquetaFuenteIngreso,
  etiquetaMetodoVariable,
  gastoSaleDeCuenta,
  obtenerFechaCalendario,
  obtenerFechaMasReciente,
  obtenerPeriodoLocal,
  obtenerQuincenaLocal,
  pagoFijoSaleDeCuenta,
  redondearMoneda,
} from "./utils";
import { esFechaCalendarioValida } from "./validation";
import {
  calcularCompromisoTarjetas,
  construirGruposPagosFijos,
  construirReservasCompromisos,
} from "./fixed-reserves";
import { construirLedger } from "./ledger";

export function calcularResumenCuentaGastos(
  cuenta:
    CuentaGastos,
  ingresos:
    Ingreso[],
  gastos:
    GastoVariable[],
  pagosFijos:
    PagoFijo[],
  compromisosFijos:
    CompromisoFijo[],
  pagosTarjeta:
    PagoTarjeta[],

  /**
* 2B.2
*
* Saldos positivos actuales de las tarjetas.
*/
  saldosTarjetas:
    SaldoTarjetaCuenta[] =
    [],
  /**
 * Quincena financiera cuyas obligaciones deben
 * permanecer reservadas.
 *
 * Si el llamador no la suministra todavía,
 * usamos la quincena calendario actual.
 */
  quincenaReserva:
    Quincena | null =
    null,

  fechaReferencia =
    new Date(),

  movimientosManuales:
    MovimientoManualCuenta[] =
    [],
): ResumenCuentaGastos {
  const ingresosIncluidos =
    new Set(
      cuenta
        .ingresosIncluidosEnSaldoInicial,
    );

  const gastosIncluidos =
    new Set(
      cuenta
        .gastosIncluidosEnSaldoInicial,
    );

  const pagosFijosIncluidos =
    new Set(
      cuenta
        .pagosFijosIncluidosEnSaldoInicial,
    );

  const pagosTarjetaIncluidos =
    new Set(
      cuenta
        .pagosTarjetaIncluidosEnSaldoInicial,
    );

  const movimientosManualesIncluidos =
    new Set(
      cuenta
        .movimientosManualesIncluidosEnSaldoInicial ??
      [],
    );

  const depositos =
    ingresos
      .filter(
        (ingreso) => {
          if (
            ingreso.estado !==
            "recibido"
          ) {
            return false;
          }

          if (
            !ingreso
              .fechaRecibida
          ) {
            return false;
          }

          const fecha =
            obtenerFechaCalendario(
              ingreso
                .fechaRecibida,
            );

          if (
            fecha <
            cuenta
              .fechaSaldoInicial
          ) {
            return false;
          }

          if (
            ingresosIncluidos.has(
              ingreso.id,
            )
          ) {
            return false;
          }

          return (
            Number.isFinite(
              ingreso.monto,
            ) &&
            ingreso.monto >
            0
          );
        },
      );

  const movimientosManualesAplicables =
    movimientosManuales.filter(
      (
        movimiento,
      ) => {
        if (
          movimientosManualesIncluidos.has(
            movimiento.id,
          )
        ) {
          return false;
        }

        if (
          !esFechaCalendarioValida(
            movimiento.fecha,
          )
        ) {
          return false;
        }

        if (
          movimiento.fecha <
          cuenta.fechaSaldoInicial
        ) {
          return false;
        }

        if (
          movimiento.direccion !==
          "entrada" &&
          movimiento.direccion !==
          "salida"
        ) {
          return false;
        }

        if (
          !movimiento
            .concepto
            .trim()
        ) {
          return false;
        }

        return (
          Number.isFinite(
            movimiento.monto,
          ) &&
          movimiento.monto >
          0
        );
      },
    );

  const egresosVariables =
    gastos
      .filter(
        (gasto) => {
          if (
            !gastoSaleDeCuenta(
              gasto,
            )
          ) {
            return false;
          }

          if (
            gastosIncluidos.has(
              gasto.id,
            )
          ) {
            return false;
          }

          const fechaGasto =
            obtenerFechaCalendario(
              gasto.fecha,
            );

          if (
            fechaGasto <
            cuenta
              .fechaSaldoInicial
          ) {
            return false;
          }

          return (
            Number.isFinite(
              gasto.monto,
            ) &&
            gasto.monto >
            0
          );
        },
      );

  const gruposPagosFijos =
    construirGruposPagosFijos(
      pagosFijos,
      compromisosFijos,
    );

  const gruposFijosCompletos =
    gruposPagosFijos.filter(
      (grupo) =>
        grupo.completo,
    );

  const egresosFijos =
    gruposFijosCompletos
      .flatMap(
        (grupo) =>
          grupo.pagos,
      )
      .filter(
        (pago) => {
          if (
            !pagoFijoSaleDeCuenta(
              pago,
            )
          ) {
            return false;
          }

          if (
            pagosFijosIncluidos.has(
              pago.id,
            )
          ) {
            return false;
          }

          const fechaPago =
            obtenerFechaCalendario(
              pago.fecha,
            );

          if (
            fechaPago <
            cuenta
              .fechaSaldoInicial
          ) {
            return false;
          }

          return (
            Number.isFinite(
              pago.monto,
            ) &&
            pago.monto >
            0
          );
        },
      );

  const egresosTarjetas =
    pagosTarjeta
      .filter(
        (pago) => {
          /**
           * ============================================================
           * 2B.2B — PAGOS PENDIENTES A TARJETA
           * ============================================================
           *
           * Si el pago todavía está pendiente:
           *
           * - NO ha salido realmente de la cuenta bancaria;
           * - NO debe reducir Saldo actual;
           * - sí estará representado dentro de Comprometido
           *   mediante montoReservarCuenta.
           *
           * Cuando cambie a "contabilizada", automáticamente
           * entrará en los egresos bancarios.
           */
          if (
            pago.estadoTarjeta ===
            "pendiente"
          ) {
            return false;
          }

          /**
           * El pago ya estaba incluido en la fotografía
           * del saldo inicial de la cuenta.
           */
          if (
            pagosTarjetaIncluidos.has(
              pago.id,
            )
          ) {
            return false;
          }

          const fechaPago =
            obtenerFechaCalendario(
              pago.fecha,
            );

          /**
           * Ignoramos movimientos anteriores a la fecha
           * utilizada como saldo inicial/recalibración.
           */
          if (
            fechaPago <
            cuenta
              .fechaSaldoInicial
          ) {
            return false;
          }

          return (
            Number.isFinite(
              pago.monto,
            ) &&
            pago.monto >
            0
          );
        },
      );

  const movimientosPendientes:
    MovimientoPendienteSaldo[] =
    [];

  for (
    const ingreso
    of depositos
  ) {
    movimientosPendientes.push({
      id:
        `deposito:${ingreso.id}`,

      tipo:
        "deposito",

      direccion:
        "entrada",

      fecha:
        obtenerFechaCalendario(
          ingreso
            .fechaRecibida ??
          ingreso
            .fechaProgramada,
        ),

      concepto:
        ingreso.descripcion,

      detalle:
        etiquetaFuenteIngreso(
          ingreso,
        ),

      monto:
        redondearMoneda(
          ingreso.monto,
        ),

      orden:
        10,
    });
  }

  for (
    const movimiento
    of movimientosManualesAplicables
  ) {
    movimientosPendientes.push({
      id:
        `manual:${movimiento.id}`,

      tipo:
        "movimiento_manual",

      direccion:
        movimiento.direccion,

      fecha:
        movimiento.fecha,

      concepto:
        movimiento.concepto,

      detalle:
        movimiento.notas ||
        (
          movimiento.direccion ===
            "entrada"
            ? "Entrada manual"
            : "Salida manual"
        ),

      monto:
        redondearMoneda(
          movimiento.monto,
        ),

      orden:
        15,

      creadoEn:
        movimiento.creadoEn,
    });
  }

  for (
    const gasto
    of egresosVariables
  ) {
    movimientosPendientes.push({
      id:
        `gasto:${gasto.id}`,

      tipo:
        "gasto_variable",

      direccion:
        "salida",

      fecha:
        obtenerFechaCalendario(
          gasto.fecha,
        ),

      concepto:
        gasto.concepto,

      detalle:
        etiquetaMetodoVariable(
          gasto,
        ),

      monto:
        redondearMoneda(
          gasto.monto,
        ),

      orden:
        20,

      creadoEn:
        gasto.creadoEn,
    });
  }

  const keysCompletosConSalida =
    new Set<string>();

  for (
    const grupo
    of gruposFijosCompletos
  ) {
    const pagosBancariosNuevos =
      grupo.pagos.filter(
        (pago) =>
          pagoFijoSaleDeCuenta(
            pago,
          ) &&
          !pagosFijosIncluidos.has(
            pago.id,
          ) &&
          obtenerFechaCalendario(
            pago.fecha,
          ) >=
          cuenta
            .fechaSaldoInicial &&
          Number.isFinite(
            pago.monto,
          ) &&
          pago.monto >
          0,
      );

    const montoBanco =
      redondearMoneda(
        pagosBancariosNuevos.reduce(
          (
            total,
            pago,
          ) =>
            total +
            pago.monto,
          0,
        ),
      );

    if (
      montoBanco <=
      0
    ) {
      continue;
    }

    keysCompletosConSalida.add(
      grupo.key,
    );

    movimientosPendientes.push({
      id:
        `pago-fijo:${grupo.key}`,

      tipo:
        "pago_fijo",

      direccion:
        "salida",

      fecha:
        obtenerFechaMasReciente(
          grupo.pagos,
        ),

      concepto:
        grupo
          .compromiso
          .descripcion,

      detalle:
        "Gasto fijo completado",

      monto:
        montoBanco,

      orden:
        30,
    });
  }

  for (
    const pago
    of egresosTarjetas
  ) {
    movimientosPendientes.push({
      id:
        `tarjeta:${pago.id}`,

      tipo:
        "pago_tarjeta",

      direccion:
        "salida",

      fecha:
        obtenerFechaCalendario(
          pago.fecha,
        ),

      concepto:
        pago.concepto ||
        "Pago a tarjeta",

      detalle:
        "Pago de tarjeta de crédito",

      monto:
        redondearMoneda(
          pago.monto,
        ),

      orden:
        40,

      creadoEn:
        pago.creadoEn,
    });
  }

  const totalDepositosDesdeSaldoInicial =
    redondearMoneda(
      depositos.reduce(
        (
          total,
          ingreso,
        ) =>
          total +
          ingreso.monto,
        0,
      ),
    );

  const totalEntradasManuales =
    redondearMoneda(
      movimientosManualesAplicables
        .filter(
          (
            movimiento,
          ) =>
            movimiento.direccion ===
            "entrada",
        )
        .reduce(
          (
            total,
            movimiento,
          ) =>
            total +
            movimiento.monto,
          0,
        ),
    );

  const totalSalidasManuales =
    redondearMoneda(
      movimientosManualesAplicables
        .filter(
          (
            movimiento,
          ) =>
            movimiento.direccion ===
            "salida",
        )
        .reduce(
          (
            total,
            movimiento,
          ) =>
            total +
            movimiento.monto,
          0,
        ),
    );

  const totalEgresosVariables =
    redondearMoneda(
      egresosVariables.reduce(
        (
          total,
          gasto,
        ) =>
          total +
          gasto.monto,
        0,
      ),
    );

  const totalEgresosFijos =
    redondearMoneda(
      egresosFijos.reduce(
        (
          total,
          pago,
        ) =>
          total +
          pago.monto,
        0,
      ),
    );

  const totalEgresosTarjetas =
    redondearMoneda(
      egresosTarjetas.reduce(
        (
          total,
          pago,
        ) =>
          total +
          pago.monto,
        0,
      ),
    );

  const totalEgresos =
    redondearMoneda(
      totalEgresosVariables +
      totalEgresosFijos +
      totalEgresosTarjetas,
    );

  const saldoActual =
    redondearMoneda(
      cuenta.saldoInicial +
      totalDepositosDesdeSaldoInicial +
      totalEntradasManuales -
      totalEgresos -
      totalSalidasManuales,
    );

  /*
   * ---------------------------------------------------------
   * 2B — DISPONIBLE REAL
   * ---------------------------------------------------------
   *
   * El periodo de reserva usa el mes real actual,
   * no el mes que el usuario esté consultando en pantalla.
   */
  const periodoReserva =
    obtenerPeriodoLocal(
      fechaReferencia,
    );

  const quincenaReservaActual =
    quincenaReserva ??
    obtenerQuincenaLocal(
      fechaReferencia,
    );

  const reservasCompromisos =
    construirReservasCompromisos(
      compromisosFijos,
      pagosFijos,
      periodoReserva,
      quincenaReservaActual
    );

  /**
 * ============================================================
 * 2B.2
 * DISPONIBLE REAL
 * ============================================================
 */

  const totalReservasFijas =
    redondearMoneda(
      reservasCompromisos.reduce(
        (
          total,
          reserva,
        ) =>
          total +
          reserva
            .montoReservado,
        0,
      ),
    );

  const {
    totalDeudaTarjetas,
    totalSolapamientoTarjetas,
  } =
    calcularCompromisoTarjetas(
      pagosFijos,
      reservasCompromisos,
      periodoReserva,
      saldosTarjetas,
    );

  /**
   * Una misma obligación puede estar temporalmente
   * representada en dos sitios:
   *
   * 1. reserva del compromiso fijo;
   * 2. saldo pendiente de tarjeta.
   *
   * El solapamiento elimina esa duplicación.
   */
  const totalComprometido =
    redondearMoneda(
      totalReservasFijas +
      totalDeudaTarjetas -
      totalSolapamientoTarjetas,
    );

  /*
   * No usamos Math.max(..., 0).
   *
   * Si falta dinero queremos mostrar el déficit real
   * en vez de esconderlo.
   */
  const disponibleReal =
    redondearMoneda(
      saldoActual -
      totalComprometido,
    );

  const faltanteReal =
    redondearMoneda(
      Math.max(
        -disponibleReal,
        0,
      ),
    );

  const movimientos =
    construirLedger(
      cuenta,
      movimientosPendientes,
    );

  return {
    saldoInicial:
      cuenta.saldoInicial,

    totalDepositosDesdeSaldoInicial,
    totalEntradasManuales,

    totalSalidasManuales,

    totalEgresosVariables,

    totalEgresosFijos,

    totalEgresosTarjetas,

    totalEgresos,

    saldoActual,

    totalReservasFijas,

    totalDeudaTarjetas,

    totalSolapamientoTarjetas,

    totalComprometido,

    disponibleReal,

    faltanteReal,

    cantidadDepositos:
      depositos.length,
    cantidadMovimientosManuales:
      movimientosManualesAplicables.length,

    cantidadEgresosVariables:
      egresosVariables.length,

    cantidadCompromisosFijosCompletos:
      keysCompletosConSalida
        .size,

    cantidadPagosTarjeta:
      egresosTarjetas.length,

    cantidadCompromisosReservados:
      reservasCompromisos
        .length,

    periodoReserva,

    depositos,

    egresosVariables,

    egresosFijos,

    egresosTarjetas,

    movimientosManuales:
      movimientosManualesAplicables,

    reservasCompromisos,

    movimientos,
  };
}
