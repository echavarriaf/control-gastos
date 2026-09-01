"use client";

/*
 * Nombre: Sección de movimientos variables
 * Ruta: src/components/budget/VariableMovementsSection.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-09-01
 *
 * Descripción:
 * Muestra el historial mensual de gastos variables y pagos de tarjetas.
 *
 * Los movimientos nuevos conservan un snapshot de la categoría utilizada
 * al momento de registrarse. Esto permite que el historial continúe siendo
 * legible aunque una categoría se renombre, edite o desactive después.
 *
 * Para gastos muestra:
 *
 * - categoría de compra;
 * - descripción;
 * - comentario, cuando existe;
 * - impacto presupuestario;
 * - tarjeta o método de pago;
 * - fecha y quincena;
 * - monto.
 *
 * Los documentos antiguos que todavía no tienen categoriaTarjetaNombre
 * continúan funcionando mediante la categoría histórica comida/gas.
 */

import {
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  LoaderCircle,
  MessageSquare,
  ReceiptText,
  Tag,
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

interface DetalleCategoriaMovimiento {
  nombre:
    string;

  presupuesto:
    string;

  tienePresupuesto:
    boolean;
}

/**
 * ============================================================
 * MÉTODO DE PAGO / TARJETA
 * ============================================================
 *
 * Resuelve la etiqueta visual del medio utilizado.
 *
 * Los movimientos históricos pueden apuntar a una tarjeta que
 * posteriormente fue desactivada. Como BudgetContent entrega todas
 * las tarjetas, incluidas las inactivas, el nombre continúa visible.
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
  if (
    movimiento.tarjetaId
  ) {
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
    movimiento.tipo ===
    "pago"
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
 * ============================================================
 * CATEGORÍA
 * ============================================================
 *
 * Para gastos nuevos usamos categoriaTarjetaNombre.
 *
 * Ese campo es un snapshot del nombre visible de la categoría en
 * el momento de registrar la compra. No intentamos resolver el nombre
 * contra la colección actual de categorías, porque hacerlo cambiaría
 * retroactivamente el significado visual del historial.
 *
 * Para documentos antiguos usamos comida/gas como fallback.
 */
function obtenerDetalleCategoria(
  movimiento:
    Movimiento,
): DetalleCategoriaMovimiento {
  if (
    movimiento.tipo ===
    "pago"
  ) {
    if (
      movimiento.categoria ===
      "general"
    ) {
      return {
        nombre:
          "Pago general",

        presupuesto:
          "Pago de tarjeta",

        tienePresupuesto:
          false,
      };
    }

    return {
      nombre:
        CATEGORIAS_VARIABLES[
          movimiento.categoria
        ].label,

      presupuesto:
        "Pago de tarjeta",

      tienePresupuesto:
        false,
    };
  }

  const nombreSnapshot =
    movimiento
      .categoriaTarjetaNombre
      ?.trim();

  const nombre =
    nombreSnapshot ||
    (
      movimiento.categoria
        ? CATEGORIAS_VARIABLES[
            movimiento.categoria
          ].label
        : "Otro"
    );

  if (
    movimiento.categoria ===
    "comida"
  ) {
    return {
      nombre,

      presupuesto:
        "Presupuesto · Comida",

      tienePresupuesto:
        true,
    };
  }

  if (
    movimiento.categoria ===
    "gas"
  ) {
    return {
      nombre,

      presupuesto:
        "Presupuesto · Gas",

      tienePresupuesto:
        true,
    };
  }

  return {
    nombre,

    presupuesto:
      "Sin presupuesto",

    tienePresupuesto:
      false,
  };
}

/**
 * ============================================================
 * SECCIÓN
 * ============================================================
 */

export function VariableMovementsSection({
  movimientos,
  tarjetas,
  quincenaSeleccionada,
  eliminandoMovimientoId,
  onEliminar,
}: VariableMovementsSectionProps) {
  /**
   * El contador superior sigue reflejando la quincena seleccionada,
   * mientras el historial conserva todos los movimientos del mes.
   */
  const movimientosQuincena =
    movimientos.filter(
      (
        movimiento,
      ) =>
        obtenerQuincenaDesdeISO(
          movimiento.fecha,
        ) ===
        quincenaSeleccionada,
    );

  /**
   * Lookup rápido tarjetaId -> tarjeta.
   *
   * Incluye tarjetas activas e inactivas para mantener el historial.
   */
  const tarjetasPorId =
    useMemo(
      () =>
        new Map(
          tarjetas.map(
            (
              tarjeta,
            ) => [
              tarjeta.id,
              tarjeta,
            ],
          ),
        ),
      [
        tarjetas,
      ],
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

          <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
            Compras y pagos registrados durante el mes seleccionado.
          </p>
        </div>

        <div className="shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-right">
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
        <div className="mt-4 space-y-3">
          {movimientos.map(
            (
              movimiento,
            ) => (
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
 * ============================================================
 * FILA DE MOVIMIENTO
 * ============================================================
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

  const detalleCategoria =
    obtenerDetalleCategoria(
      movimiento,
    );

  const etiquetaPago =
    obtenerEtiquetaPago(
      movimiento,
      tarjetasPorId,
    );

  /**
   * Solo los gastos tienen comentario de clasificación.
   */
  const comentario =
    movimiento.tipo ===
      "gasto" &&
    movimiento.comentario
      ?.trim()
      ? movimiento.comentario
          .trim()
      : "";

  const Icono =
    esGasto
      ? ArrowDownCircle
      : ArrowUpCircle;

  return (
    <article className="rounded-3xl border border-slate-100 bg-slate-50 p-3.5 transition hover:border-slate-200 hover:bg-white">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
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
          {/*
           * Categoría principal.
           *
           * Se coloca antes de la descripción para que al recorrer
           * visualmente el historial sea fácil distinguir el tipo
           * de gasto.
           */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700">
              <Tag
                aria-hidden="true"
                className="h-3 w-3 shrink-0"
              />

              <span className="truncate">
                {
                  detalleCategoria.nombre
                }
              </span>
            </span>

            <span className="text-[10px] font-bold text-slate-400">
              {fechaCorta(
                movimiento.fecha,
              )}
            </span>
          </div>

          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="break-words text-sm font-black leading-5 text-slate-900">
                {
                  movimiento
                    .concepto
                }
              </h3>
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

          {/*
           * Comentario guardado con la compra.
           *
           * En "Otro" y categorías configuradas con
           * requiereComentario=true será particularmente importante.
           */}
          {comentario && (
            <div className="mt-2 flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <MessageSquare
                aria-hidden="true"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
              />

              <p className="break-words text-[11px] font-medium leading-5 text-slate-600">
                {comentario}
              </p>
            </div>
          )}

          {/*
           * Metadata financiera.
           *
           * Separamos explícitamente el presupuesto afectado de la
           * tarjeta utilizada, porque representan conceptos distintos.
           */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[9px] font-black ${
                detalleCategoria
                  .tienePresupuesto
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {
                detalleCategoria.presupuesto
              }
            </span>

            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
              Quincena{" "}
              {
                quincena
              }
            </span>

            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] font-black text-indigo-700">
              <CreditCard
                aria-hidden="true"
                className="h-3 w-3 shrink-0"
              />

              <span className="truncate">
                {
                  etiquetaPago
                }
              </span>
            </span>
          </div>
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
    </article>
  );
}

/**
 * ============================================================
 * ESTADO VACÍO
 * ============================================================
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
        Registra un gasto o un pago para comenzar el historial de este mes.
      </p>
    </div>
  );
}