// Contratos de cuenta bancaria, movimientos, reservas y resumen financiero.
import type { CompromisoFijo, GastoVariable, Ingreso, PagoFijo, PagoTarjeta } from "@/lib/budget/types";

export type TipoMovimientoCuenta =
  | "saldo_inicial"
  | "deposito"
  | "movimiento_manual"
  | "gasto_variable"
  | "pago_fijo"
  | "pago_tarjeta";

export type DireccionMovimientoCuenta =
  | "base"
  | "entrada"
  | "salida";

export type DireccionMovimientoManualCuenta =
  Exclude<
    DireccionMovimientoCuenta,
    "base"
  >;

export interface GuardarMovimientoManualCuentaInput {
  direccion:
  DireccionMovimientoManualCuenta;

  concepto: string;

  monto: number;

  fecha: string;

  notas: string;
}

export interface MovimientoManualCuenta
  extends GuardarMovimientoManualCuentaInput {
  id: string;

  creadoEn?: string;

  actualizadoEn?: string;
}

export interface MovimientoCuentaGastos {
  id: string;

  tipo:
  TipoMovimientoCuenta;

  direccion:
  DireccionMovimientoCuenta;

  fecha: string;

  concepto: string;

  detalle: string;

  monto: number;

  saldoDespues: number;
}

export type EstadoReservaCompromiso =
  | "pendiente"
  | "parcial";

export interface ReservaCompromisoCuenta {
  id: string;

  descripcion: string;

  montoCompromiso: number;

  montoPagadoRegistrado: number;

  montoPendienteRegistrado: number;

  /**
   * Por la regla actual de la Cuenta de gastos,
   * mientras el compromiso no esté completo se
   * mantiene reservado el monto completo.
   */
  montoReservado: number;

  diaVencimiento: number;

  prioridad: number;

  estado:
  EstadoReservaCompromiso;
}

export interface CuentaGastos {
  id: string;

  nombre: string;

  saldoInicial: number;

  fechaSaldoInicial: string;

  activa: boolean;

  ingresosIncluidosEnSaldoInicial:
  string[];

  gastosIncluidosEnSaldoInicial:
  string[];

  pagosFijosIncluidosEnSaldoInicial:
  string[];

  pagosTarjetaIncluidosEnSaldoInicial:
  string[];

  movimientosManualesIncluidosEnSaldoInicial?:
  string[];
}

export interface GuardarCuentaGastosInput {
  nombre: string;

  saldoInicial: number;

  fechaSaldoInicial: string;

  activa: boolean;
}

/**
 * 2B.2
 *
 * Saldo pendiente de una tarjeta que debe reservarse
 * dentro de la Cuenta de gastos.
 */
export interface SaldoTarjetaCuenta {
  tarjetaId:
  string;

  /**
   * Cantidad que realmente requiere reserva bancaria
   * según la ventana de pago de la tarjeta.
   */
  montoReservarCuenta:
  number;
}

export interface ResumenCuentaGastos {
  saldoInicial: number;

  totalDepositosDesdeSaldoInicial:
  number;

  totalEgresosVariables:
  number;

  totalEgresosFijos:
  number;

  totalEgresosTarjetas:
  number;

  totalEgresos:
  number;

  saldoActual: number;

  totalSalidasManuales:number;

  /**
 * 2B.2
 *
 * Reservas de compromisos fijos todavía pendientes.
 */
  totalReservasFijas:
  number;

  /**
   * Deuda positiva actualmente pendiente en tarjetas.
   */
  totalDeudaTarjetas:
  number;

  /**
   * Parte de la deuda de tarjetas que ya está representada
   * dentro de una reserva fija parcial.
   *
   * Se resta para evitar doble conteo.
   */
  totalSolapamientoTarjetas:
  number;

  /**
   * Total realmente comprometido:
   *
   * reservas fijas
   * + deuda tarjetas
   * - solapamiento
   */
  totalComprometido:
  number;

  /**
   * Dinero realmente libre después de separar
   * los compromisos pendientes.
   *
   * Puede ser negativo para mostrar un déficit real.
   */
  disponibleReal:
  number;

  faltanteReal:
  number;

  cantidadDepositos:
  number;

  cantidadMovimientosManuales:
  number;

  totalEntradasManuales:number;

  cantidadEgresosVariables:
  number;

  cantidadCompromisosFijosCompletos:
  number;

  cantidadPagosTarjeta:
  number;

  cantidadCompromisosReservados:
  number;

  periodoReserva:
  string;

  depositos:
  Ingreso[];

  egresosVariables:
  GastoVariable[];

  egresosFijos:
  PagoFijo[];

  egresosTarjetas:
  PagoTarjeta[];

  movimientosManuales:
  MovimientoManualCuenta[];

  reservasCompromisos:
  ReservaCompromisoCuenta[];

  movimientos:
  MovimientoCuentaGastos[];
}

export interface GrupoPagoFijo {
  key: string;

  compromiso:
  CompromisoFijo;

  periodo: string;

  pagos:
  PagoFijo[];

  totalPagado:
  number;

  completo:
  boolean;
}

export interface MovimientoPendienteSaldo {
  id: string;

  tipo:
  Exclude<
    TipoMovimientoCuenta,
    "saldo_inicial"
  >;

  direccion:
  "entrada" | "salida";

  fecha: string;

  concepto: string;

  detalle: string;

  monto: number;

  orden: number;

  creadoEn?: string;
}
