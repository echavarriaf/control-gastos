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
} from "@/lib/budget/types";

export const EXPENSE_ACCOUNT_ID =
  "cuenta-gastos";

export const EXPENSE_ACCOUNT_DEFAULT_NAME =
  "Cuenta de gastos";

export type TipoMovimientoCuenta =
  | "saldo_inicial"
  | "deposito"
  | "gasto_variable"
  | "pago_fijo"
  | "pago_tarjeta";

export type DireccionMovimientoCuenta =
  | "base"
  | "entrada"
  | "salida";

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
}

export interface GuardarCuentaGastosInput {
  nombre: string;

  saldoInicial: number;

  fechaSaldoInicial: string;

  activa: boolean;
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

  /**
   * Dinero reservado para compromisos fijos activos
   * del mes actual que todavía no están completos.
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
      (compromiso) =>
        compromiso.activo,
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

  fechaReferencia =
    new Date(),
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
        totalDepositosDesdeSaldoInicial -
        totalEgresos,
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

  const reservasCompromisos =
    construirReservasCompromisos(
      compromisosFijos,
      pagosFijos,
      periodoReserva,
    );

  const totalComprometido =
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

    totalEgresosVariables,

    totalEgresosFijos,

    totalEgresosTarjetas,

    totalEgresos,

    saldoActual,

    totalComprometido,

    disponibleReal,

    faltanteReal,

    cantidadDepositos:
      depositos.length,

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

    reservasCompromisos,

    movimientos,
  };
}