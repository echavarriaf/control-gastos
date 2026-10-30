import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calcularCalendarioPagoTarjeta,
  DIAS_ANTICIPACION_PAGO_TARJETA,
  evaluarVentanaPagoTarjeta,
} from "@/lib/budget/credit-card-payment-calendar";

describe(
  "credit-card-payment-calendar",
  () => {
    it(
      "mantiene cinco días de anticipación para pagar la tarjeta",
      () => {
        expect(
          DIAS_ANTICIPACION_PAGO_TARJETA,
        ).toBe(5);
      },
    );

    it(
      "calcula correctamente un corte normal",
      () => {
        const calendario =
          calcularCalendarioPagoTarjeta(
            25,
            new Date(
              "2026-10-10T12:00:00",
            ),
          );

        expect(
          calendario.fechaCorteISO,
        ).toBe(
          "2026-10-25",
        );

        expect(
          calendario.fechaObjetivoPagoISO,
        ).toBe(
          "2026-10-20",
        );

        expect(
          calendario.diasHastaCorte,
        ).toBe(15);

        expect(
          calendario.diaCorteConfigurado,
        ).toBe(25);

        expect(
          calendario.diaCorteEfectivo,
        ).toBe(25);

        expect(
          calendario.ajustadoPorFinDeMes,
        ).toBe(false);
      },
    );

    it(
      "antes de la ventana de pago no requiere acción",
      () => {
        const calendario =
          calcularCalendarioPagoTarjeta(
            25,
            new Date(
              "2026-10-19T12:00:00",
            ),
          );

        const evaluacion =
          evaluarVentanaPagoTarjeta({
            calendario,
            montoPagoTotal: 500,
            activa: true,
          });

        expect(
          evaluacion.estado,
        ).toBe(
          "antes_de_ventana",
        );

        expect(
          evaluacion.requiereAccion,
        ).toBe(false);

        expect(
          evaluacion.diasParaAbrirVentana,
        ).toBe(1);
      },
    );

    it(
      "el día objetivo inicia la ventana de pago",
      () => {
        const calendario =
          calcularCalendarioPagoTarjeta(
            25,
            new Date(
              "2026-10-20T12:00:00",
            ),
          );

        const evaluacion =
          evaluarVentanaPagoTarjeta({
            calendario,
            montoPagoTotal: 500,
            activa: true,
          });

        expect(
          evaluacion.estado,
        ).toBe(
          "pagar_ahora",
        );

        expect(
          evaluacion.requiereAccion,
        ).toBe(true);

        expect(
          evaluacion.diasDesdeInicioVentana,
        ).toBe(0);
      },
    );

    it(
      "el día del corte cambia el estado a corte_hoy",
      () => {
        const calendario =
          calcularCalendarioPagoTarjeta(
            25,
            new Date(
              "2026-10-25T12:00:00",
            ),
          );

        const evaluacion =
          evaluarVentanaPagoTarjeta({
            calendario,
            montoPagoTotal: 500,
            activa: true,
          });

        expect(
          calendario.diasHastaCorte,
        ).toBe(0);

        expect(
          evaluacion.estado,
        ).toBe(
          "corte_hoy",
        );

        expect(
          evaluacion.requiereAccion,
        ).toBe(true);
      },
    );

    it(
      "una tarjeta inactiva nunca genera acción de pago",
      () => {
        const calendario =
          calcularCalendarioPagoTarjeta(
            25,
            new Date(
              "2026-10-22T12:00:00",
            ),
          );

        const evaluacion =
          evaluarVentanaPagoTarjeta({
            calendario,
            montoPagoTotal: 500,
            activa: false,
          });

        expect(
          evaluacion.estado,
        ).toBe("inactiva");

        expect(
          evaluacion.requiereAccion,
        ).toBe(false);
      },
    );

    it(
      "una tarjeta sin saldo no genera acción aunque esté dentro de la ventana",
      () => {
        const calendario =
          calcularCalendarioPagoTarjeta(
            25,
            new Date(
              "2026-10-22T12:00:00",
            ),
          );

        const evaluacion =
          evaluarVentanaPagoTarjeta({
            calendario,
            montoPagoTotal: 0,
            activa: true,
          });

        expect(
          evaluacion.estado,
        ).toBe("sin_saldo");

        expect(
          evaluacion.requiereAccion,
        ).toBe(false);
      },
    );

    it(
      "después del corte calcula automáticamente el corte del mes siguiente",
      () => {
        const calendario =
          calcularCalendarioPagoTarjeta(
            25,
            new Date(
              "2026-10-26T12:00:00",
            ),
          );

        expect(
          calendario.fechaCorteISO,
        ).toBe(
          "2026-11-25",
        );

        expect(
          calendario.fechaObjetivoPagoISO,
        ).toBe(
          "2026-11-20",
        );

        expect(
          calendario.ajustadoPorFinDeMes,
        ).toBe(false);
      },
    );

    it(
      "ajusta un corte configurado para día 31 en un mes de 30 días",
      () => {
        const calendario =
          calcularCalendarioPagoTarjeta(
            31,
            new Date(
              "2026-04-10T12:00:00",
            ),
          );

        expect(
          calendario.fechaCorteISO,
        ).toBe(
          "2026-04-30",
        );

        expect(
          calendario.fechaObjetivoPagoISO,
        ).toBe(
          "2026-04-25",
        );

        expect(
          calendario.diaCorteConfigurado,
        ).toBe(31);

        expect(
          calendario.diaCorteEfectivo,
        ).toBe(30);

        expect(
          calendario.ajustadoPorFinDeMes,
        ).toBe(true);
      },
    );

    it(
      "ajusta correctamente febrero de un año no bisiesto",
      () => {
        const calendario =
          calcularCalendarioPagoTarjeta(
            31,
            new Date(
              "2027-02-10T12:00:00",
            ),
          );

        expect(
          calendario.fechaCorteISO,
        ).toBe(
          "2027-02-28",
        );

        expect(
          calendario.fechaObjetivoPagoISO,
        ).toBe(
          "2027-02-23",
        );

        expect(
          calendario.diaCorteEfectivo,
        ).toBe(28);

        expect(
          calendario.ajustadoPorFinDeMes,
        ).toBe(true);
      },
    );

    it(
      "ajusta correctamente febrero de un año bisiesto",
      () => {
        const calendario =
          calcularCalendarioPagoTarjeta(
            31,
            new Date(
              "2028-02-10T12:00:00",
            ),
          );

        expect(
          calendario.fechaCorteISO,
        ).toBe(
          "2028-02-29",
        );

        expect(
          calendario.fechaObjetivoPagoISO,
        ).toBe(
          "2028-02-24",
        );

        expect(
          calendario.diaCorteEfectivo,
        ).toBe(29);

        expect(
          calendario.ajustadoPorFinDeMes,
        ).toBe(true);
      },
    );

    it(
      "maneja correctamente el cambio de diciembre a enero",
      () => {
        const calendario =
          calcularCalendarioPagoTarjeta(
            25,
            new Date(
              "2026-12-26T12:00:00",
            ),
          );

        expect(
          calendario.fechaCorteISO,
        ).toBe(
          "2027-01-25",
        );

        expect(
          calendario.fechaObjetivoPagoISO,
        ).toBe(
          "2027-01-20",
        );
      },
    );
  },
);