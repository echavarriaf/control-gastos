import {
  CreditCard,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ReceiptText,
} from "lucide-react";

import {
  METODOS_PAGO,
} from "@/lib/budget/constants";

import type {
  CompromisoFijo,
  PrioridadPago,
} from "@/lib/budget/types";

import {
  formatoMoneda,
} from "@/lib/budget/utils";

interface ListaCompromisosProps {
  compromisos: CompromisoFijo[];
  cargando: boolean;
  procesando: boolean;
  actualizandoId: string | null;

  onCrear: () => void;

  onEditar: (
    compromiso: CompromisoFijo,
  ) => void;

  onAlternarEstado: (
    compromiso: CompromisoFijo,
  ) => void;
}

const PRIORIDADES: Array<{
  value: PrioridadPago;
  label: string;
}> = [
  {
    value: 1,
    label: "Alta",
  },
  {
    value: 2,
    label: "Media",
  },
  {
    value: 3,
    label: "Baja",
  },
];

function ListaCompromisos({
  compromisos,
  cargando,
  procesando,
  actualizandoId,
  onCrear,
  onEditar,
  onAlternarEstado,
}: ListaCompromisosProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-black text-slate-900">
            Compromisos recurrentes
          </h3>

          <p className="mt-1 text-xs font-medium text-slate-500">
            Los gastos desactivados conservan sus pagos anteriores.
          </p>
        </div>

        <button
          type="button"
          onClick={onCrear}
          disabled={procesando}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Agregar gasto fijo
        </button>
      </div>

      {cargando ? (
        <div className="flex min-h-48 items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="text-center">
            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-indigo-600" />

            <p className="mt-3 text-sm font-bold text-slate-600">
              Cargando gastos fijos
            </p>
          </div>
        </div>
      ) : compromisos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <ReceiptText className="mx-auto h-9 w-9 text-slate-400" />

          <h3 className="mt-4 font-black text-slate-900">
            No hay gastos fijos
          </h3>

          <p className="mt-2 text-sm font-medium text-slate-500">
            Agrega el primer compromiso recurrente de tu presupuesto.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {compromisos.map(
            (compromiso) => {
              const actualizando =
                actualizandoId ===
                compromiso.id;

              const prioridad =
                PRIORIDADES.find(
                  (opcion) =>
                    opcion.value ===
                    compromiso.prioridad,
                )?.label ?? "Media";

              return (
                <article
                  key={compromiso.id}
                  className={`rounded-3xl border bg-white p-4 shadow-sm transition ${
                    compromiso.activo
                      ? "border-slate-200"
                      : "border-slate-200 opacity-65"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate font-black text-slate-950">
                          {compromiso.descripcion}
                        </h4>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                            compromiso.activo
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {compromiso.activo
                            ? "Activo"
                            : "Inactivo"}
                        </span>

                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-indigo-700">
                          Q
                          {
                            compromiso
                              .quincenaPresupuestaria
                          }
                        </span>
                      </div>

                      <p className="mt-2 text-xl font-black text-slate-900">
                        {formatoMoneda.format(
                          compromiso.monto,
                        )}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                        <span>
                          Vence el día{" "}
                          {
                            compromiso
                              .diaVencimiento
                          }
                        </span>

                        <span>
                          Prioridad{" "}
                          {prioridad}
                        </span>

                        <span>
                          {
                            METODOS_PAGO[
                              compromiso
                                .metodoPagoPreferido
                            ]
                          }
                        </span>

                        {compromiso.tarjetaId && (
                          <span className="inline-flex items-center gap-1">
                            <CreditCard className="h-3.5 w-3.5" />
                            {compromiso.tarjetaId}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onEditar(
                            compromiso,
                          )
                        }
                        disabled={procesando}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onAlternarEstado(
                            compromiso,
                          )
                        }
                        disabled={procesando}
                        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                          compromiso.activo
                            ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {actualizando ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : compromiso.activo ? (
                          <PowerOff className="h-3.5 w-3.5" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}

                        {compromiso.activo
                          ? "Desactivar"
                          : "Activar"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

export default ListaCompromisos;