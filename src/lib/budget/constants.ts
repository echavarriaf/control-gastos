import {
  Car,
  Utensils,
} from "lucide-react";

import type {
  CategoriaVariable,
  CompromisoFijo,
  LimitesVariables,
  MetodoPagoFijo,
} from "./types";

export const CATEGORIAS_VARIABLES = {
  comida: {
    label: "Comida",
    icon: Utensils,
    color: "bg-amber-500",
    text: "text-amber-700",
    light: "bg-amber-50",
    border: "border-amber-200",
  },

  gas: {
    label: "Gas",
    icon: Car,
    color: "bg-blue-500",
    text: "text-blue-700",
    light: "bg-blue-50",
    border: "border-blue-200",
  },
} as const;

export const LIMITES_PREDETERMINADOS:
  LimitesVariables = {
    comida: {
      mensual: 1200,
      quincenal: 600,
    },

    gas: {
      mensual: 200,
      quincenal: 100,
    },
  };

/**
 * Configuración inicial utilizada mientras los gastos fijos
 * se migran a Firestore.
 *
 * Los días y quincenas son valores iniciales editables.
 * En los próximos pasos se reemplazará esta lista estática
 * por gastos fijos administrados desde la aplicación.
 */
export const COMPROMISOS_FIJOS:
  CompromisoFijo[] = [
    {
      id: "iul-kids",
      descripcion: "IUL kids",
      monto: 65,
      diaVencimiento: 1,
      quincenaPresupuestaria: 1,
      prioridad: 2,
      metodoPagoPreferido:
        "transferencia",
      tarjetaId: null,
      activo: true,
    },

    {
      id: "prestamo-amex",
      descripcion:
        "Préstamo Felo AMEX",
      monto: 145,
      diaVencimiento: 5,
      quincenaPresupuestaria: 1,
      prioridad: 1,
      metodoPagoPreferido:
        "transferencia",
      tarjetaId: null,
      activo: true,
    },

    {
      id: "vehiculo-2",
      descripcion:
        "Vehículo 2 (F)",
      monto: 555,
      diaVencimiento: 10,
      quincenaPresupuestaria: 1,
      prioridad: 1,
      metodoPagoPreferido:
        "transferencia",
      tarjetaId: null,
      activo: true,
    },

    {
      id: "celular",
      descripcion: "Celular",
      monto: 25,
      diaVencimiento: 15,
      quincenaPresupuestaria: 1,
      prioridad: 2,
      metodoPagoPreferido:
        "transferencia",
      tarjetaId: null,
      activo: true,
    },

    {
      id: "ahorro-comun",
      descripcion: "Ahorro común",
      monto: 200,
      diaVencimiento: 16,
      quincenaPresupuestaria: 2,
      prioridad: 3,
      metodoPagoPreferido:
        "transferencia",
      tarjetaId: null,
      activo: true,
    },

    {
      id: "ayuda-maria",
      descripcion:
        "Ayuda María Casa",
      monto: 60,
      diaVencimiento: 20,
      quincenaPresupuestaria: 2,
      prioridad: 2,
      metodoPagoPreferido:
        "transferencia",
      tarjetaId: null,
      activo: true,
    },

    {
      id: "solar-tia-mise",
      descripcion:
        "Solar Tía Mise / AMEX F. Mariel",
      monto: 150,
      diaVencimiento: 25,
      quincenaPresupuestaria: 2,
      prioridad: 2,
      metodoPagoPreferido:
        "transferencia",
      tarjetaId: null,
      activo: true,
    },

    {
      id: "iul-ea",
      descripcion: "IUL E/A",
      monto: 300,
      diaVencimiento: 28,
      quincenaPresupuestaria: 2,
      prioridad: 2,
      metodoPagoPreferido:
        "transferencia",
      tarjetaId: null,
      activo: true,
    },
  ];

export const METODOS_PAGO:
  Record<
    MetodoPagoFijo,
    string
  > = {
    debito_automatico:
      "Débito automático",

    transferencia:
      "Transferencia",

    tarjeta:
      "Tarjeta",

    efectivo:
      "Efectivo",

    otro:
      "Otro",
  };

export const CATEGORIA_KEYS =
  Object.keys(
    CATEGORIAS_VARIABLES,
  ) as CategoriaVariable[];

  export const INPUT_CLASS =
  "min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60";