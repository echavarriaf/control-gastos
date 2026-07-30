"use client";

import { LoaderCircle } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { BottomNavigation } from "@/components/budget/BottomNavigation";
import { BudgetHeader } from "@/components/budget/BudgetHeader";
import { BudgetSettingsModal } from "@/components/budget/BudgetSettingsModal";
import { CategorySummaryGrid } from "@/components/budget/CategorySummaryGrid";
import { FeedbackBanners } from "@/components/budget/FeedbackBanners";
import { FixedPaymentModal } from "@/components/budget/FixedPaymentModal";
import { FixedPaymentsSection } from "@/components/budget/FixedPaymentsSection";
import { PeriodSelector } from "@/components/budget/PeriodSelector";
import { VariableMovementForm } from "@/components/budget/VariableMovementForm";
import { VariableMovementsSection } from "@/components/budget/VariableMovementsSection";
import { ViewTabs } from "@/components/budget/ViewTabs";

import { useBudgetData } from "@/hooks/useBudgetData";
import type { AlertaPresupuesto } from "@/hooks/useBudgetNotifications";
import { useBudgetSummary } from "@/hooks/useBudgetSummary";
import { usePushNotifications } from "@/hooks/usePushNotifications";

import {
  CATEGORIAS_VARIABLES,
} from "@/lib/budget/constants";

import type {
  CompromisoFijo,
  Quincena,
  Vista,
} from "@/lib/budget/types";

import {
  formatoMoneda,
  obtenerPeriodo,
  obtenerQuincena,
} from "@/lib/budget/utils";

const ALERTA_MINIMA = 90;

export default function Home() {
  const [
    periodoActual,
    setPeriodoActual,
  ] = useState(() =>
    obtenerPeriodo(
      new Date(),
    ),
  );

  const [
    mesSeleccionado,
    setMesSeleccionado,
  ] = useState(() =>
    obtenerPeriodo(
      new Date(),
    ),
  );

  const [
    quincenaSeleccionada,
    setQuincenaSeleccionada,
  ] = useState<Quincena>(
    () =>
      obtenerQuincena(
        new Date(),
      ),
  );

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
    compromisoSeleccionado,
    setCompromisoSeleccionado,
  ] =
    useState<CompromisoFijo | null>(
      null,
    );

  const periodoActualRef =
    useRef(
      periodoActual,
    );

  const presupuesto =
    useBudgetData();

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

  /**
   * Estas alertas se muestran únicamente dentro de la
   * interfaz. Las notificaciones del sistema son manejadas
   * por Firebase Cloud Messaging.
   */
  const alertasVisuales =
    useMemo<
      AlertaPresupuesto[]
    >(() => {
      const alertas:
        AlertaPresupuesto[] =
        [];

      resumen
        .resumenCategorias
        .forEach(
          (
            categoria,
          ) => {
            const configuracion =
              CATEGORIAS_VARIABLES[
                categoria.key
              ];

            const limite =
              presupuesto
                .limites[
                categoria.key
              ];

            if (
              categoria
                .porcentajeMes >=
              ALERTA_MINIMA
            ) {
              const excedido =
                categoria
                  .porcentajeMes >=
                100;

              alertas.push({
                id: `${categoria.key}-mensual`,

                categoria:
                  categoria.key,

                tipo:
                  "mensual",

                nivel:
                  excedido
                    ? "excedido"
                    : "advertencia",

                porcentaje:
                  categoria
                    .porcentajeMes,

                saldo:
                  categoria
                    .saldoMes,

                limite:
                  limite.mensual,

                titulo:
                  excedido
                    ? `${configuracion.label}: límite excedido`
                    : `${configuracion.label}: alerta del 90%`,

                mensaje:
                  excedido
                    ? `El saldo de ${formatoMoneda.format(
                        categoria.saldoMes,
                      )} superó el límite mensual de ${formatoMoneda.format(
                        limite.mensual,
                      )}.`
                    : `Has utilizado ${categoria.porcentajeMes.toFixed(
                        0,
                      )}% del límite mensual. Quedan ${formatoMoneda.format(
                        Math.max(
                          limite.mensual -
                            categoria.saldoMes,
                          0,
                        ),
                      )} disponibles.`,
              });
            }

            if (
              categoria
                .porcentajeQuincena >=
              ALERTA_MINIMA
            ) {
              const excedido =
                categoria
                  .porcentajeQuincena >=
                100;

              const nombreQuincena =
                quincenaSeleccionada ===
                1
                  ? "primera"
                  : "segunda";

              alertas.push({
                id: `${categoria.key}-quincenal`,

                categoria:
                  categoria.key,

                tipo:
                  "quincenal",

                nivel:
                  excedido
                    ? "excedido"
                    : "advertencia",

                porcentaje:
                  categoria
                    .porcentajeQuincena,

                saldo:
                  categoria
                    .saldoQuincena,

                limite:
                  limite.quincenal,

                titulo:
                  excedido
                    ? `${configuracion.label}: límite excedido`
                    : `${configuracion.label}: alerta del 90%`,

                mensaje:
                  excedido
                    ? `El saldo de ${formatoMoneda.format(
                        categoria.saldoQuincena,
                      )} superó el límite de la ${nombreQuincena} quincena de ${formatoMoneda.format(
                        limite.quincenal,
                      )}.`
                    : `Has utilizado ${categoria.porcentajeQuincena.toFixed(
                        0,
                      )}% del límite de la ${nombreQuincena} quincena. Quedan ${formatoMoneda.format(
                        Math.max(
                          limite.quincenal -
                            categoria.saldoQuincena,
                          0,
                        ),
                      )} disponibles.`,
              });
            }
          },
        );

      return alertas.sort(
        (a, b) => {
          if (
            a.nivel !==
            b.nivel
          ) {
            return a.nivel ===
              "excedido"
              ? -1
              : 1;
          }

          return (
            b.porcentaje -
            a.porcentaje
          );
        },
      );
    }, [
      presupuesto.limites,
      quincenaSeleccionada,
      resumen.resumenCategorias,
    ]);

  /*
   * Si la aplicación permanece abierta cuando empieza
   * un nuevo mes, cambia automáticamente al período nuevo.
   */
  useEffect(() => {
    const sincronizarPeriodo =
      () => {
        const ahora =
          new Date();

        const nuevoPeriodo =
          obtenerPeriodo(
            ahora,
          );

        if (
          periodoActualRef
            .current ===
          nuevoPeriodo
        ) {
          return;
        }

        periodoActualRef.current =
          nuevoPeriodo;

        setPeriodoActual(
          nuevoPeriodo,
        );

        setMesSeleccionado(
          nuevoPeriodo,
        );

        setQuincenaSeleccionada(
          obtenerQuincena(
            ahora,
          ),
        );
      };

    sincronizarPeriodo();

    const intervalId =
      window.setInterval(
        sincronizarPeriodo,
        60_000,
      );

    const sincronizarAlRegresar =
      () => {
        if (
          document
            .visibilityState ===
          "visible"
        ) {
          sincronizarPeriodo();
        }
      };

    document.addEventListener(
      "visibilitychange",
      sincronizarAlRegresar,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      document.removeEventListener(
        "visibilitychange",
        sincronizarAlRegresar,
      );
    };
  }, []);

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
              presupuesto.error
            }
            alertas={
              alertasVisuales
            }
            onCerrarError={
              presupuesto
                .limpiarError
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
    </main>
  );
}

function LoadingState() {
  return (
    <div
      role="status"
      className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"
    >
      <LoaderCircle className="h-7 w-7 animate-spin text-indigo-600" />

      <p className="mt-3 text-sm font-black text-slate-800">
        Cargando presupuesto...
      </p>

      <p className="mt-1 text-xs font-medium text-slate-500">
        Consultando gastos, pagos y límites en
        Firestore.
      </p>
    </div>
  );
}