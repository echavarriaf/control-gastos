import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizarCreadoEn,
  normalizarEstadoTarjeta,
  normalizarMetodoMovimiento,
  normalizarTarjetaId,
  ordenarPorFechaYCreacion,
} from "@/lib/budget/budget-data-normalizers";

describe(
  "budget-data-normalizers",
  () => {
    describe(
      "normalizarTarjetaId",
      () => {
        it(
          "mantiene un id válido",
          () => {
            expect(
              normalizarTarjetaId(
                "apple",
              ),
            ).toBe("apple");
          },
        );

        it(
          "elimina espacios exteriores",
          () => {
            expect(
              normalizarTarjetaId(
                "  apple-card  ",
              ),
            ).toBe(
              "apple-card",
            );
          },
        );

        it(
          "convierte string vacío en null",
          () => {
            expect(
              normalizarTarjetaId(
                "",
              ),
            ).toBeNull();

            expect(
              normalizarTarjetaId(
                "    ",
              ),
            ).toBeNull();
          },
        );

        it(
          "convierte valores no string en null",
          () => {
            expect(
              normalizarTarjetaId(
                undefined,
              ),
            ).toBeNull();

            expect(
              normalizarTarjetaId(
                null,
              ),
            ).toBeNull();

            expect(
              normalizarTarjetaId(
                123,
              ),
            ).toBeNull();
          },
        );
      },
    );

    describe(
      "normalizarMetodoMovimiento",
      () => {
        it(
          "acepta efectivo",
          () => {
            expect(
              normalizarMetodoMovimiento(
                "efectivo",
              ),
            ).toBe(
              "efectivo",
            );
          },
        );

        it(
          "acepta débito",
          () => {
            expect(
              normalizarMetodoMovimiento(
                "debito",
              ),
            ).toBe(
              "debito",
            );
          },
        );

        it(
          "acepta cuenta bancaria",
          () => {
            expect(
              normalizarMetodoMovimiento(
                "cuenta_bancaria",
              ),
            ).toBe(
              "cuenta_bancaria",
            );
          },
        );

        it(
          "acepta tarjeta de crédito",
          () => {
            expect(
              normalizarMetodoMovimiento(
                "tarjeta_credito",
              ),
            ).toBe(
              "tarjeta_credito",
            );
          },
        );

        it(
          "rechaza métodos desconocidos",
          () => {
            expect(
              normalizarMetodoMovimiento(
                "bitcoin",
              ),
            ).toBeUndefined();

            expect(
              normalizarMetodoMovimiento(
                "",
              ),
            ).toBeUndefined();

            expect(
              normalizarMetodoMovimiento(
                null,
              ),
            ).toBeUndefined();
          },
        );
      },
    );

    describe(
      "normalizarEstadoTarjeta",
      () => {
        it(
          "devuelve null cuando el movimiento no usa tarjeta",
          () => {
            expect(
              normalizarEstadoTarjeta(
                "pendiente",
                false,
              ),
            ).toBeNull();

            expect(
              normalizarEstadoTarjeta(
                "contabilizada",
                false,
              ),
            ).toBeNull();
          },
        );

        it(
          "mantiene pendiente para una transacción de tarjeta",
          () => {
            expect(
              normalizarEstadoTarjeta(
                "pendiente",
                true,
              ),
            ).toBe(
              "pendiente",
            );
          },
        );

        it(
          "mantiene contabilizada para una transacción de tarjeta",
          () => {
            expect(
              normalizarEstadoTarjeta(
                "contabilizada",
                true,
              ),
            ).toBe(
              "contabilizada",
            );
          },
        );

        it(
          "considera contabilizado un movimiento histórico sin estado",
          () => {
            expect(
              normalizarEstadoTarjeta(
                undefined,
                true,
              ),
            ).toBe(
              "contabilizada",
            );

            expect(
              normalizarEstadoTarjeta(
                null,
                true,
              ),
            ).toBe(
              "contabilizada",
            );
          },
        );

        it(
          "usa contabilizada como fallback ante un estado inválido",
          () => {
            expect(
              normalizarEstadoTarjeta(
                "procesando",
                true,
              ),
            ).toBe(
              "contabilizada",
            );
          },
        );
      },
    );

    describe(
      "normalizarCreadoEn",
      () => {
        it(
          "mantiene strings ya normalizados",
          () => {
            const fecha =
              "2026-10-09T12:00:00.000Z";

            expect(
              normalizarCreadoEn(
                fecha,
                "fallback",
              ),
            ).toBe(fecha);
          },
        );

        it(
          "convierte un Timestamp compatible con toDate",
          () => {
            const resultado =
              normalizarCreadoEn(
                {
                  toDate: () =>
                    new Date(
                      "2026-10-09T15:30:00.000Z",
                    ),
                },

                "fallback",
              );

            expect(
              resultado,
            ).toBe(
              "2026-10-09T15:30:00.000Z",
            );
          },
        );

        it(
          "usa fallback si toDate devuelve una fecha inválida",
          () => {
            expect(
              normalizarCreadoEn(
                {
                  toDate: () =>
                    new Date(
                      Number.NaN,
                    ),
                },

                "fallback",
              ),
            ).toBe(
              "fallback",
            );
          },
        );

        it(
          "usa fallback para valores desconocidos",
          () => {
            expect(
              normalizarCreadoEn(
                undefined,
                "fallback",
              ),
            ).toBe(
              "fallback",
            );

            expect(
              normalizarCreadoEn(
                null,
                "fallback",
              ),
            ).toBe(
              "fallback",
            );

            expect(
              normalizarCreadoEn(
                123,
                "fallback",
              ),
            ).toBe(
              "fallback",
            );
          },
        );
      },
    );

    describe(
      "ordenarPorFechaYCreacion",
      () => {
        it(
          "ordena primero por fecha financiera descendente",
          () => {
            const registros = [
              {
                id: "viejo",
                fecha:
                  "2026-10-01",
                creadoEn:
                  "2026-10-01T12:00:00.000Z",
              },

              {
                id: "nuevo",
                fecha:
                  "2026-10-20",
                creadoEn:
                  "2026-10-20T12:00:00.000Z",
              },

              {
                id: "medio",
                fecha:
                  "2026-10-10",
                creadoEn:
                  "2026-10-10T12:00:00.000Z",
              },
            ].sort(
              ordenarPorFechaYCreacion,
            );

            expect(
              registros.map(
                (item) =>
                  item.id,
              ),
            ).toEqual([
              "nuevo",
              "medio",
              "viejo",
            ]);
          },
        );

        it(
          "usa creadoEn cuando la fecha financiera coincide",
          () => {
            const registros = [
              {
                id: "mañana",
                fecha:
                  "2026-10-10",
                creadoEn:
                  "2026-10-10T09:00:00.000Z",
              },

              {
                id: "tarde",
                fecha:
                  "2026-10-10",
                creadoEn:
                  "2026-10-10T17:00:00.000Z",
              },
            ].sort(
              ordenarPorFechaYCreacion,
            );

            expect(
              registros.map(
                (item) =>
                  item.id,
              ),
            ).toEqual([
              "tarde",
              "mañana",
            ]);
          },
        );

        it(
          "usa el id como desempate estable final",
          () => {
            const registros = [
              {
                id: "a",
                fecha:
                  "2026-10-10",
                creadoEn:
                  "2026-10-10T12:00:00.000Z",
              },

              {
                id: "c",
                fecha:
                  "2026-10-10",
                creadoEn:
                  "2026-10-10T12:00:00.000Z",
              },

              {
                id: "b",
                fecha:
                  "2026-10-10",
                creadoEn:
                  "2026-10-10T12:00:00.000Z",
              },
            ].sort(
              ordenarPorFechaYCreacion,
            );

            expect(
              registros.map(
                (item) =>
                  item.id,
              ),
            ).toEqual([
              "c",
              "b",
              "a",
            ]);
          },
        );
      },
    );
  },
);