import { randomUUID } from "node:crypto";

import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import type { FidMulticastMessage } from "firebase-admin/messaging";
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminAuth,
  getAdminDb,
  getAdminMessaging,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TIME_ZONE = "America/New_York";
const DEVICE_COLLECTION = "notificationDevices";
const ALERT_STATE_COLLECTION = "notificationAlertStates";

const ALERT_THRESHOLD = 90;
const EXCEEDED_THRESHOLD = 100;
const DELIVERY_LEASE_MS = 60_000;
const MAX_FIDS_PER_BATCH = 500;

const CATEGORY_KEYS = ["comida", "gas"] as const;

type CategoriaVariable = (typeof CATEGORY_KEYS)[number];
type Quincena = 1 | 2;
type AlcanceAlerta = "mensual" | "quincenal";
type NivelAlerta = "normal" | "90" | "100";

interface LimiteCategoria {
  mensual: number;
  quincenal: number;
}

interface LimitesVariables {
  comida: LimiteCategoria;
  gas: LimiteCategoria;
}

interface PeriodInfo {
  periodo: string;
  quincena: Quincena;
}

interface MovimientoNormalizado {
  monto: number;
  categoria: CategoriaVariable | "general" | null;
  periodo: string;
  quincena: Quincena;
}

interface DatosPeriodo {
  gastos: MovimientoNormalizado[];
  pagos: MovimientoNormalizado[];
}

interface AlertaPendiente {
  alertKey: string;
  attemptId: string;
  categoria: CategoriaVariable;
  alcance: AlcanceAlerta;
  quincena: Quincena | null;
  nivel: Exclude<NivelAlerta, "normal">;
  porcentaje: number;
  saldo: number;
  limite: number;
}

interface ResultadoEnvio {
  enviados: number;
  fallidos: number;
  dispositivos: number;
}

const DEFAULT_LIMITS: LimitesVariables = {
  comida: {
    mensual: 1200,
    quincenal: 600,
  },
  gas: {
    mensual: 200,
    quincenal: 100,
  },
};

const CATEGORY_LABELS: Record<CategoriaVariable, string> = {
  comida: "Comida",
  gas: "Gas",
};

/**
 * Recalcula las alertas del mes y de la quincena actuales.
 *
 * El navegador no controla el texto ni los destinatarios.
 * Todos los datos se leen directamente desde Firestore.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  if (!esSolicitudPermitida(request)) {
    return json(
      {
        ok: false,
        error: "Solicitud no permitida.",
      },
      403,
    );
  }

  const autorizacion =
    await autorizarSolicitud(
      request,
    );

  if (!autorizacion.ok) {
    return autorizacion.response;
  }

  try {
    const ahora = obtenerInfoPeriodo(new Date());

    const [limites, datos] = await Promise.all([
      cargarLimites(),
      cargarDatosPeriodo(ahora.periodo),
    ]);

    const alertas = await prepararAlertas({
      periodo: ahora.periodo,
      quincena: ahora.quincena,
      limites,
      datos,
    });

    if (alertas.length === 0) {
      return json({
        ok: true,
        periodo: ahora.periodo,
        quincena: ahora.quincena,
        evaluadas: 4,
        alertas: 0,
        enviadas: 0,
        fallidas: 0,
        dispositivos: 0,
        mensaje: "No hay alertas nuevas.",
      });
    }

    const fids = await cargarFidsActivos();

    if (fids.length === 0) {
      await Promise.all(
        alertas.map((alerta) =>
          liberarAlertaParaReintento(
            alerta,
            "No hay dispositivos push activos.",
          ),
        ),
      );

      return json({
        ok: true,
        periodo: ahora.periodo,
        quincena: ahora.quincena,
        evaluadas: 4,
        alertas: alertas.length,
        enviadas: 0,
        fallidas: 0,
        dispositivos: 0,
        mensaje: "No hay dispositivos push activos.",
      });
    }

    let enviados = 0;
    let fallidos = 0;

    for (const alerta of alertas) {
      try {
        const resultado = await enviarAlerta(alerta, fids);

        enviados += resultado.enviados;
        fallidos += resultado.fallidos;

        await marcarAlertaEntregada(alerta, resultado);
      } catch (error) {
        fallidos += fids.length;

        await liberarAlertaParaReintento(
          alerta,
          obtenerMensajeError(error),
        );

        console.error("Error enviando alerta push:", {
          alertKey: alerta.alertKey,
          error,
        });
      }
    }

    return json({
      ok: true,
      periodo: ahora.periodo,
      quincena: ahora.quincena,
      evaluadas: 4,
      alertas: alertas.length,
      enviadas: enviados,
      fallidas: fallidos,
      dispositivos: fids.length,
    });
  } catch (error) {
    console.error("No se pudo evaluar el presupuesto:", error);

    return json(
      {
        ok: false,
        error: "No se pudo evaluar el presupuesto.",
        detalle:
          process.env.NODE_ENV === "development"
            ? obtenerMensajeError(error)
            : undefined,
      },
      500,
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return json(
    {
      ok: false,
      error: "Método no permitido.",
    },
    405,
    {
      Allow: "POST",
    },
  );
}

interface PrepararAlertasArgs {
  periodo: string;
  quincena: Quincena;
  limites: LimitesVariables;
  datos: DatosPeriodo;
}

async function prepararAlertas({
  periodo,
  quincena,
  limites,
  datos,
}: PrepararAlertasArgs): Promise<AlertaPendiente[]> {
  const alertas: AlertaPendiente[] = [];

  for (const categoria of CATEGORY_KEYS) {
    const gastosCategoria = datos.gastos.filter(
      (movimiento) => movimiento.categoria === categoria,
    );

    const pagosCategoria = datos.pagos.filter(
      (movimiento) => movimiento.categoria === categoria,
    );

    const saldoMensual = Math.max(
      sumarMontos(gastosCategoria) -
        sumarMontos(pagosCategoria),
      0,
    );

    const alertaMensual = await reclamarAlerta({
      categoria,
      periodo,
      alcance: "mensual",
      quincena: null,
      saldo: saldoMensual,
      limite: limites[categoria].mensual,
    });

    if (alertaMensual) {
      alertas.push(alertaMensual);
    }

    const gastosQuincena = gastosCategoria.filter(
      (movimiento) => movimiento.quincena === quincena,
    );

    const pagosQuincena = pagosCategoria.filter(
      (movimiento) => movimiento.quincena === quincena,
    );

    const saldoQuincenal = Math.max(
      sumarMontos(gastosQuincena) -
        sumarMontos(pagosQuincena),
      0,
    );

    const alertaQuincenal = await reclamarAlerta({
      categoria,
      periodo,
      alcance: "quincenal",
      quincena,
      saldo: saldoQuincenal,
      limite: limites[categoria].quincenal,
    });

    if (alertaQuincenal) {
      alertas.push(alertaQuincenal);
    }
  }

  return alertas;
}

interface ReclamarAlertaArgs {
  categoria: CategoriaVariable;
  periodo: string;
  alcance: AlcanceAlerta;
  quincena: Quincena | null;
  saldo: number;
  limite: number;
}

/**
 * Reclama temporalmente una alerta mediante transacción.
 * Esto evita que dos llamadas simultáneas envíen el mismo push.
 */
async function reclamarAlerta({
  categoria,
  periodo,
  alcance,
  quincena,
  saldo,
  limite,
}: ReclamarAlertaArgs): Promise<AlertaPendiente | null> {
  if (limite <= 0) {
    return null;
  }

  const porcentaje = (saldo / limite) * 100;
  const nivel = obtenerNivelAlerta(porcentaje);

  const alertKey = [
    periodo,
    categoria,
    alcance === "mensual" ? "mensual" : `q${quincena}`,
  ].join("_");

  const attemptId = randomUUID();

  const referencia = getAdminDb()
    .collection(ALERT_STATE_COLLECTION)
    .doc(alertKey);

  let reclamada = false;

  await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(referencia);
    const anterior = snapshot.data();

    const nivelAnterior = normalizarNivel(anterior?.nivel);
    const entregaPendiente =
      anterior?.deliveryPending === true;

    const leaseUntil = convertirTimestampMilisegundos(
      anterior?.leaseUntil,
    );

    const leaseActivo =
      entregaPendiente && leaseUntil > Date.now();

    // Bajar de 90% reinicia completamente el ciclo de alertas.
    if (nivel === "normal") {
      if (
        nivelAnterior !== "normal" ||
        entregaPendiente
      ) {
        transaction.set(
          referencia,
          {
            nivel: "normal",
            deliveryPending: false,
            leaseUntil: null,
            attemptId: null,
            porcentaje,
            saldo,
            limite,
            updatedAt: FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          },
        );
      }

      return;
    }

    if (leaseActivo) {
      return;
    }

    /*
     * Si una alerta ya fue entregada:
     * - 90 -> 90: no repetir.
     * - 100 -> 100: no repetir.
     * - 100 -> 90: no enviar una alerta inferior.
     * - 90 -> 100: sí enviar la nueva alerta.
     */
    if (
      !entregaPendiente &&
      nivelNumerico(nivel) <= nivelNumerico(nivelAnterior)
    ) {
      return;
    }

    reclamada = true;

    transaction.set(
      referencia,
      {
        nivel,
        deliveryPending: true,
        attemptId,
        leaseUntil: Timestamp.fromMillis(
          Date.now() + DELIVERY_LEASE_MS,
        ),
        porcentaje,
        saldo,
        limite,
        lastAttemptAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  });

  if (!reclamada || nivel === "normal") {
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
  };
}

async function marcarAlertaEntregada(
  alerta: AlertaPendiente,
  resultado: ResultadoEnvio,
): Promise<void> {
  const referencia = getAdminDb()
    .collection(ALERT_STATE_COLLECTION)
    .doc(alerta.alertKey);

  await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(referencia);
    const actual = snapshot.data();

    if (actual?.attemptId !== alerta.attemptId) {
      return;
    }

    transaction.set(
      referencia,
      {
        deliveryPending: false,
        leaseUntil: null,
        attemptId: null,
        lastSentAt: FieldValue.serverTimestamp(),
        successCount: resultado.enviados,
        failureCount: resultado.fallidos,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  });
}

async function liberarAlertaParaReintento(
  alerta: AlertaPendiente,
  error: string,
): Promise<void> {
  const referencia = getAdminDb()
    .collection(ALERT_STATE_COLLECTION)
    .doc(alerta.alertKey);

  await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(referencia);
    const actual = snapshot.data();

    if (actual?.attemptId !== alerta.attemptId) {
      return;
    }

    transaction.set(
      referencia,
      {
        deliveryPending: true,
        leaseUntil: Timestamp.fromMillis(0),
        lastError: error.slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  });
}

async function enviarAlerta(
  alerta: AlertaPendiente,
  fids: string[],
): Promise<ResultadoEnvio> {
  const data = crearPayloadAlerta(alerta);

  let enviados = 0;
  let fallidos = 0;

  for (
    let index = 0;
    index < fids.length;
    index += MAX_FIDS_PER_BATCH
  ) {
    const batchFids = fids.slice(
      index,
      index + MAX_FIDS_PER_BATCH,
    );

    const message: FidMulticastMessage = {
      fids: batchFids,
      data,
      webpush: {
        headers: {
          Urgency:
            alerta.nivel === "100"
              ? "high"
              : "normal",
        },
      },
    };

    const response =
      await getAdminMessaging().sendEachForMulticast(
        message,
      );

    enviados += response.successCount;
    fallidos += response.failureCount;

    const invalidos: string[] = [];

    response.responses.forEach(
      (resultado, responseIndex) => {
        if (resultado.success) {
          return;
        }

        const fid = batchFids[responseIndex];
        const code = resultado.error?.code ?? "";

        console.warn("Falló el envío a un dispositivo:", {
          fid,
          code,
          message: resultado.error?.message,
        });

        if (esFidInvalido(code)) {
          invalidos.push(fid);
        }
      },
    );

    await desactivarFidsInvalidos(invalidos);
  }

  return {
    enviados,
    fallidos,
    dispositivos: fids.length,
  };
}

function crearPayloadAlerta(
  alerta: AlertaPendiente,
): Record<string, string> {
  const label = CATEGORY_LABELS[alerta.categoria];

  const periodoTexto =
    alerta.alcance === "mensual"
      ? "este mes"
      : `en la quincena ${alerta.quincena}`;

  const disponible = Math.max(
    alerta.limite - alerta.saldo,
    0,
  );

  const excedente = Math.max(
    alerta.saldo - alerta.limite,
    0,
  );

  const title =
    alerta.nivel === "100"
      ? `🚨 ${label}: límite superado`
      : `⚠️ ${label} llegó al 90%`;

  const body =
    alerta.nivel === "100"
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
    url: "/",
    tag: `${alerta.alertKey}_${alerta.nivel}`,
    categoria: alerta.categoria,
    alcance: alerta.alcance,
    quincena: alerta.quincena?.toString() ?? "",
    nivel: alerta.nivel,
    porcentaje: alerta.porcentaje.toFixed(2),
    saldo: alerta.saldo.toFixed(2),
    limite: alerta.limite.toFixed(2),
    timestamp: Date.now().toString(),
    renotify: "true",
    requireInteraction:
      alerta.nivel === "100" ? "true" : "false",
  };
}

async function cargarFidsActivos(): Promise<string[]> {
  const snapshot = await getAdminDb()
    .collection(DEVICE_COLLECTION)
    .where("activo", "==", true)
    .get();

  return Array.from(
    new Set(
      snapshot.docs
        .map((documento) => {
          const value =
            documento.data().installationId;

          return typeof value === "string"
            ? value.trim()
            : "";
        })
        .filter(Boolean),
    ),
  );
}

async function desactivarFidsInvalidos(
  fids: string[],
): Promise<void> {
  if (fids.length === 0) {
    return;
  }

  const batch = getAdminDb().batch();

  for (const fid of fids) {
    const referencia = getAdminDb()
      .collection(DEVICE_COLLECTION)
      .doc(encodeURIComponent(fid));

    batch.set(
      referencia,
      {
        activo: false,
        motivoDesactivacion: "fid_no_registrado",
        desactivadoEn: FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  }

  await batch.commit();
}

async function cargarLimites(): Promise<LimitesVariables> {
  const snapshot = await getAdminDb()
    .collection("configuracion")
    .doc("presupuestoFelo")
    .get();

  if (!snapshot.exists) {
    return DEFAULT_LIMITS;
  }

  const limites = snapshot.data()?.limites;

  return {
    comida: normalizarLimite(
      limites?.comida,
      DEFAULT_LIMITS.comida,
    ),
    gas: normalizarLimite(
      limites?.gas,
      DEFAULT_LIMITS.gas,
    ),
  };
}

function normalizarLimite(
  value: unknown,
  fallback: LimiteCategoria,
): LimiteCategoria {
  const record = esObjeto(value) ? value : {};

  return {
    mensual: normalizarNumero(
      record.mensual,
      fallback.mensual,
    ),
    quincenal: normalizarNumero(
      record.quincenal,
      fallback.quincenal,
    ),
  };
}

/**
 * El frontend actual guarda fecha como cadena ISO.
 */
async function cargarDatosPeriodo(
  periodo: string,
): Promise<DatosPeriodo> {
  const { inicioBusqueda, finBusqueda } =
    obtenerRangoBusqueda(periodo);

  const [gastosSnapshot, pagosSnapshot] =
    await Promise.all([
      getAdminDb()
        .collection("gastos")
        .where("fecha", ">=", inicioBusqueda)
        .where("fecha", "<", finBusqueda)
        .get(),

      getAdminDb()
        .collection("pagosTarjeta")
        .where("fecha", ">=", inicioBusqueda)
        .where("fecha", "<", finBusqueda)
        .get(),
    ]);

  const gastos = gastosSnapshot.docs.flatMap(
    (documento) => {
      const movimiento = normalizarMovimiento(
        documento.data(),
        "gasto",
      );

      return movimiento?.periodo === periodo
        ? [movimiento]
        : [];
    },
  );

  const pagos = pagosSnapshot.docs.flatMap(
    (documento) => {
      const movimiento = normalizarMovimiento(
        documento.data(),
        "pago",
      );

      return movimiento?.periodo === periodo
        ? [movimiento]
        : [];
    },
  );

  return {
    gastos,
    pagos,
  };
}

function normalizarMovimiento(
  data: DocumentData,
  source: "gasto" | "pago",
): MovimientoNormalizado | null {
  const fecha = convertirFecha(data.fecha);

  if (!fecha) {
    return null;
  }

  const info = obtenerInfoPeriodo(fecha);

  return {
    monto: normalizarNumero(data.monto, 0),
    categoria:
      source === "gasto"
        ? normalizarCategoriaGasto(data.categoria)
        : normalizarCategoriaPago(data.categoria),
    periodo: info.periodo,
    quincena: info.quincena,
  };
}

function normalizarCategoriaGasto(
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

function normalizarCategoriaPago(
  value: unknown,
): CategoriaVariable | "general" | null {
  if (
    value === "comida" ||
    value === "gas" ||
    value === "general"
  ) {
    return value;
  }

  return "general";
}

function obtenerNivelAlerta(
  porcentaje: number,
): NivelAlerta {
  if (porcentaje >= EXCEEDED_THRESHOLD) {
    return "100";
  }

  if (porcentaje >= ALERT_THRESHOLD) {
    return "90";
  }

  return "normal";
}

function nivelNumerico(nivel: NivelAlerta): number {
  switch (nivel) {
    case "100":
      return 2;
    case "90":
      return 1;
    default:
      return 0;
  }
}

function normalizarNivel(value: unknown): NivelAlerta {
  if (value === "90" || value === "100") {
    return value;
  }

  return "normal";
}

function sumarMontos(
  movimientos: MovimientoNormalizado[],
): number {
  return movimientos.reduce(
    (total, movimiento) => total + movimiento.monto,
    0,
  );
}

function obtenerInfoPeriodo(fecha: Date): PeriodInfo {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(fecha);

  const year = obtenerParte(parts, "year");
  const month = obtenerParte(parts, "month");
  const day = Number(obtenerParte(parts, "day"));

  return {
    periodo: `${year}-${month}`,
    quincena: day <= 15 ? 1 : 2,
  };
}

function obtenerParte(
  parts: Intl.DateTimeFormatPart[],
  type: "year" | "month" | "day",
): string {
  return (
    parts.find((part) => part.type === type)?.value ?? ""
  );
}

function obtenerRangoBusqueda(
  periodo: string,
): {
  inicioBusqueda: string;
  finBusqueda: string;
} {
  const [year, month] = periodo.split("-").map(Number);

  // Margen para cubrir la diferencia entre UTC y Eastern Time.
  const margen = 36 * 60 * 60 * 1000;

  return {
    inicioBusqueda: new Date(
      Date.UTC(year, month - 1, 1) - margen,
    ).toISOString(),

    finBusqueda: new Date(
      Date.UTC(year, month, 1) + margen,
    ).toISOString(),
  };
}

function convertirFecha(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const fecha = new Date(value);

    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  if (
    esObjeto(value) &&
    typeof value.toDate === "function"
  ) {
    const fecha = value.toDate();

    return fecha instanceof Date &&
      !Number.isNaN(fecha.getTime())
      ? fecha
      : null;
  }

  return null;
}

function convertirTimestampMilisegundos(
  value: unknown,
): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (
    esObjeto(value) &&
    typeof value.toMillis === "function"
  ) {
    const result = value.toMillis();

    return typeof result === "number" ? result : 0;
  }

  return 0;
}

function normalizarNumero(
  value: unknown,
  fallback: number,
): number {
  const numero = Number(value);

  return Number.isFinite(numero) && numero >= 0
    ? numero
    : fallback;
}

function esObjeto(
  value: unknown,
): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function esFidInvalido(code: string): boolean {
  return (
    code.includes("installation-id-not-registered") ||
    code.includes("registration-token-not-registered") ||
    code.includes("invalid-registration-token")
  );
}

type ResultadoAutorizacion =
  | {
      ok: true;
      uid: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

/**
 * Verifica el Firebase ID Token enviado por el navegador
 * y confirma que el usuario continúa activo en allowedUsers.
 */
async function autorizarSolicitud(
  request: NextRequest,
): Promise<ResultadoAutorizacion> {
  const authorizationHeader =
    request.headers.get(
      "authorization",
    );

  if (
    !authorizationHeader?.startsWith(
      "Bearer ",
    )
  ) {
    return {
      ok: false,
      response: json(
        {
          ok: false,
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

  if (!idToken) {
    return {
      ok: false,
      response: json(
        {
          ok: false,
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
          decodedToken.uid,
        )
        .get();

    const authorized =
      authorizationSnapshot.exists &&
      authorizationSnapshot.data()
        ?.activo === true;

    if (!authorized) {
      return {
        ok: false,
        response: json(
          {
            ok: false,
            error:
              "Esta cuenta no tiene acceso a la evaluación de alertas.",
          },
          403,
        ),
      };
    }

    return {
      ok: true,
      uid:
        decodedToken.uid,
    };
  } catch (error) {
    console.warn(
      "Token Firebase inválido o revocado:",
      obtenerMensajeError(
        error,
      ),
    );

    return {
      ok: false,
      response: json(
        {
          ok: false,
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
  request: NextRequest,
): boolean {
  const requestOrigin = new URL(request.url).origin;

  const origin =
    request.headers.get("origin") ??
    obtenerOriginDesdeReferer(
      request.headers.get("referer"),
    );

  if (!origin) {
    return false;
  }

  const configuredOrigin = normalizarOrigin(
    process.env.NEXT_PUBLIC_APP_URL,
  );

  const allowedOrigins = new Set(
    [requestOrigin, configuredOrigin].filter(
      (value): value is string => Boolean(value),
    ),
  );

  if (!allowedOrigins.has(origin)) {
    return false;
  }

  const fetchSite = request.headers.get("sec-fetch-site");

  return (
    !fetchSite ||
    fetchSite === "same-origin" ||
    fetchSite === "same-site" ||
    fetchSite === "none"
  );
}

function obtenerOriginDesdeReferer(
  referer: string | null,
): string | null {
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function normalizarOrigin(
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function formatoMoneda(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function obtenerMensajeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Error desconocido.";
}

function json(
  body: Record<string, unknown>,
  status = 200,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...headers,
    },
  });
}