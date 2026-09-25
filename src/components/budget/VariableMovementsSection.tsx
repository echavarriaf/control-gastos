"use client";

/*
 * Nombre: Sección de movimientos variables
 * Ruta: src/components/budget/VariableMovementsSection.tsx
 * Autor: Felix Echavarria
 *
 * Descripción:
 * Muestra el historial mensual de gastos y pagos variables.
 *
 * Permite filtrar los movimientos por:
 *
 * - tarjeta utilizada;
 * - movimientos sin tarjeta;
 * - fecha exacta;
 * - tarjeta + fecha simultáneamente.
 *
 * Para mantener la pantalla compacta, inicialmente presenta
 * solamente los primeros movimientos del resultado filtrado.
 *
 * Al cambiar filtros, los movimientos aparecen con una transición
 * escalonada de opacidad y desplazamiento.
 */

import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Filter,
  LoaderCircle,
  ReceiptText,
  Trash2,
  X,
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

const FILTRO_TODAS =
  "__todas__";

const FILTRO_SIN_TARJETA =
  "__sin_tarjeta__";

/**
 * Cantidad inicial de movimientos visibles.
 */
const LIMITE_MOVIMIENTOS =
  8;

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

  indice:
    number;

  onEliminar: (
    movimiento:
      Movimiento,
  ) => void | Promise<void>;
}

/**
 * Construye la etiqueta visible de una tarjeta.
 */
function etiquetaTarjeta(
  tarjeta:
    TarjetaCredito,
): string {
  return tarjeta.ultimosCuatro
    ? `${tarjeta.nombre} · •••• ${tarjeta.ultimosCuatro}`
    : tarjeta.nombre;
}

/**
 * Devuelve el nombre de la tarjeta o método utilizado.
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

    if (
      !tarjeta
    ) {
      return "Tarjeta no encontrada";
    }

    return etiquetaTarjeta(
      tarjeta,
    );
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
 * Devuelve la categoría visible de un movimiento.
 */
function obtenerCategoriaLabel(
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
    return (
      movimiento
        .categoriaTarjetaNombre ||
      "Otro"
    );
  }

  return CATEGORIAS_VARIABLES[
    movimiento.categoria
  ].label;
}

/**
 * Obtiene YYYY-MM-DD desde la fecha del movimiento.
 */
function obtenerFechaMovimiento(
  movimiento:
    Movimiento,
): string {
  return movimiento.fecha.slice(
    0,
    10,
  );
}

/**
 * Historial completo de movimientos variables.
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

  const [
    filtroFecha,
    setFiltroFecha,
  ] =
    useState(
      "",
    );

  const [
    mostrarTodos,
    setMostrarTodos,
  ] =
    useState(
      false,
    );

  const tarjetasOrdenadas =
    useMemo(
      () =>
        [...tarjetas].sort(
          (
            a,
            b,
          ) => {
            if (
              a.activa !==
              b.activa
            ) {
              return a.activa
                ? -1
                : 1;
            }

            return a.nombre.localeCompare(
              b.nombre,
              "es",
              {
                sensitivity:
                  "base",
              },
            );
          },
        ),
      [
        tarjetas,
      ],
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

  const movimientosQuincena =
    useMemo(
      () =>
        movimientos.filter(
          (
            movimiento,
          ) =>
            obtenerQuincenaDesdeISO(
              movimiento.fecha,
            ) ===
            quincenaSeleccionada,
        ),
      [
        movimientos,
        quincenaSeleccionada,
      ],
    );

  /**
   * Los filtros se aplican antes del límite de ocho movimientos.
   */
  const movimientosFiltrados =
    useMemo(
      () =>
        movimientos.filter(
          (
            movimiento,
          ) => {
            let coincideTarjeta =
              true;

            if (
              filtroTarjeta ===
              FILTRO_SIN_TARJETA
            ) {
              coincideTarjeta =
                !movimiento.tarjetaId;
            } else if (
              filtroTarjeta !==
              FILTRO_TODAS
            ) {
              coincideTarjeta =
                movimiento.tarjetaId ===
                filtroTarjeta;
            }

            const coincideFecha =
              !filtroFecha ||
              obtenerFechaMovimiento(
                movimiento,
              ) ===
                filtroFecha;

            return (
              coincideTarjeta &&
              coincideFecha
            );
          },
        ),
      [
        movimientos,
        filtroTarjeta,
        filtroFecha,
      ],
    );

  /**
   * Solamente recorta el resultado visual.
   * No altera los datos ni los cálculos del presupuesto.
   */
  const movimientosVisibles =
    useMemo(
      () =>
        mostrarTodos
          ? movimientosFiltrados
          : movimientosFiltrados.slice(
              0,
              LIMITE_MOVIMIENTOS,
            ),
      [
        movimientosFiltrados,
        mostrarTodos,
      ],
    );

  const cantidadRestante =
    Math.max(
      movimientosFiltrados.length -
        LIMITE_MOVIMIENTOS,
      0,
    );

  const puedeExpandir =
    movimientosFiltrados.length >
    LIMITE_MOVIMIENTOS;

  const hayFiltros =
    filtroTarjeta !==
      FILTRO_TODAS ||
    Boolean(
      filtroFecha,
    );

  /**
   * La llave cambia cuando cambia un filtro o cuando se abre/cierra
   * el historial. De esta manera se reproduce suavemente la
   * animación visual.
   */
  const claveAnimacion =
    `${filtroTarjeta}-${filtroFecha}-${mostrarTodos ? "todos" : "limitados"}`;

  /**
   * Al seleccionar otra tarjeta volvemos automáticamente
   * al modo compacto.
   */
  const cambiarFiltroTarjeta =
    (
      valor:
        string,
    ) => {
      setFiltroTarjeta(
        valor,
      );

      setMostrarTodos(
        false,
      );
    };

  /**
   * La fecha también reinicia el historial a los primeros ocho.
   */
  const cambiarFiltroFecha =
    (
      valor:
        string,
    ) => {
      setFiltroFecha(
        valor,
      );

      setMostrarTodos(
        false,
      );
    };

  const limpiarFiltros =
    () => {
      setFiltroTarjeta(
        FILTRO_TODAS,
      );

      setFiltroFecha(
        "",
      );

      setMostrarTodos(
        false,
      );
    };

  return (
    <>
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

          <div
            key={`contador-${filtroTarjeta}-${filtroFecha}`}
            className="movimientos-contador rounded-2xl bg-slate-100 px-3 py-2 text-right"
          >
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              {hayFiltros
                ? "Mostrando"
                : `Quincena ${quincenaSeleccionada}`}
            </p>

            <p className="mt-0.5 text-sm font-black text-slate-900">
              {hayFiltros
                ? movimientosFiltrados.length
                : movimientosQuincena.length}
            </p>
          </div>
        </div>

        {movimientos.length >
          0 && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-indigo-600" />

                <p className="text-xs font-black text-slate-700">
                  Filtrar movimientos
                </p>
              </div>

              {hayFiltros && (
                <button
                  type="button"
                  onClick={
                    limpiarFiltros
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[10px] font-black text-indigo-600 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-indigo-50 active:translate-y-0 active:scale-[0.98]"
                >
                  <X className="h-3.5 w-3.5" />

                  Limpiar
                </button>
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <CreditCard className="h-3.5 w-3.5" />

                  Tarjeta
                </span>

                <select
                  value={
                    filtroTarjeta
                  }
                  onChange={(
                    event,
                  ) =>
                    cambiarFiltroTarjeta(
                      event
                        .target
                        .value,
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none transition duration-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option
                    value={
                      FILTRO_TODAS
                    }
                  >
                    Todas las tarjetas
                  </option>

                  {tarjetasOrdenadas.map(
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
                        {etiquetaTarjeta(
                          tarjeta,
                        )}
                        {!tarjeta.activa
                          ? " · Inactiva"
                          : ""}
                      </option>
                    ),
                  )}

                  <option
                    value={
                      FILTRO_SIN_TARJETA
                    }
                  >
                    Sin tarjeta / otros métodos
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />

                  Fecha exacta
                </span>

                <input
                  type="date"
                  value={
                    filtroFecha
                  }
                  onChange={(
                    event,
                  ) =>
                    cambiarFiltroFecha(
                      event
                        .target
                        .value,
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none transition duration-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            </div>

            {hayFiltros && (
              <div
                key={`chips-${filtroTarjeta}-${filtroFecha}`}
                className="movimientos-filtros mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3"
              >
                {filtroTarjeta !==
                  FILTRO_TODAS && (
                  <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[9px] font-black text-indigo-700">
                    {filtroTarjeta ===
                    FILTRO_SIN_TARJETA
                      ? "Sin tarjeta"
                      : tarjetasPorId.get(
                            filtroTarjeta,
                          )
                        ? etiquetaTarjeta(
                            tarjetasPorId.get(
                              filtroTarjeta,
                            )!,
                          )
                        : "Tarjeta"}
                  </span>
                )}

                {filtroFecha && (
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[9px] font-black text-sky-700">
                    {fechaCorta(
                      filtroFecha,
                    )}
                  </span>
                )}

                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[9px] font-black text-slate-600">
                  {
                    movimientosFiltrados.length
                  }{" "}
                  {movimientosFiltrados.length ===
                  1
                    ? "movimiento"
                    : "movimientos"}
                </span>
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
          <div
            key={`vacio-${filtroTarjeta}-${filtroFecha}`}
            className="movimientos-vacio"
          >
            <FilteredEmptyState
              onLimpiar={
                limpiarFiltros
              }
            />
          </div>
        ) : (
          <>
            <div
              key={
                claveAnimacion
              }
              className="mt-4 space-y-2.5"
            >
              {movimientosVisibles.map(
                (
                  movimiento,
                  indice,
                ) => (
                  <MovementRow
                    key={`${movimiento.tipo}-${movimiento.id}`}
                    movimiento={
                      movimiento
                    }
                    indice={
                      indice
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

            {puedeExpandir && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setMostrarTodos(
                      (
                        actual,
                      ) =>
                        !actual,
                    )
                  }
                  aria-expanded={
                    mostrarTodos
                  }
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 active:translate-y-0 active:scale-[0.99]"
                >
                  {mostrarTodos
                    ? "Ver menos"
                    : `Ver ${cantidadRestante} ${
                        cantidadRestante ===
                        1
                          ? "movimiento"
                          : "movimientos"
                      } más`}

                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-300 ${
                      mostrarTodos
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>

                {!mostrarTodos && (
                  <p className="mt-2 text-center text-[9px] font-semibold text-slate-400">
                    Mostrando los primeros{" "}
                    {
                      LIMITE_MOVIMIENTOS
                    }{" "}
                    de{" "}
                    {
                      movimientosFiltrados.length
                    }
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <style jsx global>{`
        @keyframes movimientoEntrada {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.985);
          }

          60% {
            opacity: 1;
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes movimientoContador {
          0% {
            opacity: 0.35;
            transform: scale(0.94);
          }

          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes movimientoFiltro {
          0% {
            opacity: 0;
            transform: translateY(-4px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes movimientoVacio {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .movimiento-fila {
          opacity: 0;
          animation-name: movimientoEntrada;
          animation-duration: 360ms;
          animation-timing-function: cubic-bezier(
            0.22,
            1,
            0.36,
            1
          );
          animation-fill-mode: forwards;
          will-change: opacity, transform;
        }

        .movimientos-contador {
          animation: movimientoContador 260ms
            cubic-bezier(0.22, 1, 0.36, 1)
            both;
        }

        .movimientos-filtros {
          animation: movimientoFiltro 240ms ease-out
            both;
        }

        .movimientos-vacio {
          animation: movimientoVacio 280ms ease-out
            both;
        }

        @media (prefers-reduced-motion: reduce) {
          .movimiento-fila,
          .movimientos-contador,
          .movimientos-filtros,
          .movimientos-vacio {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </>
  );
}

/**
 * Fila individual del historial.
 */
function MovementRow({
  movimiento,
  tarjetasPorId,
  eliminando,
  indice,
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
    obtenerCategoriaLabel(
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

  const comentario =
    esGasto
      ? movimiento.comentario?.trim() ??
        ""
      : "";

  /**
   * Máximo ocho pasos de delay para evitar que una lista grande
   * tarde demasiado en terminar de aparecer.
   */
  const retraso =
    Math.min(
      indice,
      8,
    ) * 42;

  return (
    <article
      className="movimiento-fila flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-sm"
      style={{
        animationDelay:
          `${retraso}ms`,
      }}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 ${
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
              {
                categoriaLabel
              }
              {" · "}
              {fechaCorta(
                movimiento.fecha,
              )}
            </p>

            {comentario && (
              <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-relaxed text-slate-400">
                {
                  comentario
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
              {
                quincena
              }
            </span>

            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-black text-indigo-700">
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
            className="shrink-0 rounded-xl p-2 text-slate-400 transition duration-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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
 * Estado vacío cuando el mes no contiene movimientos.
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

/**
 * Estado vacío cuando existen movimientos pero ninguno coincide
 * con los filtros seleccionados.
 */
function FilteredEmptyState({
  onLimpiar,
}: {
  onLimpiar:
    () => void;
}) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <Filter className="h-6 w-6" />
      </div>

      <h3 className="mt-3 text-sm font-black text-slate-800">
        No hay coincidencias
      </h3>

      <p className="mt-1 max-w-xs text-xs font-medium leading-relaxed text-slate-500">
        No existen movimientos que coincidan con la tarjeta y fecha seleccionadas.
      </p>

      <button
        type="button"
        onClick={
          onLimpiar
        }
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-indigo-600 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-indigo-50"
      >
        <X className="h-3.5 w-3.5" />

        Limpiar filtros
      </button>
    </div>
  );
}