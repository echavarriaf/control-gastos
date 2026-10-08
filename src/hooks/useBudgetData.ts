"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from "firebase/firestore";

import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import {
  getUserCollection,
  getUserConfigDocument,
  getUserDocument,
} from "@/lib/firestore/user-paths";
import {
  COMPROMISOS_FIJOS,
  CATEGORIAS_VARIABLES,
  LIMITES_PREDETERMINADOS,
} from "@/lib/budget/constants";
import type {
  EstadoTransaccionTarjeta,
  GastoVariable,
  LimitesVariables,
  MetodoPagoMovimiento,
  Movimiento,
  NuevoMovimiento,
  NuevoPagoFijo,
  PagoFijo,
  PagoTarjeta,
} from "@/lib/budget/types";
import {
  convertirFechaInputAISO,
  normalizarCategoriaGasto,
  normalizarCategoriaPago,
  normalizarLimites,
  normalizarMetodoPago,
  normalizarMonto,
  normalizarPeriodicidad,
  obtenerQuincena,
} from "@/lib/budget/utils";

const PUSH_EVALUATION_ENABLED = true;

interface RespuestaEvaluacionPush {
  ok?: boolean;
  error?: unknown;
  detalle?: unknown;
}

interface RegistroOrdenable {
  id: string;
  fecha: string;
  creadoEn: string;
}

/**
 * Convierte el Timestamp de Firestore a ISO para mantener
 * el resto de la aplicación trabajando con strings.
 *
 * El fallback cubre el snapshot local inicial mientras
 * Firestore confirma el serverTimestamp().
 */
function normalizarCreadoEn(
  value: unknown,
  fallback: string,
): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return fallback;
}

/**
 * TARJETAS - 1. Normaliza la referencia de tarjeta y
 * el método de pago de documentos nuevos o antiguos.
 */
function normalizarTarjetaId(
  value: unknown,
): string | null {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function normalizarMetodoMovimiento(
  value: unknown,
): MetodoPagoMovimiento | undefined {
  return value === "efectivo" ||
    value === "debito" ||
    value === "cuenta_bancaria" ||
    value === "tarjeta_credito"
    ? value
    : undefined;
}

/**
 * ============================================================
 * 2B.2A — ESTADO DE TRANSACCIONES DE TARJETA
 * ============================================================
 *
 * Compatibilidad:
 *
 * - Los documentos históricos no tienen estadoTarjeta.
 * - Si pertenecen a una tarjeta, se consideran contabilizados.
 * - Si no pertenecen a una tarjeta, el estado es null.
 *
 * De esta forma no alteramos los saldos históricos existentes.
 */
function normalizarEstadoTarjeta(
  value: unknown,
  usaTarjeta: boolean,
): EstadoTransaccionTarjeta | null {
  if (!usaTarjeta) {
    return null;
  }

  if (
    value === "pendiente" ||
    value === "contabilizada"
  ) {
    return value;
  }

  return "contabilizada";
}

/**
 * Ordena primero por la fecha seleccionada para el movimiento
 * y, cuando coinciden, por la fecha y hora de inserción.
 */
function ordenarPorFechaYCreacion<T extends RegistroOrdenable>(
  a: T,
  b: T,
): number {
  const diferenciaFecha =
    new Date(b.fecha).getTime() -
    new Date(a.fecha).getTime();

  if (diferenciaFecha !== 0) {
    return diferenciaFecha;
  }

  const diferenciaCreacion =
    new Date(b.creadoEn).getTime() -
    new Date(a.creadoEn).getTime();

  if (diferenciaCreacion !== 0) {
    return diferenciaCreacion;
  }

  return b.id.localeCompare(a.id);
}

/**
 * Solicita al servidor que recalcule las alertas push.
 *
 * La llamada incluye el Firebase ID Token del usuario
 * autenticado. El servidor verifica el token y comprueba
 * allowedUsers/{uid}.activo antes de ejecutar Firebase Admin.
 */
async function evaluarAlertasPush(): Promise<void> {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "No existe una sesión autenticada para evaluar las alertas push.",
    );
  }

  const idToken =
    await currentUser.getIdToken();

  const response =
    await fetch(
      "/api/push/evaluate",
      {
        method: "POST",
        credentials:
          "same-origin",
        cache: "no-store",
        keepalive: true,
        headers: {
          Accept:
            "application/json",
          Authorization:
            `Bearer ${idToken}`,
        },
      },
    );

  const payload =
    (await response
      .json()
      .catch(
        () => null,
      )) as RespuestaEvaluacionPush | null;

  if (!response.ok) {
    const mensaje =
      typeof payload?.error ===
        "string"
        ? payload.error
        : `La evaluación push respondió con HTTP ${response.status}.`;

    throw new Error(
      mensaje,
    );
  }

  if (payload?.ok !== true) {
    throw new Error(
      "La evaluación push no confirmó una respuesta válida.",
    );
  }
}

export function useBudgetData() {
  const { user, authorized } = useAuth();

  const uid =
    authorized
      ? user?.uid ?? null
      : null;

  const [gastos, setGastos] = useState<GastoVariable[]>([]);
  const [pagos, setPagos] = useState<PagoTarjeta[]>([]);
  const [pagosFijos, setPagosFijos] = useState<PagoFijo[]>([]);
  const [limites, setLimites] = useState<LimitesVariables>(
    LIMITES_PREDETERMINADOS,
  );

  const [cargandoGastos, setCargandoGastos] = useState(true);
  const [cargandoPagos, setCargandoPagos] = useState(true);
  const [cargandoPagosFijos, setCargandoPagosFijos] = useState(true);
  const [cargandoLimites, setCargandoLimites] = useState(true);

  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);
  const [guardandoPagoFijo, setGuardandoPagoFijo] = useState(false);
  const [guardandoLimites, setGuardandoLimites] = useState(false);
  const [actualizandoMovimientoId, setActualizandoMovimientoId] = useState<string |null>(null);
  const [actualizandoPagoFijoId, setActualizandoPagoFijoId] = useState<string | null>(null)
  const [eliminandoMovimientoId, setEliminandoMovimientoId] = useState<
    string | null
  >(null);
  const [eliminandoPagoFijoId, setEliminandoPagoFijoId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      return;
    }

    const consulta = query(
      getUserCollection(uid, "gastos"),
      orderBy("fecha", "desc"),
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
        const registros = snapshot.docs.flatMap((documento) => {
          const data = documento.data();
          const categoria =
            normalizarCategoriaGasto(
              data.categoria,
            );

          /*
           * `null` es una categoría válida para compras como "Otro".
           * Solo descartamos documentos cuyo valor original no sea null
           * y tampoco pueda normalizarse como Comida o Gas.
           */
          if (
            data.categoria !== null &&
            categoria === null
          ) {
            return [];
          }

          const fecha =
            typeof data.fecha === "string"
              ? data.fecha
              : new Date().toISOString();

          const categoriaTarjetaId =
            normalizarTarjetaId(
              data.categoriaTarjetaId,
            );

          const categoriaTarjetaNombre =
            typeof data.categoriaTarjetaNombre ===
              "string" &&
              data.categoriaTarjetaNombre.trim()
              ? data.categoriaTarjetaNombre.trim()
              : categoria
                ? CATEGORIAS_VARIABLES[
                  categoria
                ].label
                : "Otro";

          const metodoPago =
            normalizarMetodoMovimiento(
              data.metodoPago,
            );

          const tarjetaId =
            normalizarTarjetaId(
              data.tarjetaId,
            );

          const estadoTarjeta =
            normalizarEstadoTarjeta(
              data.estadoTarjeta,
              metodoPago === "tarjeta_credito" &&
              tarjetaId !== null,
            );

          return [
            {
              id: documento.id,
              concepto:
                typeof data.concepto === "string"
                  ? data.concepto
                  : "Gasto sin descripción",
              monto: normalizarMonto(data.monto, 0),
              categoria,
              fecha,
              creadoEn: normalizarCreadoEn(
                data.creadoEn,
                fecha,
              ),

              /**
               * TARJETAS - 2. Recupera la tarjeta usada
               * y el método de pago desde Firestore.
               */
              metodoPago,

              tarjetaId,

              estadoTarjeta,

              categoriaTarjetaId,
              categoriaTarjetaNombre,

              comentario:
                typeof data.comentario ===
                  "string"
                  ? data.comentario
                    .trim()
                  : "",
            } satisfies GastoVariable,
          ];
        });

        setGastos(registros.sort(ordenarPorFechaYCreacion));
        setCargandoGastos(false);
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError("No se pudieron cargar los gastos.");
        setCargandoGastos(false);
      },
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      return;
    }

    const consulta = query(
      getUserCollection(uid, "pagosTarjeta"),
      orderBy("fecha", "desc"),
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
        const registros = snapshot.docs.map((documento) => {
          const data = documento.data();
          const fecha =
            typeof data.fecha === "string"
              ? data.fecha
              : new Date().toISOString();

          return {
            id: documento.id,
            concepto:
              typeof data.concepto === "string"
                ? data.concepto
                : typeof data.tarjeta === "string"
                  ? data.tarjeta
                  : "Pago a tarjeta",
            monto: normalizarMonto(data.monto, 0),
            categoria: normalizarCategoriaPago(data.categoria),
            fecha,
            creadoEn: normalizarCreadoEn(
              data.creadoEn,
              fecha,
            ),

            tarjetaId:
              normalizarTarjetaId(
                data.tarjetaId,
              ),
            /**
             * 2B.2A
             *
             * Un pago histórico sin estado explícito se considera
             * contabilizado para conservar el comportamiento existente.
             */
            estadoTarjeta:
              normalizarEstadoTarjeta(
                data.estadoTarjeta,
                true,
              ),

            referencia:
              typeof data.referencia ===
                "string"
                ? data.referencia
                : "",

            notas:
              typeof data.notas ===
                "string"
                ? data.notas
                : "",
          } satisfies PagoTarjeta;
        });

        setPagos(registros.sort(ordenarPorFechaYCreacion));
        setCargandoPagos(false);
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError("No se pudieron cargar los pagos de tarjetas.");
        setCargandoPagos(false);
      },
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      return;
    }

    const consulta = query(
      getUserCollection(uid, "pagosFijos"),
      orderBy("fecha", "desc"),
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
        const registros = snapshot.docs.map((documento) => {
          const data = documento.data();
          const compromiso = COMPROMISOS_FIJOS.find(
            (item) => item.id === data.compromisoId,
          );
          const metodo =
            normalizarMetodoPago(
              data.metodo,
            );

          const tarjetaId =
            normalizarTarjetaId(
              data.tarjetaId,
            );

          const estadoTarjeta =
            normalizarEstadoTarjeta(
              data.estadoTarjeta,
              metodo === "tarjeta" &&
              tarjetaId !== null,
            );

          return {
            id: documento.id,
            compromisoId:
              typeof data.compromisoId === "string"
                ? data.compromisoId
                : "sin-asignar",
            descripcion:
              typeof data.descripcion === "string"
                ? data.descripcion
                : compromiso?.descripcion ?? "Pago fijo",
            monto: normalizarMonto(data.monto, 0),
            fecha:
              typeof data.fecha === "string"
                ? data.fecha
                : new Date().toISOString(),
            metodo,

            periodicidad:
              normalizarPeriodicidad(
                data.periodicidad,
              ),

            tarjetaId,

            estadoTarjeta,

            referencia:
              typeof data.referencia ===
                "string"
                ? data.referencia
                : "",

            notas:
              typeof data.notas ===
                "string"
                ? data.notas
                : "",
          } satisfies PagoFijo;
        });

        setPagosFijos(registros);
        setCargandoPagosFijos(false);
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError("No se pudieron cargar los pagos de gastos fijos.");
        setCargandoPagosFijos(false);
      },
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      return;
    }

    const referencia = getUserConfigDocument(
      uid,
      "presupuestoFelo",
    );

    return onSnapshot(
      referencia,
      (snapshot) => {
        setLimites(
          snapshot.exists()
            ? normalizarLimites(snapshot.data().limites)
            : LIMITES_PREDETERMINADOS,
        );
        setCargandoLimites(false);
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError("No se pudo cargar la configuración del presupuesto.");
        setCargandoLimites(false);
      },
    );
  }, [uid]);

  const registrarMovimiento = async (
    movimiento: NuevoMovimiento,
  ): Promise<boolean> => {
    if (!uid) {
      setError(
        "No existe un usuario autorizado para guardar el movimiento.",
      );
      return false;
    }

    setGuardandoMovimiento(true);
    setError(null);

    try {
      if (movimiento.tipo === "gasto") {
        await addDoc(getUserCollection(uid, "gastos"), {
          concepto: movimiento.concepto.trim(),
          monto: movimiento.monto,

          /*
           * La categoría presupuestaria puede ser null. De esta forma
           * "Otro" aumenta la deuda de la tarjeta, pero no consume
           * los límites ni el carry-over de Comida o Gas.
           */
          categoria:
            movimiento.categoria,

          categoriaTarjetaId:
            movimiento.categoriaTarjetaId
              .trim(),

          categoriaTarjetaNombre:
            movimiento.categoriaTarjetaNombre
              .trim(),

          comentario:
            movimiento.comentario
              .trim(),

          fecha: convertirFechaInputAISO(movimiento.fecha),

          /**
           * TARJETAS - 3. Persiste la tarjeta seleccionada
           * para aumentar posteriormente su saldo.
           */
          metodoPago:
            movimiento.metodoPago ??
            (
              movimiento.tarjetaId
                ? "tarjeta_credito"
                : "debito"
            ),

          tarjetaId:
            movimiento.tarjetaId ??
            null,

          /**
           * 2B.2A
           *
           * Hasta conectar el selector en la UI, las transacciones
           * nuevas mantienen el comportamiento existente:
           * se consideran contabilizadas por defecto.
           */
          estadoTarjeta:
            movimiento.tarjetaId
              ? movimiento.estadoTarjeta ??
              "contabilizada"
              : null,

          creadoEn: serverTimestamp(),
        });
      } else {
        await addDoc(getUserCollection(uid, "pagosTarjeta"), {
          concepto: movimiento.concepto.trim(),
          tarjeta: movimiento.concepto.trim(),
          monto: movimiento.monto,
          categoria: movimiento.categoria,
          fecha: convertirFechaInputAISO(movimiento.fecha),

          tarjetaId:
            movimiento.tarjetaId ??
            null,

          estadoTarjeta:
            movimiento.estadoTarjeta ??
            "contabilizada",

          referencia:
            movimiento.referencia
              ?.trim() ?? "",

          notas:
            movimiento.notas
              ?.trim() ?? "",

          creadoEn: serverTimestamp(),
        });
      }

      try {
        if (PUSH_EVALUATION_ENABLED) {
          await evaluarAlertasPush();
        }
      } catch (pushError) {
        console.error(
          "El movimiento se guardó, pero no se pudieron evaluar las alertas push.",
          pushError,
        );

        setError(
          "El movimiento se guardó, pero no se pudieron evaluar las alertas push.",
        );
      }

      return true;
    } catch (guardarError) {
      console.error(guardarError);
      setError("No se pudo guardar el movimiento. Revisa Firebase.");
      return false;
    } finally {
      setGuardandoMovimiento(false);
    }
  };

  const registrarPagoFijo = async (
    pago: NuevoPagoFijo,
  ): Promise<boolean> => {
    if (!uid) {
      setError(
        "No existe un usuario autorizado para registrar el pago fijo.",
      );

      return false;
    }

    setError(null);

    /**
     * ============================================================
     * 2B.2 — PAGO FIJO CON TARJETA
     * ============================================================
     *
     * Prioridad:
     *
     * 1. tarjetaId enviada explícitamente por el pago;
     * 2. tarjeta configurada en el compromiso fijo;
     * 3. null cuando el método no es tarjeta.
     *
     * Esto permite que el modal actual siga funcionando aunque
     * todavía no envíe tarjetaId directamente.
     */
    const tarjetaId =
      pago.metodo ===
        "tarjeta"
        ? normalizarTarjetaId(
          pago.tarjetaId ??
          pago.compromiso
            .tarjetaId,
        )
        : null;

    /**
     * Si se eligió tarjeta, no permitimos crear un pago ambiguo.
     *
     * Firestore Rules también lo impide, pero validarlo aquí
     * produce un mensaje útil en la interfaz.
     */
    if (
      pago.metodo ===
      "tarjeta" &&
      !tarjetaId
    ) {
      setError(
        "Este gasto fijo está marcado como pago con tarjeta, pero no tiene una tarjeta configurada.",
      );

      return false;
    }

    setGuardandoPagoFijo(true);

    try {
      await addDoc(
        getUserCollection(
          uid,
          "pagosFijos",
        ),
        {
          compromisoId:
            pago.compromiso.id,

          descripcion:
            pago.compromiso
              .descripcion,

          monto:
            pago.monto,

          fecha:
            convertirFechaInputAISO(
              pago.fecha,
            ),

          metodo:
            pago.metodo,

          periodicidad:
            pago.periodicidad,

          quincena:
            obtenerQuincena(
              new Date(
                `${pago.fecha}T12:00:00`,
              ),
            ),

          periodo:
            pago.fecha.slice(
              0,
              7,
            ),

          /**
           * 2B.2
           *
           * Permite reconocer posteriormente que este gasto
           * fijo ya está contenido dentro de la deuda de
           * una tarjeta específica.
           */
          tarjetaId,

          /**
           * 2B.2A
           *
           * Solo los gastos fijos pagados mediante tarjeta tienen
           * estado de transacción de tarjeta.
           */
          estadoTarjeta:
            pago.metodo === "tarjeta"
              ? pago.estadoTarjeta ??
              "contabilizada"
              : null,

          referencia:
            pago.referencia.trim(),

          notas:
            pago.notas.trim(),

          creadoEn:
            serverTimestamp(),
        },
      );

      return true;
    } catch (guardarError) {
      console.error(
        guardarError,
      );

      setError(
        "No se pudo registrar el pago fijo.",
      );

      return false;
    } finally {
      setGuardandoPagoFijo(
        false,
      );
    }
  };

  /**
 * ============================================================
 * 2B.2C — ACTUALIZAR MOVIMIENTO
 * ============================================================
 *
 * Actualiza un gasto variable o un pago a tarjeta sin
 * eliminar y volver a crear el documento.
 *
 * Conserva:
 * - id
 * - creadoEn
 *
 * Actualiza:
 * - datos financieros
 * - estado pendiente/contabilizada
 * - actualizadoEn
 */
const actualizarMovimiento = async (
  movimientoActual: Movimiento,
  cambios: NuevoMovimiento,
): Promise<boolean> => {
  if (!uid) {
    setError(
      "No existe un usuario autorizado para actualizar el movimiento.",
    );

    return false;
  }

  /**
   * No permitimos convertir un gasto en pago de tarjeta
   * ni viceversa porque pertenecen a colecciones distintas.
   */
  if (
    movimientoActual.tipo !==
    cambios.tipo
  ) {
    setError(
      "No se puede cambiar el tipo del movimiento durante la edición.",
    );

    return false;
  }

  const idActualizacion =
    `${movimientoActual.tipo}-${movimientoActual.id}`;

  setActualizandoMovimientoId(
    idActualizacion,
  );

  setError(null);

  try {
    if (
      cambios.tipo ===
      "gasto"
    ) {
      const tarjetaId =
        cambios.tarjetaId ??
        null;

      const metodoPago =
        cambios.metodoPago ??
        (
          tarjetaId
            ? "tarjeta_credito"
            : "debito"
        );

      const estadoTarjeta =
        normalizarEstadoTarjeta(
          cambios.estadoTarjeta,
          metodoPago ===
            "tarjeta_credito" &&
            tarjetaId !== null,
        );

      await updateDoc(
        getUserDocument(
          uid,
          "gastos",
          movimientoActual.id,
        ),
        {
          concepto:
            cambios.concepto.trim(),

          monto:
            cambios.monto,

          categoria:
            cambios.categoria,

          categoriaTarjetaId:
            cambios
              .categoriaTarjetaId
              .trim(),

          categoriaTarjetaNombre:
            cambios
              .categoriaTarjetaNombre
              .trim(),

          comentario:
            cambios
              .comentario
              .trim(),

          fecha:
            convertirFechaInputAISO(
              cambios.fecha,
            ),

          metodoPago,

          tarjetaId,

          estadoTarjeta,

          actualizadoEn:
            serverTimestamp(),
        },
      );
    } else {
      const tarjetaId =
        cambios.tarjetaId ??
        null;

      const estadoTarjeta =
        normalizarEstadoTarjeta(
          cambios.estadoTarjeta,
          true,
        );

      await updateDoc(
        getUserDocument(
          uid,
          "pagosTarjeta",
          movimientoActual.id,
        ),
        {
          concepto:
            cambios.concepto.trim(),

          tarjeta:
            cambios.concepto.trim(),

          monto:
            cambios.monto,

          categoria:
            cambios.categoria,

          fecha:
            convertirFechaInputAISO(
              cambios.fecha,
            ),

          tarjetaId,

          estadoTarjeta,

          referencia:
            cambios.referencia
              ?.trim() ??
            "",

          notas:
            cambios.notas
              ?.trim() ??
            "",

          actualizadoEn:
            serverTimestamp(),
        },
      );
    }

    try {
      if (
        PUSH_EVALUATION_ENABLED
      ) {
        await evaluarAlertasPush();
      }
    } catch (pushError) {
      console.error(
        "El movimiento se actualizó, pero no se pudieron evaluar las alertas push.",
        pushError,
      );

      setError(
        "El movimiento se actualizó, pero no se pudieron evaluar las alertas push.",
      );
    }

    return true;
  } catch (actualizarError) {
    console.error(
      actualizarError,
    );

    setError(
      "No se pudo actualizar el movimiento.",
    );

    return false;
  } finally {
    setActualizandoMovimientoId(
      null,
    );

    setGuardandoMovimiento(false);
  }
};

/**
 * ============================================================
 * 2B.2C — ACTUALIZAR PAGO FIJO
 * ============================================================
 */
const actualizarPagoFijo = async (
  pagoActual: PagoFijo,
  cambios: NuevoPagoFijo,
): Promise<boolean> => {
  if (!uid) {
    setError(
      "No existe un usuario autorizado para actualizar el pago fijo.",
    );

    return false;
  }

  const tarjetaId =
    cambios.metodo ===
      "tarjeta"
      ? normalizarTarjetaId(
          cambios.tarjetaId ??
            cambios.compromiso
              .tarjetaId,
        )
      : null;

  if (
    cambios.metodo ===
      "tarjeta" &&
    !tarjetaId
  ) {
    setError(
      "Este gasto fijo está marcado como pago con tarjeta, pero no tiene una tarjeta configurada.",
    );

    return false;
  }

  setActualizandoPagoFijoId(
    pagoActual.id,
  );

  setError(null);

  try {
    const estadoTarjeta =
      normalizarEstadoTarjeta(
        cambios.estadoTarjeta,
        cambios.metodo ===
          "tarjeta" &&
          tarjetaId !== null,
      );

    await updateDoc(
      getUserDocument(
        uid,
        "pagosFijos",
        pagoActual.id,
      ),
      {
        compromisoId:
          cambios.compromiso.id,

        descripcion:
          cambios.compromiso
            .descripcion,

        monto:
          cambios.monto,

        fecha:
          convertirFechaInputAISO(
            cambios.fecha,
          ),

        metodo:
          cambios.metodo,

        periodicidad:
          cambios.periodicidad,

        quincena:
          obtenerQuincena(
            new Date(
              `${cambios.fecha}T12:00:00`,
            ),
          ),

        periodo:
          cambios.fecha.slice(
            0,
            7,
          ),

        tarjetaId,

        estadoTarjeta,

        referencia:
          cambios.referencia.trim(),

        notas:
          cambios.notas.trim(),

        actualizadoEn:
          serverTimestamp(),
      },
    );

    return true;
  } catch (actualizarError) {
    console.error(
      actualizarError,
    );

    setError(
      "No se pudo actualizar el pago fijo.",
    );

    return false;
  } finally {
    setActualizandoPagoFijoId(
      null,
    );
  }
};

  const eliminarMovimiento = async (movimiento: Movimiento) => {
    const idEliminacion = `${movimiento.tipo}-${movimiento.id}`;
    setEliminandoMovimientoId(idEliminacion);
    setError(null);

    try {
      const coleccion =
        movimiento.tipo === "gasto" ? "gastos" : "pagosTarjeta";

      if (!uid) {
        throw new Error(
          "No existe un usuario autorizado para eliminar el movimiento.",
        );
      }

      await deleteDoc(
        getUserDocument(
          uid,
          coleccion,
          movimiento.id,
        ),
      );

      try {
        if (PUSH_EVALUATION_ENABLED) {
          await evaluarAlertasPush();
        }
      } catch (pushError) {
        console.error(
          "El movimiento se eliminó, pero no se pudieron evaluar las alertas push.",
          pushError,
        );

        setError(
          "El movimiento se eliminó, pero no se pudieron evaluar las alertas push.",
        );
      }
    } catch (eliminarError) {
      console.error(eliminarError);
      setError("No se pudo eliminar el movimiento.");
    } finally {
      setEliminandoMovimientoId(null);
    }
  };

  const eliminarPagoFijo = async (
    pago: PagoFijo,
  ): Promise<boolean> => {
    if (!uid) {
      setError(
        "No existe un usuario autorizado para eliminar el pago fijo.",
      );
      return false;
    }

    setEliminandoPagoFijoId(pago.id);
    setError(null);

    try {
      await deleteDoc(
        getUserDocument(
          uid,
          "pagosFijos",
          pago.id,
        ),
      );

      return true;
    } catch (eliminarError) {
      console.error(eliminarError);
      setError("No se pudo eliminar el pago fijo.");
      return false;
    } finally {
      setEliminandoPagoFijoId(null);
    }
  };

  const guardarLimites = async (
    nuevosLimites: LimitesVariables,
  ): Promise<boolean> => {
    if (!uid) {
      setError(
        "No existe un usuario autorizado para guardar los límites.",
      );
      return false;
    }

    const limitesValidados = normalizarLimites(nuevosLimites);

    setGuardandoLimites(true);
    setError(null);

    try {
      await setDoc(
        getUserConfigDocument(
          uid,
          "presupuestoFelo",
        ),
        {
          limites: limitesValidados,
          actualizadoEn: new Date().toISOString(),
        },
        { merge: true },
      );

      try {
        if (PUSH_EVALUATION_ENABLED) {
          await evaluarAlertasPush();
        }
      } catch (pushError) {
        console.error(
          "Los límites se guardaron, pero no se pudieron evaluar las alertas push.",
          pushError,
        );

        setError(
          "Los límites se guardaron, pero no se pudieron evaluar las alertas push.",
        );
      }

      return true;
    } catch (guardarError) {
      console.error(guardarError);
      setError("No se pudieron guardar los límites.");
      return false;
    } finally {
      setGuardandoLimites(false);
    }
  };

  return {
    uid,
    gastos,
    pagos,
    pagosFijos,
    limites,

    cargando:
      cargandoGastos ||
      cargandoPagos ||
      cargandoPagosFijos ||
      cargandoLimites,

    guardandoMovimiento,
    guardandoPagoFijo,
    guardandoLimites,

    actualizandoMovimientoId,
    actualizandoPagoFijoId,

    eliminandoMovimientoId,
    eliminandoPagoFijoId,

    error,

    limpiarError: () => setError(null),

    registrarMovimiento,
    registrarPagoFijo,

    actualizarMovimiento,
    actualizarPagoFijo,

    eliminarMovimiento,
    eliminarPagoFijo,
    
    guardarLimites,
  };
}