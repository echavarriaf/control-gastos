import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizarDocumento,
  ordenarCompromisos,
  validarCompromiso,
} from "@/lib/budget/fixed-commitments";

import type {
  CompromisoFijo,
  NuevoCompromisoFijo,
} from "@/lib/budget/types";

function crearCompromiso(
  overrides: Partial<CompromisoFijo> = {},
): CompromisoFijo {
  return {
    id: "compromiso-1",

    descripcion:
      "Compromiso",

    monto: 100,

    diaVencimiento: 10,

    quincenaPresupuestaria: 1,

    prioridad: 2,

    metodoPagoPreferido:
      "transferencia",

    tarjetaId: null,

    activo: true,

    ...overrides,
  };
}

function crearNuevo(
  overrides: Partial<NuevoCompromisoFijo> = {},
): NuevoCompromisoFijo {
  return {
    descripcion:
      "Compromiso",

    monto: 100,

    diaVencimiento: 10,

    quincenaPresupuestaria: 1,

    prioridad: 2,

    metodoPagoPreferido:
      "transferencia",

    tarjetaId: null,

    activo: true,

    ...overrides,
  };
}

describe(
  "normalizarDocumento",
  () => {
    it(
      "normaliza un documento válido",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              descripcion:
                "  Netflix  ",

              monto: 25.5,

              diaVencimiento: 12,

              quincenaPresupuestaria:
                1,

              prioridad: 1,

              metodoPagoPreferido:
                "debito_automatico",

              tarjetaId:
                null,

              activo: true,
            },
          );

        expect(
          resultado.id,
        ).toBe("doc-1");

        expect(
          resultado.descripcion,
        ).toBe("Netflix");

        expect(
          resultado.monto,
        ).toBe(25.5);

        expect(
          resultado.diaVencimiento,
        ).toBe(12);

        expect(
          resultado.quincenaPresupuestaria,
        ).toBe(1);

        expect(
          resultado.prioridad,
        ).toBe(1);

        expect(
          resultado.metodoPagoPreferido,
        ).toBe(
          "debito_automatico",
        );

        expect(
          resultado.activo,
        ).toBe(true);
      },
    );

    it(
      "acepta montos numéricos guardados como string",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              monto: "145.50",
            },
          );

        expect(
          resultado.monto,
        ).toBe(145.5);
      },
    );

    it(
      "usa cero cuando el monto no existe y no hay predeterminado",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {},
          );

        expect(
          resultado.monto,
        ).toBe(0);
      },
    );

    it(
      "usa el monto predeterminado cuando el dato histórico es inválido",
      () => {
        const predeterminado =
          crearCompromiso({
            monto: 145,
          });

        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              monto: "abc",
            },
            predeterminado,
          );

        expect(
          resultado.monto,
        ).toBe(145);
      },
    );

    it(
      "rechaza monto negativo durante normalización y usa fallback",
      () => {
        const predeterminado =
          crearCompromiso({
            monto: 200,
          });

        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              monto: -50,
            },
            predeterminado,
          );

        expect(
          resultado.monto,
        ).toBe(200);
      },
    );

    it(
      "usa Gasto fijo cuando falta descripción y no existe predeterminado",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              descripcion: "   ",
            },
          );

        expect(
          resultado.descripcion,
        ).toBe("Gasto fijo");
      },
    );

    it(
      "recupera descripción del compromiso predeterminado",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              descripcion: "",
            },
            crearCompromiso({
              descripcion:
                "Préstamo AMEX",
            }),
          );

        expect(
          resultado.descripcion,
        ).toBe(
          "Préstamo AMEX",
        );
      },
    );

    it(
      "trunca decimales del día de vencimiento",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              diaVencimiento:
                14.9,
            },
          );

        expect(
          resultado.diaVencimiento,
        ).toBe(14);
      },
    );

    it(
      "usa fallback para días fuera de 1 a 31",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              diaVencimiento: 40,
            },
            crearCompromiso({
              diaVencimiento: 14,
            }),
          );

        expect(
          resultado.diaVencimiento,
        ).toBe(14);
      },
    );

    it(
      "infiere Q1 cuando falta quincena y vence antes o durante el día 15",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              diaVencimiento: 15,

              quincenaPresupuestaria:
                undefined,
            },
          );

        expect(
          resultado.quincenaPresupuestaria,
        ).toBe(1);
      },
    );

    it(
      "infiere Q2 cuando falta quincena y vence después del día 15",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              diaVencimiento: 16,

              quincenaPresupuestaria:
                undefined,
            },
          );

        expect(
          resultado.quincenaPresupuestaria,
        ).toBe(2);
      },
    );

    it(
      "usa prioridad 2 como fallback sin predeterminado",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              prioridad: 99,
            },
          );

        expect(
          resultado.prioridad,
        ).toBe(2);
      },
    );

    it(
      "recupera prioridad histórica del predeterminado",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              prioridad:
                "invalida",
            },
            crearCompromiso({
              prioridad: 3,
            }),
          );

        expect(
          resultado.prioridad,
        ).toBe(3);
      },
    );

    it(
      "usa transferencia para método desconocido sin predeterminado",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              metodoPagoPreferido:
                "bitcoin",
            },
          );

        expect(
          resultado.metodoPagoPreferido,
        ).toBe(
          "transferencia",
        );
      },
    );

    it(
      "conserva todos los métodos válidos",
      () => {
        const metodos = [
          "debito_automatico",
          "transferencia",
          "tarjeta",
          "efectivo",
          "otro",
        ] as const;

        for (
          const metodo
          of metodos
        ) {
          const resultado =
            normalizarDocumento(
              "doc-1",
              {
                metodoPagoPreferido:
                  metodo,
              },
            );

          expect(
            resultado.metodoPagoPreferido,
          ).toBe(metodo);
        }
      },
    );

    it(
      "limpia espacios del tarjetaId",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              tarjetaId:
                "  apple-card  ",
            },
          );

        expect(
          resultado.tarjetaId,
        ).toBe(
          "apple-card",
        );
      },
    );

    it(
      "convierte tarjetaId vacío en null",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              tarjetaId:
                "   ",
            },
          );

        expect(
          resultado.tarjetaId,
        ).toBeNull();
      },
    );

    it(
      "usa activo true por defecto",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {},
          );

        expect(
          resultado.activo,
        ).toBe(true);
      },
    );

    it(
      "conserva activo false explícito",
      () => {
        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              activo: false,
            },
          );

        expect(
          resultado.activo,
        ).toBe(false);
      },
    );

    it(
      "normaliza timestamps Firestore usando toDate",
      () => {
        const fecha =
          new Date(
            "2026-10-09T12:00:00.000Z",
          );

        const resultado =
          normalizarDocumento(
            "doc-1",
            {
              creadoEn: {
                toDate: () =>
                  fecha,
              },

              actualizadoEn: {
                toDate: () =>
                  fecha,
              },
            },
          );

        expect(
          resultado.creadoEn,
        ).toBe(
          "2026-10-09T12:00:00.000Z",
        );

        expect(
          resultado.actualizadoEn,
        ).toBe(
          "2026-10-09T12:00:00.000Z",
        );
      },
    );
  },
);

describe(
  "validarCompromiso",
  () => {
    it(
      "limpia descripción, redondea monto y trunca día",
      () => {
        const resultado =
          validarCompromiso(
            crearNuevo({
              descripcion:
                "  Vehículo  ",

              monto:
                555.556,

              diaVencimiento:
                10.9,

              tarjetaId:
                "  tarjeta-1  ",
            }),
          );

        expect(
          resultado.descripcion,
        ).toBe("Vehículo");

        expect(
          resultado.monto,
        ).toBe(555.56);

        expect(
          resultado.diaVencimiento,
        ).toBe(10);

        expect(
          resultado.tarjetaId,
        ).toBe(
          "tarjeta-1",
        );
      },
    );

    it(
      "rechaza descripción vacía",
      () => {
        expect(() =>
          validarCompromiso(
            crearNuevo({
              descripcion:
                "   ",
            }),
          ),
        ).toThrow(
          "Escribe el nombre del gasto fijo.",
        );
      },
    );

    it(
      "rechaza monto cero",
      () => {
        expect(() =>
          validarCompromiso(
            crearNuevo({
              monto: 0,
            }),
          ),
        ).toThrow(
          "El monto debe ser mayor que cero.",
        );
      },
    );

    it(
      "rechaza monto negativo",
      () => {
        expect(() =>
          validarCompromiso(
            crearNuevo({
              monto: -1,
            }),
          ),
        ).toThrow(
          "El monto debe ser mayor que cero.",
        );
      },
    );

    it(
      "rechaza NaN",
      () => {
        expect(() =>
          validarCompromiso(
            crearNuevo({
              monto:
                Number.NaN,
            }),
          ),
        ).toThrow(
          "El monto debe ser mayor que cero.",
        );
      },
    );

    it(
      "rechaza día cero",
      () => {
        expect(() =>
          validarCompromiso(
            crearNuevo({
              diaVencimiento:
                0,
            }),
          ),
        ).toThrow(
          "El día de vencimiento debe estar entre 1 y 31.",
        );
      },
    );

    it(
      "rechaza día mayor que 31",
      () => {
        expect(() =>
          validarCompromiso(
            crearNuevo({
              diaVencimiento:
                32,
            }),
          ),
        ).toThrow(
          "El día de vencimiento debe estar entre 1 y 31.",
        );
      },
    );

    it(
      "acepta los extremos día 1 y día 31",
      () => {
        expect(
          validarCompromiso(
            crearNuevo({
              diaVencimiento:
                1,
            }),
          )
            .diaVencimiento,
        ).toBe(1);

        expect(
          validarCompromiso(
            crearNuevo({
              diaVencimiento:
                31,
            }),
          )
            .diaVencimiento,
        ).toBe(31);
      },
    );

    it(
      "convierte tarjeta vacía en null",
      () => {
        const resultado =
          validarCompromiso(
            crearNuevo({
              tarjetaId:
                "   ",
            }),
          );

        expect(
          resultado.tarjetaId,
        ).toBeNull();
      },
    );
  },
);

describe(
  "ordenarCompromisos",
  () => {
    it(
      "coloca compromisos activos antes que inactivos",
      () => {
        const lista = [
          crearCompromiso({
            id: "inactivo",
            activo: false,
          }),

          crearCompromiso({
            id: "activo",
            activo: true,
          }),
        ].sort(
          ordenarCompromisos,
        );

        expect(
          lista.map(
            (item) =>
              item.id,
          ),
        ).toEqual([
          "activo",
          "inactivo",
        ]);
      },
    );

    it(
      "ordena Q1 antes que Q2",
      () => {
        const lista = [
          crearCompromiso({
            id: "q2",

            quincenaPresupuestaria:
              2,
          }),

          crearCompromiso({
            id: "q1",

            quincenaPresupuestaria:
              1,
          }),
        ].sort(
          ordenarCompromisos,
        );

        expect(
          lista.map(
            (item) =>
              item.id,
          ),
        ).toEqual([
          "q1",
          "q2",
        ]);
      },
    );

    it(
      "ordena por día de vencimiento dentro de la misma quincena",
      () => {
        const lista = [
          crearCompromiso({
            id: "dia-14",
            diaVencimiento: 14,
          }),

          crearCompromiso({
            id: "dia-5",
            diaVencimiento: 5,
          }),

          crearCompromiso({
            id: "dia-10",
            diaVencimiento: 10,
          }),
        ].sort(
          ordenarCompromisos,
        );

        expect(
          lista.map(
            (item) =>
              item.id,
          ),
        ).toEqual([
          "dia-5",
          "dia-10",
          "dia-14",
        ]);
      },
    );

    it(
      "usa descripción como desempate final",
      () => {
        const lista = [
          crearCompromiso({
            id: "zeta",
            descripcion: "Zeta",
          }),

          crearCompromiso({
            id: "alpha",
            descripcion: "Alpha",
          }),
        ].sort(
          ordenarCompromisos,
        );

        expect(
          lista.map(
            (item) =>
              item.id,
          ),
        ).toEqual([
          "alpha",
          "zeta",
        ]);
      },
    );

    it(
      "respeta toda la jerarquía activo quincena día descripción",
      () => {
        const lista = [
          crearCompromiso({
            id: "inactivo-q1",
            activo: false,
            quincenaPresupuestaria: 1,
            diaVencimiento: 1,
          }),

          crearCompromiso({
            id: "activo-q2",
            activo: true,
            quincenaPresupuestaria: 2,
            diaVencimiento: 1,
          }),

          crearCompromiso({
            id: "activo-q1-dia10",
            activo: true,
            quincenaPresupuestaria: 1,
            diaVencimiento: 10,
          }),

          crearCompromiso({
            id: "activo-q1-dia5",
            activo: true,
            quincenaPresupuestaria: 1,
            diaVencimiento: 5,
          }),
        ].sort(
          ordenarCompromisos,
        );

        expect(
          lista.map(
            (item) =>
              item.id,
          ),
        ).toEqual([
          "activo-q1-dia5",
          "activo-q1-dia10",
          "activo-q2",
          "inactivo-q1",
        ]);
      },
    );
  },
);