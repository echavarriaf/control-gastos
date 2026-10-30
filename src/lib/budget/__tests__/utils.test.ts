import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    anchoBarra,
    colorBarra,
    convertirFechaInputAISO,
    fechaInputLocal,
    fechaParaPeriodo,
    montoSeguro,
    normalizarCategoriaGasto,
    normalizarCategoriaPago,
    normalizarLimites,
    normalizarMetodoPago,
    normalizarMonto,
    normalizarPeriodicidad,
    obtenerPeriodo,
    obtenerPeriodoDesdeISO,
    obtenerQuincena,
    obtenerQuincenaDesdeISO,
    porcentaje,
} from "@/lib/budget/utils";

import { LIMITES_PREDETERMINADOS, } from "@/lib/budget/constants";

describe(
    "budget utils",
    () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        describe(
            "periodos y quincenas",
            () => {
                it(
                    "obtiene el periodo YYYY-MM",
                    () => {
                        const fecha =
                            new Date(
                                2026,
                                9,
                                9,
                                12,
                            );

                        expect(
                            obtenerPeriodo(
                                fecha,
                            ),
                        ).toBe(
                            "2026-10",
                        );
                    },
                );

                it(
                    "obtiene el periodo desde ISO",
                    () => {
                        expect(
                            obtenerPeriodoDesdeISO(
                                "2026-10-09T12:00:00",
                            ),
                        ).toBe(
                            "2026-10",
                        );
                    },
                );

                it(
                    "devuelve cadena vacía para una fecha ISO inválida",
                    () => {
                        expect(
                            obtenerPeriodoDesdeISO(
                                "fecha-invalida",
                            ),
                        ).toBe("");
                    },
                );

                it(
                    "considera el día 15 como Q1",
                    () => {
                        expect(
                            obtenerQuincena(
                                new Date(
                                    2026,
                                    9,
                                    15,
                                    12,
                                ),
                            ),
                        ).toBe(1);
                    },
                );

                it(
                    "considera el día 16 como Q2",
                    () => {
                        expect(
                            obtenerQuincena(
                                new Date(
                                    2026,
                                    9,
                                    16,
                                    12,
                                ),
                            ),
                        ).toBe(2);
                    },
                );

                it(
                    "obtiene la quincena desde ISO",
                    () => {
                        expect(
                            obtenerQuincenaDesdeISO(
                                "2026-10-20T12:00:00",
                            ),
                        ).toBe(2);
                    },
                );

                it(
                    "una fecha inválida usa Q1 como fallback",
                    () => {
                        expect(
                            obtenerQuincenaDesdeISO(
                                "invalida",
                            ),
                        ).toBe(1);
                    },
                );

                it(
                    "no desplaza el primer día del mes por timezone",
                    () => {
                        expect(
                            obtenerPeriodoDesdeISO(
                                "2026-10-01",
                            ),
                        ).toBe(
                            "2026-10",
                        );

                        expect(
                            obtenerPeriodoDesdeISO(
                                "2026-11-01",
                            ),
                        ).toBe(
                            "2026-11",
                        );

                        expect(
                            obtenerPeriodoDesdeISO(
                                "2027-01-01",
                            ),
                        ).toBe(
                            "2027-01",
                        );
                    },
                );

                it(
                    "mantiene correctamente el límite entre Q1 y Q2 con fechas YYYY-MM-DD",
                    () => {
                        expect(
                            obtenerQuincenaDesdeISO(
                                "2026-10-15",
                            ),
                        ).toBe(1);

                        expect(
                            obtenerQuincenaDesdeISO(
                                "2026-10-16",
                            ),
                        ).toBe(2);
                    },
                );

                it(
                    "rechaza fechas calendario imposibles",
                    () => {
                        expect(
                            obtenerPeriodoDesdeISO(
                                "2026-02-31",
                            ),
                        ).toBe("");

                        expect(
                            obtenerQuincenaDesdeISO(
                                "2026-02-31",
                            ),
                        ).toBe(1);
                    },
                );
            },
        );

        describe(
            "fechas de formulario",
            () => {
                it(
                    "convierte una fecha local al formato YYYY-MM-DD",
                    () => {
                        expect(
                            fechaInputLocal(
                                new Date(
                                    2026,
                                    0,
                                    5,
                                    12,
                                ),
                            ),
                        ).toBe(
                            "2026-01-05",
                        );
                    },
                );

                it(
                    "usa el día 15 para Q1 de otro periodo",
                    () => {
                        vi.useFakeTimers();

                        vi.setSystemTime(
                            new Date(
                                2026,
                                9,
                                9,
                                12,
                            ),
                        );

                        expect(
                            fechaParaPeriodo(
                                "2026-11",
                                1,
                            ),
                        ).toBe(
                            "2026-11-15",
                        );
                    },
                );

                it(
                    "usa el último día del mes para Q2",
                    () => {
                        vi.useFakeTimers();

                        vi.setSystemTime(
                            new Date(
                                2026,
                                9,
                                9,
                                12,
                            ),
                        );

                        expect(
                            fechaParaPeriodo(
                                "2026-11",
                                2,
                            ),
                        ).toBe(
                            "2026-11-30",
                        );
                    },
                );

                it(
                    "maneja febrero bisiesto en Q2",
                    () => {
                        vi.useFakeTimers();

                        vi.setSystemTime(
                            new Date(
                                2026,
                                9,
                                9,
                                12,
                            ),
                        );

                        expect(
                            fechaParaPeriodo(
                                "2028-02",
                                2,
                            ),
                        ).toBe(
                            "2028-02-29",
                        );
                    },
                );

                it(
                    "para el periodo actual usa la fecha actual",
                    () => {
                        vi.useFakeTimers();

                        vi.setSystemTime(
                            new Date(
                                2026,
                                9,
                                9,
                                12,
                            ),
                        );

                        expect(
                            fechaParaPeriodo(
                                "2026-10",
                                1,
                            ),
                        ).toBe(
                            "2026-10-09",
                        );

                        expect(
                            fechaParaPeriodo(
                                "2026-10",
                                2,
                            ),
                        ).toBe(
                            "2026-10-09",
                        );
                    },
                );

                it(
                    "convierte la fecha del input usando mediodía local",
                    () => {
                        const iso =
                            convertirFechaInputAISO(
                                "2026-10-09",
                            );

                        const fecha =
                            new Date(iso);

                        expect(
                            fecha.getFullYear(),
                        ).toBe(2026);

                        expect(
                            fecha.getMonth(),
                        ).toBe(9);

                        expect(
                            fecha.getDate(),
                        ).toBe(9);

                        expect(
                            fecha.getHours(),
                        ).toBe(12);
                    },
                );
            },
        );

        describe(
            "normalización",
            () => {
                it(
                    "normaliza categorías válidas",
                    () => {
                        expect(
                            normalizarCategoriaGasto(
                                "comida",
                            ),
                        ).toBe(
                            "comida",
                        );

                        expect(
                            normalizarCategoriaGasto(
                                "gas",
                            ),
                        ).toBe(
                            "gas",
                        );
                    },
                );

                it(
                    "convierte la categoría histórica transporte a gas",
                    () => {
                        expect(
                            normalizarCategoriaGasto(
                                "transporte",
                            ),
                        ).toBe(
                            "gas",
                        );
                    },
                );

                it(
                    "devuelve null para una categoría de gasto desconocida",
                    () => {
                        expect(
                            normalizarCategoriaGasto(
                                "otro",
                            ),
                        ).toBeNull();

                        expect(
                            normalizarCategoriaGasto(
                                undefined,
                            ),
                        ).toBeNull();
                    },
                );

                it(
                    "mantiene categorías válidas de pagos",
                    () => {
                        expect(
                            normalizarCategoriaPago(
                                "comida",
                            ),
                        ).toBe(
                            "comida",
                        );

                        expect(
                            normalizarCategoriaPago(
                                "gas",
                            ),
                        ).toBe(
                            "gas",
                        );

                        expect(
                            normalizarCategoriaPago(
                                "general",
                            ),
                        ).toBe(
                            "general",
                        );
                    },
                );

                it(
                    "usa general para categorías antiguas o inválidas de pagos",
                    () => {
                        expect(
                            normalizarCategoriaPago(
                                "desconocida",
                            ),
                        ).toBe(
                            "general",
                        );

                        expect(
                            normalizarCategoriaPago(
                                null,
                            ),
                        ).toBe(
                            "general",
                        );
                    },
                );

                it(
                    "mantiene métodos de pago fijo válidos",
                    () => {
                        expect(
                            normalizarMetodoPago(
                                "debito_automatico",
                            ),
                        ).toBe(
                            "debito_automatico",
                        );

                        expect(
                            normalizarMetodoPago(
                                "transferencia",
                            ),
                        ).toBe(
                            "transferencia",
                        );

                        expect(
                            normalizarMetodoPago(
                                "tarjeta",
                            ),
                        ).toBe(
                            "tarjeta",
                        );

                        expect(
                            normalizarMetodoPago(
                                "efectivo",
                            ),
                        ).toBe(
                            "efectivo",
                        );
                    },
                );

                it(
                    "usa otro para un método desconocido",
                    () => {
                        expect(
                            normalizarMetodoPago(
                                "bitcoin",
                            ),
                        ).toBe(
                            "otro",
                        );

                        expect(
                            normalizarMetodoPago(
                                undefined,
                            ),
                        ).toBe(
                            "otro",
                        );
                    },
                );

                it(
                    "normaliza periodicidad",
                    () => {
                        expect(
                            normalizarPeriodicidad(
                                "quincenal",
                            ),
                        ).toBe(
                            "quincenal",
                        );

                        expect(
                            normalizarPeriodicidad(
                                "mensual",
                            ),
                        ).toBe(
                            "mensual",
                        );

                        expect(
                            normalizarPeriodicidad(
                                "invalida",
                            ),
                        ).toBe(
                            "mensual",
                        );
                    },
                );

                it(
                    "normaliza montos numéricos y strings numéricos",
                    () => {
                        expect(
                            normalizarMonto(
                                125.5,
                                10,
                            ),
                        ).toBe(
                            125.5,
                        );

                        expect(
                            normalizarMonto(
                                "125.50",
                                10,
                            ),
                        ).toBe(
                            125.5,
                        );

                        expect(
                            normalizarMonto(
                                0,
                                10,
                            ),
                        ).toBe(0);
                    },
                );

                it(
                    "rechaza montos negativos o no numéricos",
                    () => {
                        expect(
                            normalizarMonto(
                                -1,
                                25,
                            ),
                        ).toBe(25);

                        expect(
                            normalizarMonto(
                                "abc",
                                25,
                            ),
                        ).toBe(25);

                        expect(
                            normalizarMonto(
                                Number.NaN,
                                25,
                            ),
                        ).toBe(25);
                    },
                );

                it(
                    "rellena límites faltantes con los valores predeterminados",
                    () => {
                        const resultado =
                            normalizarLimites({
                                comida: {
                                    mensual: 1500,
                                },
                            });

                        /**
                         * El valor explícitamente guardado
                         * debe conservarse.
                         */
                        expect(
                            resultado.comida.mensual,
                        ).toBe(1500);

                        /**
                         * Los valores ausentes deben usar
                         * la configuración predeterminada
                         * vigente de la aplicación.
                         */
                        expect(
                            resultado.comida.quincenal,
                        ).toBe(
                            LIMITES_PREDETERMINADOS
                                .comida.quincenal,
                        );

                        expect(
                            resultado.gas.mensual,
                        ).toBe(
                            LIMITES_PREDETERMINADOS
                                .gas.mensual,
                        );

                        expect(
                            resultado.gas.quincenal,
                        ).toBe(
                            LIMITES_PREDETERMINADOS
                                .gas.quincenal,
                        );
                    },
                );

                it(
                    "rechaza límites negativos y conserva defaults",
                    () => {
                        const resultado =
                            normalizarLimites({
                                comida: {
                                    mensual: -500,
                                    quincenal: -100,
                                },

                                gas: {
                                    mensual: -1,
                                    quincenal: -1,
                                },
                            });

                        expect(
                            resultado.comida,
                        ).toEqual(
                            LIMITES_PREDETERMINADOS
                                .comida,
                        );

                        expect(
                            resultado.gas,
                        ).toEqual(
                            LIMITES_PREDETERMINADOS
                                .gas,
                        );
                    },
                );
            },
        );

        describe(
            "porcentajes y UI financiera",
            () => {
                it(
                    "calcula porcentajes correctamente",
                    () => {
                        expect(
                            porcentaje(
                                50,
                                200,
                            ),
                        ).toBe(25);

                        expect(
                            porcentaje(
                                200,
                                200,
                            ),
                        ).toBe(100);
                    },
                );

                it(
                    "devuelve cero cuando el límite no es positivo",
                    () => {
                        expect(
                            porcentaje(
                                100,
                                0,
                            ),
                        ).toBe(0);

                        expect(
                            porcentaje(
                                100,
                                -10,
                            ),
                        ).toBe(0);
                    },
                );

                it(
                    "limita la barra visual entre cero y cien",
                    () => {
                        expect(
                            anchoBarra(-20),
                        ).toBe(0);

                        expect(
                            anchoBarra(50),
                        ).toBe(50);

                        expect(
                            anchoBarra(150),
                        ).toBe(100);
                    },
                );

                it(
                    "usa los colores correctos por porcentaje",
                    () => {
                        expect(
                            colorBarra(69),
                        ).toBe(
                            "bg-emerald-500",
                        );

                        expect(
                            colorBarra(70),
                        ).toBe(
                            "bg-amber-400",
                        );

                        expect(
                            colorBarra(90),
                        ).toBe(
                            "bg-rose-500",
                        );

                        expect(
                            colorBarra(100),
                        ).toBe(
                            "bg-rose-600",
                        );
                    },
                );

                it(
                    "montoSeguro acepta solamente números mayores que cero",
                    () => {
                        expect(
                            montoSeguro(
                                "25.50",
                            ),
                        ).toBe(
                            25.5,
                        );

                        expect(
                            montoSeguro("0"),
                        ).toBeNull();

                        expect(
                            montoSeguro("-5"),
                        ).toBeNull();

                        expect(
                            montoSeguro("abc"),
                        ).toBeNull();
                    },
                );
            },
        );
    },
);