"use client";
import { auth } from "@/lib/firebase";
import type { ColeccionRecuperable, MovimientoEliminado, PaginaPapelera } from "./types";

export const EVENTO_PAPELERA = "presupuesto:papelera";
export interface CambioPapelera { uid: string; accion: "eliminado" | "restaurado"; movimiento: MovimientoEliminado }
async function solicitar(uid: string, metodo: "GET" | "DELETE" | "POST", datos?: object, cursor?: string) {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error("La sesión cambió. Actualiza la pantalla antes de continuar.");
  const token = await user.getIdToken();
  const response = await fetch(`/api/movements/trash${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {
    method: metodo, credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(datos ? { body: JSON.stringify(datos) } : {}),
  });
  const payload: { ok?: boolean; error?: string; movimiento?: MovimientoEliminado; movimientos?: MovimientoEliminado[]; siguiente?: string | null } | null
    = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || "No se pudo completar la operación. Actualiza la papelera para comprobar su estado.");
  return payload;
}
function notificar(cambio: CambioPapelera) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<CambioPapelera>(EVENTO_PAPELERA, { detail: cambio }));
}
export async function enviarAPapelera(uid: string, coleccion: ColeccionRecuperable, documentoId: string) {
  const payload = await solicitar(uid, "DELETE", { coleccion, documentoId });
  if (!payload.movimiento) throw new Error("Actualiza la papelera para comprobar el movimiento eliminado.");
  notificar({ uid, accion: "eliminado", movimiento: payload.movimiento });
  return payload.movimiento;
}
export async function recuperarDePapelera(uid: string, id: string) {
  const payload = await solicitar(uid, "POST", { id });
  if (!payload.movimiento) throw new Error("Actualiza la papelera para comprobar el movimiento recuperado.");
  notificar({ uid, accion: "restaurado", movimiento: payload.movimiento });
  return payload.movimiento;
}
export async function obtenerPapelera(uid: string, cursor?: string): Promise<PaginaPapelera> {
  const payload = await solicitar(uid, "GET", undefined, cursor);
  if (!Array.isArray(payload.movimientos)) throw new Error("No se pudo leer la papelera.");
  return { movimientos: payload.movimientos, siguiente: payload.siguiente ?? null };
}
