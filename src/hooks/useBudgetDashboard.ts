"use client";

/*
 * Nombre: Controlador principal del presupuesto
 * Ruta: src/hooks/useBudgetDashboard.ts
 * Autor: Felix Echavarria
 * Fecha: 2026-08-04
 *
 * Descripción:
 * Reúne los hooks de datos, periodos, ingresos, gastos fijos,
 * tarjetas y notificaciones. Expone un solo controlador para que
 * los componentes puedan leer estados y ejecutar acciones sin
 * conocer cómo se administra cada fuente de datos internamente.
 */

import {
  useCallback,
  useState,
} from "react";

import { useBudgetData } from "@/hooks/useBudgetData";
import { useBudgetPeriod } from "@/hooks/useBudgetPeriod";
import { useBudgetSummary } from "@/hooks/useBudgetSummary";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useCreditCardSummaries } from "@/hooks/useCreditCardSummaries";
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

/**
 * Construye el controlador completo de la pantalla principal.
 *
 * Inicializa cada hook especializado, combina sus datos derivados
 * y devuelve estados, resultados y acciones en una estructura que
 * BudgetDashboard y sus componentes pueden consumir directamente.
 */
export function useBudgetDashboard() {
  const period =
    useBudgetPeriod();

  const budget =
    useBudgetData();

  const fixedCommitments =
    useFixedCommitments();

  const creditCards =
    useCreditCards();

  /*
   * Calcula el saldo actual de cada tarjeta usando las tarjetas
   * configuradas, las compras y los pagos cargados desde Firestore.
   */
  const creditCardSummaries =
    useCreditCardSummaries({
      tarjetas:
        creditCards.tarjetas,

      gastos:
        budget.gastos,

      pagos:
        budget.pagos,
    });

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
   * Mantiene la visibilidad del historial centralizado de pagos fijos.
   *
   * El booleano permite que cualquier botón conectado al controlador
   * abra o cierre la ventana sin duplicar estado entre componentes.
   */
  const [
    fixedPaymentsHistoryOpen,
    setFixedPaymentsHistoryOpen,
  ] =
    useState(false);

  /*
   * Mantiene la visibilidad del modal usado para crear,
   * editar, activar o desactivar tarjetas.
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

  /*
   * Combina los errores de los distintos controladores para que
   * la interfaz muestre un único mensaje de retroalimentación.
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

    creditCards,
    creditCardSummaries,

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
      fixedPaymentsHistoryOpen,

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
       * Abre el historial centralizado de pagos fijos.
       *
       * Cambia únicamente el estado del modal; los movimientos siguen
       * viniendo de budget.pagosFijos como fuente de verdad.
       */
      openFixedPaymentsHistory:
        () =>
          setFixedPaymentsHistoryOpen(
            true,
          ),

      /**
       * Cierra el historial centralizado de pagos fijos.
       *
       * Restablece el booleano de visibilidad sin modificar filtros,
       * pagos ni datos almacenados en Firestore.
       */
      closeFixedPaymentsHistory:
        () =>
          setFixedPaymentsHistoryOpen(
            false,
          ),

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