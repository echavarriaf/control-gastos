import {
  randomUUID,
} from "node:crypto";

import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";

import type {
  FidMulticastMessage,
} from "firebase-admin/messaging";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAdminAuth,
  getAdminDb,
  getAdminMessaging,
} from "@/lib/firebase-admin";

import {
  calcularCarryOverQuincenal,
} from "@/lib/budget/carry-over";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  30;

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

interface MovimientoNormalizado {
  monto:
    number;

  categoria:
    CategoriaVariable | null;

  periodo:
    string;

  quincena:
    Quincena;
}

interface DatosCarryOver {
  gastos:
    MovimientoNormalizado[];
}

interface AlertaPendiente {
  alertKey:
    string;

  attemptId:
    string;

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

  /*
   * Para una alerta quincenal:
   *
   * saldo =
   * excedenteAnterior + saldoActual
   */
  saldo:
    number;

  limite:
    number;

  saldoActual:
    number;

  excedenteAnterior:
    number;

  limiteEfectivo:
    number;

  excedenteSiguiente:
    number;
}

interface ResultadoEnvio {
  enviados:
    number;

  fallidos:
    number;

  dispositivos:
    number;
}

const DEFAULT_LIMITS:
  LimitesVariables = {
    comida: {
      mensual:
        1200,

      quincenal:
        600,
    },

    gas: {
      mensual:
        200,

      quincenal:
        100,
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
 * Recalcula las alertas del mes y de la quincena actuales.
 *
 * El navegador no controla:
 * - UID;
 * - texto;
 * - destinatarios;
 * - límites.
 *
 * El UID proviene exclusivamente del Firebase ID Token.
 */
export async function POST(
  request:
    NextRequest,
): Promise<NextResponse> {
  if (
    !esSolicitudPermitida(
      request,
    )
  ) {
    return json(
      {
        ok:
          false,

        error:
          "Solicitud no permitida.",
      },
      403,
    );
  }

  const autorizacion =
    await autorizarSolicitud(
      request,
    );

  if (
    "response" in
    autorizacion
  ) {
    return autorizacion.response;
  }

  try {
    const ahora =
      obtenerInfoPeriodo(
        new Date(),
      );

    const [
      limites,
      datos,
    ] =
      await Promise.all([
        cargarLimites(
          autorizacion.uid,
        ),

        cargarDatosCarryOver(
          autorizacion.uid,
          ahora.periodo,
        ),
      ]);

    const alertas =
      await prepararAlertas({
        uid:
          autorizacion.uid,

        periodo:
          ahora.periodo,

        quincena:
          ahora.quincena,

        limites,

        datos,
      });

    if (
      alertas.length ===
      0
    ) {
      return json({
        ok:
          true,

        periodo:
          ahora.periodo,

        quincena:
          ahora.quincena,

        evaluadas:
          4,

        alertas:
          0,

        enviadas:
          0,

        fallidas:
          0,

        dispositivos:
          0,

        mensaje:
          "No hay alertas nuevas.",
      });
    }

    const fids =
      await cargarFidsActivos(
        autorizacion.uid,
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
              autorizacion.uid,
              alerta,
              "No hay dispositivos push activos.",
            ),
        ),
      );

      return json({
        ok:
          true,

        periodo:
          ahora.periodo,

        quincena:
          ahora.quincena,

        evaluadas:
          4,

        alertas:
          alertas.length,

        enviadas:
          0,

        fallidas:
          0,

        dispositivos:
          0,

        mensaje:
          "No hay dispositivos push activos.",
      });
    }

    let enviados =
      0;

    let fallidos =
      0;

    for (
      const alerta
      of alertas
    ) {
      try {
        const resultado =
          await enviarAlerta(
            autorizacion.uid,
            alerta,
            fids,
          );

        enviados +=
          resultado.enviados;

        fallidos +=
          resultado.fallidos;

        await marcarAlertaEntregada(
          autorizacion.uid,
          alerta,
          resultado,
        );
      } catch (
        error
      ) {
        fallidos +=
          fids.length;

        await liberarAlertaParaReintento(
          autorizacion.uid,
          alerta,
          obtenerMensajeError(
            error,
          ),
        );

        console.error(
          "Error enviando alerta push:",
          {
            alertKey:
              alerta.alertKey,

            error,
          },
        );
      }
    }

    return json({
      ok:
        true,

      periodo:
        ahora.periodo,

      quincena:
        ahora.quincena,

      evaluadas:
        4,

      alertas:
        alertas.length,

      enviadas:
        enviados,

      fallidas:
        fallidos,

      dispositivos:
        fids.length,
    });
  } catch (
    error
  ) {
    console.error(
      "No se pudo evaluar el presupuesto:",
      error,
    );

    return json(
      {
        ok:
          false,

        error:
          "No se pudo evaluar el presupuesto.",

        detalle:
          process.env
            .NODE_ENV ===
          "development"
            ? obtenerMensajeError(
                error,
              )
            : undefined,
      },
      500,
    );
  }
}

/**
 * GET nunca debe generar notificaciones.
 */
export async function GET():
  Promise<NextResponse> {
  return json(
    {
      ok:
        false,

      error:
        "Método no permitido.",
    },
    405,
    {
      Allow:
        "POST",
    },
  );
}

interface PrepararAlertasArgs {
  uid:
    string;

  periodo:
    string;

  quincena:
    Quincena;

  limites:
    LimitesVariables;

  datos:
    DatosCarryOver;
}

async function prepararAlertas({
  uid,
  periodo,
  quincena,
  limites,
  datos,
}: PrepararAlertasArgs): Promise<
  AlertaPendiente[]
> {
  const alertas:
    AlertaPendiente[] =
    [];

  /*
   * IMPORTANTE:
   *
   * Los pagos de tarjeta NO restauran el presupuesto
   * variable de Comida/Gas.
   */
  const gastosPeriodo =
    datos.gastos.filter(
      (
        movimiento,
      ) =>
        movimiento
          .periodo ===
        periodo,
    );

  /*
   * El carry utiliza todo el historial disponible anterior
   * a la quincena evaluada.
   */
  const movimientosCarryOver =
    datos.gastos.flatMap(
      (
        movimiento,
      ) =>
        movimiento
          .categoria
          ? [
              {
                categoria:
                  movimiento
                    .categoria,

                monto:
                  movimiento
                    .monto,

                periodo:
                  movimiento
                    .periodo,

                quincena:
                  movimiento
                    .quincena,
              },
            ]
          : [],
    );

  const carryOver =
    calcularCarryOverQuincenal({
      movimientos:
        movimientosCarryOver,

      limites,

      periodoObjetivo:
        periodo,

      quincenaObjetivo:
        quincena,
    });

  for (
    const categoria
    of CATEGORY_KEYS
  ) {
    /*
     * ========================================================
     * MENSUAL
     * ========================================================
     */
    const gastosCategoriaMes =
      gastosPeriodo.filter(
        (
          movimiento,
        ) =>
          movimiento
            .categoria ===
          categoria,
      );

    const saldoMensual =
      sumarMontos(
        gastosCategoriaMes,
      );

    const alertaMensual =
      await reclamarAlerta({
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

    /*
     * ========================================================
     * QUINCENAL + CARRY
     * ========================================================
     */
    const detalle =
      carryOver[
        categoria
      ];

    const alertaQuincenal =
      await reclamarAlerta({
        uid,

        categoria,

        periodo,

        alcance:
          "quincenal",

        quincena,

        /*
         * Para decidir 90/100 usamos:
         *
         * carry anterior + gasto actual
         */
        saldo:
          detalle
            .consumoAjustadoQuincena,

        limite:
          detalle
            .limiteQuincenalBase,

        saldoActual:
          detalle
            .saldoQuincena,

        excedenteAnterior:
          detalle
            .excedenteAnterior,

        limiteEfectivo:
          detalle
            .limiteQuincenalEfectivo,

        excedenteSiguiente:
          detalle
            .excedenteSiguiente,
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

interface ReclamarAlertaArgs {
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

  saldoActual?:
    number;

  excedenteAnterior?:
    number;

  limiteEfectivo?:
    number;

  excedenteSiguiente?:
    number;
}

/**
 * Reclama temporalmente una alerta mediante una transacción.
 *
 * Esto evita que dos solicitudes simultáneas envíen
 * el mismo push.
 */
async function reclamarAlerta({
  uid,
  categoria,
  periodo,
  alcance,
  quincena,
  saldo,
  limite,

  saldoActual =
    saldo,

  excedenteAnterior =
    0,

  limiteEfectivo =
    limite,

  excedenteSiguiente =
    Math.max(
      saldo -
        limite,
      0,
    ),
}: ReclamarAlertaArgs): Promise<
  AlertaPendiente | null
> {
  if (
    limite <= 0
  ) {
    return null;
  }

  const porcentaje =
    (
      saldo /
      limite
    ) * 100;

  const nivel =
    obtenerNivelAlerta(
      porcentaje,
    );

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
    getAdminDb()
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
            anterior
              ?.nivel,
          );

        const entregaPendiente =
          anterior
            ?.deliveryPending ===
          true;

        const leaseUntil =
          convertirTimestampMilisegundos(
            anterior
              ?.leaseUntil,
          );

        const leaseActivo =
          entregaPendiente &&
          leaseUntil >
            Date.now();

        /*
         * Volver por debajo de 90% reinicia el ciclo.
         */
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

                saldoActual,

                excedenteAnterior,

                limiteEfectivo,

                excedenteSiguiente,

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

        /*
         * No repetir:
         *
         * 90 -> 90
         * 100 -> 100
         * 100 -> 90
         *
         * Sí enviar:
         *
         * 90 -> 100
         */
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
            nivel,

            deliveryPending:
              true,

            attemptId,

            leaseUntil:
              Timestamp
                .fromMillis(
                  Date.now() +
                    DELIVERY_LEASE_MS,
                ),

            porcentaje,

            saldo,

            limite,

            saldoActual,

            excedenteAnterior,

            limiteEfectivo,

            excedenteSiguiente,

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
    alertKey,

    attemptId,

    categoria,

    alcance,

    quincena,

    nivel,

    porcentaje,

    saldo,

    limite,

    saldoActual,

    excedenteAnterior,

    limiteEfectivo,

    excedenteSiguiente,
  };
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
    getAdminDb()
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
        alerta
          .alertKey,
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
          actual
            ?.attemptId !==
          alerta
            .attemptId
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
              resultado
                .enviados,

            failureCount:
              resultado
                .fallidos,

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
    getAdminDb()
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
        alerta
          .alertKey,
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
          actual
            ?.attemptId !==
          alerta
            .attemptId
        ) {
          return;
        }

        transaction.set(
          referencia,
          {
            deliveryPending:
              true,

            leaseUntil:
              Timestamp
                .fromMillis(
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

    const message:
      FidMulticastMessage = {
        fids:
          batchFids,

        data,

        webpush: {
          headers: {
            Urgency:
              alerta
                .nivel ===
              "100"
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
      response
        .successCount;

    fallidos +=
      response
        .failureCount;

    const invalidos:
      string[] =
      [];

    response.responses
      .forEach(
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
            resultado
              .error
              ?.code ??
            "";

          console.warn(
            "Falló el envío a un dispositivo:",
            {
              fid,

              code,

              message:
                resultado
                  .error
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
): Record<
  string,
  string
> {
  const label =
    CATEGORY_LABELS[
      alerta
        .categoria
    ];

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
    alerta.alcance ===
    "quincenal"
      ? crearCuerpoAlertaQuincenal(
          alerta,
        )
      : alerta.nivel ===
          "100"
        ? `Has usado ${formatoMoneda(
            alerta
              .saldo,
          )} de ${formatoMoneda(
            alerta
              .limite,
          )} este mes. Exceso: ${formatoMoneda(
            excedente,
          )}.`
        : `Has usado ${alerta.porcentaje.toFixed(
            0,
          )}% de ${label} este mes. Quedan ${formatoMoneda(
            disponible,
          )}.`;

  return {
    title,

    body,

    url:
      "/",

    tag:
      `${alerta.alertKey}_${alerta.nivel}`,

    categoria:
      alerta
        .categoria,

    alcance:
      alerta
        .alcance,

    quincena:
      alerta
        .quincena
        ?.toString() ??
      "",

    nivel:
      alerta
        .nivel,

    porcentaje:
      alerta
        .porcentaje
        .toFixed(
          2,
        ),

    saldo:
      alerta
        .saldo
        .toFixed(
          2,
        ),

    limite:
      alerta
        .limite
        .toFixed(
          2,
        ),

    saldoActual:
      alerta
        .saldoActual
        .toFixed(
          2,
        ),

    excedenteAnterior:
      alerta
        .excedenteAnterior
        .toFixed(
          2,
        ),

    limiteEfectivo:
      alerta
        .limiteEfectivo
        .toFixed(
          2,
        ),

    excedenteSiguiente:
      alerta
        .excedenteSiguiente
        .toFixed(
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

function crearCuerpoAlertaQuincenal(
  alerta:
    AlertaPendiente,
): string {
  const label =
    CATEGORY_LABELS[
      alerta
        .categoria
    ];

  const nombreQuincena =
    alerta.quincena ===
    1
      ? "primera"
      : "segunda";

  const tieneArrastre =
    alerta
      .excedenteAnterior >
    0;

  const disponible =
    Math.max(
      alerta.limite -
        alerta.saldo,
      0,
    );

  if (
    alerta.nivel ===
      "100" &&
    tieneArrastre
  ) {
    return `Arrastras ${formatoMoneda(
      alerta
        .excedenteAnterior,
    )} y gastaste ${formatoMoneda(
      alerta
        .saldoActual,
    )} en la ${nombreQuincena} quincena. Total comprometido: ${formatoMoneda(
      alerta
        .saldo,
    )} de ${formatoMoneda(
      alerta
        .limite,
    )}. Pasan ${formatoMoneda(
      alerta
        .excedenteSiguiente,
    )} a la próxima quincena.`;
  }

  if (
    alerta.nivel ===
    "100"
  ) {
    return `Has gastado ${formatoMoneda(
      alerta
        .saldoActual,
    )} de ${label} en la ${nombreQuincena} quincena, sobre un límite de ${formatoMoneda(
      alerta
        .limite,
    )}. Pasan ${formatoMoneda(
      alerta
        .excedenteSiguiente,
    )} a la próxima quincena.`;
  }

  if (
    tieneArrastre
  ) {
    return `Arrastras ${formatoMoneda(
      alerta
        .excedenteAnterior,
    )}. Tu límite efectivo de ${label} en la ${nombreQuincena} quincena es ${formatoMoneda(
      alerta
        .limiteEfectivo,
    )}. Has gastado ${formatoMoneda(
      alerta
        .saldoActual,
    )} y quedan ${formatoMoneda(
      disponible,
    )}.`;
  }

  return `Has utilizado ${alerta.porcentaje.toFixed(
    0,
  )}% del límite de ${label} en la ${nombreQuincena} quincena. Quedan ${formatoMoneda(
    disponible,
  )}.`;
}

async function cargarFidsActivos(
  uid:
    string,
): Promise<
  string[]
> {
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
    const fid
    of fids
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

async function cargarLimites(
  uid:
    string,
): Promise<
  LimitesVariables
> {
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
        limites
          ?.comida,

        DEFAULT_LIMITS
          .comida,
      ),

    gas:
      normalizarLimite(
        limites
          ?.gas,

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
        record
          .mensual,

        fallback
          .mensual,
      ),

    quincenal:
      normalizarNumero(
        record
          .quincenal,

        fallback
          .quincenal,
      ),
  };
}

/**
 * Lee todos los gastos anteriores al final del período
 * evaluado porque el carry puede venir de meses anteriores.
 *
 * No se leen pagosTarjeta porque pagar una tarjeta
 * no restaura el presupuesto variable.
 */
async function cargarDatosCarryOver(
  uid:
    string,

  periodo:
    string,
): Promise<
  DatosCarryOver
> {
  const {
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
        "<",
        finBusqueda,
      )
      .get();

  const gastos =
    gastosSnapshot
      .docs
      .flatMap(
        (
          documento,
        ) => {
          const movimiento =
            normalizarMovimiento(
              documento
                .data(),
            );

          return movimiento
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

function normalizarMovimiento(
  data:
    DocumentData,
): MovimientoNormalizado | null {
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
    MovimientoNormalizado[],
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
    Number(
      obtenerParte(
        parts,
        "day",
      ),
    );

  return {
    periodo:
      `${year}-${month}`,

    quincena:
      day <=
      15
        ? 1
        : 2,
  };
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

  /*
   * Margen para cubrir diferencias entre UTC
   * y America/New_York.
   */
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
          month - 1,
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
    typeof value
      .toDate ===
      "function"
  ) {
    const fecha =
      value.toDate();

    return fecha instanceof
      Date &&
      !Number.isNaN(
        fecha.getTime(),
      )
      ? fecha
      : null;
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
    return value.toMillis();
  }

  if (
    esObjeto(
      value,
    ) &&
    typeof value
      .toMillis ===
      "function"
  ) {
    const result =
      value.toMillis();

    return typeof result ===
      "number"
      ? result
      : 0;
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
    numero >= 0
  )
    ? numero
    : fallback;
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
    value !== null
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

type ResultadoAutorizacion =
  | {
      ok:
        true;

      uid:
        string;
    }
  | {
      ok:
        false;

      response:
        NextResponse;
    };

/**
 * Verifica el Firebase ID Token enviado por el navegador
 * y confirma que el usuario continúa activo en allowedUsers.
 */
async function autorizarSolicitud(
  request:
    NextRequest,
): Promise<
  ResultadoAutorizacion
> {
  const authorizationHeader =
    request.headers.get(
      "authorization",
    );

  if (
    !authorizationHeader
      ?.startsWith(
        "Bearer ",
      )
  ) {
    return {
      ok:
        false,

      response:
        json(
          {
            ok:
              false,

            error:
              "Se requiere autenticación.",
          },
          401,
          {
            "WWW-Authenticate":
              "Bearer",
          },
        ),
    };
  }

  const idToken =
    authorizationHeader
      .slice(
        "Bearer ".length,
      )
      .trim();

  if (
    !idToken
  ) {
    return {
      ok:
        false,

      response:
        json(
          {
            ok:
              false,

            error:
              "El token de autenticación está vacío.",
          },
          401,
          {
            "WWW-Authenticate":
              "Bearer",
          },
        ),
    };
  }

  try {
    const decodedToken =
      await getAdminAuth()
        .verifyIdToken(
          idToken,
          true,
        );

    const authorizationSnapshot =
      await getAdminDb()
        .collection(
          "allowedUsers",
        )
        .doc(
          decodedToken
            .uid,
        )
        .get();

    const authorized =
      authorizationSnapshot
        .exists &&
      authorizationSnapshot
        .data()
        ?.activo ===
        true;

    if (
      !authorized
    ) {
      return {
        ok:
          false,

        response:
          json(
            {
              ok:
                false,

              error:
                "Esta cuenta no tiene acceso a la evaluación de alertas.",
            },
            403,
          ),
      };
    }

    return {
      ok:
        true,

      uid:
        decodedToken
          .uid,
    };
  } catch (
    error
  ) {
    console.warn(
      "Token Firebase inválido o revocado:",
      obtenerMensajeError(
        error,
      ),
    );

    return {
      ok:
        false,

      response:
        json(
          {
            ok:
              false,

            error:
              "La sesión no es válida o expiró.",
          },
          401,
          {
            "WWW-Authenticate":
              "Bearer",
          },
        ),
    };
  }
}

/**
 * Acepta únicamente POST originado desde la misma aplicación.
 */
function esSolicitudPermitida(
  request:
    NextRequest,
): boolean {
  const requestOrigin =
    new URL(
      request.url,
    ).origin;

  const origin =
    request.headers.get(
      "origin",
    ) ??
    obtenerOriginDesdeReferer(
      request.headers.get(
        "referer",
      ),
    );

  if (
    !origin
  ) {
    return false;
  }

  const configuredOrigin =
    normalizarOrigin(
      process.env
        .NEXT_PUBLIC_APP_URL,
    );

  const allowedOrigins =
    new Set(
      [
        requestOrigin,
        configuredOrigin,
      ].filter(
        (
          value,
        ): value is string =>
          Boolean(
            value,
          ),
      ),
    );

  if (
    !allowedOrigins.has(
      origin,
    )
  ) {
    return false;
  }

  const fetchSite =
    request.headers.get(
      "sec-fetch-site",
    );

  return (
    !fetchSite ||
    fetchSite ===
      "same-origin" ||
    fetchSite ===
      "same-site" ||
    fetchSite ===
      "none"
  );
}

function obtenerOriginDesdeReferer(
  referer:
    string | null,
): string | null {
  if (
    !referer
  ) {
    return null;
  }

  try {
    return new URL(
      referer,
    ).origin;
  } catch {
    return null;
  }
}

function normalizarOrigin(
  value:
    string | undefined,
): string | null {
  if (
    !value
  ) {
    return null;
  }

  try {
    return new URL(
      value,
    ).origin;
  } catch {
    return null;
  }
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

function json(
  body:
    Record<
      string,
      unknown
    >,

  status =
    200,

  headers?:
    Record<
      string,
      string
    >,
): NextResponse {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",

        ...headers,
      },
    },
  );
}