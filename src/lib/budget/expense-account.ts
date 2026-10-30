/*
 * Nombre: Dominio de la cuenta de gastos
 * Ruta: src/lib/budget/expense-account.ts
 *
 * Descripción:
 * Define la estructura y los cálculos de la cuenta bancaria
 * operativa donde llegan los depósitos y desde la que salen
 * los pagos reales.
 *
 * El saldo inicial representa una fotografía real de la cuenta
 * en una fecha determinada.
 *
 * También calcula:
 *
 * - saldo actual;
 * - movimientos bancarios;
 * - historial/ledger;
 * - dinero comprometido;
 * - disponible real.
 */

import type {
  CompromisoFijo,
  GastoVariable,
  Ingreso,
  PagoFijo,
  PagoTarjeta,
  Quincena
} from "@/lib/budget/types";

export const EXPENSE_ACCOUNT_ID =
  "cuenta-gastos";

export const EXPENSE_ACCOUNT_DEFAULT_NAME =
  "Cuenta de gastos";

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

interface GrupoPagoFijo {
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

interface MovimientoPendienteSaldo {
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

const SALDO_MINIMO =
  -1_000_000;

const SALDO_MAXIMO =
  1_000_000;

const TOLERANCIA_MONEDA =
  0.005;

function esObjeto(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
    "object" &&
    value !== null
  );
}

function esFechaCalendarioValida(
  value: unknown,
): value is string {
  if (
    typeof value !==
    "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }

  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  const fecha =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  return (
    fecha.getUTCFullYear() ===
    year &&
    fecha.getUTCMonth() + 1 ===
    month &&
    fecha.getUTCDate() ===
    day
  );
}

function normalizarSaldo(
  value: unknown,
): number | null {
  const numero =
    Number(value);

  if (
    !Number.isFinite(
      numero,
    ) ||
    numero <
    SALDO_MINIMO ||
    numero >
    SALDO_MAXIMO
  ) {
    return null;
  }

  return redondearMoneda(
    numero,
  );
}

function normalizarIds(
  value: unknown,
): string[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(
          (
            item,
          ): item is string =>
            typeof item ===
            "string" &&
            item
              .trim()
              .length >
            0,
        )
        .map(
          (item) =>
            item.trim(),
        ),
    ),
  ];
}

function redondearMoneda(
  value: number,
): number {
  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
      100,
    ) /
    100
  );
}

function obtenerFechaCalendario(
  value: string,
): string {
  return value
    .trim()
    .slice(
      0,
      10,
    );
}

function obtenerPeriodoCalendario(
  value: string,
): string {
  return obtenerFechaCalendario(
    value,
  ).slice(
    0,
    7,
  );
}

/**
 * Obtiene YYYY-MM usando el calendario local del dispositivo.
 *
 * El Disponible real siempre representa la situación actual
 * de la cuenta y no depende del mes seleccionado en el dashboard.
 */
function obtenerPeriodoLocal(
  fecha:
    Date,
): string {
  const year =
    fecha.getFullYear();

  const month =
    String(
      fecha.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}`;
}

/**
 * Obtiene la quincena calendario usada como fallback.
 *
 * Más adelante el componente puede suministrar explícitamente
 * la quincena financiera financiada por el ciclo de ingreso.
 */
function obtenerQuincenaLocal(
  fecha:
    Date,
): Quincena {
  return fecha.getDate() <=
    15
    ? 1
    : 2;
}

function obtenerFechaMasReciente(
  pagos:
    PagoFijo[],
): string {
  return pagos.reduce(
    (
      fechaMasReciente,
      pago,
    ) => {
      const fecha =
        obtenerFechaCalendario(
          pago.fecha,
        );

      if (
        !fechaMasReciente ||
        fecha >
        fechaMasReciente
      ) {
        return fecha;
      }

      return fechaMasReciente;
    },
    "",
  );
}

function etiquetaMetodoVariable(
  gasto:
    GastoVariable,
): string {
  if (
    gasto.metodoPago ===
    "cuenta_bancaria"
  ) {
    return "Cuenta bancaria";
  }

  return "Débito";
}

function etiquetaFuenteIngreso(
  ingreso:
    Ingreso,
): string {
  switch (
  ingreso.fuente
  ) {
    case "salario":
      return "Salario";

    case "bono":
      return "Bono";

    case "horas_extra":
      return "Horas extra";

    case "reembolso":
      return "Reembolso";

    default:
      return "Ingreso";
  }
}

export function gastoSaleDeCuenta(
  gasto:
    GastoVariable,
): boolean {
  return (
    gasto.metodoPago ===
    "debito" ||
    gasto.metodoPago ===
    "cuenta_bancaria"
  );
}

export function pagoFijoSaleDeCuenta(
  pago:
    PagoFijo,
): boolean {
  return (
    pago.metodo ===
    "debito_automatico" ||
    pago.metodo ===
    "transferencia"
  );
}

export function validarCuentaGastos(
  input: unknown,
): GuardarCuentaGastosInput {
  if (
    !esObjeto(
      input,
    )
  ) {
    throw new Error(
      "Los datos de la cuenta no son válidos.",
    );
  }

  const nombre =
    typeof input.nombre ===
      "string"
      ? input.nombre.trim()
      : "";

  if (
    !nombre ||
    nombre.length >
    100
  ) {
    throw new Error(
      "El nombre de la cuenta debe contener entre 1 y 100 caracteres.",
    );
  }

  const saldoInicial =
    normalizarSaldo(
      input.saldoInicial,
    );

  if (
    saldoInicial ===
    null
  ) {
    throw new Error(
      "El saldo inicial de la cuenta no es válido.",
    );
  }

  if (
    !esFechaCalendarioValida(
      input
        .fechaSaldoInicial,
    )
  ) {
    throw new Error(
      "Selecciona una fecha válida para el saldo inicial.",
    );
  }

  const activa =
    input.activa ===
      undefined
      ? true
      : input.activa;

  if (
    typeof activa !==
    "boolean"
  ) {
    throw new Error(
      "El estado de la cuenta no es válido.",
    );
  }

  return {
    nombre,

    saldoInicial,

    fechaSaldoInicial:
      input
        .fechaSaldoInicial,

    activa,
  };
}

export function validarMovimientoManualCuenta(
  input: unknown,
): GuardarMovimientoManualCuentaInput {
  if (
    !esObjeto(
      input,
    )
  ) {
    throw new Error(
      "Los datos del movimiento no son válidos.",
    );
  }

  const direccion =
    input.direccion;

  if (
    direccion !==
    "entrada" &&
    direccion !==
    "salida"
  ) {
    throw new Error(
      "Selecciona si el movimiento es una entrada o una salida.",
    );
  }

  const concepto =
    typeof input.concepto ===
      "string"
      ? input.concepto.trim()
      : "";

  if (
    !concepto ||
    concepto.length >
    120
  ) {
    throw new Error(
      "El concepto debe contener entre 1 y 120 caracteres.",
    );
  }

  const monto =
    normalizarSaldo(
      input.monto,
    );

  if (
    monto ===
    null ||
    monto <=
    0
  ) {
    throw new Error(
      "El monto del movimiento debe ser mayor que cero.",
    );
  }

  if (
    !esFechaCalendarioValida(
      input.fecha,
    )
  ) {
    throw new Error(
      "Selecciona una fecha válida para el movimiento.",
    );
  }

  const notas =
    typeof input.notas ===
      "string"
      ? input.notas.trim()
      : "";

  if (
    notas.length >
    500
  ) {
    throw new Error(
      "Las notas no pueden exceder 500 caracteres.",
    );
  }

  return {
    direccion,

    concepto,

    monto,

    fecha:
      input.fecha,

    notas,
  };
}

export function normalizarMovimientoManualCuenta(
  id: string,
  data: unknown,
): MovimientoManualCuenta | null {
  if (
    !id.trim() ||
    !esObjeto(
      data,
    )
  ) {
    return null;
  }

  try {
    const movimiento =
      validarMovimientoManualCuenta(
        data,
      );

    return {
      id:
        id.trim(),

      ...movimiento,

      creadoEn:
        typeof data.creadoEn ===
          "string"
          ? data.creadoEn
          : undefined,

      actualizadoEn:
        typeof data.actualizadoEn ===
          "string"
          ? data.actualizadoEn
          : undefined,
    };
  } catch {
    return null;
  }
}

export function normalizarCuentaGastos(
  data: unknown,
): CuentaGastos | null {
  if (
    !esObjeto(
      data,
    )
  ) {
    return null;
  }

  try {
    const normalizada =
      validarCuentaGastos(
        data,
      );

    return {
      id:
        EXPENSE_ACCOUNT_ID,

      ...normalizada,

      ingresosIncluidosEnSaldoInicial:
        normalizarIds(
          data
            .ingresosIncluidosEnSaldoInicial,
        ),

      gastosIncluidosEnSaldoInicial:
        normalizarIds(
          data
            .gastosIncluidosEnSaldoInicial,
        ),

      pagosFijosIncluidosEnSaldoInicial:
        normalizarIds(
          data
            .pagosFijosIncluidosEnSaldoInicial,
        ),

      pagosTarjetaIncluidosEnSaldoInicial:
        normalizarIds(
          data
            .pagosTarjetaIncluidosEnSaldoInicial,
        ),
      movimientosManualesIncluidosEnSaldoInicial:
        normalizarIds(
          data
            .movimientosManualesIncluidosEnSaldoInicial,
        ),
    };
  } catch {
    return null;
  }
}

function construirGruposPagosFijos(
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
function construirReservasCompromisos(
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
function calcularCompromisoTarjetas(
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

function construirLedger(
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