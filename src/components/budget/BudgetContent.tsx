"use client";

/*
 * Nombre: Contenido principal del presupuesto
 * Ruta: src/components/budget/BudgetContent.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-09-01
 *
 * Descripción:
 * Decide qué vista del presupuesto debe mostrarse y conecta
 * los datos y acciones del dashboard con los formularios,
 * historiales y administradores de gastos fijos, tarjetas
 * y categorías configurables de compras.
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

export function BudgetContent({ dashboard }: BudgetContentProps) {
  const {
    actions,
    budget,

    creditCards,
    creditCardSummaries,
    cardCategories,

    period,
    summary,
    ui,
  } = dashboard;

  const abrirConfiguracionTarjetas = actions.openCreditCards;

  const abrirConfiguracionFijos = actions.openFixedCommitments;

  const abrirPagoFijo = actions.openFixedPayment;

  const abrirHistorialFijos = actions.openFixedPaymentsHistory;

  return (
    <>
      <ViewTabs vistaActual={ui.view} onCambiarVista={actions.setView} />

      {ui.view === "tarjetas" ? (
        <CreditCardsView
          resumenes={creditCardSummaries.resumenes}
          totalSaldoActual={creditCardSummaries.totalSaldoActual}
          totalCompras={creditCardSummaries.totalCompras}
          totalPagos={creditCardSummaries.totalPagos}
          cargando={budget.cargando || creditCards.cargando}
          onConfigurar={abrirConfiguracionTarjetas}
        />
      ) : budget.cargando ? (
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
          onAbrirHistorial={abrirHistorialFijos}
          onConfigurar={abrirConfiguracionFijos}
          onRegistrarPago={abrirPagoFijo}
          onEliminarPago={actions.solicitarEliminarPagoFijo}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <VariableMovementForm
            cobertura={summary.coberturaQuincena}
            /**
             * 2B.2D
             *
             * Enviamos todas las tarjetas.
             *
             * VariableMovementForm seguirá mostrando solamente
             * las activas para movimientos nuevos, pero podrá
             * conservar una tarjeta inactiva cuando estemos
             * editando un movimiento histórico que ya la utilizó.
             */
            tarjetasActivas={creditCards.tarjetas}
            /**
             * Movimiento seleccionado desde el botón Editar
             * del historial.
             *
             * null = modo registro
             * Movimiento = modo edición
             */
            movimientoEditando={ui.selectedMovement}
            /**
             * En 1C.1E enviamos TODAS las categorías.
             *
             * VariableMovementForm filtra las activas para registrar
             * compras y CardCategoriesManager utiliza también las
             * inactivas para poder reactivarlas.
             *
             * En modo edición también puede conservar la categoría
             * histórica aunque actualmente esté inactiva.
             */
            categoriasTarjeta={cardCategories.categorias}
            cargandoCategorias={
              cardCategories.cargando || cardCategories.inicializando
            }
            guardandoCategoria={cardCategories.guardando}
            actualizandoCategoriaId={cardCategories.actualizandoId}
            reordenandoCategorias={cardCategories.reordenando}
            mesSeleccionado={period.mesSeleccionado}
            quincenaSeleccionada={period.quincenaSeleccionada}
            /**
             * El formulario queda bloqueado tanto durante
             * un registro nuevo como durante un updateDoc.
             */
            guardando={
              budget.guardandoMovimiento ||
              budget.actualizandoMovimientoId !== null
            }
            onRegistrar={budget.registrarMovimiento}
            /**
             * 2B.2D
             *
             * Edita el documento existente sin eliminarlo
             * ni crear uno nuevo.
             */
            onActualizar={budget.actualizarMovimiento}
            /**
             * Limpia ui.selectedMovement y devuelve
             * el formulario al modo de registro.
             */
            onCancelarEdicion={actions.cancelEditingMovement}
            onCrearCategoria={cardCategories.crearCategoria}
            onActualizarCategoria={cardCategories.actualizarCategoria}
            onCambiarEstadoCategoria={cardCategories.cambiarEstado}
            onMoverCategoria={cardCategories.moverCategoria}
          />

          <VariableMovementsSection
            movimientosDeQuincena={summary.movimientosQuincena}
            movimientos={summary.movimientos}
            tarjetas={creditCards.tarjetas}
            quincenaSeleccionada={period.quincenaSeleccionada}
            eliminandoMovimientoId={budget.eliminandoMovimientoId}
            onEditar={actions.startEditingMovement}
            onEliminar={budget.eliminarMovimiento}
          />
        </div>
      )}
    </>
  );
}

export default BudgetContent;
