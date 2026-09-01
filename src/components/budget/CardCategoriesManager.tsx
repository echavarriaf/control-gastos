"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Edit3,
  LoaderCircle,
  Plus,
  Power,
  PowerOff,
  Save,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import type {
  ActualizacionCategoriaTarjeta,
  CategoriaPresupuestoTarjeta,
  CategoriaTarjeta,
  NuevaCategoriaTarjeta,
} from "@/lib/budget/card-categories";

import type {
  DireccionCategoria,
} from "@/hooks/useCardCategories";

type VistaAdministrador =
  | "lista"
  | "crear"
  | "editar";

interface FormularioCategoria {
  nombre: string;

  categoriaPresupuesto:
    CategoriaPresupuestoTarjeta;

  requiereComentario:
    boolean;
}

interface CardCategoriesManagerProps {
  abierto:
    boolean;

  categorias:
    CategoriaTarjeta[];

  guardando:
    boolean;

  actualizandoId:
    string | null;

  reordenando:
    boolean;

  onCerrar:
    () => void;

  onCrear: (
    datos:
      NuevaCategoriaTarjeta,
  ) => Promise<boolean>;

  onActualizar: (
    categoria:
      CategoriaTarjeta,

    cambios:
      ActualizacionCategoriaTarjeta,
  ) => Promise<boolean>;

  onCambiarEstado: (
    categoria:
      CategoriaTarjeta,

    activa:
      boolean,
  ) => Promise<boolean>;

  onMover: (
    categoriaId:
      string,

    direccion:
      DireccionCategoria,
  ) => Promise<boolean>;
}

const FORMULARIO_INICIAL:
  FormularioCategoria = {
    nombre:
      "",

    categoriaPresupuesto:
      null,

    requiereComentario:
      false,
  };

function obtenerEtiquetaPresupuesto(
  categoria:
    CategoriaTarjeta,
): string {
  switch (
    categoria
      .categoriaPresupuesto
  ) {
    case "comida":
      return "Comida";

    case "gas":
      return "Gas";

    default:
      return "Sin presupuesto";
  }
}

function obtenerSiguienteOrden(
  categorias:
    CategoriaTarjeta[],
): number {
  if (
    categorias.length ===
    0
  ) {
    return 10;
  }

  const maximo =
    Math.max(
      ...categorias.map(
        (
          categoria,
        ) =>
          categoria.orden,
      ),
    );

  return Math.min(
    100000,
    maximo +
      10,
  );
}

export function CardCategoriesManager({
  abierto,
  categorias,
  guardando,
  actualizandoId,
  reordenando,
  onCerrar,
  onCrear,
  onActualizar,
  onCambiarEstado,
  onMover,
}: CardCategoriesManagerProps) {
  const [
    vista,
    setVista,
  ] =
    useState<VistaAdministrador>(
      "lista",
    );

  const [
    editando,
    setEditando,
  ] =
    useState<
      CategoriaTarjeta | null
    >(
      null,
    );

  const [
    formulario,
    setFormulario,
  ] =
    useState<FormularioCategoria>(
      FORMULARIO_INICIAL,
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

  const procesando =
    guardando ||
    actualizandoId !==
      null ||
    reordenando;

  const categoriasOrdenadas =
    useMemo(
      () =>
        [
          ...categorias,
        ].sort(
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
        categorias,
      ],
    );

  useEffect(
    () => {
      if (!abierto) {
        setVista(
          "lista",
        );

        setEditando(
          null,
        );

        setFormulario(
          FORMULARIO_INICIAL,
        );

        setErrorLocal(
          null,
        );
      }
    },
    [
      abierto,
    ],
  );

  if (!abierto) {
    return null;
  }

  const volverLista =
    () => {
      if (procesando) {
        return;
      }

      setVista(
        "lista",
      );

      setEditando(
        null,
      );

      setFormulario(
        FORMULARIO_INICIAL,
      );

      setErrorLocal(
        null,
      );
    };

  const comenzarCreacion =
    () => {
      if (procesando) {
        return;
      }

      setEditando(
        null,
      );

      setFormulario(
        FORMULARIO_INICIAL,
      );

      setErrorLocal(
        null,
      );

      setVista(
        "crear",
      );
    };

  const comenzarEdicion =
    (
      categoria:
        CategoriaTarjeta,
    ) => {
      if (
        procesando ||
        categoria.esSistema
      ) {
        return;
      }

      setEditando(
        categoria,
      );

      setFormulario({
        nombre:
          categoria.nombre,

        categoriaPresupuesto:
          categoria
            .categoriaPresupuesto,

        requiereComentario:
          categoria
            .requiereComentario,
      });

      setErrorLocal(
        null,
      );

      setVista(
        "editar",
      );
    };

  const guardarFormulario =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      setErrorLocal(
        null,
      );

      const nombre =
        formulario.nombre
          .trim()
          .replace(
            /\s+/g,
            " ",
          );

      if (!nombre) {
        setErrorLocal(
          "Escribe un nombre para la categoría.",
        );

        return;
      }

      if (
        nombre.length >
        100
      ) {
        setErrorLocal(
          "El nombre no puede superar 100 caracteres.",
        );

        return;
      }

      if (
        vista ===
        "crear"
      ) {
        const creada =
          await onCrear({
            nombre,

            categoriaPresupuesto:
              formulario
                .categoriaPresupuesto,

            requiereComentario:
              formulario
                .requiereComentario,

            activa:
              true,

            orden:
              obtenerSiguienteOrden(
                categorias,
              ),

            esSistema:
              false,
          });

        if (creada) {
          volverLista();
        } else {
          setErrorLocal(
            "No se pudo crear la categoría. Revisa el mensaje del presupuesto.",
          );
        }

        return;
      }

      if (
        vista ===
          "editar" &&
        editando
      ) {
        const actualizada =
          await onActualizar(
            editando,
            {
              nombre,

              categoriaPresupuesto:
                formulario
                  .categoriaPresupuesto,

              requiereComentario:
                formulario
                  .requiereComentario,
            },
          );

        if (
          actualizada
        ) {
          volverLista();
        } else {
          setErrorLocal(
            "No se pudo actualizar la categoría. Revisa el mensaje del presupuesto.",
          );
        }
      }
    };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="categorias-tarjeta-title"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]">
        <header className="border-b border-slate-200 bg-slate-950 px-4 py-4 text-white sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {vista !==
              "lista" ? (
                <button
                  type="button"
                  onClick={
                    volverLista
                  }
                  disabled={
                    procesando
                  }
                  aria-label="Volver a categorías"
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-slate-200 transition hover:bg-white/15 hover:text-white disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300">
                  <Tag className="h-5 w-5" />
                </div>
              )}

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">
                  Compras con tarjeta
                </p>

                <h2
                  id="categorias-tarjeta-title"
                  className="mt-1 truncate text-xl font-black"
                >
                  {vista ===
                  "lista"
                    ? "Categorías"
                    : vista ===
                        "crear"
                      ? "Nueva categoría"
                      : "Editar categoría"}
                </h2>

                <p className="mt-1 text-xs font-medium leading-5 text-slate-400">
                  {vista ===
                  "lista"
                    ? "Clasifica compras sin modificar el motor de Comida y Gas."
                    : "Define cómo esta categoría afecta el presupuesto."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={
                onCerrar
              }
              disabled={
                procesando
              }
              aria-label="Cerrar categorías"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-slate-300 transition hover:bg-white/15 hover:text-white disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto p-4 sm:p-5">
          {vista ===
          "lista" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    Categorías disponibles
                  </p>

                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Las categorías desactivadas permanecen en el historial.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    comenzarCreacion
                  }
                  disabled={
                    procesando
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-xs font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />

                  Agregar
                </button>
              </div>

              {categoriasOrdenadas.length ===
              0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <Tag className="mx-auto h-7 w-7 text-slate-300" />

                  <p className="mt-3 text-sm font-black text-slate-700">
                    No hay categorías
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {categoriasOrdenadas.map(
                    (
                      categoria,
                      index,
                    ) => {
                      const actualizando =
                        actualizandoId ===
                        categoria.id;

                      return (
                        <article
                          key={
                            categoria.id
                          }
                          className={`rounded-3xl border p-4 ${
                            categoria.activa
                              ? "border-slate-200 bg-white"
                              : "border-slate-200 bg-slate-50 opacity-70"
                          }`}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-black text-slate-900">
                                  {
                                    categoria.nombre
                                  }
                                </h3>

                                {categoria.esSistema && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-indigo-700">
                                    <ShieldCheck className="h-3 w-3" />
                                    Base
                                  </span>
                                )}

                                <span
                                  className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
                                    categoria.activa
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-200 text-slate-500"
                                  }`}
                                >
                                  {categoria.activa
                                    ? "Activa"
                                    : "Inactiva"}
                                </span>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                                  {obtenerEtiquetaPresupuesto(
                                    categoria,
                                  )}
                                </span>

                                {categoria.requiereComentario && (
                                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                                    Comentario requerido
                                  </span>
                                )}

                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                                  Orden{" "}
                                  {
                                    categoria.orden
                                  }
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={
                                  procesando ||
                                  index ===
                                    0
                                }
                                onClick={() =>
                                  void onMover(
                                    categoria.id,
                                    "arriba",
                                  )
                                }
                                aria-label={`Subir ${categoria.nombre}`}
                                title="Subir"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                disabled={
                                  procesando ||
                                  index ===
                                    categoriasOrdenadas.length -
                                      1
                                }
                                onClick={() =>
                                  void onMover(
                                    categoria.id,
                                    "abajo",
                                  )
                                }
                                aria-label={`Bajar ${categoria.nombre}`}
                                title="Bajar"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>

                              {!categoria.esSistema && (
                                <>
                                  <button
                                    type="button"
                                    disabled={
                                      procesando
                                    }
                                    onClick={() =>
                                      comenzarEdicion(
                                        categoria,
                                      )
                                    }
                                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />

                                    Editar
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      procesando
                                    }
                                    onClick={() =>
                                      void onCambiarEstado(
                                        categoria,
                                        !categoria.activa,
                                      )
                                    }
                                    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition disabled:opacity-50 ${
                                      categoria.activa
                                        ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                                    }`}
                                  >
                                    {actualizando ? (
                                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                    ) : categoria.activa ? (
                                      <PowerOff className="h-3.5 w-3.5" />
                                    ) : (
                                      <Power className="h-3.5 w-3.5" />
                                    )}

                                    {categoria.activa
                                      ? "Desactivar"
                                      : "Activar"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              )}

              <div className="mt-5 rounded-3xl border border-indigo-100 bg-indigo-50 p-4">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />

                  <div>
                    <p className="text-xs font-black text-indigo-900">
                      Categorías base protegidas
                    </p>

                    <p className="mt-1 text-[11px] font-medium leading-5 text-indigo-700">
                      Supermercado, Gas y Otro no pueden editarse ni
                      desactivarse. Sí pueden cambiar de posición.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <form
              onSubmit={
                guardarFormulario
              }
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="categoria-nombre"
                  className="mb-1.5 block text-xs font-black text-slate-700"
                >
                  Nombre
                </label>

                <input
                  id="categoria-nombre"
                  type="text"
                  maxLength={100}
                  value={
                    formulario.nombre
                  }
                  onChange={(event) =>
                    setFormulario(
                      (
                        actual,
                      ) => ({
                        ...actual,

                        nombre:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Ej. Farmacia"
                  disabled={
                    procesando
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="categoria-presupuesto"
                  className="mb-1.5 block text-xs font-black text-slate-700"
                >
                  Aplicar al presupuesto
                </label>

                <select
                  id="categoria-presupuesto"
                  value={
                    formulario
                      .categoriaPresupuesto ??
                    ""
                  }
                  onChange={(event) => {
                    const value =
                      event.target.value;

                    setFormulario(
                      (
                        actual,
                      ) => ({
                        ...actual,

                        categoriaPresupuesto:
                          value ===
                          "comida"
                            ? "comida"
                            : value ===
                                "gas"
                              ? "gas"
                              : null,
                      }),
                    );
                  }}
                  disabled={
                    procesando
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
                >
                  <option value="">
                    Ninguno
                  </option>

                  <option value="comida">
                    Comida
                  </option>

                  <option value="gas">
                    Gas
                  </option>
                </select>

                <p className="mt-1.5 text-[11px] font-medium leading-5 text-slate-500">
                  Ninguno registra la compra y el saldo de la tarjeta, pero
                  no consume los límites de Comida o Gas.
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={
                    formulario
                      .requiereComentario
                  }
                  onChange={(event) =>
                    setFormulario(
                      (
                        actual,
                      ) => ({
                        ...actual,

                        requiereComentario:
                          event
                            .target
                            .checked,
                      }),
                    )
                  }
                  disabled={
                    procesando
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />

                <div>
                  <p className="text-xs font-black text-slate-800">
                    Solicitar comentario
                  </p>

                  <p className="mt-1 text-[11px] font-medium leading-5 text-slate-500">
                    El movimiento no podrá guardarse sin explicar el gasto.
                  </p>
                </div>
              </label>

              {errorLocal && (
                <p
                  role="alert"
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700"
                >
                  {errorLocal}
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={
                    volverLista
                  }
                  disabled={
                    procesando
                  }
                  className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    procesando
                  }
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {procesando ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : vista ===
                    "crear" ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}

                  {vista ===
                  "crear"
                    ? "Crear categoría"
                    : "Guardar cambios"}
                </button>
              </div>

              {vista ===
                "editar" &&
                editando && (
                  <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-[11px] font-bold text-emerald-700">
                    <Check className="h-4 w-4" />

                    El historial anterior conservará el nombre con el que fue
                    registrado originalmente.
                  </div>
                )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default CardCategoriesManager;