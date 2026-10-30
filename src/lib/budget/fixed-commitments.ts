import type {
    CompromisoFijo,
    MetodoPagoFijo,
    NuevoCompromisoFijo,
    PrioridadPago,
    Quincena,
} from "@/lib/budget/types";

const METODOS_VALIDOS =
    new Set<MetodoPagoFijo>([
        "debito_automatico",
        "transferencia",
        "tarjeta",
        "efectivo",
        "otro",
    ]);

function normalizarMonto(
    valor: unknown,
    predeterminado: number,
): number {
    const numero =
        typeof valor === "number"
            ? valor
            : Number(valor);

    return Number.isFinite(numero) &&
        numero >= 0
        ? numero
        : predeterminado;
}

function normalizarDia(
    valor: unknown,
    predeterminado: number,
): number {
    const numero =
        Math.trunc(
            Number(valor),
        );

    if (
        Number.isFinite(numero) &&
        numero >= 1 &&
        numero <= 31
    ) {
        return numero;
    }

    return predeterminado;
}

function normalizarQuincena(
    valor: unknown,
    diaVencimiento: number,
): Quincena {
    if (
        valor === 1 ||
        valor === 2
    ) {
        return valor;
    }

    return diaVencimiento <= 15
        ? 1
        : 2;
}

function normalizarPrioridad(
    valor: unknown,
    predeterminada: PrioridadPago,
): PrioridadPago {
    if (
        valor === 1 ||
        valor === 2 ||
        valor === 3
    ) {
        return valor;
    }

    return predeterminada;
}

function normalizarMetodo(
    valor: unknown,
    predeterminado:
        MetodoPagoFijo,
): MetodoPagoFijo {
    return (
        typeof valor === "string" &&
        METODOS_VALIDOS.has(
            valor as MetodoPagoFijo,
        )
    )
        ? (
            valor as
            MetodoPagoFijo
        )
        : predeterminado;
}

function normalizarTarjetaId(
    valor: unknown,
): string | null {
    if (
        typeof valor !==
        "string"
    ) {
        return null;
    }

    const tarjetaId =
        valor.trim();

    return tarjetaId.length > 0
        ? tarjetaId
        : null;
}

function normalizarFecha(
    valor: unknown,
): string | undefined {
    if (
        typeof valor ===
        "string" &&
        valor.trim().length > 0
    ) {
        return valor;
    }

    if (
        typeof valor ===
        "object" &&
        valor !== null &&
        "toDate" in valor &&
        typeof valor.toDate ===
        "function"
    ) {
        const fecha =
            valor.toDate();

        if (
            fecha instanceof Date &&
            !Number.isNaN(
                fecha.getTime(),
            )
        ) {
            return fecha.toISOString();
        }
    }

    return undefined;
}

export function normalizarDocumento(
    id: string,
    data: Record<
        string,
        unknown
    >,
    predeterminado?:
        CompromisoFijo,
): CompromisoFijo {
    const descripcion =
        typeof data.descripcion ===
            "string" &&
            data.descripcion
                .trim()
                .length > 0
            ? data.descripcion.trim()
            : (
                predeterminado
                    ?.descripcion ??
                "Gasto fijo"
            );

    const monto =
        normalizarMonto(
            data.monto,
            predeterminado
                ?.monto ?? 0,
        );

    const diaVencimiento =
        normalizarDia(
            data.diaVencimiento,
            predeterminado
                ?.diaVencimiento ??
            1,
        );

    return {
        id,

        descripcion,
        monto,
        diaVencimiento,

        quincenaPresupuestaria:
            normalizarQuincena(
                data
                    .quincenaPresupuestaria,
                diaVencimiento,
            ),

        prioridad:
            normalizarPrioridad(
                data.prioridad,
                predeterminado
                    ?.prioridad ?? 2,
            ),

        metodoPagoPreferido:
            normalizarMetodo(
                data
                    .metodoPagoPreferido,
                predeterminado
                    ?.metodoPagoPreferido ??
                "transferencia",
            ),

        tarjetaId:
            normalizarTarjetaId(
                data.tarjetaId,
            ),

        activo:
            typeof data.activo ===
                "boolean"
                ? data.activo
                : (
                    predeterminado
                        ?.activo ??
                    true
                ),

        creadoEn:
            normalizarFecha(
                data.creadoEn,
            ) ??
            predeterminado
                ?.creadoEn,

        actualizadoEn:
            normalizarFecha(
                data.actualizadoEn,
            ) ??
            predeterminado
                ?.actualizadoEn,
    };
}

export function validarCompromiso(
    compromiso:
        NuevoCompromisoFijo,
): NuevoCompromisoFijo {
    const descripcion =
        compromiso.descripcion.trim();

    if (!descripcion) {
        throw new Error(
            "Escribe el nombre del gasto fijo.",
        );
    }

    if (
        !Number.isFinite(
            compromiso.monto,
        ) ||
        compromiso.monto <= 0
    ) {
        throw new Error(
            "El monto debe ser mayor que cero.",
        );
    }

    const diaVencimiento =
        Math.trunc(
            compromiso
                .diaVencimiento,
        );

    if (
        diaVencimiento < 1 ||
        diaVencimiento > 31
    ) {
        throw new Error(
            "El día de vencimiento debe estar entre 1 y 31.",
        );
    }

    return {
        descripcion,

        monto:
            Math.round(
                compromiso.monto *
                100,
            ) / 100,

        diaVencimiento,

        quincenaPresupuestaria:
            compromiso
                .quincenaPresupuestaria,

        prioridad:
            compromiso.prioridad,

        metodoPagoPreferido:
            compromiso
                .metodoPagoPreferido,

        tarjetaId:
            normalizarTarjetaId(
                compromiso.tarjetaId,
            ),

        activo:
            compromiso.activo,
    };
}

export function ordenarCompromisos(
    a: CompromisoFijo,
    b: CompromisoFijo,
): number {
    if (
        a.activo !==
        b.activo
    ) {
        return a.activo
            ? -1
            : 1;
    }

    if (
        a.quincenaPresupuestaria !==
        b.quincenaPresupuestaria
    ) {
        return (
            a.quincenaPresupuestaria -
            b.quincenaPresupuestaria
        );
    }

    if (
        a.diaVencimiento !==
        b.diaVencimiento
    ) {
        return (
            a.diaVencimiento -
            b.diaVencimiento
        );
    }

    return a.descripcion.localeCompare(
        b.descripcion,
        "es",
    );
}