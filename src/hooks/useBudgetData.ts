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

export function useBudgetData() {
  const [gastos, setGastos] = useState<GastoVariable[]>([]);
  const [pagos, setPagos] = useState<PagoTarjeta[]>([]);
  const [pagosFijos, setPagosFijos] = useState<PagoFijo[]>([]);

  const [limites, setLimites] = useState<LimitesVariables>(
    LIMITES_PREDETERMINADOS,
  );

  const [cargandoGastos, setCargandoGastos] = useState(true);
  const [cargandoPagos, setCargandoPagos] = useState(true);
  const [cargandoPagosFijos, setCargandoPagosFijos] =
    useState(true);
  const [cargandoLimites, setCargandoLimites] =
    useState(true);

  const [guardandoMovimiento, setGuardandoMovimiento] =
    useState(false);

  const [guardandoPagoFijo, setGuardandoPagoFijo] =
    useState(false);

  const [guardandoLimites, setGuardandoLimites] =
    useState(false);

  const [
    eliminandoMovimientoId,
    setEliminandoMovimientoId,
  ] = useState<string | null>(null);

  const [
    eliminandoPagoFijoId,
    setEliminandoPagoFijoId,
  ] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  /*
   * Gastos variables:
   * comida y gas.
   */
  useEffect(() => {
    const consulta = query(
      collection(db, "gastos"),
      orderBy("fecha", "desc"),
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
        const registros = snapshot.docs.flatMap(
          (documento) => {
            const data = documento.data();

            const categoria = normalizarCategoriaGasto(
              data.categoria,
            );

            if (!categoria) {
              return [];
            }

            return [
              {
                id: documento.id,

                concepto:
                  typeof data.concepto === "string"
                    ? data.concepto
                    : "Gasto sin descripción",

                monto: normalizarMonto(data.monto, 0),

                categoria,

                fecha:
                  typeof data.fecha === "string"
                    ? data.fecha
                    : new Date().toISOString(),
              } satisfies GastoVariable,
            ];
          },
        );

        setGastos(registros);
        setCargandoGastos(false);
      },
      (snapshotError) => {
        console.error(snapshotError);

        setError(
          "No se pudieron cargar los gastos.",
        );

        setCargandoGastos(false);
      },
    );
  }, []);

  /*
   * Pagos que reducen el saldo pendiente
   * de comida y gas.
   */
  useEffect(() => {
    const consulta = query(
      collection(db, "pagosTarjeta"),
      orderBy("fecha", "desc"),
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
        const registros = snapshot.docs.map(
          (documento) => {
            const data = documento.data();

            return {
              id: documento.id,

              concepto:
                typeof data.concepto === "string"
                  ? data.concepto
                  : typeof data.tarjeta === "string"
                    ? data.tarjeta
                    : "Pago a tarjeta",

              monto: normalizarMonto(data.monto, 0),

              categoria: normalizarCategoriaPago(
                data.categoria,
              ),

              fecha:
                typeof data.fecha === "string"
                  ? data.fecha
                  : new Date().toISOString(),
            } satisfies PagoTarjeta;
          },
        );

        setPagos(registros);
        setCargandoPagos(false);
      },
      (snapshotError) => {
        console.error(snapshotError);

        setError(
          "No se pudieron cargar los pagos de Comida y Gas.",
        );

        setCargandoPagos(false);
      },
    );
  }, []);

  /*
   * Pagos o transferencias correspondientes
   * a compromisos fijos.
   */
  useEffect(() => {
    const consulta = query(
      collection(db, "pagosFijos"),
      orderBy("fecha", "desc"),
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
        const registros = snapshot.docs.map(
          (documento) => {
            const data = documento.data();

            const compromiso = COMPROMISOS_FIJOS.find(
              (item) =>
                item.id === data.compromisoId,
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
                  : compromiso?.descripcion ??
                    "Pago fijo",

              monto: normalizarMonto(data.monto, 0),

              fecha:
                typeof data.fecha === "string"
                  ? data.fecha
                  : new Date().toISOString(),

              metodo: normalizarMetodoPago(
                data.metodo,
              ),

              periodicidad:
                normalizarPeriodicidad(
                  data.periodicidad,
                ),

              referencia:
                typeof data.referencia === "string"
                  ? data.referencia
                  : "",

              notas:
                typeof data.notas === "string"
                  ? data.notas
                  : "",
            } satisfies PagoFijo;
          },
        );

        setPagosFijos(registros);
        setCargandoPagosFijos(false);
      },
      (snapshotError) => {
        console.error(snapshotError);

        setError(
          "No se pudieron cargar los pagos de gastos fijos.",
        );

        setCargandoPagosFijos(false);
      },
    );
  }, []);

  /*
   * Configuración de límites mensuales
   * y quincenales.
   */
  useEffect(() => {
    const referencia = doc(
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
                snapshot.data().limites,
              )
            : LIMITES_PREDETERMINADOS,
        );

        setCargandoLimites(false);
      },
      (snapshotError) => {
        console.error(snapshotError);

        setError(
          "No se pudo cargar la configuración del presupuesto.",
        );

        setCargandoLimites(false);
      },
    );
  }, []);

  /*
   * Registrar gasto variable o pago
   * destinado a comida/gas.
   */
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
          fecha: convertirFechaInputAISO(
            movimiento.fecha,
          ),
        });
      } else {
        await addDoc(
          collection(db, "pagosTarjeta"),
          {
            concepto: movimiento.concepto.trim(),

            /*
             * Se mantiene `tarjeta` por compatibilidad
             * con registros anteriores.
             */
            tarjeta: movimiento.concepto.trim(),

            monto: movimiento.monto,
            categoria: movimiento.categoria,

            fecha: convertirFechaInputAISO(
              movimiento.fecha,
            ),
          },
        );
      }

      return true;
    } catch (guardarError) {
      console.error(guardarError);

      setError(
        "No se pudo guardar el movimiento. Revisa Firebase.",
      );

      return false;
    } finally {
      setGuardandoMovimiento(false);
    }
  };

  /*
   * Registrar pago o transferencia
   * de un compromiso fijo.
   */
  const registrarPagoFijo = async (
    pago: NuevoPagoFijo,
  ): Promise<boolean> => {
    setGuardandoPagoFijo(true);
    setError(null);

    try {
      const fechaLocal = new Date(
        `${pago.fecha}T12:00:00`,
      );

      await addDoc(
        collection(db, "pagosFijos"),
        {
          compromisoId: pago.compromiso.id,
          descripcion:
            pago.compromiso.descripcion,

          monto: pago.monto,

          fecha: convertirFechaInputAISO(
            pago.fecha,
          ),

          metodo: pago.metodo,
          periodicidad: pago.periodicidad,

          quincena:
            obtenerQuincena(fechaLocal),

          periodo: pago.fecha.slice(0, 7),

          referencia:
            pago.referencia.trim(),

          notas: pago.notas.trim(),

          creadoEn:
            new Date().toISOString(),
        },
      );

      return true;
    } catch (guardarError) {
      console.error(guardarError);

      setError(
        "No se pudo registrar el pago fijo.",
      );

      return false;
    } finally {
      setGuardandoPagoFijo(false);
    }
  };

  /*
   * Eliminar gasto o pago variable.
   */
  const eliminarMovimiento = async (
    movimiento: Movimiento,
  ) => {
    const confirmado = window.confirm(
      `¿Eliminar "${movimiento.concepto}" por ${formatoMoneda.format(
        movimiento.monto,
      )}?`,
    );

    if (!confirmado) {
      return;
    }

    const idEliminacion =
      `${movimiento.tipo}-${movimiento.id}`;

    setEliminandoMovimientoId(idEliminacion);
    setError(null);

    try {
      const nombreColeccion =
        movimiento.tipo === "gasto"
          ? "gastos"
          : "pagosTarjeta";

      await deleteDoc(
        doc(
          db,
          nombreColeccion,
          movimiento.id,
        ),
      );
    } catch (eliminarError) {
      console.error(eliminarError);

      setError(
        "No se pudo eliminar el movimiento.",
      );
    } finally {
      setEliminandoMovimientoId(null);
    }
  };

  /*
   * Eliminar un pago fijo.
   */
  const eliminarPagoFijo = async (
    pago: PagoFijo,
  ) => {
    const confirmado = window.confirm(
      `¿Eliminar el pago de ${pago.descripcion} por ${formatoMoneda.format(
        pago.monto,
      )}?`,
    );

    if (!confirmado) {
      return;
    }

    setEliminandoPagoFijoId(pago.id);
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
      console.error(eliminarError);

      setError(
        "No se pudo eliminar el pago fijo.",
      );
    } finally {
      setEliminandoPagoFijoId(null);
    }
  };

  /*
   * Guardar límites de comida y gas.
   */
  const guardarLimites = async (
    nuevosLimites: LimitesVariables,
  ): Promise<boolean> => {
    const limitesValidados =
      normalizarLimites(nuevosLimites);

    setGuardandoLimites(true);
    setError(null);

    try {
      await setDoc(
        doc(
          db,
          "configuracion",
          "presupuestoFelo",
        ),
        {
          limites: limitesValidados,
          actualizadoEn:
            new Date().toISOString(),
        },
        {
          merge: true,
        },
      );

      return true;
    } catch (guardarError) {
      console.error(guardarError);

      setError(
        "No se pudieron guardar los límites.",
      );

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

    limpiarError: () => {
      setError(null);
    },

    registrarMovimiento,
    registrarPagoFijo,
    eliminarMovimiento,
    eliminarPagoFijo,
    guardarLimites,
  };
}