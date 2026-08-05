"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import {
  COMPROMISOS_FIJOS,
  LIMITES_PREDETERMINADOS,
} from "@/lib/budget/constants";
import type {
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
  formatoMoneda,
  normalizarCategoriaGasto,
  normalizarCategoriaPago,
  normalizarLimites,
  normalizarMetodoPago,
  normalizarMonto,
  normalizarPeriodicidad,
  obtenerQuincena,
} from "@/lib/budget/utils";

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
  const [eliminandoMovimientoId, setEliminandoMovimientoId] = useState<
    string | null
  >(null);
  const [eliminandoPagoFijoId, setEliminandoPagoFijoId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const consulta = query(collection(db, "gastos"), orderBy("fecha", "desc"));

    return onSnapshot(
      consulta,
      (snapshot) => {
        const registros = snapshot.docs.flatMap((documento) => {
          const data = documento.data();
          const categoria = normalizarCategoriaGasto(data.categoria);

          if (!categoria) return [];

          const fecha =
            typeof data.fecha === "string"
              ? data.fecha
              : new Date().toISOString();

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
              metodoPago:
                normalizarMetodoMovimiento(
                  data.metodoPago,
                ),

              tarjetaId:
                normalizarTarjetaId(
                  data.tarjetaId,
                ),
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
  }, []);

  useEffect(() => {
    const consulta = query(
      collection(db, "pagosTarjeta"),
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
        setError("No se pudieron cargar los pagos de Comida y Gas.");
        setCargandoPagos(false);
      },
    );
  }, []);

  useEffect(() => {
    const consulta = query(
      collection(db, "pagosFijos"),
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
            metodo: normalizarMetodoPago(data.metodo),
            periodicidad: normalizarPeriodicidad(data.periodicidad),
            referencia:
              typeof data.referencia === "string" ? data.referencia : "",
            notas: typeof data.notas === "string" ? data.notas : "",
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
  }, []);

  useEffect(() => {
    const referencia = doc(db, "configuracion", "presupuestoFelo");

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
  }, []);

  const registrarMovimiento = async (
    movimiento: NuevoMovimiento,
  ): Promise<boolean> => {
    setGuardandoMovimiento(true);
    setError(null);

    try {
      if (movimiento.tipo === "gasto") {
        await addDoc(collection(db, "gastos"), {
          concepto: movimiento.concepto.trim(),
          monto: movimiento.monto,
          categoria: movimiento.categoria,
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

          creadoEn: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "pagosTarjeta"), {
          concepto: movimiento.concepto.trim(),
          tarjeta: movimiento.concepto.trim(),
          monto: movimiento.monto,
          categoria: movimiento.categoria,
          fecha: convertirFechaInputAISO(movimiento.fecha),

          tarjetaId:
            movimiento.tarjetaId ??
            null,

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
        await evaluarAlertasPush();
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
    setGuardandoPagoFijo(true);
    setError(null);

    try {
      await addDoc(collection(db, "pagosFijos"), {
        compromisoId: pago.compromiso.id,
        descripcion: pago.compromiso.descripcion,
        monto: pago.monto,
        fecha: convertirFechaInputAISO(pago.fecha),
        metodo: pago.metodo,
        periodicidad: pago.periodicidad,
        quincena: obtenerQuincena(new Date(`${pago.fecha}T12:00:00`)),
        periodo: pago.fecha.slice(0, 7),
        referencia: pago.referencia.trim(),
        notas: pago.notas.trim(),
        creadoEn: serverTimestamp(),
      });

      return true;
    } catch (guardarError) {
      console.error(guardarError);
      setError("No se pudo registrar el pago fijo.");
      return false;
    } finally {
      setGuardandoPagoFijo(false);
    }
  };

  const eliminarMovimiento = async (
  movimiento: Movimiento,
): Promise<void> => {
  const idEliminacion =
    `${movimiento.tipo}-${movimiento.id}`;

  setEliminandoMovimientoId(
    idEliminacion,
  );

  setError(null);

  try {
    const coleccion =
      movimiento.tipo === "gasto"
        ? "gastos"
        : "pagosTarjeta";

    await deleteDoc(
      doc(
        db,
        coleccion,
        movimiento.id,
      ),
    );

    try {
      await evaluarAlertasPush();
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
    console.error(
      eliminarError,
    );

    setError(
      "No se pudo eliminar el movimiento.",
    );
  } finally {
    setEliminandoMovimientoId(
      null,
    );
  }
};
  const eliminarPagoFijo = async (
  pago: PagoFijo,
): Promise<void> => {
  setEliminandoPagoFijoId(
    pago.id,
  );

  setError(null);

  try {
    await deleteDoc(
      doc(
        db,
        "pagosFijos",
        pago.id,
      ),
    );
  } catch (eliminarError) {
    console.error(
      eliminarError,
    );

    setError(
      "No se pudo eliminar el pago fijo.",
    );
  } finally {
    setEliminandoPagoFijoId(
      null,
    );
  }
};
  const guardarLimites = async (
    nuevosLimites: LimitesVariables,
  ): Promise<boolean> => {
    const limitesValidados = normalizarLimites(nuevosLimites);

    setGuardandoLimites(true);
    setError(null);

    try {
      await setDoc(
        doc(db, "configuracion", "presupuestoFelo"),
        {
          limites: limitesValidados,
          actualizadoEn: new Date().toISOString(),
        },
        { merge: true },
      );

      try {
        await evaluarAlertasPush();
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
    eliminandoMovimientoId,
    eliminandoPagoFijoId,
    error,
    limpiarError: () => setError(null),
    registrarMovimiento,
    registrarPagoFijo,
    eliminarMovimiento,
    eliminarPagoFijo,
    guardarLimites,
  };
}