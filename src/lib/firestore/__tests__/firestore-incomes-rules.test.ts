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

const EXISTING_A =
  "ciclo-a-existente";

const EXISTING_B =
  "ciclo-b-existente";

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

function ingresoBase(
  cicloPagoId: string,
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    configuracionIngresoId:
      "ingresoPrincipal",

    cicloPagoId,

    descripcion:
      "Salario",

    monto:
      2500,

    fechaProgramada:
      "2026-10-09",

    fechaRecibida:
      null,

    periodoCalendario:
      "2026-10",

    numeroPagoMes:
      1,

    numeroPagoAnual:
      20,

    fuente:
      "salario",

    estado:
      "proyectado",

    recurrente:
      true,

    notas:
      "",

    creadoEn:
      "2026-10-09T12:00:00.000Z",

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
            "ingresos",
            EXISTING_A,
          ),
          ingresoBase(
            EXISTING_A,
          ),
        );

        await setDoc(
          doc(
            db,
            "users",
            USER_B,
            "ingresos",
            EXISTING_B,
          ),
          ingresoBase(
            EXISTING_B,
            {
              descripcion:
                "Ingreso B",

              monto:
                3000,
            },
          ),
        );
      },
    );
}

describe.sequential(
  "Firestore incomes rules",
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
          "acepta ingreso proyectado",
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
                  "ingresos",
                  "nuevo",
                ),
                ingresoBase(
                  "nuevo",
                ),
              ),
            );
          },
        );

        it(
          "acepta ingreso recibido con fechaRecibida",
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
                  "ingresos",
                  "recibido",
                ),
                ingresoBase(
                  "recibido",
                  {
                    estado:
                      "recibido",

                    fechaRecibida:
                      "2026-10-09",
                  },
                ),
              ),
            );
          },
        );

        it(
          "acepta ingreso cancelado",
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
                  "ingresos",
                  "cancelado",
                ),
                ingresoBase(
                  "cancelado",
                  {
                    estado:
                      "cancelado",
                  },
                ),
              ),
            );
          },
        );

        it(
          "acepta configuracionIngresoId null",
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
                  "ingresos",
                  "sin-config",
                ),
                ingresoBase(
                  "sin-config",
                  {
                    configuracionIngresoId:
                      null,
                  },
                ),
              ),
            );
          },
        );

        it(
          "acepta configuracionIngresoId válido",
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
                  "ingresos",
                  "con-config",
                ),
                ingresoBase(
                  "con-config",
                  {
                    configuracionIngresoId:
                      "configuracion-salario",
                  },
                ),
              ),
            );
          },
        );

        it(
          "acepta ingreso no recurrente",
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
                  "ingresos",
                  "unico",
                ),
                ingresoBase(
                  "unico",
                  {
                    recurrente:
                      false,
                  },
                ),
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

            const id =
              `fuente-${fuente}`;

            await assertSucceeds(
              setDoc(
                doc(
                  db,
                  "users",
                  USER_A,
                  "ingresos",
                  id,
                ),
                ingresoBase(
                  id,
                  {
                    fuente,
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
          "acepta 29 de febrero en año bisiesto",
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
                  "ingresos",
                  "leap",
                ),
                ingresoBase(
                  "leap",
                  {
                    fechaProgramada:
                      "2028-02-29",

                    periodoCalendario:
                      "2028-02",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza fechaProgramada imposible",
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
                  "ingresos",
                  "fecha-invalida",
                ),
                ingresoBase(
                  "fecha-invalida",
                  {
                    fechaProgramada:
                      "2026-02-31",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza fechaRecibida imposible",
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
                  "ingresos",
                  "recibida-invalida",
                ),
                ingresoBase(
                  "recibida-invalida",
                  {
                    estado:
                      "recibido",

                    fechaRecibida:
                      "2026-02-30",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza recibido sin fechaRecibida",
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
                  "ingresos",
                  "recibido-sin-fecha",
                ),
                ingresoBase(
                  "recibido-sin-fecha",
                  {
                    estado:
                      "recibido",

                    fechaRecibida:
                      null,
                  },
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "periodo calendario",
      () => {
        it(
          "acepta enero",
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
                  "ingresos",
                  "enero",
                ),
                ingresoBase(
                  "enero",
                  {
                    fechaProgramada:
                      "2026-01-15",

                    periodoCalendario:
                      "2026-01",
                  },
                ),
              ),
            );
          },
        );

        it(
          "acepta diciembre",
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
                  "ingresos",
                  "diciembre",
                ),
                ingresoBase(
                  "diciembre",
                  {
                    fechaProgramada:
                      "2026-12-15",

                    periodoCalendario:
                      "2026-12",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza mes 00",
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
                  "ingresos",
                  "mes-cero",
                ),
                ingresoBase(
                  "mes-cero",
                  {
                    periodoCalendario:
                      "2026-00",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza mes 13",
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
                  "ingresos",
                  "mes-trece",
                ),
                ingresoBase(
                  "mes-trece",
                  {
                    periodoCalendario:
                      "2026-13",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza formato de periodo inválido",
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
                  "ingresos",
                  "periodo-formato",
                ),
                ingresoBase(
                  "periodo-formato",
                  {
                    periodoCalendario:
                      "10-2026",
                  },
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "numeroPagoMes",
      () => {
        it(
          "acepta pago mensual 1",
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
                  "ingresos",
                  "mes-1",
                ),
                ingresoBase(
                  "mes-1",
                  {
                    numeroPagoMes:
                      1,
                  },
                ),
              ),
            );
          },
        );

        it(
          "acepta pago mensual 3",
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
                  "ingresos",
                  "mes-3",
                ),
                ingresoBase(
                  "mes-3",
                  {
                    numeroPagoMes:
                      3,
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza pago mensual 0",
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
                  "ingresos",
                  "mes-0",
                ),
                ingresoBase(
                  "mes-0",
                  {
                    numeroPagoMes:
                      0,
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza pago mensual 4",
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
                  "ingresos",
                  "mes-4",
                ),
                ingresoBase(
                  "mes-4",
                  {
                    numeroPagoMes:
                      4,
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza pago mensual decimal",
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
                  "ingresos",
                  "mes-decimal",
                ),
                ingresoBase(
                  "mes-decimal",
                  {
                    numeroPagoMes:
                      1.5,
                  },
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "numeroPagoAnual",
      () => {
        it(
          "acepta pago anual 1",
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
                  "ingresos",
                  "anual-1",
                ),
                ingresoBase(
                  "anual-1",
                  {
                    numeroPagoAnual:
                      1,
                  },
                ),
              ),
            );
          },
        );

        it(
          "acepta pago anual 27",
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
                  "ingresos",
                  "anual-27",
                ),
                ingresoBase(
                  "anual-27",
                  {
                    numeroPagoAnual:
                      27,
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza pago anual 0",
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
                  "ingresos",
                  "anual-0",
                ),
                ingresoBase(
                  "anual-0",
                  {
                    numeroPagoAnual:
                      0,
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza pago anual 28",
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
                  "ingresos",
                  "anual-28",
                ),
                ingresoBase(
                  "anual-28",
                  {
                    numeroPagoAnual:
                      28,
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza pago anual decimal",
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
                  "ingresos",
                  "anual-decimal",
                ),
                ingresoBase(
                  "anual-decimal",
                  {
                    numeroPagoAnual:
                      20.5,
                  },
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "schema financiero",
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
                  "ingresos",
                  "descripcion",
                ),
                ingresoBase(
                  "descripcion",
                  {
                    descripcion:
                      "",
                  },
                ),
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
                  "ingresos",
                  "monto-cero",
                ),
                ingresoBase(
                  "monto-cero",
                  {
                    monto:
                      0,
                  },
                ),
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
                  "ingresos",
                  "monto-negativo",
                ),
                ingresoBase(
                  "monto-negativo",
                  {
                    monto:
                      -1,
                  },
                ),
              ),
            );
          },
        );

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
                  "ingresos",
                  "fuente-invalida",
                ),
                ingresoBase(
                  "fuente-invalida",
                  {
                    fuente:
                      "inversion",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza estado desconocido",
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
                  "ingresos",
                  "estado-invalido",
                ),
                ingresoBase(
                  "estado-invalido",
                  {
                    estado:
                      "pendiente",
                  },
                ),
              ),
            );
          },
        );

        it(
          "rechaza recurrente que no sea boolean",
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
                  "ingresos",
                  "recurrente-invalido",
                ),
                ingresoBase(
                  "recurrente-invalido",
                  {
                    recurrente:
                      "si",
                  },
                ),
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
                  "ingresos",
                  "notas",
                ),
                ingresoBase(
                  "notas",
                  {
                    notas:
                      "x".repeat(
                        1001,
                      ),
                  },
                ),
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
                  "ingresos",
                  "campo-extra",
                ),
                ingresoBase(
                  "campo-extra",
                  {
                    admin:
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
                USER_A,
              );

            const data =
              ingresoBase(
                "faltante",
              );

            delete data.numeroPagoAnual;

            await assertFails(
              setDoc(
                doc(
                  db,
                  "users",
                  USER_A,
                  "ingresos",
                  "faltante",
                ),
                data,
              ),
            );
          },
        );

        it(
          "rechaza creadoEn demasiado corto",
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
                  "ingresos",
                  "creado-corto",
                ),
                ingresoBase(
                  "creado-corto",
                  {
                    creadoEn:
                      "2026",
                  },
                ),
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
                  "ingresos",
                  "actualizado-tipo",
                ),
                ingresoBase(
                  "actualizado-tipo",
                  {
                    actualizadoEn:
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
      "identidad del ciclo y seguridad",
      () => {
        it(
          "rechaza cicloPagoId diferente del id del documento",
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
                  "ingresos",
                  "documento-a",
                ),
                ingresoBase(
                  "documento-b",
                ),
              ),
            );
          },
        );

        it(
          "permite leer ingreso propio",
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
                    "ingresos",
                    EXISTING_A,
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
          "impide leer ingreso de otro usuario",
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
                  "ingresos",
                  EXISTING_B,
                ),
              ),
            );
          },
        );

        it(
          "impide crear ingreso dentro de otro usuario",
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
                  "ingresos",
                  "ataque",
                ),
                ingresoBase(
                  "ataque",
                ),
              ),
            );
          },
        );

        it(
          "permite actualizar ingreso propio",
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
                  "ingresos",
                  EXISTING_A,
                ),
                ingresoBase(
                  EXISTING_A,
                  {
                    monto:
                      2600,

                    actualizadoEn:
                      "2026-10-09T16:00:00.000Z",
                  },
                ),
              ),
            );
          },
        );

        it(
          "permite borrar ingreso propio",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertSucceeds(
              deleteDoc(
                doc(
                  db,
                  "users",
                  USER_A,
                  "ingresos",
                  EXISTING_A,
                ),
              ),
            );
          },
        );

        it(
          "impide borrar ingreso de otro usuario",
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
                  USER_B,
                  "ingresos",
                  EXISTING_B,
                ),
              ),
            );
          },
        );
      },
    );
  },
);