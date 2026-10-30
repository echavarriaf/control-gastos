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
  deleteDoc,
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

function compromisoBase(
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    descripcion:
      "Préstamo Amex",

    monto:
      145,

    diaVencimiento:
      14,

    quincenaPresupuestaria:
      1,

    prioridad:
      2,

    metodoPagoPreferido:
      "transferencia",

    tarjetaId:
      null,

    activo:
      true,

    creadoEn:
      Timestamp.now(),

    actualizadoEn:
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
            activo:
              true,
          },
        );

        await setDoc(
          doc(
            db,
            "allowedUsers",
            USER_B,
          ),
          {
            activo:
              true,
          },
        );

        /*
         * Solo necesitamos que existan.
         * La estructura de TarjetaCredito
         * no forma parte de estos tests.
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

        /*
         * Documento existente para probar
         * update y delete.
         */
        await setDoc(
          doc(
            db,
            "users",
            USER_A,
            "compromisosFijos",
            "existente",
          ),
          compromisoBase(),
        );
      },
    );
}

describe.sequential(
  "Firestore fixed commitments rules",
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
      "documentos válidos",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase(),
              ),
            );
          },
        );

        it(
          "acepta compromiso con tarjeta propia",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  metodoPagoPreferido:
                    "tarjeta",

                  tarjetaId:
                    CARD_A,
                }),
              ),
            );
          },
        );

        it(
          "acepta compromiso inactivo",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  activo:
                    false,
                }),
              ),
            );
          },
        );

        it(
          "acepta creadoEn omitido",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            const data =
              compromisoBase();

            delete data.creadoEn;

            await assertSucceeds(
              setDoc(
                doc(
                  db,
                  "users",
                  USER_A,
                  "compromisosFijos",
                  "nuevo",
                ),
                data,
              ),
            );
          },
        );

        it(
          "acepta débito automático sin tarjeta",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  metodoPagoPreferido:
                    "debito_automatico",
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "descripción y monto",
      () => {
        it(
          "rechaza descripción vacía",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  descripcion:
                    "",
                }),
              ),
            );
          },
        );

        it(
          "rechaza descripción mayor de 250 caracteres",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  descripcion:
                    "x".repeat(
                      251,
                    ),
                }),
              ),
            );
          },
        );

        it(
          "rechaza monto cero",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  monto:
                    0,
                }),
              ),
            );
          },
        );

        it(
          "rechaza monto negativo",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  monto:
                    -1,
                }),
              ),
            );
          },
        );

        it(
          "rechaza monto superior al máximo permitido",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  monto:
                    1000001,
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "día de vencimiento",
      () => {
        it(
          "acepta día 1",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  diaVencimiento:
                    1,
                }),
              ),
            );
          },
        );

        it(
          "acepta día 31",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  diaVencimiento:
                    31,
                }),
              ),
            );
          },
        );

        it(
          "rechaza día cero",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  diaVencimiento:
                    0,
                }),
              ),
            );
          },
        );

        it(
          "rechaza día 32",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  diaVencimiento:
                    32,
                }),
              ),
            );
          },
        );

        it(
          "rechaza día decimal",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  diaVencimiento:
                    15.5,
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "quincena",
      () => {
        it(
          "acepta quincena 2",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  quincenaPresupuestaria:
                    2,
                }),
              ),
            );
          },
        );

        it(
          "rechaza quincena 0",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  quincenaPresupuestaria:
                    0,
                }),
              ),
            );
          },
        );

        it(
          "rechaza quincena 3",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  quincenaPresupuestaria:
                    3,
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "prioridad",
      () => {
        it(
          "acepta prioridad 1",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  prioridad:
                    1,
                }),
              ),
            );
          },
        );

        it(
          "acepta prioridad 3",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  prioridad:
                    3,
                }),
              ),
            );
          },
        );

        it(
          "rechaza prioridad 0",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  prioridad:
                    0,
                }),
              ),
            );
          },
        );

        it(
          "rechaza prioridad 4",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  prioridad:
                    4,
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "método y tarjeta",
      () => {
        it(
          "rechaza método desconocido",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  metodoPagoPreferido:
                    "cripto",
                }),
              ),
            );
          },
        );

        it(
          "rechaza método tarjeta sin tarjetaId",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  metodoPagoPreferido:
                    "tarjeta",

                  tarjetaId:
                    null,
                }),
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  metodoPagoPreferido:
                    "transferencia",

                  tarjetaId:
                    CARD_A,
                }),
              ),
            );
          },
        );

        it(
          "rechaza tarjeta perteneciente a otro usuario",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  metodoPagoPreferido:
                    "tarjeta",

                  tarjetaId:
                    CARD_B,
                }),
              ),
            );
          },
        );

        it(
          "rechaza tarjeta inexistente",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  metodoPagoPreferido:
                    "tarjeta",

                  tarjetaId:
                    "no-existe",
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "schema y seguridad",
      () => {
        it(
          "impide crear compromiso dentro de otro usuario",
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
                  USER_B,
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase(),
              ),
            );
          },
        );

        it(
          "rechaza campos desconocidos",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  campoHack:
                    true,
                }),
              ),
            );
          },
        );

        it(
          "rechaza activo que no sea boolean",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  activo:
                    "si",
                }),
              ),
            );
          },
        );

        it(
          "rechaza actualizadoEn que no sea timestamp",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  actualizadoEn:
                    "2026-10-09",
                }),
              ),
            );
          },
        );

        it(
          "rechaza creadoEn inválido cuando está presente",
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
                  "compromisosFijos",
                  "nuevo",
                ),
                compromisoBase({
                  creadoEn:
                    "2026-10-09",
                }),
              ),
            );
          },
        );

        it(
          "permite actualizar compromiso propio con datos válidos",
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
                  "compromisosFijos",
                  "existente",
                ),
                compromisoBase({
                  descripcion:
                    "Préstamo actualizado",

                  monto:
                    150,

                  actualizadoEn:
                    Timestamp.now(),
                }),
              ),
            );
          },
        );

        it(
          "impide borrar compromiso fijo",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertFails(
              deleteDoc(
                doc(
                  db,
                  "users",
                  USER_A,
                  "compromisosFijos",
                  "existente",
                ),
              ),
            );
          },
        );
      },
    );
  },
);