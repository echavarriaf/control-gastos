"use client";

/*
 * Nombre: Historial centralizado de gastos fijos
 * Ruta: src/components/budget/FixedPaymentsHistoryModal.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-08-04
 *
 * Descripción:
 * Muestra todos los pagos de gastos fijos en una sola ventana.
 * Permite filtrar los movimientos por mes, quincena, compromiso
 * y método de pago, además de calcular el total correspondiente
 * a los filtros seleccionados.
 */

import {
    CalendarDays,
    CircleDollarSign,
    Filter,
    LoaderCircle,
    ReceiptText,
    Trash2,
    X,
} from "lucide-react";

import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    METODOS_PAGO,
} from "@/lib/budget/constants";

import type {
    MetodoPagoFijo,
    PagoFijo,
    Quincena,
} from "@/lib/budget/types";

import {
    fechaCorta,
    formatoMoneda,
    obtenerQuincenaDesdeISO,
} from "@/lib/budget/utils";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface FixedPaymentsHistoryModalProps {
    abierto: boolean;
    pagos: PagoFijo[];
    mesInicial: string;
    cargando: boolean;
    eliminandoPagoFijoId: string | null;

    onCerrar: () => void;

    onEliminarPago: (
        pago: PagoFijo,
    ) => void | Promise<void>;
}

type FiltroQuincena =
    | "todas"
    | Quincena;

type FiltroMetodo =
    | "todos"
    | MetodoPagoFijo;

/**
 * Convierte un periodo YYYY-MM en un nombre de mes legible.
 *
 * Crea una fecha con el primer día del periodo y utiliza Intl para
 * producir etiquetas como "agosto de 2026".
 */
function obtenerEtiquetaMes(
    periodo: string,
): string {
    const fecha =
        new Date(
            `${periodo}-01T12:00:00`,
        );

    if (
        Number.isNaN(
            fecha.getTime(),
        )
    ) {
        return periodo;
    }

    return new Intl.DateTimeFormat(
        "es-US",
        {
            month: "long",
            year: "numeric",
        },
    ).format(fecha);
}

/**
 * Ordena los pagos desde el más reciente hasta el más antiguo.
 *
 * Compara primero la fecha financiera del pago y utiliza el ID
 * como criterio estable cuando dos registros tienen la misma fecha.
 */
function ordenarPagos(
    primerPago: PagoFijo,
    segundoPago: PagoFijo,
): number {
    const diferenciaFecha =
        new Date(
            segundoPago.fecha,
        ).getTime() -
        new Date(
            primerPago.fecha,
        ).getTime();

    if (
        diferenciaFecha !== 0
    ) {
        return diferenciaFecha;
    }

    return segundoPago.id.localeCompare(
        primerPago.id,
    );
}

/**
 * Muestra el historial consolidado de pagos fijos.
 *
 * Mantiene los filtros dentro del modal, deriva la lista visible
 * con useMemo y suma únicamente los pagos que cumplen los criterios
 * seleccionados. El componente es de consulta y no modifica datos.
 */
export function FixedPaymentsHistoryModal({
    abierto,
    pagos,
    mesInicial,
    cargando,
    eliminandoPagoFijoId,
    onCerrar,
    onEliminarPago,
}: FixedPaymentsHistoryModalProps) {
    const [
        mesSeleccionado,
        setMesSeleccionado,
    ] =
        useState(
            mesInicial,
        );

    const [
        quincenaSeleccionada,
        setQuincenaSeleccionada,
    ] =
        useState<FiltroQuincena>(
            "todas",
        );

    const [
        compromisoSeleccionado,
        setCompromisoSeleccionado,
    ] =
        useState(
            "todos",
        );

    const [
        metodoSeleccionado,
        setMetodoSeleccionado,
    ] =
        useState<FiltroMetodo>(
            "todos",
        );

    const [
        pagoPendienteEliminar,
        setPagoPendienteEliminar,
    ] = useState<PagoFijo | null>(null);

    /**
     * Restablece los filtros cada vez que se abre el historial.
     *
     * Usa el mes activo del presupuesto como punto de partida y deja
     * los demás criterios mostrando todos los movimientos.
     */
    useEffect(() => {
        if (
            abierto
        ) {
            setMesSeleccionado(
                mesInicial,
            );

            setQuincenaSeleccionada(
                "todas",
            );

            setCompromisoSeleccionado(
                "todos",
            );

            setMetodoSeleccionado(
                "todos",
            );
        }
    }, [
        abierto,
        mesInicial,
    ]);

    /**
     * Permite cerrar la ventana con la tecla Escape.
     *
     * Registra el listener únicamente mientras el modal está abierto
     * y lo elimina automáticamente al cerrar o desmontar.
     */
    useEffect(() => {
        if (
            !abierto
        ) {
            return;
        }

        const cerrarConEscape = (
            event: KeyboardEvent,
        ) => {
            if (
                event.key ===
                "Escape"
            ) {
                onCerrar();
            }
        };

        window.addEventListener(
            "keydown",
            cerrarConEscape,
        );

        return () => {
            window.removeEventListener(
                "keydown",
                cerrarConEscape,
            );
        };
    }, [
        abierto,
        onCerrar,
    ]);

    /**
     * Construye los meses disponibles a partir del historial.
     *
     * Incluye siempre el mes activo aunque todavía no tenga pagos y
     * ordena los periodos desde el más reciente.
     */
    const mesesDisponibles =
        useMemo(
            () => {
                const periodos =
                    new Set<string>([
                        mesInicial,
                    ]);

                pagos.forEach(
                    (pago) => {
                        const periodo =
                            pago.fecha.slice(
                                0,
                                7,
                            );

                        if (
                            periodo.length ===
                            7
                        ) {
                            periodos.add(
                                periodo,
                            );
                        }
                    },
                );

                return Array.from(
                    periodos,
                ).sort(
                    (
                        primerPeriodo,
                        segundoPeriodo,
                    ) =>
                        segundoPeriodo.localeCompare(
                            primerPeriodo,
                        ),
                );
            },
            [
                mesInicial,
                pagos,
            ],
        );

    /**
     * Construye las opciones de gastos fijos presentes en el historial.
     *
     * Usa compromisoId como valor estable y conserva la descripción
     * más reciente disponible para cada compromiso.
     */
    const compromisosDisponibles =
        useMemo(
            () => {
                const compromisos =
                    new Map<
                        string,
                        string
                    >();

                pagos.forEach(
                    (pago) => {
                        compromisos.set(
                            pago.compromisoId,
                            pago.descripcion,
                        );
                    },
                );

                return Array.from(
                    compromisos.entries(),
                ).sort(
                    (
                        primerCompromiso,
                        segundoCompromiso,
                    ) =>
                        primerCompromiso[1]
                            .localeCompare(
                                segundoCompromiso[1],
                                "es",
                            ),
                );
            },
            [
                pagos,
            ],
        );

    /**
     * Filtra y ordena los movimientos según las selecciones actuales.
     *
     * Cada criterio se evalúa de forma independiente para permitir
     * cualquier combinación de mes, quincena, gasto y método.
     */
    const pagosFiltrados =
        useMemo(
            () =>
                pagos
                    .filter(
                        (pago) => {
                            const coincideMes =
                                pago.fecha.slice(
                                    0,
                                    7,
                                ) ===
                                mesSeleccionado;

                            const coincideQuincena =
                                quincenaSeleccionada ===
                                "todas" ||
                                obtenerQuincenaDesdeISO(
                                    pago.fecha,
                                ) ===
                                quincenaSeleccionada;

                            const coincideCompromiso =
                                compromisoSeleccionado ===
                                "todos" ||
                                pago.compromisoId ===
                                compromisoSeleccionado;

                            const coincideMetodo =
                                metodoSeleccionado ===
                                "todos" ||
                                pago.metodo ===
                                metodoSeleccionado;

                            return (
                                coincideMes &&
                                coincideQuincena &&
                                coincideCompromiso &&
                                coincideMetodo
                            );
                        },
                    )
                    .sort(
                        ordenarPagos,
                    ),
            [
                compromisoSeleccionado,
                mesSeleccionado,
                metodoSeleccionado,
                pagos,
                quincenaSeleccionada,
            ],
        );

    /**
     * Suma el monto de todos los pagos visibles.
     *
     * Reduce la lista ya filtrada para que el total siempre represente
     * exactamente los criterios seleccionados por el usuario.
     */
    const totalFiltrado =
        useMemo(
            () =>
                pagosFiltrados.reduce(
                    (
                        acumulado,
                        pago,
                    ) =>
                        acumulado +
                        pago.monto,
                    0,
                ),
            [
                pagosFiltrados,
            ],
        );

    if (
        !abierto
    ) {
        return null;
    }

    return (
        <div
            role="presentation"
            onMouseDown={(
                event,
            ) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onCerrar();
                }
            }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="fixed-payments-history-title"
                className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-slate-50 shadow-2xl sm:max-w-5xl sm:rounded-[2rem]"
            >
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:p-6">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">
                            Movimientos centralizados
                        </p>

                        <h2
                            id="fixed-payments-history-title"
                            className="mt-1 text-xl font-black text-slate-950 sm:text-2xl"
                        >
                            Historial de gastos fijos
                        </h2>

                        <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                            Consulta todos los pagos registrados sin abrir cada
                            tarjeta individual.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={
                            onCerrar
                        }
                        aria-label="Cerrar historial"
                        title="Cerrar"
                        className="shrink-0 rounded-2xl bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-950 active:scale-95"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="block">
                            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
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
                                        event.target.value,
                                    )
                                }
                                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                            >
                                {mesesDisponibles.map(
                                    (periodo) => (
                                        <option
                                            key={
                                                periodo
                                            }
                                            value={
                                                periodo
                                            }
                                        >
                                            {obtenerEtiquetaMes(
                                                periodo,
                                            )}
                                        </option>
                                    ),
                                )}
                            </select>
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                                Quincena
                            </span>

                            <select
                                value={
                                    String(
                                        quincenaSeleccionada,
                                    )
                                }
                                onChange={(
                                    event,
                                ) => {
                                    const valor =
                                        event.target.value;

                                    setQuincenaSeleccionada(
                                        valor ===
                                            "1" ||
                                            valor ===
                                            "2"
                                            ? Number(
                                                valor,
                                            ) as Quincena
                                            : "todas",
                                    );
                                }}
                                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                            >
                                <option value="todas">
                                    Todas
                                </option>

                                <option value="1">
                                    Quincena 1
                                </option>

                                <option value="2">
                                    Quincena 2
                                </option>
                            </select>
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                                Gasto fijo
                            </span>

                            <select
                                value={
                                    compromisoSeleccionado
                                }
                                onChange={(
                                    event,
                                ) =>
                                    setCompromisoSeleccionado(
                                        event.target.value,
                                    )
                                }
                                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                            >
                                <option value="todos">
                                    Todos
                                </option>

                                {compromisosDisponibles.map(
                                    ([
                                        compromisoId,
                                        descripcion,
                                    ]) => (
                                        <option
                                            key={
                                                compromisoId
                                            }
                                            value={
                                                compromisoId
                                            }
                                        >
                                            {descripcion}
                                        </option>
                                    ),
                                )}
                            </select>
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                                Método
                            </span>

                            <select
                                value={
                                    metodoSeleccionado
                                }
                                onChange={(
                                    event,
                                ) =>
                                    setMetodoSeleccionado(
                                        event.target
                                            .value as FiltroMetodo,
                                    )
                                }
                                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                            >
                                <option value="todos">
                                    Todos
                                </option>

                                {(
                                    Object.entries(
                                        METODOS_PAGO,
                                    ) as Array<
                                        [
                                            MetodoPagoFijo,
                                            string,
                                        ]
                                    >
                                ).map(
                                    ([
                                        metodo,
                                        etiqueta,
                                    ]) => (
                                        <option
                                            key={
                                                metodo
                                            }
                                            value={
                                                metodo
                                            }
                                        >
                                            {etiqueta}
                                        </option>
                                    ),
                                )}
                            </select>
                        </label>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <article className="rounded-2xl bg-indigo-600 p-4 text-white shadow-lg shadow-indigo-100">
                            <div className="flex items-center gap-2">
                                <CircleDollarSign className="h-5 w-5 text-indigo-200" />

                                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-100">
                                    Total pagado
                                </p>
                            </div>

                            <p className="mt-3 text-2xl font-black">
                                {formatoMoneda.format(
                                    totalFiltrado,
                                )}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-indigo-100">
                                Según los filtros seleccionados
                            </p>
                        </article>

                        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-2">
                                <ReceiptText className="h-5 w-5 text-slate-500" />

                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    Movimientos
                                </p>
                            </div>

                            <p className="mt-3 text-2xl font-black text-slate-950">
                                {pagosFiltrados.length}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-slate-500">
                                Pagos encontrados
                            </p>
                        </article>
                    </div>

                    <div className="mt-5 flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-400" />

                        <p className="text-xs font-black text-slate-700">
                            {obtenerEtiquetaMes(
                                mesSeleccionado,
                            )}
                        </p>
                    </div>

                    {cargando ? (
                        <div className="flex min-h-56 items-center justify-center">
                            <div className="text-center">
                                <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-indigo-600" />

                                <p className="mt-3 text-sm font-bold text-slate-500">
                                    Cargando movimientos
                                </p>
                            </div>
                        </div>
                    ) : pagosFiltrados.length ===
                        0 ? (
                        <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                            <ReceiptText className="mx-auto h-9 w-9 text-slate-300" />

                            <h3 className="mt-4 font-black text-slate-900">
                                No hay pagos con estos filtros
                            </h3>

                            <p className="mt-2 text-sm font-medium text-slate-500">
                                Cambia el mes o alguno de los filtros para consultar
                                otros movimientos.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-2">
                            {pagosFiltrados.map(
                                (pago) => {
                                    const quincena =
                                        obtenerQuincenaDesdeISO(
                                            pago.fecha,
                                        );

                                    return (
                                        <article
                                            key={
                                                pago.id
                                            }
                                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-black text-slate-950">
                                                            {pago.descripcion}
                                                        </h3>

                                                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-indigo-700">
                                                            Q{quincena}
                                                        </span>
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <CalendarDays className="h-3.5 w-3.5" />

                                                            {fechaCorta(
                                                                pago.fecha,
                                                            )}
                                                        </span>

                                                        <span>
                                                            {METODOS_PAGO[
                                                                pago.metodo
                                                            ]}
                                                        </span>
                                                    </div>
                                                </div>

                                                <strong className="shrink-0 text-base font-black text-emerald-700">
                                                    {formatoMoneda.format(
                                                        pago.monto,
                                                    )}
                                                </strong>
                                            </div>

                                            {pago.referencia ||
                                                pago.notas ? (
                                                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-5 text-slate-600">
                                                    {pago.referencia ? (
                                                        <p>
                                                            <span className="font-black text-slate-700">
                                                                Referencia:
                                                            </span>{" "}
                                                            {pago.referencia}
                                                        </p>
                                                    ) : null}

                                                    {pago.notas ? (
                                                        <p>
                                                            <span className="font-black text-slate-700">
                                                                Notas:
                                                            </span>{" "}
                                                            {pago.notas}
                                                        </p>
                                                    ) : null}

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPagoPendienteEliminar(pago)
                                                        }
                                                        aria-label={`Eliminar pago de ${pago.descripcion}`}
                                                        title="Eliminar pago"
                                                        className="rounded-xl bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : null}
                                        </article>
                                    );
                                },
                            )}
                            <ConfirmDialog
                                abierto={pagoPendienteEliminar !== null}
                                titulo="Eliminar pago registrado"
                                mensaje={
                                    pagoPendienteEliminar
                                        ? `Se eliminará el pago de ${formatoMoneda.format(
                                            pagoPendienteEliminar.monto,
                                        )} correspondiente a ${pagoPendienteEliminar.descripcion}. Esta acción no se puede deshacer.`
                                        : ""
                                }
                                textoConfirmar="Eliminar pago"
                                procesando={
                                    pagoPendienteEliminar?.id ===
                                    eliminandoPagoFijoId
                                }
                                peligroso
                                onCancelar={() =>
                                    setPagoPendienteEliminar(null)
                                }
                                onConfirmar={async () => {
                                    if (!pagoPendienteEliminar) {
                                        return;
                                    }

                                    await onEliminarPago(
                                        pagoPendienteEliminar,
                                    );

                                    setPagoPendienteEliminar(null);
                                }}
                            />
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

export default FixedPaymentsHistoryModal;