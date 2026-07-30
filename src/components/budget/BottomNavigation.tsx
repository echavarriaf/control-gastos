"use client";

import {
  ListChecks,
  WalletCards,
} from "lucide-react";

import type { Vista } from "@/lib/budget/types";

interface BottomNavigationProps {
  vistaActual: Vista;
  onCambiarVista: (vista: Vista) => void;
}

export function BottomNavigation({
  vistaActual,
  onCambiarVista,
}: BottomNavigationProps) {
  return (
    <nav
      aria-label="Navegación inferior"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
        <NavigationButton
          vista="fijos"
          label="Gastos fijos"
          icon={ListChecks}
          seleccionada={
            vistaActual === "fijos"
          }
          onSelect={onCambiarVista}
        />

        <NavigationButton
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

interface NavigationButtonProps {
  vista: Vista;
  label: string;
  icon: typeof ListChecks;
  seleccionada: boolean;
  onSelect: (vista: Vista) => void;
}

function NavigationButton({
  vista,
  label,
  icon: Icono,
  seleccionada,
  onSelect,
}: NavigationButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(vista)}
      aria-current={
        seleccionada ? "page" : undefined
      }
      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[10px] font-black transition active:scale-[0.98] ${
        seleccionada
          ? "bg-indigo-50 text-indigo-700"
          : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
      }`}
    >
      <Icono
        aria-hidden="true"
        className={`h-5 w-5 ${
          seleccionada
            ? "stroke-[2.5]"
            : ""
        }`}
      />

      <span>{label}</span>
    </button>
  );
}