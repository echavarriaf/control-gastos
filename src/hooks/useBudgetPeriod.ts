"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  Quincena,
} from "@/lib/budget/types";

import {
  obtenerPeriodo,
  obtenerQuincena,
} from "@/lib/budget/utils";

/**
 * Administra el período visible del presupuesto.
 *
 * También detecta cuando comienza un mes nuevo mientras
 * la aplicación permanece abierta o vuelve del segundo plano.
 */
export function useBudgetPeriod() {
  const [
    periodoActual,
    setPeriodoActual,
  ] = useState(() =>
    obtenerPeriodo(
      new Date(),
    ),
  );

  const [
    mesSeleccionado,
    setMesSeleccionado,
  ] = useState(() =>
    obtenerPeriodo(
      new Date(),
    ),
  );

  const [
    quincenaSeleccionada,
    setQuincenaSeleccionada,
  ] = useState<Quincena>(
    () =>
      obtenerQuincena(
        new Date(),
      ),
  );

  const periodoActualRef =
    useRef(
      periodoActual,
    );

  useEffect(() => {
    const sincronizarPeriodo =
      () => {
        const ahora =
          new Date();

        const nuevoPeriodo =
          obtenerPeriodo(
            ahora,
          );

        if (
          periodoActualRef
            .current ===
          nuevoPeriodo
        ) {
          return;
        }

        periodoActualRef.current =
          nuevoPeriodo;

        setPeriodoActual(
          nuevoPeriodo,
        );

        setMesSeleccionado(
          nuevoPeriodo,
        );

        setQuincenaSeleccionada(
          obtenerQuincena(
            ahora,
          ),
        );
      };

    sincronizarPeriodo();

    const intervalId =
      window.setInterval(
        sincronizarPeriodo,
        60_000,
      );

    const sincronizarAlRegresar =
      () => {
        if (
          document
            .visibilityState ===
          "visible"
        ) {
          sincronizarPeriodo();
        }
      };

    document.addEventListener(
      "visibilitychange",
      sincronizarAlRegresar,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      document.removeEventListener(
        "visibilitychange",
        sincronizarAlRegresar,
      );
    };
  }, []);

  return {
    periodoActual,
    mesSeleccionado,
    quincenaSeleccionada,
    setMesSeleccionado,
    setQuincenaSeleccionada,
  };
}