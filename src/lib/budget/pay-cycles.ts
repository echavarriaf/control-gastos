import type {
  CicloPago,
  ConfiguracionIngreso,
  EstadoCicloPago,
} from "@/lib/budget/types";

const MILISEGUNDOS_POR_DIA =
  24 * 60 * 60 * 1_000;

const INTERVALO_PREDETERMINADO =
  14;

interface GenerarCiclosPagoArgs {
  configuracion:
    Pick<
      ConfiguracionIngreso,
      | "id"
      | "fechaAncla"
      | "intervaloDias"
    >;

  /**
   * Primera fecha que debe cubrir la generación.
   * Formato: YYYY-MM-DD o ISO completo.
   */
  fechaInicio: string | Date;

  /**
   * Cantidad de ciclos consecutivos a generar.
   */
  cantidad: number;

  /**
   * Fecha utilizada para determinar si un ciclo está
   * proyectado, abierto o cerrado.
   */
  fechaReferencia?: string | Date;
}

interface BuscarCicloArgs {
  ciclos: CicloPago[];
  fecha: string | Date;
}

/**
 * Convierte una fecha a medianoche UTC.
 *
 * Usamos UTC porque estos valores representan días del
 * calendario, no horas. Así evitamos que cambios de zona
 * horaria o DST muevan la fecha al día anterior.
 */
export function convertirAFechaUTC(
  valor: string | Date,
): Date {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      throw new Error("La fecha recibida no es válida.");
    }

    return new Date(
      Date.UTC(
        valor.getUTCFullYear(),
        valor.getUTCMonth(),
        valor.getUTCDate(),
      ),
    );
  }

  const fechaSimple =
    valor.slice(0, 10);

  const coincidencia =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      fechaSimple,
    );

  if (!coincidencia) {
    throw new Error(
      `La fecha "${valor}" debe usar el formato YYYY-MM-DD.`,
    );
  }

  const [, anioTexto, mesTexto, diaTexto] =
    coincidencia;

  const anio =
    Number(anioTexto);

  const mes =
    Number(mesTexto);

  const dia =
    Number(diaTexto);

  const fecha =
    new Date(
      Date.UTC(
        anio,
        mes - 1,
        dia,
      ),
    );

  const fechaValida =
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia;

  if (!fechaValida) {
    throw new Error(
      `La fecha "${valor}" no existe en el calendario.`,
    );
  }

  return fecha;
}

export function convertirFechaAISO(
  valor: string | Date,
): string {
  return convertirAFechaUTC(valor)
    .toISOString()
    .slice(0, 10);
}

export function agregarDiasUTC(
  valor: string | Date,
  dias: number,
): Date {
  const fecha =
    convertirAFechaUTC(valor);

  return new Date(
    fecha.getTime() +
      dias * MILISEGUNDOS_POR_DIA,
  );
}

export function diferenciaDiasUTC(
  fechaInicial: string | Date,
  fechaFinal: string | Date,
): number {
  const inicio =
    convertirAFechaUTC(fechaInicial);

  const fin =
    convertirAFechaUTC(fechaFinal);

  return Math.round(
    (
      fin.getTime() -
      inicio.getTime()
    ) /
      MILISEGUNDOS_POR_DIA,
  );
}

function validarIntervalo(
  intervaloDias:
    number | null | undefined,
): number {
  const intervalo =
    intervaloDias ??
    INTERVALO_PREDETERMINADO;

  if (
    !Number.isInteger(intervalo) ||
    intervalo <= 0
  ) {
    throw new Error(
      "El intervalo de pago debe ser un número entero mayor que cero.",
    );
  }

  return intervalo;
}

/**
 * Devuelve la fecha de pago alineada con la fecha ancla
 * que ocurre en o antes de la fecha indicada.
 */
export function obtenerPagoEnOAntesDe(
  fecha: string | Date,
  fechaAncla: string | Date,
  intervaloDias =
    INTERVALO_PREDETERMINADO,
): Date {
  const intervalo =
    validarIntervalo(intervaloDias);

  const fechaObjetivo =
    convertirAFechaUTC(fecha);

  const ancla =
    convertirAFechaUTC(fechaAncla);

  const diferencia =
    diferenciaDiasUTC(
      ancla,
      fechaObjetivo,
    );

  const saltos =
    Math.floor(
      diferencia / intervalo,
    );

  return agregarDiasUTC(
    ancla,
    saltos * intervalo,
  );
}

/**
 * Devuelve la fecha de pago alineada con la fecha ancla
 * que ocurre en o después de la fecha indicada.
 */
export function obtenerPagoEnODespuesDe(
  fecha: string | Date,
  fechaAncla: string | Date,
  intervaloDias =
    INTERVALO_PREDETERMINADO,
): Date {
  const intervalo =
    validarIntervalo(intervaloDias);

  const fechaObjetivo =
    convertirAFechaUTC(fecha);

  const pagoAnterior =
    obtenerPagoEnOAntesDe(
      fechaObjetivo,
      fechaAncla,
      intervalo,
    );

  if (
    pagoAnterior.getTime() ===
    fechaObjetivo.getTime()
  ) {
    return pagoAnterior;
  }

  return agregarDiasUTC(
    pagoAnterior,
    intervalo,
  );
}

function obtenerInicioMes(
  fecha: string | Date,
): Date {
  const valor =
    convertirAFechaUTC(fecha);

  return new Date(
    Date.UTC(
      valor.getUTCFullYear(),
      valor.getUTCMonth(),
      1,
    ),
  );
}

function obtenerInicioAnio(
  fecha: string | Date,
): Date {
  const valor =
    convertirAFechaUTC(fecha);

  return new Date(
    Date.UTC(
      valor.getUTCFullYear(),
      0,
      1,
    ),
  );
}

function obtenerNumeroPagoDesde(
  fechaPago: string | Date,
  inicioPeriodo: Date,
  fechaAncla: string | Date,
  intervaloDias: number,
): number {
  const primerPago =
    obtenerPagoEnODespuesDe(
      inicioPeriodo,
      fechaAncla,
      intervaloDias,
    );

  const diferencia =
    diferenciaDiasUTC(
      primerPago,
      fechaPago,
    );

  if (
    diferencia < 0 ||
    diferencia % intervaloDias !== 0
  ) {
    throw new Error(
      "La fecha de pago no está alineada con la fecha ancla.",
    );
  }

  return (
    diferencia /
      intervaloDias +
    1
  );
}

export function obtenerNumeroPagoMes(
  fechaPago: string | Date,
  fechaAncla: string | Date,
  intervaloDias =
    INTERVALO_PREDETERMINADO,
): number {
  const intervalo =
    validarIntervalo(intervaloDias);

  return obtenerNumeroPagoDesde(
    fechaPago,
    obtenerInicioMes(fechaPago),
    fechaAncla,
    intervalo,
  );
}

export function obtenerNumeroPagoAnual(
  fechaPago: string | Date,
  fechaAncla: string | Date,
  intervaloDias =
    INTERVALO_PREDETERMINADO,
): number {
  const intervalo =
    validarIntervalo(intervaloDias);

  return obtenerNumeroPagoDesde(
    fechaPago,
    obtenerInicioAnio(fechaPago),
    fechaAncla,
    intervalo,
  );
}

function obtenerEstadoCiclo(
  inicioCobertura: Date,
  finCobertura: Date,
  fechaReferencia: Date,
): EstadoCicloPago {
  if (
    fechaReferencia.getTime() <
    inicioCobertura.getTime()
  ) {
    return "proyectado";
  }

  if (
    fechaReferencia.getTime() >
    finCobertura.getTime()
  ) {
    return "cerrado";
  }

  return "abierto";
}

/**
 * Genera ciclos consecutivos de pago.
 *
 * Cada ciclo comienza el día de pago y termina un día
 * antes del siguiente pago.
 */
export function generarCiclosPago({
  configuracion,
  fechaInicio,
  cantidad,
  fechaReferencia = new Date(),
}: GenerarCiclosPagoArgs): CicloPago[] {
  if (
    !Number.isInteger(cantidad) ||
    cantidad <= 0
  ) {
    throw new Error(
      "La cantidad de ciclos debe ser un número entero mayor que cero.",
    );
  }

  const intervaloDias =
    validarIntervalo(
      configuracion.intervaloDias,
    );

  const fechaAncla =
    convertirAFechaUTC(
      configuracion.fechaAncla,
    );

  const referencia =
    convertirAFechaUTC(
      fechaReferencia,
    );

  const primerPago =
    obtenerPagoEnODespuesDe(
      fechaInicio,
      fechaAncla,
      intervaloDias,
    );

  return Array.from(
    {
      length: cantidad,
    },
    (_, indice) => {
      const fechaPago =
        agregarDiasUTC(
          primerPago,
          indice * intervaloDias,
        );

      const fechaSiguientePago =
        agregarDiasUTC(
          fechaPago,
          intervaloDias,
        );

      const finCobertura =
        agregarDiasUTC(
          fechaSiguientePago,
          -1,
        );

      const fechaPagoISO =
        convertirFechaAISO(
          fechaPago,
        );

      const periodoCalendario =
        fechaPagoISO.slice(0, 7);

      return {
        id:
          `${configuracion.id}__${fechaPagoISO}`,

        configuracionIngresoId:
          configuracion.id,

        fechaPagoProgramada:
          fechaPagoISO,

        fechaPagoReal:
          null,

        fechaSiguientePago:
          convertirFechaAISO(
            fechaSiguientePago,
          ),

        inicioCobertura:
          fechaPagoISO,

        finCobertura:
          convertirFechaAISO(
            finCobertura,
          ),

        periodoCalendario,

        numeroPagoMes:
          obtenerNumeroPagoMes(
            fechaPago,
            fechaAncla,
            intervaloDias,
          ),

        numeroPagoAnual:
          obtenerNumeroPagoAnual(
            fechaPago,
            fechaAncla,
            intervaloDias,
          ),

        estado:
          obtenerEstadoCiclo(
            fechaPago,
            finCobertura,
            referencia,
          ),
      } satisfies CicloPago;
    },
  );
}

/**
 * Encuentra el ciclo que debe financiar una obligación.
 *
 * Una factura que vence entre dos pagos pertenece al
 * ciclo iniciado con el pago inmediatamente anterior.
 */
export function buscarCicloParaFecha({
  ciclos,
  fecha,
}: BuscarCicloArgs): CicloPago | null {
  const fechaObjetivo =
    convertirFechaAISO(fecha);

  return (
    ciclos.find(
      (ciclo) =>
        fechaObjetivo >=
          ciclo.inicioCobertura &&
        fechaObjetivo <=
          ciclo.finCobertura,
    ) ??
    null
  );
}

/**
 * Devuelve los ciclos cuyo pago cae dentro del mes.
 * Puede devolver dos o tres ciclos.
 */
export function obtenerCiclosDelMes(
  ciclos: CicloPago[],
  periodo: string,
): CicloPago[] {
  return ciclos
    .filter(
      (ciclo) =>
        ciclo.periodoCalendario ===
        periodo,
    )
    .sort(
      (a, b) =>
        a.fechaPagoProgramada.localeCompare(
          b.fechaPagoProgramada,
        ),
    );
}