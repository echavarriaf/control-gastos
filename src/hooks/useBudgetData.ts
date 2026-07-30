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
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  COMPROMISOS_FIJOS,
  LIMITES_PREDETERMINADOS,
} from "@/lib/budget/constants";
import type {
  GastoVariable,
  LimitesVariables,
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

const PUSH_EVALUATE_ENDPOINT =
  "/api/push/evaluate";

interface PushEvaluateResponse {
  ok?: boolean;
  error?: string;
  detalle?: string;
}

/**
 * Solicita al servidor que recalcule las alertas push.
 *
 * Una falla de notificaciones no debe deshacer ni marcar
 * como fallido un movimiento que Firestore ya guardó.
 */
async function evaluarAlertasPush(): Promise<void> {
  try {
    const response = await fetch(
      PUSH_EVALUATE_ENDPOINT,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        keepalive: true,

        headers: {
          Accept: "application/json",
        },
      },
    );

    const resultado = (await response
      .json()
      .catch(
        () => null,
      )) as PushEvaluateResponse | null;

    if (
      !response.ok ||
      resultado?.ok === false
    ) {
      throw new Error(
        resultado?.detalle ??
          resultado?.error ??
          `La evaluación push respondió con HTTP ${response.status}.`,
      );
    }
  } catch (pushError) {
    console.warn(
      "El movimiento se guardó, pero no se pudieron evaluar las alertas push.",
      pushError,
    );
  }
}

export function useBudgetData() {
  const [
    gastos,
    setGastos,
  ] = useState<
    GastoVariable[]
  >([]);

  const [
    pagos,
    setPagos,
  ] = useState<
    PagoTarjeta[]
  >([]);

  const [
    pagosFijos,
    setPagosFijos,
  ] = useState<
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
  ] = useState(true);

  const [
    cargandoPagos,
    setCargandoPagos,
  ] = useState(true);

  const [
    cargandoPagosFijos,
    setCargandoPagosFijos,
  ] = useState(true);

  const [
    cargandoLimites,
    setCargandoLimites,
  ] = useState(true);

  const [
    guardandoMovimiento,
    setGuardandoMovimiento,
  ] = useState(false);

  const [
    guardandoPagoFijo,
    setGuardandoPagoFijo,
  ] = useState(false);

  const [
    guardandoLimites,
    setGuardandoLimites,
  ] = useState(false);

  const [
    eliminandoMovimientoId,
    setEliminandoMovimientoId,
  ] = useState<
    string | null
  >(null);

  const [
    eliminandoPagoFijoId,
    setEliminandoPagoFijoId,
  ] = useState<
    string | null
  >(null);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    const consulta =
      query(
        collection(
          db,
          "gastos",
        ),

        orderBy(
          "fecha",
          "desc",
        ),
      );

    return onSnapshot(
      consulta,

      (snapshot) => {
        const registros =
          snapshot.docs.flatMap(
            (documento) => {
              const data =
                documento.data();

              const categoria =
                normalizarCategoriaGasto(
                  data.categoria,
                );

              if (!categoria) {
                return [];
              }

              return [
                {
                  id: documento.id,

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

                  fecha:
                    typeof data.fecha ===
                    "string"
                      ? data.fecha
                      : new Date().toISOString(),
                } satisfies GastoVariable,
              ];
            },
          );

        setGastos(
          registros,
        );

        setCargandoGastos(
          false,
        );
      },

      (snapshotError) => {
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
  }, []);

  useEffect(() => {
    const consulta =
      query(
        collection(
          db,
          "pagosTarjeta",
        ),

        orderBy(
          "fecha",
          "desc",
        ),
      );

    return onSnapshot(
      consulta,

      (snapshot) => {
        const registros =
          snapshot.docs.map(
            (documento) => {
              const data =
                documento.data();

              return {
                id: documento.id,

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

                fecha:
                  typeof data.fecha ===
                  "string"
                    ? data.fecha
                    : new Date().toISOString(),
              } satisfies PagoTarjeta;
            },
          );

        setPagos(
          registros,
        );

        setCargandoPagos(
          false,
        );
      },

      (snapshotError) => {
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
  }, []);

  useEffect(() => {
    const consulta =
      query(
        collection(
          db,
          "pagosFijos",
        ),

        orderBy(
          "fecha",
          "desc",
        ),
      );

    return onSnapshot(
      consulta,

      (snapshot) => {
        const registros =
          snapshot.docs.map(
            (documento) => {
              const data =
                documento.data();

              const compromiso =
                COMPROMISOS_FIJOS.find(
                  (item) =>
                    item.id ===
                    data.compromisoId,
                );

              return {
                id: documento.id,

                compromisoId:
                  typeof data.compromisoId ===
                  "string"
                    ? data.compromisoId
                    : "sin-asignar",

                descripcion:
                  typeof data.descripcion ===
                  "string"
                    ? data.descripcion
                    : compromiso?.descripcion ??
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
                    : new Date().toISOString(),

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

      (snapshotError) => {
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
  }, []);

  useEffect(() => {
    const referencia =
      doc(
        db,
        "configuracion",
        "presupuestoFelo",
      );

    return onSnapshot(
      referencia,

      (snapshot) => {
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

      (snapshotError) => {
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
  }, []);

  const registrarMovimiento =
    async (
      movimiento:
        NuevoMovimiento,
    ): Promise<boolean> => {
      setGuardandoMovimiento(
        true,
      );

      setError(null);

      try {
        if (
          movimiento.tipo ===
          "gasto"
        ) {
          await addDoc(
            collection(
              db,
              "gastos",
            ),

            {
              concepto:
                movimiento.concepto.trim(),

              monto:
                movimiento.monto,

              categoria:
                movimiento.categoria,

              fecha:
                convertirFechaInputAISO(
                  movimiento.fecha,
                ),
            },
          );
        } else {
          await addDoc(
            collection(
              db,
              "pagosTarjeta",
            ),

            {
              concepto:
                movimiento.concepto.trim(),

              tarjeta:
                movimiento.concepto.trim(),

              monto:
                movimiento.monto,

              categoria:
                movimiento.categoria,

              fecha:
                convertirFechaInputAISO(
                  movimiento.fecha,
                ),
            },
          );
        }

        void evaluarAlertasPush();

        return true;
      } catch (guardarError) {
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

  const registrarPagoFijo =
    async (
      pago:
        NuevoPagoFijo,
    ): Promise<boolean> => {
      setGuardandoPagoFijo(
        true,
      );

      setError(null);

      try {
        await addDoc(
          collection(
            db,
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
              pago.referencia.trim(),

            notas:
              pago.notas.trim(),

            creadoEn:
              new Date().toISOString(),
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

  const eliminarMovimiento =
    async (
      movimiento:
        Movimiento,
    ) => {
      const confirmado =
        window.confirm(
          `¿Eliminar "${movimiento.concepto}" por ${formatoMoneda.format(
            movimiento.monto,
          )}?`,
        );

      if (!confirmado) {
        return;
      }

      const idEliminacion =
        `${movimiento.tipo}-${movimiento.id}`;

      setEliminandoMovimientoId(
        idEliminacion,
      );

      setError(null);

      try {
        const coleccion =
          movimiento.tipo ===
          "gasto"
            ? "gastos"
            : "pagosTarjeta";

        await deleteDoc(
          doc(
            db,
            coleccion,
            movimiento.id,
          ),
        );

        void evaluarAlertasPush();
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

  const eliminarPagoFijo =
    async (
      pago:
        PagoFijo,
    ) => {
      const confirmado =
        window.confirm(
          `¿Eliminar el pago de ${pago.descripcion} por ${formatoMoneda.format(
            pago.monto,
          )}?`,
        );

      if (!confirmado) {
        return;
      }

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

  const guardarLimites =
    async (
      nuevosLimites:
        LimitesVariables,
    ): Promise<boolean> => {
      const limitesValidados =
        normalizarLimites(
          nuevosLimites,
        );

      setGuardandoLimites(
        true,
      );

      setError(null);

      try {
        await setDoc(
          doc(
            db,
            "configuracion",
            "presupuestoFelo",
          ),

          {
            limites:
              limitesValidados,

            actualizadoEn:
              new Date().toISOString(),
          },

          {
            merge: true,
          },
        );

        void evaluarAlertasPush();

        return true;
      } catch (guardarError) {
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
      () => setError(null),

    registrarMovimiento,
    registrarPagoFijo,

    eliminarMovimiento,
    eliminarPagoFijo,

    guardarLimites,
  };
}