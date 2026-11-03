"use client";

import { useState } from "react";
import type { MovimientoCuentaGastos } from "@/lib/budget/expense-account";
import { claveRevisionMovimiento, conciliarCuenta } from "@/lib/budget/reconciliation";
import { fechaInputLocal } from "@/lib/budget/utils";

const moneda = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const campo = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

export function BankReconciliation({ movimientos, fechaSaldoInicial, cargando, errorDatos }: {
  movimientos: MovimientoCuentaGastos[];
  fechaSaldoInicial: string;
  cargando: boolean;
  errorDatos?: string | null;
}) {
  const [saldo, setSaldo] = useState("");
  const [fecha, setFecha] = useState(fechaInputLocal);
  const [revisados, setRevisados] = useState<Set<string>>(() => new Set());
  let error: string | null = null;
  let conciliacion: ReturnType<typeof conciliarCuenta> | null = null;
  if (saldo.trim() && !cargando && !errorDatos) {
    try {
      if (fecha > fechaInputLocal()) throw new Error("Compara una fecha de hoy o anterior.");
      conciliacion = conciliarCuenta({ movimientos, fechaCorte: fecha, saldoBanco: Number(saldo), revisados });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Revisa el saldo y la fecha.";
    }
  }
  function alternar(movimiento: MovimientoCuentaGastos, checked: boolean) {
    setRevisados(actuales => {
      const siguientes = new Set(actuales);
      if (checked) siguientes.add(claveRevisionMovimiento(movimiento));
      else siguientes.delete(claveRevisionMovimiento(movimiento));
      return siguientes;
    });
  }
  return (
    <details className="rounded-2xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-800">Conciliar con el banco</summary>
      <div className="space-y-4 border-t border-slate-100 p-4">
        <p className="text-xs leading-5 text-slate-600">
          Compara el saldo contable del banco al cierre de la fecha elegida, sin restar las reservas del presupuesto.
          Marca los movimientos que aparecen en tu estado de cuenta. La revisión dura mientras mantengas esta pantalla abierta.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">Saldo según el banco
            <input type="number" step="0.01" inputMode="decimal" value={saldo} disabled={cargando || Boolean(errorDatos)}
              onChange={event => setSaldo(event.target.value)} placeholder="0.00" className={campo} />
          </label>
          <label className="text-xs font-bold text-slate-700">Fecha del saldo
            <input type="date" min={fechaSaldoInicial} max={fechaInputLocal()} value={fecha} disabled={cargando || Boolean(errorDatos)}
              onChange={event => setFecha(event.target.value)} className={campo} />
          </label>
        </div>
        {cargando && <p role="status" className="text-xs text-slate-600">Cargando movimientos para comparar…</p>}
        {errorDatos && <p role="alert" className="text-sm text-rose-700">No se puede comparar hasta resolver el error de los datos: {errorDatos}</p>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {conciliacion && <>
          <dl className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Saldo calculado a esa fecha</dt><dd className="font-black">{moneda.format(conciliacion.saldoCalculado)}</dd></div>
            <div><dt className="text-xs text-slate-500">Saldo según el banco</dt><dd className="font-black">{moneda.format(Number(saldo))}</dd></div>
            <div><dt className="text-xs text-slate-500">Diferencia (banco − aplicación)</dt><dd className="font-black">{moneda.format(conciliacion.diferencia)}</dd></div>
          </dl>
          <p role="status" className="text-sm font-bold text-slate-800">
            {conciliacion.revisionCompleta ? "Conciliación completa: los saldos coinciden y todos los movimientos están revisados."
              : conciliacion.coincideSaldo ? "Los saldos coinciden. Aún hay movimientos por revisar."
              : conciliacion.partidasPendientesExplicanDiferencia ? "Los movimientos sin revisar explican la diferencia por importe. Comprueba si siguen pendientes en el banco."
              : "Hay una diferencia por investigar. Revisa fechas, importes, movimientos faltantes y el saldo base."}
          </p>
          <p className="text-xs leading-5 text-slate-600">
            Saldo base: {moneda.format(conciliacion.saldoBase)}. Saldo con movimientos revisados: {moneda.format(conciliacion.saldoRevisado)}.
            {" "}Diferencia pendiente de explicar: {moneda.format(conciliacion.diferenciaRevisada)}.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>{conciliacion.cantidadRevisada} de {conciliacion.partidas.length} movimientos revisados</span>
            <button type="button" onClick={() => setRevisados(new Set())} className="rounded-lg border px-3 py-2 font-bold text-slate-600">Reiniciar revisión</button>
          </div>
          <p className="text-xs text-slate-500">Sin revisar: entradas {moneda.format(conciliacion.entradasSinRevisar)} · salidas {moneda.format(conciliacion.salidasSinRevisar)}.</p>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {conciliacion.partidas.map(movimiento => <li key={movimiento.id}>
              <label className="flex cursor-pointer items-start gap-3 py-3 text-sm">
                <input type="checkbox" checked={revisados.has(claveRevisionMovimiento(movimiento))}
                  onChange={event => alternar(movimiento, event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1"><span className="block font-bold text-slate-800">{movimiento.concepto}</span>
                  <span className="text-xs text-slate-500">{movimiento.fecha.slice(0, 10)} · {movimiento.detalle}</span>
                  <span className="block text-xs text-slate-500">Aparece en el banco</span>
                </span>
                <span className="shrink-0 font-bold">{movimiento.direccion === "entrada" ? "+" : "−"}{moneda.format(movimiento.monto)}</span>
              </label>
            </li>)}
          </ul>
          {conciliacion.partidas.length === 0 && <p className="text-xs text-slate-500">No hay movimientos posteriores al saldo base hasta esa fecha.</p>}
          <p className="text-xs leading-5 text-slate-500">La comparación no modifica el saldo ni los movimientos. Si faltan partidas, regístralas desde Movimiento o desde su sección correspondiente antes de volver a comparar.</p>
        </>}
      </div>
    </details>
  );
}
