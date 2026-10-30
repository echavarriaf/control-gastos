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

function ingresoPrincipalBase(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    descripcion:
      "Ingreso principal",

    montoEstimado:
      2500,

    fuente:
      "salario",

    frecuencia:
      "cada_2_semanas",

    fechaAncla:
      "2026-10-09",

    intervaloDias:
      14,

    activa:
      true,

    notas:
      "",

    actualizadoEn:
      "2026-10-09T14:00:00.000Z",

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
            "ingresoPrincipal",
          ),
          ingresoPrincipalBase(),
        );

        await setDoc(
          doc(
            db,
            "users",
            USER_B,
            "configuracion",
            "ingresoPrincipal",
          ),
          ingresoPrincipalBase({
            descripcion:
              "Ingreso B",

            montoEstimado:
              3000,
          }),
        );
      },
    );
}

describe.sequential(
  "Firestore main income config rules",
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
          "acepta configuración completa",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase(),
              ),
            );
          },
        );

        it(
          "acepta configuración inactiva",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  activa:
                    false,
                }),
              ),
            );
          },
        );

        it(
          "acepta intervalo mínimo de 1 día",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  intervaloDias:
                    1,
                }),
              ),
            );
          },
        );

        it(
          "acepta intervalo máximo de 366 días",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  intervaloDias:
                    366,
                }),
              ),
            );
          },
        );

        it.each([
          "salario",
          "bono",
          "horas_extra",
          "reembolso",
          "otro",
        ])(
          "acepta fuente %s",
          async (
            fuente,
          ) => {
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  fuente,
                }),
              ),
            );
          },
        );

        it.each([
          "semanal",
          "cada_2_semanas",
          "dos_veces_mes",
          "mensual",
          "variable",
        ])(
          "acepta frecuencia %s",
          async (
            frecuencia,
          ) => {
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  frecuencia,
                }),
              ),
            );
          },
        );

        it(
          "permite actualizar configuración propia",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  descripcion:
                    "Nuevo salario",

                  montoEstimado:
                    2750,

                  actualizadoEn:
                    "2026-10-09T15:00:00.000Z",
                }),
              ),
            );
          },
        );

        it(
          "permite leer configuración propia",
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
                    "ingresoPrincipal",
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
                  "configuracion",
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  descripcion:
                    "",
                }),
              ),
            );
          },
        );

        it(
          "rechaza descripción mayor de 200 caracteres",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  descripcion:
                    "x".repeat(
                      201,
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
                  "configuracion",
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  montoEstimado:
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
                  "configuracion",
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  montoEstimado:
                    -1,
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  montoEstimado:
                    1000001,
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  montoEstimado:
                    "2500",
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "fuente y frecuencia",
      () => {
        it(
          "rechaza fuente desconocida",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  fuente:
                    "loteria",
                }),
              ),
            );
          },
        );

        it(
          "rechaza frecuencia desconocida",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  frecuencia:
                    "cada_3_dias",
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "fecha ancla",
      () => {
        it(
          "acepta fecha calendario válida",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  fechaAncla:
                    "2028-02-29",
                }),
              ),
            );
          },
        );

        it(
          "rechaza 31 de febrero",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  fechaAncla:
                    "2026-02-31",
                }),
              ),
            );
          },
        );

        it(
          "rechaza 29 de febrero en año no bisiesto",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  fechaAncla:
                    "2026-02-29",
                }),
              ),
            );
          },
        );

        it(
          "rechaza formato de fecha inválido",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  fechaAncla:
                    "10/09/2026",
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "intervalo",
      () => {
        it(
          "rechaza intervalo cero",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  intervaloDias:
                    0,
                }),
              ),
            );
          },
        );

        it(
          "rechaza intervalo 367",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  intervaloDias:
                    367,
                }),
              ),
            );
          },
        );

        it(
          "rechaza intervalo decimal",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  intervaloDias:
                    14.5,
                }),
              ),
            );
          },
        );
      },
    );

    describe(
      "estado y notas",
      () => {
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
                  "configuracion",
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  activa:
                    "si",
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
                  "configuracion",
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
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
          "rechaza notas que no sean string",
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  notas:
                    123,
                }),
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  actualizadoEn:
                    123,
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
                  "configuracion",
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase({
                  admin:
                    true,
                }),
              ),
            );
          },
        );

        it(
          "rechaza documento con campo obligatorio faltante",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            const data =
              ingresoPrincipalBase();

            delete data.intervaloDias;

            await assertFails(
              setDoc(
                doc(
                  db,
                  "users",
                  USER_A,
                  "configuracion",
                  "ingresoPrincipal",
                ),
                data,
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
                  "ingresoPrincipal",
                ),
              ),
            );
          },
        );

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
                  "ingresoPrincipal",
                ),
                ingresoPrincipalBase(),
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
                  "ingresoPrincipal",
                ),
              ),
            );
          },
        );
      },
    );
  },
);