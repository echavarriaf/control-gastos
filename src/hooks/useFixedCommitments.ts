"use client";

import {
  addDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/contexts/AuthContext";

import {
  getUserCollection,
  getUserDocument,
} from "@/lib/firestore/user-paths";

import type {
  ActualizacionCompromisoFijo,
  CompromisoFijo,
  NuevoCompromisoFijo,
} from "@/lib/budget/types";

import {
  normalizarDocumento,
  ordenarCompromisos,
  validarCompromiso,
} from "@/lib/budget/fixed-commitments";

export function useFixedCommitments() {
  const {
    user,
    authorized,
  } = useAuth();

  const uid =
    authorized
      ? user?.uid ?? null
      : null;

  const [
    compromisos,
    setCompromisos,
  ] =
    useState<
      CompromisoFijo[]
    >([]);

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
    actualizandoId,
    setActualizandoId,
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

  useEffect(() => {
    if (!uid) {
      return;
    }

    const referencia =
      getUserCollection(
        uid,
        "compromisosFijos",
      );

    return onSnapshot(
      referencia,

      (
        snapshot,
      ) => {
        const registros =
          snapshot.docs
            .map(
              (
                documento,
              ) =>
                normalizarDocumento(
                  documento.id,
                  documento.data(),
                ),
            )
            .sort(
              ordenarCompromisos,
            );

        setCompromisos(
          registros,
        );

        setCargando(
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
          "No se pudieron cargar los gastos fijos configurables.",
        );

        setCompromisos(
          [],
        );

        setCargando(
          false,
        );
      },
    );
  }, [
    uid,
  ]);

  const compromisosActivos =
    useMemo(
      () =>
        compromisos.filter(
          (
            compromiso,
          ) =>
            compromiso.activo,
        ),
      [
        compromisos,
      ],
    );

  const crearCompromiso =
    useCallback(
      async (
        datos:
          NuevoCompromisoFijo,
      ): Promise<boolean> => {
        if (!uid) {
          setError(
            "No existe un usuario autorizado para crear el gasto fijo.",
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
          const compromiso =
            validarCompromiso(
              datos,
            );

          await addDoc(
            getUserCollection(
              uid,
              "compromisosFijos",
            ),
            {
              ...compromiso,

              creadoEn:
                serverTimestamp(),

              actualizadoEn:
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
            guardarError instanceof
              Error
              ? guardarError.message
              : "No se pudo crear el gasto fijo.",
          );

          return false;
        } finally {
          setGuardando(
            false,
          );
        }
      },
      [
        uid,
      ],
    );

  const actualizarCompromiso =
    useCallback(
      async (
        compromisoId:
          string,

        cambios:
          ActualizacionCompromisoFijo,
      ): Promise<boolean> => {
        if (!uid) {
          setError(
            "No existe un usuario autorizado para actualizar el gasto fijo.",
          );

          return false;
        }

        const actual =
          compromisos.find(
            (
              compromiso,
            ) =>
              compromiso.id ===
              compromisoId,
          );

        if (!actual) {
          setError(
            "No se encontró el gasto fijo.",
          );

          return false;
        }

        setActualizandoId(
          compromisoId,
        );

        setError(
          null,
        );

        try {
          const compromiso =
            validarCompromiso({
              descripcion:
                cambios.descripcion ??
                actual.descripcion,

              monto:
                cambios.monto ??
                actual.monto,

              diaVencimiento:
                cambios
                  .diaVencimiento ??
                actual
                  .diaVencimiento,

              quincenaPresupuestaria:
                cambios
                  .quincenaPresupuestaria ??
                actual
                  .quincenaPresupuestaria,

              prioridad:
                cambios.prioridad ??
                actual.prioridad,

              metodoPagoPreferido:
                cambios
                  .metodoPagoPreferido ??
                actual
                  .metodoPagoPreferido,

              tarjetaId:
                cambios.tarjetaId !==
                  undefined
                  ? cambios.tarjetaId
                  : actual
                    .tarjetaId,

              activo:
                cambios.activo ??
                actual.activo,
            });

          await setDoc(
            getUserDocument(
              uid,
              "compromisosFijos",
              compromisoId,
            ),
            {
              ...compromiso,

              actualizadoEn:
                serverTimestamp(),
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
            guardarError instanceof
              Error
              ? guardarError.message
              : "No se pudo actualizar el gasto fijo.",
          );

          return false;
        } finally {
          setActualizandoId(
            null,
          );
        }
      },
      [
        compromisos,
        uid,
      ],
    );

  const cambiarEstado =
    useCallback(
      async (
        compromisoId:
          string,

        activo:
          boolean,
      ): Promise<boolean> =>
        actualizarCompromiso(
          compromisoId,
          {
            activo,
          },
        ),
      [
        actualizarCompromiso,
      ],
    );

  return {
    compromisos,
    compromisosActivos,
    cargando,
    guardando,
    actualizandoId,
    error,

    limpiarError:
      () =>
        setError(
          null,
        ),

    crearCompromiso,
    actualizarCompromiso,
    cambiarEstado,
  };
}

export type FixedCommitmentsController =
  ReturnType<
    typeof useFixedCommitments
  >;