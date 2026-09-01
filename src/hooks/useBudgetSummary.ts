"use client";

/*
 * Nombre: Resumen del presupuesto
 * Ruta: src/hooks/useBudgetSummary.ts
 * Autor: Felix Echavarria
 * Fecha: 2026-08-18
 *
 * Descripción:
 * Calcula los totales mensuales y quincenales del presupuesto,
 * los resúmenes por categoría, los pagos de gastos fijos y el
 * historial combinado de movimientos.
 *
 * Los pagos de tarjetas se conservan en el historial, pero no
 * reducen nuevamente el gasto de Comida o Gas. Una compra consume
 * el presupuesto únicamente cuando tiene categoría presupuestaria;
 * categorías como "Otro" quedan fuera de esos límites y del carry-over.
 * El pago de tarjeta solamente reduce la deuda de la tarjeta.
 *
 * El presupuesto quincenal aplica carry-over continuo por categoría:
 * cualquier exceso de una quincena reduce el disponible de la
 * siguiente hasta que el arrastre sea absorbido. El sobrante positivo
 * no se acumula como crédito.
 */

import {
  useMemo,
} from "react";

import {
  CATEGORIA_KEYS,
} from "@/lib/budget/constants";

import {
  calcularCarryOverQuincenal,
  type MovimientoCarryOver,
  type ResumenCategoriaConCarryOver,
} from "@/lib/budget/carry-over";

import type {
  CompromisoFijo,
  GastoVariable,
  LimitesVariables,
  Movimiento,
  PagoFijo,
  PagoTarjeta,
  Quincena,
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
 * Para el carry-over usa todo el historial de gastos disponible en
 * memoria. De esta forma Q2 puede recibir exceso de Q1 y Q1 del mes
 * siguiente puede recibir exceso de Q2 del mes anterior.
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
      const gastosPresupuestadosMes =
        gastosMes.filter(
          (gasto) =>
            gasto.categoria !==
            null,
        );

      const saldoVariableMes =
        gastosPresupuestadosMes.reduce(
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

      /*
       * Construye el historial mínimo que necesita el motor de carry.
       * Los registros con fecha inválida se ignoran sin romper el resumen.
       */
      const movimientosCarryOver:
        MovimientoCarryOver[] =
        gastos.flatMap(
          (gasto) => {
            const periodo =
              obtenerPeriodoDesdeISO(
                gasto.fecha,
              );

            const quincena =
              obtenerQuincenaDesdeISO(
                gasto.fecha,
              );

            if (
              !periodo ||
              !quincena ||
              gasto.categoria ===
                null
            ) {
              return [];
            }

            return [
              {
                categoria:
                  gasto.categoria,
                monto:
                  gasto.monto,
                periodo,
                quincena,
              },
            ];
          },
        );

      const carryOver =
        calcularCarryOverQuincenal({
          movimientos:
            movimientosCarryOver,
          limites,
          periodoObjetivo:
            mesSeleccionado,
          quincenaObjetivo:
            quincenaSeleccionada,
        });

      const saldoVariableQuincena =
        CATEGORIA_KEYS.reduce(
          (
            total,
            key,
          ) =>
            total +
            carryOver[key]
              .saldoQuincena,
          0,
        );

      const excedenteVariableAnterior =
        CATEGORIA_KEYS.reduce(
          (
            total,
            key,
          ) =>
            total +
            carryOver[key]
              .excedenteAnterior,
          0,
        );

      const limiteVariableQuincenalEfectivo =
        CATEGORIA_KEYS.reduce(
          (
            total,
            key,
          ) =>
            total +
            carryOver[key]
              .limiteQuincenalEfectivo,
          0,
        );

      const disponibleVariableQuincena =
        CATEGORIA_KEYS.reduce(
          (
            total,
            key,
          ) =>
            total +
            carryOver[key]
              .disponibleQuincena,
          0,
        );

      const excedenteVariableSiguiente =
        CATEGORIA_KEYS.reduce(
          (
            total,
            key,
          ) =>
            total +
            carryOver[key]
              .excedenteSiguiente,
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

      const resumenCategorias:
        ResumenCategoriaConCarryOver[] =
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

            const detalleCarry =
              carryOver[key];

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

              ...detalleCarry,
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
        excedenteVariableAnterior,
        limiteVariableQuincenalEfectivo,
        disponibleVariableQuincena,
        excedenteVariableSiguiente,

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