"use client";

import {
  useCallback,
  useState,
} from "react";

import { useBudgetData } from "@/hooks/useBudgetData";
import { useBudgetPeriod } from "@/hooks/useBudgetPeriod";
import { useBudgetSummary } from "@/hooks/useBudgetSummary";
import { useBudgetVisualAlerts } from "@/hooks/useBudgetVisualAlerts";
import { useIncomeData } from "@/hooks/useIncomeData";
import { useIncomeTransactions } from "@/hooks/useIncomeTransactions";
import { usePushNotifications } from "@/hooks/usePushNotifications";

import type {
  CicloPago,
  CompromisoFijo,
  Ingreso,
  Vista,
} from "@/lib/budget/types";

export function useBudgetDashboard() {
  const budget =
    useBudgetData();

  const income =
    useIncomeData();

  /**
   * El periodo visible ahora depende del ciclo de ingreso
   * que financia los pagos, no solamente del calendario.
   */
  const period =
    useBudgetPeriod({
      periodoPresupuestarioActual:
        income
          .periodoPresupuestarioActual,

      quincenaPresupuestariaActual:
        income
          .quincenaPresupuestariaActual,

      cargando:
        income.cargando,
    });

  const incomeTransactions =
    useIncomeTransactions();

  const push =
    usePushNotifications();

  const [
    view,
    setView,
  ] =
    useState<Vista>(
      "fijos",
    );

  const [
    budgetSettingsOpen,
    setBudgetSettingsOpen,
  ] =
    useState(false);

  const [
    incomeSettingsOpen,
    setIncomeSettingsOpen,
  ] =
    useState(false);

  const [
    selectedFixedCommitment,
    setSelectedFixedCommitment,
  ] =
    useState<CompromisoFijo | null>(
      null,
    );

  const [
    selectedIncomeCycle,
    setSelectedIncomeCycle,
  ] =
    useState<CicloPago | null>(
      null,
    );

  const summary =
    useBudgetSummary({
      gastos:
        budget.gastos,

      pagos:
        budget.pagos,

      pagosFijos:
        budget.pagosFijos,

      limites:
        budget.limites,

      mesSeleccionado:
        period.mesSeleccionado,

      quincenaSeleccionada:
        period
          .quincenaSeleccionada,

      periodoActual:
        period.periodoActual,
    });

  const visualAlerts =
    useBudgetVisualAlerts({
      resumenCategorias:
        summary
          .resumenCategorias,

      limites:
        budget.limites,

      quincenaSeleccionada:
        period
          .quincenaSeleccionada,
    });

  const currentCycleIncome:
    Ingreso | null =
    income.cicloActual
      ? incomeTransactions
          .ingresosPorCiclo
          .get(
            income
              .cicloActual
              .id,
          ) ??
        null
      : null;

  const selectedCycleIncome:
    Ingreso | null =
    selectedIncomeCycle
      ? incomeTransactions
          .ingresosPorCiclo
          .get(
            selectedIncomeCycle.id,
          ) ??
        null
      : null;

  const feedbackError =
    budget.error ??
    income.error ??
    incomeTransactions.error;

  const clearErrors =
    useCallback(() => {
      budget
        .limpiarError();

      income
        .limpiarError();

      incomeTransactions
        .limpiarError();
    }, [
      budget,
      income,
      incomeTransactions,
    ]);

  const openCurrentIncomeReceipt =
    useCallback(() => {
      if (
        income.cicloActual
      ) {
        setSelectedIncomeCycle(
          income.cicloActual,
        );
      }
    }, [
      income.cicloActual,
    ]);

  const closeIncomeReceipt =
    useCallback(() => {
      setSelectedIncomeCycle(
        null,
      );

      incomeTransactions
        .limpiarError();
    }, [
      incomeTransactions,
    ]);

  return {
    period,
    budget,
    summary,
    income,
    incomeTransactions,
    push,
    visualAlerts,
    feedbackError,
    currentCycleIncome,
    selectedCycleIncome,

    ui: {
      view,
      budgetSettingsOpen,
      incomeSettingsOpen,
      selectedFixedCommitment,
      selectedIncomeCycle,
    },

    actions: {
      setView,
      clearErrors,

      openBudgetSettings:
        () =>
          setBudgetSettingsOpen(
            true,
          ),

      closeBudgetSettings:
        () =>
          setBudgetSettingsOpen(
            false,
          ),

      openIncomeSettings:
        () =>
          setIncomeSettingsOpen(
            true,
          ),

      closeIncomeSettings:
        () =>
          setIncomeSettingsOpen(
            false,
          ),

      openFixedPayment:
        setSelectedFixedCommitment,

      closeFixedPayment:
        () =>
          setSelectedFixedCommitment(
            null,
          ),

      openCurrentIncomeReceipt,
      closeIncomeReceipt,
    },
  };
}

export type BudgetDashboardController =
  ReturnType<
    typeof useBudgetDashboard
  >;