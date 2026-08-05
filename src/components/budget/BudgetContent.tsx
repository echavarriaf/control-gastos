"use client";

/*
 * Nombre: Contenido principal del presupuesto
 * Ruta: src/components/budget/BudgetContent.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-08-04
 *
 * Descripción:
 * Decide qué vista del presupuesto debe mostrarse y conecta
 * los datos y acciones del dashboard con los formularios,
 * historiales y administradores de gastos fijos y tarjetas.
 */

import LoadingState from "@/components/LoadingState";
import { CreditCardsView } from "@/components/budget/CreditCardsView";
import { FixedPaymentsSection } from "@/components/budget/FixedPaymentsSection";
import { VariableMovementForm } from "@/components/budget/VariableMovementForm";
import { VariableMovementsSection } from "@/components/budget/VariableMovementsSection";
import { ViewTabs } from "@/components/budget/ViewTabs";

import type { BudgetDashboardController } from "@/hooks/useBudgetDashboard";

interface BudgetContentProps {
  dashboard: BudgetDashboardController;
}

/**
 * Renderiza la vista principal del presupuesto.
 *
 * Lee el controlador del dashboard y conecta cada componente con
 * los datos y acciones que necesita. Según ui.view muestra gastos
 * fijos, movimientos variables o el resumen financiero de tarjetas.
 */
export function BudgetContent({
  dashboard,
}: BudgetContentProps) {
  const {
    actions,
    budget,

    creditCards,
    creditCardSummaries,

    period,
    summary,
    ui,
  } = dashboard;

  /*
   * Estas referencias conectan cada vista con las acciones que abren
   * sus respectivos modales de configuración o registro.
   */
  const abrirConfiguracionTarjetas =
    actions.openCreditCards;

  const abrirConfiguracionFijos =
    actions.openFixedCommitments;

  const abrirPagoFijo =
    actions.openFixedPayment;

  /**
   * Abre el historial centralizado de gastos fijos.
   *
   * Usa la acción expuesta por el controlador para que la sección
   * de gastos fijos no administre estado global por su cuenta.
   */
  const abrirHistorialFijos =
    actions.openFixedPaymentsHistory;

  return (
    <>
      <ViewTabs
        vistaActual={ui.view}
        onCambiarVista={
          actions.setView
        }
      />

      {ui.view === "tarjetas" ? (
        /*
         * La vista de tarjetas recibe los saldos calculados por el
         * dashboard y espera tanto los movimientos como las tarjetas
         * antes de mostrar resultados financieros definitivos.
         */
        <CreditCardsView
          resumenes={
            creditCardSummaries
              .resumenes
          }
          totalSaldoActual={
            creditCardSummaries
              .totalSaldoActual
          }
          totalCompras={
            creditCardSummaries
              .totalCompras
          }
          totalPagos={
            creditCardSummaries
              .totalPagos
          }
          cargando={
            budget.cargando ||
            creditCards.cargando
          }
          onConfigurar={
            abrirConfiguracionTarjetas
          }
        />
      ) : budget.cargando ? (
        <LoadingState />
      ) : ui.view === "fijos" ? (
        <FixedPaymentsSection
          resumenFijos={
            summary.resumenFijos
          }
          quincenaSeleccionada={
            period
              .quincenaSeleccionada
          }
          totalFijo={
            summary.totalFijo
          }
          totalPagadoFijoMes={
            summary
              .totalPagadoFijoMes
          }
          totalPendienteFijoMes={
            summary
              .totalPendienteFijoMes
          }
          totalPagadoFijoQuincena={
            summary
              .totalPagadoFijoQuincena
          }
          porcentajeFijoPagado={
            summary
              .porcentajeFijoPagado
          }
          eliminandoPagoFijoId={
            budget
              .eliminandoPagoFijoId
          }
          onAbrirHistorial={
            abrirHistorialFijos
          }
          onConfigurar={
            abrirConfiguracionFijos
          }
          onRegistrarPago={
            abrirPagoFijo
          }
          onEliminarPago={
            budget
              .eliminarPagoFijo
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          {/*
           * El formulario recibe únicamente tarjetas activas porque
           * son las únicas que pueden seleccionarse en gastos nuevos.
           */}
          <VariableMovementForm
            tarjetasActivas={
              creditCards
                .tarjetasActivas
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
                .guardandoMovimiento
            }
            onRegistrar={
              budget
                .registrarMovimiento
            }
          />

          {/*
           * El historial recibe todas las tarjetas, incluso las
           * inactivas, para poder mostrar correctamente el nombre
           * de una tarjeta usada en movimientos anteriores.
           */}
          <VariableMovementsSection
            movimientos={
              summary.movimientos
            }
            tarjetas={
              creditCards
                .tarjetas
            }
            quincenaSeleccionada={
              period
                .quincenaSeleccionada
            }
            eliminandoMovimientoId={
              budget
                .eliminandoMovimientoId
            }
            onEliminar={
              budget
                .eliminarMovimiento
            }
          />
        </div>
      )}
    </>
  );
}

export default BudgetContent;