"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import type {
  CicloPago,
  ConfiguracionIngreso,
  EstadoIngreso,
  Ingreso,
} from "@/lib/budget/types";

type IngresoGuardable =
  Omit<Ingreso, "id"> & {
    creadoEn: string;
    actualizadoEn: string;
  };

function esNumeroValido(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function esTexto(
  value: unknown,
): value is string {
  return typeof value === "string";
}

function esEstadoIngreso(
  value: unknown,
): value is EstadoIngreso {
  return (
    value === "proyectado" ||
    value === "recibido" ||
    value === "cancelado"
  );
}

function normalizarIngreso(
  id: string,
  data: Record<string, unknown>,
): Ingreso | null {
  if (
    !esTexto(data.descripcion) ||
    !esNumeroValido(data.monto) ||
    !esTexto(data.fechaProgramada) ||
    !esTexto(data.periodoCalendario) ||
    !esNumeroValido(data.numeroPagoMes) ||
    !esNumeroValido(data.numeroPagoAnual) ||
    !esTexto(data.fuente) ||
    !esEstadoIngreso(data.estado) ||
    typeof data.recurrente !== "boolean" ||
    !esTexto(data.notas)
  ) {
    return null;
  }

  return {
    id,

    configuracionIngresoId:
      esTexto(data.configuracionIngresoId)
        ? data.configuracionIngresoId
        : null,

    cicloPagoId:
      esTexto(data.cicloPagoId)
        ? data.cicloPagoId
        : id,

    descripcion:
      data.descripcion,

    monto:
      data.monto,

    fechaProgramada:
      data.fechaProgramada,

    fechaRecibida:
      esTexto(data.fechaRecibida)
        ? data.fechaRecibida
        : null,

    periodoCalendario:
      data.periodoCalendario,

    numeroPagoMes:
      Math.trunc(
        data.numeroPagoMes,
      ),

    numeroPagoAnual:
      Math.trunc(
        data.numeroPagoAnual,
      ),

    fuente:
      data.fuente as Ingreso["fuente"],

    estado:
      data.estado,

    recurrente:
      data.recurrente,

    notas:
      data.notas,
  };
}

function construirIngresoDesdeCiclo(
  ciclo: CicloPago,
  configuracion: ConfiguracionIngreso,
  monto: number,
  estado: EstadoIngreso,
  fechaRecibida: string | null,
): Ingreso {
  return {
    id:
      ciclo.id,

    configuracionIngresoId:
      configuracion.id,

    cicloPagoId:
      ciclo.id,

    descripcion:
      configuracion.descripcion,

    monto,

    fechaProgramada:
      ciclo.fechaPagoProgramada,

    fechaRecibida,

    periodoCalendario:
      ciclo.periodoCalendario,

    numeroPagoMes:
      ciclo.numeroPagoMes,

    numeroPagoAnual:
      ciclo.numeroPagoAnual,

    fuente:
      configuracion.fuente,

    estado,

    recurrente:
      true,

    notas:
      configuracion.notas,
  };
}

function prepararParaGuardar(
  ingreso: Ingreso,
  creadoEn?: string,
): IngresoGuardable {
  const {
    id: _id,
    ...datos
  } = ingreso;

  const ahora =
    new Date().toISOString();

  return {
    ...datos,

    creadoEn:
      creadoEn ?? ahora,

    actualizadoEn:
      ahora,
  };
}

/**
 * Administra los ingresos reales y proyectados.
 *
 * Colección:
 *
 * ingresos/{cicloPagoId}
 *
 * Se usa el ID del ciclo como ID del documento para evitar
 * registrar dos veces el mismo pago.
 */
export function useIncomeTransactions() {
  const [
    ingresos,
    setIngresos,
  ] =
    useState<Ingreso[]>([]);

  const [
    cargando,
    setCargando,
  ] =
    useState(true);

  const [
    guardando,
    setGuardando,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    const consulta =
      query(
        collection(
          db,
          "ingresos",
        ),
        orderBy(
          "fechaProgramada",
          "desc",
        ),
      );

    return onSnapshot(
      consulta,

      (snapshot) => {
        const siguientesIngresos =
          snapshot.docs
            .map((documento) =>
              normalizarIngreso(
                documento.id,
                documento.data(),
              ),
            )
            .filter(
              (
                ingreso,
              ): ingreso is Ingreso =>
                ingreso !== null,
            );

        setIngresos(
          siguientesIngresos,
        );

        setCargando(
          false,
        );
      },

      (snapshotError) => {
        console.error(
          snapshotError,
        );

        setError(
          "No se pudieron cargar los ingresos.",
        );

        setCargando(
          false,
        );
      },
    );
  }, []);

  const ingresosPorCiclo =
    useMemo(
      () =>
        new Map(
          ingresos.map(
            (ingreso) => [
              ingreso.cicloPagoId,
              ingreso,
            ],
          ),
        ),
      [
        ingresos,
      ],
    );

  const guardarIngreso =
    async (
      ingreso: Ingreso,
    ): Promise<boolean> => {
      setGuardando(
        true,
      );

      setError(
        null,
      );

      try {
        const existente =
          ingresosPorCiclo.get(
            ingreso.cicloPagoId,
          );

        await setDoc(
          doc(
            db,
            "ingresos",
            ingreso.cicloPagoId,
          ),

          prepararParaGuardar(
            ingreso,
            existente
              ? undefined
              : new Date().toISOString(),
          ),

          {
            merge: true,
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
          "No se pudo guardar el ingreso.",
        );

        return false;
      } finally {
        setGuardando(
          false,
        );
      }
    };

  const registrarIngresoProyectado =
    async (
      ciclo: CicloPago,
      configuracion: ConfiguracionIngreso,
      monto =
        configuracion.montoEstimado,
    ): Promise<boolean> =>
      guardarIngreso(
        construirIngresoDesdeCiclo(
          ciclo,
          configuracion,
          monto,
          "proyectado",
          null,
        ),
      );

  const registrarIngresoRecibido =
    async (
      ciclo: CicloPago,
      configuracion: ConfiguracionIngreso,
      monto: number,
      fechaRecibida =
        ciclo.fechaPagoProgramada,
    ): Promise<boolean> =>
      guardarIngreso(
        construirIngresoDesdeCiclo(
          ciclo,
          configuracion,
          monto,
          "recibido",
          fechaRecibida,
        ),
      );

  const marcarComoRecibido =
    async (
      cicloPagoId: string,
      monto: number,
      fechaRecibida: string,
    ): Promise<boolean> => {
      if (
        !esNumeroValido(monto) ||
        monto <= 0
      ) {
        setError(
          "El monto recibido debe ser mayor que cero.",
        );

        return false;
      }

      setGuardando(
        true,
      );

      setError(
        null,
      );

      try {
        await updateDoc(
          doc(
            db,
            "ingresos",
            cicloPagoId,
          ),

          {
            monto,
            fechaRecibida,
            estado:
              "recibido",
            actualizadoEn:
              new Date().toISOString(),
          },
        );

        return true;
      } catch (
        actualizarError
      ) {
        console.error(
          actualizarError,
        );

        setError(
          "No se pudo marcar el ingreso como recibido.",
        );

        return false;
      } finally {
        setGuardando(
          false,
        );
      }
    };

  const eliminarIngreso =
    async (
      cicloPagoId: string,
    ): Promise<boolean> => {
      setGuardando(
        true,
      );

      setError(
        null,
      );

      try {
        await deleteDoc(
          doc(
            db,
            "ingresos",
            cicloPagoId,
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
          "No se pudo eliminar el ingreso.",
        );

        return false;
      } finally {
        setGuardando(
          false,
        );
      }
    };

  return {
    ingresos,

    ingresosPorCiclo,

    cargando,

    guardando,

    error,

    limpiarError:
      () =>
        setError(
          null,
        ),

    guardarIngreso,

    registrarIngresoProyectado,

    registrarIngresoRecibido,

    marcarComoRecibido,

    eliminarIngreso,
  };
}