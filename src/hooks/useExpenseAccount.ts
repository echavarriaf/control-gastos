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
  type CuentaGastos,
  type GuardarCuentaGastosInput,
  validarCuentaGastos,
} from "@/lib/budget/expense-account";

interface RespuestaCuentaGastos {
  ok?: boolean;

  cuenta?:
    CuentaGastos | null;

  error?:
    unknown;
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
      void cargarCuenta();
    },
    [
      cargarCuenta,
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

  return {
    cuenta,

    configurada:
      cuenta !== null,

    cargando,

    guardando,

    error,

    limpiarError:
      () =>
        setError(
          null,
        ),

    recargar:
      cargarCuenta,

    guardarCuenta,
  };
}

export type ExpenseAccountController =
  ReturnType<
    typeof useExpenseAccount
  >;