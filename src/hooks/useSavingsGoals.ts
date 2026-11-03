"use client";

import { addDocConHistorial as addDoc } from "@/lib/history/client-writes";
import { useCallback, useEffect, useRef, useState } from "react";
import { onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getUserCollection, getUserDocument } from "@/lib/firestore/user-paths";
import { cambiarApartado, normalizarMetaAhorro, validarMetaAhorro, type DatosMetaAhorro, type MetaAhorro } from "@/lib/budget/savings-goals";
import { registrarCambioEnTransaccion, transaccionConHistorial } from "@/lib/history/client-writes";

export function useSavingsGoals() {
  const { user, authorized } = useAuth();
  const uid = authorized ? user?.uid ?? null : null;
  const [datos, setDatos] = useState<{ uid: string | null; metas: MetaAhorro[]; cargando: boolean; error: string | null }>({ uid: null, metas: [], cargando: true, error: null });
  const [version, setVersion] = useState(0);
  const [operacion, setOperacion] = useState<{ uid: string; id: string } | null>(null);
  const [errorOperacion, setErrorOperacion] = useState<{ uid: string; mensaje: string } | null>(null);
  const enCurso = useRef<{ uid: string; id: string } | null>(null);
  useEffect(() => {
    if (!uid) return;
    const consulta = query(getUserCollection(uid, "metasAhorro"), where("archivada", "==", false));
    let activa = true;
    const cancelar = onSnapshot(consulta, snapshot => {
      if (!activa) return;
      const metas = snapshot.docs.map(documento => normalizarMetaAhorro(documento.id, documento.data()));
      const error = metas.some(meta => meta === null) ? "Hay una meta con datos inválidos. No se puede calcular el ahorro apartado." : null;
      setDatos({ uid, metas: metas.filter((meta): meta is MetaAhorro => meta !== null).sort((a, b) => a.nombre.localeCompare(b.nombre)), cargando: false, error });
    }, () => {
      if (activa) setDatos({ uid, metas: [], cargando: false, error: "No se pudieron cargar las metas de ahorro." });
    });
    return () => { activa = false; cancelar(); };
  }, [uid, version]);
  // A scope change hides the previous user's reserves before the next snapshot arrives.
  const metas = datos.uid === uid && uid ? datos.metas : [];
  const cargando = Boolean(uid) && (datos.uid !== uid || datos.cargando);
  const errorCarga = datos.uid === uid ? datos.error : null;
  const error = errorOperacion?.uid === uid ? errorOperacion.mensaje : errorCarga;
  const guardandoId = operacion?.uid === uid ? operacion.id : null;

  async function ejecutar(id: string, accion: (propietario: string) => Promise<unknown>): Promise<boolean> {
    if (!uid) return false;
    if (enCurso.current?.uid === uid) return false;
    const intento = { uid, id };
    enCurso.current = intento;
    setOperacion({ uid, id }); setErrorOperacion(null);
    try { await accion(uid); return true; }
    catch (cause) {
      setErrorOperacion({ uid, mensaje: cause instanceof Error && cause.name !== "FirebaseError" ? cause.message : "No se pudo guardar la meta de ahorro. Vuelve a intentarlo." });
      return false;
    }
    finally {
      if (enCurso.current === intento) enCurso.current = null;
      setOperacion(actual => actual?.uid === uid && actual.id === id ? null : actual);
    }
  }
  const crear = (input: DatosMetaAhorro) => ejecutar("nueva", async propietario => {
    const datos = validarMetaAhorro(input);
    await addDoc(getUserCollection(propietario, "metasAhorro"), { ...datos, apartado: 0, archivada: false, creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp() });
  });
  const cambiar = (id: string, accion: "apartar" | "liberar" | "editar" | "archivar", input: number | DatosMetaAhorro = 0) => ejecutar(id, async propietario => {
    const referencia = getUserDocument(propietario, "metasAhorro", id);
    await transaccionConHistorial(referencia, async (transaction, snapshot) => {
      const meta = snapshot.exists() ? normalizarMetaAhorro(snapshot.id, snapshot.data()) : null;
      if (!meta || meta.archivada) throw new Error("La meta ya no está disponible. Actualiza las metas.");
      let cambios: Partial<MetaAhorro>;
      if (accion === "apartar" || accion === "liberar") {
        if (typeof input !== "number") throw new Error("Importe no válido.");
        cambios = { apartado: cambiarApartado(meta, accion, input) };
      } else if (accion === "editar") {
        if (typeof input === "number") throw new Error("Meta no válida.");
        const validado = validarMetaAhorro(input);
        if (validado.objetivo < meta.apartado) throw new Error("Libera primero el apartado que supera el nuevo objetivo.");
        cambios = validado;
      } else {
        if (meta.apartado !== 0) throw new Error("Libera el dinero apartado antes de archivar la meta.");
        cambios = { archivada: true };
      }
      const actualizacion = { ...cambios, actualizadoEn: serverTimestamp() };
      transaction.update(referencia, actualizacion);
      registrarCambioEnTransaccion(transaction, referencia, snapshot.data()!, { ...snapshot.data(), ...actualizacion });
    });
  });
  const reintentar = useCallback(() => {
    setDatos({ uid: null, metas: [], cargando: true, error: null });
    setErrorOperacion(null); setVersion(actual => actual + 1);
  }, []);
  return { metas, cargando, error, errorCarga, guardandoId, crear, cambiar, reintentar, limpiarError: () => setErrorOperacion(null) };
}
export type SavingsGoalsController = ReturnType<typeof useSavingsGoals>;
