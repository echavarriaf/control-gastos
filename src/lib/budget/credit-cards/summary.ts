// Resumen financiero determinista de una tarjeta, sin React ni acceso a datos.
import type { GastoVariable, PagoFijo, PagoTarjeta, TarjetaCredito } from "@/lib/budget/types";
import type { ResumenTarjetaActual } from "./types";
import { sumarCargosFijosDesdeSaldo, sumarComprasDesdeSaldo, sumarPagosDesdeSaldo } from "./timeline";
import { TOLERANCIA_SALDO, redondearMoneda } from "./money";
import { evaluarActividadPosteriorCobertura, evaluarCoberturaCorte } from "./payment-coverage";
import {
  calcularCalendarioPagoTarjeta,
  evaluarVentanaPagoTarjeta,
} from "@/lib/budget/credit-card-payment-calendar";

export function clasificarTransaccionesTarjeta(
  gastos: GastoVariable[],
  pagosFijos: PagoFijo[],
  pagos: PagoTarjeta[],
) {
  const gastosContabilizados =
    gastos.filter(
      (gasto) =>
        gasto.estadoTarjeta !==
        "pendiente",
    );

  const gastosPendientes =
    gastos.filter(
      (gasto) =>
        gasto.estadoTarjeta ===
        "pendiente",
    );

  /**
   * Los pagos fijos se contabilizan inmediatamente.
   * No existe estado pendiente para PagoFijo.
   */
  const pagosFijosContabilizados =
    pagosFijos;

  const pagosContabilizados =
    pagos.filter(
      (pago) =>
        pago.estadoTarjeta !==
        "pendiente",
    );

  const pagosPendientesTarjeta =
    pagos.filter(
      (pago) =>
        pago.estadoTarjeta ===
        "pendiente",
    );

  return {
    gastosContabilizados,
    gastosPendientes,
    pagosFijosContabilizados,
    pagosContabilizados,
    pagosPendientesTarjeta,
  };
}

/**
 * Construye el resumen completo.
 */
export function crearResumenTarjeta(
  tarjeta:
    TarjetaCredito,

  gastos:
    GastoVariable[],

  pagosFijos:
    PagoFijo[],

  pagos:
    PagoTarjeta[],

  fechaReferencia:
    Date,
): ResumenTarjetaActual {
  const {
  gastosContabilizados,
  gastosPendientes,
  pagosFijosContabilizados,
  pagosContabilizados,
  pagosPendientesTarjeta,
} =
  clasificarTransaccionesTarjeta(
    gastos,
    pagosFijos,
    pagos,
  );

  /**
 * Solo las transacciones contabilizadas modifican
 * el saldo oficial de la tarjeta.
 */
  const comprasDesdeSaldo =
    sumarComprasDesdeSaldo(
      tarjeta,
      gastosContabilizados,
    );

  const cargosFijosDesdeSaldo =
    sumarCargosFijosDesdeSaldo(
      tarjeta,
      pagosFijosContabilizados,
    );

  const pagosDesdeSaldo =
    sumarPagosDesdeSaldo(
      tarjeta,
      pagosContabilizados,
    );

  /**
   * Las pendientes se calculan aparte.
   */
  const comprasPendientes =
    sumarComprasDesdeSaldo(
      tarjeta,
      gastosPendientes,
    );

  const pagosPendientes =
    sumarPagosDesdeSaldo(
      tarjeta,
      pagosPendientesTarjeta,
    );

  const totalCargosPendientes =
    redondearMoneda(
      comprasPendientes
    );

  const saldoCalculado =
    redondearMoneda(
      tarjeta.saldoInicial +
      comprasDesdeSaldo +
      cargosFijosDesdeSaldo -
      pagosDesdeSaldo,
    );

  const saldoActual =
    redondearMoneda(
      Math.max(
        saldoCalculado,
        0,
      ),
    );

  const creditoAFavor =
    redondearMoneda(
      Math.max(
        -saldoCalculado,
        0,
      ),
    );

  /**
 * Saldo esperado cuando las transacciones pendientes
 * terminen de contabilizarse.
 *
 * Este valor NO sustituye saldoActual.
 */
  const saldoProyectadoCalculado =
    redondearMoneda(
      saldoCalculado +
      totalCargosPendientes -
      pagosPendientes,
    );

  const saldoProyectado =
    redondearMoneda(
      Math.max(
        saldoProyectadoCalculado,
        0,
      ),
    );

  const montoPagoTotal =
    saldoActual;

  const creditoDisponible =
    tarjeta.limiteCredito ===
      null
      ? null
      : redondearMoneda(
        Math.max(
          tarjeta
            .limiteCredito -
          saldoCalculado,
          0,
        ),
      );

  const porcentajeUtilizado =
    tarjeta.limiteCredito ===
      null ||
      tarjeta.limiteCredito <=
      0
      ? null
      : Math.max(
        0,
        (
          saldoActual /
          tarjeta
            .limiteCredito
        ) *
        100,
      );

  /**
   * 1C.2F
   */
  const cobertura =
    evaluarCoberturaCorte(
      tarjeta,
      gastosContabilizados,
      pagosFijosContabilizados,
      pagosContabilizados,
      fechaReferencia,
    );

  /**
   * 1C.2G
   */
  const actividadPosterior =
    evaluarActividadPosteriorCobertura(
      tarjeta,
      gastosContabilizados,
      pagosFijosContabilizados,
      pagosContabilizados,
      fechaReferencia,
      cobertura,
    );

  /**
* ============================================================
* 2B.2B
* MONTO QUE REALMENTE DEBE RESERVAR LA CUENTA
* ============================================================
*
* Separamos:
*
* 1. deuda contabilizada que ya está dentro de su ventana
*    de pago;
*
* 2. cargos pendientes, que todavía no forman parte del
*    saldo oficial pero ya representan dinero comprometido;
*
* 3. pagos pendientes, que todavía no han salido del banco
*    pero ya deben considerarse comprometidos.
*/

  const calendarioPago =
    calcularCalendarioPagoTarjeta(
      tarjeta.diaCorte,
      fechaReferencia,
    );

  const evaluacionPagoPrincipal =
    evaluarVentanaPagoTarjeta({
      calendario:
        calendarioPago,

      montoPagoTotal,

      activa:
        tarjeta.activa,
    });

  const evaluacionPagoAdicional =
    evaluarVentanaPagoTarjeta({
      calendario:
        calendarioPago,

      montoPagoTotal:
        actividadPosterior
          .saldoAdicionalAntesCorte,

      activa:
        tarjeta.activa,
    });

  /**
   * Parte CONTABILIZADA de la deuda que ya requiere
   * reserva bancaria según la ventana de pago.
   */
  let montoReservaContabilizada =
    0;

  /**
   * El pago principal todavía está pendiente.
   */
  if (
    !cobertura.corteCubierto &&
    evaluacionPagoPrincipal
      .requiereAccion &&
    montoPagoTotal >
    TOLERANCIA_SALDO
  ) {
    montoReservaContabilizada =
      montoPagoTotal;
  }

  /**
   * El pago principal ya fue cubierto, pero aparecieron
   * nuevos cargos contabilizados que también necesitan
   * pagarse antes del corte.
   */
  if (
    cobertura.corteCubierto &&
    actividadPosterior
      .requierePagoAdicionalAntesCorte &&
    evaluacionPagoAdicional
      .requiereAccion &&
    actividadPosterior
      .saldoAdicionalAntesCorte >
    TOLERANCIA_SALDO
  ) {
    montoReservaContabilizada =
      actividadPosterior
        .saldoAdicionalAntesCorte;
  }

  montoReservaContabilizada =
    redondearMoneda(
      Math.max(
        montoReservaContabilizada,
        0,
      ),
    );

  /**
   * ============================================================
   * 2B.2B — RESERVA INCLUYENDO TRANSACCIONES PENDIENTES
   * ============================================================
   *
   * Los cargos pendientes aumentan el dinero comprometido.
   *
   * Los pagos pendientes representan dinero que todavía
   * aparece en el banco, pero que ya está en proceso de salir.
   *
   * Usamos Math.max para evitar contar dos veces un pago
   * pendiente que precisamente está cubriendo la deuda
   * de la tarjeta.
   *
   * Ejemplo:
   *
   * deuda exigible              $486.45
   * pago pendiente              $486.45
   *
   * reserva real                $486.45
   *
   * NO $972.90.
   */
  const montoReservarCuenta =
    redondearMoneda(
      Math.max(
        montoReservaContabilizada +
        totalCargosPendientes,

        pagosPendientes,

        0,
      ),
    );

  return {
    tarjeta,

    comprasDesdeSaldo,
    cargosFijosDesdeSaldo,
    pagosDesdeSaldo,

    comprasPendientes,
    pagosPendientes,
    totalCargosPendientes,
    saldoProyectado,

    saldoActual,
    creditoAFavor,
    montoPagoTotal,
    montoReservarCuenta,
    creditoDisponible,
    porcentajeUtilizado,

    saldoAlInicioVentana:
      cobertura
        .saldoAlInicioVentana,

    montoObjetivoVentana:
      cobertura
        .montoObjetivoVentana,

    corteCubierto:
      cobertura
        .corteCubierto,

    pagoPrincipalCorteRealizado:
      cobertura
        .pagoPrincipalCorteRealizado,

    pagoPrincipalCorte:
      cobertura
        .pagoPrincipalCorte,

    comprasPosterioresCobertura:
      actividadPosterior
        .comprasPosterioresCobertura,

    pagosPosterioresCobertura:
      actividadPosterior
        .pagosPosterioresCobertura,

    saldoAdicionalAntesCorte:
      actividadPosterior
        .saldoAdicionalAntesCorte,

    requierePagoAdicionalAntesCorte:
      actividadPosterior
        .requierePagoAdicionalAntesCorte,
  };
}
