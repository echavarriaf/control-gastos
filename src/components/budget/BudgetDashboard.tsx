"use client";

import { BottomNavigation } from "@/components/budget/BottomNavigation";
import { BudgetContent } from "@/components/budget/BudgetContent";
import { BudgetHeader } from "@/components/budget/BudgetHeader";
import { BudgetModals } from "@/components/budget/BudgetModals";
import { BudgetOverview } from "@/components/budget/BudgetOverview";
import { PeriodSelector } from "@/components/budget/PeriodSelector";

import { useBudgetDashboard } from "@/hooks/useBudgetDashboard";

export function BudgetDashboard() {
  const dashboard = useBudgetDashboard();
  const { actions, budget, period, push, summary, ui } = dashboard;

  return (
    <main className="min-h-screen bg-slate-950 px-0 py-0 text-slate-900 antialiased sm:px-5 sm:py-5">
      <div className="mx-auto min-h-screen w-full max-w-4xl overflow-hidden bg-slate-50 shadow-2xl sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[2rem]">
        <BudgetHeader
          totalPlanMensual={summary.totalPlanMensual}
          totalFijo={summary.totalFijo}
          limiteVariableMensual={summary.limiteVariableMensual}
          saldoVariableMes={summary.saldoVariableMes}
          disponibleVariableMes={summary.disponibleVariableMes}
          totalPagadoFijoMes={summary.totalPagadoFijoMes}
          totalPendienteFijoMes={summary.totalPendienteFijoMes}
          estadoPush={push.estado}
          permisoPush={push.permiso}
          installationId={push.installationId}
          requiereInstalacionIOS={push.requiereInstalacionIOS}
          errorPush={push.error}
          onActivarPush={push.activarPush}
          onDesactivarPush={push.desactivarPush}
          onLimpiarErrorPush={push.limpiarError}
          onAbrirConfiguracion={actions.openBudgetSettings}
        />

        <PeriodSelector
          mesesDisponibles={summary.mesesDisponibles}
          mesSeleccionado={period.mesSeleccionado}
          quincenaSeleccionada={period.quincenaSeleccionada}
          onCambiarMes={period.setMesSeleccionado}
          onCambiarQuincena={period.setQuincenaSeleccionada}
        />

        <div className="space-y-5 p-4 pb-28 sm:p-6 sm:pb-8">
          <BudgetOverview dashboard={dashboard} />
          <BudgetContent dashboard={dashboard} />
        </div>
      </div>

      <BottomNavigation vistaActual={ui.view} onCambiarVista={actions.setView} />
      <BudgetModals dashboard={dashboard} />
    </main>
  );
}