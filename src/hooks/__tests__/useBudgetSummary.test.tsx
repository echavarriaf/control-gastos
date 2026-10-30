import {
  describe,
  expect,
  it,
} from "vitest";

import {
  renderToStaticMarkup,
} from "react-dom/server";

import {
  useBudgetSummary,
} from "@/hooks/useBudgetSummary";

import type {
  CompromisoFijo,
  GastoVariable,
  LimitesVariables,
  PagoFijo,
  PagoTarjeta,
  Quincena,
} from "@/lib/budget/types";

const limites: LimitesVariables = {
  comida: {
    mensual: 1200,
    quincenal: 600,
  },

  gas: {
    mensual: 200,
    quincenal: 100,
  },
};

function gasto(
  overrides: Partial<GastoVariable> = {},
): GastoVariable {
  return {
    id: "gasto-1",
    concepto: "Compra",
    monto: 100,

    categoria: "comida",

    fecha: "2026-10-05",

    creadoEn:
      "2026-10-05T12:00:00.000Z",

    metodoPago: "debito",

    tarjetaId: null,

    ...overrides,
  } as GastoVariable;
}

function pagoTarjeta(
  overrides: Partial<PagoTarjeta> = {},
): PagoTarjeta {
  return {
    id: "pago-1",

    concepto:
      "Pago tarjeta",

    monto: 100,

    categoria:
      "general",

    fecha:
      "2026-10-05",

    creadoEn:
      "2026-10-05T12:00:00.000Z",

    tarjetaId:
      "tarjeta-1",

    estadoTarjeta:
      "contabilizada",

    ...overrides,
  } as PagoTarjeta;
}

function compromiso(
  overrides: Partial<CompromisoFijo> = {},
): CompromisoFijo {
  return {
    id: "fijo-1",

    descripcion:
      "Compromiso",

    monto: 100,

    diaVencimiento: 10,

    quincenaPresupuestaria:
      1,

    prioridad: 1,

    metodoPagoPreferido:
      "transferencia",

    tarjetaId: null,

    activo: true,

    ...overrides,
  } as CompromisoFijo;
}

function pagoFijo(
  overrides: Partial<PagoFijo> = {},
): PagoFijo {
  return {
    id: "pago-fijo-1",

    compromisoId:
      "fijo-1",

    descripcion:
      "Compromiso",

    monto: 100,

    fecha:
      "2026-10-05",

    metodo:
      "transferencia",

    periodicidad:
      "mensual",

    referencia: "",
    notas: "",

    tarjetaId: null,

    ...overrides,
  } as PagoFijo;
}

interface Args {
  gastos?: GastoVariable[];
  pagos?: PagoTarjeta[];
  pagosFijos?: PagoFijo[];
  compromisosFijos?: CompromisoFijo[];
  limites?: LimitesVariables;

  mesSeleccionado?: string;
  quincenaSeleccionada?: Quincena;
  periodoActual?: string;
}

function ejecutarHook({
  gastos = [],
  pagos = [],
  pagosFijos = [],
  compromisosFijos = [],
  limites:
    limitesPersonalizados =
      limites,

  mesSeleccionado =
    "2026-10",

  quincenaSeleccionada =
    1,

  periodoActual =
    "2026-10",
}: Args = {}) {
  let resultado:
    ReturnType<
      typeof useBudgetSummary
    > | null = null;

  function Probe() {
    resultado =
      useBudgetSummary({
        gastos,
        pagos,
        pagosFijos,
        compromisosFijos,

        limites:
          limitesPersonalizados,

        mesSeleccionado,
        quincenaSeleccionada,
        periodoActual,
      });

    return null;
  }

  renderToStaticMarkup(
    <Probe />,
  );

  if (!resultado) {
    throw new Error(
      "No se pudo ejecutar useBudgetSummary.",
    );
  }

  return resultado;
}

describe(
  "useBudgetSummary",
  () => {
    it(
      "calcula los límites variables y el plan mensual",
      () => {
        const resultado =
          ejecutarHook({
            compromisosFijos: [
              compromiso({
                monto: 300,
              }),
            ],
          });

        expect(
          resultado
            .limiteVariableMensual,
        ).toBe(1400);

        expect(
          resultado
            .limiteVariableQuincenal,
        ).toBe(700);

        expect(
          resultado.totalFijo,
        ).toBe(300);

        expect(
          resultado.totalPlanMensual,
        ).toBe(1700);
      },
    );

    it(
      "suma únicamente gastos del mes seleccionado",
      () => {
        const resultado =
          ejecutarHook({
            gastos: [
              gasto({
                id: "octubre",
                monto: 300,
                fecha:
                  "2026-10-05",
              }),

              gasto({
                id: "septiembre",
                monto: 500,
                fecha:
                  "2026-09-20",
              }),
            ],
          });

        expect(
          resultado
            .saldoVariableMes,
        ).toBe(300);
      },
    );

    it(
      "no incluye categoría null dentro del presupuesto variable",
      () => {
        const resultado =
          ejecutarHook({
            gastos: [
              gasto({
                id: "comida",
                monto: 100,
                categoria:
                  "comida",
              }),

              gasto({
                id: "otro",
                monto: 500,
                categoria: null,
              }),
            ],
          });

        expect(
          resultado
            .saldoVariableMes,
        ).toBe(100);

        expect(
          resultado
            .disponibleVariableMes,
        ).toBe(1300);
      },
    );

    it(
      "los pagos de tarjeta no devuelven presupuesto variable",
      () => {
        const resultado =
          ejecutarHook({
            gastos: [
              gasto({
                monto: 300,
                categoria:
                  "comida",
              }),
            ],

            pagos: [
              pagoTarjeta({
                monto: 300,
              }),
            ],
          });

        expect(
          resultado
            .saldoVariableMes,
        ).toBe(300);

        expect(
          resultado
            .resumenCategorias
            .find(
              (item) =>
                item.key ===
                "comida",
            )
            ?.saldoMes,
        ).toBe(300);
      },
    );

    it(
      "calcula disponible mensual sin bajar de cero",
      () => {
        const resultado =
          ejecutarHook({
            gastos: [
              gasto({
                monto: 1500,
                categoria:
                  "comida",
              }),
            ],
          });

        expect(
          resultado
            .disponibleVariableMes,
        ).toBe(0);

        expect(
          resultado
            .saldoVariableMes,
        ).toBe(1500);
      },
    );

    it(
      "mantiene categorías comida y gas independientes",
      () => {
        const resultado =
          ejecutarHook({
            gastos: [
              gasto({
                id: "comida",
                monto: 300,
                categoria:
                  "comida",
              }),

              gasto({
                id: "gas",
                monto: 80,
                categoria:
                  "gas",
              }),
            ],
          });

        const comida =
          resultado
            .resumenCategorias
            .find(
              (item) =>
                item.key ===
                "comida",
            );

        const gas =
          resultado
            .resumenCategorias
            .find(
              (item) =>
                item.key ===
                "gas",
            );

        expect(
          comida?.saldoMes,
        ).toBe(300);

        expect(
          comida?.disponibleMes,
        ).toBe(900);

        expect(
          gas?.saldoMes,
        ).toBe(80);

        expect(
          gas?.disponibleMes,
        ).toBe(120);
      },
    );

    it(
      "integra correctamente carry-over de Q1 a Q2",
      () => {
        const resultado =
          ejecutarHook({
            gastos: [
              gasto({
                id: "q1-exceso",
                monto: 700,
                categoria:
                  "comida",

                fecha:
                  "2026-10-10",
              }),

              gasto({
                id: "q2",
                monto: 100,
                categoria:
                  "comida",

                fecha:
                  "2026-10-20",
              }),
            ],

            quincenaSeleccionada:
              2,
          });

        const comida =
          resultado
            .resumenCategorias
            .find(
              (item) =>
                item.key ===
                "comida",
            );

        expect(
          comida
            ?.excedenteAnterior,
        ).toBe(100);

        expect(
          comida
            ?.limiteQuincenalEfectivo,
        ).toBe(500);

        expect(
          comida
            ?.saldoQuincena,
        ).toBe(100);

        expect(
          comida
            ?.disponibleQuincena,
        ).toBe(400);
      },
    );

    it(
      "calcula correctamente los totales integrados de carry-over",
      () => {
        const resultado =
          ejecutarHook({
            gastos: [
              gasto({
                id: "comida-q1",
                monto: 700,
                categoria:
                  "comida",

                fecha:
                  "2026-10-10",
              }),

              gasto({
                id: "gas-q1",
                monto: 150,
                categoria:
                  "gas",

                fecha:
                  "2026-10-10",
              }),

              gasto({
                id: "comida-q2",
                monto: 100,
                categoria:
                  "comida",

                fecha:
                  "2026-10-20",
              }),

              gasto({
                id: "gas-q2",
                monto: 20,
                categoria:
                  "gas",

                fecha:
                  "2026-10-20",
              }),
            ],

            quincenaSeleccionada:
              2,
          });

        /**
         * Excesos anteriores:
         *
         * comida = 100
         * gas    = 50
         */
        expect(
          resultado
            .excedenteVariableAnterior,
        ).toBe(150);

        /**
         * Límites efectivos:
         *
         * comida = 500
         * gas    = 50
         */
        expect(
          resultado
            .limiteVariableQuincenalEfectivo,
        ).toBe(550);

        /**
         * Consumo Q2:
         *
         * comida = 100
         * gas    = 20
         */
        expect(
          resultado
            .saldoVariableQuincena,
        ).toBe(120);

        expect(
          resultado
            .disponibleVariableQuincena,
        ).toBe(430);
      },
    );

    it(
      "marca un compromiso sin pagos como pendiente",
      () => {
        const resultado =
          ejecutarHook({
            compromisosFijos: [
              compromiso({
                monto: 145,
              }),
            ],
          });

        const fijo =
          resultado
            .resumenFijos[0];

        expect(
          fijo.pagadoMes,
        ).toBe(0);

        expect(
          fijo.pendienteMes,
        ).toBe(145);

        expect(
          fijo.estado,
        ).toBe(
          "pendiente",
        );
      },
    );

    it(
      "marca un compromiso parcialmente pagado como parcial",
      () => {
        const resultado =
          ejecutarHook({
            compromisosFijos: [
              compromiso({
                monto: 145,
              }),
            ],

            pagosFijos: [
              pagoFijo({
                monto: 50,
              }),
            ],
          });

        const fijo =
          resultado
            .resumenFijos[0];

        expect(
          fijo.pagadoMes,
        ).toBe(50);

        expect(
          fijo.pendienteMes,
        ).toBe(95);

        expect(
          fijo.estado,
        ).toBe("parcial");
      },
    );

    it(
      "marca un compromiso completo como pagado",
      () => {
        const resultado =
          ejecutarHook({
            compromisosFijos: [
              compromiso({
                monto: 100,
              }),
            ],

            pagosFijos: [
              pagoFijo({
                id: "p1",
                monto: 60,
              }),

              pagoFijo({
                id: "p2",
                monto: 40,

                fecha:
                  "2026-10-06",
              }),
            ],
          });

        const fijo =
          resultado
            .resumenFijos[0];

        expect(
          fijo.pagadoMes,
        ).toBe(100);

        expect(
          fijo.pendienteMes,
        ).toBe(0);

        expect(
          fijo.estado,
        ).toBe("pagado");
      },
    );

    it(
      "un sobrepago nunca genera pendiente negativo",
      () => {
        const resultado =
          ejecutarHook({
            compromisosFijos: [
              compromiso({
                monto: 100,
              }),
            ],

            pagosFijos: [
              pagoFijo({
                monto: 125,
              }),
            ],
          });

        const fijo =
          resultado
            .resumenFijos[0];

        expect(
          fijo.pagadoMes,
        ).toBe(125);

        expect(
          fijo.pendienteMes,
        ).toBe(0);

        expect(
          fijo.estado,
        ).toBe("pagado");
      },
    );

    it(
      "ignora pagos fijos de compromisos que ya no existen en el resumen activo",
      () => {
        const resultado =
          ejecutarHook({
            pagosFijos: [
              pagoFijo({
                compromisoId:
                  "compromiso-eliminado",

                monto: 500,
              }),
            ],
          });

        expect(
          resultado
            .totalPagadoFijoMes,
        ).toBe(0);

        expect(
          resultado
            .totalPendienteFijoMes,
        ).toBe(0);
      },
    );

    it(
      "calcula pagos fijos únicamente de la quincena seleccionada",
      () => {
        const resultado =
          ejecutarHook({
            compromisosFijos: [
              compromiso({
                monto: 200,
              }),
            ],

            pagosFijos: [
              pagoFijo({
                id: "q1",
                monto: 50,

                fecha:
                  "2026-10-10",
              }),

              pagoFijo({
                id: "q2",
                monto: 75,

                fecha:
                  "2026-10-20",
              }),
            ],

            quincenaSeleccionada:
              1,
          });

        expect(
          resultado
            .totalPagadoFijoMes,
        ).toBe(125);

        expect(
          resultado
            .totalPagadoFijoQuincena,
        ).toBe(50);
      },
    );

    it(
      "mantiene compras y pagos de tarjeta dentro del historial",
      () => {
        const resultado =
          ejecutarHook({
            gastos: [
              gasto({
                id:
                  "compra-historial",
              }),
            ],

            pagos: [
              pagoTarjeta({
                id:
                  "pago-historial",
              }),
            ],
          });

        expect(
          resultado.movimientos,
        ).toHaveLength(2);

        expect(
          resultado.movimientos.some(
            (movimiento) =>
              movimiento.tipo ===
                "gasto" &&
              movimiento.id ===
                "compra-historial",
          ),
        ).toBe(true);

        expect(
          resultado.movimientos.some(
            (movimiento) =>
              movimiento.tipo ===
                "pago" &&
              movimiento.id ===
                "pago-historial",
          ),
        ).toBe(true);
      },
    );

    it(
      "ordena movimientos del más reciente al más antiguo",
      () => {
        const resultado =
          ejecutarHook({
            gastos: [
              gasto({
                id: "viejo",

                fecha:
                  "2026-10-01",
              }),

              gasto({
                id: "nuevo",

                fecha:
                  "2026-10-20",
              }),
            ],
          });

        expect(
          resultado
            .movimientos
            .map(
              (movimiento) =>
                movimiento.id,
            ),
        ).toEqual([
          "nuevo",
          "viejo",
        ]);
      },
    );

    it(
      "cuando dos movimientos tienen la misma fecha usa creadoEn para ordenar",
      () => {
        const resultado =
          ejecutarHook({
            gastos: [
              gasto({
                id: "primero",

                fecha:
                  "2026-10-10",

                creadoEn:
                  "2026-10-10T09:00:00.000Z",
              }),

              gasto({
                id: "segundo",

                fecha:
                  "2026-10-10",

                creadoEn:
                  "2026-10-10T15:00:00.000Z",
              }),
            ],
          });

        expect(
          resultado
            .movimientos
            .map(
              (movimiento) =>
                movimiento.id,
            ),
        ).toEqual([
          "segundo",
          "primero",
        ]);
      },
    );

    it(
      "construye la lista de meses disponibles sin duplicados y en orden descendente",
      () => {
        const resultado =
          ejecutarHook({
            gastos: [
              gasto({
                id: "sep",
                fecha:
                  "2026-09-01",
              }),

              gasto({
                id: "nov",
                fecha:
                  "2026-11-01",
              }),
            ],

            pagos: [
              pagoTarjeta({
                fecha:
                  "2026-09-10",
              }),
            ],

            periodoActual:
              "2026-10",
          });

        expect(
          resultado
            .mesesDisponibles,
        ).toEqual([
          "2026-11",
          "2026-10",
          "2026-09",
        ]);
      },
    );
  },
);