import type {
  ConfiguracionIngreso,
} from "@/lib/budget/types";

export const ID_INGRESO_PRINCIPAL =
  "salario-principal";

export const FECHA_ANCLA_INGRESO_PRINCIPAL =
  "2026-07-30";

export const INTERVALO_INGRESO_PRINCIPAL_DIAS =
  14;

/**
 * Crea la configuración del salario principal.
 *
 * La fecha 2026-07-30 es una fecha real conocida de pago.
 * A partir de ella, la aplicación puede proyectar todos
 * los pagos anteriores y futuros en intervalos de 14 días.
 */
export function crearConfiguracionIngresoPrincipal(
  montoEstimado: number,
): ConfiguracionIngreso {
  if (
    !Number.isFinite(montoEstimado) ||
    montoEstimado <= 0
  ) {
    throw new Error(
      "El monto estimado del ingreso debe ser mayor que cero.",
    );
  }

  return {
    id:
      ID_INGRESO_PRINCIPAL,

    descripcion:
      "Salario principal",

    montoEstimado,

    fuente:
      "salario",

    frecuencia:
      "cada_2_semanas",

    fechaAncla:
      FECHA_ANCLA_INGRESO_PRINCIPAL,

    intervaloDias:
      INTERVALO_INGRESO_PRINCIPAL_DIAS,

    activa:
      true,

    notas:
      "",
  };
}