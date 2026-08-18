"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onSnapshot,
  setDoc,
} from "firebase/firestore";

import { useAuth } from "@/contexts/AuthContext";

import {
  getUserConfigDocument,
} from "@/lib/firestore/user-paths";

import {
  CONFIGURACION_INGRESO_PREDETERMINADA,
  ID_INGRESO_PRINCIPAL,
  normalizarConfiguracionIngreso,
  prepararConfiguracionIngresoParaGuardar,
} from "@/lib/budget/income-config";

import {
  agregarDiasUTC,
  generarCiclosPago,
  obtenerCiclosDelMes,
  obtenerPagoEnOAntesDe,
} from "@/lib/budget/pay-cycles";

import type {
  CicloPago,
  ConfiguracionIngreso,
} from "@/lib/budget/types";

const CICLOS_ANTERIORES_DIAS =
  56;

const CANTIDAD_CICLOS_GENERADOS =
  32;

function obtenerFechaLocalISO(
  fecha = new Date(),
): string {
  const anio =
    fecha.getFullYear();

  const mes =
    String(
      fecha.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const dia =
    String(
      fecha.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${anio}-${mes}-${dia}`;
}

interface ResultadoCiclosIngreso {
  ciclos:
    CicloPago[];

  cicloActual:
    CicloPago | null;

  proximoCiclo:
    CicloPago | null;

  ciclosMesActual:
    CicloPago[];
}

/**
 * Lee y guarda la configuración del ingreso principal.
 *
 * Documento:
 *
 * users/{uid}/configuracion/ingresoPrincipal
 *
 * Los ciclos continúan calculándose localmente.
 */
export function useIncomeData() {
  const {
    user,
    authorized,
  } = useAuth();

  const uid =
    authorized
      ? user?.uid ?? null
      : null;

  const [
    configuracion,
    setConfiguracion,
  ] =
    useState<ConfiguracionIngreso>(
      CONFIGURACION_INGRESO_PREDETERMINADA,
    );

  const [
    cargandoConfiguracion,
    setCargandoConfiguracion,
  ] =
    useState(
      true,
    );

  const [
    guardandoConfiguracion,
    setGuardandoConfiguracion,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  useEffect(() => {
    if (!uid) {
      return;
    }

    const referencia =
      getUserConfigDocument(
        uid,
        ID_INGRESO_PRINCIPAL,
      );

    return onSnapshot(
      referencia,

      (
        snapshot,
      ) => {
        const siguienteConfiguracion =
          snapshot.exists()
            ? normalizarConfiguracionIngreso(
                snapshot.data(),
              )
            : CONFIGURACION_INGRESO_PREDETERMINADA;

        setConfiguracion(
          siguienteConfiguracion,
        );

        setCargandoConfiguracion(
          false,
        );
      },

      (
        snapshotError,
      ) => {
        console.error(
          snapshotError,
        );

        setConfiguracion(
          CONFIGURACION_INGRESO_PREDETERMINADA,
        );

        setError(
          "No se pudo cargar la configuración del ingreso.",
        );

        setCargandoConfiguracion(
          false,
        );
      },
    );
  }, [
    uid,
  ]);

  const resultadoCiclos =
    useMemo<ResultadoCiclosIngreso>(
      () => {
        const fechaReferencia =
          obtenerFechaLocalISO();

        const intervaloDias =
          configuracion
            .intervaloDias ??
          14;

        const pagoBase =
          obtenerPagoEnOAntesDe(
            fechaReferencia,
            configuracion
              .fechaAncla,
            intervaloDias,
          );

        const fechaInicio =
          agregarDiasUTC(
            pagoBase,
            -CICLOS_ANTERIORES_DIAS,
          );

        const ciclos =
          generarCiclosPago({
            configuracion,

            fechaInicio,

            cantidad:
              CANTIDAD_CICLOS_GENERADOS,

            fechaReferencia,
          });

        const cicloActual =
          ciclos.find(
            (
              ciclo,
            ) =>
              ciclo.estado ===
              "abierto",
          ) ??
          null;

        const proximoCiclo =
          ciclos.find(
            (
              ciclo,
            ) =>
              ciclo.estado ===
              "proyectado",
          ) ??
          null;

        const periodoActual =
          fechaReferencia.slice(
            0,
            7,
          );

        return {
          ciclos,

          cicloActual,

          proximoCiclo,

          ciclosMesActual:
            obtenerCiclosDelMes(
              ciclos,
              periodoActual,
            ),
        };
      },
      [
        configuracion,
      ],
    );

  const guardarConfiguracion =
    async (
      siguienteConfiguracion:
        ConfiguracionIngreso,
    ): Promise<boolean> => {
      if (!uid) {
        setError(
          "No existe un usuario autorizado para guardar la configuración del ingreso.",
        );

        return false;
      }

      setGuardandoConfiguracion(
        true,
      );

      setError(
        null,
      );

      try {
        const normalizada =
          normalizarConfiguracionIngreso(
            siguienteConfiguracion,
          );

        await setDoc(
          getUserConfigDocument(
            uid,
            ID_INGRESO_PRINCIPAL,
          ),

          {
            ...prepararConfiguracionIngresoParaGuardar(
              normalizada,
            ),

            actualizadoEn:
              new Date()
                .toISOString(),
          },

          {
            merge:
              true,
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
          "No se pudo guardar la configuración del ingreso.",
        );

        return false;
      } finally {
        setGuardandoConfiguracion(
          false,
        );
      }
    };

  return {
    configuracion,

    ciclos:
      resultadoCiclos
        .ciclos,

    cicloActual:
      resultadoCiclos
        .cicloActual,

    proximoCiclo:
      resultadoCiclos
        .proximoCiclo,

    ciclosMesActual:
      resultadoCiclos
        .ciclosMesActual,

    cargando:
      cargandoConfiguracion,

    guardandoConfiguracion,

    error,

    limpiarError:
      () =>
        setError(
          null,
        ),

    guardarConfiguracion,
  };
}