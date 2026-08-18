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
  normalizarCategoriaGasto,
  normalizarCategoriaPago,
  normalizarLimites,
  normalizarMetodoPago,
  normalizarMonto,
  normalizarPeriodicidad,
  obtenerQuincena,
} from "@/lib/budget/utils";

/**
 * Temporal durante la migración multiusuario.
 *
 * /api/push/evaluate todavía lee las colecciones legacy.
 * Se reactivará cuando esa ruta también trabaje por UID.
 */
const PUSH_EVALUATION_ENABLED =
  true;

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
  if (
    value instanceof Timestamp
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (
    typeof value === "string"
  ) {
    return value;
  }

  return fallback;
}

/**
 * Normaliza una referencia de tarjeta.
 */
function normalizarTarjetaId(
  value: unknown,
): string | null {
  return typeof value ===
      "string" &&
    value.trim()
    ? value.trim()
    : null;
}

/**
 * Normaliza el método utilizado por un gasto variable.
 */
function normalizarMetodoMovimiento(
  value: unknown,
): MetodoPagoMovimiento | undefined {
  return value === "efectivo" ||
    value === "debito" ||
    value ===
      "cuenta_bancaria" ||
    value ===
      "tarjeta_credito"
    ? value
    : undefined;
}

/**
 * Ordena primero por la fecha seleccionada para el movimiento
 * y, cuando coinciden, por la fecha y hora de inserción.
 */
function ordenarPorFechaYCreacion<
  T extends RegistroOrdenable,
>(
  a: T,
  b: T,
): number {
  const diferenciaFecha =
    new Date(
      b.fecha,
    ).getTime() -
    new Date(
      a.fecha,
    ).getTime();

  if (
    diferenciaFecha !== 0
  ) {
    return diferenciaFecha;
  }

  const diferenciaCreacion =
    new Date(
      b.creadoEn,
    ).getTime() -
    new Date(
      a.creadoEn,
    ).getTime();

  if (
    diferenciaCreacion !== 0
  ) {
    return diferenciaCreacion;
  }

  return b.id.localeCompare(
    a.id,
  );
}

/**
 * Solicita al servidor que recalcule las alertas push.
 *
 * Está preservada para el siguiente bloque de la migración,
 * pero temporalmente no se ejecuta.
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

        cache:
          "no-store",

        keepalive:
          true,

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
      )) as
      | RespuestaEvaluacionPush
      | null;

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

  if (
    payload?.ok !== true
  ) {
    throw new Error(
      "La evaluación push no confirmó una respuesta válida.",
    );
  }
}

/**
 * Administra los movimientos principales del presupuesto.
 *
 * Toda lectura y escritura financiera se limita al UID
 * autenticado:
 *
 * users/{uid}/gastos
 * users/{uid}/pagosTarjeta
 * users/{uid}/pagosFijos
 * users/{uid}/configuracion/presupuestoFelo
 */
export function useBudgetData() {
  const {
    user,
    authorized,
  } =
    useAuth();

  const uid =
    authorized
      ? user?.uid ??
        null
      : null;

  const [
    gastos,
    setGastos,
  ] =
    useState<
      GastoVariable[]
    >([]);

  const [
    pagos,
    setPagos,
  ] =
    useState<
      PagoTarjeta[]
    >([]);

  const [
    pagosFijos,
    setPagosFijos,
  ] =
    useState<
      PagoFijo[]
    >([]);

  const [
    limites,
    setLimites,
  ] =
    useState<LimitesVariables>(
      LIMITES_PREDETERMINADOS,
    );

  const [
    cargandoGastos,
    setCargandoGastos,
  ] =
    useState(true);

  const [
    cargandoPagos,
    setCargandoPagos,
  ] =
    useState(true);

  const [
    cargandoPagosFijos,
    setCargandoPagosFijos,
  ] =
    useState(true);

  const [
    cargandoLimites,
    setCargandoLimites,
  ] =
    useState(true);

  const [
    guardandoMovimiento,
    setGuardandoMovimiento,
  ] =
    useState(false);

  const [
    guardandoPagoFijo,
    setGuardandoPagoFijo,
  ] =
    useState(false);

  const [
    guardandoLimites,
    setGuardandoLimites,
  ] =
    useState(false);

  const [
    eliminandoMovimientoId,
    setEliminandoMovimientoId,
  ] =
    useState<
      string | null
    >(null);

  const [
    eliminandoPagoFijoId,
    setEliminandoPagoFijoId,
  ] =
    useState<
      string | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  /**
   * ========================================================
   * GASTOS
   * ========================================================
   */
  useEffect(() => {
    if (!uid) {
      return;
    }

    const consulta =
      query(
        getUserCollection(
          uid,
          "gastos",
        ),
        orderBy(
          "fecha",
          "desc",
        ),
      );

    return onSnapshot(
      consulta,

      (
        snapshot,
      ) => {
        const registros =
          snapshot.docs.flatMap(
            (
              documento,
            ) => {
              const data =
                documento.data();

              const categoria =
                normalizarCategoriaGasto(
                  data.categoria,
                );

              if (!categoria) {
                return [];
              }

              const fecha =
                typeof data.fecha ===
                "string"
                  ? data.fecha
                  : new Date()
                      .toISOString();

              return [
                {
                  id:
                    documento.id,

                  concepto:
                    typeof data.concepto ===
                    "string"
                      ? data.concepto
                      : "Gasto sin descripción",

                  monto:
                    normalizarMonto(
                      data.monto,
                      0,
                    ),

                  categoria,

                  fecha,

                  creadoEn:
                    normalizarCreadoEn(
                      data.creadoEn,
                      fecha,
                    ),

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
            },
          );

        setGastos(
          registros.sort(
            ordenarPorFechaYCreacion,
          ),
        );

        setCargandoGastos(
          false,
        );
      },

      (
        snapshotError,
      ) => {
        console.error(
          snapshotError,
        );

        setError(
          "No se pudieron cargar los gastos.",
        );

        setCargandoGastos(
          false,
        );
      },
    );
  }, [
    uid,
  ]);

  /**
   * ========================================================
   * PAGOS DE TARJETA
   * ========================================================
   */
  useEffect(() => {
    if (!uid) {
      return;
    }

    const consulta =
      query(
        getUserCollection(
          uid,
          "pagosTarjeta",
        ),
        orderBy(
          "fecha",
          "desc",
        ),
      );

    return onSnapshot(
      consulta,

      (
        snapshot,
      ) => {
        const registros =
          snapshot.docs.map(
            (
              documento,
            ) => {
              const data =
                documento.data();

              const fecha =
                typeof data.fecha ===
                "string"
                  ? data.fecha
                  : new Date()
                      .toISOString();

              return {
                id:
                  documento.id,

                concepto:
                  typeof data.concepto ===
                  "string"
                    ? data.concepto
                    : typeof data.tarjeta ===
                        "string"
                      ? data.tarjeta
                      : "Pago a tarjeta",

                monto:
                  normalizarMonto(
                    data.monto,
                    0,
                  ),

                categoria:
                  normalizarCategoriaPago(
                    data.categoria,
                  ),

                fecha,

                creadoEn:
                  normalizarCreadoEn(
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
            },
          );

        setPagos(
          registros.sort(
            ordenarPorFechaYCreacion,
          ),
        );

        setCargandoPagos(
          false,
        );
      },

      (
        snapshotError,
      ) => {
        console.error(
          snapshotError,
        );

        setError(
          "No se pudieron cargar los pagos de Comida y Gas.",
        );

        setCargandoPagos(
          false,
        );
      },
    );
  }, [
    uid,
  ]);

  /**
   * ========================================================
   * PAGOS FIJOS
   * ========================================================
   */
  useEffect(() => {
    if (!uid) {
      return;
    }

    const consulta =
      query(
        getUserCollection(
          uid,
          "pagosFijos",
        ),
        orderBy(
          "fecha",
          "desc",
        ),
      );

    return onSnapshot(
      consulta,

      (
        snapshot,
      ) => {
        const registros =
          snapshot.docs.map(
            (
              documento,
            ) => {
              const data =
                documento.data();

              const compromiso =
                COMPROMISOS_FIJOS.find(
                  (
                    item,
                  ) =>
                    item.id ===
                    data.compromisoId,
                );

              return {
                id:
                  documento.id,

                compromisoId:
                  typeof data.compromisoId ===
                  "string"
                    ? data.compromisoId
                    : "sin-asignar",

                descripcion:
                  typeof data.descripcion ===
                  "string"
                    ? data.descripcion
                    : compromiso
                        ?.descripcion ??
                      "Pago fijo",

                monto:
                  normalizarMonto(
                    data.monto,
                    0,
                  ),

                fecha:
                  typeof data.fecha ===
                  "string"
                    ? data.fecha
                    : new Date()
                        .toISOString(),

                metodo:
                  normalizarMetodoPago(
                    data.metodo,
                  ),

                periodicidad:
                  normalizarPeriodicidad(
                    data.periodicidad,
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
              } satisfies PagoFijo;
            },
          );

        setPagosFijos(
          registros,
        );

        setCargandoPagosFijos(
          false,
        );
      },

      (
        snapshotError,
      ) => {
        console.error(
          snapshotError,
        );

        setError(
          "No se pudieron cargar los pagos de gastos fijos.",
        );

        setCargandoPagosFijos(
          false,
        );
      },
    );
  }, [
    uid,
  ]);

  /**
   * ========================================================
   * LÍMITES
   * ========================================================
   */
  useEffect(() => {
    if (!uid) {
      return;
    }

    const referencia =
      getUserConfigDocument(
        uid,
        "presupuestoFelo",
      );

    return onSnapshot(
      referencia,

      (
        snapshot,
      ) => {
        setLimites(
          snapshot.exists()
            ? normalizarLimites(
                snapshot.data()
                  .limites,
              )
            : LIMITES_PREDETERMINADOS,
        );

        setCargandoLimites(
          false,
        );
      },

      (
        snapshotError,
      ) => {
        console.error(
          snapshotError,
        );

        setError(
          "No se pudo cargar la configuración del presupuesto.",
        );

        setCargandoLimites(
          false,
        );
      },
    );
  }, [
    uid,
  ]);

  /**
   * ========================================================
   * REGISTRAR MOVIMIENTO
   * ========================================================
   */
  const registrarMovimiento =
    async (
      movimiento:
        NuevoMovimiento,
    ): Promise<boolean> => {
      if (!uid) {
        setError(
          "No existe un usuario autorizado para guardar el movimiento.",
        );

        return false;
      }

      setGuardandoMovimiento(
        true,
      );

      setError(
        null,
      );

      try {
        if (
          movimiento.tipo ===
          "gasto"
        ) {
          await addDoc(
            getUserCollection(
              uid,
              "gastos",
            ),
            {
              concepto:
                movimiento.concepto
                  .trim(),

              monto:
                movimiento.monto,

              categoria:
                movimiento
                  .categoria,

              fecha:
                convertirFechaInputAISO(
                  movimiento.fecha,
                ),

              metodoPago:
                movimiento
                  .metodoPago ??
                (
                  movimiento
                    .tarjetaId
                    ? "tarjeta_credito"
                    : "debito"
                ),

              tarjetaId:
                movimiento
                  .tarjetaId ??
                null,

              creadoEn:
                serverTimestamp(),
            },
          );
        } else {
          await addDoc(
            getUserCollection(
              uid,
              "pagosTarjeta",
            ),
            {
              concepto:
                movimiento.concepto
                  .trim(),

              tarjeta:
                movimiento.concepto
                  .trim(),

              monto:
                movimiento.monto,

              categoria:
                movimiento
                  .categoria,

              fecha:
                convertirFechaInputAISO(
                  movimiento.fecha,
                ),

              tarjetaId:
                movimiento
                  .tarjetaId ??
                null,

              referencia:
                movimiento
                  .referencia
                  ?.trim() ??
                "",

              notas:
                movimiento
                  .notas
                  ?.trim() ??
                "",

              creadoEn:
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
        } catch (
          pushError
        ) {
          console.error(
            "El movimiento se guardó, pero no se pudieron evaluar las alertas push.",
            pushError,
          );

          setError(
            "El movimiento se guardó, pero no se pudieron evaluar las alertas push.",
          );
        }

        return true;
      } catch (
        guardarError
      ) {
        console.error(
          guardarError,
        );

        setError(
          "No se pudo guardar el movimiento. Revisa Firebase.",
        );

        return false;
      } finally {
        setGuardandoMovimiento(
          false,
        );
      }
    };

  /**
   * ========================================================
   * REGISTRAR PAGO FIJO
   * ========================================================
   */
  const registrarPagoFijo =
    async (
      pago:
        NuevoPagoFijo,
    ): Promise<boolean> => {
      if (!uid) {
        setError(
          "No existe un usuario autorizado para registrar el pago fijo.",
        );

        return false;
      }

      setGuardandoPagoFijo(
        true,
      );

      setError(
        null,
      );

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

            referencia:
              pago.referencia
                .trim(),

            notas:
              pago.notas
                .trim(),

            creadoEn:
              serverTimestamp(),
          },
        );

        return true;
      } catch (
        guardarError
      ) {
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
   * ========================================================
   * ELIMINAR MOVIMIENTO
   * ========================================================
   */
  const eliminarMovimiento =
    async (
      movimiento:
        Movimiento,
    ) => {
      if (!uid) {
        setError(
          "No existe un usuario autorizado para eliminar el movimiento.",
        );

        return;
      }

      const idEliminacion =
        `${movimiento.tipo}-${movimiento.id}`;

      setEliminandoMovimientoId(
        idEliminacion,
      );

      setError(
        null,
      );

      try {
        const coleccion =
          movimiento.tipo ===
          "gasto"
            ? "gastos"
            : "pagosTarjeta";

        await deleteDoc(
          getUserDocument(
            uid,
            coleccion,
            movimiento.id,
          ),
        );

        try {
          if (
            PUSH_EVALUATION_ENABLED
          ) {
            await evaluarAlertasPush();
          }
        } catch (
          pushError
        ) {
          console.error(
            "El movimiento se eliminó, pero no se pudieron evaluar las alertas push.",
            pushError,
          );

          setError(
            "El movimiento se eliminó, pero no se pudieron evaluar las alertas push.",
          );
        }
      } catch (
        eliminarError
      ) {
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

  /**
   * ========================================================
   * ELIMINAR PAGO FIJO
   * ========================================================
   */
  const eliminarPagoFijo =
    async (
      pago:
        PagoFijo,
    ): Promise<boolean> => {
      if (!uid) {
        setError(
          "No existe un usuario autorizado para eliminar el pago fijo.",
        );

        return false;
      }

      setEliminandoPagoFijoId(
        pago.id,
      );

      setError(
        null,
      );

      try {
        await deleteDoc(
          getUserDocument(
            uid,
            "pagosFijos",
            pago.id,
          ),
        );

        return true;
      } catch (
        eliminarError
      ) {
        console.error(
          eliminarError,
        );

        setError(
          "No se pudo eliminar el pago fijo.",
        );

        return false;
      } finally {
        setEliminandoPagoFijoId(
          null,
        );
      }
    };

  /**
   * ========================================================
   * GUARDAR LÍMITES
   * ========================================================
   */
  const guardarLimites =
    async (
      nuevosLimites:
        LimitesVariables,
    ): Promise<boolean> => {
      if (!uid) {
        setError(
          "No existe un usuario autorizado para guardar los límites.",
        );

        return false;
      }

      const limitesValidados =
        normalizarLimites(
          nuevosLimites,
        );

      setGuardandoLimites(
        true,
      );

      setError(
        null,
      );

      try {
        await setDoc(
          getUserConfigDocument(
            uid,
            "presupuestoFelo",
          ),

          {
            limites:
              limitesValidados,

            actualizadoEn:
              new Date()
                .toISOString(),
          },

          {
            merge: true,
          },
        );

        try {
          if (
            PUSH_EVALUATION_ENABLED
          ) {
            await evaluarAlertasPush();
          }
        } catch (
          pushError
        ) {
          console.error(
            "Los límites se guardaron, pero no se pudieron evaluar las alertas push.",
            pushError,
          );

          setError(
            "Los límites se guardaron, pero no se pudieron evaluar las alertas push.",
          );
        }

        return true;
      } catch (
        guardarError
      ) {
        console.error(
          guardarError,
        );

        setError(
          "No se pudieron guardar los límites.",
        );

        return false;
      } finally {
        setGuardandoLimites(
          false,
        );
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

    eliminandoMovimientoId,
    eliminandoPagoFijoId,

    error,

    limpiarError:
      () =>
        setError(
          null,
        ),

    registrarMovimiento,
    registrarPagoFijo,

    eliminarMovimiento,
    eliminarPagoFijo,

    guardarLimites,
  };
}