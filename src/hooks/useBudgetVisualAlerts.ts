"use client";

import { useMemo } from "react";

import type {
    AlertaPresupuesto,
} from "@/hooks/useBudgetNotifications";

import {
    CATEGORIAS_VARIABLES,
} from "@/lib/budget/constants";

import type {
    LimitesVariables,
    Quincena,
    ResumenCategoria,
} from "@/lib/budget/types";

import {
    formatoMoneda,
} from "@/lib/budget/utils";

const ALERTA_MINIMA = 90;

interface UseBudgetVisualAlertsParams {
    resumenCategorias: ResumenCategoria[];
    limites: LimitesVariables;
    quincenaSeleccionada: Quincena;
}

/**
 * Construye las alertas que se muestran dentro de la interfaz.
 *
 * Las notificaciones del sistema continúan siendo manejadas
 * por Firebase Cloud Messaging.
 */
export function useBudgetVisualAlerts({
    resumenCategorias,
    limites,
    quincenaSeleccionada,
}: UseBudgetVisualAlertsParams): AlertaPresupuesto[] {
    return useMemo(() => {
        const alertas: AlertaPresupuesto[] = [];

        resumenCategorias.forEach((categoria) => {
            const configuracion =
                CATEGORIAS_VARIABLES[categoria.key];

            const limite =
                limites[categoria.key];

            if (
                categoria.porcentajeMes >=
                ALERTA_MINIMA
            ) {
                const excedido =
                    categoria.porcentajeMes >= 100;

                alertas.push({
                    id:
                        `${categoria.key}-mensual`,

                    categoria:
                        categoria.key,

                    tipo:
                        "mensual",

                    nivel:
                        excedido
                            ? "excedido"
                            : "advertencia",

                    porcentaje:
                        categoria.porcentajeMes,

                    saldo:
                        categoria.saldoMes,

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
                categoria.porcentajeQuincena >=
                ALERTA_MINIMA
            ) {
                const excedido =
                    categoria.porcentajeQuincena >=
                    100;

                const nombreQuincena =
                    quincenaSeleccionada === 1
                        ? "primera"
                        : "segunda";

                alertas.push({
                    id:
                        `${categoria.key}-quincenal`,

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
                        categoria.saldoQuincena,

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
        });

        return alertas.sort((a, b) => {
            if (a.nivel !== b.nivel) {
                return a.nivel === "excedido"
                    ? -1
                    : 1;
            }

            return (
                b.porcentaje -
                a.porcentaje
            );
        });
    }, [
        limites,
        quincenaSeleccionada,
        resumenCategorias,
    ]);
}
