// Calendarios de corte y fechas financieras en la zona horaria configurada.
import type { CalendarioTarjetaPush, PeriodInfo } from "./types";
import { DIAS_ANTICIPACION_PAGO_TARJETA, TIME_ZONE } from "./constants";
import { esObjeto } from "./utils";

/**
 * ============================================================
 * CALENDARIO DE TARJETAS
 * ============================================================
 */

export function calcularCalendarioTarjeta(
  diaCorte:
    number,

  hoyISO:
    string,
): CalendarioTarjetaPush {
  const {
    year,
    month,
  } =
    descomponerFechaISO(
      hoyISO,
    );

  const corteMesActual =
    crearFechaMensualSeguraISO(
      year,
      month,
      diaCorte,
    );

  const fechaCorteISO =
    corteMesActual >=
    hoyISO
      ? corteMesActual
      : crearFechaMensualSeguraISO(
          month ===
            12
            ? year +
                1
            : year,

          month ===
            12
            ? 1
            : month +
                1,

          diaCorte,
        );

  const fechaObjetivoPagoISO =
    sumarDiasISO(
      fechaCorteISO,
      -DIAS_ANTICIPACION_PAGO_TARJETA,
    );

  return {
    fechaCorteISO,

    fechaObjetivoPagoISO,

    diasHastaCorte:
      diferenciaDiasISO(
        hoyISO,
        fechaCorteISO,
      ),

    diasHastaPagoObjetivo:
      diferenciaDiasISO(
        hoyISO,
        fechaObjetivoPagoISO,
      ),
  };
}

function crearFechaMensualSeguraISO(
  year:
    number,

  month:
    number,

  day:
    number,
): string {
  const ultimoDia =
    new Date(
      Date.UTC(
        year,
        month,
        0,
      ),
    ).getUTCDate();

  const diaSeguro =
    Math.min(
      Math.max(
        Math.trunc(
          day,
        ),
        1,
      ),
      ultimoDia,
    );

  return construirFechaISO(
    year,
    month,
    diaSeguro,
  );
}

function sumarDiasISO(
  fechaISO:
    string,

  dias:
    number,
): string {
  const {
    year,
    month,
    day,
  } =
    descomponerFechaISO(
      fechaISO,
    );

  const fecha =
    new Date(
      Date.UTC(
        year,
        month -
          1,
        day +
          Math.trunc(
            dias,
          ),
      ),
    );

  return construirFechaISO(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth() +
      1,
    fecha.getUTCDate(),
  );
}

function diferenciaDiasISO(
  desdeISO:
    string,

  hastaISO:
    string,
): number {
  return Math.round(
    (
      fechaISOAMilisegundos(
        hastaISO,
      ) -
      fechaISOAMilisegundos(
        desdeISO,
      )
    ) /
      86_400_000,
  );
}

function fechaISOAMilisegundos(
  fechaISO:
    string,
): number {
  const {
    year,
    month,
    day,
  } =
    descomponerFechaISO(
      fechaISO,
    );

  return Date.UTC(
    year,
    month -
      1,
    day,
  );
}

function descomponerFechaISO(
  fechaISO:
    string,
): {
  year:
    number;

  month:
    number;

  day:
    number;
} {
  const [
    year,
    month,
    day,
  ] =
    fechaISO
      .split(
        "-",
      )
      .map(
        Number,
      );

  return {
    year,
    month,
    day,
  };
}

function construirFechaISO(
  year:
    number,

  month:
    number,

  day:
    number,
): string {
  return `${String(
    year,
  ).padStart(
    4,
    "0",
  )}-${String(
    month,
  ).padStart(
    2,
    "0",
  )}-${String(
    day,
  ).padStart(
    2,
    "0",
  )}`;
}

export function esFechaISOValida(
  fechaISO:
    string,
): boolean {
  try {
    const {
      year,
      month,
      day,
    } =
      descomponerFechaISO(
        fechaISO,
      );

    if (
      !Number.isInteger(
        year,
      ) ||
      !Number.isInteger(
        month,
      ) ||
      !Number.isInteger(
        day,
      )
    ) {
      return false;
    }

    const fecha =
      new Date(
        Date.UTC(
          year,
          month -
            1,
          day,
        ),
      );

    return (
      fecha.getUTCFullYear() ===
        year &&
      fecha.getUTCMonth() +
          1 ===
        month &&
      fecha.getUTCDate() ===
        day
    );
  } catch {
    return false;
  }
}

export function formatearFechaCalendario(
  fechaISO:
    string,
): string {
  const {
    year,
    month,
    day,
  } =
    descomponerFechaISO(
      fechaISO,
    );

  return new Intl.DateTimeFormat(
    "es-US",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",

      timeZone:
        "UTC",
    },
  ).format(
    new Date(
      Date.UTC(
        year,
        month -
          1,
        day,
        12,
      ),
    ),
  );
}

export function obtenerInfoPeriodo(
  fecha:
    Date,
): PeriodInfo {
  const fechaISO =
    obtenerFechaZonaHorariaISO(
      fecha,
    );

  const {
    year,
    month,
    day,
  } =
    descomponerFechaISO(
      fechaISO,
    );

  return {
    periodo:
      `${String(
        year,
      ).padStart(
        4,
        "0",
      )}-${String(
        month,
      ).padStart(
        2,
        "0",
      )}`,

    quincena:
      day <=
      15
        ? 1
        : 2,
  };
}

export function obtenerFechaZonaHorariaISO(
  fecha:
    Date,
): string {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          TIME_ZONE,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      },
    );

  const parts =
    formatter.formatToParts(
      fecha,
    );

  const year =
    obtenerParte(
      parts,
      "year",
    );

  const month =
    obtenerParte(
      parts,
      "month",
    );

  const day =
    obtenerParte(
      parts,
      "day",
    );

  return `${year}-${month}-${day}`;
}

function obtenerParte(
  parts:
    Intl.DateTimeFormatPart[],

  type:
    | "year"
    | "month"
    | "day",
): string {
  return (
    parts.find(
      (
        part,
      ) =>
        part.type ===
        type,
    )?.value ??
    ""
  );
}

export function obtenerRangoBusqueda(
  periodo:
    string,
): {
  inicioBusqueda:
    string;

  finBusqueda:
    string;
} {
  const [
    year,
    month,
  ] =
    periodo
      .split(
        "-",
      )
      .map(
        Number,
      );

  const margen =
    36 *
    60 *
    60 *
    1000;

  return {
    inicioBusqueda:
      new Date(
        Date.UTC(
          year,
          month -
            1,
          1,
        ) -
          margen,
      ).toISOString(),

    finBusqueda:
      new Date(
        Date.UTC(
          year,
          month,
          1,
        ) +
          margen,
      ).toISOString(),
  };
}

export function convertirFecha(
  value:
    unknown,
): Date | null {
  if (
    value instanceof
    Date
  ) {
    return Number.isNaN(
      value.getTime(),
    )
      ? null
      : value;
  }

  if (
    typeof value ===
    "string"
  ) {
    const fecha =
      new Date(
        value,
      );

    return Number.isNaN(
      fecha.getTime(),
    )
      ? null
      : fecha;
  }

  if (
    esObjeto(
      value,
    ) &&
    typeof value.toDate ===
      "function"
  ) {
    try {
      const fecha =
        value.toDate();

      return (
        fecha instanceof
          Date &&
        !Number.isNaN(
          fecha.getTime(),
        )
      )
        ? fecha
        : null;
    } catch {
      return null;
    }
  }

  return null;
}
