"use client";

// Hook React: reloj financiero, memoización y totales de tarjetas. Cálculos en lib/budget/credit-cards.
import { useEffect, useMemo, useState } from "react";
import type { UseCreditCardSummariesParams } from "@/lib/budget/credit-cards/types";
import { crearResumenTarjetas } from "@/lib/budget/credit-cards/aggregate";

/**
 * Mantiene actualizado el día financiero.
 */
function useFechaFinancieraActual(): Date {
  const [
    fecha,
    setFecha,
  ] =
    useState<Date>(
      () =>
        new Date(),
    );

  useEffect(
    () => {
      const intervalId =
        window.setInterval(
          () => {
            setFecha(
              new Date(),
            );
          },
          60_000,
        );

      return () => {
        window.clearInterval(
          intervalId,
        );
      };
    },
    [],
  );

  return fecha;
}

/**
 * Hook público.
 */
export function useCreditCardSummaries({ tarjetas, gastos, pagosFijos, pagos }: UseCreditCardSummariesParams) {
  const fechaReferencia = useFechaFinancieraActual();
  return useMemo(
    () => crearResumenTarjetas({ tarjetas, gastos, pagosFijos, pagos }, fechaReferencia),
    [tarjetas, gastos, pagosFijos, pagos, fechaReferencia],
  );
}

export type CreditCardSummariesController =
  ReturnType<
    typeof useCreditCardSummaries
  >;
export type { PagoPrincipalCorteDetectado, ResumenTarjetaActual } from "@/lib/budget/credit-cards/types";
export { clasificarTransaccionesTarjeta, crearResumenTarjeta } from "@/lib/budget/credit-cards/summary";
