import { redondearMoneda } from "./expense-account/utils";
import { esFechaCalendarioValida } from "./expense-account/validation";

export interface MetaAhorro {
  id: string;
  nombre: string;
  objetivo: number;
  apartado: number;
  fechaObjetivo: string | null;
  notas: string;
  archivada: boolean;
}
export type DatosMetaAhorro = Pick<MetaAhorro, "nombre" | "objetivo" | "fechaObjetivo" | "notas">;

export function validarMetaAhorro(input: DatosMetaAhorro): DatosMetaAhorro {
  const nombre = typeof input.nombre === "string" ? input.nombre.trim() : "";
  const notas = typeof input.notas === "string" ? input.notas.trim() : "";
  if (!nombre || nombre.length > 100) throw new Error("Escribe un nombre de hasta 100 caracteres.");
  if (!Number.isFinite(input.objetivo) || input.objetivo <= 0 || input.objetivo > 1_000_000 || redondearMoneda(input.objetivo) <= 0) {
    throw new Error("El objetivo debe estar entre $0.01 y $1,000,000.");
  }
  if (notas.length > 500) throw new Error("Las notas no pueden superar 500 caracteres.");
  if (input.fechaObjetivo !== null && !esFechaCalendarioValida(input.fechaObjetivo)) throw new Error("Selecciona una fecha objetivo válida.");
  return { nombre, objetivo: redondearMoneda(input.objetivo), fechaObjetivo: input.fechaObjetivo, notas };
}
export function normalizarMetaAhorro(id: string, input: Record<string, unknown>): MetaAhorro | null {
  if (typeof input.nombre !== "string" || typeof input.objetivo !== "number" || typeof input.apartado !== "number" ||
    typeof input.notas !== "string" || typeof input.archivada !== "boolean" ||
    !(input.fechaObjetivo === null || typeof input.fechaObjetivo === "string")) return null;
  try {
    const datos = validarMetaAhorro({ nombre: input.nombre, objetivo: input.objetivo, fechaObjetivo: input.fechaObjetivo, notas: input.notas });
    if (!Number.isFinite(input.apartado) || input.apartado < 0 || input.apartado > input.objetivo || (input.archivada && input.apartado !== 0)) return null;
    return { id, ...datos, apartado: redondearMoneda(input.apartado), archivada: input.archivada };
  } catch { return null; }
}
export function cambiarApartado(meta: MetaAhorro, accion: "apartar" | "liberar", importe: number): number {
  if (meta.archivada) throw new Error("La meta está archivada.");
  if (!Number.isFinite(importe) || importe <= 0 || redondearMoneda(importe) <= 0 || importe > 1_000_000) throw new Error("Escribe un importe válido mayor que cero.");
  const siguiente = redondearMoneda(meta.apartado + (accion === "apartar" ? 1 : -1) * redondearMoneda(importe));
  if (siguiente < 0) throw new Error("No puedes liberar más dinero del apartado de esta meta.");
  if (siguiente > meta.objetivo) throw new Error("El apartado no puede superar el objetivo. Puedes aumentar el objetivo primero.");
  return siguiente;
}
export function totalAhorroApartado(metas: Pick<MetaAhorro, "apartado" | "archivada">[]): number {
  return redondearMoneda(metas.reduce((total, meta) => total + (!meta.archivada && Number.isFinite(meta.apartado) && meta.apartado > 0 ? redondearMoneda(meta.apartado) : 0), 0));
}
