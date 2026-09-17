"use client";

/*
 * Nombre: Sección de movimientos variables
 * Ruta: src/components/budget/VariableMovementsSection.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-08-02
 *
 * Descripción:
 * Muestra el historial mensual de gastos y pagos variables.
 *
 * Cada movimiento presenta:
 * - categoría;
 * - fecha;
 * - quincena;
 * - monto;
 * - tarjeta o método utilizado.
 *
 * También permite filtrar los movimientos por tarjeta.
 */

import {
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  Filter,
  LoaderCircle,
  ReceiptText,
  Trash2,
} from "lucide-react";

import {
  useMemo,
  useState,
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

const FILTRO_TODAS =
  "__todas__";

const FILTRO_SIN_TARJETA =
  "__sin_tarjeta__";

/**
 * Devuelve el nombre que debe aparecer para la tarjeta
 * o método usado en un movimiento.
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
        movimiento
          .tarjetaId,
      );

    if (
      !tarjeta
    ) {
      return "Tarjeta no encontrada";
    }

    return tarjeta
      .ultimosCuatro
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
 * Obtiene una etiqueta segura para la categoría.
 *
 * Un gasto de "Otro" puede tener categoria === null porque
 * deliberadamente no consume Comida ni Gas.
 */
function obtenerEtiquetaCategoria(
  movimiento:
    Movimiento,
): string {
  if (
    movimiento.tipo ===
    "pago"
  ) {
    if (
      movimiento.categoria ===
      "general"
    ) {
      return "Pago general";
    }

    return CATEGORIAS_VARIABLES[
      movimiento.categoria
    ].label;
  }

  if (
    movimiento.categoria ===
    null
  ) {
    const nombre =
      movimiento
        .categoriaTarjetaNombre
        ?.trim();

    return (
      nombre ||
      "Otro"
    );
  }

  return CATEGORIAS_VARIABLES[
    movimiento.categoria
  ].label;
}

/**
 * Etiqueta corta para el selector de tarjetas.
 */
function etiquetaTarjetaFiltro(
  tarjeta:
    TarjetaCredito,
): string {
  return tarjeta
    .ultimosCuatro
    ? `${tarjeta.nombre} · •••• ${tarjeta.ultimosCuatro}`
    : tarjeta.nombre;
}

/**
 * Sección completa del historial mensual.
 *
 * El filtro utiliza tarjetaId en lugar del nombre de la tarjeta.
 * De esta forma, renombrar una tarjeta no rompe el historial.
 */
export function VariableMovementsSection({
  movimientos,
  tarjetas,
  quincenaSeleccionada,
  eliminandoMovimientoId,
  onEliminar,
}: VariableMovementsSectionProps) {
  const [
    filtroTarjeta,
    setFiltroTarjeta,
  ] =
    useState(
      FILTRO_TODAS,
    );

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

  /**
   * IDs de tarjetas realmente presentes en los movimientos
   * del mes.
   */
  const tarjetasUsadasIds =
    useMemo(
      () =>
        new Set(
          movimientos
            .map(
              (
                movimiento,
              ) =>
                movimiento
                  .tarjetaId,
            )
            .filter(
              (
                tarjetaId,
              ): tarjetaId is string =>
                typeof tarjetaId ===
                  "string" &&
                tarjetaId.length >
                  0,
            ),
        ),
      [
        movimientos,
      ],
    );

  /**
   * Solo mostramos en el filtro las tarjetas que participan
   * en algún movimiento del periodo actual.
   *
   * Una tarjeta inactiva también permanece disponible si existe
   * un movimiento histórico asociado a ella.
   */
  const tarjetasFiltro =
    useMemo(
      () =>
        tarjetas
          .filter(
            (
              tarjeta,
            ) =>
              tarjetasUsadasIds.has(
                tarjeta.id,
              ),
          )
          .sort(
            (
              a,
              b,
            ) =>
              a.nombre.localeCompare(
                b.nombre,
                "es",
                {
                  sensitivity:
                    "base",
                },
              ),
          ),
      [
        tarjetas,
        tarjetasUsadasIds,
      ],
    );

  const hayMovimientosSinTarjeta =
    useMemo(
      () =>
        movimientos.some(
          (
            movimiento,
          ) =>
            !movimiento
              .tarjetaId,
        ),
      [
        movimientos,
      ],
    );

  /**
   * Aplica únicamente un filtro visual.
   *
   * No altera Firestore ni ninguno de los cálculos financieros.
   */
  const movimientosFiltrados =
    useMemo(
      () => {
        if (
          filtroTarjeta ===
          FILTRO_TODAS
        ) {
          return movimientos;
        }

        if (
          filtroTarjeta ===
          FILTRO_SIN_TARJETA
        ) {
          return movimientos.filter(
            (
              movimiento,
            ) =>
              !movimiento
                .tarjetaId,
          );
        }

        return movimientos.filter(
          (
            movimiento,
          ) =>
            movimiento
              .tarjetaId ===
            filtroTarjeta,
        );
      },
      [
        movimientos,
        filtroTarjeta,
      ],
    );

  const movimientosQuincena =
    useMemo(
      () =>
        movimientosFiltrados.filter(
          (
            movimiento,
          ) =>
            obtenerQuincenaDesdeISO(
              movimiento.fecha,
            ) ===
            quincenaSeleccionada,
        ),
      [
        movimientosFiltrados,
        quincenaSeleccionada,
      ],
    );

  const nombreFiltroActual =
    useMemo(
      () => {
        if (
          filtroTarjeta ===
          FILTRO_TODAS
        ) {
          return "Todas";
        }

        if (
          filtroTarjeta ===
          FILTRO_SIN_TARJETA
        ) {
          return "Sin tarjeta";
        }

        return (
          tarjetasPorId.get(
            filtroTarjeta,
          )?.nombre ??
          "Tarjeta"
        );
      },
      [
        filtroTarjeta,
        tarjetasPorId,
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

      {/*
       * =====================================================
       * FILTRO POR TARJETA
       * =====================================================
       */}
      {movimientos.length >
        0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
              <Filter className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <label
                htmlFor="filtro-tarjeta-movimientos"
                className="block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500"
              >
                Filtrar por tarjeta
              </label>

              <select
                id="filtro-tarjeta-movimientos"
                value={
                  filtroTarjeta
                }
                onChange={(
                  event,
                ) =>
                  setFiltroTarjeta(
                    event
                      .target
                      .value,
                  )
                }
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option
                  value={
                    FILTRO_TODAS
                  }
                >
                  Todas las tarjetas
                </option>

                {tarjetasFiltro.map(
                  (
                    tarjeta,
                  ) => (
                    <option
                      key={
                        tarjeta.id
                      }
                      value={
                        tarjeta.id
                      }
                    >
                      {etiquetaTarjetaFiltro(
                        tarjeta,
                      )}
                    </option>
                  ),
                )}

                {hayMovimientosSinTarjeta && (
                  <option
                    value={
                      FILTRO_SIN_TARJETA
                    }
                  >
                    Sin tarjeta / débito / efectivo
                  </option>
                )}
              </select>
            </div>
          </div>

          {filtroTarjeta !==
            FILTRO_TODAS && (
            <div className="mt-2 flex items-center justify-between gap-3 px-1">
              <p className="text-[10px] font-semibold text-slate-500">
                Mostrando{" "}
                <span className="font-black text-slate-700">
                  {
                    movimientosFiltrados
                      .length
                  }
                </span>{" "}
                de{" "}
                {
                  movimientos.length
                }{" "}
                movimientos
              </p>

              <button
                type="button"
                onClick={() =>
                  setFiltroTarjeta(
                    FILTRO_TODAS,
                  )
                }
                className="text-[10px] font-black text-indigo-600 transition hover:text-indigo-800"
              >
                Limpiar filtro
              </button>
            </div>
          )}
        </div>
      )}

      {movimientos.length ===
      0 ? (
        <EmptyState />
      ) : movimientosFiltrados
          .length ===
        0 ? (
        <EmptyFilterState
          nombreFiltro={
            nombreFiltroActual
          }
          onLimpiar={() =>
            setFiltroTarjeta(
              FILTRO_TODAS,
            )
          }
        />
      ) : (
        <div className="mt-4 space-y-2.5">
          {movimientosFiltrados.map(
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
 * Fila individual del historial.
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
    obtenerEtiquetaCategoria(
      movimiento,
    );

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

            {esGasto &&
              movimiento
                .categoria ===
                null &&
              movimiento
                .comentario && (
                <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-relaxed text-slate-400">
                  {
                    movimiento
                      .comentario
                  }
                </p>
              )}
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

function EmptyFilterState({
  nombreFiltro,
  onLimpiar,
}: {
  nombreFiltro:
    string;

  onLimpiar:
    () => void;
}) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-400 shadow-sm">
        <Filter className="h-6 w-6" />
      </div>

      <h3 className="mt-3 text-sm font-black text-slate-800">
        No hay movimientos para{" "}
        {nombreFiltro}
      </h3>

      <p className="mt-1 max-w-xs text-xs font-medium leading-relaxed text-slate-500">
        No existen movimientos asociados a este filtro durante el periodo mostrado.
      </p>

      <button
        type="button"
        onClick={
          onLimpiar
        }
        className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-black text-indigo-600 shadow-sm transition hover:bg-indigo-50"
      >
        Mostrar todos
      </button>
    </div>
  );
}

/**
 * Estado vacío cuando todavía no existen movimientos.
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

export default VariableMovementsSection;