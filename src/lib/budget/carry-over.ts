import type {
  CategoriaVariable,
  LimitesVariables,
  Quincena,
  ResumenCategoria,
} from "@/lib/budget/types";

const CATEGORIA_KEYS: CategoriaVariable[] = [
  "comida",
  "gas",
];

export interface MovimientoCarryOver {
  categoria: CategoriaVariable;
  monto: number;
  periodo: string;
  quincena: Quincena;
}

export interface DetalleCarryOverQuincenal {
  limiteQuincenalBase: number;
  excedenteAnterior: number;
  limiteQuincenalEfectivo: number;
  saldoQuincena: number;
  consumoAjustadoQuincena: number;
  disponibleQuincena: number;
  excedenteSiguiente: number;
  porcentajeQuincena: number;
}

export type ResumenCategoriaConCarryOver =
  ResumenCategoria &
    DetalleCarryOverQuincenal;

interface CalcularCarryOverArgs {
  movimientos: MovimientoCarryOver[];
  limites: LimitesVariables;
  periodoObjetivo: string;
  quincenaObjetivo: Quincena;
}

type CarryOverPorCategoria = Record<
  CategoriaVariable,
  DetalleCarryOverQuincenal
>;

/**
 * Calcula el arrastre acumulado de cada categoría hasta una quincena.
 *
 * Reglas:
 * - el exceso de una quincena pasa a la siguiente;
 * - una quincena sin gasto también absorbe carry usando su límite base;
 * - el sobrante positivo no se acumula como crédito;
 * - Q1 -> Q2 del mismo mes;
 * - Q2 -> Q1 del mes siguiente.
 */
export function calcularCarryOverQuincenal({
  movimientos,
  limites,
  periodoObjetivo,
  quincenaObjetivo,
}: CalcularCarryOverArgs): CarryOverPorCategoria {
  const indiceObjetivo =
    obtenerIndiceQuincena(
      periodoObjetivo,
      quincenaObjetivo,
    );

  return Object.fromEntries(
    CATEGORIA_KEYS.map((categoria) => [
      categoria,
      calcularCategoria({
        categoria,
        limiteQuincenal:
          limites[categoria].quincenal,
        movimientos,
        indiceObjetivo,
      }),
    ]),
  ) as CarryOverPorCategoria;
}

interface CalcularCategoriaArgs {
  categoria: CategoriaVariable;
  limiteQuincenal: number;
  movimientos: MovimientoCarryOver[];
  indiceObjetivo: number;
}

function calcularCategoria({
  categoria,
  limiteQuincenal,
  movimientos,
  indiceObjetivo,
}: CalcularCategoriaArgs): DetalleCarryOverQuincenal {
  const limiteBase = Math.max(
    normalizarNumero(limiteQuincenal),
    0,
  );

  const montosPorQuincena =
    new Map<number, number>();

  let indiceInicial = indiceObjetivo;
  let tieneMovimientoAnterior = false;

  for (const movimiento of movimientos) {
    if (
      movimiento.categoria !== categoria ||
      !Number.isFinite(movimiento.monto) ||
      movimiento.monto < 0
    ) {
      continue;
    }

    const indiceMovimiento =
      obtenerIndiceQuincena(
        movimiento.periodo,
        movimiento.quincena,
      );

    if (indiceMovimiento > indiceObjetivo) {
      continue;
    }

    montosPorQuincena.set(
      indiceMovimiento,
      (montosPorQuincena.get(
        indiceMovimiento,
      ) ?? 0) + movimiento.monto,
    );

    if (
      !tieneMovimientoAnterior ||
      indiceMovimiento < indiceInicial
    ) {
      indiceInicial = indiceMovimiento;
      tieneMovimientoAnterior = true;
    }
  }

  let excedenteAnterior = 0;

  let resultado = crearDetalle({
    limiteBase,
    excedenteAnterior: 0,
    saldoQuincena:
      montosPorQuincena.get(
        indiceObjetivo,
      ) ?? 0,
  });

  for (
    let indice = indiceInicial;
    indice <= indiceObjetivo;
    indice += 1
  ) {
    const saldoQuincena =
      montosPorQuincena.get(
        indice,
      ) ?? 0;

    resultado = crearDetalle({
      limiteBase,
      excedenteAnterior,
      saldoQuincena,
    });

    excedenteAnterior =
      resultado.excedenteSiguiente;
  }

  return resultado;
}

interface CrearDetalleArgs {
  limiteBase: number;
  excedenteAnterior: number;
  saldoQuincena: number;
}

function crearDetalle({
  limiteBase,
  excedenteAnterior,
  saldoQuincena,
}: CrearDetalleArgs): DetalleCarryOverQuincenal {
  const carryEntrada = Math.max(
    normalizarNumero(
      excedenteAnterior,
    ),
    0,
  );

  const saldo = Math.max(
    normalizarNumero(
      saldoQuincena,
    ),
    0,
  );

  const consumoAjustadoQuincena =
    carryEntrada +
    saldo;

  const limiteQuincenalEfectivo =
    Math.max(
      limiteBase -
        carryEntrada,
      0,
    );

  const disponibleQuincena =
    Math.max(
      limiteBase -
        consumoAjustadoQuincena,
      0,
    );

  const excedenteSiguiente =
    Math.max(
      consumoAjustadoQuincena -
        limiteBase,
      0,
    );

  return {
    limiteQuincenalBase:
      limiteBase,

    excedenteAnterior:
      carryEntrada,

    limiteQuincenalEfectivo,

    saldoQuincena:
      saldo,

    consumoAjustadoQuincena,

    disponibleQuincena,

    excedenteSiguiente,

    porcentajeQuincena:
      calcularPorcentaje(
        consumoAjustadoQuincena,
        limiteBase,
      ),
  };
}

function obtenerIndiceQuincena(
  periodo: string,
  quincena: Quincena,
): number {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      periodo,
    );

  if (!match) {
    throw new Error(
      `Periodo inválido para carry-over: ${periodo}`,
    );
  }

  const year =
    Number(
      match[1],
    );

  const month =
    Number(
      match[2],
    );

  if (
    !Number.isInteger(
      year,
    ) ||
    !Number.isInteger(
      month,
    ) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      `Periodo inválido para carry-over: ${periodo}`,
    );
  }

  const indiceMes =
    year * 12 +
    (month - 1);

  return (
    indiceMes * 2 +
    (
      quincena === 2
        ? 1
        : 0
    )
  );
}

function calcularPorcentaje(
  value: number,
  limit: number,
): number {
  if (limit <= 0) {
    return value > 0
      ? 100
      : 0;
  }

  return (
    value /
    limit
  ) * 100;
}

function normalizarNumero(
  value: number,
): number {
  return Number.isFinite(
    value,
  )
    ? value
    : 0;
}