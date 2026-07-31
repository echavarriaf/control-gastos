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

interface UseBudgetPeriodArgs {
  /**
   * Periodo financiado por el ciclo de ingreso actual.
   * Formato: YYYY-MM.
   */
  periodoPresupuestarioActual?:
    string;

  /**
   * Quincena financiada por el ciclo de ingreso actual.
   */
  quincenaPresupuestariaActual?:
    Quincena | null;

  /**
   * Evita sincronizar con valores temporales mientras
   * se carga la configuración del ingreso.
   */
  cargando?: boolean;
}

interface PeriodoPresupuestario {
  periodo: string;
  quincena: Quincena;
}

function obtenerPeriodoCalendarioActual():
  PeriodoPresupuestario {
  const ahora =
    new Date();

  return {
    periodo:
      obtenerPeriodo(
        ahora,
      ),

    quincena:
      obtenerQuincena(
        ahora,
      ),
  };
}

/**
 * Administra el periodo visible del presupuesto.
 *
 * Cuando recibe el ciclo de ingreso actual, el periodo y la
 * quincena se determinan por el dinero que los financia.
 *
 * Mantiene un fallback basado en el calendario para conservar
 * compatibilidad mientras los componentes terminan de migrarse.
 */
export function useBudgetPeriod({
  periodoPresupuestarioActual,
  quincenaPresupuestariaActual,
  cargando = false,
}: UseBudgetPeriodArgs = {}) {
  const periodoInicial =
    periodoPresupuestarioActual &&
    quincenaPresupuestariaActual
      ? {
          periodo:
            periodoPresupuestarioActual,

          quincena:
            quincenaPresupuestariaActual,
        }
      : obtenerPeriodoCalendarioActual();

  const [
    periodoActual,
    setPeriodoActual,
  ] =
    useState(
      periodoInicial.periodo,
    );

  const [
    mesSeleccionado,
    setMesSeleccionado,
  ] =
    useState(
      periodoInicial.periodo,
    );

  const [
    quincenaSeleccionada,
    setQuincenaSeleccionada,
  ] =
    useState<Quincena>(
      periodoInicial.quincena,
    );

  const periodoActualRef =
    useRef(
      periodoInicial.periodo,
    );

  const quincenaActualRef =
    useRef<Quincena>(
      periodoInicial.quincena,
    );

  useEffect(() => {
    const sincronizarPeriodo = (
      siguiente:
        PeriodoPresupuestario,
    ) => {
      const cambioPeriodo =
        periodoActualRef.current !==
        siguiente.periodo;

      const cambioQuincena =
        quincenaActualRef.current !==
        siguiente.quincena;

      if (
        !cambioPeriodo &&
        !cambioQuincena
      ) {
        return;
      }

      periodoActualRef.current =
        siguiente.periodo;

      quincenaActualRef.current =
        siguiente.quincena;

      setPeriodoActual(
        siguiente.periodo,
      );

      setMesSeleccionado(
        siguiente.periodo,
      );

      setQuincenaSeleccionada(
        siguiente.quincena,
      );
    };

    if (
      !cargando &&
      periodoPresupuestarioActual &&
      quincenaPresupuestariaActual
    ) {
      sincronizarPeriodo({
        periodo:
          periodoPresupuestarioActual,

        quincena:
          quincenaPresupuestariaActual,
      });

      return;
    }

    const sincronizarCalendario =
      () => {
        sincronizarPeriodo(
          obtenerPeriodoCalendarioActual(),
        );
      };

    sincronizarCalendario();

    const intervalId =
      window.setInterval(
        sincronizarCalendario,
        60_000,
      );

    const sincronizarAlRegresar =
      () => {
        if (
          document
            .visibilityState ===
          "visible"
        ) {
          sincronizarCalendario();
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
  }, [
    cargando,
    periodoPresupuestarioActual,
    quincenaPresupuestariaActual,
  ]);

  return {
    periodoActual,
    mesSeleccionado,
    quincenaSeleccionada,
    setMesSeleccionado,
    setQuincenaSeleccionada,
  };
}