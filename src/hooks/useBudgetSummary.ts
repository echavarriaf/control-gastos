"use client";

import { useMemo } from "react";

import {
  CATEGORIA_KEYS,
  COMPROMISOS_FIJOS,
} from "@/lib/budget/constants";
import type {
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
  gastos: GastoVariable[];
  pagos: PagoTarjeta[];
  pagosFijos: PagoFijo[];
  limites: LimitesVariables;
  mesSeleccionado: string;
  quincenaSeleccionada: Quincena;
  periodoActual: string;
}

export function useBudgetSummary({
  gastos,
  pagos,
  pagosFijos,
  limites,
  mesSeleccionado,
  quincenaSeleccionada,
  periodoActual,
}: UseBudgetSummaryArgs) {
  return useMemo(() => {
    const gastosMes = gastos.filter(
      (gasto) => obtenerPeriodoDesdeISO(gasto.fecha) === mesSeleccionado,
    );
    const pagosMes = pagos.filter(
      (pago) => obtenerPeriodoDesdeISO(pago.fecha) === mesSeleccionado,
    );
    const pagosFijosMes = pagosFijos.filter(
      (pago) => obtenerPeriodoDesdeISO(pago.fecha) === mesSeleccionado,
    );

    const gastosQuincena = gastosMes.filter(
      (gasto) =>
        obtenerQuincenaDesdeISO(gasto.fecha) === quincenaSeleccionada,
    );
    const pagosQuincena = pagosMes.filter(
      (pago) => obtenerQuincenaDesdeISO(pago.fecha) === quincenaSeleccionada,
    );
    const pagosFijosQuincena = pagosFijosMes.filter(
      (pago) =>
        obtenerQuincenaDesdeISO(pago.fecha) === quincenaSeleccionada,
    );

    const totalFijo = COMPROMISOS_FIJOS.reduce(
      (total, gasto) => total + gasto.monto,
      0,
    );
    const limiteVariableMensual = CATEGORIA_KEYS.reduce(
      (total, key) => total + limites[key].mensual,
      0,
    );
    const limiteVariableQuincenal = CATEGORIA_KEYS.reduce(
      (total, key) => total + limites[key].quincenal,
      0,
    );
    const totalPlanMensual = totalFijo + limiteVariableMensual;

    const totalGastosMes = gastosMes.reduce(
      (total, gasto) => total + gasto.monto,
      0,
    );
    const totalPagosMes = pagosMes.reduce(
      (total, pago) => total + pago.monto,
      0,
    );
    const saldoVariableMes = Math.max(totalGastosMes - totalPagosMes, 0);
    const disponibleVariableMes = Math.max(
      limiteVariableMensual - saldoVariableMes,
      0,
    );
    const porcentajeVariableMes = porcentaje(
      saldoVariableMes,
      limiteVariableMensual,
    );

    const totalGastosQuincena = gastosQuincena.reduce(
      (total, gasto) => total + gasto.monto,
      0,
    );
    const totalPagosQuincena = pagosQuincena.reduce(
      (total, pago) => total + pago.monto,
      0,
    );
    const saldoVariableQuincena = Math.max(
      totalGastosQuincena - totalPagosQuincena,
      0,
    );
    const disponibleVariableQuincena = Math.max(
      limiteVariableQuincenal - saldoVariableQuincena,
      0,
    );

    const totalPagadoFijoMes = pagosFijosMes.reduce(
      (total, pago) => total + pago.monto,
      0,
    );
    const totalPendienteFijoMes = Math.max(
      totalFijo - totalPagadoFijoMes,
      0,
    );
    const porcentajeFijoPagado = porcentaje(totalPagadoFijoMes, totalFijo);
    const totalPagadoFijoQuincena = pagosFijosQuincena.reduce(
      (total, pago) => total + pago.monto,
      0,
    );

    const resumenCategorias: ResumenCategoria[] = CATEGORIA_KEYS.map((key) => {
      const gastosCategoriaMes = gastosMes
        .filter((gasto) => gasto.categoria === key)
        .reduce((total, gasto) => total + gasto.monto, 0);
      const pagosCategoriaMes = pagosMes
        .filter((pago) => pago.categoria === key)
        .reduce((total, pago) => total + pago.monto, 0);
      const saldoMes = Math.max(gastosCategoriaMes - pagosCategoriaMes, 0);

      const gastosCategoriaQuincena = gastosQuincena
        .filter((gasto) => gasto.categoria === key)
        .reduce((total, gasto) => total + gasto.monto, 0);
      const pagosCategoriaQuincena = pagosQuincena
        .filter((pago) => pago.categoria === key)
        .reduce((total, pago) => total + pago.monto, 0);
      const saldoQuincena = Math.max(
        gastosCategoriaQuincena - pagosCategoriaQuincena,
        0,
      );

      return {
        key,
        saldoMes,
        disponibleMes: Math.max(limites[key].mensual - saldoMes, 0),
        porcentajeMes: porcentaje(saldoMes, limites[key].mensual),
        saldoQuincena,
        disponibleQuincena: Math.max(
          limites[key].quincenal - saldoQuincena,
          0,
        ),
        porcentajeQuincena: porcentaje(
          saldoQuincena,
          limites[key].quincenal,
        ),
      };
    });

    const resumenFijos: ResumenFijo[] = COMPROMISOS_FIJOS.map((compromiso) => {
      const registrosMes = pagosFijosMes.filter(
        (pago) => pago.compromisoId === compromiso.id,
      );
      const registrosQuincena = pagosFijosQuincena.filter(
        (pago) => pago.compromisoId === compromiso.id,
      );
      const pagadoMes = registrosMes.reduce(
        (total, pago) => total + pago.monto,
        0,
      );
      const pagadoQuincena = registrosQuincena.reduce(
        (total, pago) => total + pago.monto,
        0,
      );
      const pendienteMes = Math.max(compromiso.monto - pagadoMes, 0);

      return {
        compromiso,
        registrosMes,
        pagadoMes,
        pagadoQuincena,
        pendienteMes,
        porcentajePagado: porcentaje(pagadoMes, compromiso.monto),
        ultimoPago: registrosMes[0] ?? null,
        estado:
          pagadoMes >= compromiso.monto
            ? "pagado"
            : pagadoMes > 0
              ? "parcial"
              : "pendiente",
      };
    });

    const movimientos: Movimiento[] = [
      ...gastosMes.map((gasto) => ({ ...gasto, tipo: "gasto" as const })),
      ...pagosMes.map((pago) => ({ ...pago, tipo: "pago" as const })),
    ].sort((a, b) => {
      const diferenciaFecha =
        new Date(b.fecha).getTime() -
        new Date(a.fecha).getTime();

      if (diferenciaFecha !== 0) {
        return diferenciaFecha;
      }

      return (
        new Date(b.creadoEn).getTime() -
        new Date(a.creadoEn).getTime()
      );
    });

    const periodos = new Set<string>([periodoActual]);
    [...gastos, ...pagos, ...pagosFijos].forEach((registro) => {
      const periodo = obtenerPeriodoDesdeISO(registro.fecha);
      if (periodo) periodos.add(periodo);
    });

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
      mesesDisponibles: Array.from(periodos).sort((a, b) =>
        b.localeCompare(a),
      ),
    };
  }, [
    gastos,
    pagos,
    pagosFijos,
    limites,
    mesSeleccionado,
    quincenaSeleccionada,
    periodoActual,
  ]);
}