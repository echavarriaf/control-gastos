"use client";

import {
  ListChecks,
  WalletCards,
} from "lucide-react";

import type { Vista } from "@/lib/budget/types";

interface ViewTabsProps {
  vistaActual: Vista;
  onCambiarVista: (vista: Vista) => void;
}

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
        className="grid grid-cols-2 gap-1"
      >
        <TabButton
          vista="fijos"
          label="Gastos fijos"
          icon={ListChecks}
          seleccionada={vistaActual === "fijos"}
          onSelect={onCambiarVista}
        />

        <TabButton
          vista="movimientos"
          label="Comida y Gas"
          icon={WalletCards}
          seleccionada={
            vistaActual === "movimientos"
          }
          onSelect={onCambiarVista}
        />
      </div>
    </nav>
  );
}

interface TabButtonProps {
  vista: Vista;
  label: string;
  icon: typeof ListChecks;
  seleccionada: boolean;
  onSelect: (vista: Vista) => void;
}

function TabButton({
  vista,
  label,
  icon: Icono,
  seleccionada,
  onSelect,
}: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={seleccionada}
      onClick={() => onSelect(vista)}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition active:scale-[0.98] ${
        seleccionada
          ? "bg-white text-indigo-700 shadow-sm"
          : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
      }`}
    >
      <Icono
        aria-hidden="true"
        className="h-4 w-4"
      />

      <span>{label}</span>
    </button>
  );
}