"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "@/contexts/AuthContext";

import {
  auth,
} from "@/lib/firebase";

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

import {
  getUserCollection,
  getUserDocument,
} from "@/lib/firestore/user-paths";

import {
  type CuentaGastos,
  type GuardarCuentaGastosInput,
  type GuardarMovimientoManualCuentaInput,
  type MovimientoManualCuenta,
  normalizarMovimientoManualCuenta,
  validarMovimientoManualCuenta,
  validarCuentaGastos,
} from "@/lib/budget/expense-account";

interface RespuestaCuentaGastos {
  ok?: boolean;

  cuenta?:
  CuentaGastos | null;

  error?:
  unknown;
}

function fechaFirestoreAISO(
  value: unknown,
): string | undefined {
  if (
    value instanceof
    Timestamp
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (
    typeof value ===
    "string" &&
    value.trim()
  ) {
    return value;
  }

  return undefined;
}

async function obtenerToken():
  Promise<string> {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "No existe una sesión autenticada.",
    );
  }

  return currentUser
    .getIdToken();
}

async function leerRespuesta(
  response: Response,
): Promise<RespuestaCuentaGastos> {
  return (
    await response
      .json()
      .catch(
        () => null,
      )
  ) as
    | RespuestaCuentaGastos
    | null ??
    {};
}

function obtenerMensajeError(
  payload:
    RespuestaCuentaGastos,

  fallback:
    string,
): string {
  return typeof payload.error ===
    "string"
    ? payload.error
    : fallback;
}

/**
 * Administra la configuración de la cuenta bancaria operativa.
 *
 * Por ahora solo controla la fotografía inicial:
 *
 * - nombre;
 * - saldo inicial;
 * - fecha del saldo inicial.
 *
 * En las siguientes etapas se conectarán ingresos y egresos.
 */
export function useExpenseAccount() {
  const {
    user,
    authorized,
  } =
    useAuth();

  const uid =
    authorized
      ? user?.uid ?? null
      : null;

  const [
    cuenta,
    setCuenta,
  ] =
    useState<CuentaGastos | null>(
      null,
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
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    movimientosManuales,
    setMovimientosManuales,
  ] =
    useState<
      MovimientoManualCuenta[]
    >([]);

  const [
    cargandoMovimientosManuales,
    setCargandoMovimientosManuales,
  ] =
    useState(true);

  const [
    guardandoMovimientoManual,
    setGuardandoMovimientoManual,
  ] =
    useState(false);

  const [
    actualizandoMovimientoManualId,
    setActualizandoMovimientoManualId,
  ] =
    useState<
      string | null
    >(null);

  const [
    eliminandoMovimientoManualId,
    setEliminandoMovimientoManualId,
  ] =
    useState<
      string | null
    >(null);

  const cargarCuenta =
    useCallback(
      async (): Promise<void> => {
        if (!uid) {
          setCuenta(
            null,
          );

          setCargando(
            false,
          );

          setError(
            null,
          );

          return;
        }

        setCargando(
          true,
        );

        setError(
          null,
        );

        try {
          const token =
            await obtenerToken();

          const response =
            await fetch(
              "/api/account/expense",
              {
                method:
                  "GET",

                credentials:
                  "same-origin",

                cache:
                  "no-store",

                headers: {
                  Accept:
                    "application/json",

                  Authorization:
                    `Bearer ${token}`,
                },
              },
            );

          const payload =
            await leerRespuesta(
              response,
            );

          if (!response.ok) {
            throw new Error(
              obtenerMensajeError(
                payload,
                "No se pudo cargar la Cuenta de gastos.",
              ),
            );
          }

          if (
            payload.ok !==
            true
          ) {
            throw new Error(
              "El servidor no confirmó la carga de la cuenta.",
            );
          }

          setCuenta(
            payload.cuenta ??
            null,
          );
        } catch (
        cargarError
        ) {
          console.error(
            cargarError,
          );

          setCuenta(
            null,
          );

          setError(
            cargarError instanceof
              Error
              ? cargarError.message
              : "No se pudo cargar la Cuenta de gastos.",
          );
        } finally {
          setCargando(
            false,
          );
        }
      },
      [
        uid,
      ],
    );

  useEffect(
    () => {
      // La cuenta se obtiene de la API al montar o cambiar el usuario.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void cargarCuenta();
    },
    [
      cargarCuenta,
    ],
  );

  useEffect(
    () => {
      if (!uid) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Elimina los movimientos privados cuando ya no existe una sesión autorizada.
        setMovimientosManuales(
          [],
        );

        setCargandoMovimientosManuales(
          false,
        );

        return;
      }

      setCargandoMovimientosManuales(
        true,
      );

      const consulta =
        query(
          getUserCollection(
            uid,
            "movimientosCuenta",
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
          const siguientes =
            snapshot.docs
              .map(
                (
                  documento,
                ) => {
                  const data =
                    documento.data();

                  return normalizarMovimientoManualCuenta(
                    documento.id,

                    {
                      ...data,

                      creadoEn:
                        fechaFirestoreAISO(
                          data.creadoEn,
                        ),

                      actualizadoEn:
                        fechaFirestoreAISO(
                          data.actualizadoEn,
                        ),
                    },
                  );
                },
              )
              .filter(
                (
                  movimiento,
                ): movimiento is MovimientoManualCuenta =>
                  movimiento !==
                  null,
              );

          setMovimientosManuales(
            siguientes,
          );

          setCargandoMovimientosManuales(
            false,
          );
        },

        (
          snapshotError,
        ) => {
          console.error(
            snapshotError,
          );

          setMovimientosManuales(
            [],
          );

          setError(
            "No se pudieron cargar los movimientos de la Cuenta de gastos.",
          );

          setCargandoMovimientosManuales(
            false,
          );
        },
      );
    },
    [
      uid,
    ],
  );

  const guardarCuenta =
    useCallback(
      async (
        input:
          GuardarCuentaGastosInput,
      ): Promise<boolean> => {
        if (!uid) {
          setError(
            "No existe un usuario autorizado para guardar la cuenta.",
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
          const datos =
            validarCuentaGastos(
              input,
            );

          const token =
            await obtenerToken();

          const response =
            await fetch(
              "/api/account/expense",
              {
                method:
                  "PUT",

                credentials:
                  "same-origin",

                cache:
                  "no-store",

                headers: {
                  Accept:
                    "application/json",

                  "Content-Type":
                    "application/json",

                  Authorization:
                    `Bearer ${token}`,
                },

                body:
                  JSON.stringify(
                    datos,
                  ),
              },
            );

          const payload =
            await leerRespuesta(
              response,
            );

          if (!response.ok) {
            throw new Error(
              obtenerMensajeError(
                payload,
                "No se pudo guardar la Cuenta de gastos.",
              ),
            );
          }

          if (
            payload.ok !==
            true ||
            !payload.cuenta
          ) {
            throw new Error(
              "El servidor no confirmó el guardado de la cuenta.",
            );
          }

          setCuenta(
            payload.cuenta,
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
              : "No se pudo guardar la Cuenta de gastos.",
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

  const crearMovimientoManual =
    useCallback(
      async (
        datos:
          GuardarMovimientoManualCuentaInput,
      ): Promise<boolean> => {
        if (!uid) {
          setError(
            "No existe un usuario autorizado para crear el movimiento.",
          );

          return false;
        }

        setGuardandoMovimientoManual(
          true,
        );

        setError(
          null,
        );

        try {
          const movimiento =
            validarMovimientoManualCuenta(
              datos,
            );

          await addDoc(
            getUserCollection(
              uid,
              "movimientosCuenta",
            ),

            {
              ...movimiento,

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
              : "No se pudo crear el movimiento de la Cuenta de gastos.",
          );

          return false;
        } finally {
          setGuardandoMovimientoManual(
            false,
          );
        }
      },
      [
        uid,
      ],
    );

  const actualizarMovimientoManual =
    useCallback(
      async (
        movimientoId:
          string,

        cambios:
          Partial<
            GuardarMovimientoManualCuentaInput
          >,
      ): Promise<boolean> => {
        if (!uid) {
          setError(
            "No existe un usuario autorizado para actualizar el movimiento.",
          );

          return false;
        }

        const actual =
          movimientosManuales.find(
            (
              movimiento,
            ) =>
              movimiento.id ===
              movimientoId,
          );

        if (!actual) {
          setError(
            "No se encontró el movimiento de la Cuenta de gastos.",
          );

          return false;
        }

        setActualizandoMovimientoManualId(
          movimientoId,
        );

        setError(
          null,
        );

        try {
          const movimiento =
            validarMovimientoManualCuenta(
              {
                direccion:
                  cambios.direccion ??
                  actual.direccion,

                concepto:
                  cambios.concepto ??
                  actual.concepto,

                monto:
                  cambios.monto ??
                  actual.monto,

                fecha:
                  cambios.fecha ??
                  actual.fecha,

                notas:
                  cambios.notas ??
                  actual.notas,
              },
            );

          await setDoc(
            getUserDocument(
              uid,
              "movimientosCuenta",
              movimientoId,
            ),

            {
              ...movimiento,

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
              : "No se pudo actualizar el movimiento de la Cuenta de gastos.",
          );

          return false;
        } finally {
          setActualizandoMovimientoManualId(
            null,
          );
        }
      },
      [
        movimientosManuales,
        uid,
      ],
    );

  const eliminarMovimientoManual =
    useCallback(
      async (
        movimientoId:
          string,
      ): Promise<boolean> => {
        if (!uid) {
          setError(
            "No existe un usuario autorizado para eliminar el movimiento.",
          );

          return false;
        }

        if (
          !movimientosManuales.some(
            (
              movimiento,
            ) =>
              movimiento.id ===
              movimientoId,
          )
        ) {
          setError(
            "No se encontró el movimiento de la Cuenta de gastos.",
          );

          return false;
        }

        setEliminandoMovimientoManualId(
          movimientoId,
        );

        setError(
          null,
        );

        try {
          await deleteDoc(
            getUserDocument(
              uid,
              "movimientosCuenta",
              movimientoId,
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
            "No se pudo eliminar el movimiento de la Cuenta de gastos.",
          );

          return false;
        } finally {
          setEliminandoMovimientoManualId(
            null,
          );
        }
      },
      [
        movimientosManuales,
        uid,
      ],
    );

  return {
  cuenta,

  configurada:
    cuenta !== null,

  cargando,

  guardando,

  error,

  movimientosManuales,

  cargandoMovimientosManuales,

  guardandoMovimientoManual,

  actualizandoMovimientoManualId,

  eliminandoMovimientoManualId,

  limpiarError:
    () =>
      setError(
        null,
      ),

  recargar:
    cargarCuenta,

  guardarCuenta,

  crearMovimientoManual,

  actualizarMovimientoManual,

  eliminarMovimientoManual,
};
}

export type ExpenseAccountController =
  ReturnType<
    typeof useExpenseAccount
  >;
