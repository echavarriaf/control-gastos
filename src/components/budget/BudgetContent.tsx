"use client";

import LoadingState from "@/components/LoadingState";
import { FixedPaymentsSection } from "@/components/budget/FixedPaymentsSection";
import { VariableMovementForm } from "@/components/budget/VariableMovementForm";
import { VariableMovementsSection } from "@/components/budget/VariableMovementsSection";
import { ViewTabs } from "@/components/budget/ViewTabs";

import type { BudgetDashboardController } from "@/hooks/useBudgetDashboard";

interface BudgetContentProps {
  dashboard: BudgetDashboardController;
}

export function BudgetContent({ dashboard }: BudgetContentProps) {
  const { actions, budget, period, summary, ui } = dashboard;

  return (
    <>
      <ViewTabs vistaActual={ui.view} onCambiarVista={actions.setView} />

      {budget.cargando ? (
        <LoadingState />
      ) : ui.view === "fijos" ? (
        <FixedPaymentsSection
          resumenFijos={summary.resumenFijos}
          quincenaSeleccionada={period.quincenaSeleccionada}
          totalFijo={summary.totalFijo}
          totalPagadoFijoMes={summary.totalPagadoFijoMes}
          totalPendienteFijoMes={summary.totalPendienteFijoMes}
          totalPagadoFijoQuincena={summary.totalPagadoFijoQuincena}
          porcentajeFijoPagado={summary.porcentajeFijoPagado}
          eliminandoPagoFijoId={budget.eliminandoPagoFijoId}
          onRegistrarPago={actions.openFixedPayment}
          onEliminarPago={budget.eliminarPagoFijo}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <VariableMovementForm
            mesSeleccionado={period.mesSeleccionado}
            quincenaSeleccionada={period.quincenaSeleccionada}
            guardando={budget.guardandoMovimiento}
            onRegistrar={budget.registrarMovimiento}
          />

          <VariableMovementsSection
            movimientos={summary.movimientos}
            quincenaSeleccionada={period.quincenaSeleccionada}
            eliminandoMovimientoId={budget.eliminandoMovimientoId}
            onEliminar={budget.eliminarMovimiento}
          />
        </div>
      )}
    </>
  );
}