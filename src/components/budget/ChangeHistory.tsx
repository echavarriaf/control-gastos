"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { leerHistorial } from "@/lib/history/read";
import { cambiosHistorial, ETIQUETAS_HISTORIAL, type EventoHistorial } from "@/lib/history/types";
import { fechaHistorial, valorHistorial } from "@/lib/history/display";
import type { CompromisoFijo, TarjetaCredito } from "@/lib/budget/types";

const acciones = { creado: "Creación", editado: "Edición", eliminado: "Eliminación", recuperado: "Recuperación", recalibrado: "Recalibración" };
const boton = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50";
type Props = { tarjetas: TarjetaCredito[]; compromisos: CompromisoFijo[] };
export function ChangeHistory(props: Props) {
  const { user, authorized } = useAuth();
  return user && authorized ? <HistorialUsuario key={user.uid} uid={user.uid} {...props} /> : null;
}
function HistorialUsuario({ uid, tarjetas, compromisos }: Props & { uid: string }) {
  const [abierto, setAbierto] = useState(false);
  const [eventos, setEventos] = useState<Array<EventoHistorial & { id: string }>>([]);
  const [siguiente, setSiguiente] = useState<Awaited<ReturnType<typeof leerHistorial>>["siguiente"]>();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const solicitud = useRef({ actual: 0 });
  useEffect(() => { const control = solicitud.current; return () => { control.actual++; }; }, []);
  const cargar = useCallback(async (cursor?: Awaited<ReturnType<typeof leerHistorial>>["siguiente"]) => {
    const numero = ++solicitud.current.actual;
    setCargando(true); setError(null);
    try {
      const pagina = await leerHistorial(uid, cursor);
      if (solicitud.current.actual !== numero) return;
      setEventos(actuales => cursor ? [...new Map([...actuales, ...pagina.eventos].map(evento => [evento.id, evento])).values()] : pagina.eventos);
      setSiguiente(pagina.siguiente);
    } catch (cause) {
      if (solicitud.current.actual === numero) setError(cause instanceof Error && cause.name !== "FirebaseError" ? cause.message : "No se pudo cargar el historial. Vuelve a intentarlo.");
    } finally { if (solicitud.current.actual === numero) setCargando(false); }
  }, [uid]);
  const referencias = new Map([...tarjetas.map(tarjeta => [`tarjetaId:${tarjeta.id}`, `${tarjeta.nombre} · ${tarjeta.ultimosCuatro}`] as const),
    ...compromisos.map(compromiso => [`compromisoId:${compromiso.id}`, compromiso.descripcion] as const)]);
  return <section aria-label="Historial de cambios" className="rounded-3xl border border-slate-200 bg-white p-4">
    <button type="button" aria-expanded={abierto} aria-controls="historial-cambios" onClick={() => {
      setAbierto(!abierto); if (!abierto) void cargar();
    }} className="flex w-full items-center justify-between text-left text-sm font-black text-slate-800">Historial de cambios <span aria-hidden="true">{abierto ? "−" : "+"}</span></button>
    {abierto && <div id="historial-cambios" className="mt-4 space-y-3">
      <p className="text-xs leading-5 text-slate-600">Consulta los cambios guardados desde esta versión de la aplicación. Incluye creaciones, ediciones, eliminaciones, recuperaciones y recalibraciones. Los cambios anteriores no se reconstruyen.</p>
      <button type="button" onClick={() => void cargar()} disabled={cargando} className={boton}>Actualizar historial</button>
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      <ol className="space-y-3">{eventos.map(evento => {
        const datos = evento.despues ?? evento.antes;
        const nombre = [datos?.concepto, datos?.descripcion, datos?.nombre].find(value => typeof value === "string" && value) as string | undefined;
        const cambios = cambiosHistorial(evento.antes, evento.despues).filter(cambio => evento.accion === "creado" || evento.accion === "recuperado"
          ? cambio.despues !== "" && cambio.despues !== null : evento.accion === "eliminado" ? cambio.antes !== "" && cambio.antes !== null : true);
        return <li key={evento.id} className="rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-black text-slate-800">{acciones[evento.accion]} · {ETIQUETAS_HISTORIAL[evento.coleccion]}{nombre ? ` · ${nombre}` : ""}</p>
          <p className="mt-1 text-xs text-slate-500">{fechaHistorial(evento.fecha)} · Usuario autenticado de esta cuenta</p>
          <details className="mt-2 text-xs"><summary className="cursor-pointer font-bold text-indigo-700">Ver cambios</summary>
            {cambios.length ? <dl className="mt-2 space-y-2">{cambios.map(cambio => <div key={cambio.campo} className="rounded-lg bg-slate-50 p-2">
              <dt className="font-bold text-slate-700">{cambio.etiqueta}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-slate-600">Antes: {valorHistorial(cambio.campo, cambio.antes, referencias)}<br />Después: {valorHistorial(cambio.campo, cambio.despues, referencias)}</dd>
            </div>)}</dl> : <p className="mt-2 text-slate-500">{evento.accion === "recalibrado" ? "Se actualizó la fotografía del saldo sin cambiar los valores visibles." : "No cambiaron los valores financieros visibles."}</p>}
          </details>
        </li>;
      })}</ol>
      {cargando && <p role="status" className="text-xs text-slate-500">Cargando historial…</p>}
      {!cargando && !error && eventos.length === 0 && <p className="text-xs text-slate-500">Todavía no hay cambios registrados desde esta versión.</p>}
      {siguiente && <button type="button" disabled={cargando} onClick={() => void cargar(siguiente)} className={boton}>Cargar más cambios</button>}
    </div>}
  </section>;
}
