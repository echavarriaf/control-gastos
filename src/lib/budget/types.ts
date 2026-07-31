/**
 * Tipos base del presupuesto.
 *
 * IMPORTANTE:
 * El control principal de ingresos usa ciclos de pago,
 * no quincenas del calendario. Un ciclo puede empezar en
 * cualquier fecha y termina justo antes del próximo pago.
 *
 * `Quincena` se conserva temporalmente porque la interfaz
 * actual todavía la utiliza para algunos resúmenes.
 */

export type CategoriaVariable =
  | "comida"
  | "gas";

export type CategoriaPago =
  | CategoriaVariable
  | "general";

export type TipoMovimiento =
  | "gasto"
  | "pago";

export type Vista =
  | "fijos"
  | "movimientos";

/**
 * Tipo legado para la interfaz actual.
 * No debe utilizarse para modelar ingresos cada 14 días.
 */
export type Quincena =
  | 1
  | 2;

export type PeriodicidadPagoFijo =
  | "mensual"
  | "quincenal";

export type MetodoPagoFijo =
  | "debito_automatico"
  | "transferencia"
  | "tarjeta"
  | "efectivo"
  | "otro";

export type MetodoPagoMovimiento =
  | "efectivo"
  | "debito"
  | "cuenta_bancaria"
  | "tarjeta_credito";

export type PrioridadPago =
  | 1
  | 2
  | 3
  | 4;

export type FuenteIngreso =
  | "salario"
  | "bono"
  | "horas_extra"
  | "reembolso"
  | "otro";

export type EstadoIngreso =
  | "proyectado"
  | "recibido"
  | "cancelado";

export type FrecuenciaIngreso =
  | "semanal"
  | "cada_2_semanas"
  | "dos_veces_mes"
  | "mensual"
  | "variable";

export type EstadoCicloPago =
  | "proyectado"
  | "abierto"
  | "cerrado"
  | "cancelado";

export type EstrategiaPagoTarjeta =
  | "saldo_completo"
  | "pago_objetivo"
  | "pago_minimo";

export type EstadoObligacion =
  | "pendiente"
  | "parcial"
  | "pagada"
  | "vencida";

export type TipoObligacionFlujo =
  | "gasto_fijo"
  | "tarjeta"
  | "variable_esencial"
  | "opcional";

export interface LimiteCategoria {
  mensual: number;

  /**
   * Campo utilizado por la interfaz actual.
   */
  quincenal: number;

  /**
   * Reemplazará gradualmente a `quincenal`.
   * Representa el límite por ciclo real de pago.
   */
  porCicloPago?: number;
}

export type LimitesVariables =
  Record<
    CategoriaVariable,
    LimiteCategoria
  >;

/**
 * Regla recurrente con la que se proyectan los pagos.
 *
 * Para el caso actual:
 * frecuencia = "cada_2_semanas"
 * intervaloDias = 14
 * fechaAncla = una fecha real conocida de pago.
 */
export interface ConfiguracionIngreso {
  id: string;
  descripcion: string;

  montoEstimado: number;
  fuente: FuenteIngreso;

  frecuencia:
    FrecuenciaIngreso;

  fechaAncla: string;
  intervaloDias:
    number | null;

  activa: boolean;
  notas: string;
}

export interface NuevaConfiguracionIngreso {
  descripcion: string;

  montoEstimado: number;
  fuente: FuenteIngreso;

  frecuencia:
    FrecuenciaIngreso;

  fechaAncla: string;
  intervaloDias:
    number | null;

  activa: boolean;
  notas: string;
}

/**
 * Período entre un pago y el siguiente.
 *
 * Ejemplo:
 * pago actual: 7 de agosto
 * siguiente pago: 21 de agosto
 * cobertura: 7 de agosto al 20 de agosto
 */
export interface CicloPago {
  id: string;

  configuracionIngresoId:
    string | null;

  fechaPagoProgramada: string;
  fechaPagoReal: string | null;
  fechaSiguientePago: string;

  inicioCobertura: string;
  finCobertura: string;

  /**
   * Solo se usa para agrupar y mostrar información.
   * No determina el ciclo de pago.
   */
  periodoCalendario: string;

  /**
   * Puede ser 1, 2 o 3 dentro de un mes.
   */
  numeroPagoMes: number;

  /**
   * Normalmente será 1–26 para pagos cada dos semanas.
   */
  numeroPagoAnual: number;

  estado:
    EstadoCicloPago;
}

/**
 * Ingreso real o proyectado asociado a un ciclo.
 *
 * No contiene `quincena`, porque un mes puede tener
 * dos o tres pagos.
 */
export interface Ingreso {
  id: string;

  configuracionIngresoId:
    string | null;

  cicloPagoId: string;

  descripcion: string;
  monto: number;

  fechaProgramada: string;
  fechaRecibida: string | null;

  periodoCalendario: string;
  numeroPagoMes: number;
  numeroPagoAnual: number;

  fuente: FuenteIngreso;
  estado: EstadoIngreso;

  recurrente: boolean;
  notas: string;
}

export interface NuevoIngreso {
  configuracionIngresoId?:
    string | null;

  cicloPagoId: string;

  descripcion: string;
  monto: number;

  fechaProgramada: string;
  fechaRecibida?:
    string | null;

  fuente: FuenteIngreso;
  estado: EstadoIngreso;

  recurrente: boolean;
  notas: string;
}

export interface TarjetaCredito {
  id: string;
  nombre: string;
  ultimosCuatro: string;

  diaCorte: number;
  diaPago: number;

  activa: boolean;

  estrategiaPago:
    EstrategiaPagoTarjeta;

  pagoObjetivo: number | null;
  limiteCredito: number | null;

  notas: string;
}

export interface NuevaTarjetaCredito {
  nombre: string;
  ultimosCuatro: string;

  diaCorte: number;
  diaPago: number;

  activa: boolean;

  estrategiaPago:
    EstrategiaPagoTarjeta;

  pagoObjetivo: number | null;
  limiteCredito: number | null;

  notas: string;
}

export interface GastoVariable {
  id: string;
  concepto: string;
  monto: number;
  categoria: CategoriaVariable;
  fecha: string;

  metodoPago?:
    MetodoPagoMovimiento;

  tarjetaId?:
    string | null;

  periodoEstadoCuenta?:
    string | null;

  fechaCorteEstimada?:
    string | null;

  fechaPagoEstimada?:
    string | null;
}

/**
 * Pago real realizado a una tarjeta.
 *
 * Reduce el efectivo disponible, pero no vuelve a
 * descontar el presupuesto de la categoría.
 */
export interface PagoTarjeta {
  id: string;
  concepto: string;
  monto: number;
  categoria: CategoriaPago;
  fecha: string;

  tarjetaId?:
    string | null;

  cicloPagoId?:
    string | null;

  ingresoId?:
    string | null;

  referencia?:
    string;

  notas?:
    string;
}

export interface CompromisoFijo {
  id: string;
  descripcion: string;
  monto: number;

  diaVencimiento?:
    number;

  prioridad?:
    PrioridadPago;

  metodoPagoPreferido?:
    MetodoPagoFijo;

  tarjetaId?:
    string | null;

  activo?:
    boolean;
}

export interface PagoFijo {
  id: string;
  compromisoId: string;
  descripcion: string;
  monto: number;
  fecha: string;
  metodo: MetodoPagoFijo;
  periodicidad:
    PeriodicidadPagoFijo;
  referencia: string;
  notas: string;

  cicloPagoId?:
    string | null;

  ingresoId?:
    string | null;

  tarjetaId?:
    string | null;
}

export type Movimiento =
  | ({
      tipo: "gasto";
    } & GastoVariable)
  | ({
      tipo: "pago";
    } & PagoTarjeta);

export interface NuevoGastoVariable {
  tipo: "gasto";
  concepto: string;
  monto: number;
  categoria: CategoriaVariable;
  fecha: string;

  metodoPago?:
    MetodoPagoMovimiento;

  tarjetaId?:
    string | null;
}

export interface NuevoPagoTarjeta {
  tipo: "pago";
  concepto: string;
  monto: number;
  categoria: CategoriaPago;
  fecha: string;

  tarjetaId?:
    string | null;

  cicloPagoId?:
    string | null;

  ingresoId?:
    string | null;

  referencia?:
    string;

  notas?:
    string;
}

export type NuevoMovimiento =
  | NuevoGastoVariable
  | NuevoPagoTarjeta;

export interface NuevoPagoFijo {
  compromiso:
    CompromisoFijo;

  monto: number;
  fecha: string;
  metodo: MetodoPagoFijo;

  periodicidad:
    PeriodicidadPagoFijo;

  referencia: string;
  notas: string;

  cicloPagoId?:
    string | null;

  ingresoId?:
    string | null;

  tarjetaId?:
    string | null;
}

export interface ResumenCategoria {
  key: CategoriaVariable;

  saldoMes: number;
  disponibleMes: number;
  porcentajeMes: number;

  saldoQuincena: number;
  disponibleQuincena: number;
  porcentajeQuincena: number;
}

export type EstadoPagoFijo =
  | "pagado"
  | "parcial"
  | "pendiente";

export interface ResumenFijo {
  compromiso:
    CompromisoFijo;

  registrosMes:
    PagoFijo[];

  pagadoMes: number;
  pagadoQuincena: number;
  pendienteMes: number;
  porcentajePagado: number;

  ultimoPago:
    PagoFijo | null;

  estado:
    EstadoPagoFijo;
}

export interface CicloTarjeta {
  tarjetaId: string;

  inicioCiclo: string;
  fechaCorte: string;
  fechaPago: string;

  periodoEstadoCuenta: string;
}

export interface ResumenTarjeta {
  tarjeta:
    TarjetaCredito;

  ciclo:
    CicloTarjeta;

  saldoAlCorte: number;
  comprasPosterioresAlCorte: number;

  pagosAplicados: number;
  pagoMinimo: number;
  pagoRecomendado: number;
  saldoPendiente: number;
}

/**
 * Obligación asignada al ciclo cuyo ingreso debe
 * financiarla.
 */
export interface ObligacionFlujo {
  id: string;
  origenId: string;

  cicloPagoId: string;

  tipo:
    TipoObligacionFlujo;

  descripcion: string;
  prioridad:
    PrioridadPago;

  montoProgramado: number;
  montoReservado: number;
  montoPagado: number;
  montoPendiente: number;

  fechaVencimiento: string;

  estado:
    EstadoObligacion;

  tarjetaId:
    string | null;
}

/**
 * Consolidado de un ciclo de pago real.
 */
export interface ResumenFlujoCicloPago {
  ciclo:
    CicloPago;

  ingresosProgramados: number;
  ingresosRecibidos: number;

  gastosFijosReservados: number;
  tarjetasReservadas: number;
  variablesPagadasEnEfectivo: number;

  totalReservado: number;
  totalPagado: number;

  disponibleProyectado: number;
  disponibleReal: number;

  deficitProyectado: number;
  deficitReal: number;

  obligaciones:
    ObligacionFlujo[];
}

/**
 * Alias temporal para evitar romper imports futuros
 * mientras se elimina el término "quincenal".
 */
export type ResumenFlujoQuincenal =
  ResumenFlujoCicloPago;