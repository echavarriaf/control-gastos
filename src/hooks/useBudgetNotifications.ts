"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CATEGORIAS_VARIABLES } from "@/lib/budget/constants";

import type {
  CategoriaVariable,
  LimitesVariables,
  Quincena,
  ResumenCategoria,
} from "@/lib/budget/types";

import {
  formatoMoneda,
  obtenerQuincena,
} from "@/lib/budget/utils";

export type EstadoPermisoNotificacion =
  | NotificationPermission
  | "no_soportado";

export type TipoAlertaPresupuesto =
  | "mensual"
  | "quincenal";

export type NivelAlertaPresupuesto =
  | "advertencia"
  | "excedido";

export interface AlertaPresupuesto {
  id: string;
  categoria: CategoriaVariable;
  tipo: TipoAlertaPresupuesto;
  nivel: NivelAlertaPresupuesto;
  porcentaje: number;
  saldo: number;
  limite: number;
  titulo: string;
  mensaje: string;
}

interface UseBudgetNotificationsArgs {
  resumenCategorias: ResumenCategoria[];
  limites: LimitesVariables;
  mesSeleccionado: string;
  periodoActual: string;
  quincenaSeleccionada: Quincena;
}

const ALERTA_MINIMA = 90;
const PREFIJO_STORAGE =
  "presupuesto-felo-alerta";

function crearAlerta({
  categoria,
  tipo,
  porcentaje,
  saldo,
  limite,
  quincena,
}: {
  categoria: CategoriaVariable;
  tipo: TipoAlertaPresupuesto;
  porcentaje: number;
  saldo: number;
  limite: number;
  quincena?: Quincena;
}): AlertaPresupuesto {
  const configuracion =
    CATEGORIAS_VARIABLES[categoria];

  const nivel: NivelAlertaPresupuesto =
    porcentaje >= 100
      ? "excedido"
      : "advertencia";

  const periodoTexto =
    tipo === "mensual"
      ? "límite mensual"
      : `límite de la ${
          quincena === 1
            ? "primera"
            : "segunda"
        } quincena`;

  const titulo =
    nivel === "excedido"
      ? `${configuracion.label}: límite excedido`
      : `${configuracion.label}: alerta del 90%`;

  const mensaje =
    nivel === "excedido"
      ? `El saldo de ${formatoMoneda.format(
          saldo,
        )} superó el ${periodoTexto} de ${formatoMoneda.format(
          limite,
        )}.`
      : `Has utilizado ${porcentaje.toFixed(
          0,
        )}% del ${periodoTexto}. Quedan ${formatoMoneda.format(
          Math.max(limite - saldo, 0),
        )} disponibles.`;

  return {
    id: `${categoria}-${tipo}`,
    categoria,
    tipo,
    nivel,
    porcentaje,
    saldo,
    limite,
    titulo,
    mensaje,
  };
}

export function useBudgetNotifications({
  resumenCategorias,
  limites,
  mesSeleccionado,
  periodoActual,
  quincenaSeleccionada,
}: UseBudgetNotificationsArgs) {
  const [permiso, setPermiso] =
    useState<EstadoPermisoNotificacion>(
      "default",
    );

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermiso("no_soportado");
      return;
    }

    setPermiso(Notification.permission);
  }, []);

  const alertasActivas = useMemo(() => {
    const alertas: AlertaPresupuesto[] = [];

    resumenCategorias.forEach((resumen) => {
      const limiteCategoria =
        limites[resumen.key];

      if (
        resumen.porcentajeMes >= ALERTA_MINIMA
      ) {
        alertas.push(
          crearAlerta({
            categoria: resumen.key,
            tipo: "mensual",
            porcentaje:
              resumen.porcentajeMes,
            saldo: resumen.saldoMes,
            limite:
              limiteCategoria.mensual,
          }),
        );
      }

      if (
        resumen.porcentajeQuincena >=
        ALERTA_MINIMA
      ) {
        alertas.push(
          crearAlerta({
            categoria: resumen.key,
            tipo: "quincenal",
            porcentaje:
              resumen.porcentajeQuincena,
            saldo:
              resumen.saldoQuincena,
            limite:
              limiteCategoria.quincenal,
            quincena:
              quincenaSeleccionada,
          }),
        );
      }
    });

    return alertas.sort((a, b) => {
      if (a.nivel !== b.nivel) {
        return a.nivel === "excedido"
          ? -1
          : 1;
      }

      return b.porcentaje - a.porcentaje;
    });
  }, [
    limites,
    resumenCategorias,
    quincenaSeleccionada,
  ]);

  const solicitarPermiso =
    useCallback(async () => {
      if (!("Notification" in window)) {
        setPermiso("no_soportado");

        return "no_soportado" as const;
      }

      const nuevoPermiso =
        await Notification.requestPermission();

      setPermiso(nuevoPermiso);

      return nuevoPermiso;
    }, []);

  useEffect(() => {
    if (
      permiso !== "granted" ||
      mesSeleccionado !== periodoActual
    ) {
      return;
    }

    const quincenaActual =
      obtenerQuincena(new Date());

    alertasActivas.forEach((alerta) => {
      /*
       * No enviamos una notificación
       * correspondiente a una quincena pasada
       * solo porque el usuario la está consultando.
       */
      if (
        alerta.tipo === "quincenal" &&
        quincenaSeleccionada !==
          quincenaActual
      ) {
        return;
      }

      const claveStorage = [
        PREFIJO_STORAGE,
        periodoActual,
        alerta.tipo === "quincenal"
          ? `q${quincenaSeleccionada}`
          : "mes",
        alerta.id,
        alerta.nivel,
      ].join(":");

      const yaNotificada =
        window.localStorage.getItem(
          claveStorage,
        );

      if (yaNotificada) {
        return;
      }

      new Notification(alerta.titulo, {
        body: alerta.mensaje,
        tag: claveStorage,
      });

      window.localStorage.setItem(
        claveStorage,
        new Date().toISOString(),
      );
    });
  }, [
    alertasActivas,
    mesSeleccionado,
    periodoActual,
    permiso,
    quincenaSeleccionada,
  ]);

  return {
    permisoNotificaciones: permiso,

    notificacionesSoportadas:
      permiso !== "no_soportado",

    alertasActivas,

    solicitarPermiso,
  };
}