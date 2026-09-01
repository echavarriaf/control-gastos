import { randomUUID } from "node:crypto";

import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";

import type {
  FidMulticastMessage,
} from "firebase-admin/messaging";

import {
  getAdminDb,
  getAdminMessaging,
} from "@/lib/firebase-admin";

const TIME_ZONE =
  "America/New_York";

const DEVICE_COLLECTION =
  "notificationDevices";

const ALERT_STATE_COLLECTION =
  "notificationAlertStates";

const ALERT_THRESHOLD =
  90;

const EXCEEDED_THRESHOLD =
  100;

const DELIVERY_LEASE_MS =
  60_000;

const MAX_FIDS_PER_BATCH =
  500;

const DIAS_ANTICIPACION_PAGO_TARJETA =
  5;

const TOLERANCIA_SALDO =
  0.005;

const CATEGORY_KEYS = [
  "comida",
  "gas",
] as const;

type CategoriaVariable =
  (typeof CATEGORY_KEYS)[number];

type Quincena =
  1 | 2;

type AlcanceAlerta =
  | "mensual"
  | "quincenal";

type NivelAlerta =
  | "normal"
  | "90"
  | "100";

type TipoAlertaTarjeta =
  | "principal"
  | "adicional";

type EstadoVentanaTarjeta =
  | "pagar_ahora"
  | "corte_hoy";

interface LimiteCategoria {
  mensual:
    number;

  quincenal:
    number;
}

interface LimitesVariables {
  comida:
    LimiteCategoria;

  gas:
    LimiteCategoria;
}

interface PeriodInfo {
  periodo:
    string;

  quincena:
    Quincena;
}

interface MovimientoPresupuestoNormalizado {
  monto:
    number;

  categoria:
    CategoriaVariable | null;

  periodo:
    string;

  quincena:
    Quincena;
}

interface DatosPeriodo {
  gastos:
    MovimientoPresupuestoNormalizado[];
}

interface AlertaBase {
  alertKey:
    string;

  attemptId:
    string;
}

interface AlertaPresupuestoPendiente
  extends AlertaBase {
  tipo:
    "presupuesto";

  categoria:
    CategoriaVariable;

  alcance:
    AlcanceAlerta;

  quincena:
    Quincena | null;

  nivel:
    Exclude<
      NivelAlerta,
      "normal"
    >;

  porcentaje:
    number;

  saldo:
    number;

  limite:
    number;
}

interface AlertaTarjetaPendiente
  extends AlertaBase {
  tipo:
    "tarjeta";

  tarjetaId:
    string;

  tarjetaNombre:
    string;

  ultimosCuatro:
    string;

  clase:
    TipoAlertaTarjeta;

  estadoVentana:
    EstadoVentanaTarjeta;

  monto:
    number;

  fechaCorteISO:
    string;

  fechaObjetivoPagoISO:
    string;
}

type AlertaPendiente =
  | AlertaPresupuestoPendiente
  | AlertaTarjetaPendiente;

interface ResultadoEnvio {
  enviados:
    number;

  fallidos:
    number;

  dispositivos:
    number;
}

interface TarjetaPush {
  id:
    string;

  nombre:
    string;

  ultimosCuatro:
    string;

  saldoInicial:
    number;

  fechaSaldoInicial:
    string;

  diaCorte:
    number;

  activa:
    boolean;
}

interface MovimientoTarjetaPush {
  id:
    string;

  tipo:
    | "gasto"
    | "pago";

  monto:
    number;

  fecha:
    string;

  creadoEn:
    string;

  tarjetaId:
    string;
}

interface DatosTarjetasPush {
  tarjetas:
    TarjetaPush[];

  movimientos:
    MovimientoTarjetaPush[];
}

interface CalendarioTarjetaPush {
  fechaCorteISO:
    string;

  fechaObjetivoPagoISO:
    string;

  diasHastaCorte:
    number;

  diasHastaPagoObjetivo:
    number;
}

interface PagoPrincipalDetectadoPush {
  pagoId:
    string;

  fecha:
    string;

  creadoEn:
    string;

  montoPago:
    number;

  saldoAntesPago:
    number;

  saldoDespuesPago:
    number;
}

interface CoberturaPrincipalPush {
  corteCubierto:
    boolean;

  pagoPrincipal:
    PagoPrincipalDetectadoPush | null;
}

interface EstadoPagoTarjetaPush {
  calendario:
    CalendarioTarjetaPush;

  saldoActual:
    number;

  corteCubierto:
    boolean;

  montoPrincipal:
    number;

  montoAdicional:
    number;

  requierePrincipal:
    boolean;

  requiereAdicional:
    boolean;

  estadoVentana:
    EstadoVentanaTarjeta | null;
}

export interface EvaluacionAlertasUsuarioResultado {
  uid:
    string;

  periodo:
    string;

  quincena:
    Quincena;

  evaluadas:
    number;

  evaluadasPresupuesto:
    number;

  evaluadasTarjetas:
    number;

  alertas:
    number;

  alertasPresupuesto:
    number;

  alertasTarjetas:
    number;

  enviadas:
    number;

  fallidas:
    number;

  dispositivos:
    number;

  mensaje?:
    string;
}

const DEFAULT_LIMITS:
  LimitesVariables = {
    comida: {
      mensual: 0,
      quincenal: 0,
    },

    gas: {
      mensual: 0,
      quincenal: 0,
    },
  };

const CATEGORY_LABELS:
  Record<
    CategoriaVariable,
    string
  > = {
    comida:
      "Comida",

    gas:
      "Gas",
  };

/**
 * ============================================================
 * API PÚBLICA SERVER-SIDE
 * ============================================================
 *
 * Esta función contiene toda la lógica financiera de push.
 *
 * Puede ser llamada desde:
 *
 * - /api/push/evaluate
 * - /api/cron/push-evaluate
 *
 * No confía en datos calculados por el navegador.
 */
export async function evaluarAlertasUsuario(
  uid:
    string,

  ahora =
    new Date(),
): Promise<EvaluacionAlertasUsuarioResultado> {
  if (
    !uid.trim()
  ) {
    throw new Error(
      "Se requiere un UID válido para evaluar alertas.",
    );
  }

  const infoPeriodo =
    obtenerInfoPeriodo(
      ahora,
    );

  const [
    limites,
    datosPeriodo,
    datosTarjetas,
  ] =
    await Promise.all([
      cargarLimites(
        uid,
      ),

      cargarDatosPeriodo(
        uid,
        infoPeriodo.periodo,
      ),

      cargarDatosTarjetas(
        uid,
      ),
    ]);

  const [
    alertasPresupuesto,
    alertasTarjetas,
  ] =
    await Promise.all([
      prepararAlertasPresupuesto({
        uid,

        periodo:
          infoPeriodo.periodo,

        quincena:
          infoPeriodo.quincena,

        limites,

        datos:
          datosPeriodo,
      }),

      prepararAlertasTarjetas({
        uid,

        ahora,

        datos:
          datosTarjetas,
      }),
    ]);

  const alertas:
    AlertaPendiente[] = [
      ...alertasPresupuesto,
      ...alertasTarjetas,
    ];

  const evaluadasPresupuesto =
    CATEGORY_KEYS.length *
    2;

  const evaluadasTarjetas =
    datosTarjetas
      .tarjetas
      .length *
    2;

  const evaluadas =
    evaluadasPresupuesto +
    evaluadasTarjetas;

  if (
    alertas.length ===
    0
  ) {
    return {
      uid,

      periodo:
        infoPeriodo.periodo,

      quincena:
        infoPeriodo.quincena,

      evaluadas,

      evaluadasPresupuesto,

      evaluadasTarjetas,

      alertas:
        0,

      alertasPresupuesto:
        0,

      alertasTarjetas:
        0,

      enviadas:
        0,

      fallidas:
        0,

      dispositivos:
        0,

      mensaje:
        "No hay alertas nuevas.",
    };
  }

  const fids =
    await cargarFidsActivos(
      uid,
    );

  if (
    fids.length ===
    0
  ) {
    await Promise.all(
      alertas.map(
        (
          alerta,
        ) =>
          liberarAlertaParaReintento(
            uid,
            alerta,
            "No hay dispositivos push activos.",
          ),
      ),
    );

    return {
      uid,

      periodo:
        infoPeriodo.periodo,

      quincena:
        infoPeriodo.quincena,

      evaluadas,

      evaluadasPresupuesto,

      evaluadasTarjetas,

      alertas:
        alertas.length,

      alertasPresupuesto:
        alertasPresupuesto
          .length,

      alertasTarjetas:
        alertasTarjetas
          .length,

      enviadas:
        0,

      fallidas:
        0,

      dispositivos:
        0,

      mensaje:
        "No hay dispositivos push activos.",
    };
  }

  let enviados =
    0;

  let fallidos =
    0;

  for (
    const alerta of
    alertas
  ) {
    try {
      const resultado =
        await enviarAlerta(
          uid,
          alerta,
          fids,
        );

      enviados +=
        resultado.enviados;

      fallidos +=
        resultado.fallidos;

      await marcarAlertaEntregada(
        uid,
        alerta,
        resultado,
      );
    } catch (
      error
    ) {
      fallidos +=
        fids.length;

      await liberarAlertaParaReintento(
        uid,
        alerta,
        obtenerMensajeError(
          error,
        ),
      );

      console.error(
        "Error enviando alerta push:",
        {
          uid,

          alertKey:
            alerta.alertKey,

          tipo:
            alerta.tipo,

          error,
        },
      );
    }
  }

  return {
    uid,

    periodo:
      infoPeriodo.periodo,

    quincena:
      infoPeriodo.quincena,

    evaluadas,

    evaluadasPresupuesto,

    evaluadasTarjetas,

    alertas:
      alertas.length,

    alertasPresupuesto:
      alertasPresupuesto
        .length,

    alertasTarjetas:
      alertasTarjetas
        .length,

    enviadas:
      enviados,

    fallidas:
      fallidos,

    dispositivos:
      fids.length,
  };
}

/**
 * ============================================================
 * ALERTAS DE PRESUPUESTO
 * ============================================================
 */

interface PrepararAlertasPresupuestoArgs {
  uid:
    string;

  periodo:
    string;

  quincena:
    Quincena;

  limites:
    LimitesVariables;

  datos:
    DatosPeriodo;
}

async function prepararAlertasPresupuesto({
  uid,
  periodo,
  quincena,
  limites,
  datos,
}: PrepararAlertasPresupuestoArgs): Promise<
  AlertaPresupuestoPendiente[]
> {
  const alertas:
    AlertaPresupuestoPendiente[] =
      [];

  for (
    const categoria of
    CATEGORY_KEYS
  ) {
    const gastosCategoria =
      datos.gastos.filter(
        (
          movimiento,
        ) =>
          movimiento.categoria ===
          categoria,
      );

    const saldoMensual =
      Math.max(
        sumarMontos(
          gastosCategoria,
        ),
        0,
      );

    const alertaMensual =
      await reclamarAlertaPresupuesto({
        uid,

        categoria,

        periodo,

        alcance:
          "mensual",

        quincena:
          null,

        saldo:
          saldoMensual,

        limite:
          limites[
            categoria
          ].mensual,
      });

    if (
      alertaMensual
    ) {
      alertas.push(
        alertaMensual,
      );
    }

    const gastosQuincena =
      gastosCategoria.filter(
        (
          movimiento,
        ) =>
          movimiento.quincena ===
          quincena,
      );

    const saldoQuincenal =
      Math.max(
        sumarMontos(
          gastosQuincena,
        ),
        0,
      );

    const alertaQuincenal =
      await reclamarAlertaPresupuesto({
        uid,

        categoria,

        periodo,

        alcance:
          "quincenal",

        quincena,

        saldo:
          saldoQuincenal,

        limite:
          limites[
            categoria
          ].quincenal,
      });

    if (
      alertaQuincenal
    ) {
      alertas.push(
        alertaQuincenal,
      );
    }
  }

  return alertas;
}

interface ReclamarAlertaPresupuestoArgs {
  uid:
    string;

  categoria:
    CategoriaVariable;

  periodo:
    string;

  alcance:
    AlcanceAlerta;

  quincena:
    Quincena | null;

  saldo:
    number;

  limite:
    number;
}

async function reclamarAlertaPresupuesto({
  uid,
  categoria,
  periodo,
  alcance,
  quincena,
  saldo,
  limite,
}: ReclamarAlertaPresupuestoArgs): Promise<
  AlertaPresupuestoPendiente | null
> {
  const porcentaje =
    limite > 0
      ? (
          saldo /
          limite
        ) *
        100
      : 0;

  const nivel =
    limite > 0
      ? obtenerNivelAlerta(
          porcentaje,
        )
      : "normal";

  const alertKey = [
    periodo,

    categoria,

    alcance ===
    "mensual"
      ? "mensual"
      : `q${quincena}`,
  ].join(
    "_",
  );

  const attemptId =
    randomUUID();

  const referencia =
    obtenerReferenciaEstadoAlerta(
      uid,
      alertKey,
    );

  let reclamada =
    false;

  await getAdminDb()
    .runTransaction(
      async (
        transaction,
      ) => {
        const snapshot =
          await transaction.get(
            referencia,
          );

        const anterior =
          snapshot.data();

        const nivelAnterior =
          normalizarNivel(
            anterior?.nivel,
          );

        const entregaPendiente =
          anterior
            ?.deliveryPending ===
          true;

        const leaseUntil =
          convertirTimestampMilisegundos(
            anterior?.leaseUntil,
          );

        const leaseActivo =
          entregaPendiente &&
          leaseUntil >
            Date.now();

        if (
          nivel ===
          "normal"
        ) {
          if (
            nivelAnterior !==
              "normal" ||
            entregaPendiente
          ) {
            transaction.set(
              referencia,
              {
                tipo:
                  "presupuesto",

                nivel:
                  "normal",

                deliveryPending:
                  false,

                leaseUntil:
                  null,

                attemptId:
                  null,

                porcentaje,

                saldo,

                limite,

                updatedAt:
                  FieldValue
                    .serverTimestamp(),
              },
              {
                merge:
                  true,
              },
            );
          }

          return;
        }

        if (
          leaseActivo
        ) {
          return;
        }

        if (
          !entregaPendiente &&
          nivelNumerico(
            nivel,
          ) <=
            nivelNumerico(
              nivelAnterior,
            )
        ) {
          return;
        }

        reclamada =
          true;

        transaction.set(
          referencia,
          {
            tipo:
              "presupuesto",

            nivel,

            deliveryPending:
              true,

            attemptId,

            leaseUntil:
              Timestamp.fromMillis(
                Date.now() +
                  DELIVERY_LEASE_MS,
              ),

            porcentaje,

            saldo,

            limite,

            lastAttemptAt:
              FieldValue
                .serverTimestamp(),

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );
      },
    );

  if (
    !reclamada ||
    nivel ===
      "normal"
  ) {
    return null;
  }

  return {
    tipo:
      "presupuesto",

    alertKey,

    attemptId,

    categoria,

    alcance,

    quincena,

    nivel,

    porcentaje,

    saldo,

    limite,
  };
}

/**
 * ============================================================
 * ALERTAS DE TARJETAS
 * ============================================================
 */

interface PrepararAlertasTarjetasArgs {
  uid:
    string;

  ahora:
    Date;

  datos:
    DatosTarjetasPush;
}

async function prepararAlertasTarjetas({
  uid,
  ahora,
  datos,
}: PrepararAlertasTarjetasArgs): Promise<
  AlertaTarjetaPendiente[]
> {
  const alertas:
    AlertaTarjetaPendiente[] =
      [];

  const hoyISO =
    obtenerFechaZonaHorariaISO(
      ahora,
    );

  for (
    const tarjeta of
    datos.tarjetas
  ) {
    const movimientos =
      datos.movimientos.filter(
        (
          movimiento,
        ) =>
          movimiento.tarjetaId ===
          tarjeta.id,
      );

    const estado =
      calcularEstadoPagoTarjeta({
        tarjeta,

        movimientos,

        hoyISO,
      });

    const principal =
      await reclamarAlertaTarjeta({
        uid,

        tarjeta,

        clase:
          "principal",

        activa:
          estado.requierePrincipal,

        monto:
          estado.montoPrincipal,

        calendario:
          estado.calendario,

        estadoVentana:
          estado.estadoVentana,
      });

    if (
      principal
    ) {
      alertas.push(
        principal,
      );
    }

    const adicional =
      await reclamarAlertaTarjeta({
        uid,

        tarjeta,

        clase:
          "adicional",

        activa:
          estado.requiereAdicional,

        monto:
          estado.montoAdicional,

        calendario:
          estado.calendario,

        estadoVentana:
          estado.estadoVentana,
      });

    if (
      adicional
    ) {
      alertas.push(
        adicional,
      );
    }
  }

  return alertas;
}

interface CalcularEstadoPagoTarjetaArgs {
  tarjeta:
    TarjetaPush;

  movimientos:
    MovimientoTarjetaPush[];

  hoyISO:
    string;
}

function calcularEstadoPagoTarjeta({
  tarjeta,
  movimientos,
  hoyISO,
}: CalcularEstadoPagoTarjetaArgs): EstadoPagoTarjetaPush {
  const calendario =
    calcularCalendarioTarjeta(
      tarjeta.diaCorte,
      hoyISO,
    );

  const movimientosOrdenados =
    movimientos
      .filter(
        (
          movimiento,
        ) =>
          movimiento.fecha >=
            tarjeta.fechaSaldoInicial &&
          movimiento.fecha <=
            hoyISO,
      )
      .sort(
        ordenarMovimientosTarjeta,
      );

  const saldoActual =
    calcularSaldoActualTarjeta(
      tarjeta,
      movimientosOrdenados,
    );

  const dentroVentana =
    calendario
      .diasHastaPagoObjetivo <=
      0 &&
    calendario
      .diasHastaCorte >=
      0;

  const estadoVentana:
    EstadoVentanaTarjeta | null =
      !dentroVentana
        ? null
        : calendario
              .diasHastaCorte ===
            0
          ? "corte_hoy"
          : "pagar_ahora";

  if (
    !tarjeta.activa ||
    !dentroVentana ||
    !estadoVentana
  ) {
    return {
      calendario,

      saldoActual,

      corteCubierto:
        false,

      montoPrincipal:
        0,

      montoAdicional:
        0,

      requierePrincipal:
        false,

      requiereAdicional:
        false,

      estadoVentana:
        null,
    };
  }

  const cobertura =
    evaluarCoberturaPrincipal({
      tarjeta,

      movimientos:
        movimientosOrdenados,

      hoyISO,

      calendario,
    });

  if (
    !cobertura
      .corteCubierto
  ) {
    const montoPrincipal =
      redondearMoneda(
        Math.max(
          saldoActual,
          0,
        ),
      );

    return {
      calendario,

      saldoActual,

      corteCubierto:
        false,

      montoPrincipal,

      montoAdicional:
        0,

      requierePrincipal:
        montoPrincipal >
        TOLERANCIA_SALDO,

      requiereAdicional:
        false,

      estadoVentana,
    };
  }

  const montoAdicional =
    calcularSaldoAdicional({
      movimientos:
        movimientosOrdenados,

      hoyISO,

      calendario,

      cobertura,
    });

  return {
    calendario,

    saldoActual,

    corteCubierto:
      true,

    montoPrincipal:
      0,

    montoAdicional,

    requierePrincipal:
      false,

    requiereAdicional:
      montoAdicional >
      TOLERANCIA_SALDO,

    estadoVentana,
  };
}

function calcularSaldoActualTarjeta(
  tarjeta:
    TarjetaPush,

  movimientos:
    MovimientoTarjetaPush[],
): number {
  let saldo =
    redondearMoneda(
      tarjeta.saldoInicial,
    );

  for (
    const movimiento of
    movimientos
  ) {
    saldo =
      redondearMoneda(
        movimiento.tipo ===
        "gasto"
          ? saldo +
              movimiento.monto
          : saldo -
              movimiento.monto,
      );
  }

  return redondearMoneda(
    Math.max(
      saldo,
      0,
    ),
  );
}

interface EvaluarCoberturaPrincipalArgs {
  tarjeta:
    TarjetaPush;

  movimientos:
    MovimientoTarjetaPush[];

  hoyISO:
    string;

  calendario:
    CalendarioTarjetaPush;
}

function evaluarCoberturaPrincipal({
  tarjeta,
  movimientos,
  hoyISO,
  calendario,
}: EvaluarCoberturaPrincipalArgs): CoberturaPrincipalPush {
  const fechaObjetivoISO =
    calendario
      .fechaObjetivoPagoISO;

  const fechaCorteISO =
    calendario
      .fechaCorteISO;

  let saldo =
    redondearMoneda(
      tarjeta.saldoInicial,
    );

  let ultimoPagoAnterior:
    PagoPrincipalDetectadoPush | null =
      null;

  for (
    const movimiento of
    movimientos
  ) {
    if (
      movimiento.fecha >=
      fechaObjetivoISO
    ) {
      break;
    }

    if (
      movimiento.fecha >
      hoyISO
    ) {
      break;
    }

    if (
      movimiento.tipo ===
      "gasto"
    ) {
      saldo =
        redondearMoneda(
          saldo +
            movimiento.monto,
        );

      continue;
    }

    const saldoAntesPago =
      saldo;

    saldo =
      redondearMoneda(
        saldo -
          movimiento.monto,
      );

    if (
      saldo <=
      TOLERANCIA_SALDO
    ) {
      ultimoPagoAnterior =
        crearPagoPrincipalPush(
          movimiento,
          saldoAntesPago,
          saldo,
        );
    }
  }

  const saldoAlInicioVentana =
    redondearMoneda(
      Math.max(
        saldo,
        0,
      ),
    );

  if (
    saldoAlInicioVentana <=
    TOLERANCIA_SALDO
  ) {
    return {
      corteCubierto:
        true,

      pagoPrincipal:
        ultimoPagoAnterior,
    };
  }

  for (
    const movimiento of
    movimientos
  ) {
    if (
      movimiento.fecha <
      fechaObjetivoISO
    ) {
      continue;
    }

    if (
      movimiento.fecha >
      hoyISO
    ) {
      break;
    }

    if (
      movimiento.fecha >
      fechaCorteISO
    ) {
      break;
    }

    if (
      movimiento.tipo ===
      "gasto"
    ) {
      saldo =
        redondearMoneda(
          saldo +
            movimiento.monto,
        );

      continue;
    }

    const saldoAntesPago =
      saldo;

    saldo =
      redondearMoneda(
        saldo -
          movimiento.monto,
      );

    if (
      saldo <=
      TOLERANCIA_SALDO
    ) {
      return {
        corteCubierto:
          true,

        pagoPrincipal:
          crearPagoPrincipalPush(
            movimiento,
            saldoAntesPago,
            saldo,
          ),
      };
    }
  }

  return {
    corteCubierto:
      false,

    pagoPrincipal:
      null,
  };
}

function crearPagoPrincipalPush(
  movimiento:
    MovimientoTarjetaPush,

  saldoAntesPago:
    number,

  saldoDespuesPago:
    number,
): PagoPrincipalDetectadoPush {
  return {
    pagoId:
      movimiento.id,

    fecha:
      movimiento.fecha,

    creadoEn:
      movimiento.creadoEn,

    montoPago:
      movimiento.monto,

    saldoAntesPago:
      redondearMoneda(
        Math.max(
          saldoAntesPago,
          0,
        ),
      ),

    saldoDespuesPago:
      redondearMoneda(
        saldoDespuesPago,
      ),
  };
}

interface CalcularSaldoAdicionalArgs {
  movimientos:
    MovimientoTarjetaPush[];

  hoyISO:
    string;

  calendario:
    CalendarioTarjetaPush;

  cobertura:
    CoberturaPrincipalPush;
}

function calcularSaldoAdicional({
  movimientos,
  hoyISO,
  calendario,
  cobertura,
}: CalcularSaldoAdicionalArgs): number {
  let indiceInicio =
    0;

  if (
    cobertura.pagoPrincipal
  ) {
    const indicePago =
      movimientos.findIndex(
        (
          movimiento,
        ) =>
          movimiento.tipo ===
            "pago" &&
          movimiento.id ===
            cobertura
              .pagoPrincipal
              ?.pagoId,
      );

    if (
      indicePago >=
      0
    ) {
      indiceInicio =
        indicePago +
        1;
    } else {
      indiceInicio =
        obtenerIndiceInicioPorFecha(
          movimientos,
          calendario
            .fechaObjetivoPagoISO,
        );
    }
  } else {
    indiceInicio =
      obtenerIndiceInicioPorFecha(
        movimientos,
        calendario
          .fechaObjetivoPagoISO,
      );
  }

  let saldoPosterior =
    cobertura
      .pagoPrincipal
      ?.saldoDespuesPago ??
    0;

  for (
    let index =
      indiceInicio;

    index <
    movimientos.length;

    index +=
      1
  ) {
    const movimiento =
      movimientos[
        index
      ];

    if (
      movimiento.fecha >
      hoyISO
    ) {
      break;
    }

    if (
      movimiento.fecha >
      calendario
        .fechaCorteISO
    ) {
      break;
    }

    saldoPosterior =
      redondearMoneda(
        movimiento.tipo ===
        "gasto"
          ? saldoPosterior +
              movimiento.monto
          : saldoPosterior -
              movimiento.monto,
      );
  }

  return redondearMoneda(
    Math.max(
      saldoPosterior,
      0,
    ),
  );
}

function obtenerIndiceInicioPorFecha(
  movimientos:
    MovimientoTarjetaPush[],

  fechaISO:
    string,
): number {
  const index =
    movimientos.findIndex(
      (
        movimiento,
      ) =>
        movimiento.fecha >=
        fechaISO,
    );

  return index >=
    0
    ? index
    : movimientos.length;
}

function ordenarMovimientosTarjeta(
  a:
    MovimientoTarjetaPush,

  b:
    MovimientoTarjetaPush,
): number {
  const fechaComparacion =
    a.fecha.localeCompare(
      b.fecha,
    );

  if (
    fechaComparacion !==
    0
  ) {
    return fechaComparacion;
  }

  const creadoComparacion =
    a.creadoEn.localeCompare(
      b.creadoEn,
    );

  if (
    creadoComparacion !==
    0
  ) {
    return creadoComparacion;
  }

  if (
    a.tipo !==
    b.tipo
  ) {
    return a.tipo ===
      "gasto"
      ? -1
      : 1;
  }

  return a.id.localeCompare(
    b.id,
  );
}

interface ReclamarAlertaTarjetaArgs {
  uid:
    string;

  tarjeta:
    TarjetaPush;

  clase:
    TipoAlertaTarjeta;

  activa:
    boolean;

  monto:
    number;

  calendario:
    CalendarioTarjetaPush;

  estadoVentana:
    EstadoVentanaTarjeta | null;
}

async function reclamarAlertaTarjeta({
  uid,
  tarjeta,
  clase,
  activa,
  monto,
  calendario,
  estadoVentana,
}: ReclamarAlertaTarjetaArgs): Promise<
  AlertaTarjetaPendiente | null
> {
  const alertKey = [
    "tarjeta",
    tarjeta.id,
    calendario.fechaCorteISO,
    clase,
  ].join(
    "_",
  );

  const attemptId =
    randomUUID();

  const referencia =
    obtenerReferenciaEstadoAlerta(
      uid,
      alertKey,
    );

  const montoNormalizado =
    redondearMoneda(
      Math.max(
        monto,
        0,
      ),
    );

  let reclamada =
    false;

  await getAdminDb()
    .runTransaction(
      async (
        transaction,
      ) => {
        const snapshot =
          await transaction.get(
            referencia,
          );

        const anterior =
          snapshot.data();

        const entregaPendiente =
          anterior
            ?.deliveryPending ===
          true;

        const leaseUntil =
          convertirTimestampMilisegundos(
            anterior?.leaseUntil,
          );

        const leaseActivo =
          entregaPendiente &&
          leaseUntil >
            Date.now();

        const estadoAnterior =
          anterior
            ?.estadoAlerta ===
          "activa"
            ? "activa"
            : "normal";

        const faseAnterior =
          normalizarFaseTarjeta(
            anterior?.fase,
          );

        if (
          !activa ||
          !estadoVentana ||
          montoNormalizado <=
            TOLERANCIA_SALDO
        ) {
          if (
            estadoAnterior !==
              "normal" ||
            entregaPendiente
          ) {
            transaction.set(
              referencia,
              {
                tipo:
                  "tarjeta",

                estadoAlerta:
                  "normal",

                fase:
                  null,

                deliveryPending:
                  false,

                leaseUntil:
                  null,

                attemptId:
                  null,

                monto:
                  montoNormalizado,

                fechaCorteISO:
                  calendario
                    .fechaCorteISO,

                fechaObjetivoPagoISO:
                  calendario
                    .fechaObjetivoPagoISO,

                updatedAt:
                  FieldValue
                    .serverTimestamp(),
              },
              {
                merge:
                  true,
              },
            );
          }

          return;
        }

        if (
          leaseActivo
        ) {
          return;
        }

        const mismaFaseEntregada =
          estadoAnterior ===
            "activa" &&
          !entregaPendiente &&
          faseAnterior ===
            estadoVentana;

        const alertaAnteriorMasFuerte =
          estadoAnterior ===
            "activa" &&
          !entregaPendiente &&
          faseAnterior ===
            "corte_hoy";

        if (
          mismaFaseEntregada ||
          alertaAnteriorMasFuerte
        ) {
          return;
        }

        reclamada =
          true;

        transaction.set(
          referencia,
          {
            tipo:
              "tarjeta",

            tarjetaId:
              tarjeta.id,

            tarjetaNombre:
              tarjeta.nombre,

            clase,

            estadoAlerta:
              "activa",

            fase:
              estadoVentana,

            monto:
              montoNormalizado,

            fechaCorteISO:
              calendario
                .fechaCorteISO,

            fechaObjetivoPagoISO:
              calendario
                .fechaObjetivoPagoISO,

            deliveryPending:
              true,

            attemptId,

            leaseUntil:
              Timestamp.fromMillis(
                Date.now() +
                  DELIVERY_LEASE_MS,
              ),

            lastAttemptAt:
              FieldValue
                .serverTimestamp(),

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );
      },
    );

  if (
    !reclamada ||
    !estadoVentana
  ) {
    return null;
  }

  return {
    tipo:
      "tarjeta",

    alertKey,

    attemptId,

    tarjetaId:
      tarjeta.id,

    tarjetaNombre:
      tarjeta.nombre,

    ultimosCuatro:
      tarjeta.ultimosCuatro,

    clase,

    estadoVentana,

    monto:
      montoNormalizado,

    fechaCorteISO:
      calendario
        .fechaCorteISO,

    fechaObjetivoPagoISO:
      calendario
        .fechaObjetivoPagoISO,
  };
}

function normalizarFaseTarjeta(
  value:
    unknown,
): EstadoVentanaTarjeta | null {
  return (
    value ===
      "pagar_ahora" ||
    value ===
      "corte_hoy"
  )
    ? value
    : null;
}

/**
 * ============================================================
 * ESTADO DE ALERTAS
 * ============================================================
 */

function obtenerReferenciaEstadoAlerta(
  uid:
    string,

  alertKey:
    string,
) {
  return getAdminDb()
    .collection(
      "users",
    )
    .doc(
      uid,
    )
    .collection(
      ALERT_STATE_COLLECTION,
    )
    .doc(
      alertKey,
    );
}

async function marcarAlertaEntregada(
  uid:
    string,

  alerta:
    AlertaPendiente,

  resultado:
    ResultadoEnvio,
): Promise<void> {
  const referencia =
    obtenerReferenciaEstadoAlerta(
      uid,
      alerta.alertKey,
    );

  await getAdminDb()
    .runTransaction(
      async (
        transaction,
      ) => {
        const snapshot =
          await transaction.get(
            referencia,
          );

        const actual =
          snapshot.data();

        if (
          actual?.attemptId !==
          alerta.attemptId
        ) {
          return;
        }

        transaction.set(
          referencia,
          {
            deliveryPending:
              false,

            leaseUntil:
              null,

            attemptId:
              null,

            lastSentAt:
              FieldValue
                .serverTimestamp(),

            successCount:
              resultado.enviados,

            failureCount:
              resultado.fallidos,

            lastError:
              null,

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );
      },
    );
}

async function liberarAlertaParaReintento(
  uid:
    string,

  alerta:
    AlertaPendiente,

  error:
    string,
): Promise<void> {
  const referencia =
    obtenerReferenciaEstadoAlerta(
      uid,
      alerta.alertKey,
    );

  await getAdminDb()
    .runTransaction(
      async (
        transaction,
      ) => {
        const snapshot =
          await transaction.get(
            referencia,
          );

        const actual =
          snapshot.data();

        if (
          actual?.attemptId !==
          alerta.attemptId
        ) {
          return;
        }

        transaction.set(
          referencia,
          {
            deliveryPending:
              true,

            leaseUntil:
              Timestamp.fromMillis(
                0,
              ),

            lastError:
              error.slice(
                0,
                500,
              ),

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );
      },
    );
}

/**
 * ============================================================
 * FCM
 * ============================================================
 */

async function enviarAlerta(
  uid:
    string,

  alerta:
    AlertaPendiente,

  fids:
    string[],
): Promise<ResultadoEnvio> {
  const data =
    crearPayloadAlerta(
      alerta,
    );

  let enviados =
    0;

  let fallidos =
    0;

  for (
    let index =
      0;

    index <
    fids.length;

    index +=
      MAX_FIDS_PER_BATCH
  ) {
    const batchFids =
      fids.slice(
        index,
        index +
          MAX_FIDS_PER_BATCH,
      );

    const urgente =
      alerta.tipo ===
      "presupuesto"
        ? alerta.nivel ===
          "100"
        : alerta.estadoVentana ===
          "corte_hoy";

    const message:
      FidMulticastMessage = {
        fids:
          batchFids,

        data,

        webpush: {
          headers: {
            Urgency:
              urgente
                ? "high"
                : "normal",
          },
        },
      };

    const response =
      await getAdminMessaging()
        .sendEachForMulticast(
          message,
        );

    enviados +=
      response.successCount;

    fallidos +=
      response.failureCount;

    const invalidos:
      string[] = [];

    response.responses.forEach(
      (
        resultado,
        responseIndex,
      ) => {
        if (
          resultado.success
        ) {
          return;
        }

        const fid =
          batchFids[
            responseIndex
          ];

        const code =
          resultado.error
            ?.code ??
          "";

        console.warn(
          "Falló el envío a un dispositivo:",
          {
            uid,

            fid,

            code,

            message:
              resultado.error
                ?.message,
          },
        );

        if (
          esFidInvalido(
            code,
          )
        ) {
          invalidos.push(
            fid,
          );
        }
      },
    );

    await desactivarFidsInvalidos(
      uid,
      invalidos,
    );
  }

  return {
    enviados,

    fallidos,

    dispositivos:
      fids.length,
  };
}

function crearPayloadAlerta(
  alerta:
    AlertaPendiente,
): Record<string, string> {
  if (
    alerta.tipo ===
    "tarjeta"
  ) {
    return crearPayloadAlertaTarjeta(
      alerta,
    );
  }

  return crearPayloadAlertaPresupuesto(
    alerta,
  );
}

function crearPayloadAlertaPresupuesto(
  alerta:
    AlertaPresupuestoPendiente,
): Record<string, string> {
  const label =
    CATEGORY_LABELS[
      alerta.categoria
    ];

  const periodoTexto =
    alerta.alcance ===
    "mensual"
      ? "este mes"
      : `en la quincena ${alerta.quincena}`;

  const disponible =
    Math.max(
      alerta.limite -
        alerta.saldo,
      0,
    );

  const excedente =
    Math.max(
      alerta.saldo -
        alerta.limite,
      0,
    );

  const title =
    alerta.nivel ===
    "100"
      ? `🚨 ${label}: límite superado`
      : `⚠️ ${label} llegó al 90%`;

  const body =
    alerta.nivel ===
    "100"
      ? `Has usado ${formatoMoneda(
          alerta.saldo,
        )} de ${formatoMoneda(
          alerta.limite,
        )} ${periodoTexto}. Exceso: ${formatoMoneda(
          excedente,
        )}.`
      : `Has usado ${alerta.porcentaje.toFixed(
          0,
        )}% de ${label} ${periodoTexto}. Quedan ${formatoMoneda(
          disponible,
        )}.`;

  return {
    title,

    body,

    url:
      "/",

    tag:
      `${alerta.alertKey}_${alerta.nivel}`,

    tipo:
      "presupuesto",

    categoria:
      alerta.categoria,

    alcance:
      alerta.alcance,

    quincena:
      alerta.quincena
        ?.toString() ??
      "",

    nivel:
      alerta.nivel,

    porcentaje:
      alerta.porcentaje.toFixed(
        2,
      ),

    saldo:
      alerta.saldo.toFixed(
        2,
      ),

    limite:
      alerta.limite.toFixed(
        2,
      ),

    timestamp:
      Date.now()
        .toString(),

    renotify:
      "true",

    requireInteraction:
      alerta.nivel ===
      "100"
        ? "true"
        : "false",
  };
}

function crearPayloadAlertaTarjeta(
  alerta:
    AlertaTarjetaPendiente,
): Record<string, string> {
  const sufijo =
    alerta.ultimosCuatro
      ? ` •••• ${alerta.ultimosCuatro}`
      : "";

  const fechaCorte =
    formatearFechaCalendario(
      alerta.fechaCorteISO,
    );

  const corteHoy =
    alerta.estadoVentana ===
    "corte_hoy";

  let title:
    string;

  let body:
    string;

  if (
    alerta.clase ===
    "principal"
  ) {
    title =
      corteHoy
        ? `🚨 ${alerta.tarjetaNombre}: pagar hoy`
        : `💳 ${alerta.tarjetaNombre}: pagar ahora`;

    body =
      corteHoy
        ? `El corte es hoy. Paga ${formatoMoneda(
            alerta.monto,
          )} para cubrir el saldo${sufijo}.`
        : `Paga ${formatoMoneda(
            alerta.monto,
          )} antes del corte del ${fechaCorte}${sufijo}.`;
  } else {
    title =
      corteHoy
        ? `🚨 ${alerta.tarjetaNombre}: pago adicional hoy`
        : `💳 ${alerta.tarjetaNombre}: pago adicional`;

    body =
      corteHoy
        ? `Después del pago principal quedaron ${formatoMoneda(
            alerta.monto,
          )} por cubrir antes del corte de hoy${sufijo}.`
        : `Después del pago principal, paga ${formatoMoneda(
            alerta.monto,
          )} adicional antes del corte del ${fechaCorte}${sufijo}.`;
  }

  return {
    title,

    body,

    url:
      "/",

    tag:
      `${alerta.alertKey}_${alerta.estadoVentana}`,

    tipo:
      "tarjeta",

    tarjetaId:
      alerta.tarjetaId,

    tarjetaNombre:
      alerta.tarjetaNombre,

    ultimosCuatro:
      alerta.ultimosCuatro,

    clase:
      alerta.clase,

    estadoVentana:
      alerta.estadoVentana,

    monto:
      alerta.monto.toFixed(
        2,
      ),

    fechaCorteISO:
      alerta.fechaCorteISO,

    fechaObjetivoPagoISO:
      alerta.fechaObjetivoPagoISO,

    timestamp:
      Date.now()
        .toString(),

    renotify:
      "true",

    requireInteraction:
      corteHoy
        ? "true"
        : "false",
  };
}

/**
 * ============================================================
 * DISPOSITIVOS
 * ============================================================
 */

async function cargarFidsActivos(
  uid:
    string,
): Promise<string[]> {
  const snapshot =
    await getAdminDb()
      .collection(
        "users",
      )
      .doc(
        uid,
      )
      .collection(
        DEVICE_COLLECTION,
      )
      .where(
        "activo",
        "==",
        true,
      )
      .get();

  return Array.from(
    new Set(
      snapshot.docs
        .map(
          (
            documento,
          ) => {
            const value =
              documento
                .data()
                .installationId;

            return typeof value ===
              "string"
              ? value.trim()
              : "";
          },
        )
        .filter(
          Boolean,
        ),
    ),
  );
}

async function desactivarFidsInvalidos(
  uid:
    string,

  fids:
    string[],
): Promise<void> {
  if (
    fids.length ===
    0
  ) {
    return;
  }

  const batch =
    getAdminDb()
      .batch();

  for (
    const fid of
    fids
  ) {
    const referencia =
      getAdminDb()
        .collection(
          "users",
        )
        .doc(
          uid,
        )
        .collection(
          DEVICE_COLLECTION,
        )
        .doc(
          encodeURIComponent(
            fid,
          ),
        );

    batch.set(
      referencia,
      {
        activo:
          false,

        motivoDesactivacion:
          "fid_no_registrado",

        desactivadoEn:
          FieldValue
            .serverTimestamp(),

        actualizadoEn:
          FieldValue
            .serverTimestamp(),
      },
      {
        merge:
          true,
      },
    );
  }

  await batch.commit();
}

/**
 * ============================================================
 * PRESUPUESTO
 * ============================================================
 */

async function cargarLimites(
  uid:
    string,
): Promise<LimitesVariables> {
  const snapshot =
    await getAdminDb()
      .collection(
        "users",
      )
      .doc(
        uid,
      )
      .collection(
        "configuracion",
      )
      .doc(
        "presupuestoFelo",
      )
      .get();

  if (
    !snapshot.exists
  ) {
    return DEFAULT_LIMITS;
  }

  const limites =
    snapshot
      .data()
      ?.limites;

  return {
    comida:
      normalizarLimite(
        limites?.comida,
        DEFAULT_LIMITS
          .comida,
      ),

    gas:
      normalizarLimite(
        limites?.gas,
        DEFAULT_LIMITS
          .gas,
      ),
  };
}

function normalizarLimite(
  value:
    unknown,

  fallback:
    LimiteCategoria,
): LimiteCategoria {
  const record =
    esObjeto(
      value,
    )
      ? value
      : {};

  return {
    mensual:
      normalizarNumero(
        record.mensual,
        fallback.mensual,
      ),

    quincenal:
      normalizarNumero(
        record.quincenal,
        fallback.quincenal,
      ),
  };
}

async function cargarDatosPeriodo(
  uid:
    string,

  periodo:
    string,
): Promise<DatosPeriodo> {
  const {
    inicioBusqueda,
    finBusqueda,
  } =
    obtenerRangoBusqueda(
      periodo,
    );

  const gastosSnapshot =
    await getAdminDb()
      .collection(
        "users",
      )
      .doc(
        uid,
      )
      .collection(
        "gastos",
      )
      .where(
        "fecha",
        ">=",
        inicioBusqueda,
      )
      .where(
        "fecha",
        "<",
        finBusqueda,
      )
      .get();

  const gastos =
    gastosSnapshot.docs
      .flatMap(
        (
          documento,
        ) => {
          const movimiento =
            normalizarMovimientoPresupuesto(
              documento.data(),
            );

          return movimiento &&
            movimiento.periodo ===
              periodo
            ? [
                movimiento,
              ]
            : [];
        },
      );

  return {
    gastos,
  };
}

function normalizarMovimientoPresupuesto(
  data:
    DocumentData,
): MovimientoPresupuestoNormalizado | null {
  const fecha =
    convertirFecha(
      data.fecha,
    );

  if (
    !fecha
  ) {
    return null;
  }

  const info =
    obtenerInfoPeriodo(
      fecha,
    );

  return {
    monto:
      normalizarNumero(
        data.monto,
        0,
      ),

    categoria:
      normalizarCategoriaGasto(
        data.categoria,
      ),

    periodo:
      info.periodo,

    quincena:
      info.quincena,
  };
}

function normalizarCategoriaGasto(
  value:
    unknown,
): CategoriaVariable | null {
  if (
    value ===
    "comida"
  ) {
    return "comida";
  }

  if (
    value ===
      "gas" ||
    value ===
      "transporte"
  ) {
    return "gas";
  }

  return null;
}

/**
 * ============================================================
 * TARJETAS
 * ============================================================
 */

async function cargarDatosTarjetas(
  uid:
    string,
): Promise<DatosTarjetasPush> {
  const userRef =
    getAdminDb()
      .collection(
        "users",
      )
      .doc(
        uid,
      );

  const [
    tarjetasSnapshot,
    gastosSnapshot,
    pagosSnapshot,
  ] =
    await Promise.all([
      userRef
        .collection(
          "tarjetasCredito",
        )
        .get(),

      userRef
        .collection(
          "gastos",
        )
        .get(),

      userRef
        .collection(
          "pagosTarjeta",
        )
        .get(),
    ]);

  const tarjetas =
    tarjetasSnapshot.docs
      .flatMap(
        (
          documento,
        ) => {
          const tarjeta =
            normalizarTarjetaPush(
              documento.id,
              documento.data(),
            );

          return tarjeta
            ? [
                tarjeta,
              ]
            : [];
        },
      );

  const gastos =
    gastosSnapshot.docs
      .flatMap(
        (
          documento,
        ) => {
          const movimiento =
            normalizarMovimientoTarjetaPush(
              documento.id,
              documento.data(),
              "gasto",
            );

          return movimiento
            ? [
                movimiento,
              ]
            : [];
        },
      );

  const pagos =
    pagosSnapshot.docs
      .flatMap(
        (
          documento,
        ) => {
          const movimiento =
            normalizarMovimientoTarjetaPush(
              documento.id,
              documento.data(),
              "pago",
            );

          return movimiento
            ? [
                movimiento,
              ]
            : [];
        },
      );

  return {
    tarjetas,

    movimientos: [
      ...gastos,
      ...pagos,
    ],
  };
}

function normalizarTarjetaPush(
  id:
    string,

  data:
    DocumentData,
): TarjetaPush | null {
  const nombre =
    typeof data.nombre ===
    "string"
      ? data.nombre.trim()
      : "";

  const fechaSaldoInicial =
    normalizarFechaDocumento(
      data.fechaSaldoInicial,
    );

  const diaCorte =
    Number(
      data.diaCorte,
    );

  if (
    !nombre ||
    !fechaSaldoInicial ||
    !Number.isInteger(
      diaCorte,
    ) ||
    diaCorte <
      1 ||
    diaCorte >
      31
  ) {
    return null;
  }

  const ultimosCuatro =
    typeof data.ultimosCuatro ===
    "string"
      ? data.ultimosCuatro.trim()
      : "";

  return {
    id,

    nombre,

    ultimosCuatro:
      /^\d{4}$/.test(
        ultimosCuatro,
      )
        ? ultimosCuatro
        : "",

    saldoInicial:
      normalizarNumero(
        data.saldoInicial,
        0,
      ),

    fechaSaldoInicial,

    diaCorte,

    activa:
      data.activa ===
      true,
  };
}

function normalizarMovimientoTarjetaPush(
  id:
    string,

  data:
    DocumentData,

  tipo:
    | "gasto"
    | "pago",
): MovimientoTarjetaPush | null {
  const tarjetaId =
    typeof data.tarjetaId ===
    "string"
      ? data.tarjetaId.trim()
      : "";

  const fecha =
    normalizarFechaDocumento(
      data.fecha,
    );

  if (
    !tarjetaId ||
    !fecha
  ) {
    return null;
  }

  return {
    id,

    tipo,

    monto:
      normalizarNumero(
        data.monto,
        0,
      ),

    fecha,

    creadoEn:
      normalizarCreadoEnServidor(
        data.creadoEn,
        fecha,
      ),

    tarjetaId,
  };
}

function normalizarFechaDocumento(
  value:
    unknown,
): string | null {
  if (
    typeof value ===
    "string"
  ) {
    const match =
      value.match(
        /^(\d{4})-(\d{2})-(\d{2})/,
      );

    if (
      match
    ) {
      const fecha =
        `${match[1]}-${match[2]}-${match[3]}`;

      return esFechaISOValida(
        fecha,
      )
        ? fecha
        : null;
    }
  }

  const fecha =
    convertirFecha(
      value,
    );

  if (
    !fecha
  ) {
    return null;
  }

  return obtenerFechaZonaHorariaISO(
    fecha,
  );
}

function normalizarCreadoEnServidor(
  value:
    unknown,

  fallbackFecha:
    string,
): string {
  if (
    value instanceof
    Timestamp
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (
    typeof value ===
      "string" &&
    value.trim()
  ) {
    return value.trim();
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

      if (
        fecha instanceof
          Date &&
        !Number.isNaN(
          fecha.getTime(),
        )
      ) {
        return fecha
          .toISOString();
      }
    } catch {
      // Usa fallback.
    }
  }

  return `${fallbackFecha}T12:00:00.000Z`;
}

/**
 * ============================================================
 * CALENDARIO DE TARJETAS
 * ============================================================
 */

function calcularCalendarioTarjeta(
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

function esFechaISOValida(
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

function formatearFechaCalendario(
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

/**
 * ============================================================
 * UTILIDADES
 * ============================================================
 */

function obtenerNivelAlerta(
  porcentaje:
    number,
): NivelAlerta {
  if (
    porcentaje >=
    EXCEEDED_THRESHOLD
  ) {
    return "100";
  }

  if (
    porcentaje >=
    ALERT_THRESHOLD
  ) {
    return "90";
  }

  return "normal";
}

function nivelNumerico(
  nivel:
    NivelAlerta,
): number {
  switch (
    nivel
  ) {
    case "100":
      return 2;

    case "90":
      return 1;

    default:
      return 0;
  }
}

function normalizarNivel(
  value:
    unknown,
): NivelAlerta {
  if (
    value ===
      "90" ||
    value ===
      "100"
  ) {
    return value;
  }

  return "normal";
}

function sumarMontos(
  movimientos:
    MovimientoPresupuestoNormalizado[],
): number {
  return movimientos.reduce(
    (
      total,
      movimiento,
    ) =>
      total +
      movimiento.monto,
    0,
  );
}

function obtenerInfoPeriodo(
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

function obtenerFechaZonaHorariaISO(
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

function obtenerRangoBusqueda(
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

function convertirFecha(
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

function convertirTimestampMilisegundos(
  value:
    unknown,
): number {
  if (
    value instanceof
    Timestamp
  ) {
    return value
      .toMillis();
  }

  if (
    esObjeto(
      value,
    ) &&
    typeof value.toMillis ===
      "function"
  ) {
    try {
      const result =
        value.toMillis();

      return typeof result ===
        "number"
        ? result
        : 0;
    } catch {
      return 0;
    }
  }

  return 0;
}

function normalizarNumero(
  value:
    unknown,

  fallback:
    number,
): number {
  const numero =
    Number(
      value,
    );

  return (
    Number.isFinite(
      numero,
    ) &&
    numero >=
      0
  )
    ? numero
    : fallback;
}

function redondearMoneda(
  value:
    number,
): number {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

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

function esObjeto(
  value:
    unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !==
      null
  );
}

function esFidInvalido(
  code:
    string,
): boolean {
  return (
    code.includes(
      "installation-id-not-registered",
    ) ||
    code.includes(
      "registration-token-not-registered",
    ) ||
    code.includes(
      "invalid-registration-token",
    )
  );
}

function formatoMoneda(
  value:
    number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      minimumFractionDigits:
        2,
    },
  ).format(
    value,
  );
}

function obtenerMensajeError(
  error:
    unknown,
): string {
  return error instanceof
    Error
    ? error.message
    : "Error desconocido.";
}