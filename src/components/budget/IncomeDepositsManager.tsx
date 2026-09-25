"use client";

/*
 * Nombre: Administrador de depósitos
 * Ruta: src/components/budget/IncomeDepositsManager.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-09-17
 *
 * Descripción:
 * Administra en una sola vista:
 *
 * - depósitos del ciclo salarial;
 * - depósitos manuales;
 * - depósitos pendientes;
 * - edición;
 * - eliminación;
 * - filtros por mes y estado.
 */

import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Filter,
  LoaderCircle,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  X,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import IncomeReceiptModal from "@/components/budget/IncomeReceiptModal";

import ManualDepositModal from "@/components/budget/ManualDepositModal";

import {
  useIncomeData,
} from "@/hooks/useIncomeData";

import {
  useIncomeTransactions,
} from "@/hooks/useIncomeTransactions";

import type {
  CicloPago,
  Ingreso,
} from "@/lib/budget/types";

import {
  formatoMoneda,
} from "@/lib/budget/utils";

type FiltroEstado =
  | "todos"
  | "recibidos"
  | "pendientes";

type EstadoFila =
  | "recibido"
  | "pendiente"
  | "cancelado";

type TipoFila =
  | "ciclo"
  | "manual";

interface FilaDeposito {
  id: string;

  tipo:
    TipoFila;

  ciclo:
    CicloPago | null;

  ingreso:
    Ingreso | null;

  descripcion:
    string;

  estado:
    EstadoFila;

  monto:
    number;

  fecha:
    string;

  fechaProgramada:
    string | null;
}

const TODOS_LOS_MESES =
  "__todos__";

const FORMATO_FECHA =
  new Intl.DateTimeFormat(
    "es-US",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    },
  );

const FORMATO_MES =
  new Intl.DateTimeFormat(
    "es-US",
    {
      month:
        "long",

      year:
        "numeric",
    },
  );

function obtenerFechaHoy(): string {
  const fecha =
    new Date();

  const anio =
    fecha.getFullYear();

  const mes =
    String(
      fecha.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const dia =
    String(
      fecha.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${anio}-${mes}-${dia}`;
}

function fechaLocal(
  fechaISO: string,
): Date | null {
  const [
    anio,
    mes,
    dia,
  ] =
    fechaISO
      .slice(
        0,
        10,
      )
      .split("-")
      .map(Number);

  if (
    !anio ||
    !mes ||
    !dia
  ) {
    return null;
  }

  return new Date(
    anio,
    mes - 1,
    dia,
  );
}

function formatearFecha(
  fechaISO: string,
): string {
  const fecha =
    fechaLocal(
      fechaISO,
    );

  return fecha
    ? FORMATO_FECHA.format(
        fecha,
      )
    : fechaISO;
}

function formatearMes(
  periodo: string,
): string {
  const [
    anio,
    mes,
  ] =
    periodo
      .split("-")
      .map(Number);

  if (
    !anio ||
    !mes
  ) {
    return periodo;
  }

  const texto =
    FORMATO_MES.format(
      new Date(
        anio,
        mes - 1,
        1,
      ),
    );

  return (
    texto
      .charAt(0)
      .toUpperCase() +
    texto.slice(
      1,
    )
  );
}

function obtenerEstadoFila(
  ingreso:
    Ingreso | null,
): EstadoFila {
  if (
    ingreso?.estado ===
      "recibido" &&
    ingreso.fechaRecibida
  ) {
    return "recibido";
  }

  if (
    ingreso?.estado ===
    "cancelado"
  ) {
    return "cancelado";
  }

  return "pendiente";
}

function construirFilaCiclo(
  ciclo:
    CicloPago,

  ingreso:
    Ingreso | null,

  montoEstimado:
    number,

  descripcion:
    string,
): FilaDeposito {
  const estado =
    obtenerEstadoFila(
      ingreso,
    );

  return {
    id:
      `ciclo:${ciclo.id}`,

    tipo:
      "ciclo",

    ciclo,

    ingreso,

    descripcion,

    estado,

    monto:
      estado ===
        "recibido" &&
      ingreso
        ? ingreso.monto
        : montoEstimado,

    fecha:
      estado ===
        "recibido" &&
      ingreso?.fechaRecibida
        ? ingreso
            .fechaRecibida
        : ciclo
            .fechaPagoProgramada,

    fechaProgramada:
      ciclo
        .fechaPagoProgramada,
  };
}

function construirFilaManual(
  ingreso:
    Ingreso,
): FilaDeposito {
  return {
    id:
      `manual:${ingreso.id}`,

    tipo:
      "manual",

    ciclo:
      null,

    ingreso,

    descripcion:
      ingreso.descripcion,

    estado:
      obtenerEstadoFila(
        ingreso,
      ),

    monto:
      ingreso.monto,

    fecha:
      ingreso
        .fechaRecibida ??
      ingreso
        .fechaProgramada,

    fechaProgramada:
      null,
  };
}

function etiquetaEstado(
  estado:
    EstadoFila,
): string {
  switch (
    estado
  ) {
    case "recibido":
      return "Recibido";

    case "cancelado":
      return "Cancelado";

    default:
      return "Pendiente";
  }
}

function clasesEstado(
  estado:
    EstadoFila,
): string {
  switch (
    estado
  ) {
    case "recibido":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "cancelado":
      return "border-slate-200 bg-slate-100 text-slate-500";

    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function etiquetaFuente(
  ingreso:
    Ingreso,
): string {
  switch (
    ingreso.fuente
  ) {
    case "salario":
      return "Salario";

    case "bono":
      return "Bono";

    case "horas_extra":
      return "Horas extra";

    case "reembolso":
      return "Reembolso";

    default:
      return "Otro depósito";
  }
}

export function IncomeDepositsManager() {
  const income =
    useIncomeData();

  const transactions =
    useIncomeTransactions();

  const [
    mesSeleccionado,
    setMesSeleccionado,
  ] =
    useState(
      TODOS_LOS_MESES,
    );

  const [
    estadoSeleccionado,
    setEstadoSeleccionado,
  ] =
    useState<FiltroEstado>(
      "todos",
    );

  const [
    cicloSeleccionado,
    setCicloSeleccionado,
  ] =
    useState<CicloPago | null>(
      null,
    );

  const [
    depositoManualSeleccionado,
    setDepositoManualSeleccionado,
  ] =
    useState<Ingreso | null>(
      null,
    );

  const [
    modalManualAbierto,
    setModalManualAbierto,
  ] =
    useState(
      false,
    );

  const [
    ingresoEliminar,
    setIngresoEliminar,
  ] =
    useState<Ingreso | null>(
      null,
    );

  const [
    eliminandoId,
    setEliminandoId,
  ] =
    useState<string | null>(
      null,
    );

  const hoy =
    obtenerFechaHoy();

  const filasCiclos =
    useMemo(
      () =>
        income.ciclos
          .map(
            (
              ciclo,
            ) => {
              const ingreso =
                transactions
                  .ingresosPorCiclo
                  .get(
                    ciclo.id,
                  ) ??
                null;

              return construirFilaCiclo(
                ciclo,
                ingreso,
                income
                  .configuracion
                  .montoEstimado,
                income
                  .configuracion
                  .descripcion ||
                  "Ingreso principal",
              );
            },
          )
          .filter(
            (
              fila,
            ) =>
              fila.ciclo !==
                null &&
              (
                fila.ciclo
                  .fechaPagoProgramada <=
                  hoy ||
                fila.estado ===
                  "recibido"
              ),
          ),
      [
        income.ciclos,
        income
          .configuracion
          .montoEstimado,
        income
          .configuracion
          .descripcion,
        transactions
          .ingresosPorCiclo,
        hoy,
      ],
    );

  const filasManuales =
    useMemo(
      () =>
        transactions
          .depositosManuales
          .map(
            construirFilaManual,
          ),
      [
        transactions
          .depositosManuales,
      ],
    );

  const filas =
    useMemo(
      () =>
        [
          ...filasCiclos,
          ...filasManuales,
        ].sort(
          (
            a,
            b,
          ) =>
            b.fecha.localeCompare(
              a.fecha,
            ) ||
            b.id.localeCompare(
              a.id,
            ),
        ),
      [
        filasCiclos,
        filasManuales,
      ],
    );

  const meses =
    useMemo(
      () => {
        const unicos =
          new Set<string>();

        filas.forEach(
          (
            fila,
          ) => {
            const periodo =
              fila.fecha.slice(
                0,
                7,
              );

            if (
              /^\d{4}-\d{2}$/.test(
                periodo,
              )
            ) {
              unicos.add(
                periodo,
              );
            }
          },
        );

        return Array.from(
          unicos,
        ).sort(
          (
            a,
            b,
          ) =>
            b.localeCompare(
              a,
            ),
        );
      },
      [
        filas,
      ],
    );

  const filasFiltradas =
    useMemo(
      () =>
        filas.filter(
          (
            fila,
          ) => {
            const coincideMes =
              mesSeleccionado ===
                TODOS_LOS_MESES ||
              fila.fecha.slice(
                0,
                7,
              ) ===
                mesSeleccionado;

            let coincideEstado =
              true;

            if (
              estadoSeleccionado ===
              "recibidos"
            ) {
              coincideEstado =
                fila.estado ===
                "recibido";
            }

            if (
              estadoSeleccionado ===
              "pendientes"
            ) {
              coincideEstado =
                fila.estado ===
                "pendiente";
            }

            return (
              coincideMes &&
              coincideEstado
            );
          },
        ),
      [
        filas,
        mesSeleccionado,
        estadoSeleccionado,
      ],
    );

  const totalRecibido =
    useMemo(
      () =>
        filasFiltradas.reduce(
          (
            total,
            fila,
          ) =>
            fila.estado ===
            "recibido"
              ? total +
                fila.monto
              : total,
          0,
        ),
      [
        filasFiltradas,
      ],
    );

  const cantidadRecibidos =
    useMemo(
      () =>
        filasFiltradas.filter(
          (
            fila,
          ) =>
            fila.estado ===
            "recibido",
        ).length,
      [
        filasFiltradas,
      ],
    );

  const cantidadPendientes =
    useMemo(
      () =>
        filasFiltradas.filter(
          (
            fila,
          ) =>
            fila.estado ===
            "pendiente",
        ).length,
      [
        filasFiltradas,
      ],
    );

  const ingresoSeleccionado =
    useMemo(
      () =>
        cicloSeleccionado
          ? transactions
              .ingresosPorCiclo
              .get(
                cicloSeleccionado.id,
              ) ??
            null
          : null,
      [
        cicloSeleccionado,
        transactions
          .ingresosPorCiclo,
      ],
    );

  const cargando =
    income.cargando ||
    transactions.cargando;

  const abrirDepositoCiclo =
    (
      ciclo:
        CicloPago,
    ) => {
      transactions
        .limpiarError();

      setCicloSeleccionado(
        ciclo,
      );
    };

  const cerrarDepositoCiclo =
    () => {
      setCicloSeleccionado(
        null,
      );

      transactions
        .limpiarError();
    };

  const abrirDepositoManual =
    (
      deposito:
        Ingreso | null =
        null,
    ) => {
      transactions
        .limpiarError();

      setDepositoManualSeleccionado(
        deposito,
      );

      setModalManualAbierto(
        true,
      );
    };

  const cerrarDepositoManual =
    () => {
      setModalManualAbierto(
        false,
      );

      setDepositoManualSeleccionado(
        null,
      );

      transactions
        .limpiarError();
    };

  const solicitarEliminar =
    (
      ingreso:
        Ingreso,
    ) => {
      transactions
        .limpiarError();

      setIngresoEliminar(
        ingreso,
      );
    };

  const cancelarEliminar =
    () => {
      if (
        eliminandoId
      ) {
        return;
      }

      setIngresoEliminar(
        null,
      );
    };

  const confirmarEliminar =
    async () => {
      if (
        !ingresoEliminar
      ) {
        return;
      }

      setEliminandoId(
        ingresoEliminar
          .cicloPagoId,
      );

      const eliminado =
        await transactions
          .eliminarIngreso(
            ingresoEliminar
              .cicloPagoId,
          );

      setEliminandoId(
        null,
      );

      if (
        eliminado
      ) {
        setIngresoEliminar(
          null,
        );
      }
    };

  const limpiarFiltros =
    () => {
      setMesSeleccionado(
        TODOS_LOS_MESES,
      );

      setEstadoSeleccionado(
        "todos",
      );
    };

  const hayFiltros =
    mesSeleccionado !==
      TODOS_LOS_MESES ||
    estadoSeleccionado !==
      "todos";

  return (
    <>
      <section
        aria-labelledby="deposit-manager-title"
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Banknote className="h-5 w-5" />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
                Cuenta de gastos
              </p>

              <h2
                id="deposit-manager-title"
                className="mt-1 text-lg font-black text-slate-950"
              >
                Administrar depósitos
              </h2>

              <p className="mt-1 max-w-xl text-xs font-medium leading-relaxed text-slate-500">
                Nómina y otros depósitos
                recibidos en la cuenta.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              onClick={() =>
                abrirDepositoManual()
              }
              disabled={
                transactions
                  .guardando
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />

              Otro depósito
            </button>

            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600">
                Total recibido
              </p>

              <p className="mt-1 text-lg font-black text-emerald-900">
                {formatoMoneda.format(
                  totalRecibido,
                )}
              </p>

              <p className="mt-0.5 text-[10px] font-bold text-emerald-600">
                {cantidadRecibidos}{" "}
                {cantidadRecibidos ===
                1
                  ? "depósito"
                  : "depósitos"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-600" />

              <p className="text-xs font-black text-slate-700">
                Filtrar depósitos
              </p>
            </div>

            {hayFiltros && (
              <button
                type="button"
                onClick={
                  limpiarFiltros
                }
                className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-[10px] font-black text-indigo-600 shadow-sm transition hover:bg-indigo-50"
              >
                <X className="h-3.5 w-3.5" />

                Limpiar
              </button>
            )}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                Mes
              </span>

              <select
                value={
                  mesSeleccionado
                }
                onChange={(
                  event,
                ) =>
                  setMesSeleccionado(
                    event
                      .target
                      .value,
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option
                  value={
                    TODOS_LOS_MESES
                  }
                >
                  Todos los meses
                </option>

                {meses.map(
                  (
                    periodo,
                  ) => (
                    <option
                      key={
                        periodo
                      }
                      value={
                        periodo
                      }
                    >
                      {formatearMes(
                        periodo,
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                Estado
              </span>

              <select
                value={
                  estadoSeleccionado
                }
                onChange={(
                  event,
                ) =>
                  setEstadoSeleccionado(
                    event
                      .target
                      .value as FiltroEstado,
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="todos">
                  Todos
                </option>

                <option value="recibidos">
                  Recibidos
                </option>

                <option value="pendientes">
                  Pendientes
                </option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black text-emerald-700">
              {
                cantidadRecibidos
              }{" "}
              recibidos
            </span>

            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-black text-amber-700">
              {
                cantidadPendientes
              }{" "}
              pendientes
            </span>

            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[9px] font-black text-sky-700">
              {
                filasManuales
                  .length
              }{" "}
              manuales
            </span>
          </div>
        </div>

        {transactions.error && (
          <div
            className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700"
            role="alert"
          >
            {
              transactions.error
            }
          </div>
        )}

        {cargando ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 py-10 text-xs font-bold text-slate-400">
            <LoaderCircle className="h-4 w-4 animate-spin" />

            Cargando depósitos...
          </div>
        ) : filasFiltradas
            .length ===
          0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
            <ReceiptText className="h-7 w-7 text-slate-300" />

            <p className="mt-3 text-sm font-black text-slate-700">
              No hay depósitos
            </p>

            <p className="mt-1 max-w-sm text-xs font-medium leading-relaxed text-slate-500">
              No existen movimientos
              que coincidan con los
              filtros seleccionados.
            </p>

            {hayFiltros && (
              <button
                type="button"
                onClick={
                  limpiarFiltros
                }
                className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-black text-indigo-600 shadow-sm"
              >
                Mostrar todos
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {filasFiltradas.map(
              (
                fila,
              ) => {
                const recibido =
                  fila.estado ===
                  "recibido";

                const pendiente =
                  fila.estado ===
                  "pendiente";

                const manual =
                  fila.tipo ===
                  "manual";

                const eliminando =
                  eliminandoId ===
                  fila.ingreso
                    ?.cicloPagoId;

                return (
                  <article
                    key={
                      fila.id
                    }
                    className="rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:border-slate-300"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          recibido
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {recibido ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <CircleDashed className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                              {
                                fila.descripcion
                              }
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${clasesEstado(
                                  fila.estado,
                                )}`}
                              >
                                {etiquetaEstado(
                                  fila.estado,
                                )}
                              </span>

                              {manual &&
                                fila
                                  .ingreso && (
                                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-black text-sky-700">
                                    {etiquetaFuente(
                                      fila.ingreso,
                                    )}
                                  </span>
                                )}

                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                <CalendarDays className="h-3 w-3" />

                                {formatearFecha(
                                  fila.fecha,
                                )}
                              </span>
                            </div>
                          </div>

                          <p
                            className={`shrink-0 text-sm font-black ${
                              recibido
                                ? "text-emerald-700"
                                : "text-slate-500"
                            }`}
                          >
                            {recibido
                              ? "+"
                              : ""}

                            {formatoMoneda.format(
                              fila.monto,
                            )}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            {manual ? (
                              <>
                                <p className="text-[10px] font-bold text-emerald-600">
                                  Depósito manual
                                </p>

                                {fila
                                  .ingreso
                                  ?.notas && (
                                  <p className="mt-0.5 line-clamp-2 text-[10px] font-medium text-slate-400">
                                    {
                                      fila
                                        .ingreso
                                        .notas
                                    }
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                <p className="text-[10px] font-semibold text-slate-500">
                                  Programado{" "}
                                  {fila
                                    .fechaProgramada
                                    ? formatearFecha(
                                        fila
                                          .fechaProgramada,
                                      )
                                    : ""}
                                </p>

                                {recibido &&
                                  fila
                                    .ingreso
                                    ?.fechaRecibida && (
                                    <p className="mt-0.5 text-[10px] font-bold text-emerald-600">
                                      Depositado{" "}
                                      {formatearFecha(
                                        fila
                                          .ingreso
                                          .fechaRecibida,
                                      )}
                                    </p>
                                  )}
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {pendiente &&
                              fila
                                .ciclo && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirDepositoCiclo(
                                      fila.ciclo!,
                                    )
                                  }
                                  disabled={
                                    transactions
                                      .guardando
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black text-white transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
                                >
                                  <Plus className="h-3.5 w-3.5" />

                                  Registrar
                                </button>
                              )}

                            {recibido &&
                              !manual &&
                              fila
                                .ciclo && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirDepositoCiclo(
                                      fila.ciclo!,
                                    )
                                  }
                                  disabled={
                                    transactions
                                      .guardando
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <Pencil className="h-3.5 w-3.5" />

                                  Editar
                                </button>
                              )}

                            {recibido &&
                              manual &&
                              fila
                                .ingreso && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirDepositoManual(
                                      fila.ingreso,
                                    )
                                  }
                                  disabled={
                                    transactions
                                      .guardando
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <Pencil className="h-3.5 w-3.5" />

                                  Editar
                                </button>
                              )}

                            {recibido &&
                              fila
                                .ingreso && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    solicitarEliminar(
                                      fila.ingreso!,
                                    )
                                  }
                                  disabled={
                                    transactions
                                      .guardando
                                  }
                                  aria-label={`Eliminar depósito del ${formatearFecha(
                                    fila.fecha,
                                  )}`}
                                  title="Eliminar depósito"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-500 transition hover:bg-rose-100 active:scale-[0.98] disabled:opacity-50"
                                >
                                  {eliminando ? (
                                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}

        <p className="mt-4 text-[10px] font-medium leading-relaxed text-slate-400">
          Los depósitos recibidos se
          incorporan automáticamente al
          saldo calculado de la Cuenta de
          gastos. Los depósitos manuales
          no modifican Comida, Gas ni
          ninguna tarjeta.
        </p>
      </section>

      <IncomeReceiptModal
        abierto={
          cicloSeleccionado !==
          null
        }
        ciclo={
          cicloSeleccionado
        }
        configuracion={
          income.configuracion
        }
        ingresoExistente={
          ingresoSeleccionado
        }
        guardando={
          transactions
            .guardando
        }
        error={
          transactions.error
        }
        onCerrar={
          cerrarDepositoCiclo
        }
        onGuardar={
          transactions
            .registrarIngresoRecibido
        }
      />

      <ManualDepositModal
        abierto={
          modalManualAbierto
        }
        deposito={
          depositoManualSeleccionado
        }
        guardando={
          transactions
            .guardando
        }
        error={
          transactions.error
        }
        onCerrar={
          cerrarDepositoManual
        }
        onGuardar={
          transactions
            .guardarDepositoManual
        }
      />

      {ingresoEliminar && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-income-title"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              cancelarEliminar();
            }
          }}
        >
          <section className="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-500">
                  Eliminar depósito
                </p>

                <h2
                  id="delete-income-title"
                  className="mt-1 text-lg font-black text-slate-950"
                >
                  Confirmar eliminación
                </h2>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-900">
                {
                  ingresoEliminar
                    .descripcion
                }
              </p>

              <p className="mt-2 text-lg font-black text-emerald-700">
                {formatoMoneda.format(
                  ingresoEliminar
                    .monto,
                )}
              </p>

              {ingresoEliminar
                .fechaRecibida && (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {formatearFecha(
                    ingresoEliminar
                      .fechaRecibida,
                  )}
                </p>
              )}
            </div>

            <p className="mt-4 text-xs font-medium leading-relaxed text-slate-500">
              Al eliminarlo dejará de
              formar parte del saldo
              calculado de la Cuenta de
              gastos.
            </p>

            {transactions.error && (
              <div
                className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700"
                role="alert"
              >
                {
                  transactions.error
                }
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  cancelarEliminar
                }
                disabled={
                  eliminandoId !==
                  null
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  void confirmarEliminar();
                }}
                disabled={
                  eliminandoId !==
                  null
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {eliminandoId ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}

                {eliminandoId
                  ? "Eliminando..."
                  : "Eliminar depósito"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default IncomeDepositsManager;