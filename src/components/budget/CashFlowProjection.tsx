"use client";

import { useState } from "react";
import { proyectarSaldoCuenta } from "@/lib/budget/cash-flow-projection";
import type { CuentaGastos, ResumenCuentaGastos } from "@/lib/budget/expense-account";
import type { CicloPago, CompromisoFijo, GastoVariable, Ingreso, PagoFijo, PagoTarjeta, TarjetaCredito } from "@/lib/budget/types";

const moneda = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
interface Props {
  hoy: string;
  cuenta: CuentaGastos;
  resumenCuenta: ResumenCuentaGastos;
  proximoCiclo: CicloPago | null;
  montoEstimado: number;
  ingresos: Ingreso[];
  compromisos: CompromisoFijo[];
  pagosFijos: PagoFijo[];
  tarjetas: TarjetaCredito[];
  gastos: GastoVariable[];
  pagosTarjeta: PagoTarjeta[];
  cargando: boolean;
  errorDatos?: string | null;
  ahorroApartado?: number;
}
export function CashFlowProjection(props: Props) {
  const [otrosGastos, setOtrosGastos] = useState("");
  let resultado: ReturnType<typeof proyectarSaldoCuenta> | null = null;
  let error: string | null = null;
  if (!props.cargando && !props.errorDatos && props.proximoCiclo) {
    try {
      resultado = proyectarSaldoCuenta({ ...props, proximoCiclo: props.proximoCiclo, otrosGastos: otrosGastos.trim() ? Number(otrosGastos) : 0 });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Revisa los datos de la proyección.";
    }
  }
  return (
    <details className="rounded-2xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-800">Proyección hasta el próximo cobro</summary>
      <div className="space-y-4 border-t border-slate-100 p-4">
        <p className="text-xs leading-5 text-slate-600">Parte del saldo actual calculado y estima las entradas y salidas hasta el próximo cobro. Los movimientos ya aplicados al saldo no vuelven a contarse.</p>
        {props.cargando ? <p role="status" className="text-xs text-slate-500">Cargando los datos de la proyección…</p>
          : props.errorDatos ? <p role="alert" className="text-sm text-rose-700">No se puede proyectar hasta resolver el error de los datos: {props.errorDatos}</p>
          : !props.proximoCiclo ? <p className="text-sm text-slate-600">Configura tu ingreso principal para conocer la fecha del próximo cobro.</p>
          : <>
            <label className="block text-xs font-bold text-slate-700">Otros gastos previstos hasta el cobro
              <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={otrosGastos}
                onChange={event => setOtrosGastos(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
            </label>
            <p className="text-xs text-slate-500">Añade aquí lo que prevés gastar en comida, gas u otros conceptos que todavía no hayas registrado. Este importe no se guarda.</p>
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            {resultado && <>
              <p className="text-xs font-bold text-slate-600">Intervalo: {resultado.hoy} al {resultado.fin}</p>
              <dl className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-slate-500">Antes del cobro previsto</dt><dd className="font-black">{moneda.format(resultado.saldoAntesCobro)}</dd></div>
                <div><dt className="text-xs text-slate-500">Después del cobro previsto</dt><dd className="font-black">{moneda.format(resultado.saldoDespuesCobro)}</dd></div>
                <div><dt className="text-xs text-slate-500">Saldo mínimo estimado</dt><dd className={`font-black ${resultado.saldoMinimo < 0 ? "text-rose-700" : "text-slate-900"}`}>{moneda.format(resultado.saldoMinimo)}<span className="block text-xs font-medium">{resultado.fechaSaldoMinimo}</span></dd></div>
              </dl>
              {resultado.saldoMinimo < 0 && <p role="status" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">Se prevé un déficit antes de completar el intervalo. Revisa las fechas y los pagos previstos.</p>}
              {resultado.estadoCobro !== "proyectado" && <p className="text-xs text-slate-600">El próximo cobro figura como {resultado.estadoCobro === "recibido" ? "recibido; ya forma parte del saldo calculado" : "cancelado"} y no se añade otra vez como ingreso previsto.</p>}
              {resultado.estadoCobro === "proyectado" && resultado.cobroPrevisto === 0 && <p className="text-xs text-slate-600">No se ha incluido un importe del próximo cobro dentro del intervalo. Revisa su fecha y monto programados.</p>}
              <p className="text-xs text-slate-600">Saldo de partida: {moneda.format(resultado.saldoInicial)} · Entradas previstas: {moneda.format(resultado.entradasPrevistas)} · Salidas previstas: {moneda.format(resultado.salidasPrevistas)} · Saldo al final del intervalo: {moneda.format(resultado.saldoFinal)}.</p>
              {Boolean(props.ahorroApartado) && <p className="text-xs font-semibold text-indigo-800">Ahorro apartado: {moneda.format(props.ahorroApartado ?? 0)}. Saldo final sin usar ese ahorro: {moneda.format(resultado.saldoFinal - (props.ahorroApartado ?? 0))}.
                {resultado.saldoMinimo < (props.ahorroApartado ?? 0) ? " La proyección prevé utilizar parte del dinero apartado; revisa las metas o los pagos." : ""}</p>}
              <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">Movimientos estimados hasta el próximo cobro</caption>
                  <thead className="bg-slate-50"><tr><th scope="col" className="p-3">Fecha y concepto</th><th scope="col" className="p-3 text-right">Importe</th><th scope="col" className="p-3 text-right">Saldo estimado</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{resultado.movimientos.map(partida => <tr key={partida.id}>
                    <td className="p-3"><span className="block font-bold">{partida.concepto}</span><span className="block text-slate-500">{partida.fecha}</span><span className="block text-slate-500">{partida.detalle}</span></td>
                    <td className="whitespace-nowrap p-3 text-right">{partida.direccion === "entrada" ? "+" : "−"}{moneda.format(partida.monto)}</td>
                    <td className="whitespace-nowrap p-3 text-right font-bold">{moneda.format(partida.saldoDespues)}</td>
                  </tr>)}</tbody>
                </table>
                {!resultado.movimientos.length && <p className="p-3 text-xs text-slate-500">No hay entradas ni salidas previstas en este intervalo.</p>}
              </div>
              <p className="text-xs leading-5 text-slate-500">Estimación, no saldo disponible. Se prevé pagar las tarjetas desde esta cuenta cinco días antes del corte, por su saldo proyectado restante. Los pagos externos pendientes reducen esa previsión sin descontar efectivo. Los pendientes pueden contabilizarse en otra fecha. Los cargos futuros a tarjetas que todavía no están registrados no se estiman. Para pagos e ingresos del mismo día se muestran primero las salidas, como escenario conservador.</p>
            </>}
          </>}
      </div>
    </details>
  );
}
