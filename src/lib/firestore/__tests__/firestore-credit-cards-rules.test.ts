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

function tarjetaBase(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    nombre:
      "Apple Card",

    ultimosCuatro:
      "1234",

    saldoInicial:
      100,

    fechaSaldoInicial:
      "2026-10-01",

    diaCorte:
      25,

    diaPago:
      20,

    activa:
      true,

    estrategiaPago:
      "saldo_completo",

    pagoObjetivo:
      null,

    limiteCredito:
      1000,

    notas:
      "",

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

        await setDoc(
          doc(
            db,
            "users",
            USER_A,
            "tarjetasCredito",
            "existente",
          ),
          tarjetaBase(),
        );
      },
    );
}

describe.sequential(
  "Firestore credit card rules",
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
      "documento válido",
      () => {
        it(
          "acepta una tarjeta válida",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase(),
              ),
            );
          },
        );

        it(
          "acepta ultimosCuatro vacío",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  ultimosCuatro:
                    "",
                }),
              ),
            );
          },
        );

        it(
          "acepta saldo inicial cero",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  saldoInicial:
                    0,
                }),
              ),
            );
          },
        );

        it(
          "acepta limiteCredito null",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  limiteCredito:
                    null,
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "últimos cuatro dígitos",
      () => {
        it(
          "rechaza tres dígitos",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  ultimosCuatro:
                    "123",
                }),
              ),
            );
          },
        );

        it(
          "rechaza cinco dígitos",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  ultimosCuatro:
                    "12345",
                }),
              ),
            );
          },
        );

        it(
          "rechaza letras",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  ultimosCuatro:
                    "12A4",
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "días de corte y pago",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  diaCorte:
                    1,

                  diaPago:
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  diaCorte:
                    31,

                  diaPago:
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  diaCorte:
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  diaPago:
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  diaCorte:
                    15.5,
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "estrategia de pago",
      () => {
        it(
          "acepta saldo completo sin pagoObjetivo",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  estrategiaPago:
                    "saldo_completo",

                  pagoObjetivo:
                    null,
                }),
              ),
            );
          },
        );

        it(
          "acepta pago mínimo sin pagoObjetivo",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  estrategiaPago:
                    "pago_minimo",

                  pagoObjetivo:
                    null,
                }),
              ),
            );
          },
        );

        it(
          "acepta pago objetivo positivo",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  estrategiaPago:
                    "pago_objetivo",

                  pagoObjetivo:
                    250,
                }),
              ),
            );
          },
        );

        it(
          "rechaza pago_objetivo sin monto",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  estrategiaPago:
                    "pago_objetivo",

                  pagoObjetivo:
                    null,
                }),
              ),
            );
          },
        );

        it(
          "rechaza pagoObjetivo cero",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  estrategiaPago:
                    "pago_objetivo",

                  pagoObjetivo:
                    0,
                }),
              ),
            );
          },
        );

        it(
          "rechaza estrategia desconocida",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  estrategiaPago:
                    "sin_estrategia",
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "montos y límite",
      () => {
        it(
          "rechaza saldo inicial negativo",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  saldoInicial:
                    -1,
                }),
              ),
            );
          },
        );

        it(
          "rechaza saldo inicial mayor al máximo",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  saldoInicial:
                    1000001,
                }),
              ),
            );
          },
        );

        it(
          "rechaza limiteCredito cero",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  limiteCredito:
                    0,
                }),
              ),
            );
          },
        );

        it(
          "rechaza limiteCredito negativo",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  limiteCredito:
                    -100,
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
          "rechaza nombre vacío",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  nombre:
                    "",
                }),
              ),
            );
          },
        );

        it(
          "rechaza campo desconocido",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  campoHack:
                    true,
                }),
              ),
            );
          },
        );

        it(
          "rechaza notas mayores de 1000 caracteres",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  notas:
                    "x".repeat(
                      1001,
                    ),
                }),
              ),
            );
          },
        );

        it(
          "rechaza creadoEn que no sea timestamp",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase({
                  creadoEn:
                    "2026-10-09",
                }),
              ),
            );
          },
        );

        it(
          "impide crear tarjeta dentro de otro usuario",
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
                  "tarjetasCredito",
                  "nueva",
                ),
                tarjetaBase(),
              ),
            );
          },
        );

        it(
          "permite actualizar tarjeta propia con datos válidos",
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
                  "tarjetasCredito",
                  "existente",
                ),
                tarjetaBase({
                  nombre:
                    "Apple Card editada",

                  saldoInicial:
                    150,

                  actualizadoEn:
                    Timestamp.now(),
                }),
              ),
            );
          },
        );

        it(
          "impide borrar tarjeta propia",
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
                  "tarjetasCredito",
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