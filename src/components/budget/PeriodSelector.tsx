"use client";

import { CalendarDays } from "lucide-react";

import type { Quincena } from "@/lib/budget/types";
import { etiquetaMes } from "@/lib/budget/utils";

interface PeriodSelectorProps {
  mesesDisponibles: string[];
  mesSeleccionado: string;
  quincenaSeleccionada: Quincena;
  onCambiarMes: (periodo: string) => void;
  onCambiarQuincena: (quincena: Quincena) => void;
}

export function PeriodSelector({
  mesesDisponibles,
  mesSeleccionado,
  quincenaSeleccionada,
  onCambiarMes,
  onCambiarQuincena,
}: PeriodSelectorProps) {
  return (
    <section className="border-b border-slate-100 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label
            htmlFor="periodo-presupuesto"
            className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"
          >
            Mes del presupuesto
          </label>

          <div className="relative">
            <CalendarDays
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />

            <select
              id="periodo-presupuesto"
              value={mesSeleccionado}
              onChange={(event) =>
                onCambiarMes(event.target.value)
              }
              className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            >
              {mesesDisponibles.map((periodo) => (
                <option
                  key={periodo}
                  value={periodo}
                >
                  {etiquetaMes(periodo)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Quincena
          </p>

          <div
            className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1"
            role="group"
            aria-label="Seleccionar quincena"
          >
            <QuincenaButton
              quincena={1}
              seleccionada={
                quincenaSeleccionada === 1
              }
              onSelect={onCambiarQuincena}
            />

            <QuincenaButton
              quincena={2}
              seleccionada={
                quincenaSeleccionada === 2
              }
              onSelect={onCambiarQuincena}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

interface QuincenaButtonProps {
  quincena: Quincena;
  seleccionada: boolean;
  onSelect: (quincena: Quincena) => void;
}

function QuincenaButton({
  quincena,
  seleccionada,
  onSelect,
}: QuincenaButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(quincena)}
      aria-pressed={seleccionada}
      className={`min-w-28 rounded-xl px-4 py-2.5 text-xs font-black transition active:scale-95 ${
        seleccionada
          ? "bg-white text-indigo-700 shadow-sm"
          : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {quincena === 1 ? "1–15" : "16–fin"}
    </button>
  );
}