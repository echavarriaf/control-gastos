"use client";

import {
  addDoc,
  collection,
  doc,
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

import { db } from "@/lib/firebase";
import { COMPROMISOS_FIJOS } from "@/lib/budget/constants";

import type {
  ActualizacionCompromisoFijo,
  CompromisoFijo,
  MetodoPagoFijo,
  NuevoCompromisoFijo,
  PrioridadPago,
  Quincena,
} from "@/lib/budget/types";

const COLECCION =
  "compromisosFijos";

const METODOS_VALIDOS =
  new Set<MetodoPagoFijo>([
    "debito_automatico",
    "transferencia",
    "tarjeta",
    "efectivo",
    "otro",
  ]);

function normalizarMonto(
  valor: unknown,
  predeterminado: number,
): number {
  const numero =
    typeof valor === "number"
      ? valor
      : Number(valor);

  return Number.isFinite(numero) &&
    numero >= 0
    ? numero
    : predeterminado;
}

function normalizarDia(
  valor: unknown,
  predeterminado: number,
): number {
  const numero =
    Math.trunc(Number(valor));

  if (
    Number.isFinite(numero) &&
    numero >= 1 &&
    numero <= 31
  ) {
    return numero;
  }

  return predeterminado;
}

function normalizarQuincena(
  valor: unknown,
  diaVencimiento: number,
): Quincena {
  if (valor === 1 || valor === 2) {
    return valor;
  }

  return diaVencimiento <= 15
    ? 1
    : 2;
}

function normalizarPrioridad(
  valor: unknown,
  predeterminada: PrioridadPago,
): PrioridadPago {
  if (
    valor === 1 ||
    valor === 2 ||
    valor === 3
  ) {
    return valor;
  }

  return predeterminada;
}

function normalizarMetodo(
  valor: unknown,
  predeterminado: MetodoPagoFijo,
): MetodoPagoFijo {
  return typeof valor === "string" &&
    METODOS_VALIDOS.has(
      valor as MetodoPagoFijo,
    )
    ? (valor as MetodoPagoFijo)
    : predeterminado;
}

function normalizarTarjetaId(
  valor: unknown,
): string | null {
  if (typeof valor !== "string") {
    return null;
  }

  const tarjetaId = valor.trim();

  return tarjetaId.length > 0
    ? tarjetaId
    : null;
}

function normalizarFecha(
  valor: unknown,
): string | undefined {
  if (
    typeof valor === "string" &&
    valor.trim().length > 0
  ) {
    return valor;
  }

  if (
    typeof valor === "object" &&
    valor !== null &&
    "toDate" in valor &&
    typeof valor.toDate ===
      "function"
  ) {
    const fecha =
      valor.toDate();

    if (
      fecha instanceof Date &&
      !Number.isNaN(
        fecha.getTime(),
      )
    ) {
      return fecha.toISOString();
    }
  }

  return undefined;
}

function normalizarDocumento(
  id: string,
  data: Record<string, unknown>,
  predeterminado?: CompromisoFijo,
): CompromisoFijo {
  const descripcion =
    typeof data.descripcion ===
      "string" &&
    data.descripcion.trim().length >
      0
      ? data.descripcion.trim()
      : predeterminado
          ?.descripcion ??
        "Gasto fijo";

  const monto =
    normalizarMonto(
      data.monto,
      predeterminado?.monto ?? 0,
    );

  const diaVencimiento =
    normalizarDia(
      data.diaVencimiento,
      predeterminado
        ?.diaVencimiento ?? 1,
    );

  return {
    id,
    descripcion,
    monto,
    diaVencimiento,

    quincenaPresupuestaria:
      normalizarQuincena(
        data
          .quincenaPresupuestaria,
        diaVencimiento,
      ),

    prioridad:
      normalizarPrioridad(
        data.prioridad,
        predeterminado
          ?.prioridad ?? 2,
      ),

    metodoPagoPreferido:
      normalizarMetodo(
        data.metodoPagoPreferido,
        predeterminado
          ?.metodoPagoPreferido ??
          "transferencia",
      ),

    tarjetaId:
      normalizarTarjetaId(
        data.tarjetaId,
      ),

    activo:
      typeof data.activo ===
      "boolean"
        ? data.activo
        : predeterminado
            ?.activo ?? true,

    creadoEn:
      normalizarFecha(
        data.creadoEn,
      ) ??
      predeterminado
        ?.creadoEn,

    actualizadoEn:
      normalizarFecha(
        data.actualizadoEn,
      ) ??
      predeterminado
        ?.actualizadoEn,
  };
}

function validarCompromiso(
  compromiso: NuevoCompromisoFijo,
): NuevoCompromisoFijo {
  const descripcion =
    compromiso.descripcion.trim();

  if (!descripcion) {
    throw new Error(
      "Escribe el nombre del gasto fijo.",
    );
  }

  if (
    !Number.isFinite(
      compromiso.monto,
    ) ||
    compromiso.monto <= 0
  ) {
    throw new Error(
      "El monto debe ser mayor que cero.",
    );
  }

  const diaVencimiento =
    Math.trunc(
      compromiso.diaVencimiento,
    );

  if (
    diaVencimiento < 1 ||
    diaVencimiento > 31
  ) {
    throw new Error(
      "El día de vencimiento debe estar entre 1 y 31.",
    );
  }

  return {
    descripcion,
    monto:
      Math.round(
        compromiso.monto * 100,
      ) / 100,

    diaVencimiento,

    quincenaPresupuestaria:
      compromiso
        .quincenaPresupuestaria,

    prioridad:
      compromiso.prioridad,

    metodoPagoPreferido:
      compromiso
        .metodoPagoPreferido,

    tarjetaId:
      normalizarTarjetaId(
        compromiso.tarjetaId,
      ),

    activo:
      compromiso.activo,
  };
}

function ordenarCompromisos(
  a: CompromisoFijo,
  b: CompromisoFijo,
): number {
  if (
    a.activo !== b.activo
  ) {
    return a.activo
      ? -1
      : 1;
  }

  if (
    a.quincenaPresupuestaria !==
    b.quincenaPresupuestaria
  ) {
    return (
      a.quincenaPresupuestaria -
      b.quincenaPresupuestaria
    );
  }

  if (
    a.diaVencimiento !==
    b.diaVencimiento
  ) {
    return (
      a.diaVencimiento -
      b.diaVencimiento
    );
  }

  return a.descripcion.localeCompare(
    b.descripcion,
    "es",
  );
}

export function useFixedCommitments() {
  const [
    compromisos,
    setCompromisos,
  ] =
    useState<CompromisoFijo[]>(
      COMPROMISOS_FIJOS,
    );

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
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    const referencia =
      collection(
        db,
        COLECCION,
      );

    return onSnapshot(
      referencia,

      (snapshot) => {
        /*
         * Los documentos de Firestore reemplazan los valores
         * predeterminados con el mismo id. Así podemos editar
         * o desactivar gastos existentes sin perder los ids
         * utilizados por pagos anteriores.
         */
        const porId =
          new Map<
            string,
            CompromisoFijo
          >(
            COMPROMISOS_FIJOS.map(
              (compromiso) => [
                compromiso.id,
                compromiso,
              ],
            ),
          );

        snapshot.docs.forEach(
          (documento) => {
            const predeterminado =
              porId.get(
                documento.id,
              );

            porId.set(
              documento.id,
              normalizarDocumento(
                documento.id,
                documento.data(),
                predeterminado,
              ),
            );
          },
        );

        setCompromisos(
          Array.from(
            porId.values(),
          ).sort(
            ordenarCompromisos,
          ),
        );

        setCargando(false);
      },

      (snapshotError) => {
        console.error(
          snapshotError,
        );

        setError(
          "No se pudieron cargar los gastos fijos configurables.",
        );

        /*
         * La lista inicial permanece disponible si Firestore
         * todavía no permite leer la nueva colección.
         */
        setCompromisos(
          [...COMPROMISOS_FIJOS].sort(
            ordenarCompromisos,
          ),
        );

        setCargando(false);
      },
    );
  }, []);

  const compromisosActivos =
    useMemo(
      () =>
        compromisos.filter(
          (compromiso) =>
            compromiso.activo,
        ),
      [compromisos],
    );

  const crearCompromiso =
    useCallback(
      async (
        datos:
          NuevoCompromisoFijo,
      ): Promise<boolean> => {
        setGuardando(true);
        setError(null);

        try {
          const compromiso =
            validarCompromiso(
              datos,
            );

          await addDoc(
            collection(
              db,
              COLECCION,
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
          setGuardando(false);
        }
      },
      [],
    );

  const actualizarCompromiso =
    useCallback(
      async (
        compromisoId: string,
        cambios:
          ActualizacionCompromisoFijo,
      ): Promise<boolean> => {
        const actual =
          compromisos.find(
            (compromiso) =>
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
        setError(null);

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
                  : actual.tarjetaId,

              activo:
                cambios.activo ??
                actual.activo,
            });

          await setDoc(
            doc(
              db,
              COLECCION,
              compromisoId,
            ),
            {
              ...compromiso,
              actualizadoEn:
                serverTimestamp(),
            },
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
      [compromisos],
    );

  const cambiarEstado =
    useCallback(
      async (
        compromisoId: string,
        activo: boolean,
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

    limpiarError: () =>
      setError(null),

    crearCompromiso,
    actualizarCompromiso,
    cambiarEstado,
  };
}

export type FixedCommitmentsController =
  ReturnType<
    typeof useFixedCommitments
  >;