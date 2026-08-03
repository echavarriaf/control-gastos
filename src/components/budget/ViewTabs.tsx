"use client";

/*
 * Nombre: Navegación de vistas del presupuesto
 * Ruta: src/components/budget/ViewTabs.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-08-02
 *
 * Descripción:
 * Presenta las pestañas principales de la aplicación y permite
 * cambiar entre gastos fijos, movimientos variables y tarjetas.
 * Cada pestaña comunica la vista seleccionada al dashboard sin
 * recargar la página.
 */

import {
  CreditCard,
  ListChecks,
  WalletCards,
} from "lucide-react";

import type {
  Vista,
} from "@/lib/budget/types";
import TabButton from "../TabButton";

interface ViewTabsProps {
  vistaActual:
    Vista;

  onCambiarVista: (
    vista:
      Vista,
  ) => void;
}

/**
 * Renderiza la navegación principal del presupuesto.
 *
 * Compara cada valor de vista con vistaActual para resaltar la
 * pestaña activa. Cuando el usuario pulsa una pestaña, delega el
 * cambio de vista mediante onCambiarVista.
 */
export function ViewTabs({
  vistaActual,
  onCambiarVista,
}: ViewTabsProps) {
  return (
    <nav
      aria-label="Vistas del presupuesto"
      className="rounded-2xl bg-slate-100 p-1"
    >
      <div
        role="tablist"
        aria-label="Contenido del presupuesto"
        className="grid grid-cols-3 gap-1"
      >
        <TabButton
          vista="fijos"
          label="Gastos fijos"
          icon={ListChecks}
          seleccionada={
            vistaActual ===
            "fijos"
          }
          onSelect={
            onCambiarVista
          }
        />

        <TabButton
          vista="movimientos"
          label="Comida y Gas"
          icon={WalletCards}
          seleccionada={
            vistaActual ===
            "movimientos"
          }
          onSelect={
            onCambiarVista
          }
        />

        <TabButton
          vista="tarjetas"
          label="Tarjetas"
          icon={CreditCard}
          seleccionada={
            vistaActual ===
            "tarjetas"
          }
          onSelect={
            onCambiarVista
          }
        />
      </div>
    </nav>
  );
}

