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
import {
  convertirFecha,
  esFechaISOValida,
  obtenerFechaZonaHorariaISO,
  obtenerInfoPeriodo,
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

export async function cargarDatosPeriodo(
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
