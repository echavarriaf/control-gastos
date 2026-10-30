import {
    describe,
    expect,
    it,
} from "vitest";

import {
    clasificarTransaccionesTarjeta,
    crearResumenTarjeta,
} from "@/lib/budget/credit-cards/summary";

import type {
    GastoVariable,
    PagoFijo,
    PagoTarjeta,
    TarjetaCredito,
} from "@/lib/budget/types";

function crearTarjeta(
    overrides: Partial<TarjetaCredito> = {},
): TarjetaCredito {
    return {
        id: "tarjeta-1",
        nombre: "Tarjeta Test",
        ultimosCuatro: "1234",

        saldoInicial: 100,
        fechaSaldoInicial: "2026-10-01",

        diaCorte: 25,
        diaPago: 20,

        activa: true,

        estrategiaPago:
            "saldo_completo",

        pagoObjetivo: null,
        limiteCredito: 1000,

        notas: "",

        ...overrides,
    };
}

function crearGasto(
    overrides: Partial<GastoVariable> = {},
): GastoVariable {
    return {
        id: "gasto-1",
        concepto: "Compra test",
        monto: 50,

        categoria: null,

        fecha: "2026-10-05",
        creadoEn:
            "2026-10-05T12:00:00.000Z",

        metodoPago:
            "tarjeta_credito",

        tarjetaId:
            "tarjeta-1",

        estadoTarjeta:
            "contabilizada",

        ...overrides,
    };
}

function crearPago(
    overrides: Partial<PagoTarjeta> = {},
): PagoTarjeta {
    return {
        id: "pago-1",
        concepto: "Pago test",
        monto: 50,

        categoria: "general",

        fecha: "2026-10-05",
        creadoEn:
            "2026-10-05T12:00:00.000Z",

        tarjetaId:
            "tarjeta-1",

        estadoTarjeta:
            "contabilizada",

        ...overrides,
    };
}

function crearPagoFijo(
    overrides: Partial<PagoFijo> = {},
): PagoFijo {
    return {
        id: "pago-fijo-1",

        compromisoId:
            "compromiso-1",

        descripcion:
            "Pago fijo test",

        monto: 50,

        fecha: "2026-10-05",

        metodo: "tarjeta",
        periodicidad: "mensual",

        referencia: "",
        notas: "",

        tarjetaId:
            "tarjeta-1",

        ...overrides,
    };
}

const FECHA_FUERA_VENTANA =
    new Date(
        "2026-10-10T12:00:00",
    );

describe(
    "clasificarTransaccionesTarjeta",
    () => {
        it(
            "separa transacciones pendientes y contabilizadas correctamente",
            () => {
                const gastos = [
                    crearGasto({
                        id: "gasto-contabilizado",
                        estadoTarjeta:
                            "contabilizada",
                    }),

                    crearGasto({
                        id: "gasto-pendiente",
                        estadoTarjeta:
                            "pendiente",
                    }),

                    crearGasto({
                        id: "gasto-historico",
                        estadoTarjeta:
                            undefined,
                    }),
                ];

                const pagosFijos = [
                    crearPagoFijo({
                        id: "fijo-tarjeta",
                        metodo: "tarjeta",
                    }),

                    crearPagoFijo({
                        id: "fijo-transferencia",
                        metodo: "transferencia",
                        tarjetaId: null,
                    }),
                ];

                const pagos = [
                    crearPago({
                        id: "pago-contabilizado",
                        estadoTarjeta:
                            "contabilizada",
                    }),

                    crearPago({
                        id: "pago-pendiente",
                        estadoTarjeta:
                            "pendiente",
                    }),

                    crearPago({
                        id: "pago-historico",
                        estadoTarjeta:
                            undefined,
                    }),
                ];

                const resultado =
                    clasificarTransaccionesTarjeta(
                        gastos,
                        pagosFijos,
                        pagos,
                    );

                expect(
                    resultado
                        .gastosContabilizados
                        .map(
                            (gasto) =>
                                gasto.id,
                        ),
                ).toEqual([
                    "gasto-contabilizado",
                    "gasto-historico",
                ]);

                expect(
                    resultado
                        .gastosPendientes
                        .map(
                            (gasto) =>
                                gasto.id,
                        ),
                ).toEqual([
                    "gasto-pendiente",
                ]);

                expect(
                    resultado
                        .pagosFijosContabilizados
                        .map(
                            (pago) =>
                                pago.id,
                        ),
                ).toEqual([
                    "fijo-tarjeta",
                    "fijo-transferencia",
                ]);

                expect(
                    resultado
                        .pagosContabilizados
                        .map(
                            (pago) =>
                                pago.id,
                        ),
                ).toEqual([
                    "pago-contabilizado",
                    "pago-historico",
                ]);

                expect(
                    resultado
                        .pagosPendientesTarjeta
                        .map(
                            (pago) =>
                                pago.id,
                        ),
                ).toEqual([
                    "pago-pendiente",
                ]);
            },
        );
    },
);

describe(
    "crearResumenTarjeta",
    () => {
        it(
            "mantiene separados el saldo contabilizado y las transacciones pendientes",
            () => {
                const tarjeta =
                    crearTarjeta();

                const gastos = [
                    crearGasto({
                        id: "compra-contabilizada",
                        monto: 50,
                        estadoTarjeta:
                            "contabilizada",
                    }),

                    crearGasto({
                        id: "compra-pendiente",
                        monto: 25,
                        estadoTarjeta:
                            "pendiente",
                    }),
                ];

                const pagosFijos = [
                    crearPagoFijo({
                        monto: 40,
                    }),
                ];

                const pagos = [
                    crearPago({
                        id: "pago-contabilizado",
                        monto: 30,
                        estadoTarjeta:
                            "contabilizada",
                    }),

                    crearPago({
                        id: "pago-pendiente",
                        monto: 20,
                        estadoTarjeta:
                            "pendiente",
                    }),
                ];

                const resumen =
                    crearResumenTarjeta(
                        tarjeta,
                        gastos,
                        pagosFijos,
                        pagos,
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumen.saldoActual,
                ).toBe(160);

                expect(
                    resumen.comprasDesdeSaldo,
                ).toBe(50);

                expect(
                    resumen.cargosFijosDesdeSaldo,
                ).toBe(40);

                expect(
                    resumen.pagosDesdeSaldo,
                ).toBe(30);

                expect(
                    resumen.comprasPendientes,
                ).toBe(25);

                expect(
                    resumen.pagosPendientes,
                ).toBe(20);

                expect(
                    resumen.totalCargosPendientes,
                ).toBe(25);

                expect(
                    resumen.saldoProyectado,
                ).toBe(165);

                expect(
                    resumen.creditoDisponible,
                ).toBe(840);

                expect(
                    resumen.porcentajeUtilizado,
                ).toBe(16);

                expect(
                    resumen.montoReservarCuenta,
                ).toBe(25);
            },
        );

        it(
            "no duplica Comprometido cuando un pago pendiente cubre la deuda exigible",
            () => {
                const tarjeta =
                    crearTarjeta({
                        id: "tarjeta-reserva",

                        saldoInicial:
                            486.45,

                        limiteCredito:
                            5000,
                    });

                const pago =
                    crearPago({
                        id: "pago-pendiente-48645",

                        monto:
                            486.45,

                        fecha:
                            "2026-10-22",

                        creadoEn:
                            "2026-10-22T12:00:00.000Z",

                        tarjetaId:
                            "tarjeta-reserva",

                        estadoTarjeta:
                            "pendiente",
                    });

                const resumen =
                    crearResumenTarjeta(
                        tarjeta,
                        [],
                        [],
                        [
                            pago,
                        ],
                        new Date(
                            "2026-10-22T12:00:00",
                        ),
                    );

                expect(
                    resumen.saldoActual,
                ).toBe(486.45);

                expect(
                    resumen.pagosPendientes,
                ).toBe(486.45);

                expect(
                    resumen.saldoProyectado,
                ).toBe(0);

                expect(
                    resumen.montoReservarCuenta,
                ).toBe(486.45);

                expect(
                    resumen.montoReservarCuenta,
                ).not.toBe(972.90);
            },
        );

        it(
            "mueve una compra de pendiente a contabilizada sin duplicar el saldo",
            () => {
                const tarjeta =
                    crearTarjeta();

                const compraPendiente =
                    crearGasto({
                        monto: 50,

                        estadoTarjeta:
                            "pendiente",
                    });

                const resumenPendiente =
                    crearResumenTarjeta(
                        tarjeta,
                        [
                            compraPendiente,
                        ],
                        [],
                        [],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumenPendiente
                        .saldoActual,
                ).toBe(100);

                expect(
                    resumenPendiente
                        .comprasPendientes,
                ).toBe(50);

                expect(
                    resumenPendiente
                        .saldoProyectado,
                ).toBe(150);

                expect(
                    resumenPendiente
                        .montoReservarCuenta,
                ).toBe(50);

                const compraContabilizada =
                    {
                        ...compraPendiente,

                        estadoTarjeta:
                            "contabilizada",
                    } as GastoVariable;

                const resumenContabilizado =
                    crearResumenTarjeta(
                        tarjeta,
                        [
                            compraContabilizada,
                        ],
                        [],
                        [],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumenContabilizado
                        .saldoActual,
                ).toBe(150);

                expect(
                    resumenContabilizado
                        .comprasDesdeSaldo,
                ).toBe(50);

                expect(
                    resumenContabilizado
                        .comprasPendientes,
                ).toBe(0);

                expect(
                    resumenContabilizado
                        .totalCargosPendientes,
                ).toBe(0);

                expect(
                    resumenContabilizado
                        .saldoProyectado,
                ).toBe(150);

                expect(
                    resumenContabilizado
                        .montoReservarCuenta,
                ).toBe(0);

                expect(
                    resumenContabilizado
                        .saldoActual,
                ).not.toBe(200);
            },
        );

        it(
            "mueve un pago de pendiente a contabilizado sin descontarlo dos veces",
            () => {
                const tarjeta =
                    crearTarjeta({
                        saldoInicial:
                            300,
                    });

                const pagoPendiente =
                    crearPago({
                        monto: 80,

                        estadoTarjeta:
                            "pendiente",
                    });

                const resumenPendiente =
                    crearResumenTarjeta(
                        tarjeta,
                        [],
                        [],
                        [
                            pagoPendiente,
                        ],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumenPendiente
                        .saldoActual,
                ).toBe(300);

                expect(
                    resumenPendiente
                        .pagosDesdeSaldo,
                ).toBe(0);

                expect(
                    resumenPendiente
                        .pagosPendientes,
                ).toBe(80);

                expect(
                    resumenPendiente
                        .saldoProyectado,
                ).toBe(220);

                expect(
                    resumenPendiente
                        .montoReservarCuenta,
                ).toBe(80);

                const pagoContabilizado =
                    {
                        ...pagoPendiente,

                        estadoTarjeta:
                            "contabilizada",
                    } as PagoTarjeta;

                const resumenContabilizado =
                    crearResumenTarjeta(
                        tarjeta,
                        [],
                        [],
                        [
                            pagoContabilizado,
                        ],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumenContabilizado
                        .saldoActual,
                ).toBe(220);

                expect(
                    resumenContabilizado
                        .pagosDesdeSaldo,
                ).toBe(80);

                expect(
                    resumenContabilizado
                        .pagosPendientes,
                ).toBe(0);

                expect(
                    resumenContabilizado
                        .saldoProyectado,
                ).toBe(220);

                expect(
                    resumenContabilizado
                        .montoReservarCuenta,
                ).toBe(0);

                expect(
                    resumenContabilizado
                        .saldoActual,
                ).not.toBe(140);
            },
        );

        it(
            "reemplaza el monto de una compra pendiente al editarla sin acumular el valor anterior",
            () => {
                const tarjeta =
                    crearTarjeta();

                const compraOriginal =
                    crearGasto({
                        id: "compra-editable",
                        monto: 50,

                        estadoTarjeta:
                            "pendiente",
                    });

                const resumenOriginal =
                    crearResumenTarjeta(
                        tarjeta,
                        [
                            compraOriginal,
                        ],
                        [],
                        [],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumenOriginal
                        .comprasPendientes,
                ).toBe(50);

                expect(
                    resumenOriginal
                        .saldoProyectado,
                ).toBe(150);

                expect(
                    resumenOriginal
                        .montoReservarCuenta,
                ).toBe(50);

                const compraEditada =
                {
                    ...compraOriginal,

                    monto: 75,
                };

                const resumenEditado =
                    crearResumenTarjeta(
                        tarjeta,
                        [
                            compraEditada,
                        ],
                        [],
                        [],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumenEditado
                        .saldoActual,
                ).toBe(100);

                expect(
                    resumenEditado
                        .comprasPendientes,
                ).toBe(75);

                expect(
                    resumenEditado
                        .totalCargosPendientes,
                ).toBe(75);

                expect(
                    resumenEditado
                        .saldoProyectado,
                ).toBe(175);

                expect(
                    resumenEditado
                        .montoReservarCuenta,
                ).toBe(75);

                expect(
                    resumenEditado
                        .comprasPendientes,
                ).not.toBe(125);
            },
        );

        it(
            "reemplaza el monto de un pago fijo con tarjeta sin duplicar la deuda",
            () => {
                const tarjeta =
                    crearTarjeta({
                        saldoInicial:
                            200,

                        limiteCredito:
                            2000,
                    });

                const pagoOriginal =
                    crearPagoFijo({
                        id: "pago-fijo-editable",

                        monto: 60,
                    });

                const resumenOriginal =
                    crearResumenTarjeta(
                        tarjeta,
                        [],
                        [
                            pagoOriginal,
                        ],
                        [],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumenOriginal
                        .cargosFijosDesdeSaldo,
                ).toBe(60);

                expect(
                    resumenOriginal
                        .saldoActual,
                ).toBe(260);

                expect(
                    resumenOriginal
                        .saldoProyectado,
                ).toBe(260);

                expect(
                    resumenOriginal
                        .totalCargosPendientes,
                ).toBe(0);

                const pagoEditado =
                {
                    ...pagoOriginal,

                    monto: 90,
                };

                const resumenEditado =
                    crearResumenTarjeta(
                        tarjeta,
                        [],
                        [
                            pagoEditado,
                        ],
                        [],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumenEditado
                        .cargosFijosDesdeSaldo,
                ).toBe(90);

                expect(
                    resumenEditado
                        .saldoActual,
                ).toBe(290);

                expect(
                    resumenEditado
                        .saldoProyectado,
                ).toBe(290);

                expect(
                    resumenEditado
                        .totalCargosPendientes,
                ).toBe(0);

                expect(
                    resumenEditado
                        .saldoActual,
                ).not.toBe(350);
            },
        );

        it(
            "trata movimientos históricos sin estadoTarjeta como contabilizados",
            () => {
                const tarjeta =
                    crearTarjeta({
                        saldoInicial:
                            100,
                    });

                const gastoHistorico =
                    crearGasto({
                        id: "gasto-historico",

                        monto: 40,

                        estadoTarjeta:
                            undefined,
                    });

                const pagoHistorico =
                    crearPago({
                        id: "pago-historico",

                        monto: 15,

                        estadoTarjeta:
                            undefined,
                    });

                const resumen =
                    crearResumenTarjeta(
                        tarjeta,
                        [
                            gastoHistorico,
                        ],
                        [],
                        [
                            pagoHistorico,
                        ],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumen.comprasDesdeSaldo,
                ).toBe(40);

                expect(
                    resumen.pagosDesdeSaldo,
                ).toBe(15);

                expect(
                    resumen.comprasPendientes,
                ).toBe(0);

                expect(
                    resumen.pagosPendientes,
                ).toBe(0);

                expect(
                    resumen.saldoActual,
                ).toBe(125);

                expect(
                    resumen.saldoProyectado,
                ).toBe(125);
            },
        );

        it(
            "ignora movimientos anteriores a la fecha del saldo inicial",
            () => {
                const tarjeta =
                    crearTarjeta({
                        saldoInicial:
                            500,

                        fechaSaldoInicial:
                            "2026-10-10",
                    });

                const gastoAnterior =
                    crearGasto({
                        monto: 100,

                        fecha:
                            "2026-10-09",

                        creadoEn:
                            "2026-10-09T12:00:00.000Z",
                    });

                const pagoAnterior =
                    crearPago({
                        monto: 50,

                        fecha:
                            "2026-10-09",

                        creadoEn:
                            "2026-10-09T13:00:00.000Z",
                    });

                const pagoFijoAnterior =
                    crearPagoFijo({
                        monto: 75,

                        fecha:
                            "2026-10-09",
                    });

                const resumen =
                    crearResumenTarjeta(
                        tarjeta,
                        [
                            gastoAnterior,
                        ],
                        [
                            pagoFijoAnterior,
                        ],
                        [
                            pagoAnterior,
                        ],
                        new Date(
                            "2026-10-15T12:00:00",
                        ),
                    );

                expect(
                    resumen.comprasDesdeSaldo,
                ).toBe(0);

                expect(
                    resumen.cargosFijosDesdeSaldo,
                ).toBe(0);

                expect(
                    resumen.pagosDesdeSaldo,
                ).toBe(0);

                expect(
                    resumen.saldoActual,
                ).toBe(500);
            },
        );

        it(
            "ignora movimientos pertenecientes a otra tarjeta",
            () => {
                const tarjeta =
                    crearTarjeta({
                        id: "tarjeta-principal",
                        saldoInicial: 200,
                    });

                const gastoOtra =
                    crearGasto({
                        monto: 100,

                        tarjetaId:
                            "otra-tarjeta",
                    });

                const pagoOtra =
                    crearPago({
                        monto: 50,

                        tarjetaId:
                            "otra-tarjeta",
                    });

                const fijoOtra =
                    crearPagoFijo({
                        monto: 75,

                        tarjetaId:
                            "otra-tarjeta",
                    });

                const resumen =
                    crearResumenTarjeta(
                        tarjeta,
                        [
                            gastoOtra,
                        ],
                        [
                            fijoOtra,
                        ],
                        [
                            pagoOtra,
                        ],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumen.comprasDesdeSaldo,
                ).toBe(0);

                expect(
                    resumen.cargosFijosDesdeSaldo,
                ).toBe(0);

                expect(
                    resumen.pagosDesdeSaldo,
                ).toBe(0);

                expect(
                    resumen.saldoActual,
                ).toBe(200);
            },
        );

        it(
            "no carga a la tarjeta un pago fijo realizado por transferencia",
            () => {
                const tarjeta =
                    crearTarjeta({
                        saldoInicial:
                            300,
                    });

                const pagoFijo =
                    crearPagoFijo({
                        monto: 125,

                        metodo:
                            "transferencia",

                        tarjetaId:
                            null,
                    });

                const resumen =
                    crearResumenTarjeta(
                        tarjeta,
                        [],
                        [
                            pagoFijo,
                        ],
                        [],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumen.cargosFijosDesdeSaldo,
                ).toBe(0);

                expect(
                    resumen.saldoActual,
                ).toBe(300);

                expect(
                    resumen.totalCargosPendientes,
                ).toBe(0);
            },
        );

        it(
            "convierte un sobrepago en crédito a favor sin producir saldo negativo",
            () => {
                const tarjeta =
                    crearTarjeta({
                        saldoInicial:
                            100,
                    });

                const pago =
                    crearPago({
                        monto: 150,

                        estadoTarjeta:
                            "contabilizada",
                    });

                const resumen =
                    crearResumenTarjeta(
                        tarjeta,
                        [],
                        [],
                        [
                            pago,
                        ],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumen.pagosDesdeSaldo,
                ).toBe(150);

                expect(
                    resumen.saldoActual,
                ).toBe(0);

                expect(
                    resumen.creditoAFavor,
                ).toBe(50);

                expect(
                    resumen.saldoProyectado,
                ).toBe(0);
            },
        );

        it(
            "usa el mayor valor entre cargos pendientes y pagos pendientes para Comprometido",
            () => {
                const tarjeta =
                    crearTarjeta({
                        saldoInicial:
                            200,
                    });

                const compraPendiente =
                    crearGasto({
                        monto: 100,

                        estadoTarjeta:
                            "pendiente",
                    });

                const pagoPendiente =
                    crearPago({
                        monto: 60,

                        estadoTarjeta:
                            "pendiente",
                    });

                const resumen =
                    crearResumenTarjeta(
                        tarjeta,
                        [
                            compraPendiente,
                        ],
                        [],
                        [
                            pagoPendiente,
                        ],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumen.saldoActual,
                ).toBe(200);

                expect(
                    resumen.totalCargosPendientes,
                ).toBe(100);

                expect(
                    resumen.pagosPendientes,
                ).toBe(60);

                expect(
                    resumen.saldoProyectado,
                ).toBe(240);

                expect(
                    resumen.montoReservarCuenta,
                ).toBe(100);

                expect(
                    resumen.montoReservarCuenta,
                ).not.toBe(160);
            },
        );

        it(
            "mantiene cero cuando la tarjeta no tiene deuda ni movimientos",
            () => {
                const tarjeta =
                    crearTarjeta({
                        saldoInicial:
                            0,
                    });

                const resumen =
                    crearResumenTarjeta(
                        tarjeta,
                        [],
                        [],
                        [],
                        FECHA_FUERA_VENTANA,
                    );

                expect(
                    resumen.saldoActual,
                ).toBe(0);

                expect(
                    resumen.creditoAFavor,
                ).toBe(0);

                expect(
                    resumen.comprasPendientes,
                ).toBe(0);

                expect(
                    resumen.pagosPendientes,
                ).toBe(0);

                expect(
                    resumen.saldoProyectado,
                ).toBe(0);

                expect(
                    resumen.montoReservarCuenta,
                ).toBe(0);
            },
        );
    },
);
