"use client";

import {
  useMemo,
} from "react";

import type {
  AlertaPresupuesto,
} from "@/hooks/useBudgetNotifications";

import {
  CATEGORIAS_VARIABLES,
} from "@/lib/budget/constants";

import type {
  ResumenCategoriaConCarryOver,
} from "@/lib/budget/carry-over";

import type {
  LimitesVariables,
  Quincena,
} from "@/lib/budget/types";

import {
  formatoMoneda,
} from "@/lib/budget/utils";

const ALERTA_MINIMA =
  90;

interface UseBudgetVisualAlertsParams {
  resumenCategorias:
    ResumenCategoriaConCarryOver[];

  limites:
    LimitesVariables;

  quincenaSeleccionada:
    Quincena;
}

/**
 * Construye las alertas que se muestran dentro de la interfaz.
 *
 * Las alertas quincenales usan:
 *
 * consumo ajustado =
 * carry anterior + gasto de la quincena.
 *
 * Así el progreso y el disponible reflejan exactamente
 * el presupuesto efectivo después del arrastre.
 */
export function useBudgetVisualAlerts({
  resumenCategorias,
  limites,
  quincenaSeleccionada,
}: UseBudgetVisualAlertsParams): AlertaPresupuesto[] {
  return useMemo(
    () => {
      const alertas:
        AlertaPresupuesto[] =
        [];

      resumenCategorias.forEach(
        (categoria) => {
          const configuracion =
            CATEGORIAS_VARIABLES[
              categoria.key
            ];

          const limite =
            limites[
              categoria.key
            ];

          /*
           * ====================================================
           * ALERTA MENSUAL
           * ====================================================
           */
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
                      categoria
                        .saldoMes,
                    )} superó el límite mensual de ${formatoMoneda.format(
                      limite
                        .mensual,
                    )}.`
                  : `Has utilizado ${categoria.porcentajeMes.toFixed(
                      0,
                    )}% del límite mensual. Quedan ${formatoMoneda.format(
                      Math.max(
                        limite
                          .mensual -
                          categoria
                            .saldoMes,
                        0,
                      ),
                    )} disponibles.`,
            });
          }

          /*
           * ====================================================
           * ALERTA QUINCENAL CON CARRY
           * ====================================================
           */
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

            const tieneArrastre =
              categoria
                .excedenteAnterior >
              0;

            const mensaje =
              construirMensajeQuincenal({
                label:
                  configuracion
                    .label,

                nombreQuincena,

                excedido,

                tieneArrastre,

                porcentaje:
                  categoria
                    .porcentajeQuincena,

                saldoActual:
                  categoria
                    .saldoQuincena,

                consumoAjustado:
                  categoria
                    .consumoAjustadoQuincena,

                limiteBase:
                  categoria
                    .limiteQuincenalBase,

                limiteEfectivo:
                  categoria
                    .limiteQuincenalEfectivo,

                disponible:
                  categoria
                    .disponibleQuincena,

                excedenteAnterior:
                  categoria
                    .excedenteAnterior,

                excedenteSiguiente:
                  categoria
                    .excedenteSiguiente,
              });

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

              /*
               * Para la alerta, saldo representa el consumo total
               * comprometido de la quincena:
               *
               * carry anterior + gasto actual.
               */
              saldo:
                categoria
                  .consumoAjustadoQuincena,

              limite:
                categoria
                  .limiteQuincenalBase,

              titulo:
                excedido
                  ? `${configuracion.label}: límite excedido`
                  : `${configuracion.label}: alerta del 90%`,

              mensaje,
            });
          }
        },
      );

      return alertas.sort(
        (
          a,
          b,
        ) => {
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
    },
    [
      limites,
      quincenaSeleccionada,
      resumenCategorias,
    ],
  );
}

interface ConstruirMensajeQuincenalArgs {
  label:
    string;

  nombreQuincena:
    string;

  excedido:
    boolean;

  tieneArrastre:
    boolean;

  porcentaje:
    number;

  saldoActual:
    number;

  consumoAjustado:
    number;

  limiteBase:
    number;

  limiteEfectivo:
    number;

  disponible:
    number;

  excedenteAnterior:
    number;

  excedenteSiguiente:
    number;
}

function construirMensajeQuincenal({
  label,
  nombreQuincena,
  excedido,
  tieneArrastre,
  porcentaje,
  saldoActual,
  consumoAjustado,
  limiteBase,
  limiteEfectivo,
  disponible,
  excedenteAnterior,
  excedenteSiguiente,
}: ConstruirMensajeQuincenalArgs): string {
  if (
    excedido &&
    tieneArrastre
  ) {
    return `Arrastras ${formatoMoneda.format(
      excedenteAnterior,
    )} y gastaste ${formatoMoneda.format(
      saldoActual,
    )} en la ${nombreQuincena} quincena. El total comprometido es ${formatoMoneda.format(
      consumoAjustado,
    )} sobre un límite base de ${formatoMoneda.format(
      limiteBase,
    )}. Pasan ${formatoMoneda.format(
      excedenteSiguiente,
    )} a la próxima quincena.`;
  }

  if (excedido) {
    return `El gasto de ${formatoMoneda.format(
      saldoActual,
    )} superó el límite de la ${nombreQuincena} quincena de ${formatoMoneda.format(
      limiteBase,
    )}. Pasan ${formatoMoneda.format(
      excedenteSiguiente,
    )} a la próxima quincena.`;
  }

  if (tieneArrastre) {
    return `Arrastras ${formatoMoneda.format(
      excedenteAnterior,
    )}. El límite efectivo de ${label} para la ${nombreQuincena} quincena es ${formatoMoneda.format(
      limiteEfectivo,
    )}. Has gastado ${formatoMoneda.format(
      saldoActual,
    )} y quedan ${formatoMoneda.format(
      disponible,
    )}.`;
  }

  return `Has utilizado ${porcentaje.toFixed(
    0,
  )}% del límite de la ${nombreQuincena} quincena. Quedan ${formatoMoneda.format(
    disponible,
  )} disponibles.`;
}