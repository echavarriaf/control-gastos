"use client";

import {
  addDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useAuth,
} from "@/contexts/AuthContext";

import type {
  ActualizacionCategoriaTarjeta,
  CategoriaPresupuestoTarjeta,
  CategoriaTarjeta,
  NuevaCategoriaTarjeta,
} from "@/lib/budget/card-categories";

import {
  db,
} from "@/lib/firebase";

import {
  getUserCollection,
  getUserDocument,
} from "@/lib/firestore/user-paths";

interface CategoriaInicial {
  id: string;

  datos:
    NuevaCategoriaTarjeta;
}

export type DireccionCategoria =
  | "arriba"
  | "abajo";

/**
 * ============================================================
 * CATEGORÍAS BASE
 * ============================================================
 */

const CATEGORIAS_INICIALES:
  readonly CategoriaInicial[] = [
    {
      id:
        "supermercado",

      datos: {
        nombre:
          "Supermercado",

        categoriaPresupuesto:
          "comida",

        requiereComentario:
          false,

        activa:
          true,

        orden:
          10,

        esSistema:
          true,
      },
    },

    {
      id:
        "gas",

      datos: {
        nombre:
          "Gas",

        categoriaPresupuesto:
          "gas",

        requiereComentario:
          false,

        activa:
          true,

        orden:
          20,

        esSistema:
          true,
      },
    },

    {
      id:
        "otro",

      datos: {
        nombre:
          "Otro",

        categoriaPresupuesto:
          null,

        requiereComentario:
          true,

        activa:
          true,

        orden:
          999,

        esSistema:
          true,
      },
    },
  ];

/**
 * ============================================================
 * NORMALIZACIÓN
 * ============================================================
 */

function normalizarFechaDocumento(
  valor:
    unknown,
): string | undefined {
  if (
    typeof valor ===
      "string" &&
    valor.trim()
  ) {
    return valor.trim();
  }

  if (
    typeof valor ===
      "object" &&
    valor !==
      null &&
    "toDate" in valor
  ) {
    const convertir =
      (
        valor as {
          toDate?: () => Date;
        }
      ).toDate;

    if (
      typeof convertir ===
      "function"
    ) {
      const fecha =
        convertir.call(
          valor,
        );

      if (
        fecha instanceof
          Date &&
        !Number.isNaN(
          fecha.getTime(),
        )
      ) {
        return fecha
          .toISOString();
      }
    }
  }

  return undefined;
}

function normalizarCategoriaPresupuesto(
  valor:
    unknown,
): CategoriaPresupuestoTarjeta {
  if (
    valor ===
      "comida" ||
    valor ===
      "gas"
  ) {
    return valor;
  }

  return null;
}

function normalizarOrden(
  valor:
    unknown,
): number {
  const numero =
    Number(
      valor,
    );

  if (
    !Number.isFinite(
      numero,
    )
  ) {
    return 999;
  }

  const entero =
    Math.trunc(
      numero,
    );

  return entero >= 0
    ? entero
    : 999;
}

function normalizarDocumento(
  id:
    string,

  data:
    Record<
      string,
      unknown
    >,
): CategoriaTarjeta {
  const nombre =
    typeof data.nombre ===
      "string" &&
    data.nombre.trim()
      ? data.nombre.trim()
      : "Categoría";

  return {
    id,

    nombre,

    categoriaPresupuesto:
      normalizarCategoriaPresupuesto(
        data.categoriaPresupuesto,
      ),

    requiereComentario:
      typeof data
        .requiereComentario ===
      "boolean"
        ? data.requiereComentario
        : false,

    activa:
      typeof data.activa ===
      "boolean"
        ? data.activa
        : true,

    orden:
      normalizarOrden(
        data.orden,
      ),

    esSistema:
      typeof data.esSistema ===
      "boolean"
        ? data.esSistema
        : false,

    creadoEn:
      normalizarFechaDocumento(
        data.creadoEn,
      ),

    actualizadoEn:
      normalizarFechaDocumento(
        data.actualizadoEn,
      ),
  };
}

/**
 * ============================================================
 * ORDEN
 * ============================================================
 */

function ordenarCategorias(
  a:
    CategoriaTarjeta,

  b:
    CategoriaTarjeta,
): number {
  if (
    a.activa !==
    b.activa
  ) {
    return a.activa
      ? -1
      : 1;
  }

  if (
    a.orden !==
    b.orden
  ) {
    return (
      a.orden -
      b.orden
    );
  }

  return a.nombre
    .localeCompare(
      b.nombre,
      "es",
      {
        sensitivity:
          "base",
      },
    );
}

/**
 * Orden utilizado específicamente para el administrador.
 *
 * Aquí no separamos activas/inactivas porque queremos conservar
 * una secuencia estable para los botones subir/bajar.
 */
function ordenarCategoriasAdministrador(
  categorias:
    CategoriaTarjeta[],
): CategoriaTarjeta[] {
  return [
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
  );
}

/**
 * ============================================================
 * VALIDACIÓN
 * ============================================================
 */

function normalizarNombre(
  nombre:
    string,
): string {
  return nombre
    .trim()
    .replace(
      /\s+/g,
      " ",
    );
}

function validarNombre(
  nombre:
    string,
): string | null {
  const normalizado =
    normalizarNombre(
      nombre,
    );

  if (!normalizado) {
    return "Escribe un nombre para la categoría.";
  }

  if (
    normalizado.length >
    100
  ) {
    return "El nombre de la categoría no puede superar 100 caracteres.";
  }

  return null;
}

function existeNombreDuplicado(
  categorias:
    CategoriaTarjeta[],

  nombre:
    string,

  ignorarId?:
    string,
): boolean {
  const buscado =
    normalizarNombre(
      nombre,
    )
      .toLocaleLowerCase(
        "es",
      );

  return categorias.some(
    (
      categoria,
    ) =>
      categoria.id !==
        ignorarId &&
      normalizarNombre(
        categoria.nombre,
      )
        .toLocaleLowerCase(
          "es",
        ) ===
        buscado,
  );
}

/**
 * ============================================================
 * INICIALIZACIÓN
 * ============================================================
 */

async function crearCategoriasInicialesFaltantes(
  uid:
    string,

  idsPresentes:
    ReadonlySet<string>,
): Promise<void> {
  const faltantes =
    CATEGORIAS_INICIALES.filter(
      (
        categoria,
      ) =>
        !idsPresentes.has(
          categoria.id,
        ),
    );

  if (
    faltantes.length ===
    0
  ) {
    return;
  }

  const batch =
    writeBatch(
      db,
    );

  faltantes.forEach(
    (
      categoria,
    ) => {
      batch.set(
        getUserDocument(
          uid,
          "categoriasTarjeta",
          categoria.id,
        ),

        {
          ...categoria.datos,

          creadoEn:
            serverTimestamp(),

          actualizadoEn:
            serverTimestamp(),
        },
      );
    },
  );

  await batch.commit();
}

/**
 * ============================================================
 * HOOK
 * ============================================================
 */

export function useCardCategories() {
  const {
    user,
    authorized,
  } =
    useAuth();

  const uid =
    authorized
      ? user?.uid ??
        null
      : null;

  const [
    categorias,
    setCategorias,
  ] =
    useState<
      CategoriaTarjeta[]
    >(
      [],
    );

  const [
    cargando,
    setCargando,
  ] =
    useState(
      true,
    );

  const [
    inicializando,
    setInicializando,
  ] =
    useState(
      false,
    );

  const [
    guardando,
    setGuardando,
  ] =
    useState(
      false,
    );

  const [
    actualizandoId,
    setActualizandoId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    reordenando,
    setReordenando,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const inicializacionEnCursoRef =
    useRef(
      false,
    );

  /**
   * ============================================================
   * SUSCRIPCIÓN
   * ============================================================
   */

  useEffect(
    () => {
      setCategorias(
        [],
      );

      setError(
        null,
      );

      setInicializando(
        false,
      );

      setGuardando(
        false,
      );

      setActualizandoId(
        null,
      );

      setReordenando(
        false,
      );

      inicializacionEnCursoRef.current =
        false;

      if (
        !uid
      ) {
        setCargando(
          false,
        );

        return;
      }

      setCargando(
        true,
      );

      const referencia =
        getUserCollection(
          uid,
          "categoriasTarjeta",
        );

      return onSnapshot(
        referencia,

        (
          snapshot,
        ) => {
          const registros =
            snapshot.docs
              .map(
                (
                  documento,
                ) =>
                  normalizarDocumento(
                    documento.id,
                    documento.data(),
                  ),
              )
              .sort(
                ordenarCategorias,
              );

          setCategorias(
            registros,
          );

          setCargando(
            false,
          );

          const idsPresentes =
            new Set<string>(
              snapshot.docs.map(
                (
                  documento,
                ) =>
                  documento.id,
              ),
            );

          const faltanCategoriasBase =
            CATEGORIAS_INICIALES.some(
              (
                categoria,
              ) =>
                !idsPresentes.has(
                  categoria.id,
                ),
            );

          if (
            !faltanCategoriasBase ||
            inicializacionEnCursoRef.current
          ) {
            return;
          }

          inicializacionEnCursoRef.current =
            true;

          setInicializando(
            true,
          );

          void crearCategoriasInicialesFaltantes(
            uid,
            idsPresentes,
          )
            .catch(
              (
                initializationError,
              ) => {
                console.error(
                  "No se pudieron crear las categorías iniciales de tarjeta:",
                  initializationError,
                );

                setError(
                  "No se pudieron preparar las categorías iniciales de compras.",
                );
              },
            )
            .finally(
              () => {
                inicializacionEnCursoRef.current =
                  false;

                setInicializando(
                  false,
                );
              },
            );
        },

        (
          snapshotError,
        ) => {
          console.error(
            "No se pudieron cargar las categorías de tarjeta:",
            snapshotError,
          );

          setCategorias(
            [],
          );

          setError(
            "No se pudieron cargar las categorías de compras.",
          );

          setCargando(
            false,
          );

          setInicializando(
            false,
          );

          inicializacionEnCursoRef.current =
            false;
        },
      );
    },
    [
      uid,
    ],
  );

  /**
   * ============================================================
   * CREAR
   * ============================================================
   */

  const crearCategoria =
    useCallback(
      async (
        datos:
          NuevaCategoriaTarjeta,
      ): Promise<boolean> => {
        if (!uid) {
          setError(
            "No existe un usuario autorizado para crear la categoría.",
          );

          return false;
        }

        const nombre =
          normalizarNombre(
            datos.nombre,
          );

        const errorNombre =
          validarNombre(
            nombre,
          );

        if (errorNombre) {
          setError(
            errorNombre,
          );

          return false;
        }

        if (
          existeNombreDuplicado(
            categorias,
            nombre,
          )
        ) {
          setError(
            "Ya existe una categoría con ese nombre.",
          );

          return false;
        }

        const orden =
          Math.max(
            0,
            Math.min(
              100000,
              Math.trunc(
                datos.orden,
              ),
            ),
          );

        setGuardando(
          true,
        );

        setError(
          null,
        );

        try {
          await addDoc(
            getUserCollection(
              uid,
              "categoriasTarjeta",
            ),

            {
              nombre,

              categoriaPresupuesto:
                datos
                  .categoriaPresupuesto,

              requiereComentario:
                Boolean(
                  datos
                    .requiereComentario,
                ),

              activa:
                Boolean(
                  datos.activa,
                ),

              orden,

              /**
               * Una categoría creada desde la UI nunca puede
               * convertirse en categoría interna del sistema.
               */
              esSistema:
                false,

              creadoEn:
                serverTimestamp(),

              actualizadoEn:
                serverTimestamp(),
            },
          );

          return true;
        } catch (
          guardarError
        ) {
          console.error(
            "No se pudo crear la categoría de tarjeta:",
            guardarError,
          );

          setError(
            "No se pudo crear la categoría.",
          );

          return false;
        } finally {
          setGuardando(
            false,
          );
        }
      },
      [
        categorias,
        uid,
      ],
    );

  /**
   * ============================================================
   * ACTUALIZAR
   * ============================================================
   */

  const actualizarCategoria =
    useCallback(
      async (
        categoria:
          CategoriaTarjeta,

        cambios:
          ActualizacionCategoriaTarjeta,
      ): Promise<boolean> => {
        if (!uid) {
          setError(
            "No existe un usuario autorizado para actualizar la categoría.",
          );

          return false;
        }

        /**
         * Las categorías base permanecen protegidas.
         *
         * Se pueden mover usando moverCategoria(), pero no cambiar
         * su función interna desde el administrador.
         */
        if (
          categoria.esSistema
        ) {
          setError(
            "Las categorías base del sistema no se pueden editar.",
          );

          return false;
        }

        const nombre =
          normalizarNombre(
            cambios.nombre ??
              categoria.nombre,
          );

        const errorNombre =
          validarNombre(
            nombre,
          );

        if (errorNombre) {
          setError(
            errorNombre,
          );

          return false;
        }

        if (
          existeNombreDuplicado(
            categorias,
            nombre,
            categoria.id,
          )
        ) {
          setError(
            "Ya existe otra categoría con ese nombre.",
          );

          return false;
        }

        const categoriaPresupuesto =
          cambios
            .categoriaPresupuesto !==
          undefined
            ? cambios
                .categoriaPresupuesto
            : categoria
                .categoriaPresupuesto;

        const requiereComentario =
          cambios
            .requiereComentario !==
          undefined
            ? Boolean(
                cambios
                  .requiereComentario,
              )
            : categoria
                .requiereComentario;

        const activa =
          cambios.activa !==
          undefined
            ? Boolean(
                cambios.activa,
              )
            : categoria.activa;

        const orden =
          cambios.orden !==
          undefined
            ? Math.max(
                0,
                Math.min(
                  100000,
                  Math.trunc(
                    cambios.orden,
                  ),
                ),
              )
            : categoria.orden;

        setActualizandoId(
          categoria.id,
        );

        setError(
          null,
        );

        try {
          await updateDoc(
            getUserDocument(
              uid,
              "categoriasTarjeta",
              categoria.id,
            ),

            {
              nombre,

              categoriaPresupuesto,

              requiereComentario,

              activa,

              orden,

              esSistema:
                false,

              actualizadoEn:
                serverTimestamp(),
            },
          );

          return true;
        } catch (
          actualizarError
        ) {
          console.error(
            "No se pudo actualizar la categoría de tarjeta:",
            actualizarError,
          );

          setError(
            "No se pudo actualizar la categoría.",
          );

          return false;
        } finally {
          setActualizandoId(
            null,
          );
        }
      },
      [
        categorias,
        uid,
      ],
    );

  /**
   * ============================================================
   * ACTIVAR / DESACTIVAR
   * ============================================================
   */

  const cambiarEstado =
    useCallback(
      async (
        categoria:
          CategoriaTarjeta,

        activa:
          boolean,
      ): Promise<boolean> => {
        if (
          categoria.esSistema
        ) {
          setError(
            "Las categorías base del sistema siempre deben permanecer activas.",
          );

          return false;
        }

        return actualizarCategoria(
          categoria,
          {
            activa,
          },
        );
      },
      [
        actualizarCategoria,
      ],
    );

  /**
   * ============================================================
   * REORDENAR
   * ============================================================
   */

  const moverCategoria =
    useCallback(
      async (
        categoriaId:
          string,

        direccion:
          DireccionCategoria,
      ): Promise<boolean> => {
        if (!uid) {
          setError(
            "No existe un usuario autorizado para ordenar las categorías.",
          );

          return false;
        }

        const ordenadas =
          ordenarCategoriasAdministrador(
            categorias,
          );

        const indice =
          ordenadas.findIndex(
            (
              categoria,
            ) =>
              categoria.id ===
              categoriaId,
          );

        if (
          indice === -1
        ) {
          return false;
        }

        const nuevoIndice =
          direccion ===
          "arriba"
            ? indice - 1
            : indice + 1;

        if (
          nuevoIndice < 0 ||
          nuevoIndice >=
            ordenadas.length
        ) {
          return false;
        }

        const reordenadas =
          [
            ...ordenadas,
          ];

        [
          reordenadas[
            indice
          ],
          reordenadas[
            nuevoIndice
          ],
        ] = [
          reordenadas[
            nuevoIndice
          ],
          reordenadas[
            indice
          ],
        ];

        setReordenando(
          true,
        );

        setError(
          null,
        );

        try {
          const batch =
            writeBatch(
              db,
            );

          reordenadas.forEach(
            (
              categoria,
              posicion,
            ) => {
              batch.update(
                getUserDocument(
                  uid,
                  "categoriasTarjeta",
                  categoria.id,
                ),

                {
                  orden:
                    (
                      posicion +
                      1
                    ) *
                    10,

                  actualizadoEn:
                    serverTimestamp(),
                },
              );
            },
          );

          await batch.commit();

          return true;
        } catch (
          ordenarError
        ) {
          console.error(
            "No se pudieron ordenar las categorías:",
            ordenarError,
          );

          setError(
            "No se pudo cambiar el orden de las categorías.",
          );

          return false;
        } finally {
          setReordenando(
            false,
          );
        }
      },
      [
        categorias,
        uid,
      ],
    );

  /**
   * ============================================================
   * DERIVADOS
   * ============================================================
   */

  const categoriasActivas =
    useMemo(
      () =>
        categorias.filter(
          (
            categoria,
          ) =>
            categoria.activa,
        ),
      [
        categorias,
      ],
    );

  const categoriasPorId =
    useMemo(
      () =>
        new Map(
          categorias.map(
            (
              categoria,
            ) => [
              categoria.id,
              categoria,
            ],
          ),
        ),
      [
        categorias,
      ],
    );

  const categoriasConPresupuesto =
    useMemo(
      () =>
        categoriasActivas.filter(
          (
            categoria,
          ) =>
            categoria
              .categoriaPresupuesto !==
            null,
        ),
      [
        categoriasActivas,
      ],
    );

  const categoriasSinPresupuesto =
    useMemo(
      () =>
        categoriasActivas.filter(
          (
            categoria,
          ) =>
            categoria
              .categoriaPresupuesto ===
            null,
        ),
      [
        categoriasActivas,
      ],
    );

  const categoriasAdministrador =
    useMemo(
      () =>
        ordenarCategoriasAdministrador(
          categorias,
        ),
      [
        categorias,
      ],
    );

  return {
    uid,

    categorias,
    categoriasActivas,
    categoriasAdministrador,
    categoriasPorId,
    categoriasConPresupuesto,
    categoriasSinPresupuesto,

    cargando,
    inicializando,

    guardando,
    actualizandoId,
    reordenando,

    error,

    crearCategoria,
    actualizarCategoria,
    cambiarEstado,
    moverCategoria,

    limpiarError:
      () =>
        setError(
          null,
        ),
  };
}

export type CardCategoriesController =
  ReturnType<
    typeof useCardCategories
  >;