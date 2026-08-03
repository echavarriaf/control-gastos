"use client";

/*
 * Nombre: Sección de movimientos variables
 * Ruta: src/components/budget/VariableMovementsSection.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-08-02
 *
 * Descripción:
 * Muestra el historial de gastos y pagos variables del periodo.
 * Cada movimiento presenta su categoría, fecha, quincena, monto
 * y la tarjeta o método de pago utilizado.
 */

import {
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  LoaderCircle,
  ReceiptText,
  Trash2,
} from "lucide-react";

import {
  useMemo,
} from "react";

import {
  CATEGORIAS_VARIABLES,
} from "@/lib/budget/constants";

import type {
  Movimiento,
  Quincena,
  TarjetaCredito,
} from "@/lib/budget/types";

import {
  fechaCorta,
  formatoMoneda,
  obtenerQuincenaDesdeISO,
} from "@/lib/budget/utils";

interface VariableMovementsSectionProps {
  movimientos:
    Movimiento[];

  tarjetas:
    TarjetaCredito[];

  quincenaSeleccionada:
    Quincena;

  eliminandoMovimientoId:
    string | null;

  onEliminar: (
    movimiento:
      Movimiento,
  ) => void | Promise<void>;
}

interface MovementRowProps {
  movimiento:
    Movimiento;

  tarjetasPorId:
    ReadonlyMap<
      string,
      TarjetaCredito
    >;

  eliminando:
    boolean;

  onEliminar: (
    movimiento:
      Movimiento,
  ) => void | Promise<void>;
}

/**
 * Devuelve el nombre que debe aparecer para la tarjeta
 * o método usado en un movimiento.
 *
 * Busca tarjetaId en el mapa de tarjetas. Cuando el movimiento
 * no tiene tarjeta, muestra el método de pago guardado o indica
 * que los datos pertenecen a un registro anterior.
 */
function obtenerEtiquetaPago(
  movimiento:
    Movimiento,

  tarjetasPorId:
    ReadonlyMap<
      string,
      TarjetaCredito
    >,
): string {
  if (movimiento.tarjetaId) {
    const tarjeta =
      tarjetasPorId.get(
        movimiento.tarjetaId,
      );

    if (!tarjeta) {
      return "Tarjeta no encontrada";
    }

    return tarjeta.ultimosCuatro
      ? `${tarjeta.nombre} · •••• ${tarjeta.ultimosCuatro}`
      : tarjeta.nombre;
  }

  if (
    movimiento.tipo === "pago"
  ) {
    return "Tarjeta no registrada";
  }

  switch (
    movimiento.metodoPago
  ) {
    case "efectivo":
      return "Efectivo";

    case "cuenta_bancaria":
      return "Cuenta bancaria";

    case "tarjeta_credito":
      return "Tarjeta no registrada";

    case "debito":
      return "Débito";

    default:
      return "Método no registrado";
  }
}

/**
 * Renderiza la sección completa del historial de movimientos.
 *
 * Construye una tabla de búsqueda tarjetaId → tarjeta con useMemo
 * para resolver rápidamente el nombre de la tarjeta de cada fila.
 */
export function VariableMovementsSection({
  movimientos,
  tarjetas,
  quincenaSeleccionada,
  eliminandoMovimientoId,
  onEliminar,
}: VariableMovementsSectionProps) {
  const movimientosQuincena =
    movimientos.filter(
      (movimiento) =>
        obtenerQuincenaDesdeISO(
          movimiento.fecha,
        ) ===
        quincenaSeleccionada,
    );

  const tarjetasPorId =
    useMemo(
      () =>
        new Map(
          tarjetas.map(
            (tarjeta) => [
              tarjeta.id,
              tarjeta,
            ],
          ),
        ),
      [tarjetas],
    );

  return (
    <section
      aria-labelledby="movimientos-title"
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Historial mensual
          </p>

          <h2
            id="movimientos-title"
            className="mt-1 text-lg font-black text-slate-900"
          >
            Movimientos variables
          </h2>
        </div>

        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Quincena{" "}
            {
              quincenaSeleccionada
            }
          </p>

          <p className="mt-0.5 text-sm font-black text-slate-900">
            {
              movimientosQuincena
                .length
            }
          </p>
        </div>
      </div>

      {movimientos.length ===
      0 ? (
        <EmptyState />
      ) : (
        <div className="mt-4 space-y-2.5">
          {movimientos.map(
            (movimiento) => (
              <MovementRow
                key={`${movimiento.tipo}-${movimiento.id}`}
                movimiento={
                  movimiento
                }
                tarjetasPorId={
                  tarjetasPorId
                }
                eliminando={
                  eliminandoMovimientoId ===
                  `${movimiento.tipo}-${movimiento.id}`
                }
                onEliminar={
                  onEliminar
                }
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Muestra una fila individual del historial.
 *
 * Calcula la categoría, quincena y etiqueta de pago; después
 * presenta esos datos junto al monto y la acción de eliminar.
 */
function MovementRow({
  movimiento,
  tarjetasPorId,
  eliminando,
  onEliminar,
}: MovementRowProps) {
  const esGasto =
    movimiento.tipo ===
    "gasto";

  const quincena =
    obtenerQuincenaDesdeISO(
      movimiento.fecha,
    );

  const categoriaLabel =
    movimiento.categoria ===
    "general"
      ? "Pago general"
      : CATEGORIAS_VARIABLES[
          movimiento
            .categoria
        ].label;

  const etiquetaPago =
    obtenerEtiquetaPago(
      movimiento,
      tarjetasPorId,
    );

  const Icono =
    esGasto
      ? ArrowDownCircle
      : ArrowUpCircle;

  return (
    <article className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200 hover:bg-white">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
          esGasto
            ? "bg-rose-100 text-rose-600"
            : "bg-emerald-100 text-emerald-600"
        }`}
      >
        <Icono
          aria-hidden="true"
          className="h-5 w-5"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-900">
              {
                movimiento
                  .concepto
              }
            </h3>

            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              {categoriaLabel}
              {" · "}
              {fechaCorta(
                movimiento.fecha,
              )}
            </p>
          </div>

          <p
            className={`shrink-0 text-sm font-black ${
              esGasto
                ? "text-rose-600"
                : "text-emerald-600"
            }`}
          >
            {esGasto
              ? "−"
              : "+"}

            {formatoMoneda.format(
              movimiento.monto,
            )}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
              Quincena{" "}
              {quincena}
            </span>

            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-black text-indigo-700">
              <CreditCard
                aria-hidden="true"
                className="h-3 w-3 shrink-0"
              />

              <span className="truncate">
                {etiquetaPago}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              void onEliminar(
                movimiento,
              );
            }}
            disabled={
              eliminando
            }
            aria-label={`Eliminar ${movimiento.concepto}`}
            title="Eliminar movimiento"
            className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {eliminando ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * Muestra el estado vacío cuando todavía no existen movimientos.
 *
 * Utiliza un mensaje descriptivo para guiar al usuario a registrar
 * su primer gasto o pago de Comida y Gas.
 */
function EmptyState() {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <ReceiptText className="h-6 w-6" />
      </div>

      <h3 className="mt-3 text-sm font-black text-slate-800">
        No hay movimientos
      </h3>

      <p className="mt-1 max-w-xs text-xs font-medium leading-relaxed text-slate-500">
        Registra un gasto o un pago de Comida y Gas para comenzar
        el historial de este mes.
      </p>
    </div>
  );
}