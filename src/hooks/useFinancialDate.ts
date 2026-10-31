"use client";

import { useEffect, useState } from "react";
import { fechaInputLocal } from "@/lib/budget/utils";

/** Refresh the pay cycle at midnight and when returning to a suspended tab. */
export function useFinancialDate(): string {
  const [fecha, setFecha] = useState(() => fechaInputLocal());
  useEffect(() => {
    const actualizar = () => setFecha(fechaInputLocal());
    const regresar = () => { if (document.visibilityState === "visible") actualizar(); };
    const interval = window.setInterval(actualizar, 60_000);
    document.addEventListener("visibilitychange", regresar);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", regresar);
    };
  }, []);
  return fecha;
}
