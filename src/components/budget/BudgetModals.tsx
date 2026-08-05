"use client";

/*
 * Nombre: Modales del presupuesto
 * Ruta: src/components/budget/BudgetModals.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-08-04
 *
 * Descripción:
 * Centraliza todos los modales utilizados por el dashboard del
 * presupuesto. Conecta cada ventana con los datos, estados y
 * acciones expuestos por useBudgetDashboard.
 */

import {
  BudgetSettingsModal,
} from "@/components/budget/BudgetSettingsModal";

import CreditCardsModal from "@/components/budget/CreditCardsModal";

import {
  FixedCommitmentsModal,
} from "@/components/budget/FixedCommitmentsModal";

import {
  FixedPaymentModal,
} from "@/components/budget/FixedPaymentModal";

import {
  FixedPaymentsHistoryModal,
} from "@/components/budget/FixedPaymentsHistoryModal";

import IncomeReceiptModal from "@/components/budget/IncomeReceiptModal";

import {
  IncomeSettingsModal,
} from "@/components/budget/IncomeSettingsModal";

import type {
  BudgetDashboardController,
} from "@/hooks/useBudgetDashboard";

interface BudgetModalsProps {
  dashboard:
  BudgetDashboardController;
}

/**
 * Renderiza y conecta todos los modales del presupuesto.
 *
 * Recibe el controlador principal, extrae los datos y acciones
 * necesarios y los distribuye entre cada ventana. De esta forma,
 * los modales no necesitan acceder directamente a otros hooks.
 */
export function BudgetModals({
  dashboard,
}: BudgetModalsProps) {
  const {
    actions,
    budget,
    creditCards,
    fixedCommitments,
    income,
    incomeTransactions,
    period,
    selectedCycleIncome,
    summary,
    ui,
  } = dashboard;

/**
   * Obtiene el resumen del gasto fijo seleccionado.
   *
   * Busca el compromiso por ID dentro de resumenFijos para enviar
   * al modal de pago el saldo pendiente real del periodo.
   */
  const selectedFixedSummary =
    ui.selectedFixedCommitment
      ? summary.resumenFijos.find(
        (item) =>
          item.compromiso.id ===
          ui.selectedFixedCommitment
            ?.id,
      ) ?? null
      : null;

  return (
    <>
      <FixedPaymentModal
        compromiso={
          ui.selectedFixedCommitment
        }
        montoPendiente={
          selectedFixedSummary
            ?.pendienteMes
        }
        mesSeleccionado={
          period.mesSeleccionado
        }
        quincenaSeleccionada={
          period
            .quincenaSeleccionada
        }
        guardando={
          budget
            .guardandoPagoFijo
        }
        onCerrar={
          actions.closeFixedPayment
        }
        onRegistrar={
          budget.registrarPagoFijo
        }
      />

      <FixedPaymentsHistoryModal
        abierto={
          ui.fixedPaymentsHistoryOpen
        }
        pagos={
          budget.pagosFijos
        }
        mesInicial={
          period.mesSeleccionado
        }
        cargando={
          budget.cargando
        }
        eliminandoPagoFijoId={
          budget.eliminandoPagoFijoId
        }
        onCerrar={
          actions.closeFixedPaymentsHistory
        }
        onEliminarPago={
          budget.eliminarPagoFijo
        }
      />

      <FixedCommitmentsModal
        abierto={
          ui.fixedCommitmentsOpen
        }
        compromisos={
          fixedCommitments
            .compromisos
        }
        cargando={
          fixedCommitments
            .cargando
        }
        guardando={
          fixedCommitments
            .guardando
        }
        actualizandoId={
          fixedCommitments
            .actualizandoId
        }
        onCerrar={
          actions
            .closeFixedCommitments
        }
        onCrear={
          fixedCommitments
            .crearCompromiso
        }
        onActualizar={
          fixedCommitments
            .actualizarCompromiso
        }
        onCambiarEstado={
          fixedCommitments
            .cambiarEstado
        }
      />

      <CreditCardsModal
        abierto={
          ui.creditCardsOpen
        }
        tarjetas={
          creditCards.tarjetas
        }
        cargando={
          creditCards.cargando
        }
        guardando={
          creditCards.guardando
        }
        actualizandoId={
          creditCards
            .actualizandoId
        }
        onCerrar={
          actions.closeCreditCards
        }
        onCrear={
          creditCards.crearTarjeta
        }
        onActualizar={
          creditCards
            .actualizarTarjeta
        }
        onCambiarEstado={
          creditCards.cambiarEstado
        }
      />

      <BudgetSettingsModal
        abierto={
          ui.budgetSettingsOpen
        }
        limites={
          budget.limites
        }
        guardando={
          budget.guardandoLimites
        }
        onCerrar={
          actions.closeBudgetSettings
        }
        onGuardar={
          budget.guardarLimites
        }
      />

      <IncomeSettingsModal
        abierta={
          ui.incomeSettingsOpen
        }
        configuracion={
          income.configuracion
        }
        guardando={
          income
            .guardandoConfiguracion
        }
        onCerrar={
          actions.closeIncomeSettings
        }
        onGuardar={
          income.guardarConfiguracion
        }
      />

      <IncomeReceiptModal
        abierto={
          ui.selectedIncomeCycle !==
          null
        }
        ciclo={
          ui.selectedIncomeCycle
        }
        configuracion={
          income.configuracion
        }
        ingresoExistente={
          selectedCycleIncome
        }
        guardando={
          incomeTransactions.guardando
        }
        error={
          incomeTransactions.error
        }
        onCerrar={
          actions.closeIncomeReceipt
        }
        onGuardar={
          incomeTransactions
            .registrarIngresoRecibido
        }
      />
    </>
  );
}