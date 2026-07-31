import type {
  ConfiguracionIngreso,
  FuenteIngreso,
  FrecuenciaIngreso,
} from "@/lib/budget/types";

export const ID_INGRESO_PRINCIPAL =
  "ingresoPrincipal";

export const FECHA_ANCLA_INGRESO_PRINCIPAL =
  "2026-07-30";

export const INTERVALO_INGRESO_PRINCIPAL_DIAS =
  14;

export const MONTO_ESTIMADO_INGRESO_PRINCIPAL =
  1_600;

const FUENTES_INGRESO: FuenteIngreso[] = [
  "salario",
  "bono",
  "horas_extra",
  "reembolso",
  "otro",
];

const FRECUENCIAS_INGRESO: FrecuenciaIngreso[] = [
  "semanal",
  "cada_2_semanas",
  "dos_veces_mes",
  "mensual",
  "variable",
];

function esFuenteIngreso(
  valor: unknown,
): valor is FuenteIngreso {
  return FUENTES_INGRESO.includes(
    valor as FuenteIngreso,
  );
}

function esFrecuenciaIngreso(
  valor: unknown,
): valor is FrecuenciaIngreso {
  return FRECUENCIAS_INGRESO.includes(
    valor as FrecuenciaIngreso,
  );
}

function normalizarMontoPositivo(
  valor: unknown,
  respaldo: number,
): number {
  const numero =
    typeof valor === "number"
      ? valor
      : Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero <= 0
  ) {
    return respaldo;
  }

  return Math.round(
    numero * 100,
  ) / 100;
}

function normalizarIntervalo(
  valor: unknown,
  respaldo: number,
): number {
  const numero =
    typeof valor === "number"
      ? valor
      : Number(valor);

  if (
    !Number.isInteger(numero) ||
    numero <= 0
  ) {
    return respaldo;
  }

  return numero;
}

function normalizarTexto(
  valor: unknown,
  respaldo = "",
): string {
  return typeof valor === "string"
    ? valor.trim()
    : respaldo;
}

/**
 * Configuración local inicial.
 *
 * Firestore podrá reemplazar estos valores desde:
 *
 * configuracion/ingresoPrincipal
 */
export const CONFIGURACION_INGRESO_PREDETERMINADA:
  ConfiguracionIngreso = {
    id:
      ID_INGRESO_PRINCIPAL,

    descripcion:
      "Salario principal",

    montoEstimado:
      MONTO_ESTIMADO_INGRESO_PRINCIPAL,

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

/**
 * Crea una configuración válida del ingreso principal.
 */
export function crearConfiguracionIngresoPrincipal(
  montoEstimado =
    MONTO_ESTIMADO_INGRESO_PRINCIPAL,
): ConfiguracionIngreso {
  return {
    ...CONFIGURACION_INGRESO_PREDETERMINADA,

    montoEstimado:
      normalizarMontoPositivo(
        montoEstimado,
        MONTO_ESTIMADO_INGRESO_PRINCIPAL,
      ),
  };
}

/**
 * Convierte un documento de Firestore en una
 * ConfiguracionIngreso segura.
 */
export function normalizarConfiguracionIngreso(
  data: unknown,
): ConfiguracionIngreso {
  const respaldo =
    CONFIGURACION_INGRESO_PREDETERMINADA;

  if (
    !data ||
    typeof data !== "object"
  ) {
    return respaldo;
  }

  const registro =
    data as Record<string, unknown>;

  return {
    id:
      ID_INGRESO_PRINCIPAL,

    descripcion:
      normalizarTexto(
        registro.descripcion,
        respaldo.descripcion,
      ) ||
      respaldo.descripcion,

    montoEstimado:
      normalizarMontoPositivo(
        registro.montoEstimado,
        respaldo.montoEstimado,
      ),

    fuente:
      esFuenteIngreso(
        registro.fuente,
      )
        ? registro.fuente
        : respaldo.fuente,

    frecuencia:
      esFrecuenciaIngreso(
        registro.frecuencia,
      )
        ? registro.frecuencia
        : respaldo.frecuencia,

    fechaAncla:
      /^\d{4}-\d{2}-\d{2}$/.test(
        normalizarTexto(
          registro.fechaAncla,
        ),
      )
        ? String(
            registro.fechaAncla,
          )
        : respaldo.fechaAncla,

    intervaloDias:
      normalizarIntervalo(
        registro.intervaloDias,
        respaldo.intervaloDias ??
          INTERVALO_INGRESO_PRINCIPAL_DIAS,
      ),

    activa:
      typeof registro.activa === "boolean"
        ? registro.activa
        : respaldo.activa,

    notas:
      normalizarTexto(
        registro.notas,
        respaldo.notas,
      ),
  };
}

/**
 * Objeto que se guarda en Firestore.
 * Se excluye `id` porque el identificador ya está
 * representado por la ruta del documento.
 */
export function prepararConfiguracionIngresoParaGuardar(
  configuracion: ConfiguracionIngreso,
): Omit<ConfiguracionIngreso, "id"> {
  const normalizada =
    normalizarConfiguracionIngreso(
      configuracion,
    );

  const {
    id: _id,
    ...datos
  } = normalizada;

  return datos;
}