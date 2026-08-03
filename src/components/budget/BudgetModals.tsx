"use client";

import { BudgetSettingsModal } from "@/components/budget/BudgetSettingsModal";
import CreditCardsModal from "@/components/budget/CreditCardsModal";
import { FixedCommitmentsModal } from "@/components/budget/FixedCommitmentsModal";
import { FixedPaymentModal } from "@/components/budget/FixedPaymentModal";
import IncomeReceiptModal from "@/components/budget/IncomeReceiptModal";
import { IncomeSettingsModal } from "@/components/budget/IncomeSettingsModal";

import type { BudgetDashboardController } from "@/hooks/useBudgetDashboard";

interface BudgetModalsProps {
  dashboard: BudgetDashboardController;
}

export function BudgetModals({
  dashboard,
}: BudgetModalsProps) {
  const {
    actions,
    budget,

    /**
     * TARJETAS - 1. Obtiene el controlador de tarjetas
     * desde el dashboard principal.
     */
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
   * Busca el resumen correspondiente al gasto fijo
   * seleccionado para enviar al modal el saldo pendiente
   * real del periodo.
   */
  const selectedFixedSummary =
    ui.selectedFixedCommitment
      ? summary.resumenFijos.find(
          (item) =>
            item.compromiso.id ===
            ui.selectedFixedCommitment?.id,
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

      {/**
       * TARJETAS - 2. Conecta el estado y las operaciones
       * del hook con el administrador visual.
       */}
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

      {/**
       * TARJETAS - 3. El modal permanece centralizado
       * junto con los demás modales del presupuesto.
       */}
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