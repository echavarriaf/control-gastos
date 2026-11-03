"use client";

import { useState, type FormEvent } from "react";
import type { SavingsGoalsController } from "@/hooks/useSavingsGoals";
import type { MetaAhorro } from "@/lib/budget/savings-goals";
import { redondearMoneda } from "@/lib/budget/expense-account/utils";

const moneda = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const campo = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50";
const boton = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50";
interface Props { ahorros: SavingsGoalsController; disponibleReal: number | null; hoy: string }

export function SavingsGoals({ ahorros, disponibleReal, hoy }: Props) {
  const [editando, setEditando] = useState<MetaAhorro | "nueva" | null>(null);
  const [moviendo, setMoviendo] = useState<{ id: string; accion: "apartar" | "liberar" } | null>(null);
  const bloqueado = ahorros.cargando || Boolean(ahorros.errorCarga) || Boolean(ahorros.guardandoId);
  return <details className="rounded-2xl border border-slate-200 bg-white">
    <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-800">Metas de ahorro</summary>
    <div className="space-y-4 border-t border-slate-100 p-4">
      <p className="text-xs leading-5 text-slate-600">Aparta dinero de esta cuenta para tus metas. Reduce el disponible para gastar, sin cambiar el saldo bancario ni registrar una transferencia. Las metas alcanzadas conservan su apartado hasta que lo liberes.</p>
      {ahorros.error && <p role="alert" className="text-sm font-semibold text-rose-700">{ahorros.error}</p>}
      {ahorros.errorCarga && <button type="button" onClick={ahorros.reintentar} className={boton}>Volver a cargar metas</button>}
      {ahorros.cargando && <p role="status" className="text-xs text-slate-500">Cargando metas de ahorro…</p>}
      <button type="button" disabled={bloqueado} onClick={() => { ahorros.limpiarError(); setEditando("nueva"); setMoviendo(null); }} className={boton}>Nueva meta</button>
      {editando && <EditorMeta key={editando === "nueva" ? "nueva" : editando.id} meta={editando === "nueva" ? null : editando} ahorros={ahorros} onCerrar={() => setEditando(null)} />}
      {!ahorros.cargando && !ahorros.errorCarga && ahorros.metas.length === 0 && <p className="text-xs text-slate-500">Crea tu primera meta para emergencias, viajes o una compra.</p>}
      <ul className="space-y-3">{ahorros.metas.map(meta => <li key={meta.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><h3 className="break-words text-sm font-black text-slate-800">{meta.nombre}</h3>
            <p className="text-xs text-slate-600">{moneda.format(meta.apartado)} apartado de {moneda.format(meta.objetivo)}</p>
          </div>
          <span className="text-xs font-bold text-indigo-700">{meta.apartado >= meta.objetivo ? "Meta alcanzada" : `Faltan ${moneda.format(meta.objetivo - meta.apartado)}`}</span>
        </div>
        <progress aria-label={`Progreso de ${meta.nombre}`} value={meta.apartado} max={meta.objetivo} className="h-2 w-full accent-indigo-600" />
        {meta.fechaObjetivo && <p className={`text-xs ${meta.fechaObjetivo < hoy && meta.apartado < meta.objetivo ? "font-bold text-amber-700" : "text-slate-500"}`}>
          Fecha objetivo: {meta.fechaObjetivo}{meta.fechaObjetivo < hoy && meta.apartado < meta.objetivo ? " · Fecha vencida" : ""}</p>}
        {meta.notas && <p className="whitespace-pre-wrap break-words text-xs text-slate-500">{meta.notas}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={bloqueado || meta.apartado >= meta.objetivo} onClick={() => { ahorros.limpiarError(); setMoviendo({ id: meta.id, accion: "apartar" }); setEditando(null); }} className={boton}>Apartar</button>
          <button type="button" disabled={bloqueado || meta.apartado <= 0} onClick={() => { ahorros.limpiarError(); setMoviendo({ id: meta.id, accion: "liberar" }); setEditando(null); }} className={boton}>Liberar apartado</button>
          <button type="button" disabled={bloqueado} onClick={() => { ahorros.limpiarError(); setEditando(meta); setMoviendo(null); }} className={boton}>Editar meta</button>
          <button type="button" disabled={bloqueado || meta.apartado !== 0} onClick={() => {
            if (window.confirm(`¿Archivar la meta «${meta.nombre}»? No tiene dinero apartado.`)) void ahorros.cambiar(meta.id, "archivar");
          }} className={boton}>Archivar</button>
        </div>
        {meta.apartado > 0 && <p className="text-[11px] text-slate-500">Libera el apartado antes de archivar. Si utilizas el dinero, registra también el gasto o la salida real por separado.</p>}
        {moviendo?.id === meta.id && <MoverApartado key={`${meta.id}:${moviendo.accion}`} meta={meta} accion={moviendo.accion} ahorros={ahorros} disponibleReal={disponibleReal} onCerrar={() => setMoviendo(null)} />}
      </li>)}</ul>
    </div>
  </details>;
}
function EditorMeta({ meta, ahorros, onCerrar }: { meta: MetaAhorro | null; ahorros: SavingsGoalsController; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(meta?.nombre ?? "");
  const [objetivo, setObjetivo] = useState(meta ? String(meta.objetivo) : "");
  const [fecha, setFecha] = useState(meta?.fechaObjetivo ?? "");
  const [notas, setNotas] = useState(meta?.notas ?? "");
  const guardando = Boolean(ahorros.guardandoId) || ahorros.cargando || Boolean(ahorros.errorCarga);
  async function guardar(event: FormEvent) {
    event.preventDefault();
    const datos = { nombre, objetivo: Number(objetivo), fechaObjetivo: fecha || null, notas };
    const ok = meta ? await ahorros.cambiar(meta.id, "editar", datos) : await ahorros.crear(datos);
    if (ok) onCerrar();
  }
  return <form onSubmit={guardar} className="space-y-3 rounded-xl bg-slate-50 p-3">
    <h3 className="text-sm font-bold">{meta ? "Editar meta" : "Nueva meta"}</h3>
    <label className="block text-xs font-bold text-slate-700">Nombre de la meta
      <input required maxLength={100} value={nombre} onChange={event => setNombre(event.target.value)} disabled={guardando} className={campo} /></label>
    <label className="block text-xs font-bold text-slate-700">Objetivo en dólares
      <input type="number" required min="0.01" max="1000000" step="0.01" inputMode="decimal" value={objetivo} onChange={event => setObjetivo(event.target.value)} disabled={guardando} className={campo} /></label>
    <label className="block text-xs font-bold text-slate-700">Fecha objetivo (opcional)
      <input type="date" value={fecha} onChange={event => setFecha(event.target.value)} disabled={guardando} className={campo} /></label>
    <label className="block text-xs font-bold text-slate-700">Notas (opcional)
      <textarea maxLength={500} value={notas} onChange={event => setNotas(event.target.value)} disabled={guardando} className={campo} /></label>
    <div className="flex flex-wrap gap-2"><button type="submit" disabled={guardando} className={boton}>{guardando ? "Guardando…" : "Guardar meta"}</button>
      <button type="button" disabled={guardando} onClick={onCerrar} className={boton}>Cancelar</button></div>
  </form>;
}
function MoverApartado({ meta, accion, ahorros, disponibleReal, onCerrar }: { meta: MetaAhorro; accion: "apartar" | "liberar"; ahorros: SavingsGoalsController; disponibleReal: number | null; onCerrar: () => void }) {
  const [importe, setImporte] = useState("");
  const monto = Number(importe);
  const disponiblePosterior = disponibleReal === null || !Number.isFinite(monto) || monto < 0 ? null : disponibleReal + (accion === "apartar" ? -monto : monto);
  async function guardar(event: FormEvent) {
    event.preventDefault();
    if (await ahorros.cambiar(meta.id, accion, monto)) onCerrar();
  }
  return <form onSubmit={guardar} className="space-y-3 rounded-xl bg-slate-50 p-3">
    <label className="block text-xs font-bold text-slate-700">{accion === "apartar" ? "Importe a apartar" : "Importe a liberar"}
      <input type="number" min="0.01" max={accion === "apartar" ? redondearMoneda(meta.objetivo - meta.apartado) : meta.apartado} step="0.01" inputMode="decimal" required
        value={importe} onChange={event => setImporte(event.target.value)} disabled={Boolean(ahorros.guardandoId)} className={campo} /></label>
    {disponiblePosterior !== null && <p className={`text-xs ${disponiblePosterior < 0 ? "font-bold text-rose-700" : "text-slate-600"}`}>Disponible tras el cambio: {moneda.format(disponiblePosterior)}{disponiblePosterior < 0 ? ". El apartado dejaría un déficit; no crea dinero en la cuenta." : ""}</p>}
    {disponibleReal === null && <p className="text-xs text-slate-500">Carga los datos de la cuenta para calcular el disponible antes de cambiar el apartado.</p>}
    <div className="flex flex-wrap gap-2"><button type="submit" disabled={Boolean(ahorros.guardandoId) || disponibleReal === null} className={boton}>{ahorros.guardandoId ? "Guardando…" : accion === "apartar" ? "Guardar apartado" : "Liberar dinero"}</button>
      <button type="button" disabled={Boolean(ahorros.guardandoId)} onClick={onCerrar} className={boton}>Cancelar</button></div>
  </form>;
}
