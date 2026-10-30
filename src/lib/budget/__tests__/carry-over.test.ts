import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calcularCarryOverQuincenal,
  type MovimientoCarryOver,
} from "@/lib/budget/carry-over";

import type {
  LimitesVariables,
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

function calcular(
  movimientos: MovimientoCarryOver[],
  periodoObjetivo = "2026-10",
  quincenaObjetivo: Quincena = 1,
) {
  return calcularCarryOverQuincenal({
    movimientos,
    limites,
    periodoObjetivo,
    quincenaObjetivo,
  });
}

describe(
  "calcularCarryOverQuincenal",
  () => {
    it(
      "usa el límite completo cuando no existe historial",
      () => {
        const resultado =
          calcular([]);

        expect(
          resultado.comida.saldoQuincena,
        ).toBe(0);

        expect(
          resultado.comida.excedenteAnterior,
        ).toBe(0);

        expect(
          resultado.comida.limiteQuincenalEfectivo,
        ).toBe(600);

        expect(
          resultado.comida.disponibleQuincena,
        ).toBe(600);

        expect(
          resultado.comida.excedenteSiguiente,
        ).toBe(0);

        expect(
          resultado.gas.limiteQuincenalEfectivo,
        ).toBe(100);
      },
    );

    it(
      "mantiene disponible cuando el gasto está dentro del límite",
      () => {
        const resultado =
          calcular([
            {
              categoria: "comida",
              monto: 500,
              periodo: "2026-10",
              quincena: 1,
            },
          ]);

        expect(
          resultado.comida.saldoQuincena,
        ).toBe(500);

        expect(
          resultado.comida.disponibleQuincena,
        ).toBe(100);

        expect(
          resultado.comida.excedenteSiguiente,
        ).toBe(0);
      },
    );

    it(
      "genera carry-over cuando una quincena excede el límite",
      () => {
        const resultado =
          calcular([
            {
              categoria: "comida",
              monto: 700,
              periodo: "2026-10",
              quincena: 1,
            },
          ]);

        expect(
          resultado.comida.saldoQuincena,
        ).toBe(700);

        expect(
          resultado.comida.disponibleQuincena,
        ).toBe(0);

        expect(
          resultado.comida.excedenteSiguiente,
        ).toBe(100);
      },
    );

    it(
      "reduce el límite de Q2 usando el exceso de Q1",
      () => {
        const resultado =
          calcular(
            [
              {
                categoria: "comida",
                monto: 700,
                periodo: "2026-10",
                quincena: 1,
              },

              {
                categoria: "comida",
                monto: 200,
                periodo: "2026-10",
                quincena: 2,
              },
            ],
            "2026-10",
            2,
          );

        expect(
          resultado.comida.excedenteAnterior,
        ).toBe(100);

        expect(
          resultado.comida.limiteQuincenalEfectivo,
        ).toBe(500);

        expect(
          resultado.comida.saldoQuincena,
        ).toBe(200);

        expect(
          resultado.comida.disponibleQuincena,
        ).toBe(300);

        expect(
          resultado.comida.excedenteSiguiente,
        ).toBe(0);
      },
    );

    it(
      "no convierte sobrante positivo en crédito para la próxima quincena",
      () => {
        const resultado =
          calcular(
            [
              {
                categoria: "comida",
                monto: 100,
                periodo: "2026-10",
                quincena: 1,
              },
            ],
            "2026-10",
            2,
          );

        /**
         * Q1 tuvo $500 sin utilizar.
         *
         * Q2 sigue teniendo $600,
         * no $1,100.
         */
        expect(
          resultado.comida.excedenteAnterior,
        ).toBe(0);

        expect(
          resultado.comida.limiteQuincenalEfectivo,
        ).toBe(600);

        expect(
          resultado.comida.disponibleQuincena,
        ).toBe(600);
      },
    );

    it(
      "continúa arrastrando un exceso mayor que una quincena completa",
      () => {
        const resultadoQ2 =
          calcular(
            [
              {
                categoria: "comida",
                monto: 1300,
                periodo: "2026-10",
                quincena: 1,
              },
            ],
            "2026-10",
            2,
          );

        /**
         * Q1:
         *
         * límite = 600
         * gasto  = 1300
         * exceso = 700
         *
         * Q2 puede absorber 600.
         * Todavía deben quedar 100.
         */
        expect(
          resultadoQ2.comida.excedenteAnterior,
        ).toBe(700);

        expect(
          resultadoQ2.comida.limiteQuincenalEfectivo,
        ).toBe(0);

        expect(
          resultadoQ2.comida.disponibleQuincena,
        ).toBe(0);

        expect(
          resultadoQ2.comida.excedenteSiguiente,
        ).toBe(100);
      },
    );

    it(
      "arrastra el exceso de Q2 hacia Q1 del mes siguiente",
      () => {
        const resultado =
          calcular(
            [
              {
                categoria: "comida",
                monto: 700,
                periodo: "2026-10",
                quincena: 2,
              },
            ],
            "2026-11",
            1,
          );

        expect(
          resultado.comida.excedenteAnterior,
        ).toBe(100);

        expect(
          resultado.comida.limiteQuincenalEfectivo,
        ).toBe(500);

        expect(
          resultado.comida.disponibleQuincena,
        ).toBe(500);
      },
    );

    it(
      "maneja correctamente el cambio de diciembre a enero",
      () => {
        const resultado =
          calcular(
            [
              {
                categoria: "comida",
                monto: 750,
                periodo: "2026-12",
                quincena: 2,
              },
            ],
            "2027-01",
            1,
          );

        expect(
          resultado.comida.excedenteAnterior,
        ).toBe(150);

        expect(
          resultado.comida.limiteQuincenalEfectivo,
        ).toBe(450);
      },
    );

    it(
      "mantiene independientes las categorías comida y gas",
      () => {
        const resultado =
          calcular(
            [
              {
                categoria: "comida",
                monto: 800,
                periodo: "2026-10",
                quincena: 1,
              },

              {
                categoria: "gas",
                monto: 50,
                periodo: "2026-10",
                quincena: 1,
              },
            ],
            "2026-10",
            2,
          );

        expect(
          resultado.comida.excedenteAnterior,
        ).toBe(200);

        expect(
          resultado.comida.limiteQuincenalEfectivo,
        ).toBe(400);

        /**
         * El exceso de comida NO toca Gas.
         */
        expect(
          resultado.gas.excedenteAnterior,
        ).toBe(0);

        expect(
          resultado.gas.limiteQuincenalEfectivo,
        ).toBe(100);
      },
    );

    it(
      "suma varios movimientos de la misma categoría y quincena",
      () => {
        const resultado =
          calcular([
            {
              categoria: "comida",
              monto: 200,
              periodo: "2026-10",
              quincena: 1,
            },

            {
              categoria: "comida",
              monto: 150,
              periodo: "2026-10",
              quincena: 1,
            },

            {
              categoria: "comida",
              monto: 75,
              periodo: "2026-10",
              quincena: 1,
            },
          ]);

        expect(
          resultado.comida.saldoQuincena,
        ).toBe(425);

        expect(
          resultado.comida.disponibleQuincena,
        ).toBe(175);
      },
    );

    it(
      "no deja que movimientos futuros afecten la quincena objetivo",
      () => {
        const resultado =
          calcular(
            [
              {
                categoria: "comida",
                monto: 200,
                periodo: "2026-10",
                quincena: 1,
              },

              {
                categoria: "comida",
                monto: 900,
                periodo: "2026-11",
                quincena: 1,
              },
            ],
            "2026-10",
            1,
          );

        expect(
          resultado.comida.saldoQuincena,
        ).toBe(200);

        expect(
          resultado.comida.disponibleQuincena,
        ).toBe(400);

        expect(
          resultado.comida.excedenteSiguiente,
        ).toBe(0);
      },
    );
  },
);