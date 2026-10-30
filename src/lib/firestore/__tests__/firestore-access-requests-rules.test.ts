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
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  readFileSync,
} from "node:fs";

const PROJECT_ID =
  "demo-presupuesto";

const USER_CREATE =
  "usuario-create";

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

function solicitudBase(
  uid: string,
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    uid,

    nombre:
      "Felix Usuario",

    email:
      "felix@example.com",

    fotoUrl:
      null,

    estado:
      "pendiente",

    solicitadoEn:
      "2026-10-13T12:00:00.000Z",

    actualizadoEn:
      "2026-10-13T12:00:00.000Z",

    revisadoEn:
      null,

    revisadoPor:
      null,

    correoNotificacionEnviado:
      false,

    correoNotificacionEnviadoEn:
      null,

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
            "accessRequests",
            USER_A,
          ),
          solicitudBase(
            USER_A,
          ),
        );

        await setDoc(
          doc(
            db,
            "accessRequests",
            USER_B,
          ),
          solicitudBase(
            USER_B,
            {
              nombre:
                "Usuario B",

              email:
                "usuario-b@example.com",
            },
          ),
        );
      },
    );
}

describe.sequential(
  "Firestore access request rules",
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
      "creación válida",
      () => {
        it(
          "permite crear solicitud propia",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertSucceeds(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                ),
              ),
            );
          },
        );

        it(
          "acepta fotoUrl null",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertSucceeds(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    fotoUrl:
                      null,
                  },
                ),
              ),
            );
          },
        );

        it(
          "acepta fotoUrl válida",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertSucceeds(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    fotoUrl:
                      "https://example.com/foto.jpg",
                  },
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "identidad",
      () => {
        it(
          "rechaza crear solicitud en el uid de otro usuario",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_B,
                ),
                solicitudBase(
                  USER_B,
                ),
              ),
            );
          },
        );

        it(
          "rechaza uid interno diferente al uid autenticado",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_B,
                ),
              ),
            );
          },
        );

        it(
          "rechaza uid vacío",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    uid:
                      "",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza uid mayor de 128 caracteres",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    uid:
                      "x".repeat(
                        129,
                      ),
                  },
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "datos personales",
      () => {
        it(
          "rechaza nombre vacío",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    nombre:
                      "",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza nombre mayor de 150 caracteres",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    nombre:
                      "x".repeat(
                        151,
                      ),
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza email demasiado corto",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    email:
                      "a",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza email mayor de 320 caracteres",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    email:
                      "x".repeat(
                        321,
                      ),
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza fotoUrl vacía",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    fotoUrl:
                      "",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza fotoUrl mayor de 2000 caracteres",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    fotoUrl:
                      "x".repeat(
                        2001,
                      ),
                  },
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "estado inicial",
      () => {
        it(
          "rechaza estado aprobado",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    estado:
                      "aprobado",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza estado rechazado",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    estado:
                      "rechazado",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza revisadoEn establecido por cliente",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    revisadoEn:
                      "2026-10-13T12:30:00.000Z",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza revisadoPor establecido por cliente",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    revisadoPor:
                      "admin",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza correo ya marcado como enviado",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    correoNotificacionEnviado:
                      true,
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza correoNotificacionEnviado con tipo incorrecto",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    correoNotificacionEnviado:
                      "false",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza fecha de correo inicial no nula",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    correoNotificacionEnviadoEn:
                      "2026-10-13T12:30:00.000Z",
                  },
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "fechas",
      () => {
        it(
          "rechaza solicitadoEn demasiado corto",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    solicitadoEn:
                      "2026",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza actualizadoEn demasiado corto",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    actualizadoEn:
                      "2026",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza solicitadoEn que no sea string",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    solicitadoEn:
                      123456,
                  },
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "schema",
      () => {
        it(
          "rechaza campo desconocido",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                solicitudBase(
                  USER_CREATE,
                  {
                    esAdmin:
                      true,
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza campo obligatorio faltante",
          async () => {
            const db =
              dbUsuario(
                USER_CREATE,
              );

            const data =
              solicitudBase(
                USER_CREATE,
              );

            delete data.email;

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_CREATE,
                ),
                data,
              ),
            );
          },
        );
      },
    );

    describe(
      "lectura y mutaciones",
      () => {
        it(
          "permite consultar solicitud propia",
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
                    "accessRequests",
                    USER_A,
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

        it(
          "impide consultar solicitud de otro usuario",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertFails(
              getDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_B,
                ),
              ),
            );
          },
        );

        it(
          "impide listar solicitudes",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertFails(
              getDocs(
                collection(
                  db,
                  "accessRequests",
                ),
              ),
            );
          },
        );

        it(
          "impide actualizar solicitud propia",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertFails(
              updateDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_A,
                ),
                {
                  nombre:
                    "Nombre cambiado",
                },
              ),
            );
          },
        );

        it(
          "impide borrar solicitud propia",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertFails(
              deleteDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_A,
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "usuario no autenticado",
      () => {
        it(
          "impide crear solicitud",
          async () => {
            const db =
              testEnv
                .unauthenticatedContext()
                .firestore();

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  "anonimo",
                ),
                solicitudBase(
                  "anonimo",
                ),
              ),
            );
          },
        );

        it(
          "impide consultar solicitud",
          async () => {
            const db =
              testEnv
                .unauthenticatedContext()
                .firestore();

            await assertFails(
              getDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_A,
                ),
              ),
            );
          },
        );
      },
    );
  },
);