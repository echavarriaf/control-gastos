"use client";

import { CategorySummaryGrid } from "@/components/budget/CategorySummaryGrid";
import { FeedbackBanners } from "@/components/budget/FeedbackBanners";
import { IncomeCycleSummary } from "@/components/budget/IncomeCycleSummary";

import type { BudgetDashboardController } from "@/hooks/useBudgetDashboard";

interface BudgetOverviewProps {
  dashboard: BudgetDashboardController;
}

export function BudgetOverview({ dashboard }: BudgetOverviewProps) {
  const {
    actions,
    budget,
    currentCycleIncome,
    feedbackError,
    income,
    incomeTransactions,
    period,
    summary,
    visualAlerts,
  } = dashboard;

  return (
    <>
      <FeedbackBanners
        error={feedbackError}
        alertas={visualAlerts}
        onCerrarError={actions.clearErrors}
      />

      <IncomeCycleSummary
        montoEstimado={income.configuracion.montoEstimado}
        cargando={income.cargando}
        cicloActual={income.cicloActual}
        proximoCiclo={income.proximoCiclo}
        pagosMes={income.ciclosMesActual.length}
        ingresoActual={currentCycleIncome}
        cargandoIngreso={incomeTransactions.cargando}
        guardandoIngreso={incomeTransactions.guardando}
        onRegistrarDeposito={actions.openCurrentIncomeReceipt}
        onConfigurar={actions.openIncomeSettings}
      />

      <CategorySummaryGrid
        resumenCategorias={summary.resumenCategorias}
        limites={budget.limites}
        quincenaSeleccionada={period.quincenaSeleccionada}
      />
    </>
  );
}