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

function categoriaBase(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    nombre:
      "Supermercado",

    categoriaPresupuesto:
      "comida",

    requiereComentario:
      false,

    activa:
      true,

    orden:
      10,

    esSistema:
      false,

    creadoEn:
      Timestamp.now(),

    actualizadoEn:
      Timestamp.now(),

    ...overrides,
  };
}

function gastoBase(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    concepto:
      "Compra prueba",

    monto:
      50,

    categoria:
      "comida",

    categoriaTarjetaId:
      "supermercado",

    categoriaTarjetaNombre:
      "Supermercado",

    comentario:
      "",

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
            "categoriasTarjeta",
            "usuario-normal",
          ),
          categoriaBase({
            nombre:
              "Usuario normal",

            esSistema:
              false,
          }),
        );

        await setDoc(
          doc(
            db,
            "users",
            USER_A,
            "categoriasTarjeta",
            "sistema",
          ),
          categoriaBase({
            nombre:
              "Sistema",

            esSistema:
              true,
          }),
        );
      },
    );
}

describe.sequential(
  "Firestore card category rules",
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
      "schema de categoría",
      () => {
        it(
          "acepta categoría válida asociada a comida",
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
                  "categoriasTarjeta",
                  "supermercado",
                ),
                categoriaBase(),
              ),
            );
          },
        );

        it(
          "acepta categoría sin presupuesto asociado",
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
                  "categoriasTarjeta",
                  "otro",
                ),
                categoriaBase({
                  nombre:
                    "Otro",

                  categoriaPresupuesto:
                    null,

                  requiereComentario:
                    true,
                }),
              ),
            );
          },
        );

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
                  "categoriasTarjeta",
                  "invalida",
                ),
                categoriaBase({
                  nombre:
                    "",
                }),
              ),
            );
          },
        );

        it(
          "rechaza presupuesto desconocido",
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
                  "categoriasTarjeta",
                  "invalida",
                ),
                categoriaBase({
                  categoriaPresupuesto:
                    "entretenimiento",
                }),
              ),
            );
          },
        );

        it(
          "rechaza requiereComentario que no sea boolean",
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
                  "categoriasTarjeta",
                  "invalida",
                ),
                categoriaBase({
                  requiereComentario:
                    "si",
                }),
              ),
            );
          },
        );

        it(
          "rechaza activa que no sea boolean",
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
                  "categoriasTarjeta",
                  "invalida",
                ),
                categoriaBase({
                  activa:
                    1,
                }),
              ),
            );
          },
        );

        it(
          "rechaza orden negativo",
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
                  "categoriasTarjeta",
                  "invalida",
                ),
                categoriaBase({
                  orden:
                    -1,
                }),
              ),
            );
          },
        );

        it(
          "rechaza orden mayor de 100000",
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
                  "categoriasTarjeta",
                  "invalida",
                ),
                categoriaBase({
                  orden:
                    100001,
                }),
              ),
            );
          },
        );

        it(
          "rechaza orden decimal",
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
                  "categoriasTarjeta",
                  "invalida",
                ),
                categoriaBase({
                  orden:
                    1.5,
                }),
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
                  "categoriasTarjeta",
                  "invalida",
                ),
                categoriaBase({
                  hack:
                    true,
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "aislamiento y protección",
      () => {
        it(
          "impide crear categoría dentro del namespace de otro usuario",
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
                  "categoriasTarjeta",
                  "categoria-a",
                ),
                categoriaBase(),
              ),
            );
          },
        );

        it(
          "impide borrar una categoría",
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
                  "categoriasTarjeta",
                  "usuario-normal",
                ),
              ),
            );
          },
        );

        it(
          "permite actualizar una categoría normal",
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
                  "categoriasTarjeta",
                  "usuario-normal",
                ),
                categoriaBase({
                  nombre:
                    "Nuevo nombre",

                  esSistema:
                    false,
                }),
              ),
            );
          },
        );

        it(
          "permite actualizar categoría del sistema conservando esSistema true",
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
                  "categoriasTarjeta",
                  "sistema",
                ),
                categoriaBase({
                  nombre:
                    "Sistema actualizado",

                  esSistema:
                    true,
                }),
              ),
            );
          },
        );

        it(
          "impide convertir categoría del sistema en categoría normal",
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
                  "categoriasTarjeta",
                  "sistema",
                ),
                categoriaBase({
                  nombre:
                    "Intento",

                  esSistema:
                    false,
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "categoría usada por gastos",
      () => {
        it(
          "acepta gasto cuando categoría existe y coincide",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await testEnv
              .withSecurityRulesDisabled(
                async (
                  context,
                ) => {
                  await setDoc(
                    doc(
                      context.firestore(),
                      "users",
                      USER_A,
                      "categoriasTarjeta",
                      "supermercado",
                    ),
                    categoriaBase(),
                  );
                },
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
          "rechaza gasto con categoría inexistente",
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
                  categoriaTarjetaId:
                    "no-existe",
                }),
              ),
            );
          },
        );

        it(
          "rechaza gasto con categoría inactiva",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await testEnv
              .withSecurityRulesDisabled(
                async (
                  context,
                ) => {
                  await setDoc(
                    doc(
                      context.firestore(),
                      "users",
                      USER_A,
                      "categoriasTarjeta",
                      "supermercado",
                    ),
                    categoriaBase({
                      activa:
                        false,
                    }),
                  );
                },
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
                gastoBase(),
              ),
            );
          },
        );

        it(
          "rechaza gasto cuando presupuesto no coincide con la categoría",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await testEnv
              .withSecurityRulesDisabled(
                async (
                  context,
                ) => {
                  await setDoc(
                    doc(
                      context.firestore(),
                      "users",
                      USER_A,
                      "categoriasTarjeta",
                      "supermercado",
                    ),
                    categoriaBase({
                      categoriaPresupuesto:
                        "gas",
                    }),
                  );
                },
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
                  categoria:
                    "comida",
                }),
              ),
            );
          },
        );

        it(
          "rechaza gasto cuando el nombre visible fue manipulado",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await testEnv
              .withSecurityRulesDisabled(
                async (
                  context,
                ) => {
                  await setDoc(
                    doc(
                      context.firestore(),
                      "users",
                      USER_A,
                      "categoriasTarjeta",
                      "supermercado",
                    ),
                    categoriaBase(),
                  );
                },
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
                  categoriaTarjetaNombre:
                    "Nombre falso",
                }),
              ),
            );
          },
        );

        it(
          "rechaza gasto sin comentario cuando la categoría lo exige",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await testEnv
              .withSecurityRulesDisabled(
                async (
                  context,
                ) => {
                  await setDoc(
                    doc(
                      context.firestore(),
                      "users",
                      USER_A,
                      "categoriasTarjeta",
                      "supermercado",
                    ),
                    categoriaBase({
                      requiereComentario:
                        true,
                    }),
                  );
                },
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
                  comentario:
                    "",
                }),
              ),
            );
          },
        );

        it(
          "acepta gasto con comentario cuando la categoría lo exige",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await testEnv
              .withSecurityRulesDisabled(
                async (
                  context,
                ) => {
                  await setDoc(
                    doc(
                      context.firestore(),
                      "users",
                      USER_A,
                      "categoriasTarjeta",
                      "supermercado",
                    ),
                    categoriaBase({
                      requiereComentario:
                        true,
                    }),
                  );
                },
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
                  comentario:
                    "Compra semanal",
                }),
              ),
            );
          },
        );
      },
    );
  },
);