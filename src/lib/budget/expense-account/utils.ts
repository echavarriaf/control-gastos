// Fechas, redondeo y clasificación de entradas y salidas bancarias.
import type { GastoVariable, Ingreso, PagoFijo, Quincena } from "@/lib/budget/types";

export function redondearMoneda(
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

export function obtenerFechaCalendario(
  value: string,
): string {
  return value
    .trim()
    .slice(
      0,
      10,
    );
}

export function obtenerPeriodoCalendario(
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
export function obtenerPeriodoLocal(
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
export function obtenerQuincenaLocal(
  fecha:
    Date,
): Quincena {
  return fecha.getDate() <=
    15
    ? 1
    : 2;
}

export function obtenerFechaMasReciente(
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

export function etiquetaMetodoVariable(
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

export function etiquetaFuenteIngreso(
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
