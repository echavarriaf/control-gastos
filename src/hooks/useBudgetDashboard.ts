"use client";

import {
  useCallback,
  useState,
} from "react";

import { useBudgetData } from "@/hooks/useBudgetData";
import { useBudgetPeriod } from "@/hooks/useBudgetPeriod";
import { useBudgetSummary } from "@/hooks/useBudgetSummary";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useBudgetVisualAlerts } from "@/hooks/useBudgetVisualAlerts";
import { useFixedCommitments } from "@/hooks/useFixedCommitments";
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
  const period =
    useBudgetPeriod();

  const budget =
    useBudgetData();

  const fixedCommitments =
    useFixedCommitments();

  /**
   * 1. Conecta el administrador de tarjetas con
   * el controlador principal del presupuesto.
   */
  const creditCards =
    useCreditCards();

  const income =
    useIncomeData();

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
    fixedCommitmentsOpen,
    setFixedCommitmentsOpen,
  ] =
    useState(false);

  /**
   * TARJETAS - 1. Mantiene el estado de apertura
   * del administrador de tarjetas.
   */
  const [
    creditCardsOpen,
    setCreditCardsOpen,
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

      compromisosFijos:
        fixedCommitments
          .compromisosActivos,

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
        summary.resumenCategorias,

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
              income.cicloActual.id,
            ) ?? null
        : null;

  const selectedCycleIncome:
    Ingreso | null =
      selectedIncomeCycle
        ? incomeTransactions
            .ingresosPorCiclo
            .get(
              selectedIncomeCycle.id,
            ) ?? null
        : null;

  /**
   * 2. Incluye los errores de tarjetas dentro
   * del sistema general de mensajes.
   */
  const feedbackError =
    budget.error ??
    fixedCommitments.error ??
    creditCards.error ??
    income.error ??
    incomeTransactions.error;

  const clearErrors =
    useCallback(
      () => {
        budget.limpiarError();

        fixedCommitments
          .limpiarError();

        creditCards
          .limpiarError();

        income.limpiarError();

        incomeTransactions
          .limpiarError();
      },
      [
        budget,
        fixedCommitments,
        creditCards,
        income,
        incomeTransactions,
      ],
    );

  const openCurrentIncomeReceipt =
    useCallback(
      () => {
        if (
          income.cicloActual
        ) {
          setSelectedIncomeCycle(
            income.cicloActual,
          );
        }
      },
      [
        income.cicloActual,
      ],
    );

  const closeIncomeReceipt =
    useCallback(
      () => {
        setSelectedIncomeCycle(
          null,
        );

        incomeTransactions
          .limpiarError();
      },
      [
        incomeTransactions,
      ],
    );

  return {
    period,
    budget,
    fixedCommitments,

    /**
     * 3. Expone tarjetas, operaciones y estados
     * para las próximas vistas y modales.
     */
    creditCards,

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
      fixedCommitmentsOpen,

      /**
       * TARJETAS - 2. Expone el estado del modal
       * para que pueda ser renderizado.
       */
      creditCardsOpen,

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

      openFixedCommitments:
        () =>
          setFixedCommitmentsOpen(
            true,
          ),

      closeFixedCommitments:
        () =>
          setFixedCommitmentsOpen(
            false,
          ),

      /**
       * TARJETAS - 3. Expone las acciones para
       * abrir y cerrar el administrador.
       */
      openCreditCards:
        () =>
          setCreditCardsOpen(
            true,
          ),

      closeCreditCards:
        () =>
          setCreditCardsOpen(
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