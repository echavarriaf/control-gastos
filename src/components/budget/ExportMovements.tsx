"use client";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { descargarExportacion } from "@/lib/export/client";
import type { OpcionesExportacion } from "@/lib/export/types";

const campo = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50";
export function ExportMovements({ mesSeleccionado }: { mesSeleccionado: string }) {
  const { user, authorized } = useAuth();
  return user && authorized ? <ExportarUsuario key={`${user.uid}:${mesSeleccionado}`} uid={user.uid} mes={mesSeleccionado} /> : null;
}
function ExportarUsuario({ uid, mes }: { uid: string; mes: string }) {
  const [year, month] = mes.split("-").map(Number);
  const [desde, setDesde] = useState(`${mes}-01`);
  const [hasta, setHasta] = useState(`${mes}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`);
  const [formato, setFormato] = useState<OpcionesExportacion["formato"]>("movimientos");
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  async function exportar(event: FormEvent) {
    event.preventDefault();
    if (descargando) return;
    setDescargando(true); setError(null); setMensaje(null);
    try {
      const resultado = await descargarExportacion(uid, { desde, hasta, formato, zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone });
      setMensaje(`Descarga iniciada: ${resultado.nombre}${resultado.registros === null ? "" : ` (${resultado.registros} registros de origen)`}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo exportar el historial."); }
    finally { setDescargando(false); }
  }
  return <details className="rounded-3xl border border-slate-200 bg-white">
    <summary className="cursor-pointer p-4 text-sm font-black text-slate-800">Exportar a CSV / Excel</summary>
    <form onSubmit={exportar} className="space-y-4 border-t border-slate-100 p-4">
      <p className="text-xs leading-5 text-slate-600">Descarga un CSV compatible con Excel, con ingresos, gastos, pagos y movimientos de cuenta del intervalo elegido. Incluye historial anterior al saldo base y permite hasta 366 días por archivo.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-700">Desde
          <input type="date" required value={desde} onChange={event => setDesde(event.target.value)} disabled={descargando} className={campo} />
        </label>
        <label className="text-xs font-bold text-slate-700">Hasta
          <input type="date" required value={hasta} onChange={event => setHasta(event.target.value)} disabled={descargando} className={campo} />
        </label>
      </div>
      <label className="block text-xs font-bold text-slate-700">Contenido del archivo
        <select value={formato} onChange={event => setFormato(event.target.value === "resumen" ? "resumen" : "movimientos")} disabled={descargando} className={campo}>
          <option value="movimientos">Movimientos detallados</option>
          <option value="resumen">Resumen por mes y quincena</option>
        </select>
      </label>
      <p className="text-xs leading-5 text-slate-500">Los estados y el origen de los pagos se conservan. El resumen separa tipos, categorías, estados y entradas o salidas. Sus totales son importes registrados; no representan un saldo bancario ni suman compras y pagos como un único gasto.</p>
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      {mensaje && <p role="status" className="text-xs font-semibold text-emerald-800">{mensaje}</p>}
      <button type="submit" disabled={descargando} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{descargando ? "Preparando archivo…" : "Descargar CSV"}</button>
    </form>
  </details>;
}
