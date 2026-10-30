import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    it,
} from "vitest";

import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

import {
    doc,
    setDoc,
    Timestamp,
} from "firebase/firestore";

import {
    readFileSync,
} from "node:fs";

const PROJECT_ID =
    "demo-presupuesto-felo";

const USER_A =
    "usuario-a";

const USER_B =
    "usuario-b";

const CARD_A =
    "card-a";

const CARD_B =
    "card-b";

let testEnv:
    RulesTestEnvironment;

function dbUsuario(
    uid: string,
) {
    return testEnv
        .authenticatedContext(
            uid,
        )
        .firestore();
}

function gastoBase(
    overrides:
        Record<string, unknown> = {},
) {
    return {
        concepto:
            "Compra prueba",

        monto: 50,

        categoria:
            "comida",

        categoriaTarjetaId:
            "supermercado",

        categoriaTarjetaNombre:
            "Supermercado",

        comentario: "",

        fecha:
            "2026-10-09T12:00:00.000Z",

        metodoPago:
            "debito",

        tarjetaId:
            null,

        estadoTarjeta:
            null,

        creadoEn:
            Timestamp.now(),

        ...overrides,
    };
}

function pagoTarjetaBase(
    overrides:
        Record<string, unknown> = {},
) {
    return {
        concepto:
            "Pago Apple",

        tarjeta:
            "Pago Apple",

        monto: 100,

        categoria:
            "general",

        fecha:
            "2026-10-09T12:00:00.000Z",

        tarjetaId:
            CARD_A,

        estadoTarjeta:
            "contabilizada",

        referencia: "",

        notas: "",

        creadoEn:
            Timestamp.now(),

        ...overrides,
    };
}

function pagoFijoBase(
    overrides:
        Record<string, unknown> = {},
) {
    return {
        compromisoId:
            "compromiso-1",

        descripcion:
            "Pago fijo prueba",

        monto: 100,

        fecha:
            "2026-10-09T12:00:00.000Z",

        metodo:
            "transferencia",

        periodicidad:
            "mensual",

        quincena: 1,

        periodo:
            "2026-10",

        tarjetaId:
            null,

        estadoTarjeta:
            null,

        referencia: "",

        notas: "",

        creadoEn:
            Timestamp.now(),

        ...overrides,
    };
}

async function sembrarBase():
    Promise<void> {
    await testEnv
        .withSecurityRulesDisabled(
            async (
                context,
            ) => {
                const db =
                    context.firestore();

                await setDoc(
                    doc(
                        db,
                        "allowedUsers",
                        USER_A,
                    ),
                    {
                        activo: true,
                    },
                );

                await setDoc(
                    doc(
                        db,
                        "allowedUsers",
                        USER_B,
                    ),
                    {
                        activo: true,
                    },
                );

                await setDoc(
                    doc(
                        db,
                        "users",
                        USER_A,
                        "categoriasTarjeta",
                        "supermercado",
                    ),
                    {
                        nombre:
                            "Supermercado",

                        categoriaPresupuesto:
                            "comida",

                        activa: true,

                        requiereComentario:
                            false,
                    },
                );

                await setDoc(
                    doc(
                        db,
                        "users",
                        USER_B,
                        "categoriasTarjeta",
                        "supermercado",
                    ),
                    {
                        nombre:
                            "Supermercado",

                        categoriaPresupuesto:
                            "comida",

                        activa: true,

                        requiereComentario:
                            false,
                    },
                );

                /**
                 * Solo necesitamos que las tarjetas
                 * existan para probar referencias.
                 *
                 * Se crean con reglas deshabilitadas
                 * porque aquí no estamos probando
                 * tarjetaCreditoValida().
                 */
                await setDoc(
                    doc(
                        db,
                        "users",
                        USER_A,
                        "tarjetasCredito",
                        CARD_A,
                    ),
                    {
                        nombre:
                            "Card A",
                    },
                );

                await setDoc(
                    doc(
                        db,
                        "users",
                        USER_B,
                        "tarjetasCredito",
                        CARD_B,
                    ),
                    {
                        nombre:
                            "Card B",
                    },
                );
            },
        );
}

describe.sequential(
    "Firestore financial rules",
    () => {
        beforeAll(
            async () => {
                testEnv =
                    await initializeTestEnvironment(
                        {
                            projectId:
                                PROJECT_ID,

                            firestore: {
                                rules:
                                    readFileSync(
                                        "firestore.rules",
                                        "utf8",
                                    ),

                                host:
                                    "127.0.0.1",

                                port:
                                    8080,
                            },
                        },
                    );
            },
        );

        beforeEach(
            async () => {
                await testEnv
                    .clearFirestore();

                await sembrarBase();
            },
        );

        afterAll(
            async () => {
                await testEnv
                    .cleanup();
            },
        );

        describe(
            "gastos variables",
            () => {
                it(
                    "acepta un gasto por débito sin tarjeta",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertSucceeds(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "gastos",
                                    "gasto-1",
                                ),
                                gastoBase(),
                            ),
                        );
                    },
                );

                it(
                    "rechaza débito con tarjetaId",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertFails(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "gastos",
                                    "gasto-1",
                                ),
                                gastoBase({
                                    tarjetaId:
                                        CARD_A,

                                    estadoTarjeta:
                                        null,
                                }),
                            ),
                        );
                    },
                );

                it(
                    "rechaza gasto de tarjeta sin tarjetaId",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertFails(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "gastos",
                                    "gasto-1",
                                ),
                                gastoBase({
                                    metodoPago:
                                        "tarjeta_credito",

                                    tarjetaId:
                                        null,

                                    estadoTarjeta:
                                        "contabilizada",
                                }),
                            ),
                        );
                    },
                );

                it(
                    "acepta gasto de tarjeta contabilizado",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertSucceeds(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "gastos",
                                    "gasto-1",
                                ),
                                gastoBase({
                                    metodoPago:
                                        "tarjeta_credito",

                                    tarjetaId:
                                        CARD_A,

                                    estadoTarjeta:
                                        "contabilizada",
                                }),
                            ),
                        );
                    },
                );

                it(
                    "acepta gasto de tarjeta pendiente",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertSucceeds(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "gastos",
                                    "gasto-1",
                                ),
                                gastoBase({
                                    metodoPago:
                                        "tarjeta_credito",

                                    tarjetaId:
                                        CARD_A,

                                    estadoTarjeta:
                                        "pendiente",
                                }),
                            ),
                        );
                    },
                );

                it(
                    "rechaza estado de tarjeta inválido",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertFails(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "gastos",
                                    "gasto-1",
                                ),
                                gastoBase({
                                    metodoPago:
                                        "tarjeta_credito",

                                    tarjetaId:
                                        CARD_A,

                                    estadoTarjeta:
                                        "procesando",
                                }),
                            ),
                        );
                    },
                );

                it(
                    "impide usar una tarjeta perteneciente a otro usuario",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertFails(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "gastos",
                                    "gasto-1",
                                ),
                                gastoBase({
                                    metodoPago:
                                        "tarjeta_credito",

                                    tarjetaId:
                                        CARD_B,

                                    estadoTarjeta:
                                        "contabilizada",
                                }),
                            ),
                        );
                    },
                );
            },
        );

        describe(
            "pagos de tarjeta",
            () => {
                it(
                    "acepta pago contabilizado a una tarjeta propia",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertSucceeds(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "pagosTarjeta",
                                    "pago-1",
                                ),
                                pagoTarjetaBase(),
                            ),
                        );
                    },
                );

                it(
                    "acepta pago pendiente a tarjeta",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertSucceeds(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "pagosTarjeta",
                                    "pago-1",
                                ),
                                pagoTarjetaBase({
                                    estadoTarjeta:
                                        "pendiente",
                                }),
                            ),
                        );
                    },
                );

                it(
                    "rechaza pago con estado inválido",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertFails(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "pagosTarjeta",
                                    "pago-1",
                                ),
                                pagoTarjetaBase({
                                    estadoTarjeta:
                                        "procesando",
                                }),
                            ),
                        );
                    },
                );

                it(
                    "rechaza pago sin tarjetaId",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertFails(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "pagosTarjeta",
                                    "pago-1",
                                ),
                                pagoTarjetaBase({
                                    tarjetaId:
                                        null,
                                }),
                            ),
                        );
                    },
                );

                it(
                    "rechaza pago hacia tarjeta de otro usuario",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertFails(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "pagosTarjeta",
                                    "pago-1",
                                ),
                                pagoTarjetaBase({
                                    tarjetaId:
                                        CARD_B,
                                }),
                            ),
                        );
                    },
                );
            },
        );

        describe(
            "pagos fijos",
            () => {
                it(
                    "acepta transferencia sin tarjeta",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertSucceeds(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "pagosFijos",
                                    "fijo-1",
                                ),
                                pagoFijoBase(),
                            ),
                        );
                    },
                );

                it(
                    "rechaza transferencia con tarjetaId",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertFails(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "pagosFijos",
                                    "fijo-1",
                                ),
                                pagoFijoBase({
                                    tarjetaId:
                                        CARD_A,

                                    estadoTarjeta:
                                        null,
                                }),
                            ),
                        );
                    },
                );

                it(
                    "rechaza pago fijo con tarjeta sin tarjetaId",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertFails(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "pagosFijos",
                                    "fijo-1",
                                ),
                                pagoFijoBase({
                                    metodo:
                                        "tarjeta",

                                    tarjetaId:
                                        null,

                                    estadoTarjeta:
                                        "contabilizada",
                                }),
                            ),
                        );
                    },
                );

                it(
                    "rechaza pago fijo con tarjeta pendiente",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertFails(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "pagosFijos",
                                    "fijo-1",
                                ),
                                pagoFijoBase({
                                    metodo:
                                        "tarjeta",

                                    tarjetaId:
                                        CARD_A,

                                    estadoTarjeta:
                                        "pendiente",
                                }),
                            ),
                        );
                    },
                );

                it(
                    "acepta pago fijo con tarjeta contabilizada",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertSucceeds(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "pagosFijos",
                                    "fijo-1",
                                ),
                                pagoFijoBase({
                                    metodo:
                                        "tarjeta",

                                    tarjetaId:
                                        CARD_A,

                                    estadoTarjeta:
                                        "contabilizada",
                                }),
                            ),
                        );
                    },
                );

                it(
                    "impide que un pago fijo use tarjeta de otro usuario",
                    async () => {
                        const db =
                            dbUsuario(
                                USER_A,
                            );

                        await assertFails(
                            setDoc(
                                doc(
                                    db,
                                    "users",
                                    USER_A,
                                    "pagosFijos",
                                    "fijo-1",
                                ),
                                pagoFijoBase({
                                    metodo:
                                        "tarjeta",

                                    tarjetaId:
                                        CARD_B,

                                    estadoTarjeta:
                                        "contabilizada",
                                }),
                            ),
                        );
                    },
                );
            },
        );
    },
);