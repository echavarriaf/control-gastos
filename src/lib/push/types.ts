// Contratos de datos de presupuesto, tarjetas y entrega de notificaciones.

export const CATEGORY_KEYS = [
  "comida",
  "gas",
] as const;

export type CategoriaVariable =
  (typeof CATEGORY_KEYS)[number];

type Quincena =
  1 | 2;

type AlcanceAlerta =
  | "mensual"
  | "quincenal";

export type NivelAlerta =
  | "normal"
  | "90"
  | "100";

type TipoAlertaTarjeta =
  | "principal"
  | "adicional";

export type EstadoVentanaTarjeta =
  | "pagar_ahora"
  | "corte_hoy";

export interface LimiteCategoria {
  mensual:
    number;

  quincenal:
    number;
}

export interface LimitesVariables {
  comida:
    LimiteCategoria;

  gas:
    LimiteCategoria;
}

export interface PeriodInfo {
  periodo:
    string;

  quincena:
    Quincena;
}

export interface MovimientoPresupuestoNormalizado {
  monto:
    number;

  categoria:
    CategoriaVariable | null;

  periodo:
    string;

  quincena:
    Quincena;
}

export interface DatosPeriodo {
  gastos:
    MovimientoPresupuestoNormalizado[];
}

interface AlertaBase {
  alertKey:
    string;

  attemptId:
    string;
}

export interface AlertaPresupuestoPendiente
  extends AlertaBase {
  tipo:
    "presupuesto";

  categoria:
    CategoriaVariable;

  alcance:
    AlcanceAlerta;

  quincena:
    Quincena | null;

  nivel:
    Exclude<
      NivelAlerta,
      "normal"
    >;

  porcentaje:
    number;

  saldo:
    number;

  limite:
    number;
}

export interface AlertaTarjetaPendiente
  extends AlertaBase {
  tipo:
    "tarjeta";

  tarjetaId:
    string;

  tarjetaNombre:
    string;

  ultimosCuatro:
    string;

  clase:
    TipoAlertaTarjeta;

  estadoVentana:
    EstadoVentanaTarjeta;

  monto:
    number;

  fechaCorteISO:
    string;

  fechaObjetivoPagoISO:
    string;
}

export type AlertaPendiente =
  | AlertaPresupuestoPendiente
  | AlertaTarjetaPendiente;

export interface ResultadoEnvio {
  enviados:
    number;

  fallidos:
    number;

  dispositivos:
    number;
}

export interface TarjetaPush {
  id:
    string;

  nombre:
    string;

  ultimosCuatro:
    string;

  saldoInicial:
    number;

  fechaSaldoInicial:
    string;

  diaCorte:
    number;

  activa:
    boolean;
}

export interface MovimientoTarjetaPush {
  id:
    string;

  tipo:
    | "gasto"
    | "pago";

  monto:
    number;

  fecha:
    string;

  creadoEn:
    string;

  tarjetaId:
    string;
}

export interface DatosTarjetasPush {
  tarjetas:
    TarjetaPush[];

  movimientos:
    MovimientoTarjetaPush[];
}

export interface CalendarioTarjetaPush {
  fechaCorteISO:
    string;

  fechaObjetivoPagoISO:
    string;

  diasHastaCorte:
    number;

  diasHastaPagoObjetivo:
    number;
}

export interface PagoPrincipalDetectadoPush {
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

export interface CoberturaPrincipalPush {
  corteCubierto:
    boolean;

  pagoPrincipal:
    PagoPrincipalDetectadoPush | null;
}

export interface EstadoPagoTarjetaPush {
  calendario:
    CalendarioTarjetaPush;

  saldoActual:
    number;

  corteCubierto:
    boolean;

  montoPrincipal:
    number;

  montoAdicional:
    number;

  requierePrincipal:
    boolean;

  requiereAdicional:
    boolean;

  estadoVentana:
    EstadoVentanaTarjeta | null;
}

export interface EvaluacionAlertasUsuarioResultado {
  uid:
    string;

  periodo:
    string;

  quincena:
    Quincena;

  evaluadas:
    number;

  evaluadasPresupuesto:
    number;

  evaluadasTarjetas:
    number;

  alertas:
    number;

  alertasPresupuesto:
    number;

  alertasTarjetas:
    number;

  enviadas:
    number;

  fallidas:
    number;

  dispositivos:
    number;

  mensaje?:
    string;
}

/**
 * ============================================================
 * ALERTAS DE PRESUPUESTO
 * ============================================================
 */

export interface PrepararAlertasPresupuestoArgs {
  uid:
    string;

  periodo:
    string;

  quincena:
    Quincena;

  limites:
    LimitesVariables;

  datos:
    DatosPeriodo;
}

export interface ReclamarAlertaPresupuestoArgs {
  uid:
    string;

  categoria:
    CategoriaVariable;

  periodo:
    string;

  alcance:
    AlcanceAlerta;

  quincena:
    Quincena | null;

  saldo:
    number;

  limite:
    number;
}

/**
 * ============================================================
 * ALERTAS DE TARJETAS
 * ============================================================
 */

export interface PrepararAlertasTarjetasArgs {
  uid:
    string;

  ahora:
    Date;

  datos:
    DatosTarjetasPush;
}

export interface CalcularEstadoPagoTarjetaArgs {
  tarjeta:
    TarjetaPush;

  movimientos:
    MovimientoTarjetaPush[];

  hoyISO:
    string;
}

export interface EvaluarCoberturaPrincipalArgs {
  tarjeta:
    TarjetaPush;

  movimientos:
    MovimientoTarjetaPush[];

  hoyISO:
    string;

  calendario:
    CalendarioTarjetaPush;
}

export interface CalcularSaldoAdicionalArgs {
  movimientos:
    MovimientoTarjetaPush[];

  hoyISO:
    string;

  calendario:
    CalendarioTarjetaPush;

  cobertura:
    CoberturaPrincipalPush;
}

export interface ReclamarAlertaTarjetaArgs {
  uid:
    string;

  tarjeta:
    TarjetaPush;

  clase:
    TipoAlertaTarjeta;

  activa:
    boolean;

  monto:
    number;

  calendario:
    CalendarioTarjetaPush;

  estadoVentana:
    EstadoVentanaTarjeta | null;
}
