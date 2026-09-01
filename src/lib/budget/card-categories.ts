import type {
  CategoriaVariable,
} from "@/lib/budget/types";

/**
 * ============================================================
 * CATEGORÍAS DE COMPRAS CON TARJETA
 * ============================================================
 *
 * Las categorías de tarjeta describen QUÉ se compró.
 *
 * Son independientes de CategoriaVariable:
 *
 * CategoriaVariable:
 *   - comida
 *   - gas
 *
 * controla límites, carry-over y resúmenes del presupuesto.
 *
 * CategoriaTarjeta:
 *   - Supermercado
 *   - Gas
 *   - Otro
 *   - Farmacia
 *   - Restaurantes
 *   - etc.
 *
 * es una clasificación configurable de compras.
 *
 * Una CategoriaTarjeta puede opcionalmente afectar una
 * CategoriaVariable mediante `categoriaPresupuesto`.
 *
 * Ejemplos:
 *
 * Supermercado -> comida
 * Gas          -> gas
 * Otro         -> null
 */

/**
 * Identificador estable de una categoría.
 *
 * No utilizamos un union type como:
 *
 * "supermercado" | "gas" | "otro"
 *
 * porque las categorías podrán ser creadas dinámicamente
 * por cada usuario en Firestore.
 */
export type CategoriaTarjetaId =
  string;

/**
 * Relación opcional entre una categoría de compra y una
 * categoría controlada por el presupuesto.
 *
 * null significa que la compra:
 *
 * - sí aumenta el saldo de la tarjeta;
 * - sí aparece en el historial;
 * - sí participa en el flujo financiero;
 * - pero NO consume el límite de Comida ni Gas.
 */
export type CategoriaPresupuestoTarjeta =
  CategoriaVariable | null;

/**
 * Categoría configurable utilizada para clasificar
 * compras realizadas con tarjetas.
 *
 * Futuramente se almacenará en:
 *
 * users/{uid}/categoriasTarjeta/{categoriaId}
 */
export interface CategoriaTarjeta {
  /**
   * ID estable del documento.
   *
   * Ejemplos:
   *
   * supermercado
   * gas
   * otro
   * farmacia
   * restaurantes
   */
  id:
    CategoriaTarjetaId;

  /**
   * Nombre visible para el usuario.
   */
  nombre:
    string;

  /**
   * Categoría del presupuesto que debe consumir
   * esta compra.
   *
   * Ejemplos:
   *
   * supermercado -> "comida"
   * gas          -> "gas"
   * otro         -> null
   */
  categoriaPresupuesto:
    CategoriaPresupuestoTarjeta;

  /**
   * Define si el formulario debe solicitar una
   * explicación adicional.
   *
   * "Otro" utilizará true inicialmente.
   */
  requiereComentario:
    boolean;

  /**
   * Controla si puede utilizarse en gastos nuevos.
   *
   * Una categoría desactivada conserva el historial
   * de movimientos antiguos.
   */
  activa:
    boolean;

  /**
   * Posición de la categoría en la interfaz.
   *
   * Ejemplo:
   *
   * Supermercado -> 10
   * Gas          -> 20
   * Otro         -> 999
   */
  orden:
    number;

  /**
   * Indica si pertenece al conjunto inicial creado
   * automáticamente por la aplicación.
   *
   * Esto permitirá distinguir:
   *
   * - categorías base;
   * - categorías creadas por el usuario.
   *
   * No implica que la categoría sea inmutable.
   */
  esSistema:
    boolean;

  /**
   * Marcas de tiempo normalizadas a ISO en el cliente.
   *
   * Son opcionales para que el modelo también pueda
   * representar las categorías iniciales antes de
   * persistirlas en Firestore.
   */
  creadoEn?:
    string;

  actualizadoEn?:
    string;
}

/**
 * Datos requeridos para crear una categoría.
 *
 * El ID se generará por separado y las marcas de tiempo
 * serán asignadas por Firestore.
 */
export interface NuevaCategoriaTarjeta {
  nombre:
    string;

  categoriaPresupuesto:
    CategoriaPresupuestoTarjeta;

  requiereComentario:
    boolean;

  activa:
    boolean;

  orden:
    number;

  esSistema:
    boolean;
}

/**
 * Campos modificables de una categoría existente.
 *
 * El ID no puede modificarse.
 */
export type ActualizacionCategoriaTarjeta =
  Partial<
    NuevaCategoriaTarjeta
  >;

/**
 * Información que quedará guardada dentro de cada compra.
 *
 * Aunque la definición de la categoría cambie en el futuro,
 * el movimiento conservará una fotografía de cómo estaba
 * clasificado cuando fue registrado.
 *
 * Ejemplo:
 *
 * {
 *   categoriaTarjetaId: "otro",
 *   categoriaTarjetaNombre: "Otro",
 *   comentarioCategoria: "Medicinas en CVS"
 * }
 */
export interface ClasificacionCompraTarjeta {
  /**
   * Categoría seleccionada al registrar el gasto.
   */
  categoriaTarjetaId:
    CategoriaTarjetaId | null;

  /**
   * Snapshot del nombre de la categoría.
   *
   * Evita que movimientos históricos pierdan su etiqueta
   * si posteriormente la categoría cambia de nombre.
   */
  categoriaTarjetaNombre:
    string | null;

  /**
   * Comentario adicional de la clasificación.
   *
   * Será obligatorio cuando la categoría seleccionada
   * tenga requiereComentario === true.
   */
  comentarioCategoria:
    string;
}

/**
 * Resultado de resolver cómo una categoría de tarjeta
 * afecta al presupuesto.
 *
 * Este tipo será útil posteriormente en registrarMovimiento
 * y en los resúmenes.
 */
export interface ClasificacionPresupuestariaCompra {
  categoriaTarjetaId:
    CategoriaTarjetaId;

  categoriaTarjetaNombre:
    string;

  categoriaPresupuesto:
    CategoriaPresupuestoTarjeta;

  comentario:
    string;
}

/**
 * Guarda los IDs conocidos de las categorías que
 * crearemos inicialmente.
 *
 * Importante:
 *
 * Estos NO limitan las categorías posibles. Cualquier otra
 * categoría seguirá utilizando un ID string normal.
 */
export const CATEGORIA_TARJETA_IDS_SISTEMA = {
  supermercado:
    "supermercado",

  gas:
    "gas",

  otro:
    "otro",
} as const;

/**
 * Tipo auxiliar para los IDs iniciales del sistema.
 *
 * Resultado:
 *
 * "supermercado" | "gas" | "otro"
 *
 * Se utiliza únicamente cuando necesitamos trabajar
 * específicamente con esas tres categorías iniciales.
 */
export type CategoriaTarjetaSistemaId =
  (
    typeof CATEGORIA_TARJETA_IDS_SISTEMA
  )[keyof typeof CATEGORIA_TARJETA_IDS_SISTEMA];