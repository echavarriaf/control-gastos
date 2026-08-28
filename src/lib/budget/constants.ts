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

/**
 * ============================================================
 * CATEGORÍAS VARIABLES
 * ============================================================
 */

export const CATEGORIAS_VARIABLES = {
  comida: {
    label:
      "Comida",

    icon:
      Utensils,

    color:
      "bg-amber-500",

    text:
      "text-amber-700",

    light:
      "bg-amber-50",

    border:
      "border-amber-200",
  },

  gas: {
    label:
      "Gas",

    icon:
      Car,

    color:
      "bg-blue-500",

    text:
      "text-blue-700",

    light:
      "bg-blue-50",

    border:
      "border-blue-200",
  },
} as const;

/**
 * ============================================================
 * LÍMITES PREDETERMINADOS
 * ============================================================
 *
 * IMPORTANTE:
 *
 * Estos valores representan una cuenta NUEVA que todavía
 * no ha configurado su presupuesto.
 *
 * No deben contener valores personales de ningún usuario.
 *
 * Los límites reales se cargan desde:
 *
 * users/{uid}/configuracion/presupuestoFelo
 */

export const LIMITES_PREDETERMINADOS:
  LimitesVariables = {
    comida: {
      mensual:
        0,

      quincenal:
        0,
    },

    gas: {
      mensual:
        0,

      quincenal:
        0,
    },
  };

/**
 * ============================================================
 * COMPROMISOS FIJOS LEGACY
 * ============================================================
 *
 * Esta lista NO representa los gastos fijos iniciales de
 * usuarios nuevos.
 *
 * Los compromisos reales deben obtenerse desde:
 *
 * users/{uid}/compromisosFijos
 *
 * La lista permanece temporalmente para compatibilidad con
 * registros históricos, principalmente para resolver nombres
 * antiguos de pagos que todavía contienen compromisoId.
 *
 * Debido a que CompromisoFijo ahora posee más propiedades que
 * la versión original, se incluyen valores neutrales para los
 * campos que no existían en el modelo legacy.
 *
 * Estos valores NO se escriben automáticamente en Firestore.
 */

export const COMPROMISOS_FIJOS:
  CompromisoFijo[] = [
    {
      id:
        "iul-kids",

      descripcion:
        "IUL kids",

      monto:
        65,

      diaVencimiento:
        1,

      quincenaPresupuestaria:
        1,

      prioridad:
        2,

      metodoPagoPreferido:
        "transferencia",

      tarjetaId:
        null,

      activo:
        true,
    },

    {
      id:
        "prestamo-amex",

      descripcion:
        "Préstamo Felo AMEX",

      monto:
        145,

      diaVencimiento:
        1,

      quincenaPresupuestaria:
        1,

      prioridad:
        2,

      metodoPagoPreferido:
        "transferencia",

      tarjetaId:
        null,

      activo:
        true,
    },

    {
      id:
        "vehiculo-2",

      descripcion:
        "Vehículo 2 (F)",

      monto:
        555,

      diaVencimiento:
        1,

      quincenaPresupuestaria:
        1,

      prioridad:
        2,

      metodoPagoPreferido:
        "transferencia",

      tarjetaId:
        null,

      activo:
        true,
    },

    {
      id:
        "ahorro-comun",

      descripcion:
        "Ahorro común",

      monto:
        200,

      diaVencimiento:
        1,

      quincenaPresupuestaria:
        1,

      prioridad:
        2,

      metodoPagoPreferido:
        "transferencia",

      tarjetaId:
        null,

      activo:
        true,
    },

    {
      id:
        "ayuda-maria",

      descripcion:
        "Ayuda María Casa",

      monto:
        60,

      diaVencimiento:
        1,

      quincenaPresupuestaria:
        1,

      prioridad:
        2,

      metodoPagoPreferido:
        "transferencia",

      tarjetaId:
        null,

      activo:
        true,
    },

    {
      id:
        "celular",

      descripcion:
        "Celular",

      monto:
        25,

      diaVencimiento:
        1,

      quincenaPresupuestaria:
        1,

      prioridad:
        2,

      metodoPagoPreferido:
        "transferencia",

      tarjetaId:
        null,

      activo:
        true,
    },

    {
      id:
        "solar-tia-mise",

      descripcion:
        "Solar Tía Mise / AMEX F. Mariel",

      monto:
        150,

      diaVencimiento:
        1,

      quincenaPresupuestaria:
        1,

      prioridad:
        2,

      metodoPagoPreferido:
        "transferencia",

      tarjetaId:
        null,

      activo:
        true,
    },

    {
      id:
        "iul-ea",

      descripcion:
        "IUL E/A",

      monto:
        300,

      diaVencimiento:
        1,

      quincenaPresupuestaria:
        1,

      prioridad:
        2,

      metodoPagoPreferido:
        "transferencia",

      tarjetaId:
        null,

      activo:
        true,
    },
  ];

/**
 * ============================================================
 * MÉTODOS DE PAGO
 * ============================================================
 */

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

/**
 * ============================================================
 * CLAVES DE CATEGORÍAS
 * ============================================================
 */

export const CATEGORIA_KEYS =
  Object.keys(
    CATEGORIAS_VARIABLES,
  ) as CategoriaVariable[];