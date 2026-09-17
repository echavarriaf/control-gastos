"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  Fuel,
  LoaderCircle,
  Plus,
  Settings2,
  ShoppingCart,
  Tag,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  CardCategoriesManager,
} from "@/components/budget/CardCategoriesManager";

import {
  CATEGORIA_KEYS,
  CATEGORIAS_VARIABLES,
} from "@/lib/budget/constants";

import type {
  ActualizacionCategoriaTarjeta,
  CategoriaTarjeta,
  NuevaCategoriaTarjeta,
} from "@/lib/budget/card-categories";

import type {
  CategoriaPago,
  NuevoMovimiento,
  Quincena,
  TarjetaCredito,
  TipoMovimiento,
} from "@/lib/budget/types";

import type {
  DireccionCategoria,
} from "@/hooks/useCardCategories";

import {
  fechaParaPeriodo,
  montoSeguro,
} from "@/lib/budget/utils";

interface VariableMovementFormProps {
  mesSeleccionado: string;

  quincenaSeleccionada:
    Quincena;

  guardando:
    boolean;

  tarjetasActivas:
    TarjetaCredito[];

  /**
   * Recibe activas e inactivas.
   *
   * El formulario filtra las activas y el administrador necesita
   * todas para permitir reactivarlas.
   */
  categoriasTarjeta:
    CategoriaTarjeta[];

  cargandoCategorias:
    boolean;

  guardandoCategoria:
    boolean;

  actualizandoCategoriaId:
    string | null;

  reordenandoCategorias:
    boolean;

  onRegistrar: (
    movimiento:
      NuevoMovimiento,
  ) => Promise<boolean>;

  onCrearCategoria: (
    datos:
      NuevaCategoriaTarjeta,
  ) => Promise<boolean>;

  onActualizarCategoria: (
    categoria:
      CategoriaTarjeta,

    cambios:
      ActualizacionCategoriaTarjeta,
  ) => Promise<boolean>;

  onCambiarEstadoCategoria: (
    categoria:
      CategoriaTarjeta,

    activa:
      boolean,
  ) => Promise<boolean>;

  onMoverCategoria: (
    categoriaId:
      string,

    direccion:
      DireccionCategoria,
  ) => Promise<boolean>;
}

function normalizarTextoComparacion(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    );
}

function buscarTarjetaPorNombre(
  tarjetas:
    TarjetaCredito[],

  nombre:
    string,
): TarjetaCredito | null {
  const objetivo =
    normalizarTextoComparacion(
      nombre,
    );

  const coincidenciaExacta =
    tarjetas.find(
      (tarjeta) =>
        normalizarTextoComparacion(
          tarjeta.nombre,
        ) ===
        objetivo,
    );

  if (
    coincidenciaExacta
  ) {
    return coincidenciaExacta;
  }

  const coincidenciaParcial =
    tarjetas.find(
      (tarjeta) =>
        normalizarTextoComparacion(
          tarjeta.nombre,
        ).includes(
          objetivo,
        ),
    );

  return (
    coincidenciaParcial ??
    null
  );
}

/**
 * Sugiere una tarjeta según la categoría elegida.
 *
 * Reglas principales:
 *
 * - Comida / Supermercado → Walmart
 * - Gas → Costco
 * - Categorías sin presupuesto, como "Otro" → Apple
 *
 * La selección sigue siendo editable por el usuario antes
 * de registrar el gasto.
 */
function obtenerTarjetaPredeterminada(
  categoria:
    CategoriaTarjeta | null,

  tarjetas:
    TarjetaCredito[],
): string {
  if (
    tarjetas.length ===
    0
  ) {
    return "";
  }

  const categoriaPresupuesto =
    categoria
      ?.categoriaPresupuesto ??
    null;

  if (
    categoriaPresupuesto ===
    "comida"
  ) {
    const walmart =
      buscarTarjetaPorNombre(
        tarjetas,
        "Walmart",
      );

    return (
      walmart?.id ??
      tarjetas[0]?.id ??
      ""
    );
  }

  if (
    categoriaPresupuesto ===
    "gas"
  ) {
    const costco =
      buscarTarjetaPorNombre(
        tarjetas,
        "Costco",
      );

    return (
      costco?.id ??
      tarjetas[0]?.id ??
      ""
    );
  }

  /**
   * Una categoría sin presupuesto asociado representa normalmente
   * "Otro". Para estos gastos usamos Apple como tarjeta sugerida.
   *
   * Si Apple no existe o está inactiva, dejamos la selección vacía
   * para que el usuario decida explícitamente cómo pagó el gasto.
   */
  if (
    categoria &&
    categoriaPresupuesto ===
      null
  ) {
    const apple =
      buscarTarjetaPorNombre(
        tarjetas,
        "Apple",
      );

    return (
      apple?.id ??
      ""
    );
  }

  return "";
}

function etiquetaTarjeta(
  tarjeta:
    TarjetaCredito,
): string {
  return tarjeta.ultimosCuatro
    ? `${tarjeta.nombre} · •••• ${tarjeta.ultimosCuatro}`
    : tarjeta.nombre;
}

function iconoCategoria(
  categoria:
    CategoriaTarjeta,
) {
  if (
    categoria
      .categoriaPresupuesto ===
    "comida"
  ) {
    return ShoppingCart;
  }

  if (
    categoria
      .categoriaPresupuesto ===
    "gas"
  ) {
    return Fuel;
  }

  return Tag;
}

export function VariableMovementForm({
  mesSeleccionado,
  quincenaSeleccionada,
  guardando,
  tarjetasActivas,
  categoriasTarjeta,
  cargandoCategorias,
  guardandoCategoria,
  actualizandoCategoriaId,
  reordenandoCategorias,
  onRegistrar,
  onCrearCategoria,
  onActualizarCategoria,
  onCambiarEstadoCategoria,
  onMoverCategoria,
}: VariableMovementFormProps) {
  const [
    tipo,
    setTipo,
  ] =
    useState<TipoMovimiento>(
      "gasto",
    );

  const [
    concepto,
    setConcepto,
  ] =
    useState(
      "",
    );

  const [
    monto,
    setMonto,
  ] =
    useState(
      "",
    );

  const [
    categoriaTarjetaId,
    setCategoriaTarjetaId,
  ] =
    useState(
      "",
    );

  const [
    comentario,
    setComentario,
  ] =
    useState(
      "",
    );

  const [
    categoriaPago,
    setCategoriaPago,
  ] =
    useState<CategoriaPago>(
      "general",
    );

  const [
    tarjetaId,
    setTarjetaId,
  ] =
    useState(
      "",
    );

  const [
    fecha,
    setFecha,
  ] =
    useState(
      () =>
        fechaParaPeriodo(
          mesSeleccionado,
          quincenaSeleccionada,
        ),
    );

  const [
    errorLocal,
    setErrorLocal,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    administradorCategoriasAbierto,
    setAdministradorCategoriasAbierto,
  ] =
    useState(
      false,
    );

  const esGasto =
    tipo ===
    "gasto";

  const tarjetasDisponibles =
    useMemo(
      () =>
        tarjetasActivas.filter(
          (
            tarjeta,
          ) =>
            tarjeta.activa,
        ),
      [
        tarjetasActivas,
      ],
    );

  const categoriasDisponibles =
    useMemo(
      () =>
        categoriasTarjeta
          .filter(
            (
              categoria,
            ) =>
              categoria.activa,
          )
          .sort(
            (
              a,
              b,
            ) =>
              a.orden -
                b.orden ||
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
        categoriasTarjeta,
      ],
    );

  const categoriaSeleccionada =
    useMemo(
      () =>
        categoriasDisponibles.find(
          (
            categoria,
          ) =>
            categoria.id ===
            categoriaTarjetaId,
        ) ??
        null,
      [
        categoriasDisponibles,
        categoriaTarjetaId,
      ],
    );

  const tarjetaSeleccionada =
    useMemo(
      () =>
        tarjetasDisponibles.find(
          (
            tarjeta,
          ) =>
            tarjeta.id ===
            tarjetaId,
        ) ??
        null,
      [
        tarjetasDisponibles,
        tarjetaId,
      ],
    );

  useEffect(
    () => {
      setFecha(
        fechaParaPeriodo(
          mesSeleccionado,
          quincenaSeleccionada,
        ),
      );
    },
    [
      mesSeleccionado,
      quincenaSeleccionada,
    ],
  );

  useEffect(
    () => {
      setCategoriaTarjetaId(
        (
          seleccionActual,
        ) => {
          const seleccionValida =
            categoriasDisponibles.some(
              (
                categoria,
              ) =>
                categoria.id ===
                seleccionActual,
            );

          if (
            seleccionValida
          ) {
            return seleccionActual;
          }

          return (
            categoriasDisponibles[0]
              ?.id ??
            ""
          );
        },
      );
    },
    [
      categoriasDisponibles,
    ],
  );

  /**
   * Si cambia la categoría o cambia el listado de tarjetas activas,
   * conserva la selección actual si todavía es válida.
   *
   * Cuando no existe selección válida aplica:
   *
   * Supermercado → Walmart
   * Gas          → Costco
   * Otro         → Apple
   */
  useEffect(
    () => {
      if (
        !esGasto
      ) {
        return;
      }

      setTarjetaId(
        (
          seleccionActual,
        ) => {
          const seleccionValida =
            tarjetasDisponibles.some(
              (
                tarjeta,
              ) =>
                tarjeta.id ===
                seleccionActual,
            );

          if (
            seleccionValida
          ) {
            return seleccionActual;
          }

          return obtenerTarjetaPredeterminada(
            categoriaSeleccionada,
            tarjetasDisponibles,
          );
        },
      );
    },
    [
      categoriaSeleccionada,
      esGasto,
      tarjetasDisponibles,
    ],
  );

  const seleccionarCategoria =
    (
      categoria:
        CategoriaTarjeta,
    ) => {
      setCategoriaTarjetaId(
        categoria.id,
      );

      setComentario(
        "",
      );

      setErrorLocal(
        null,
      );

      /**
       * Cada vez que el usuario cambia explícitamente la categoría,
       * aplicamos inmediatamente la tarjeta predeterminada asociada.
       *
       * Esto evita conservar por accidente Walmart al pasar a Otro,
       * por ejemplo.
       */
      setTarjetaId(
        obtenerTarjetaPredeterminada(
          categoria,
          tarjetasDisponibles,
        ),
      );
    };

  const seleccionarTipo =
    (
      nuevoTipo:
        TipoMovimiento,
    ) => {
      setTipo(
        nuevoTipo,
      );

      setErrorLocal(
        null,
      );

      if (
        nuevoTipo ===
          "pago" &&
        !tarjetaId
      ) {
        setTarjetaId(
          tarjetasDisponibles[0]
            ?.id ??
            "",
        );
      }

      if (
        nuevoTipo ===
        "gasto"
      ) {
        setTarjetaId(
          obtenerTarjetaPredeterminada(
            categoriaSeleccionada,
            tarjetasDisponibles,
          ),
        );
      }
    };

  const enviarFormulario =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      setErrorLocal(
        null,
      );

      const montoValidado =
        montoSeguro(
          monto,
        );

      if (
        !concepto.trim()
      ) {
        setErrorLocal(
          "Escribe una descripción para el movimiento.",
        );

        return;
      }

      if (
        !montoValidado
      ) {
        setErrorLocal(
          "Ingresa un monto mayor que cero.",
        );

        return;
      }

      if (
        !fecha
      ) {
        setErrorLocal(
          "Selecciona la fecha del movimiento.",
        );

        return;
      }

      if (
        tipo ===
          "gasto" &&
        !categoriaSeleccionada
      ) {
        setErrorLocal(
          "Selecciona una categoría para el gasto.",
        );

        return;
      }

      if (
        tipo ===
          "gasto" &&
        categoriaSeleccionada
          ?.requiereComentario &&
        !comentario.trim()
      ) {
        setErrorLocal(
          `Escribe un comentario para ${categoriaSeleccionada.nombre}.`,
        );

        return;
      }

      if (
        tipo ===
          "pago" &&
        !tarjetaId
      ) {
        setErrorLocal(
          "Selecciona la tarjeta que estás pagando.",
        );

        return;
      }

      /**
       * El resumen de tarjeta parte de fechaSaldoInicial.
       *
       * Evitamos guardar silenciosamente una compra con una fecha
       * anterior al punto de partida financiero de la tarjeta.
       */
      if (
        tipo ===
          "gasto" &&
        tarjetaSeleccionada &&
        fecha <
          tarjetaSeleccionada
            .fechaSaldoInicial
      ) {
        setErrorLocal(
          `La fecha del gasto es anterior al saldo inicial de ${tarjetaSeleccionada.nombre} (${tarjetaSeleccionada.fechaSaldoInicial}). Cambia la fecha del gasto o recalibra la tarjeta.`,
        );

        return;
      }

      const movimiento:
        NuevoMovimiento =
        tipo ===
          "gasto" &&
        categoriaSeleccionada
          ? {
              tipo:
                "gasto",

              concepto:
                concepto.trim(),

              monto:
                montoValidado,

              categoria:
                categoriaSeleccionada
                  .categoriaPresupuesto,

              categoriaTarjetaId:
                categoriaSeleccionada
                  .id,

              categoriaTarjetaNombre:
                categoriaSeleccionada
                  .nombre,

              comentario:
                comentario.trim(),

              fecha,

              metodoPago:
                tarjetaId
                  ? "tarjeta_credito"
                  : "debito",

              tarjetaId:
                tarjetaId ||
                null,
            }
          : {
              tipo:
                "pago",

              concepto:
                concepto.trim(),

              monto:
                montoValidado,

              categoria:
                categoriaPago,

              fecha,

              tarjetaId,
            };

      const guardado =
        await onRegistrar(
          movimiento,
        );

      if (
        !guardado
      ) {
        return;
      }

      setConcepto(
        "",
      );

      setMonto(
        "",
      );

      setComentario(
        "",
      );

      setErrorLocal(
        null,
      );

      /**
       * Después de guardar un gasto dejamos preparado el mismo
       * comportamiento predeterminado para el próximo movimiento.
       */
      if (
        tipo ===
        "gasto"
      ) {
        setTarjetaId(
          obtenerTarjetaPredeterminada(
            categoriaSeleccionada,
            tarjetasDisponibles,
          ),
        );
      }
    };

  const comentarioRequerido =
    esGasto &&
    Boolean(
      categoriaSeleccionada
        ?.requiereComentario,
    );

  return (
    <section
      aria-labelledby="variable-form-title"
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          Nuevo movimiento
        </p>

        <h2
          id="variable-form-title"
          className="mt-1 text-lg font-black text-slate-900"
        >
          Registrar gasto o pago
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
        <TypeButton
          tipo="gasto"
          seleccionado={
            tipo ===
            "gasto"
          }
          onSelect={
            seleccionarTipo
          }
        />

        <TypeButton
          tipo="pago"
          seleccionado={
            tipo ===
            "pago"
          }
          onSelect={
            seleccionarTipo
          }
        />
      </div>

      <form
        onSubmit={
          enviarFormulario
        }
        className="mt-4 space-y-4"
      >
        <div>
          <label
            htmlFor="movimiento-concepto"
            className="mb-1.5 block text-xs font-black text-slate-700"
          >
            Descripción
          </label>

          <input
            id="movimiento-concepto"
            type="text"
            value={
              concepto
            }
            onChange={(
              event,
            ) =>
              setConcepto(
                event
                  .target
                  .value,
              )
            }
            placeholder={
              esGasto
                ? categoriaSeleccionada
                    ?.categoriaPresupuesto ===
                    "comida"
                  ? "Ej. Walmart o Publix"
                  : categoriaSeleccionada
                        ?.categoriaPresupuesto ===
                      "gas"
                    ? "Ej. Costco Gas"
                    : "Ej. Amazon, farmacia o ropa"
                : "Ej. Pago tarjeta Walmart"
            }
            disabled={
              guardando
            }
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="movimiento-monto"
              className="mb-1.5 block text-xs font-black text-slate-700"
            >
              Monto
            </label>

            <input
              id="movimiento-monto"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={
                monto
              }
              onChange={(
                event,
              ) =>
                setMonto(
                  event
                    .target
                    .value,
                )
              }
              placeholder="0.00"
              disabled={
                guardando
              }
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="movimiento-fecha"
              className="mb-1.5 block text-xs font-black text-slate-700"
            >
              Fecha
            </label>

            <input
              id="movimiento-fecha"
              type="date"
              value={
                fecha
              }
              onChange={(
                event,
              ) =>
                setFecha(
                  event
                    .target
                    .value,
                )
              }
              disabled={
                guardando
              }
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        {esGasto ? (
          <fieldset>
            <legend className="text-xs font-black text-slate-700">
              Tipo de compra
            </legend>

            <div className="mb-2 mt-1 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  setAdministradorCategoriasAbierto(
                    true,
                  )
                }
                disabled={
                  guardando ||
                  cargandoCategorias
                }
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-[10px] font-black text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
              >
                <Settings2 className="h-3.5 w-3.5" />

                Administrar categorías
              </button>
            </div>

            {cargandoCategorias ? (
              <div className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />

                Cargando categorías...
              </div>
            ) : categoriasDisponibles.length ===
              0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-bold text-amber-800">
                No hay categorías de gasto activas.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {categoriasDisponibles.map(
                  (
                    categoria,
                  ) => {
                    const Icono =
                      iconoCategoria(
                        categoria,
                      );

                    const seleccionada =
                      categoriaTarjetaId ===
                      categoria.id;

                    return (
                      <button
                        key={
                          categoria.id
                        }
                        type="button"
                        onClick={() =>
                          seleccionarCategoria(
                            categoria,
                          )
                        }
                        disabled={
                          guardando
                        }
                        aria-pressed={
                          seleccionada
                        }
                        className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                          seleccionada
                            ? "border-transparent bg-indigo-600 text-white shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Icono className="h-4 w-4" />

                        <span className="truncate">
                          {
                            categoria
                              .nombre
                          }
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            )}

            {categoriaSeleccionada && (
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500">
                {categoriaSeleccionada
                  .categoriaPresupuesto ===
                "comida"
                  ? "Esta compra consume el presupuesto de Comida."
                  : categoriaSeleccionada
                        .categoriaPresupuesto ===
                      "gas"
                    ? "Esta compra consume el presupuesto de Gas."
                    : "Esta compra no consume el presupuesto de Comida ni Gas."}
              </p>
            )}
          </fieldset>
        ) : (
          <div>
            <label
              htmlFor="pago-categoria"
              className="mb-1.5 block text-xs font-black text-slate-700"
            >
              Clasificación del pago
            </label>

            <select
              id="pago-categoria"
              value={
                categoriaPago
              }
              onChange={(
                event,
              ) =>
                setCategoriaPago(
                  event
                    .target
                    .value as CategoriaPago,
                )
              }
              disabled={
                guardando
              }
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="general">
                Pago general de tarjeta
              </option>

              {CATEGORIA_KEYS.map(
                (
                  key,
                ) => (
                  <option
                    key={
                      key
                    }
                    value={
                      key
                    }
                  >
                    {
                      CATEGORIAS_VARIABLES[
                        key
                      ].label
                    }
                  </option>
                ),
              )}
            </select>
          </div>
        )}

        {comentarioRequerido && (
          <div>
            <label
              htmlFor="movimiento-comentario"
              className="mb-1.5 block text-xs font-black text-slate-700"
            >
              Detalle / comentario

              <span className="ml-1 text-rose-600">
                *
              </span>
            </label>

            <textarea
              id="movimiento-comentario"
              value={
                comentario
              }
              onChange={(
                event,
              ) =>
                setComentario(
                  event
                    .target
                    .value,
                )
              }
              maxLength={
                500
              }
              rows={
                3
              }
              required
              aria-required="true"
              placeholder="Describe qué compraste o para qué fue el gasto."
              disabled={
                guardando
              }
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <div className="mt-1 flex justify-between gap-3 text-[10px] font-semibold text-slate-400">
              <span>
                Requerido para esta categoría
              </span>

              <span>
                {
                  comentario
                    .length
                }
                /500
              </span>
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="movimiento-tarjeta"
            className="mb-1.5 flex items-center gap-2 text-xs font-black text-slate-700"
          >
            <CreditCard className="h-4 w-4 text-indigo-600" />

            {esGasto
              ? "Tarjeta utilizada"
              : "Tarjeta pagada"}
          </label>

          <select
            id="movimiento-tarjeta"
            value={
              tarjetaId
            }
            onChange={(
              event,
            ) =>
              setTarjetaId(
                event
                  .target
                  .value,
              )
            }
            disabled={
              guardando ||
              tarjetasDisponibles
                .length ===
                0
            }
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {esGasto && (
              <option value="">
                Sin tarjeta · efectivo o débito
              </option>
            )}

            {!esGasto &&
              tarjetasDisponibles
                .length ===
                0 && (
                <option value="">
                  No hay tarjetas activas
                </option>
              )}

            {tarjetasDisponibles.map(
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
                </option>
              ),
            )}
          </select>

          <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-slate-500">
            {esGasto
              ? categoriaSeleccionada
                    ?.categoriaPresupuesto ===
                  "comida"
                ? "Las compras de Supermercado sugieren Walmart. Puedes cambiar la tarjeta antes de guardar."
                : categoriaSeleccionada
                      ?.categoriaPresupuesto ===
                    "gas"
                  ? "Las compras de Gas sugieren Costco. Puedes cambiar la tarjeta antes de guardar."
                  : tarjetaId
                    ? "Los gastos de Otro sugieren Apple. Puedes cambiar la tarjeta antes de guardar."
                    : "Apple no está disponible. Selecciona la tarjeta utilizada o deja Sin tarjeta para efectivo o débito."
              : "Selecciona la tarjeta cuyo saldo disminuirá con este pago."}
          </p>
        </div>

        {errorLocal && (
          <p
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700"
          >
            {
              errorLocal
            }
          </p>
        )}

        <button
          type="submit"
          disabled={
            guardando ||
            (
              esGasto &&
              (
                cargandoCategorias ||
                !categoriaSeleccionada
              )
            )
          }
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
            esGasto
              ? "bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700"
              : "bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700"
          }`}
        >
          {guardando ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}

          {guardando
            ? "Guardando..."
            : esGasto
              ? "Registrar gasto"
              : "Registrar pago"}
        </button>
      </form>

      <CardCategoriesManager
        abierto={
          administradorCategoriasAbierto
        }
        categorias={
          categoriasTarjeta
        }
        guardando={
          guardandoCategoria
        }
        actualizandoId={
          actualizandoCategoriaId
        }
        reordenando={
          reordenandoCategorias
        }
        onCerrar={() =>
          setAdministradorCategoriasAbierto(
            false,
          )
        }
        onCrear={
          onCrearCategoria
        }
        onActualizar={
          onActualizarCategoria
        }
        onCambiarEstado={
          onCambiarEstadoCategoria
        }
        onMover={
          onMoverCategoria
        }
      />
    </section>
  );
}

interface TypeButtonProps {
  tipo:
    TipoMovimiento;

  seleccionado:
    boolean;

  onSelect: (
    tipo:
      TipoMovimiento,
  ) => void;
}

function TypeButton({
  tipo,
  seleccionado,
  onSelect,
}: TypeButtonProps) {
  const esGasto =
    tipo ===
    "gasto";

  const Icono =
    esGasto
      ? ArrowDownCircle
      : ArrowUpCircle;

  return (
    <button
      type="button"
      onClick={() =>
        onSelect(
          tipo,
        )
      }
      aria-pressed={
        seleccionado
      }
      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition active:scale-[0.98] ${
        seleccionado
          ? esGasto
            ? "bg-white text-indigo-700 shadow-sm"
            : "bg-white text-emerald-700 shadow-sm"
          : "text-slate-500 hover:text-slate-800"
      }`}
    >
      <Icono
        aria-hidden="true"
        className="h-4 w-4"
      />

      {esGasto
        ? "Gasto"
        : "Pago"}
    </button>
  );
}

export default VariableMovementForm;