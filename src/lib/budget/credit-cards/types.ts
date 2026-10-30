// Contratos de movimientos, cobertura del corte y resúmenes de tarjetas.
import type { GastoVariable, PagoFijo, PagoTarjeta, TarjetaCredito } from "@/lib/budget/types";

/**
 * Información del pago que consiguió cubrir
 * completamente la obligación principal.
 */
export interface PagoPrincipalCorteDetectado {
  pagoId:
  string;

  fecha:
  string;

  creadoEn:
  string;

  montoPago:
  number;

  saldoAntesPago:
  number;

  saldoDespuesPago:
  number;
}

/**
 * Resultado interno de 1C.2F.
 */
export interface CoberturaCorteTarjeta {
  saldoAlInicioVentana:
  number | null;

  montoObjetivoVentana:
  number | null;

  corteCubierto:
  boolean;

  pagoPrincipalCorteRealizado:
  boolean;

  pagoPrincipalCorte:
  PagoPrincipalCorteDetectado | null;
}

/**
 * Resultado interno de 1C.2G.
 */
export interface ActividadPosteriorCobertura {
  /**
   * Compras realizadas después de quedar cubierta
   * la obligación principal.
   */
  comprasPosterioresCobertura:
  number;

  /**
   * Pagos realizados después de quedar cubierta
   * la obligación principal.
   */
  pagosPosterioresCobertura:
  number;

  /**
   * Deuda adicional neta pendiente antes del corte.
   *
   * Este será el monto de:
   *
   * "PAGO ADICIONAL"
   */
  saldoAdicionalAntesCorte:
  number;

  /**
   * true cuando queda una deuda posterior positiva.
   */
  requierePagoAdicionalAntesCorte:
  boolean;
}

/**
 * Resumen financiero público.
 */
export interface ResumenTarjetaActual {
  tarjeta:
  TarjetaCredito;

  comprasDesdeSaldo:
  number;

  /**
* 2B.2
*
* Gastos fijos registrados directamente contra
* esta tarjeta desde su saldo inicial.
*/
  cargosFijosDesdeSaldo:
  number;

  pagosDesdeSaldo:
  number;

  /**
 * ============================================================
 * 2B.2B — TRANSACCIONES PENDIENTES
 * ============================================================
 *
 * Estos movimientos todavía no forman parte del saldo
 * contabilizado de la tarjeta.
 */
  comprasPendientes:
  number;

  pagosPendientes:
  number;

  /**
   * Total de cargos pendientes de tarjeta.
   *
   * Los pagos fijos no forman parte de este valor porque
   * se contabilizan inmediatamente al registrarse.
   */
  totalCargosPendientes:
  number;

  /**
   * Saldo esperado cuando todas las transacciones
   * pendientes sean contabilizadas.
   */
  saldoProyectado:
  number;

  saldoActual:
  number;

  creditoAFavor:
  number;

  montoPagoTotal:
  number;

  /**
  * 2B.2A
  *
  * Deuda positiva actual de la tarjeta que debe formar
  * parte del dinero comprometido de la Cuenta de gastos.
  *
  * No reduce el Saldo actual hasta que se registre
  * un pago real a la tarjeta.
  */
  montoReservarCuenta:
  number;

  creditoDisponible:
  number | null;

  porcentajeUtilizado:
  number | null;

  /**
   * ============================================================
   * 1C.2F
   * ============================================================
   */

  saldoAlInicioVentana:
  number | null;

  montoObjetivoVentana:
  number | null;

  corteCubierto:
  boolean;

  pagoPrincipalCorteRealizado:
  boolean;

  pagoPrincipalCorte:
  PagoPrincipalCorteDetectado | null;

  /**
   * ============================================================
   * 1C.2G
   * ============================================================
   */

  comprasPosterioresCobertura:
  number;

  pagosPosterioresCobertura:
  number;

  saldoAdicionalAntesCorte:
  number;

  requierePagoAdicionalAntesCorte:
  boolean;
}

export interface UseCreditCardSummariesParams {
  tarjetas:
  TarjetaCredito[];

  gastos:
  GastoVariable[];

  /**
   * 2B.2
   *
   * Pagos de compromisos fijos. Los que tengan
   * metodo === "tarjeta" se comportan como cargos
   * sobre la tarjeta indicada.
   */
  pagosFijos:
  PagoFijo[];

  pagos:
  PagoTarjeta[];
}

/**
 * Movimiento financiero interno ordenable.
 */
export interface MovimientoCronologicoTarjeta {
  id:
  string;

  tipo:
  "gasto" | "pago";

  monto:
  number;

  fecha:
  string;

  creadoEn:
  string;
}
