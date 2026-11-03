"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { EVENTO_PAPELERA, obtenerPapelera, recuperarDePapelera, type CambioPapelera } from "@/lib/movement-trash/client";
import { ETIQUETAS_PAPELERA, type MovimientoEliminado } from "@/lib/movement-trash/types";

const moneda = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const boton = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50";

export function MovementTrash() {
  const { user, authorized } = useAuth();
  return user && authorized ? <PapeleraUsuario key={user.uid} uid={user.uid} /> : null;
}
function PapeleraUsuario({ uid }: { uid: string }) {
  const [abierta, setAbierta] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoEliminado[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [recuperando, setRecuperando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<MovimientoEliminado | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const solicitud = useRef({ actual: 0 });
  const cargar = useCallback(async (cursor?: string) => {
    const numero = ++solicitud.current.actual;
    setCargando(true); setError(null);
    try {
      const pagina = await obtenerPapelera(uid, cursor);
      if (numero !== solicitud.current.actual) return;
      setMovimientos(actuales => cursor ? [...new Map([...actuales, ...pagina.movimientos].map(item => [item.id, item])).values()] : pagina.movimientos);
      setSiguiente(pagina.siguiente);
    } catch (cause) {
      if (numero === solicitud.current.actual) setError(cause instanceof Error ? cause.message : "No se pudo cargar la papelera.");
    } finally { if (numero === solicitud.current.actual) setCargando(false); }
  }, [uid]);
  useEffect(() => {
    const control = solicitud.current;
    return () => { control.actual++; };
  }, []);
  useEffect(() => {
    const cambiar = (event: Event) => {
      const cambio = (event as CustomEvent<CambioPapelera>).detail;
      if (!cambio || cambio.uid !== uid) return;
      setError(null);
      if (cambio.accion === "eliminado") {
        setUltimo(cambio.movimiento); setMensaje(null);
      } else {
        setUltimo(actual => actual?.id === cambio.movimiento.id ? null : actual);
        setMovimientos(actuales => actuales.filter(item => item.id !== cambio.movimiento.id));
        setMensaje(`Se recuperó «${cambio.movimiento.concepto}». Sus saldos se actualizarán con los datos recuperados.`);
      }
      if (abierta) void cargar();
    };
    window.addEventListener(EVENTO_PAPELERA, cambiar);
    return () => { window.removeEventListener(EVENTO_PAPELERA, cambiar); };
  }, [uid, abierta, cargar]);
  async function recuperar(item: MovimientoEliminado) {
    if (recuperando) return;
    setRecuperando(item.id); setError(null); setMensaje(null);
    try { await recuperarDePapelera(uid, item.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo recuperar el movimiento."); }
    finally { setRecuperando(null); }
  }
  return <section aria-label="Papelera de movimientos" className="rounded-3xl border border-slate-200 bg-white p-4">
    <button type="button" aria-expanded={abierta} aria-controls="papelera-movimientos" onClick={() => {
      const abrir = !abierta;
      setAbierta(abrir);
      if (abrir) void cargar();
    }} className="flex w-full items-center justify-between gap-3 text-left text-sm font-black text-slate-800">
      Movimientos eliminados <span aria-hidden="true">{abierta ? "−" : "+"}</span>
    </button>
    {mensaje && <p role="status" className="mt-3 text-xs font-semibold text-emerald-800">{mensaje}</p>}
    {error && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}
    {abierta && <div id="papelera-movimientos" className="mt-4 space-y-3">
      <p className="text-xs leading-5 text-slate-600">Recupera movimientos eliminados desde esta función, incluso después de recargar. Se conservan sus datos e ID originales. Si la cuenta fue recalibrada o falta una tarjeta o compromiso asociado, se te indicará antes de recuperar.</p>
      <button type="button" onClick={() => void cargar()} disabled={cargando || Boolean(recuperando)} className={boton}>Actualizar papelera</button>
      <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
        {movimientos.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 flex-1"><p className="break-words text-sm font-bold text-slate-800">{item.concepto}</p>
            <p className="text-xs text-slate-500">{ETIQUETAS_PAPELERA[item.coleccion]} · {item.fecha.slice(0, 10)}{item.monto !== null ? ` · ${moneda.format(item.monto)}` : ""}</p>
          </div>
          <button type="button" disabled={Boolean(recuperando)} onClick={() => void recuperar(item)} className={boton}>
            {recuperando === item.id ? "Recuperando…" : "Recuperar"}
            <span className="sr-only"> {item.concepto}</span>
          </button>
        </li>)}
      </ul>
      {cargando && <p role="status" className="text-xs text-slate-500">Cargando papelera…</p>}
      {!cargando && !error && movimientos.length === 0 && <p className="text-xs text-slate-500">No hay movimientos eliminados para recuperar.</p>}
      {siguiente && <button type="button" disabled={cargando || Boolean(recuperando)} onClick={() => void cargar(siguiente)} className={boton}>Cargar más</button>}
    </div>}
    {ultimo && <div role="status" className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-2xl rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950 shadow-lg sm:bottom-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 break-words text-sm font-semibold">Se envió «{ultimo.concepto}» a la papelera.</p>
        <button type="button" disabled={Boolean(recuperando)} onClick={() => void recuperar(ultimo)} className={boton}>{recuperando === ultimo.id ? "Recuperando…" : "Deshacer"}</button>
        <button type="button" onClick={() => setUltimo(null)} className="rounded-lg px-2 py-2 text-xs font-bold">Ocultar</button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>}
  </section>;
}
