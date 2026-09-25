"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { useAuth } from "@/contexts/AuthContext";

import {
  getUserCollection,
  getUserDocument,
} from "@/lib/firestore/user-paths";

import type {
  CicloPago,
  ConfiguracionIngreso,
  EstadoIngreso,
  Ingreso,
} from "@/lib/budget/types";

type IngresoGuardable =
  Omit<
    Ingreso,
    "id"
  > & {
    creadoEn?: string;
    actualizadoEn: string;
  };

export interface GuardarDepositoManualInput {
  descripcion: string;

  monto: number;

  fechaRecibida: string;

  fuente:
    Ingreso["fuente"];

  notas: string;
}

function esNumeroValido(
  value: unknown,
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    ) &&
    value >=
      0
  );
}

function esTexto(
  value: unknown,
): value is string {
  return (
    typeof value ===
    "string"
  );
}

function esEstadoIngreso(
  value: unknown,
): value is EstadoIngreso {
  return (
    value ===
      "proyectado" ||
    value ===
      "recibido" ||
    value ===
      "cancelado"
  );
}

function fechaCalendarioValida(
  value: string,
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }

  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  const fecha =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  return (
    fecha
      .getUTCFullYear() ===
      year &&
    fecha
      .getUTCMonth() +
      1 ===
      month &&
    fecha
      .getUTCDate() ===
      day
  );
}

function normalizarIngreso(
  id: string,
  data:
    Record<
      string,
      unknown
    >,
): Ingreso | null {
  if (
    !esTexto(
      data.descripcion,
    ) ||
    !esNumeroValido(
      data.monto,
    ) ||
    !esTexto(
      data.fechaProgramada,
    ) ||
    !esTexto(
      data.periodoCalendario,
    ) ||
    !esNumeroValido(
      data.numeroPagoMes,
    ) ||
    !esNumeroValido(
      data.numeroPagoAnual,
    ) ||
    !esTexto(
      data.fuente,
    ) ||
    !esEstadoIngreso(
      data.estado,
    ) ||
    typeof data.recurrente !==
      "boolean" ||
    !esTexto(
      data.notas,
    )
  ) {
    return null;
  }

  return {
    id,

    configuracionIngresoId:
      esTexto(
        data.configuracionIngresoId,
      )
        ? data.configuracionIngresoId
        : null,

    cicloPagoId:
      esTexto(
        data.cicloPagoId,
      )
        ? data.cicloPagoId
        : id,

    descripcion:
      data.descripcion,

    monto:
      data.monto,

    fechaProgramada:
      data.fechaProgramada,

    fechaRecibida:
      esTexto(
        data.fechaRecibida,
      )
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
      data.fuente as
        Ingreso["fuente"],

    estado:
      data.estado,

    recurrente:
      data.recurrente,

    notas:
      data.notas,
  };
}

function construirIngresoDesdeCiclo(
  ciclo:
    CicloPago,

  configuracion:
    ConfiguracionIngreso,

  monto: number,

  estado:
    EstadoIngreso,

  fechaRecibida:
    string | null,
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

/**
 * Un depósito manual utiliza la misma colección de ingresos,
 * pero:
 *
 * - no pertenece a la configuración salarial;
 * - no es recurrente;
 * - su ID sirve también como cicloPagoId técnico;
 * - siempre nace como recibido.
 *
 * numeroPagoMes y numeroPagoAnual se conservan en 1 únicamente
 * por compatibilidad con el esquema histórico de Ingreso.
 * No se utilizan para calcular depósitos manuales.
 */
function construirDepositoManual(
  id: string,

  input:
    GuardarDepositoManualInput,
): Ingreso {
  return {
    id,

    configuracionIngresoId:
      null,

    cicloPagoId:
      id,

    descripcion:
      input.descripcion
        .trim(),

    monto:
      input.monto,

    fechaProgramada:
      input.fechaRecibida,

    fechaRecibida:
      input.fechaRecibida,

    periodoCalendario:
      input.fechaRecibida
        .slice(
          0,
          7,
        ),

    numeroPagoMes:
      1,

    numeroPagoAnual:
      1,

    fuente:
      input.fuente,

    estado:
      "recibido",

    recurrente:
      false,

    notas:
      input.notas
        .trim(),
  };
}

function prepararParaGuardar(
  ingreso:
    Ingreso,

  nuevo:
    boolean,
): IngresoGuardable {
  const {
    id,
    ...datos
  } =
    ingreso;

  void id;

  const ahora =
    new Date()
      .toISOString();

  return {
    ...datos,

    ...(nuevo
      ? {
          creadoEn:
            ahora,
        }
      : {}),

    actualizadoEn:
      ahora,
  };
}

function validarDepositoManual(
  input:
    GuardarDepositoManualInput,
): string | null {
  const descripcion =
    input.descripcion
      .trim();

  if (
    !descripcion ||
    descripcion.length >
      200
  ) {
    return "Escribe una descripción válida para el depósito.";
  }

  if (
    !Number.isFinite(
      input.monto,
    ) ||
    input.monto <=
      0 ||
    input.monto >
      1_000_000
  ) {
    return "El monto del depósito debe ser mayor que cero.";
  }

  if (
    !fechaCalendarioValida(
      input.fechaRecibida,
    )
  ) {
    return "Selecciona una fecha válida para el depósito.";
  }

  if (
    input.notas.length >
    1000
  ) {
    return "Las notas no pueden superar 1000 caracteres.";
  }

  return null;
}

/**
 * Administra ingresos programados, recibidos y depósitos manuales.
 *
 * Colección:
 *
 * users/{uid}/ingresos/{cicloPagoId}
 *
 * Los ingresos recurrentes utilizan el ID real del ciclo.
 * Los depósitos manuales reciben un ID automático y se guardan con
 * recurrente=false.
 */
export function useIncomeTransactions() {
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
    ingresos,
    setIngresos,
  ] =
    useState<
      Ingreso[]
    >(
      [],
    );

  const [
    cargando,
    setCargando,
  ] =
    useState(
      true,
    );

  const [
    guardando,
    setGuardando,
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
    >(
      null,
    );

  useEffect(
    () => {
      if (
        !uid
      ) {
        return;
      }

      const consulta =
        query(
          getUserCollection(
            uid,
            "ingresos",
          ),

          orderBy(
            "fechaProgramada",
            "desc",
          ),
        );

      return onSnapshot(
        consulta,

        (
          snapshot,
        ) => {
          const siguientesIngresos =
            snapshot.docs
              .map(
                (
                  documento,
                ) =>
                  normalizarIngreso(
                    documento.id,
                    documento.data(),
                  ),
              )
              .filter(
                (
                  ingreso,
                ): ingreso is Ingreso =>
                  ingreso !==
                  null,
              );

          setIngresos(
            siguientesIngresos,
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
            "No se pudieron cargar los ingresos.",
          );

          setCargando(
            false,
          );
        },
      );
    },
    [
      uid,
    ],
  );

  const ingresosPorCiclo =
    useMemo(
      () =>
        new Map(
          ingresos.map(
            (
              ingreso,
            ) => [
              ingreso
                .cicloPagoId,
              ingreso,
            ],
          ),
        ),
      [
        ingresos,
      ],
    );

  const depositosManuales =
    useMemo(
      () =>
        ingresos
          .filter(
            (
              ingreso,
            ) =>
              ingreso
                .recurrente ===
              false,
          )
          .sort(
            (
              a,
              b,
            ) =>
              (
                b.fechaRecibida ??
                b.fechaProgramada
              ).localeCompare(
                a.fechaRecibida ??
                a.fechaProgramada,
              ),
          ),
      [
        ingresos,
      ],
    );

  const guardarIngreso =
    async (
      ingreso:
        Ingreso,
    ): Promise<boolean> => {
      if (
        !uid
      ) {
        setError(
          "No existe un usuario autorizado para guardar el ingreso.",
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
        const existente =
          ingresosPorCiclo.get(
            ingreso
              .cicloPagoId,
          );

        await setDoc(
          getUserDocument(
            uid,
            "ingresos",
            ingreso
              .cicloPagoId,
          ),

          prepararParaGuardar(
            ingreso,
            !existente,
          ),

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
      ciclo:
        CicloPago,

      configuracion:
        ConfiguracionIngreso,

      monto =
        configuracion
          .montoEstimado,
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
      ciclo:
        CicloPago,

      configuracion:
        ConfiguracionIngreso,

      monto: number,

      fechaRecibida =
        ciclo
          .fechaPagoProgramada,
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

  const guardarDepositoManual =
    async (
      input:
        GuardarDepositoManualInput,

      ingresoExistente:
        Ingreso | null =
        null,
    ): Promise<boolean> => {
      if (
        !uid
      ) {
        setError(
          "No existe un usuario autorizado para guardar el depósito.",
        );

        return false;
      }

      const validacion =
        validarDepositoManual(
          input,
        );

      if (
        validacion
      ) {
        setError(
          validacion,
        );

        return false;
      }

      if (
        ingresoExistente &&
        ingresoExistente
          .recurrente
      ) {
        setError(
          "Este ingreso pertenece a un ciclo recurrente y no puede editarse como depósito manual.",
        );

        return false;
      }

      let id =
        ingresoExistente
          ?.id ??
        null;

      if (
        !id
      ) {
        const referencia =
          doc(
            getUserCollection(
              uid,
              "ingresos",
            ),
          );

        id =
          referencia.id;
      }

      return guardarIngreso(
        construirDepositoManual(
          id,
          input,
        ),
      );
    };

  const marcarComoRecibido =
    async (
      cicloPagoId:
        string,

      monto: number,

      fechaRecibida:
        string,
    ): Promise<boolean> => {
      if (
        !uid
      ) {
        setError(
          "No existe un usuario autorizado para actualizar el ingreso.",
        );

        return false;
      }

      if (
        !esNumeroValido(
          monto,
        ) ||
        monto <=
          0
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
          getUserDocument(
            uid,
            "ingresos",
            cicloPagoId,
          ),

          {
            monto,

            fechaRecibida,

            estado:
              "recibido",

            actualizadoEn:
              new Date()
                .toISOString(),
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
      cicloPagoId:
        string,
    ): Promise<boolean> => {
      if (
        !uid
      ) {
        setError(
          "No existe un usuario autorizado para eliminar el ingreso.",
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
        await deleteDoc(
          getUserDocument(
            uid,
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

    depositosManuales,

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

    guardarDepositoManual,

    marcarComoRecibido,

    eliminarIngreso,
  };
}