"use client";

/*
 * Nombre: Resúmenes financieros de tarjetas
 * Ruta: src/hooks/useCreditCardSummaries.ts
 * Autor: Felix Echavarria
 * Fecha: 2026-08-02
 *
 * Descripción:
 * Calcula el saldo actual de cada tarjeta usando su saldo inicial,
 * los gastos registrados con esa tarjeta y los pagos aplicados.
 * También calcula crédito disponible y porcentaje utilizado cuando
 * la tarjeta tiene un límite de crédito configurado.
 */

import {
  useMemo,
} from "react";

import type {
  GastoVariable,
  PagoTarjeta,
  TarjetaCredito,
} from "@/lib/budget/types";

export interface ResumenTarjetaActual {
  tarjeta:
    TarjetaCredito;

  comprasDesdeSaldo:
    number;

  pagosDesdeSaldo:
    number;

  saldoActual:
    number;

  creditoDisponible:
    number | null;

  porcentajeUtilizado:
    number | null;
}

interface UseCreditCardSummariesParams {
  tarjetas:
    TarjetaCredito[];

  gastos:
    GastoVariable[];

  pagos:
    PagoTarjeta[];
}

/**
 * Convierte una fecha ISO o YYYY-MM-DD en una clave de calendario.
 *
 * Toma únicamente los primeros diez caracteres para comparar fechas
 * sin que la zona horaria cambie el día del movimiento.
 */
function obtenerFechaCalendario(
  fecha:
    string,
): string {
  return fecha.slice(
    0,
    10,
  );
}

/**
 * Suma los gastos pertenecientes a una tarjeta desde la fecha inicial.
 *
 * Filtra por tarjetaId y descarta movimientos anteriores al día en que
 * se registró el saldo inicial para evitar contarlos dos veces.
 */
function sumarComprasDesdeSaldo(
  tarjeta:
    TarjetaCredito,

  gastos:
    GastoVariable[],
): number {
  const fechaInicial =
    obtenerFechaCalendario(
      tarjeta
        .fechaSaldoInicial,
    );

  return gastos.reduce(
    (
      total,
      gasto,
    ) => {
      const perteneceATarjeta =
        gasto.tarjetaId ===
        tarjeta.id;

      const fechaValida =
        obtenerFechaCalendario(
          gasto.fecha,
        ) >= fechaInicial;

      return perteneceATarjeta &&
        fechaValida
        ? total +
            gasto.monto
        : total;
    },
    0,
  );
}

/**
 * Suma los pagos aplicados a una tarjeta desde la fecha inicial.
 *
 * Utiliza tarjetaId para mantener cada pago asociado con su tarjeta
 * y excluye pagos anteriores al saldo inicial configurado.
 */
function sumarPagosDesdeSaldo(
  tarjeta:
    TarjetaCredito,

  pagos:
    PagoTarjeta[],
): number {
  const fechaInicial =
    obtenerFechaCalendario(
      tarjeta
        .fechaSaldoInicial,
    );

  return pagos.reduce(
    (
      total,
      pago,
    ) => {
      const perteneceATarjeta =
        pago.tarjetaId ===
        tarjeta.id;

      const fechaValida =
        obtenerFechaCalendario(
          pago.fecha,
        ) >= fechaInicial;

      return perteneceATarjeta &&
        fechaValida
        ? total +
            pago.monto
        : total;
    },
    0,
  );
}

/**
 * Construye el resumen financiero actual de una tarjeta.
 *
 * Parte del saldo inicial, suma las compras y resta los pagos.
 * Cuando existe límite de crédito, calcula cuánto crédito queda y
 * qué porcentaje del límite se encuentra utilizado.
 */
function crearResumenTarjeta(
  tarjeta:
    TarjetaCredito,

  gastos:
    GastoVariable[],

  pagos:
    PagoTarjeta[],
): ResumenTarjetaActual {
  const comprasDesdeSaldo =
    sumarComprasDesdeSaldo(
      tarjeta,
      gastos,
    );

  const pagosDesdeSaldo =
    sumarPagosDesdeSaldo(
      tarjeta,
      pagos,
    );

  const saldoActual =
    tarjeta.saldoInicial +
    comprasDesdeSaldo -
    pagosDesdeSaldo;

  const creditoDisponible =
    tarjeta.limiteCredito ===
    null
      ? null
      : tarjeta
          .limiteCredito -
        saldoActual;

  const porcentajeUtilizado =
    tarjeta.limiteCredito ===
      null ||
    tarjeta.limiteCredito <=
      0
      ? null
      : Math.max(
          0,
          (
            saldoActual /
            tarjeta
              .limiteCredito
          ) *
            100,
        );

  return {
    tarjeta,
    comprasDesdeSaldo,
    pagosDesdeSaldo,
    saldoActual,
    creditoDisponible,
    porcentajeUtilizado,
  };
}

/**
 * Devuelve los resúmenes actuales de todas las tarjetas.
 *
 * useMemo evita recalcular saldos mientras tarjetas, gastos y pagos
 * no hayan cambiado. Ordena primero las tarjetas activas y después
 * alfabéticamente por nombre.
 */
export function useCreditCardSummaries({
  tarjetas,
  gastos,
  pagos,
}: UseCreditCardSummariesParams) {
  const resumenes =
    useMemo(
      () =>
        tarjetas
          .map(
            (tarjeta) =>
              crearResumenTarjeta(
                tarjeta,
                gastos,
                pagos,
              ),
          )
          .sort(
            (
              a,
              b,
            ) => {
              if (
                a.tarjeta
                  .activa !==
                b.tarjeta
                  .activa
              ) {
                return a.tarjeta
                  .activa
                  ? -1
                  : 1;
              }

              return a.tarjeta
                .nombre
                .localeCompare(
                  b.tarjeta
                    .nombre,
                  "es",
                  {
                    sensitivity:
                      "base",
                  },
                );
            },
          ),
      [
        tarjetas,
        gastos,
        pagos,
      ],
    );

  const totalSaldoActual =
    useMemo(
      () =>
        resumenes.reduce(
          (
            total,
            resumen,
          ) =>
            total +
            resumen
              .saldoActual,
          0,
        ),
      [resumenes],
    );

  const totalCompras =
    useMemo(
      () =>
        resumenes.reduce(
          (
            total,
            resumen,
          ) =>
            total +
            resumen
              .comprasDesdeSaldo,
          0,
        ),
      [resumenes],
    );

  const totalPagos =
    useMemo(
      () =>
        resumenes.reduce(
          (
            total,
            resumen,
          ) =>
            total +
            resumen
              .pagosDesdeSaldo,
          0,
        ),
      [resumenes],
    );

  return {
    resumenes,
    totalSaldoActual,
    totalCompras,
    totalPagos,
  };
}

export type CreditCardSummariesController =
  ReturnType<
    typeof useCreditCardSummaries
  >;