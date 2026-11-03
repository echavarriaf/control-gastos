"use client";
import { auth } from "@/lib/firebase";
import { validarOpcionesExportacion } from "./csv";
import type { OpcionesExportacion } from "./types";

export async function descargarExportacion(uid: string, opciones: OpcionesExportacion) {
  const params = new URLSearchParams({ ...opciones });
  validarOpcionesExportacion(params);
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error("La sesión cambió. Actualiza la pantalla antes de exportar.");
  const token = await user.getIdToken();
  const response = await fetch(`/api/export/movements?${params}`, {
    method: "GET", credentials: "same-origin", cache: "no-store", headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const payload: { error?: string } | null = await response.json().catch(() => null);
    throw new Error(payload?.error || "No se pudo descargar la exportación.");
  }
  if (!response.headers.get("Content-Type")?.startsWith("text/csv")) throw new Error("El servidor no devolvió un archivo CSV válido.");
  const blob = await response.blob();
  if (auth.currentUser?.uid !== uid) throw new Error("La sesión cambió. No se ha iniciado la descarga.");
  const nombre = `${opciones.formato}_${opciones.desde}_${opciones.hasta}.csv`;
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  try {
    enlace.href = url; enlace.download = nombre;
    document.body.appendChild(enlace); enlace.click();
  } finally {
    enlace.remove();
    // Safari needs the object URL to remain valid while the download starts.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  const contador = response.headers.get("X-Export-Record-Count");
  const cantidad = contador === null ? NaN : Number(contador);
  return { nombre, registros: Number.isInteger(cantidad) && cantidad >= 0 ? cantidad : null };
}
