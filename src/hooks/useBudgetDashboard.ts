"use client";

/*
 * Nombre: Controlador principal del presupuesto
 * Ruta: src/hooks/useBudgetDashboard.ts
 * Autor: Felix Echavarria
 * Fecha: 2026-08-04
 *
 * Descripción:
 * Reúne los hooks de datos, periodos, ingresos, gastos fijos,
 * tarjetas, categorías de tarjeta y notificaciones.
 *
 * También centraliza el estado de los modales y el flujo seguro
 * de confirmación para eliminar pagos fijos.
 */

import {
  useCallback,
  useState,
} from "react";

import {
  useBudgetData,
} from "@/hooks/useBudgetData";

import {
  useBudgetPeriod,
} from "@/hooks/useBudgetPeriod";

import {
  useBudgetSummary,
} from "@/hooks/useBudgetSummary";

import {
  useBudgetVisualAlerts,
} from "@/hooks/useBudgetVisualAlerts";

import {
  useCardCategories,
} from "@/hooks/useCardCategories";

import {
  useCreditCards,
} from "@/hooks/useCreditCards";

import {
  useCreditCardSummaries,
} from "@/hooks/useCreditCardSummaries";

import {
  useFixedCommitments,
} from "@/hooks/useFixedCommitments";

import {
  useIncomeData,
} from "@/hooks/useIncomeData";

import {
  useIncomeTransactions,
} from "@/hooks/useIncomeTransactions";

import {
  usePushNotifications,
} from "@/hooks/usePushNotifications";

import type {
  CicloPago,
  CompromisoFijo,
  Ingreso,
  PagoFijo,
  Vista,
} from "@/lib/budget/types";

/**
 * Controlador principal de la pantalla del presupuesto.
 */
export function useBudgetDashboard() {
  /**
   * ============================================================
   * FUENTES DE DATOS
   * ============================================================
   */

  const period =
    useBudgetPeriod();

  const budget =
    useBudgetData();

  const fixedCommitments =
    useFixedCommitments();

  const creditCards =
    useCreditCards();

  /**
   * Categorías configurables para compras con tarjeta.
   *
   * La colección correspondiente es:
   *
   * users/{uid}/categoriasTarjeta
   *
   * El hook garantiza las categorías base:
   *
   * - Supermercado
   * - Gas
   * - Otro
   */
  const cardCategories =
    useCardCategories();

  /**
   * Calcula el saldo actual de cada tarjeta utilizando:
   *
   * - saldo inicial;
   * - compras;
   * - pagos.
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

  /**
   * ============================================================
   * NAVEGACIÓN PRINCIPAL
   * ============================================================
   */

  const [
    view,
    setView,
  ] =
    useState<Vista>(
      "fijos",
    );

  /**
   * ============================================================
   * MODALES DE CONFIGURACIÓN
   * ============================================================
   */

  const [
    budgetSettingsOpen,
    setBudgetSettingsOpen,
  ] =
    useState(
      false,
    );

  const [
    incomeSettingsOpen,
    setIncomeSettingsOpen,
  ] =
    useState(
      false,
    );

  const [
    fixedCommitmentsOpen,
    setFixedCommitmentsOpen,
  ] =
    useState(
      false,
    );

  /**
   * Historial centralizado de pagos fijos.
   */
  const [
    fixedPaymentsHistoryOpen,
    setFixedPaymentsHistoryOpen,
  ] =
    useState(
      false,
    );

  /**
   * Administrador de tarjetas.
   */
  const [
    creditCardsOpen,
    setCreditCardsOpen,
  ] =
    useState(
      false,
    );

  /**
   * ============================================================
   * SELECCIONES
   * ============================================================
   */

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

  /**
   * ============================================================
   * ELIMINACIÓN SEGURA DE PAGOS FIJOS
   * ============================================================
   *
   * No utilizamos window.confirm().
   *
   * Flujo:
   *
   * FixedPaymentsSection
   *      ↓
   * solicitarEliminarPagoFijo(pago)
   *      ↓
   * pagoFijoPendienteEliminar
   *      ↓
   * BudgetModals / ConfirmDialog
   *      ↓
   * confirmarEliminarPagoFijo()
   *      ↓
   * budget.eliminarPagoFijo(pago)
   */

  const [
    pagoFijoPendienteEliminar,
    setPagoFijoPendienteEliminar,
  ] =
    useState<PagoFijo | null>(
      null,
    );

  /**
   * Abre la confirmación de eliminación.
   *
   * Todavía NO toca Firestore.
   */
  const solicitarEliminarPagoFijo =
    useCallback(
      (
        pago:
          PagoFijo,
      ) => {
        setPagoFijoPendienteEliminar(
          pago,
        );
      },
      [],
    );

  /**
   * Cancela la operación y cierra el diálogo.
   */
  const cancelarEliminarPagoFijo =
    useCallback(
      () => {
        setPagoFijoPendienteEliminar(
          null,
        );
      },
      [],
    );

  /**
   * Ejecuta realmente la eliminación después de que
   * el usuario haya confirmado desde ConfirmDialog.
   *
   * IMPORTANTE:
   * ConfirmDialog espera una función cuyo retorno sea
   * void o Promise<void>.
   *
   * useBudgetData.eliminarPagoFijo() sí devuelve boolean,
   * pero ese valor se utiliza únicamente de forma interna
   * para decidir si cerramos el diálogo.
   */
  const confirmarEliminarPagoFijo =
    useCallback(
      async (): Promise<void> => {
        if (
          !pagoFijoPendienteEliminar
        ) {
          return;
        }

        const eliminado =
          await budget
            .eliminarPagoFijo(
              pagoFijoPendienteEliminar,
            );

        if (
          eliminado
        ) {
          setPagoFijoPendienteEliminar(
            null,
          );
        }
      },
      [
        budget,
        pagoFijoPendienteEliminar,
      ],
    );

  /**
   * ============================================================
   * RESUMEN FINANCIERO
   * ============================================================
   */

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

  /**
   * ============================================================
   * ALERTAS VISUALES
   * ============================================================
   */

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

  /**
   * ============================================================
   * INGRESO DEL CICLO ACTUAL
   * ============================================================
   */

  const currentCycleIncome:
    Ingreso | null =
      income.cicloActual
        ? incomeTransactions
            .ingresosPorCiclo
            .get(
              income.cicloActual.id,
            ) ??
          null
        : null;

  /**
   * Ingreso correspondiente al ciclo abierto en el modal.
   */
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

  /**
   * ============================================================
   * ERRORES
   * ============================================================
   */

  const feedbackError =
    budget.error ??
    fixedCommitments.error ??
    creditCards.error ??
    cardCategories.error ??
    income.error ??
    incomeTransactions.error;

  const clearErrors =
    useCallback(
      () => {
        budget
          .limpiarError();

        fixedCommitments
          .limpiarError();

        creditCards
          .limpiarError();

        cardCategories
          .limpiarError();

        income
          .limpiarError();

        incomeTransactions
          .limpiarError();
      },
      [
        budget,
        fixedCommitments,
        creditCards,
        cardCategories,
        income,
        incomeTransactions,
      ],
    );

  /**
   * ============================================================
   * INGRESOS
   * ============================================================
   */

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

  /**
   * ============================================================
   * API DEL CONTROLADOR
   * ============================================================
   */

  return {
    /**
     * Datos.
     */
    period,
    budget,
    fixedCommitments,

    /**
     * Tarjetas.
     */
    creditCards,
    cardCategories,
    creditCardSummaries,

    /**
     * Resúmenes.
     */
    summary,

    /**
     * Ingresos.
     */
    income,
    incomeTransactions,

    /**
     * Notificaciones.
     */
    push,

    /**
     * Alertas.
     */
    visualAlerts,

    /**
     * Error combinado.
     */
    feedbackError,

    /**
     * Datos derivados de ingresos.
     */
    currentCycleIncome,
    selectedCycleIncome,

    /**
     * ========================================================
     * ESTADO DE INTERFAZ
     * ========================================================
     */
    ui: {
      view,

      budgetSettingsOpen,

      incomeSettingsOpen,

      fixedCommitmentsOpen,

      fixedPaymentsHistoryOpen,

      creditCardsOpen,

      selectedFixedCommitment,

      selectedIncomeCycle,

      /**
       * Pago mostrado actualmente en ConfirmDialog.
       */
      pagoFijoPendienteEliminar,
    },

    /**
     * ========================================================
     * ACCIONES
     * ========================================================
     */
    actions: {
      setView,

      clearErrors,

      /**
       * Presupuesto.
       */
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

      /**
       * Ingreso.
       */
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

      /**
       * Compromisos fijos.
       */
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
       * Historial de pagos fijos.
       */
      openFixedPaymentsHistory:
        () =>
          setFixedPaymentsHistoryOpen(
            true,
          ),

      closeFixedPaymentsHistory:
        () =>
          setFixedPaymentsHistoryOpen(
            false,
          ),

      /**
       * Tarjetas.
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

      /**
       * Registrar pago fijo.
       */
      openFixedPayment:
        setSelectedFixedCommitment,

      closeFixedPayment:
        () =>
          setSelectedFixedCommitment(
            null,
          ),

      /**
       * Eliminar pago fijo.
       */
      solicitarEliminarPagoFijo,

      cancelarEliminarPagoFijo,

      confirmarEliminarPagoFijo,

      /**
       * Ingresos.
       */
      openCurrentIncomeReceipt,

      closeIncomeReceipt,
    },
  };
}

export type BudgetDashboardController =
  ReturnType<
    typeof useBudgetDashboard
  >;