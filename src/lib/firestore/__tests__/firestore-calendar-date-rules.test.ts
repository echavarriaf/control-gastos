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

let testEnv:
  RulesTestEnvironment;

function dbUsuario() {
  return testEnv
    .authenticatedContext(
      USER_A,
    )
    .firestore();
}

function tarjetaBase(
  fechaSaldoInicial: string,
) {
  return {
    nombre:
      "Tarjeta fecha test",

    ultimosCuatro:
      "1234",

    saldoInicial:
      100,

    fechaSaldoInicial,

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
  };
}

async function sembrarBase():
  Promise<void> {
  await testEnv
    .withSecurityRulesDisabled(
      async (
        context,
      ) => {
        await setDoc(
          doc(
            context.firestore(),
            "allowedUsers",
            USER_A,
          ),
          {
            activo:
              true,
          },
        );
      },
    );
}

async function probarFechaValida(
  fecha: string,
  id: string,
): Promise<void> {
  const db =
    dbUsuario();

  await assertSucceeds(
    setDoc(
      doc(
        db,
        "users",
        USER_A,
        "tarjetasCredito",
        id,
      ),
      tarjetaBase(
        fecha,
      ),
    ),
  );
}

async function probarFechaInvalida(
  fecha: string,
  id: string,
): Promise<void> {
  const db =
    dbUsuario();

  await assertFails(
    setDoc(
      doc(
        db,
        "users",
        USER_A,
        "tarjetasCredito",
        id,
      ),
      tarjetaBase(
        fecha,
      ),
    ),
  );
}

describe.sequential(
  "Firestore calendar date rules",
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
      "fechas válidas",
      () => {
        it(
          "acepta 31 de enero",
          async () => {
            await probarFechaValida(
              "2026-01-31",
              "enero-31",
            );
          },
        );

        it(
          "acepta 30 de abril",
          async () => {
            await probarFechaValida(
              "2026-04-30",
              "abril-30",
            );
          },
        );

        it(
          "acepta 28 de febrero en año normal",
          async () => {
            await probarFechaValida(
              "2026-02-28",
              "febrero-28",
            );
          },
        );

        it(
          "acepta 29 de febrero en 2028",
          async () => {
            await probarFechaValida(
              "2028-02-29",
              "bisiesto-2028",
            );
          },
        );

        it(
          "acepta 29 de febrero del año 2000",
          async () => {
            await probarFechaValida(
              "2000-02-29",
              "bisiesto-2000",
            );
          },
        );

        it(
          "acepta 29 de febrero del año 2400",
          async () => {
            await probarFechaValida(
              "2400-02-29",
              "bisiesto-2400",
            );
          },
        );

        it(
          "acepta 31 de diciembre",
          async () => {
            await probarFechaValida(
              "2026-12-31",
              "diciembre-31",
            );
          },
        );

        it(
          "acepta 30 de noviembre",
          async () => {
            await probarFechaValida(
              "2026-11-30",
              "noviembre-30",
            );
          },
        );
      },
    );

    describe(
      "fechas inválidas",
      () => {
        it(
          "rechaza mes cero",
          async () => {
            await probarFechaInvalida(
              "2026-00-10",
              "mes-cero",
            );
          },
        );

        it(
          "rechaza mes trece",
          async () => {
            await probarFechaInvalida(
              "2026-13-10",
              "mes-trece",
            );
          },
        );

        it(
          "rechaza día cero",
          async () => {
            await probarFechaInvalida(
              "2026-01-00",
              "dia-cero",
            );
          },
        );

        it(
          "rechaza 31 de abril",
          async () => {
            await probarFechaInvalida(
              "2026-04-31",
              "abril-31",
            );
          },
        );

        it(
          "rechaza 31 de junio",
          async () => {
            await probarFechaInvalida(
              "2026-06-31",
              "junio-31",
            );
          },
        );

        it(
          "rechaza 29 de febrero en 2026",
          async () => {
            await probarFechaInvalida(
              "2026-02-29",
              "febrero-2026",
            );
          },
        );

        it(
          "rechaza 29 de febrero del año 2100",
          async () => {
            await probarFechaInvalida(
              "2100-02-29",
              "febrero-2100",
            );
          },
        );

        it(
          "rechaza 30 de febrero",
          async () => {
            await probarFechaInvalida(
              "2026-02-30",
              "febrero-30",
            );
          },
        );

        it(
          "rechaza 31 de febrero",
          async () => {
            await probarFechaInvalida(
              "2026-02-31",
              "febrero-31",
            );
          },
        );

        it(
          "rechaza formato sin cero inicial",
          async () => {
            await probarFechaInvalida(
              "2026-2-09",
              "formato-corto",
            );
          },
        );
      },
    );
  },
);