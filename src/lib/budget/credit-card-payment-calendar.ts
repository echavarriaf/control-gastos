/*
 * Nombre: Calendario de pago anticipado de tarjetas
 * Ruta: src/lib/budget/credit-card-payment-calendar.ts
 * Autor: Felix Echavarria
 * Fecha: 2026-09-01
 *
 * Descripción:
 * Calcula la próxima fecha de corte de una tarjeta de crédito,
 * la fecha objetivo para pagarla cinco días antes del corte
 * y el estado actual de su ventana de pago.
 *
 * Regla principal:
 *
 *   fechaObjetivoPago = fechaCorte - 5 días
 *
 * 1C.2A:
 * Calcula la próxima fecha de corte.
 *
 * 1C.2B:
 * Calcula la fecha objetivo de pago.
 *
 * 1C.2D:
 * Determina automáticamente si la tarjeta:
 *
 * - todavía está antes de la ventana de pago;
 * - ya debe pagarse;
 * - corta hoy;
 * - no tiene saldo;
 * - está inactiva.
 *
 * La lógica utiliza fechas de calendario locales y evita
 * errores producidos por UTC o cambios de horario DST.
 */

export const DIAS_ANTICIPACION_PAGO_TARJETA =
  5;

const MILISEGUNDOS_POR_DIA =
  24 *
  60 *
  60 *
  1000;

/**
 * Estado operativo de una tarjeta respecto a su
 * próxima fecha de corte.
 */
export type EstadoVentanaPagoTarjeta =
  | "inactiva"
  | "sin_saldo"
  | "antes_de_ventana"
  | "pagar_ahora"
  | "corte_hoy";

/**
 * Calendario base calculado para una tarjeta.
 */
export interface CalendarioPagoTarjeta {
  /**
   * Día configurado originalmente.
   *
   * Ejemplo:
   * 31
   */
  diaCorteConfigurado:
    number;

  /**
   * Día real utilizado durante el mes.
   *
   * Si la tarjeta corta el día 31 y el mes
   * solamente tiene 30 días, este valor será 30.
   */
  diaCorteEfectivo:
    number;

  /**
   * Próximo corte real.
   */
  fechaCorte:
    Date;

  /**
   * Fecha objetivo del pago total.
   *
   * fechaCorte - 5 días.
   */
  fechaObjetivoPago:
    Date;

  /**
   * Versiones YYYY-MM-DD.
   */
  fechaCorteISO:
    string;

  fechaObjetivoPagoISO:
    string;

  /**
   * Diferencias respecto a la fecha actual.
   *
   * diasHastaPagoObjetivo puede ser negativo cuando
   * la fecha objetivo ya pasó pero todavía no llegó
   * el corte.
   */
  diasHastaCorte:
    number;

  diasHastaPagoObjetivo:
    number;

  /**
   * Indica que el día solicitado no existía
   * durante ese mes.
   */
  ajustadoPorFinDeMes:
    boolean;
}

/**
 * Resultado completo de 1C.2D.
 *
 * Este objeto será reutilizado posteriormente
 * por la interfaz y las notificaciones.
 */
export interface EvaluacionVentanaPagoTarjeta {
  estado:
    EstadoVentanaPagoTarjeta;

  /**
   * Monto pendiente normalizado.
   */
  montoPagoTotal:
    number;

  /**
   * true únicamente entre la fecha objetivo
   * y el día anterior al corte.
   */
  dentroVentanaPago:
    boolean;

  /**
   * true cuando existe una acción que debería
   * llamar la atención del usuario.
   *
   * En 1C.2E esta propiedad permitirá mostrar
   * "PAGAR AHORA".
   */
  requiereAccion:
    boolean;

  /**
   * Días que faltan para que abra la ventana.
   *
   * Será 0 cuando ya esté abierta o haya pasado.
   */
  diasParaAbrirVentana:
    number;

  /**
   * Días transcurridos desde la fecha objetivo.
   *
   * Día objetivo = 0
   * día siguiente = 1
   *
   * Solo tiene sentido durante pagar_ahora.
   */
  diasDesdeInicioVentana:
    number;

  /**
   * Se repiten las fechas principales para permitir
   * consumir esta estructura sin recalcular calendario.
   */
  fechaCorte:
    Date;

  fechaObjetivoPago:
    Date;

  fechaCorteISO:
    string;

  fechaObjetivoPagoISO:
    string;
}

/**
 * Mantiene el día configurado dentro de 1-31.
 */
function normalizarDiaCorte(
  diaCorte:
    number,
): number {
  if (
    !Number.isFinite(
      diaCorte,
    )
  ) {
    return 1;
  }

  return Math.min(
    31,
    Math.max(
      1,
      Math.trunc(
        diaCorte,
      ),
    ),
  );
}

/**
 * Normaliza cantidades monetarias para comparar
 * estados sin residuos de punto flotante.
 */
function normalizarMonto(
  monto:
    number,
): number {
  if (
    !Number.isFinite(
      monto,
    )
  ) {
    return 0;
  }

  return (
    Math.round(
      (
        Math.max(
          monto,
          0,
        ) +
        Number.EPSILON
      ) *
        100,
    ) /
    100
  );
}

/**
 * Devuelve el último día real del mes indicado.
 *
 * monthIndex:
 *
 * enero = 0
 * diciembre = 11
 */
function obtenerUltimoDiaMes(
  year:
    number,

  monthIndex:
    number,
): number {
  return new Date(
    year,
    monthIndex +
      1,
    0,
  ).getDate();
}

/**
 * Construye una fecha mensual segura.
 *
 * Si el día solicitado no existe, utiliza
 * automáticamente el último día del mes.
 */
function crearFechaMensualSegura(
  year:
    number,

  monthIndex:
    number,

  diaDeseado:
    number,
): Date {
  const ultimoDia =
    obtenerUltimoDiaMes(
      year,
      monthIndex,
    );

  const dia =
    Math.min(
      diaDeseado,
      ultimoDia,
    );

  /**
   * Mediodía reduce riesgos relacionados con DST.
   */
  return new Date(
    year,
    monthIndex,
    dia,
    12,
    0,
    0,
    0,
  );
}

/**
 * Normaliza una fecha al mediodía local.
 */
function normalizarFechaReferencia(
  fecha:
    Date,
): Date {
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    12,
    0,
    0,
    0,
  );
}

/**
 * Convierte una fecha local a YYYY-MM-DD.
 *
 * No utiliza toISOString() para impedir que una
 * diferencia de zona horaria cambie accidentalmente
 * el día.
 */
export function fechaCalendarioAISO(
  fecha:
    Date,
): string {
  const year =
    fecha.getFullYear();

  const month =
    String(
      fecha.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      fecha.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

/**
 * Resta días de calendario.
 *
 * Date maneja automáticamente cambios de mes
 * y cambios de año.
 */
export function restarDiasCalendario(
  fecha:
    Date,

  dias:
    number,
): Date {
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate() -
      Math.max(
        0,
        Math.trunc(
          dias,
        ),
      ),
    12,
    0,
    0,
    0,
  );
}

/**
 * Calcula la diferencia real de días calendario.
 *
 * Internamente utiliza UTC únicamente para evitar
 * que días de 23 o 25 horas por DST alteren
 * el resultado.
 */
export function diferenciaDiasCalendario(
  desde:
    Date,

  hasta:
    Date,
): number {
  const inicioUTC =
    Date.UTC(
      desde.getFullYear(),
      desde.getMonth(),
      desde.getDate(),
    );

  const finUTC =
    Date.UTC(
      hasta.getFullYear(),
      hasta.getMonth(),
      hasta.getDate(),
    );

  return Math.round(
    (
      finUTC -
      inicioUTC
    ) /
      MILISEGUNDOS_POR_DIA,
  );
}

/**
 * ============================================================
 * 1C.2A
 * ============================================================
 *
 * Calcula la próxima fecha de corte.
 *
 * Si el corte de este mes todavía no pasó, lo utiliza.
 *
 * Si ya pasó, devuelve el corte del mes siguiente.
 *
 * Si hoy es exactamente el día de corte, el corte de hoy
 * continúa siendo el corte relevante.
 */
export function obtenerProximaFechaCorte(
  diaCorte:
    number,

  fechaReferencia:
    Date =
      new Date(),
): Date {
  const diaNormalizado =
    normalizarDiaCorte(
      diaCorte,
    );

  const referencia =
    normalizarFechaReferencia(
      fechaReferencia,
    );

  const corteMesActual =
    crearFechaMensualSegura(
      referencia
        .getFullYear(),

      referencia
        .getMonth(),

      diaNormalizado,
    );

  if (
    corteMesActual.getTime() >=
    referencia.getTime()
  ) {
    return corteMesActual;
  }

  const mesSiguiente =
    referencia.getMonth() +
    1;

  return crearFechaMensualSegura(
    referencia
      .getFullYear(),

    mesSiguiente,

    diaNormalizado,
  );
}

/**
 * ============================================================
 * 1C.2A + 1C.2B
 * ============================================================
 *
 * Calcula el calendario financiero principal.
 */
export function calcularCalendarioPagoTarjeta(
  diaCorte:
    number,

  fechaReferencia:
    Date =
      new Date(),

  diasAnticipacion:
    number =
      DIAS_ANTICIPACION_PAGO_TARJETA,
): CalendarioPagoTarjeta {
  const diaCorteConfigurado =
    normalizarDiaCorte(
      diaCorte,
    );

  const referencia =
    normalizarFechaReferencia(
      fechaReferencia,
    );

  const fechaCorte =
    obtenerProximaFechaCorte(
      diaCorteConfigurado,
      referencia,
    );

  const fechaObjetivoPago =
    restarDiasCalendario(
      fechaCorte,
      diasAnticipacion,
    );

  const diaCorteEfectivo =
    fechaCorte.getDate();

  return {
    diaCorteConfigurado,

    diaCorteEfectivo,

    fechaCorte,

    fechaObjetivoPago,

    fechaCorteISO:
      fechaCalendarioAISO(
        fechaCorte,
      ),

    fechaObjetivoPagoISO:
      fechaCalendarioAISO(
        fechaObjetivoPago,
      ),

    diasHastaCorte:
      diferenciaDiasCalendario(
        referencia,
        fechaCorte,
      ),

    diasHastaPagoObjetivo:
      diferenciaDiasCalendario(
        referencia,
        fechaObjetivoPago,
      ),

    ajustadoPorFinDeMes:
      diaCorteEfectivo !==
      diaCorteConfigurado,
  };
}

/**
 * ============================================================
 * 1C.2D
 * ============================================================
 *
 * Determina si una tarjeta debe entrar en modo de pago.
 *
 * Prioridad:
 *
 * 1. Tarjeta inactiva
 * 2. Sin saldo
 * 3. Corte hoy
 * 4. Ventana de pago abierta
 * 5. Antes de ventana
 *
 * Esto permite que una tarjeta cuyo saldo llegue a $0 deje
 * inmediatamente de generar una acción pendiente, aunque
 * todavía esté dentro de los cinco días previos al corte.
 */
export function evaluarVentanaPagoTarjeta({
  calendario,

  montoPagoTotal,

  activa = true,
}: {
  calendario:
    CalendarioPagoTarjeta;

  montoPagoTotal:
    number;

  activa?:
    boolean;
}): EvaluacionVentanaPagoTarjeta {
  const montoNormalizado =
    normalizarMonto(
      montoPagoTotal,
    );

  const base = {
    montoPagoTotal:
      montoNormalizado,

    fechaCorte:
      calendario.fechaCorte,

    fechaObjetivoPago:
      calendario
        .fechaObjetivoPago,

    fechaCorteISO:
      calendario
        .fechaCorteISO,

    fechaObjetivoPagoISO:
      calendario
        .fechaObjetivoPagoISO,
  };

  /**
   * Una tarjeta desactivada no debe generar
   * recordatorios de pago.
   */
  if (!activa) {
    return {
      ...base,

      estado:
        "inactiva",

      dentroVentanaPago:
        false,

      requiereAccion:
        false,

      diasParaAbrirVentana:
        0,

      diasDesdeInicioVentana:
        0,
    };
  }

  /**
   * El saldo tiene prioridad sobre la fecha.
   *
   * Si ya pagamos todo, no existe ninguna acción
   * pendiente para este corte.
   */
  if (
    montoNormalizado <=
    0
  ) {
    return {
      ...base,

      estado:
        "sin_saldo",

      dentroVentanaPago:
        false,

      requiereAccion:
        false,

      diasParaAbrirVentana:
        0,

      diasDesdeInicioVentana:
        0,
    };
  }

  /**
   * Día de corte.
   *
   * Se trata por separado porque ya no estamos
   * "antes del corte".
   */
  if (
    calendario
      .diasHastaCorte ===
    0
  ) {
    return {
      ...base,

      estado:
        "corte_hoy",

      dentroVentanaPago:
        false,

      requiereAccion:
        true,

      diasParaAbrirVentana:
        0,

      diasDesdeInicioVentana:
        Math.max(
          0,
          -calendario
            .diasHastaPagoObjetivo,
        ),
    };
  }

  /**
   * La fecha objetivo ya llegó o pasó,
   * pero el corte sigue estando en el futuro.
   *
   * Esa es exactamente nuestra ventana
   * "PAGAR AHORA".
   */
  if (
    calendario
      .diasHastaPagoObjetivo <=
      0 &&
    calendario
      .diasHastaCorte >
      0
  ) {
    return {
      ...base,

      estado:
        "pagar_ahora",

      dentroVentanaPago:
        true,

      requiereAccion:
        true,

      diasParaAbrirVentana:
        0,

      diasDesdeInicioVentana:
        Math.max(
          0,
          -calendario
            .diasHastaPagoObjetivo,
        ),
    };
  }

  /**
   * La fecha objetivo todavía está en el futuro.
   */
  return {
    ...base,

    estado:
      "antes_de_ventana",

    dentroVentanaPago:
      false,

    requiereAccion:
      false,

    diasParaAbrirVentana:
      Math.max(
        calendario
          .diasHastaPagoObjetivo,
        0,
      ),

    diasDesdeInicioVentana:
      0,
  };
}

/**
 * Presentación corta para la interfaz.
 *
 * Ejemplo:
 *
 * 15 sep 2026
 */
export function formatearFechaTarjeta(
  fecha:
    Date,
): string {
  return new Intl.DateTimeFormat(
    "es-US",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    },
  ).format(
    fecha,
  );
}