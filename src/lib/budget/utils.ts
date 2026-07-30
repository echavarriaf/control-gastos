import {
  CATEGORIA_KEYS,
  LIMITES_PREDETERMINADOS,
} from "./constants";

import type {
  CategoriaPago,
  CategoriaVariable,
  LimitesVariables,
  MetodoPagoFijo,
  PeriodicidadPagoFijo,
  Quincena,
} from "./types";

export const formatoMoneda = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function obtenerPeriodo(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

export function obtenerPeriodoDesdeISO(fechaISO: string): string {
  const fecha = new Date(fechaISO);

  return Number.isNaN(fecha.getTime())
    ? ""
    : obtenerPeriodo(fecha);
}

export function obtenerQuincena(fecha: Date): Quincena {
  return fecha.getDate() <= 15 ? 1 : 2;
}

export function obtenerQuincenaDesdeISO(
  fechaISO: string,
): Quincena {
  const fecha = new Date(fechaISO);

  return Number.isNaN(fecha.getTime())
    ? 1
    : obtenerQuincena(fecha);
}

export function etiquetaMes(periodo: string): string {
  const [year, month] = periodo.split("-").map(Number);
  const fecha = new Date(year, month - 1, 1);

  if (Number.isNaN(fecha.getTime())) {
    return periodo;
  }

  const resultado = fecha.toLocaleDateString("es-US", {
    month: "long",
    year: "numeric",
  });

  return (
    resultado.charAt(0).toUpperCase() +
    resultado.slice(1)
  );
}

export function fechaInputLocal(
  fecha = new Date(),
): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(
    2,
    "0",
  );
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function fechaParaPeriodo(
  periodo: string,
  quincena: Quincena,
): string {
  const hoy = new Date();

  if (obtenerPeriodo(hoy) === periodo) {
    return fechaInputLocal(hoy);
  }

  const [year, month] = periodo.split("-").map(Number);

  const day =
    quincena === 1
      ? 15
      : new Date(year, month, 0).getDate();

  return `${year}-${String(month).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
}

export function convertirFechaInputAISO(
  fecha: string,
): string {
  return new Date(`${fecha}T12:00:00`).toISOString();
}

export function normalizarCategoriaGasto(
  value: unknown,
): CategoriaVariable | null {
  if (value === "comida") {
    return "comida";
  }

  if (value === "gas" || value === "transporte") {
    return "gas";
  }

  return null;
}

export function normalizarCategoriaPago(
  value: unknown,
): CategoriaPago {
  if (
    value === "comida" ||
    value === "gas" ||
    value === "general"
  ) {
    return value;
  }

  return "general";
}

export function normalizarMetodoPago(
  value: unknown,
): MetodoPagoFijo {
  if (
    value === "debito_automatico" ||
    value === "transferencia" ||
    value === "tarjeta" ||
    value === "efectivo" ||
    value === "otro"
  ) {
    return value;
  }

  return "otro";
}

export function normalizarPeriodicidad(
  value: unknown,
): PeriodicidadPagoFijo {
  return value === "quincenal"
    ? "quincenal"
    : "mensual";
}

export function normalizarMonto(
  value: unknown,
  fallback: number,
): number {
  const numero = Number(value);

  return Number.isFinite(numero) && numero >= 0
    ? numero
    : fallback;
}

export function normalizarLimites(
  value: unknown,
): LimitesVariables {
  const data =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return CATEGORIA_KEYS.reduce(
    (resultado, key) => {
      const limite =
        typeof data[key] === "object" &&
        data[key] !== null
          ? (data[key] as Record<string, unknown>)
          : {};

      resultado[key] = {
        mensual: normalizarMonto(
          limite.mensual,
          LIMITES_PREDETERMINADOS[key].mensual,
        ),
        quincenal: normalizarMonto(
          limite.quincenal,
          LIMITES_PREDETERMINADOS[key].quincenal,
        ),
      };

      return resultado;
    },
    {} as LimitesVariables,
  );
}

export function porcentaje(
  usado: number,
  limite: number,
): number {
  if (limite <= 0) {
    return 0;
  }

  return (usado / limite) * 100;
}

export function anchoBarra(valor: number): number {
  return Math.min(Math.max(valor, 0), 100);
}

export function colorBarra(valor: number): string {
  if (valor >= 100) {
    return "bg-rose-600";
  }

  if (valor >= 90) {
    return "bg-rose-500";
  }

  if (valor >= 70) {
    return "bg-amber-400";
  }

  return "bg-emerald-500";
}

export function montoSeguro(
  value: string,
): number | null {
  const numero = Number(value);

  return Number.isFinite(numero) && numero > 0
    ? numero
    : null;
}

export function fechaCorta(
  fechaISO: string,
): string {
  return new Date(fechaISO).toLocaleDateString(
    "es-US",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}