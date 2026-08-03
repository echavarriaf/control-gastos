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

import type {
  ActualizacionTarjetaCredito,
  EstrategiaPagoTarjeta,
  NuevaTarjetaCredito,
  TarjetaCredito,
} from "@/lib/budget/types";

const COLECCION =
  "tarjetasCredito";

const ESTRATEGIAS_VALIDAS =
  new Set<EstrategiaPagoTarjeta>([
    "saldo_completo",
    "pago_objetivo",
    "pago_minimo",
  ]);

/**
 * 1. Normaliza la información recibida desde Firestore.
 *
 * Esto protege la interfaz cuando existe un documento
 * antiguo, incompleto o con un tipo de dato incorrecto.
 */
function normalizarMonto(
  valor: unknown,
  predeterminado = 0,
): number {
  const numero =
    typeof valor === "number"
      ? valor
      : Number(valor);

  return Number.isFinite(numero) &&
    numero >= 0
    ? Math.round(
        numero * 100,
      ) / 100
    : predeterminado;
}

function normalizarMontoOpcional(
  valor: unknown,
): number | null {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero =
    Number(valor);

  return Number.isFinite(numero) &&
    numero > 0
    ? Math.round(
        numero * 100,
      ) / 100
    : null;
}

function normalizarDia(
  valor: unknown,
  predeterminado = 1,
): number {
  const numero =
    Math.trunc(
      Number(valor),
    );

  return Number.isFinite(numero) &&
    numero >= 1 &&
    numero <= 31
    ? numero
    : predeterminado;
}

function normalizarFechaDocumento(
  valor: unknown,
): string | undefined {
  if (
    typeof valor === "string" &&
    valor.trim()
  ) {
    return valor;
  }

  if (
    typeof valor === "object" &&
    valor !== null &&
    "toDate" in valor
  ) {
    const convertir =
      (
        valor as {
          toDate?: () => Date;
        }
      ).toDate;

    if (
      typeof convertir ===
      "function"
    ) {
      const fecha =
        convertir.call(valor);

      if (
        fecha instanceof Date &&
        !Number.isNaN(
          fecha.getTime(),
        )
      ) {
        return fecha.toISOString();
      }
    }
  }

  return undefined;
}

function normalizarEstrategia(
  valor: unknown,
): EstrategiaPagoTarjeta {
  return typeof valor === "string" &&
    ESTRATEGIAS_VALIDAS.has(
      valor as EstrategiaPagoTarjeta,
    )
    ? (
        valor as EstrategiaPagoTarjeta
      )
    : "saldo_completo";
}

function normalizarUltimosCuatro(
  valor: unknown,
): string {
  if (
    typeof valor !== "string"
  ) {
    return "";
  }

  return valor
    .replace(
      /\D/g,
      "",
    )
    .slice(
      -4,
    );
}

function normalizarDocumento(
  id: string,
  data: Record<string, unknown>,
): TarjetaCredito {
  const nombre =
    typeof data.nombre ===
      "string" &&
    data.nombre.trim()
      ? data.nombre.trim()
      : "Tarjeta";

  return {
    id,
    nombre,

    ultimosCuatro:
      normalizarUltimosCuatro(
        data.ultimosCuatro,
      ),

    saldoInicial:
      normalizarMonto(
        data.saldoInicial,
      ),

    fechaSaldoInicial:
      typeof data
        .fechaSaldoInicial ===
        "string" &&
      data.fechaSaldoInicial.trim()
        ? data.fechaSaldoInicial
        : new Date()
            .toISOString()
            .slice(
              0,
              10,
            ),

    diaCorte:
      normalizarDia(
        data.diaCorte,
      ),

    diaPago:
      normalizarDia(
        data.diaPago,
      ),

    activa:
      typeof data.activa ===
      "boolean"
        ? data.activa
        : true,

    estrategiaPago:
      normalizarEstrategia(
        data.estrategiaPago,
      ),

    pagoObjetivo:
      normalizarMontoOpcional(
        data.pagoObjetivo,
      ),

    limiteCredito:
      normalizarMontoOpcional(
        data.limiteCredito,
      ),

    notas:
      typeof data.notas ===
      "string"
        ? data.notas
        : "",

    creadoEn:
      normalizarFechaDocumento(
        data.creadoEn,
      ),

    actualizadoEn:
      normalizarFechaDocumento(
        data.actualizadoEn,
      ),
  };
}

/**
 * 2. Valida y limpia cada tarjeta antes de escribirla.
 *
 * Las reglas se ejecutan también en el cliente para
 * mostrar errores claros antes de contactar Firestore.
 */
function validarTarjeta(
  tarjeta: NuevaTarjetaCredito,
): NuevaTarjetaCredito {
  const nombre =
    tarjeta.nombre.trim();

  if (!nombre) {
    throw new Error(
      "Escribe el nombre de la tarjeta.",
    );
  }

  const ultimosCuatro =
    normalizarUltimosCuatro(
      tarjeta.ultimosCuatro,
    );

  if (
    tarjeta.ultimosCuatro.trim() &&
    ultimosCuatro.length !== 4
  ) {
    throw new Error(
      "Los últimos cuatro deben contener exactamente cuatro dígitos.",
    );
  }

  if (
    !Number.isFinite(
      tarjeta.saldoInicial,
    ) ||
    tarjeta.saldoInicial < 0
  ) {
    throw new Error(
      "El saldo inicial no puede ser negativo.",
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      tarjeta.fechaSaldoInicial,
    )
  ) {
    throw new Error(
      "Selecciona una fecha válida para el saldo inicial.",
    );
  }

  const diaCorte =
    Math.trunc(
      tarjeta.diaCorte,
    );

  const diaPago =
    Math.trunc(
      tarjeta.diaPago,
    );

  if (
    diaCorte < 1 ||
    diaCorte > 31
  ) {
    throw new Error(
      "El día de corte debe estar entre 1 y 31.",
    );
  }

  if (
    diaPago < 1 ||
    diaPago > 31
  ) {
    throw new Error(
      "El día de pago debe estar entre 1 y 31.",
    );
  }

  if (
    !ESTRATEGIAS_VALIDAS.has(
      tarjeta.estrategiaPago,
    )
  ) {
    throw new Error(
      "Selecciona una estrategia de pago válida.",
    );
  }

  const pagoObjetivo =
    normalizarMontoOpcional(
      tarjeta.pagoObjetivo,
    );

  if (
    tarjeta.estrategiaPago ===
      "pago_objetivo" &&
    pagoObjetivo === null
  ) {
    throw new Error(
      "Escribe el monto del pago objetivo.",
    );
  }

  const limiteCredito =
    normalizarMontoOpcional(
      tarjeta.limiteCredito,
    );

  return {
    nombre,

    ultimosCuatro,

    saldoInicial:
      Math.round(
        tarjeta.saldoInicial *
          100,
      ) / 100,

    fechaSaldoInicial:
      tarjeta.fechaSaldoInicial,

    diaCorte,
    diaPago,

    activa:
      tarjeta.activa,

    estrategiaPago:
      tarjeta.estrategiaPago,

    pagoObjetivo:
      tarjeta.estrategiaPago ===
      "pago_objetivo"
        ? pagoObjetivo
        : null,

    limiteCredito,

    notas:
      tarjeta.notas.trim(),
  };
}

function ordenarTarjetas(
  a: TarjetaCredito,
  b: TarjetaCredito,
): number {
  if (
    a.activa !== b.activa
  ) {
    return a.activa
      ? -1
      : 1;
  }

  return a.nombre.localeCompare(
    b.nombre,
    "es",
  );
}

/**
 * 3. Expone lectura en tiempo real y operaciones CRUD.
 *
 * Walmart, Costco y cualquier tarjeta adicional se
 * administrarán desde esta única fuente de datos.
 */
export function useCreditCards() {
  const [
    tarjetas,
    setTarjetas,
  ] =
    useState<TarjetaCredito[]>(
      [],
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
        const registros =
          snapshot.docs
            .map(
              (documento) =>
                normalizarDocumento(
                  documento.id,
                  documento.data(),
                ),
            )
            .sort(
              ordenarTarjetas,
            );

        setTarjetas(
          registros,
        );

        setCargando(false);
      },

      (snapshotError) => {
        console.error(
          snapshotError,
        );

        setError(
          "No se pudieron cargar las tarjetas.",
        );

        setCargando(false);
      },
    );
  }, []);

  const tarjetasActivas =
    useMemo(
      () =>
        tarjetas.filter(
          (tarjeta) =>
            tarjeta.activa,
        ),
      [tarjetas],
    );

  const crearTarjeta =
    useCallback(
      async (
        datos:
          NuevaTarjetaCredito,
      ): Promise<boolean> => {
        setGuardando(true);
        setError(null);

        try {
          const tarjeta =
            validarTarjeta(
              datos,
            );

          await addDoc(
            collection(
              db,
              COLECCION,
            ),
            {
              ...tarjeta,

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
              : "No se pudo crear la tarjeta.",
          );

          return false;
        } finally {
          setGuardando(false);
        }
      },
      [],
    );

  const actualizarTarjeta =
    useCallback(
      async (
        tarjetaId: string,

        cambios:
          ActualizacionTarjetaCredito,
      ): Promise<boolean> => {
        const actual =
          tarjetas.find(
            (tarjeta) =>
              tarjeta.id ===
              tarjetaId,
          );

        if (!actual) {
          setError(
            "No se encontró la tarjeta.",
          );

          return false;
        }

        setActualizandoId(
          tarjetaId,
        );

        setError(null);

        try {
          const tarjeta =
            validarTarjeta({
              nombre:
                cambios.nombre ??
                actual.nombre,

              ultimosCuatro:
                cambios
                  .ultimosCuatro ??
                actual
                  .ultimosCuatro,

              saldoInicial:
                cambios
                  .saldoInicial ??
                actual
                  .saldoInicial,

              fechaSaldoInicial:
                cambios
                  .fechaSaldoInicial ??
                actual
                  .fechaSaldoInicial,

              diaCorte:
                cambios.diaCorte ??
                actual.diaCorte,

              diaPago:
                cambios.diaPago ??
                actual.diaPago,

              activa:
                cambios.activa ??
                actual.activa,

              estrategiaPago:
                cambios
                  .estrategiaPago ??
                actual
                  .estrategiaPago,

              pagoObjetivo:
                cambios.pagoObjetivo !==
                undefined
                  ? cambios.pagoObjetivo
                  : actual.pagoObjetivo,

              limiteCredito:
                cambios
                  .limiteCredito !==
                undefined
                  ? cambios
                      .limiteCredito
                  : actual
                      .limiteCredito,

              notas:
                cambios.notas ??
                actual.notas,
            });

          await setDoc(
            doc(
              db,
              COLECCION,
              tarjetaId,
            ),
            {
              ...tarjeta,

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
              : "No se pudo actualizar la tarjeta.",
          );

          return false;
        } finally {
          setActualizandoId(
            null,
          );
        }
      },
      [
        tarjetas,
      ],
    );

  const cambiarEstado =
    useCallback(
      async (
        tarjetaId: string,
        activa: boolean,
      ): Promise<boolean> =>
        actualizarTarjeta(
          tarjetaId,
          {
            activa,
          },
        ),
      [
        actualizarTarjeta,
      ],
    );

  return {
    tarjetas,
    tarjetasActivas,
    cargando,
    guardando,
    actualizandoId,
    error,

    limpiarError: () =>
      setError(null),

    crearTarjeta,
    actualizarTarjeta,
    cambiarEstado,
  };
}

export type CreditCardsController =
  ReturnType<
    typeof useCreditCards
  >;