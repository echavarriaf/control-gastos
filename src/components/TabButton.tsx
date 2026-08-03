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

import type {
  LucideIcon,
} from "lucide-react";

import type {
  Vista,
} from "@/lib/budget/types";

interface TabButtonProps {
  vista:
    Vista;

  label:
    string;

  icon:
    LucideIcon;

  seleccionada:
    boolean;

  onSelect: (
    vista:
      Vista,
  ) => void;
}

/**
 * Renderiza una pestaña reutilizable.
 *
 * Recibe la vista que representa y llama onSelect con ese valor.
 * El estado seleccionada cambia sus estilos y aria-selected para
 * mantener la interfaz visualmente clara y accesible.
 */
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
      aria-selected={
        seleccionada
      }
      onClick={() =>
        onSelect(vista)
      }
      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-black transition active:scale-[0.98] sm:gap-2 sm:px-3 sm:text-xs ${
        seleccionada
          ? "bg-white text-indigo-700 shadow-sm"
          : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
      }`}
    >
      <Icono
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
      />

      <span className="truncate">
        {label}
      </span>
    </button>
  );
}

export default TabButton