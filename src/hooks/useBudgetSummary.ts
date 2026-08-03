"use client";

/*
 * Nombre: Resumen del presupuesto
 * Ruta: src/hooks/useBudgetSummary.ts
 * Autor: Felix Echavarria
 * Fecha: 2026-08-02
 *
 * Descripción:
 * Calcula los totales mensuales y quincenales del presupuesto,
 * los resúmenes por categoría, los pagos de gastos fijos y el
 * historial combinado de movimientos.
 *
 * Los pagos de tarjetas se conservan en el historial, pero no
 * reducen nuevamente el gasto de Comida o Gas. Una compra consume
 * el presupuesto de su categoría y el pago solamente reduce la
 * deuda de la tarjeta.
 */

import {
  useMemo,
} from "react";

import {
  CATEGORIA_KEYS,
} from "@/lib/budget/constants";

import type {
  CompromisoFijo,
  GastoVariable,
  LimitesVariables,
  Movimiento,
  PagoFijo,
  PagoTarjeta,
  Quincena,
  ResumenCategoria,
  ResumenFijo,
} from "@/lib/budget/types";

import {
  obtenerPeriodoDesdeISO,
  obtenerQuincenaDesdeISO,
  porcentaje,
} from "@/lib/budget/utils";

interface UseBudgetSummaryArgs {
  gastos:
    GastoVariable[];

  pagos:
    PagoTarjeta[];

  pagosFijos:
    PagoFijo[];

  compromisosFijos:
    CompromisoFijo[];

  limites:
    LimitesVariables;

  mesSeleccionado:
    string;

  quincenaSeleccionada:
    Quincena;

  periodoActual:
    string;
}

/**
 * Calcula todos los resúmenes financieros visibles en el dashboard.
 *
 * Filtra los registros por mes y quincena, suma los gastos variables,
 * calcula el estado de los compromisos fijos y combina compras y pagos
 * en un historial ordenado. Los pagos de tarjetas no se restan del
 * consumo de las categorías porque su función es reducir la deuda de
 * la tarjeta, no restaurar el presupuesto ya gastado.
 */
export function useBudgetSummary({
  gastos,
  pagos,
  pagosFijos,
  compromisosFijos,
  limites,
  mesSeleccionado,
  quincenaSeleccionada,
  periodoActual,
}: UseBudgetSummaryArgs) {
  return useMemo(
    () => {
      const gastosMes =
        gastos.filter(
          (gasto) =>
            obtenerPeriodoDesdeISO(
              gasto.fecha,
            ) ===
            mesSeleccionado,
        );

      const pagosMes =
        pagos.filter(
          (pago) =>
            obtenerPeriodoDesdeISO(
              pago.fecha,
            ) ===
            mesSeleccionado,
        );

      const pagosFijosMes =
        pagosFijos.filter(
          (pago) =>
            obtenerPeriodoDesdeISO(
              pago.fecha,
            ) ===
            mesSeleccionado,
        );

      const idsCompromisosActivos =
        new Set(
          compromisosFijos.map(
            (compromiso) =>
              compromiso.id,
          ),
        );

      const pagosFijosActivosMes =
        pagosFijosMes.filter(
          (pago) =>
            idsCompromisosActivos.has(
              pago.compromisoId,
            ),
        );

      const gastosQuincena =
        gastosMes.filter(
          (gasto) =>
            obtenerQuincenaDesdeISO(
              gasto.fecha,
            ) ===
            quincenaSeleccionada,
        );

      const pagosFijosQuincena =
        pagosFijosActivosMes.filter(
          (pago) =>
            obtenerQuincenaDesdeISO(
              pago.fecha,
            ) ===
            quincenaSeleccionada,
        );

      const totalFijo =
        compromisosFijos.reduce(
          (
            total,
            compromiso,
          ) =>
            total +
            compromiso.monto,
          0,
        );

      const limiteVariableMensual =
        CATEGORIA_KEYS.reduce(
          (
            total,
            key,
          ) =>
            total +
            limites[key]
              .mensual,
          0,
        );

      const limiteVariableQuincenal =
        CATEGORIA_KEYS.reduce(
          (
            total,
            key,
          ) =>
            total +
            limites[key]
              .quincenal,
          0,
        );

      const totalPlanMensual =
        totalFijo +
        limiteVariableMensual;

      /*
       * El consumo variable utiliza solamente las compras.
       * Pagar una tarjeta no devuelve dinero al presupuesto
       * de la categoría donde se realizó la compra.
       */
      const saldoVariableMes =
        gastosMes.reduce(
          (
            total,
            gasto,
          ) =>
            total +
            gasto.monto,
          0,
        );

      const disponibleVariableMes =
        Math.max(
          limiteVariableMensual -
            saldoVariableMes,
          0,
        );

      const porcentajeVariableMes =
        porcentaje(
          saldoVariableMes,
          limiteVariableMensual,
        );

      const saldoVariableQuincena =
        gastosQuincena.reduce(
          (
            total,
            gasto,
          ) =>
            total +
            gasto.monto,
          0,
        );

      const disponibleVariableQuincena =
        Math.max(
          limiteVariableQuincenal -
            saldoVariableQuincena,
          0,
        );

      const totalPagadoFijoMes =
        pagosFijosActivosMes.reduce(
          (
            total,
            pago,
          ) =>
            total +
            pago.monto,
          0,
        );

      const totalPendienteFijoMes =
        Math.max(
          totalFijo -
            totalPagadoFijoMes,
          0,
        );

      const porcentajeFijoPagado =
        porcentaje(
          totalPagadoFijoMes,
          totalFijo,
        );

      const totalPagadoFijoQuincena =
        pagosFijosQuincena.reduce(
          (
            total,
            pago,
          ) =>
            total +
            pago.monto,
          0,
        );

      /*
       * Cada categoría se calcula usando únicamente sus compras.
       * Los pagos de tarjetas permanecen separados para evitar
       * que Comida o Gas recuperen presupuesto al pagar la deuda.
       */
      const resumenCategorias:
        ResumenCategoria[] =
        CATEGORIA_KEYS.map(
          (key) => {
            const saldoMes =
              gastosMes
                .filter(
                  (gasto) =>
                    gasto.categoria ===
                    key,
                )
                .reduce(
                  (
                    total,
                    gasto,
                  ) =>
                    total +
                    gasto.monto,
                  0,
                );

            const saldoQuincena =
              gastosQuincena
                .filter(
                  (gasto) =>
                    gasto.categoria ===
                    key,
                )
                .reduce(
                  (
                    total,
                    gasto,
                  ) =>
                    total +
                    gasto.monto,
                  0,
                );

            return {
              key,

              saldoMes,

              disponibleMes:
                Math.max(
                  limites[key]
                    .mensual -
                    saldoMes,
                  0,
                ),

              porcentajeMes:
                porcentaje(
                  saldoMes,
                  limites[key]
                    .mensual,
                ),

              saldoQuincena,

              disponibleQuincena:
                Math.max(
                  limites[key]
                    .quincenal -
                    saldoQuincena,
                  0,
                ),

              porcentajeQuincena:
                porcentaje(
                  saldoQuincena,
                  limites[key]
                    .quincenal,
                ),
            };
          },
        );

      const resumenFijos:
        ResumenFijo[] =
        compromisosFijos.map(
          (compromiso) => {
            const registrosMes =
              pagosFijosActivosMes.filter(
                (pago) =>
                  pago.compromisoId ===
                  compromiso.id,
              );

            const registrosQuincena =
              pagosFijosQuincena.filter(
                (pago) =>
                  pago.compromisoId ===
                  compromiso.id,
              );

            const pagadoMes =
              registrosMes.reduce(
                (
                  total,
                  pago,
                ) =>
                  total +
                  pago.monto,
                0,
              );

            const pagadoQuincena =
              registrosQuincena.reduce(
                (
                  total,
                  pago,
                ) =>
                  total +
                  pago.monto,
                0,
              );

            const pendienteMes =
              Math.max(
                compromiso.monto -
                  pagadoMes,
                0,
              );

            return {
              compromiso,
              registrosMes,
              pagadoMes,
              pagadoQuincena,
              pendienteMes,

              porcentajePagado:
                porcentaje(
                  pagadoMes,
                  compromiso.monto,
                ),

              ultimoPago:
                registrosMes[0] ??
                null,

              estado:
                pagadoMes >=
                compromiso.monto
                  ? "pagado"
                  : pagadoMes >
                      0
                    ? "parcial"
                    : "pendiente",
            };
          },
        );

      /*
       * El historial sí contiene compras y pagos de tarjetas.
       * Ambos tipos se ordenan por fecha y, cuando coinciden,
       * por la fecha exacta en que fueron creados.
       */
      const movimientos:
        Movimiento[] = [
          ...gastosMes.map(
            (gasto) => ({
              ...gasto,
              tipo:
                "gasto" as const,
            }),
          ),

          ...pagosMes.map(
            (pago) => ({
              ...pago,
              tipo:
                "pago" as const,
            }),
          ),
        ].sort(
          (
            a,
            b,
          ) => {
            const diferenciaFecha =
              new Date(
                b.fecha,
              ).getTime() -
              new Date(
                a.fecha,
              ).getTime();

            if (
              diferenciaFecha !==
              0
            ) {
              return diferenciaFecha;
            }

            return (
              new Date(
                b.creadoEn,
              ).getTime() -
              new Date(
                a.creadoEn,
              ).getTime()
            );
          },
        );

      const periodos =
        new Set<string>([
          periodoActual,
        ]);

      [
        ...gastos,
        ...pagos,
        ...pagosFijos,
      ].forEach(
        (registro) => {
          const periodo =
            obtenerPeriodoDesdeISO(
              registro.fecha,
            );

          if (periodo) {
            periodos.add(
              periodo,
            );
          }
        },
      );

      return {
        totalFijo,
        limiteVariableMensual,
        limiteVariableQuincenal,
        totalPlanMensual,
        saldoVariableMes,
        disponibleVariableMes,
        porcentajeVariableMes,
        saldoVariableQuincena,
        disponibleVariableQuincena,
        totalPagadoFijoMes,
        totalPendienteFijoMes,
        porcentajeFijoPagado,
        totalPagadoFijoQuincena,
        resumenCategorias,
        resumenFijos,
        movimientos,

        mesesDisponibles:
          Array.from(
            periodos,
          ).sort(
            (
              a,
              b,
            ) =>
              b.localeCompare(
                a,
              ),
          ),
      };
    },
    [
      gastos,
      pagos,
      pagosFijos,
      compromisosFijos,
      limites,
      mesSeleccionado,
      quincenaSeleccionada,
      periodoActual,
    ],
  );
}