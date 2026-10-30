import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
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
  getDoc,
  setDoc,
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

function limiteBase(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    mensual:
      600,

    quincenal:
      300,

    ...overrides,
  };
}

function configuracionBase(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    limites: {
      comida:
        limiteBase(),

      gas:
        limiteBase({
          mensual:
            200,

          quincenal:
            100,
        }),
    },

    actualizadoEn:
      "2026-10-09T12:00:00.000Z",

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
            "configuracion",
            "presupuestoFelo",
          ),
          configuracionBase(),
        );

        await setDoc(
          doc(
            db,
            "users",
            USER_B,
            "configuracion",
            "presupuestoFelo",
          ),
          configuracionBase({
            limites: {
              comida:
                limiteBase({
                  mensual:
                    800,

                  quincenal:
                    400,
                }),

              gas:
                limiteBase({
                  mensual:
                    300,

                  quincenal:
                    150,
                }),
            },
          }),
        );
      },
    );
}

describe.sequential(
  "Firestore budget config rules",
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
      "configuración válida",
      () => {
        it(
          "acepta una configuración completa",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase(),
              ),
            );
          },
        );

        it(
          "acepta límites en cero",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida: {
                      mensual:
                        0,

                      quincenal:
                        0,
                    },

                    gas: {
                      mensual:
                        0,

                      quincenal:
                        0,
                    },
                  },
                }),
              ),
            );
          },
        );

        it(
          "acepta el monto máximo permitido",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida: {
                      mensual:
                        1000000,

                      quincenal:
                        1000000,
                    },

                    gas: {
                      mensual:
                        1000000,

                      quincenal:
                        1000000,
                    },
                  },
                }),
              ),
            );
          },
        );

        it(
          "permite actualizar la configuración propia",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida: {
                      mensual:
                        700,

                      quincenal:
                        350,
                    },

                    gas: {
                      mensual:
                        250,

                      quincenal:
                        125,
                    },
                  },

                  actualizadoEn:
                    "2026-10-09T14:00:00.000Z",
                }),
              ),
            );
          },
        );

        it(
          "permite leer la configuración propia",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            const snapshot =
              await assertSucceeds(
                getDoc(
                  doc(
                    db,
                    "users",
                    USER_A,
                    "configuracion",
                    "presupuestoFelo",
                  ),
                ),
              );

            expect(
              snapshot.exists(),
            ).toBe(
              true,
            );
          },
        );
      },
    );

    describe(
      "validación de montos",
      () => {
        it(
          "rechaza mensual negativo",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida:
                      limiteBase({
                        mensual:
                          -1,
                      }),

                    gas:
                      limiteBase(),
                  },
                }),
              ),
            );
          },
        );

        it(
          "rechaza quincenal negativo",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida:
                      limiteBase(),

                    gas:
                      limiteBase({
                        quincenal:
                          -1,
                      }),
                  },
                }),
              ),
            );
          },
        );

        it(
          "rechaza monto superior a 1000000",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida:
                      limiteBase(),

                    gas:
                      limiteBase({
                        mensual:
                          1000001,
                      }),
                  },
                }),
              ),
            );
          },
        );

        it(
          "rechaza monto almacenado como string",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida:
                      limiteBase({
                        mensual:
                          "600",
                      }),

                    gas:
                      limiteBase(),
                  },
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "estructura de cada límite",
      () => {
        it(
          "rechaza comida sin quincenal",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida: {
                      mensual:
                        600,
                    },

                    gas:
                      limiteBase(),
                  },
                }),
              ),
            );
          },
        );

        it(
          "rechaza gas sin mensual",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida:
                      limiteBase(),

                    gas: {
                      quincenal:
                        100,
                    },
                  },
                }),
              ),
            );
          },
        );

        it(
          "rechaza campo adicional dentro de comida",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida: {
                      mensual:
                        600,

                      quincenal:
                        300,

                      semanal:
                        150,
                    },

                    gas:
                      limiteBase(),
                  },
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "estructura de limites",
      () => {
        it(
          "rechaza configuración sin comida",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    gas:
                      limiteBase(),
                  },
                }),
              ),
            );
          },
        );

        it(
          "rechaza configuración sin gas",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida:
                      limiteBase(),
                  },
                }),
              ),
            );
          },
        );

        it(
          "rechaza categoría adicional",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: {
                    comida:
                      limiteBase(),

                    gas:
                      limiteBase(),

                    entretenimiento:
                      limiteBase(),
                  },
                }),
              ),
            );
          },
        );

        it(
          "rechaza limites que no sea objeto",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  limites: [
                    "comida",
                    "gas",
                  ],
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "schema principal",
      () => {
        it(
          "rechaza configuración sin limites",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                {
                  actualizadoEn:
                    "2026-10-09T12:00:00.000Z",
                },
              ),
            );
          },
        );

        it(
          "rechaza configuración sin actualizadoEn",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                {
                  limites: {
                    comida:
                      limiteBase(),

                    gas:
                      limiteBase(),
                  },
                },
              ),
            );
          },
        );

        it(
          "rechaza actualizadoEn demasiado corto",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  actualizadoEn:
                    "2026",
                }),
              ),
            );
          },
        );

        it(
          "rechaza actualizadoEn que no sea string",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  actualizadoEn:
                    123456,
                }),
              ),
            );
          },
        );

        it(
          "rechaza campo principal desconocido",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase({
                  admin:
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
          "impide modificar configuración de otro usuario",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
                configuracionBase(),
              ),
            );
          },
        );

        it(
          "impide leer configuración de otro usuario",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertFails(
              getDoc(
                doc(
                  db,
                  "users",
                  USER_B,
                  "configuracion",
                  "presupuestoFelo",
                ),
              ),
            );
          },
        );

        it(
          "impide borrar configuración propia",
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
                  "configuracion",
                  "presupuestoFelo",
                ),
              ),
            );
          },
        );
      },
    );
  },
);