"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  ReceiptText,
  Save,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  calcularResumenCuentaGastos,
  EXPENSE_ACCOUNT_DEFAULT_NAME,
  type MovimientoCuentaGastos,
  type ReservaCompromisoCuenta,
} from "@/lib/budget/expense-account";

import type {
  CompromisoFijo,
  GastoVariable,
  Ingreso,
  PagoFijo,
  PagoTarjeta,
} from "@/lib/budget/types";

import {
  useExpenseAccount,
} from "@/hooks/useExpenseAccount";

interface ExpenseAccountCardProps {
  ingresos:
    Ingreso[];

  gastos:
    GastoVariable[];

  pagosFijos:
    PagoFijo[];

  pagosTarjeta:
    PagoTarjeta[];

  compromisosFijos:
    CompromisoFijo[];

  cargandoIngresos:
    boolean;

  cargandoPresupuesto:
    boolean;

  cargandoCompromisos:
    boolean;
}

const formatoMoneda =
  new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    },
  );

function fechaHoyISO():
string {
  const fecha =
    new Date();

  const year =
    fecha.getFullYear();

  const month =
    String(
      fecha.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      fecha.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

function etiquetaFecha(
  fechaISO: string,
): string {
  const [
    year,
    month,
    day,
  ] =
    fechaISO
      .slice(
        0,
        10,
      )
      .split("-")
      .map(Number);

  return new Intl.DateTimeFormat(
    "es-US",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    },
  ).format(
    new Date(
      year,
      month - 1,
      day,
      12,
    ),
  );
}

function etiquetaPeriodo(
  periodo: string,
): string {
  const [
    year,
    month,
  ] =
    periodo
      .split("-")
      .map(Number);

  if (
    !Number.isFinite(
      year,
    ) ||
    !Number.isFinite(
      month,
    )
  ) {
    return periodo;
  }

  return new Intl.DateTimeFormat(
    "es-US",
    {
      month:
        "long",

      year:
        "numeric",
    },
  ).format(
    new Date(
      year,
      month - 1,
      1,
      12,
    ),
  );
}

function configuracionMovimiento(
  movimiento:
    MovimientoCuentaGastos,
) {
  switch (
    movimiento.tipo
  ) {
    case "saldo_inicial":
      return {
        icono:
          Landmark,

        iconClass:
          "bg-slate-100 text-slate-600",

        montoClass:
          "text-slate-700",

        signo:
          "",
      };

    case "deposito":
      return {
        icono:
          ArrowDownToLine,

        iconClass:
          "bg-emerald-100 text-emerald-700",

        montoClass:
          "text-emerald-700",

        signo:
          "+",
      };

    case "gasto_variable":
      return {
        icono:
          Banknote,

        iconClass:
          "bg-rose-100 text-rose-700",

        montoClass:
          "text-rose-700",

        signo:
          "-",
      };

    case "pago_fijo":
      return {
        icono:
          ReceiptText,

        iconClass:
          "bg-amber-100 text-amber-700",

        montoClass:
          "text-amber-700",

        signo:
          "-",
      };

    case "pago_tarjeta":
      return {
        icono:
          CreditCard,

        iconClass:
          "bg-violet-100 text-violet-700",

        montoClass:
          "text-violet-700",

        signo:
          "-",
      };
  }
}

function FilaMovimientoCuenta({
  movimiento,
}: {
  movimiento:
    MovimientoCuentaGastos;
}) {
  const config =
    configuracionMovimiento(
      movimiento,
    );

  const Icono =
    config.icono;

  return (
    <div className="flex gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.iconClass}`}
      >
        <Icono className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-800">
              {movimiento.concepto}
            </p>

            <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
              {movimiento.detalle}
            </p>

            <p className="mt-1 text-[10px] font-bold text-slate-400">
              {etiquetaFecha(
                movimiento.fecha,
              )}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p
              className={`text-sm font-black ${config.montoClass}`}
            >
              {config.signo}
              {formatoMoneda.format(
                movimiento.monto,
              )}
            </p>

            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
              Saldo
            </p>

            <p
              className={`text-xs font-black ${
                movimiento
                  .saldoDespues <
                0
                  ? "text-rose-600"
                  : "text-slate-700"
              }`}
            >
              {formatoMoneda.format(
                movimiento
                  .saldoDespues,
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilaReserva({
  reserva,
}: {
  reserva:
    ReservaCompromisoCuenta;
}) {
  const esParcial =
    reserva.estado ===
    "parcial";

  return (
    <div className="flex gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          esParcial
            ? "bg-amber-100 text-amber-700"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        <LockKeyhole className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-800">
              {reserva.descripcion}
            </p>

            <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
              Vencimiento día{" "}
              {reserva.diaVencimiento}
              {" · "}
              Prioridad{" "}
              {reserva.prioridad}
            </p>

            {esParcial ? (
              <p className="mt-1 text-[10px] font-bold text-amber-600">
                Registrado{" "}
                {formatoMoneda.format(
                  reserva
                    .montoPagadoRegistrado,
                )}
                {" · "}
                pendiente{" "}
                {formatoMoneda.format(
                  reserva
                    .montoPendienteRegistrado,
                )}
              </p>
            ) : (
              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                Todavía sin completar
              </p>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-black text-indigo-700">
              {formatoMoneda.format(
                reserva
                  .montoReservado,
              )}
            </p>

            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-indigo-400">
              Reservado
            </p>
          </div>
        </div>

        {esParcial && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[9px] font-bold leading-4 text-amber-700">
            Se mantiene reservado el total hasta completar el pago.
          </p>
        )}
      </div>
    </div>
  );
}

export function ExpenseAccountCard({
  ingresos,
  gastos,
  pagosFijos,
  pagosTarjeta,
  compromisosFijos,
  cargandoIngresos,
  cargandoPresupuesto,
  cargandoCompromisos,
}: ExpenseAccountCardProps) {
  const account =
    useExpenseAccount();

  const [
    editando,
    setEditando,
  ] =
    useState(false);

  const [
    mostrandoMovimientos,
    setMostrandoMovimientos,
  ] =
    useState(false);

  const [
    mostrandoReservas,
    setMostrandoReservas,
  ] =
    useState(false);

  const [
    nombre,
    setNombre,
  ] =
    useState(
      EXPENSE_ACCOUNT_DEFAULT_NAME,
    );

  const [
    saldoInicial,
    setSaldoInicial,
  ] =
    useState(
      "0",
    );

  const [
    fechaSaldoInicial,
    setFechaSaldoInicial,
  ] =
    useState(
      fechaHoyISO,
    );

  const [
    errorLocal,
    setErrorLocal,
  ] =
    useState<
      string | null
    >(
      null,
    );

  useEffect(
    () => {
      if (
        !account.cuenta
      ) {
        return;
      }

      setNombre(
        account
          .cuenta
          .nombre,
      );

      setSaldoInicial(
        String(
          account
            .cuenta
            .saldoInicial,
        ),
      );

      setFechaSaldoInicial(
        account
          .cuenta
          .fechaSaldoInicial,
      );
    },
    [
      account.cuenta,
    ],
  );

  const resumen =
    useMemo(
      () =>
        account.cuenta
          ? calcularResumenCuentaGastos(
              account.cuenta,
              ingresos,
              gastos,
              pagosFijos,
              compromisosFijos,
              pagosTarjeta,
            )
          : null,
      [
        account.cuenta,
        ingresos,
        gastos,
        pagosFijos,
        compromisosFijos,
        pagosTarjeta,
      ],
    );

  const cargandoMovimientos =
    cargandoIngresos ||
    cargandoPresupuesto ||
    cargandoCompromisos;

  const comenzarEdicion =
    () => {
      account
        .limpiarError();

      setErrorLocal(
        null,
      );

      if (
        account.cuenta
      ) {
        setNombre(
          account
            .cuenta
            .nombre,
        );

        setSaldoInicial(
          String(
            resumen
              ?.saldoActual ??
              account
                .cuenta
                .saldoInicial,
          ),
        );

        setFechaSaldoInicial(
          fechaHoyISO(),
        );
      } else {
        setNombre(
          EXPENSE_ACCOUNT_DEFAULT_NAME,
        );

        setSaldoInicial(
          "0",
        );

        setFechaSaldoInicial(
          fechaHoyISO(),
        );
      }

      setEditando(
        true,
      );
    };

  const cancelarEdicion =
    () => {
      if (
        account.guardando
      ) {
        return;
      }

      setErrorLocal(
        null,
      );

      setEditando(
        false,
      );
    };

  const guardar =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event
        .preventDefault();

      setErrorLocal(
        null,
      );

      const monto =
        Number(
          saldoInicial,
        );

      if (
        !nombre.trim()
      ) {
        setErrorLocal(
          "Escribe el nombre de la cuenta.",
        );

        return;
      }

      if (
        !Number.isFinite(
          monto,
        )
      ) {
        setErrorLocal(
          "Escribe un saldo inicial válido.",
        );

        return;
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          fechaSaldoInicial,
        )
      ) {
        setErrorLocal(
          "Selecciona la fecha del saldo inicial.",
        );

        return;
      }

      const guardado =
        await account
          .guardarCuenta({
            nombre:
              nombre.trim(),

            saldoInicial:
              monto,

            fechaSaldoInicial,

            activa:
              true,
          });

      if (
        guardado
      ) {
        setEditando(
          false,
        );
      }
    };

  if (
    account.cargando
  ) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <LoaderCircle className="h-5 w-5 animate-spin" />
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Cuenta operativa
            </p>

            <p className="mt-1 text-sm font-bold text-slate-600">
              Cargando Cuenta de gastos...
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Landmark className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Cuenta operativa
                </p>

                <h2 className="mt-1 text-lg font-black text-slate-900">
                  {account
                    .cuenta
                    ?.nombre ??
                    EXPENSE_ACCOUNT_DEFAULT_NAME}
                </h2>

                <p className="mt-1 max-w-xl text-xs font-medium leading-5 text-slate-500">
                  Controla cuánto dinero hay realmente en la cuenta y cuánto está libre después de reservar los compromisos.
                </p>
              </div>

              {!editando && (
                <button
                  type="button"
                  onClick={
                    comenzarEdicion
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />

                  {account.configurada
                    ? "Recalibrar"
                    : "Configurar"}
                </button>
              )}
            </div>

            {!editando &&
              account.cuenta &&
              resumen && (
                <div className="mt-5 space-y-3">
                  {/*
                   * =====================================================
                   * 2B — DISPONIBLE REAL
                   * =====================================================
                   */}
                  <div
                    className={`rounded-2xl p-5 ${
                      resumen
                        .disponibleReal <
                      0
                        ? "bg-rose-50"
                        : "bg-emerald-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck
                            className={`h-4 w-4 ${
                              resumen
                                .disponibleReal <
                              0
                                ? "text-rose-600"
                                : "text-emerald-600"
                            }`}
                          />

                          <p
                            className={`text-[10px] font-black uppercase tracking-[0.14em] ${
                              resumen
                                .disponibleReal <
                              0
                                ? "text-rose-600"
                                : "text-emerald-600"
                            }`}
                          >
                            Disponible real
                          </p>
                        </div>

                        {cargandoMovimientos ? (
                          <div className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-600">
                            <LoaderCircle className="h-4 w-4 animate-spin" />

                            Calculando disponibilidad...
                          </div>
                        ) : (
                          <>
                            <p
                              className={`mt-2 text-4xl font-black ${
                                resumen
                                  .disponibleReal <
                                0
                                  ? "text-rose-700"
                                  : "text-emerald-800"
                              }`}
                            >
                              {formatoMoneda.format(
                                resumen
                                  .disponibleReal,
                              )}
                            </p>

                            {resumen
                              .disponibleReal <
                            0 ? (
                              <p className="mt-1 text-[11px] font-bold text-rose-600">
                                Faltan{" "}
                                {formatoMoneda.format(
                                  resumen
                                    .faltanteReal,
                                )}{" "}
                                para cubrir los compromisos reservados.
                              </p>
                            ) : (
                              <p className="mt-1 text-[11px] font-semibold text-emerald-700/70">
                                Este es el dinero que no está reservado actualmente.
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <ShieldCheck
                        className={`h-7 w-7 ${
                          resumen
                            .disponibleReal <
                          0
                            ? "text-rose-300"
                            : "text-emerald-300"
                        }`}
                      />
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-black/5 pt-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                          Saldo actual
                        </p>

                        <p
                          className={`mt-1 text-lg font-black ${
                            resumen
                              .saldoActual <
                            0
                              ? "text-rose-700"
                              : "text-slate-800"
                          }`}
                        >
                          {formatoMoneda.format(
                            resumen
                              .saldoActual,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                          Comprometido
                        </p>

                        <p className="mt-1 text-lg font-black text-indigo-700">
                          -{" "}
                          {formatoMoneda.format(
                            resumen
                              .totalComprometido,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl bg-sky-50 p-4">
                      <div className="flex items-center gap-2">
                        <ArrowDownToLine className="h-4 w-4 text-sky-600" />

                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-600">
                          Depósitos
                        </p>
                      </div>

                      <p className="mt-2 text-xl font-black text-sky-800">
                        +{" "}
                        {formatoMoneda.format(
                          resumen
                            .totalDepositosDesdeSaldoInicial,
                        )}
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-sky-700/70">
                        {resumen
                          .cantidadDepositos ===
                        1
                          ? "1 depósito nuevo"
                          : `${resumen.cantidadDepositos} depósitos nuevos`}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-rose-50 p-4">
                      <div className="flex items-center gap-2">
                        <ArrowUpFromLine className="h-4 w-4 text-rose-600" />

                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-600">
                          Débito / banco
                        </p>
                      </div>

                      <p className="mt-2 text-xl font-black text-rose-700">
                        -{" "}
                        {formatoMoneda.format(
                          resumen
                            .totalEgresosVariables,
                        )}
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-rose-700/70">
                        {resumen
                          .cantidadEgresosVariables ===
                        1
                          ? "1 salida variable"
                          : `${resumen.cantidadEgresosVariables} salidas variables`}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-amber-50 p-4">
                      <div className="flex items-center gap-2">
                        <ReceiptText className="h-4 w-4 text-amber-600" />

                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-600">
                          Fijos completos
                        </p>
                      </div>

                      <p className="mt-2 text-xl font-black text-amber-800">
                        -{" "}
                        {formatoMoneda.format(
                          resumen
                            .totalEgresosFijos,
                        )}
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-amber-700/70">
                        {resumen
                          .cantidadCompromisosFijosCompletos ===
                        1
                          ? "1 compromiso completo"
                          : `${resumen.cantidadCompromisosFijosCompletos} compromisos completos`}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-violet-50 p-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-violet-600" />

                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-600">
                          Pagos de tarjetas
                        </p>
                      </div>

                      <p className="mt-2 text-xl font-black text-violet-800">
                        -{" "}
                        {formatoMoneda.format(
                          resumen
                            .totalEgresosTarjetas,
                        )}
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-violet-700/70">
                        {resumen
                          .cantidadPagosTarjeta ===
                        1
                          ? "1 pago realizado"
                          : `${resumen.cantidadPagosTarjeta} pagos realizados`}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Total salidas
                      </p>

                      <p className="mt-2 text-xl font-black text-slate-800">
                        -{" "}
                        {formatoMoneda.format(
                          resumen
                            .totalEgresos,
                        )}
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-slate-500">
                        Variables + fijos + tarjetas
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Saldo base
                      </p>

                      <p
                        className={`mt-2 text-xl font-black ${
                          resumen
                            .saldoInicial <
                          0
                            ? "text-rose-600"
                            : "text-slate-800"
                        }`}
                      >
                        {formatoMoneda.format(
                          resumen
                            .saldoInicial,
                        )}
                      </p>

                      <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />

                        {etiquetaFecha(
                          account
                            .cuenta
                            .fechaSaldoInicial,
                        )}
                      </div>
                    </div>
                  </div>

                  {/*
                   * =====================================================
                   * DETALLE DEL DINERO COMPROMETIDO
                   * =====================================================
                   */}
                  <div className="overflow-hidden rounded-2xl border border-indigo-100">
                    <button
                      type="button"
                      onClick={
                        () =>
                          setMostrandoReservas(
                            (
                              actual,
                            ) =>
                              !actual,
                          )
                      }
                      className="flex w-full items-center justify-between gap-3 bg-indigo-50/70 px-4 py-3 text-left transition hover:bg-indigo-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                          <LockKeyhole className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-xs font-black text-slate-800">
                            Dinero comprometido
                          </p>

                          <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                            {resumen
                              .cantidadCompromisosReservados ===
                            1
                              ? `1 compromiso · ${etiquetaPeriodo(resumen.periodoReserva)}`
                              : `${resumen.cantidadCompromisosReservados} compromisos · ${etiquetaPeriodo(resumen.periodoReserva)}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <p className="text-sm font-black text-indigo-700">
                          {formatoMoneda.format(
                            resumen
                              .totalComprometido,
                          )}
                        </p>

                        {mostrandoReservas ? (
                          <ChevronUp className="h-4 w-4 text-indigo-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-indigo-400" />
                        )}
                      </div>
                    </button>

                    {mostrandoReservas && (
                      <div className="bg-white">
                        {resumen
                          .reservasCompromisos
                          .length ===
                        0 ? (
                          <div className="px-4 py-8 text-center">
                            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" />

                            <p className="mt-3 text-xs font-black text-slate-600">
                              No hay compromisos pendientes
                            </p>

                            <p className="mt-1 text-[10px] font-semibold text-slate-400">
                              El saldo actual está completamente libre de reservas fijas del mes.
                            </p>
                          </div>
                        ) : (
                          <div className="max-h-[28rem] overflow-y-auto px-4">
                            {resumen
                              .reservasCompromisos
                              .map(
                                (
                                  reserva,
                                ) => (
                                  <FilaReserva
                                    key={
                                      reserva.id
                                    }
                                    reserva={
                                      reserva
                                    }
                                  />
                                ),
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/*
                   * =====================================================
                   * HISTORIAL
                   * =====================================================
                   */}
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={
                        () =>
                          setMostrandoMovimientos(
                            (
                              actual,
                            ) =>
                              !actual,
                          )
                      }
                      className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                          <WalletCards className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-xs font-black text-slate-800">
                            Historial de la cuenta
                          </p>

                          <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                            {Math.max(
                              resumen
                                .movimientos
                                .length -
                                1,
                              0,
                            )} movimientos desde el saldo base
                          </p>
                        </div>
                      </div>

                      {mostrandoMovimientos ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </button>

                    {mostrandoMovimientos && (
                      <div className="bg-white">
                        {resumen
                          .movimientos
                          .length ===
                        1 ? (
                          <div className="px-4 py-8 text-center">
                            <WalletCards className="mx-auto h-7 w-7 text-slate-300" />

                            <p className="mt-3 text-xs font-black text-slate-600">
                              Todavía no hay movimientos nuevos
                            </p>

                            <p className="mt-1 text-[10px] font-semibold text-slate-400">
                              El historial comenzará desde el saldo base configurado.
                            </p>
                          </div>
                        ) : (
                          <div className="max-h-[32rem] overflow-y-auto px-4">
                            {resumen
                              .movimientos
                              .map(
                                (
                                  movimiento,
                                ) => (
                                  <FilaMovimientoCuenta
                                    key={
                                      movimiento.id
                                    }
                                    movimiento={
                                      movimiento
                                    }
                                  />
                                ),
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 px-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />

                      Disponible real = saldo actual - dinero comprometido
                    </div>

                    <p className="text-[10px] font-semibold text-slate-400">
                      Un gasto fijo parcial mantiene reservado su monto completo hasta quedar totalmente pagado.
                    </p>

                    <p className="text-[10px] font-semibold text-slate-400">
                      Los compromisos inactivos y los ya completados no consumen Disponible real.
                    </p>
                  </div>
                </div>
              )}

            {!editando &&
              !account.cuenta && (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-sm font-black text-slate-700">
                    La cuenta todavía no tiene un saldo inicial.
                  </p>

                  <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                    Configura el saldo que muestra actualmente el banco y la fecha de esa fotografía.
                  </p>
                </div>
              )}

            {editando && (
              <form
                onSubmit={
                  guardar
                }
                className="mt-5 space-y-4"
              >
                <div>
                  <label
                    htmlFor="expense-account-name"
                    className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"
                  >
                    Nombre de la cuenta
                  </label>

                  <input
                    id="expense-account-name"
                    type="text"
                    value={
                      nombre
                    }
                    onChange={(
                      event,
                    ) =>
                      setNombre(
                        event
                          .target
                          .value,
                      )
                    }
                    maxLength={
                      100
                    }
                    disabled={
                      account
                        .guardando
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="expense-account-balance"
                      className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"
                    >
                      Saldo de la cuenta
                    </label>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                        $
                      </span>

                      <input
                        id="expense-account-balance"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="-1000000"
                        max="1000000"
                        value={
                          saldoInicial
                        }
                        onChange={(
                          event,
                        ) =>
                          setSaldoInicial(
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          account
                            .guardando
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-3 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="expense-account-date"
                      className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"
                    >
                      Fecha del saldo
                    </label>

                    <input
                      id="expense-account-date"
                      type="date"
                      value={
                        fechaSaldoInicial
                      }
                      onChange={(
                        event,
                      ) =>
                        setFechaSaldoInicial(
                          event
                            .target
                            .value,
                        )
                      }
                      disabled={
                        account
                          .guardando
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-sky-50 px-3 py-2.5 text-[11px] font-semibold leading-5 text-sky-700">
                  Al recalibrar, los movimientos registrados hasta esta fecha se consideran incluidos dentro del nuevo saldo base.
                </div>

                {(errorLocal ||
                  account.error) && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700">
                    {errorLocal ??
                      account.error}
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={
                      cancelarEdicion
                    }
                    disabled={
                      account
                        .guardando
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />

                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={
                      account
                        .guardando
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {account
                      .guardando ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}

                    {account
                      .guardando
                      ? "Guardando..."
                      : "Guardar cuenta"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ExpenseAccountCard;