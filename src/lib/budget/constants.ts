import { Car, Utensils } from "lucide-react";

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

export const LIMITES_PREDETERMINADOS: LimitesVariables = {
  comida: {
    mensual: 1200,
    quincenal: 600,
  },
  gas: {
    mensual: 200,
    quincenal: 100,
  },
};

export const COMPROMISOS_FIJOS: CompromisoFijo[] = [
  {
    id: "iul-kids",
    descripcion: "IUL kids",
    monto: 65,
  },
  {
    id: "prestamo-amex",
    descripcion: "Préstamo Felo AMEX",
    monto: 145,
  },
  {
    id: "vehiculo-2",
    descripcion: "Vehículo 2 (F)",
    monto: 555,
  },
  {
    id: "ahorro-comun",
    descripcion: "Ahorro común",
    monto: 200,
  },
  {
    id: "ayuda-maria",
    descripcion: "Ayuda María Casa",
    monto: 60,
  },
  {
    id: "celular",
    descripcion: "Celular",
    monto: 25,
  },
  {
    id: "solar-tia-mise",
    descripcion: "Solar Tía Mise / AMEX F. Mariel",
    monto: 150,
  },
  {
    id: "iul-ea",
    descripcion: "IUL E/A",
    monto: 300,
  },
];

export const METODOS_PAGO: Record<MetodoPagoFijo, string> = {
  debito_automatico: "Débito automático",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  otro: "Otro",
};

export const CATEGORIA_KEYS = Object.keys(
  CATEGORIAS_VARIABLES,
) as CategoriaVariable[];