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

const USER_INACTIVO =
  "usuario-inactivo";

const USER_SIN_ACCESO =
  "usuario-sin-acceso";

let testEnv:
  RulesTestEnvironment;

async function sembrarDatos(): Promise<void> {
  await testEnv
    .withSecurityRulesDisabled(
      async (
        context,
      ) => {
        const db =
          context.firestore();

        /**
         * Usuarios autorizados.
         */
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
            "allowedUsers",
            USER_INACTIVO,
          ),
          {
            activo: false,
          },
        );

        /**
         * Documento raíz de users.
         *
         * Las reglas impiden que el cliente
         * lo lea directamente.
         */
        await setDoc(
          doc(
            db,
            "users",
            USER_A,
          ),
          {
            prueba: true,
          },
        );

        /**
         * Datos financieros privados.
         *
         * Como sembramos con reglas deshabilitadas,
         * no necesitamos depender todavía del schema
         * completo de cada documento.
         */
        await setDoc(
          doc(
            db,
            "users",
            USER_A,
            "gastos",
            "gasto-a",
          ),
          {
            prueba: true,
          },
        );

        await setDoc(
          doc(
            db,
            "users",
            USER_B,
            "gastos",
            "gasto-b",
          ),
          {
            prueba: true,
          },
        );

        await setDoc(
          doc(
            db,
            "users",
            USER_INACTIVO,
            "gastos",
            "gasto-inactivo",
          ),
          {
            prueba: true,
          },
        );

        await setDoc(
          doc(
            db,
            "users",
            USER_SIN_ACCESO,
            "gastos",
            "gasto-sin-acceso",
          ),
          {
            prueba: true,
          },
        );

        /**
         * Colección financiera legacy.
         *
         * Debe permanecer bloqueada.
         */
        await setDoc(
          doc(
            db,
            "gastos",
            "legacy",
          ),
          {
            prueba: true,
          },
        );

        /**
         * Access request.
         */
        await setDoc(
          doc(
            db,
            "accessRequests",
            USER_A,
          ),
          {
            uid: USER_A,
            estado:
              "pendiente",
          },
        );

        await setDoc(
          doc(
            db,
            "accessRequests",
            USER_B,
          ),
          {
            uid: USER_B,
            estado:
              "pendiente",
          },
        );

        /**
         * Dispositivo push.
         *
         * El cliente no debe poder leerlo,
         * ni siquiera siendo propietario.
         */
        await setDoc(
          doc(
            db,
            "users",
            USER_A,
            "notificationDevices",
            "device-1",
          ),
          {
            uid: USER_A,
          },
        );
      },
    );
}

function dbUsuario(
  uid: string,
) {
  return testEnv
    .authenticatedContext(
      uid,
    )
    .firestore();
}

describe.sequential(
  "Firestore Security Rules",
  () => {
    beforeAll(
      async () => {
        const rules =
          readFileSync(
            "firestore.rules",
            "utf8",
          );

        testEnv =
          await initializeTestEnvironment(
            {
              projectId:
                PROJECT_ID,

              firestore: {
                rules,

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

        await sembrarDatos();
      },
    );

    afterAll(
      async () => {
        await testEnv
          .cleanup();
      },
    );

    describe(
      "aislamiento por usuario",
      () => {
        it(
          "permite al usuario autorizado leer su propio gasto",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertSucceeds(
              getDoc(
                doc(
                  db,
                  "users",
                  USER_A,
                  "gastos",
                  "gasto-a",
                ),
              ),
            );
          },
        );

        it(
          "impide leer los gastos de otro usuario autorizado",
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
                  "gastos",
                  "gasto-b",
                ),
              ),
            );
          },
        );

        it(
          "impide a un usuario inactivo leer sus propios datos",
          async () => {
            const db =
              dbUsuario(
                USER_INACTIVO,
              );

            await assertFails(
              getDoc(
                doc(
                  db,
                  "users",
                  USER_INACTIVO,
                  "gastos",
                  "gasto-inactivo",
                ),
              ),
            );
          },
        );

        it(
          "impide a un usuario ausente de allowedUsers leer sus propios datos",
          async () => {
            const db =
              dbUsuario(
                USER_SIN_ACCESO,
              );

            await assertFails(
              getDoc(
                doc(
                  db,
                  "users",
                  USER_SIN_ACCESO,
                  "gastos",
                  "gasto-sin-acceso",
                ),
              ),
            );
          },
        );

        it(
          "impide acceso financiero sin autenticación",
          async () => {
            const db =
              testEnv
                .unauthenticatedContext()
                .firestore();

            await assertFails(
              getDoc(
                doc(
                  db,
                  "users",
                  USER_A,
                  "gastos",
                  "gasto-a",
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "escrituras y borrado",
      () => {
        it(
          "permite al propietario autorizado eliminar su propio gasto",
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
                  "gastos",
                  "gasto-a",
                ),
              ),
            );
          },
        );

        it(
          "impide eliminar el gasto de otro usuario",
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
                  "gastos",
                  "gasto-b",
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "allowedUsers",
      () => {
        it(
          "permite consultar el propio registro de autorización",
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
                    "allowedUsers",
                    USER_A,
                  ),
                ),
              );

            expect(
              snapshot.exists(),
            ).toBe(true);
          },
        );

        it(
          "impide consultar el registro de autorización de otro usuario",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertFails(
              getDoc(
                doc(
                  db,
                  "allowedUsers",
                  USER_B,
                ),
              ),
            );
          },
        );

        it(
          "impide listar todos los usuarios autorizados",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertFails(
              getDocs(
                collection(
                  db,
                  "allowedUsers",
                ),
              ),
            );
          },
        );

        it(
          "impide que el cliente modifique su propia autorización",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "allowedUsers",
                  USER_A,
                ),
                {
                  activo: false,
                },
                {
                  merge: true,
                },
              ),
            );
          },
        );
      },
    );

    describe(
      "rutas protegidas",
      () => {
        it(
          "bloquea el documento raíz users/{uid}",
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
                  USER_A,
                ),
              ),
            );
          },
        );

        it(
          "bloquea colecciones financieras legacy en la raíz",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertFails(
              getDoc(
                doc(
                  db,
                  "gastos",
                  "legacy",
                ),
              ),
            );
          },
        );

        it(
          "bloquea la lectura de notificationDevices incluso para el propietario",
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
                  USER_A,
                  "notificationDevices",
                  "device-1",
                ),
              ),
            );
          },
        );
      },
    );

    describe(
      "accessRequests",
      () => {
        it(
          "permite consultar la solicitud propia",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertSucceeds(
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

        it(
          "impide consultar la solicitud de otro usuario",
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
          "impide listar solicitudes de acceso desde el cliente",
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
          "impide modificar una solicitud ya creada",
          async () => {
            const db =
              dbUsuario(
                USER_A,
              );

            await assertFails(
              setDoc(
                doc(
                  db,
                  "accessRequests",
                  USER_A,
                ),
                {
                  estado:
                    "aprobado",
                },
                {
                  merge: true,
                },
              ),
            );
          },
        );
      },
    );
  },
);