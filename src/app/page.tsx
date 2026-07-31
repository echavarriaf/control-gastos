"use client";

import {
  useMemo,
  useState,
} from "react";

import LoadingState from "@/components/LoadingState";

import { BottomNavigation } from "@/components/budget/BottomNavigation";
import { BudgetHeader } from "@/components/budget/BudgetHeader";
import { BudgetSettingsModal } from "@/components/budget/BudgetSettingsModal";
import { CategorySummaryGrid } from "@/components/budget/CategorySummaryGrid";
import { FeedbackBanners } from "@/components/budget/FeedbackBanners";
import { FixedPaymentModal } from "@/components/budget/FixedPaymentModal";
import { IncomeSettingsModal } from "@/components/budget/IncomeSettingsModal";
import IncomeReceiptModal from "@/components/budget/IncomeReceiptModal";
import { IncomeCycleSummary } from "@/components/budget/IncomeCycleSummary";
import { FixedPaymentsSection } from "@/components/budget/FixedPaymentsSection";
import { PeriodSelector } from "@/components/budget/PeriodSelector";
import { VariableMovementForm } from "@/components/budget/VariableMovementForm";
import { VariableMovementsSection } from "@/components/budget/VariableMovementsSection";
import { ViewTabs } from "@/components/budget/ViewTabs";

import { useBudgetData } from "@/hooks/useBudgetData";
import { useBudgetSummary } from "@/hooks/useBudgetSummary";
import { useBudgetVisualAlerts } from "@/hooks/useBudgetVisualAlerts";
import { useBudgetPeriod } from "@/hooks/useBudgetPeriod";
import { useIncomeData } from "@/hooks/useIncomeData";
import { useIncomeTransactions } from "@/hooks/useIncomeTransactions";
import { usePushNotifications } from "@/hooks/usePushNotifications";

import type {
  CicloPago,
  CompromisoFijo,
  Ingreso,
  Vista,
} from "@/lib/budget/types";


export default function Home() {
  const {
    periodoActual,
    mesSeleccionado,
    quincenaSeleccionada,
    setMesSeleccionado,
    setQuincenaSeleccionada,
  } = useBudgetPeriod();

  const [
    vistaActual,
    setVistaActual,
  ] =
    useState<Vista>(
      "fijos",
    );

  const [
    mostrarConfiguracion,
    setMostrarConfiguracion,
  ] = useState(false);

  const [
    mostrarConfiguracionIngreso,
    setMostrarConfiguracionIngreso,
  ] = useState(false);

  const [
    cicloIngresoSeleccionado,
    setCicloIngresoSeleccionado,
  ] =
    useState<CicloPago | null>(
      null,
    );

  const [
    compromisoSeleccionado,
    setCompromisoSeleccionado,
  ] =
    useState<CompromisoFijo | null>(
      null,
    );

  const presupuesto =
    useBudgetData();

  const ingresos =
    useIncomeData();

  const movimientosIngresos =
    useIncomeTransactions();

  const ingresoCicloActual =
    useMemo<Ingreso | null>(
      () => {
        if (
          !ingresos.cicloActual
        ) {
          return null;
        }

        return (
          movimientosIngresos
            .ingresosPorCiclo
            .get(
              ingresos
                .cicloActual
                .id,
            ) ??
          null
        );
      },
      [
        ingresos.cicloActual,
        movimientosIngresos
          .ingresosPorCiclo,
      ],
    );

  const ingresoCicloSeleccionado =
    useMemo<Ingreso | null>(
      () => {
        if (
          !cicloIngresoSeleccionado
        ) {
          return null;
        }

        return (
          movimientosIngresos
            .ingresosPorCiclo
            .get(
              cicloIngresoSeleccionado
                .id,
            ) ??
          null
        );
      },
      [
        cicloIngresoSeleccionado,
        movimientosIngresos
          .ingresosPorCiclo,
      ],
    );

  const resumen =
    useBudgetSummary({
      gastos:
        presupuesto.gastos,

      pagos:
        presupuesto.pagos,

      pagosFijos:
        presupuesto.pagosFijos,

      limites:
        presupuesto.limites,

      mesSeleccionado,

      quincenaSeleccionada,

      periodoActual,
    });

  const push =
    usePushNotifications();

  const alertasVisuales =
    useBudgetVisualAlerts({
      resumenCategorias:
        resumen.resumenCategorias,

      limites:
        presupuesto.limites,

      quincenaSeleccionada,
    });

  return (
    <main className="min-h-screen bg-slate-950 px-0 py-0 text-slate-900 antialiased sm:px-5 sm:py-5">
      <div className="mx-auto min-h-screen w-full max-w-4xl overflow-hidden bg-slate-50 shadow-2xl sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[2rem]">
        <BudgetHeader
          totalPlanMensual={
            resumen.totalPlanMensual
          }
          totalFijo={
            resumen.totalFijo
          }
          limiteVariableMensual={
            resumen
              .limiteVariableMensual
          }
          saldoVariableMes={
            resumen.saldoVariableMes
          }
          disponibleVariableMes={
            resumen
              .disponibleVariableMes
          }
          totalPagadoFijoMes={
            resumen
              .totalPagadoFijoMes
          }
          totalPendienteFijoMes={
            resumen
              .totalPendienteFijoMes
          }
          estadoPush={
            push.estado
          }
          permisoPush={
            push.permiso
          }
          installationId={
            push.installationId
          }
          requiereInstalacionIOS={
            push
              .requiereInstalacionIOS
          }
          errorPush={
            push.error
          }
          onActivarPush={
            push.activarPush
          }
          onDesactivarPush={
            push.desactivarPush
          }
          onLimpiarErrorPush={
            push.limpiarError
          }
          onAbrirConfiguracion={() =>
            setMostrarConfiguracion(
              true,
            )
          }
        />

        <PeriodSelector
          mesesDisponibles={
            resumen
              .mesesDisponibles
          }
          mesSeleccionado={
            mesSeleccionado
          }
          quincenaSeleccionada={
            quincenaSeleccionada
          }
          onCambiarMes={
            setMesSeleccionado
          }
          onCambiarQuincena={
            setQuincenaSeleccionada
          }
        />

        <div className="space-y-5 p-4 pb-28 sm:p-6 sm:pb-8">
          <FeedbackBanners
            error={
              presupuesto.error ??
              ingresos.error ??
              movimientosIngresos.error
            }
            alertas={
              alertasVisuales
            }
            onCerrarError={() => {
              presupuesto
                .limpiarError();

              ingresos
                .limpiarError();

              movimientosIngresos
                .limpiarError();
            }}
          />

          <IncomeCycleSummary
            montoEstimado={
              ingresos
                .configuracion
                .montoEstimado
            }
            cargando={
              ingresos.cargando
            }
            cicloActual={
              ingresos.cicloActual
            }
            proximoCiclo={
              ingresos.proximoCiclo
            }
            pagosMes={
              ingresos
                .ciclosMesActual
                .length
            }
            ingresoActual={
              ingresoCicloActual
            }
            cargandoIngreso={
              movimientosIngresos
                .cargando
            }
            guardandoIngreso={
              movimientosIngresos
                .guardando
            }
            onRegistrarDeposito={() => {
              if (
                ingresos.cicloActual
              ) {
                setCicloIngresoSeleccionado(
                  ingresos.cicloActual,
                );
              }
            }}
            onConfigurar={() =>
              setMostrarConfiguracionIngreso(
                true,
              )
            }
          />

          <CategorySummaryGrid
            resumenCategorias={
              resumen
                .resumenCategorias
            }
            limites={
              presupuesto.limites
            }
            quincenaSeleccionada={
              quincenaSeleccionada
            }
          />

          <ViewTabs
            vistaActual={
              vistaActual
            }
            onCambiarVista={
              setVistaActual
            }
          />

          {presupuesto.cargando ? (
            <LoadingState />
          ) : vistaActual ===
            "fijos" ? (
            <FixedPaymentsSection
              resumenFijos={
                resumen
                  .resumenFijos
              }
              quincenaSeleccionada={
                quincenaSeleccionada
              }
              totalFijo={
                resumen.totalFijo
              }
              totalPagadoFijoMes={
                resumen
                  .totalPagadoFijoMes
              }
              totalPendienteFijoMes={
                resumen
                  .totalPendienteFijoMes
              }
              totalPagadoFijoQuincena={
                resumen
                  .totalPagadoFijoQuincena
              }
              porcentajeFijoPagado={
                resumen
                  .porcentajeFijoPagado
              }
              eliminandoPagoFijoId={
                presupuesto
                  .eliminandoPagoFijoId
              }
              onRegistrarPago={
                setCompromisoSeleccionado
              }
              onEliminarPago={
                presupuesto
                  .eliminarPagoFijo
              }
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
              <VariableMovementForm
                mesSeleccionado={
                  mesSeleccionado
                }
                quincenaSeleccionada={
                  quincenaSeleccionada
                }
                guardando={
                  presupuesto
                    .guardandoMovimiento
                }
                onRegistrar={
                  presupuesto
                    .registrarMovimiento
                }
              />

              <VariableMovementsSection
                movimientos={
                  resumen.movimientos
                }
                quincenaSeleccionada={
                  quincenaSeleccionada
                }
                eliminandoMovimientoId={
                  presupuesto
                    .eliminandoMovimientoId
                }
                onEliminar={
                  presupuesto
                    .eliminarMovimiento
                }
              />
            </div>
          )}
        </div>
      </div>

      <BottomNavigation
        vistaActual={
          vistaActual
        }
        onCambiarVista={
          setVistaActual
        }
      />

      <FixedPaymentModal
        compromiso={
          compromisoSeleccionado
        }
        mesSeleccionado={
          mesSeleccionado
        }
        quincenaSeleccionada={
          quincenaSeleccionada
        }
        guardando={
          presupuesto
            .guardandoPagoFijo
        }
        onCerrar={() =>
          setCompromisoSeleccionado(
            null,
          )
        }
        onRegistrar={
          presupuesto
            .registrarPagoFijo
        }
      />

      <BudgetSettingsModal
        abierto={
          mostrarConfiguracion
        }
        limites={
          presupuesto.limites
        }
        guardando={
          presupuesto
            .guardandoLimites
        }
        onCerrar={() =>
          setMostrarConfiguracion(
            false,
          )
        }
        onGuardar={
          presupuesto
            .guardarLimites
        }
      />

      <IncomeSettingsModal
        abierta={
          mostrarConfiguracionIngreso
        }
        configuracion={
          ingresos.configuracion
        }
        guardando={
          ingresos
            .guardandoConfiguracion
        }
        onCerrar={() =>
          setMostrarConfiguracionIngreso(
            false,
          )
        }
        onGuardar={
          ingresos
            .guardarConfiguracion
        }
      />

      <IncomeReceiptModal
        abierto={
          cicloIngresoSeleccionado !==
          null
        }
        ciclo={
          cicloIngresoSeleccionado
        }
        configuracion={
          ingresos.configuracion
        }
        ingresoExistente={
          ingresoCicloSeleccionado
        }
        guardando={
          movimientosIngresos
            .guardando
        }
        error={
          movimientosIngresos.error
        }
        onCerrar={() => {
          setCicloIngresoSeleccionado(
            null,
          );

          movimientosIngresos
            .limpiarError();
        }}
        onGuardar={
          movimientosIngresos
            .registrarIngresoRecibido
        }
      />
    </main>
  );
}