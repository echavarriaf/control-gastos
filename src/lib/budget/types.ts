export type CategoriaVariable = "comida" | "gas";

export type CategoriaPago = CategoriaVariable | "general";

export type TipoMovimiento = "gasto" | "pago";

export type Vista = "fijos" | "movimientos";

export type Quincena = 1 | 2;

export type PeriodicidadPagoFijo = "mensual" | "quincenal";

export type MetodoPagoFijo =
  | "debito_automatico"
  | "transferencia"
  | "tarjeta"
  | "efectivo"
  | "otro";

export interface LimiteCategoria {
  mensual: number;
  quincenal: number;
}

export type LimitesVariables = Record<
  CategoriaVariable,
  LimiteCategoria
>;

export interface GastoVariable {
  id: string;
  concepto: string;
  monto: number;
  categoria: CategoriaVariable;
  fecha: string;
}

export interface PagoTarjeta {
  id: string;
  concepto: string;
  monto: number;
  categoria: CategoriaPago;
  fecha: string;
}

export interface CompromisoFijo {
  id: string;
  descripcion: string;
  monto: number;
}

export interface PagoFijo {
  id: string;
  compromisoId: string;
  descripcion: string;
  monto: number;
  fecha: string;
  metodo: MetodoPagoFijo;
  periodicidad: PeriodicidadPagoFijo;
  referencia: string;
  notas: string;
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
}

export interface NuevoPagoTarjeta {
  tipo: "pago";
  concepto: string;
  monto: number;
  categoria: CategoriaPago;
  fecha: string;
}

export type NuevoMovimiento =
  | NuevoGastoVariable
  | NuevoPagoTarjeta;

export interface NuevoPagoFijo {
  compromiso: CompromisoFijo;
  monto: number;
  fecha: string;
  metodo: MetodoPagoFijo;
  periodicidad: PeriodicidadPagoFijo;
  referencia: string;
  notas: string;
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
  compromiso: CompromisoFijo;
  registrosMes: PagoFijo[];

  pagadoMes: number;
  pagadoQuincena: number;
  pendienteMes: number;
  porcentajePagado: number;

  ultimoPago: PagoFijo | null;
  estado: EstadoPagoFijo;
}