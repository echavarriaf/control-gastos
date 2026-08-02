"use client";

import {
  X,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  ActualizacionCompromisoFijo,
  CompromisoFijo,
  MetodoPagoFijo,
  NuevoCompromisoFijo,
  PrioridadPago,
  Quincena,
} from "@/lib/budget/types";

import ListaCompromisos from "./ListaCompromisos";
import FormularioCompromisoFijo from "./FormularioCompromisoFijo";

interface FixedCommitmentsModalProps {
  abierto: boolean;
  compromisos: CompromisoFijo[];
  cargando: boolean;
  guardando: boolean;
  actualizandoId: string | null;

  onCerrar: () => void;

  onCrear: (
    datos: NuevoCompromisoFijo,
  ) => Promise<boolean>;

  onActualizar: (
    compromisoId: string,
    cambios: ActualizacionCompromisoFijo,
  ) => Promise<boolean>;

  onCambiarEstado: (
    compromisoId: string,
    activo: boolean,
  ) => Promise<boolean>;
}

type VistaModal =
  | "lista"
  | "crear"
  | "editar";

interface FormularioCompromiso {
  descripcion: string;
  monto: string;
  diaVencimiento: string;
  quincenaPresupuestaria: Quincena;
  prioridad: PrioridadPago;
  metodoPagoPreferido: MetodoPagoFijo;
  tarjetaId: string;
  activo: boolean;
}

const FORMULARIO_INICIAL:
  FormularioCompromiso = {
    descripcion: "",
    monto: "",
    diaVencimiento: "1",
    quincenaPresupuestaria: 1,
    prioridad: 2,
    metodoPagoPreferido:
      "transferencia",
    tarjetaId: "",
    activo: true,
  };

export function FixedCommitmentsModal({
  abierto,
  compromisos,
  cargando,
  guardando,
  actualizandoId,
  onCerrar,
  onCrear,
  onActualizar,
  onCambiarEstado,
}: FixedCommitmentsModalProps) {
  const [
    vista,
    setVista,
  ] =
    useState<VistaModal>(
      "lista",
    );

  const [
    compromisoEditado,
    setCompromisoEditado,
  ] =
    useState<CompromisoFijo | null>(
      null,
    );

  const [
    formulario,
    setFormulario,
  ] =
    useState<FormularioCompromiso>(
      FORMULARIO_INICIAL,
    );

  const [
    errorLocal,
    setErrorLocal,
  ] =
    useState<string | null>(
      null,
    );

  const procesando =
    guardando ||
    actualizandoId !== null;

  const activos =
    useMemo(
      () =>
        compromisos.filter(
          (compromiso) =>
            compromiso.activo,
        ).length,
      [compromisos],
    );

  useEffect(() => {
    if (!abierto) {
      setVista("lista");

      setCompromisoEditado(
        null,
      );

      setFormulario(
        FORMULARIO_INICIAL,
      );

      setErrorLocal(null);
    }
  }, [abierto]);

  useEffect(() => {
    if (
      formulario
        .metodoPagoPreferido !==
      "tarjeta"
    ) {
      setFormulario(
        (actual) => ({
          ...actual,
          tarjetaId: "",
        }),
      );
    }
  }, [
    formulario
      .metodoPagoPreferido,
  ]);

  if (!abierto) {
    return null;
  }

  const cerrar = () => {
    if (!procesando) {
      onCerrar();
    }
  };

  const abrirCreacion = () => {
    setCompromisoEditado(
      null,
    );

    setFormulario(
      FORMULARIO_INICIAL,
    );

    setErrorLocal(null);
    setVista("crear");
  };

  const abrirEdicion = (
    compromiso: CompromisoFijo,
  ) => {
    setCompromisoEditado(
      compromiso,
    );

    setFormulario({
      descripcion:
        compromiso.descripcion,

      monto:
        compromiso.monto.toFixed(
          2,
        ),

      diaVencimiento:
        String(
          compromiso
            .diaVencimiento,
        ),

      quincenaPresupuestaria:
        compromiso
          .quincenaPresupuestaria,

      prioridad:
        compromiso.prioridad,

      metodoPagoPreferido:
        compromiso
          .metodoPagoPreferido,

      tarjetaId:
        compromiso.tarjetaId ??
        "",

      activo:
        compromiso.activo,
    });

    setErrorLocal(null);
    setVista("editar");
  };

  const regresarALista = () => {
    if (procesando) {
      return;
    }

    setVista("lista");

    setCompromisoEditado(
      null,
    );

    setFormulario(
      FORMULARIO_INICIAL,
    );

    setErrorLocal(null);
  };

  const enviarFormulario =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();
      setErrorLocal(null);

      const descripcion =
        formulario.descripcion.trim();

      const monto =
        Number(
          formulario.monto,
        );

      const diaVencimiento =
        Number(
          formulario
            .diaVencimiento,
        );

      if (!descripcion) {
        setErrorLocal(
          "Escribe el nombre del gasto fijo.",
        );

        return;
      }

      if (
        !Number.isFinite(
          monto,
        ) ||
        monto <= 0
      ) {
        setErrorLocal(
          "El monto debe ser mayor que cero.",
        );

        return;
      }

      if (
        !Number.isInteger(
          diaVencimiento,
        ) ||
        diaVencimiento < 1 ||
        diaVencimiento > 31
      ) {
        setErrorLocal(
          "El día de vencimiento debe estar entre 1 y 31.",
        );

        return;
      }

      if (
        formulario
          .metodoPagoPreferido ===
          "tarjeta" &&
        !formulario
          .tarjetaId
          .trim()
      ) {
        setErrorLocal(
          "Escribe la tarjeta utilizada para este gasto.",
        );

        return;
      }

      const datos:
        NuevoCompromisoFijo = {
          descripcion,

          monto:
            Math.round(
              monto * 100,
            ) / 100,

          diaVencimiento,

          quincenaPresupuestaria:
            formulario
              .quincenaPresupuestaria,

          prioridad:
            formulario.prioridad,

          metodoPagoPreferido:
            formulario
              .metodoPagoPreferido,

          tarjetaId:
            formulario
              .metodoPagoPreferido ===
              "tarjeta"
              ? formulario
                  .tarjetaId
                  .trim()
              : null,

          activo:
            formulario.activo,
        };

      const guardado =
        vista === "editar" &&
        compromisoEditado
          ? await onActualizar(
              compromisoEditado.id,
              datos,
            )
          : await onCrear(
              datos,
            );

      if (guardado) {
        regresarALista();
      }
    };

  const alternarEstado =
    async (
      compromiso:
        CompromisoFijo,
    ) => {
      if (procesando) {
        return;
      }

      if (
        compromiso.activo
      ) {
        const confirmado =
          window.confirm(
            `¿Desactivar "${compromiso.descripcion}"? Dejará de incluirse en el presupuesto, pero conservará su historial.`,
          );

        if (!confirmado) {
          return;
        }
      }

      await onCambiarEstado(
        compromiso.id,
        !compromiso.activo,
      );
    };

  return (
    <div
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !procesando
        ) {
          cerrar();
        }
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="fixed-commitments-title"
        className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-slate-50 shadow-2xl sm:max-w-3xl sm:rounded-[2rem]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">
              Configuración
            </p>

            <h2
              id="fixed-commitments-title"
              className="mt-1 text-xl font-black text-slate-950 sm:text-2xl"
            >
              {vista ===
              "lista"
                ? "Gastos fijos"
                : vista ===
                    "crear"
                  ? "Nuevo gasto fijo"
                  : "Editar gasto fijo"}
            </h2>

            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
              {vista ===
              "lista"
                ? `${activos} activos de ${compromisos.length} configurados`
                : "Define el monto, vencimiento y la quincena que financiará este compromiso."}
            </p>
          </div>

          <button
            type="button"
            onClick={cerrar}
            disabled={
              procesando
            }
            aria-label="Cerrar configuración"
            title="Cerrar"
            className="rounded-2xl bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-950 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {vista ===
          "lista" ? (
            <ListaCompromisos
              compromisos={
                compromisos
              }
              cargando={
                cargando
              }
              procesando={
                procesando
              }
              actualizandoId={
                actualizandoId
              }
              onCrear={
                abrirCreacion
              }
              onEditar={
                abrirEdicion
              }
              onAlternarEstado={
                alternarEstado
              }
            />
          ) : (
            <FormularioCompromisoFijo
              formulario={
                formulario
              }
              setFormulario={
                setFormulario
              }
              errorLocal={
                errorLocal
              }
              editando={
                vista ===
                "editar"
              }
              procesando={
                procesando
              }
              onCancelar={
                regresarALista
              }
              onSubmit={
                enviarFormulario
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}