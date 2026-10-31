// Acceso a Firestore y normalización de documentos de notificaciones.
import { getAdminDb } from "@/lib/firebase-admin";
import { DEFAULT_LIMITS, DEVICE_COLLECTION } from "./constants";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { DocumentData } from "firebase-admin/firestore";
import type {
  CategoriaVariable,
  DatosPeriodo,
  DatosTarjetasPush,
  LimiteCategoria,
  LimitesVariables,
  MovimientoPresupuestoNormalizado,
  MovimientoTarjetaPush,
  TarjetaPush,
} from "./types";
import { esObjeto, normalizarNumero } from "./utils";
import { normalizarConfiguracionIngreso } from "@/lib/budget/income-config";
import {
  asignarFechaAPresupuesto, obtenerCoberturaPresupuestaria, obtenerReglaPresupuestaria,
  type ReglaPresupuestaria,
} from "@/lib/budget/budget-periods";
import { agregarDiasUTC } from "@/lib/budget/pay-cycles";
import {
  convertirFecha,
  esFechaISOValida,
  obtenerFechaZonaHorariaISO,
  obtenerRangoBusqueda,
} from "./dates";

/**
 * ============================================================
 * DISPOSITIVOS
 * ============================================================
 */

export async function cargarFidsActivos(
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

export async function desactivarFidsInvalidos(
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

export async function cargarLimites(
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

export async function cargarReglaPresupuesto(uid: string): Promise<ReglaPresupuestaria | null> {
  const snapshot = await getAdminDb().doc(`users/${uid}/configuracion/ingresoPrincipal`).get();
  return snapshot.exists ? obtenerReglaPresupuestaria(normalizarConfiguracionIngreso(snapshot.data())) : null;
}

export async function cargarDatosPeriodo(
  uid: string, periodo: string, regla?: ReglaPresupuestaria | null,
): Promise<DatosPeriodo> {
  const rangoCalendario = obtenerRangoBusqueda(periodo);
  const coberturaFinal = obtenerCoberturaPresupuestaria(periodo, 2, regla);
  // Include UTC/NY date boundaries. Historical purchases are needed for continuous carry-over.
  const finBusqueda = regla && coberturaFinal
    ? agregarDiasUTC(coberturaFinal.fin, 3).toISOString()
    : rangoCalendario.finBusqueda;
  let consulta = getAdminDb().collection(`users/${uid}/gastos`).where("fecha", "<", finBusqueda);
  if (!regla) consulta = consulta.where("fecha", ">=", rangoCalendario.inicioBusqueda);
  const snapshot = await consulta.get();
  const gastos = snapshot.docs.flatMap(documento => {
    const movimiento = normalizarMovimientoPresupuesto(documento.data(), regla);
    return movimiento && (regla || movimiento.periodo === periodo) ? [movimiento] : [];
  });
  return { gastos };
}

function normalizarMovimientoPresupuesto(
  data: DocumentData, regla?: ReglaPresupuestaria | null,
): MovimientoPresupuestoNormalizado | null {
  // Calendar-only strings represent a day, not midnight UTC on the previous NY day.
  const fecha = convertirFecha(data.fecha);
  const dia = typeof data.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)
    ? data.fecha : fecha ? obtenerFechaZonaHorariaISO(fecha) : null;
  const info = dia ? asignarFechaAPresupuesto(dia, regla) : null;
  if (!info) return null;
  return {
    monto: normalizarNumero(data.monto, 0),
    categoria: normalizarCategoriaGasto(data.categoria),
    periodo: info.periodoPresupuestario,
    quincena: info.quincenaPresupuestaria,
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

export async function cargarDatosTarjetas(
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
