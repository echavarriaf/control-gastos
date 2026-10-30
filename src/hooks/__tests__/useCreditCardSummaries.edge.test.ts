import {
  describe,
  expect,
  it,
} from "vitest";

import {
  crearResumenTarjeta,
} from "@/hooks/useCreditCardSummaries";

import type {
  GastoVariable,
  PagoFijo,
  PagoTarjeta,
  TarjetaCredito,
} from "@/lib/budget/types";

function crearTarjeta(
  overrides: Partial<TarjetaCredito> = {},
): TarjetaCredito {
  return {
    id: "tarjeta-1",
    nombre: "Tarjeta Edge",
    ultimosCuatro: "1234",

    saldoInicial: 100,
    fechaSaldoInicial: "2026-10-01",

    diaCorte: 25,
    diaPago: 20,

    activa: true,

    estrategiaPago: "saldo_completo",
    pagoObjetivo: null,

    limiteCredito: 1000,

    notas: "",

    ...overrides,
  };
}

function crearGasto(
  overrides: Partial<GastoVariable> = {},
): GastoVariable {
  return {
    id: "gasto-1",

    concepto: "Compra test",
    monto: 50,

    categoria: null,

    fecha: "2026-10-05",

    creadoEn:
      "2026-10-05T12:00:00.000Z",

    metodoPago:
      "tarjeta_credito",

    tarjetaId: "tarjeta-1",

    estadoTarjeta:
      "contabilizada",

    ...overrides,
  };
}

function crearPago(
  overrides: Partial<PagoTarjeta> = {},
): PagoTarjeta {
  return {
    id: "pago-1",

    concepto: "Pago test",
    monto: 50,

    categoria: "general",

    fecha: "2026-10-05",

    creadoEn:
      "2026-10-05T12:00:00.000Z",

    tarjetaId: "tarjeta-1",

    estadoTarjeta:
      "contabilizada",

    ...overrides,
  };
}

function crearPagoFijo(
  overrides: Partial<PagoFijo> = {},
): PagoFijo {
  return {
    id: "pago-fijo-1",

    compromisoId:
      "compromiso-1",

    descripcion:
      "Pago fijo test",

    monto: 50,

    fecha: "2026-10-05",

    metodo: "tarjeta",

    periodicidad: "mensual",

    referencia: "",
    notas: "",

    tarjetaId: "tarjeta-1",

    ...overrides,
  };
}

const FECHA_FUERA_VENTANA =
  new Date(
    "2026-10-10T12:00:00",
  );

describe(
  "crearResumenTarjeta - edge cases",
  () => {
    it(
      "suma múltiples cargos y pagos pendientes correctamente",
      () => {
        const tarjeta =
          crearTarjeta();

        const gastos = [
          crearGasto({
            id: "g1",
            monto: 10,
            estadoTarjeta: "pendiente",
          }),

          crearGasto({
            id: "g2",
            monto: 20,
            estadoTarjeta: "pendiente",
          }),

          crearGasto({
            id: "g3",
            monto: 30,
            estadoTarjeta: "pendiente",
          }),
        ];

        const pagos = [
          crearPago({
            id: "p1",
            monto: 15,
            estadoTarjeta: "pendiente",
          }),

          crearPago({
            id: "p2",
            monto: 25,
            estadoTarjeta: "pendiente",
          }),
        ];

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            gastos,
            [],
            pagos,
            FECHA_FUERA_VENTANA,
          );

        expect(
          resumen.comprasPendientes,
        ).toBe(60);

        expect(
          resumen.pagosPendientes,
        ).toBe(40);

        expect(
          resumen.saldoActual,
        ).toBe(100);

        expect(
          resumen.saldoProyectado,
        ).toBe(120);

        expect(
          resumen.montoReservarCuenta,
        ).toBe(60);

        expect(
          resumen.montoReservarCuenta,
        ).not.toBe(100);
      },
    );

    it(
      "maneja tarjetas sin límite de crédito",
      () => {
        const tarjeta =
          crearTarjeta({
            saldoInicial: 250,
            limiteCredito: null,
          });

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            [],
            [],
            [],
            FECHA_FUERA_VENTANA,
          );

        expect(
          resumen.saldoActual,
        ).toBe(250);

        expect(
          resumen.creditoDisponible,
        ).toBeNull();

        expect(
          resumen.porcentajeUtilizado,
        ).toBeNull();
      },
    );

    it(
      "no produce crédito disponible negativo cuando la deuda supera el límite",
      () => {
        const tarjeta =
          crearTarjeta({
            saldoInicial: 1200,
            limiteCredito: 1000,
          });

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            [],
            [],
            [],
            FECHA_FUERA_VENTANA,
          );

        expect(
          resumen.saldoActual,
        ).toBe(1200);

        expect(
          resumen.creditoDisponible,
        ).toBe(0);

        expect(
          resumen.porcentajeUtilizado,
        ).toBe(120);
      },
    );

    it(
      "incluye una transacción realizada exactamente en la fecha del saldo inicial",
      () => {
        const tarjeta =
          crearTarjeta({
            saldoInicial: 500,

            fechaSaldoInicial:
              "2026-10-10",
          });

        const gasto =
          crearGasto({
            monto: 75,

            fecha:
              "2026-10-10",

            creadoEn:
              "2026-10-10T08:00:00.000Z",
          });

        const pago =
          crearPago({
            monto: 25,

            fecha:
              "2026-10-10",

            creadoEn:
              "2026-10-10T09:00:00.000Z",
          });

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            [gasto],
            [],
            [pago],
            new Date(
              "2026-10-15T12:00:00",
            ),
          );

        expect(
          resumen.comprasDesdeSaldo,
        ).toBe(75);

        expect(
          resumen.pagosDesdeSaldo,
        ).toBe(25);

        expect(
          resumen.saldoActual,
        ).toBe(550);
      },
    );

    it(
      "redondea correctamente valores monetarios a centavos",
      () => {
        const tarjeta =
          crearTarjeta({
            saldoInicial: 0,
          });

        const gasto =
          crearGasto({
            monto: 10.005,
          });

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            [gasto],
            [],
            [],
            FECHA_FUERA_VENTANA,
          );

        expect(
          resumen.comprasDesdeSaldo,
        ).toBe(10.01);

        expect(
          resumen.saldoActual,
        ).toBe(10.01);
      },
    );

    it(
      "un pago pendiente mayor que la deuda nunca produce saldo proyectado negativo",
      () => {
        const tarjeta =
          crearTarjeta({
            saldoInicial: 100,
          });

        const pago =
          crearPago({
            monto: 150,

            estadoTarjeta:
              "pendiente",
          });

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            [],
            [],
            [pago],
            FECHA_FUERA_VENTANA,
          );

        expect(
          resumen.saldoActual,
        ).toBe(100);

        expect(
          resumen.pagosPendientes,
        ).toBe(150);

        expect(
          resumen.saldoProyectado,
        ).toBe(0);

        expect(
          resumen.montoReservarCuenta,
        ).toBe(150);
      },
    );

    it(
      "una tarjeta inactiva conserva su deuda pero no reserva deuda contabilizada",
      () => {
        const tarjeta =
          crearTarjeta({
            activa: false,

            saldoInicial: 400,
          });

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            [],
            [],
            [],
            new Date(
              "2026-10-22T12:00:00",
            ),
          );

        expect(
          resumen.saldoActual,
        ).toBe(400);

        expect(
          resumen.montoPagoTotal,
        ).toBe(400);

        expect(
          resumen.montoReservarCuenta,
        ).toBe(0);
      },
    );

    it(
      "un pago pendiente dentro de la ventana no cubre oficialmente el corte ni duplica Comprometido",
      () => {
        const tarjeta =
          crearTarjeta({
            saldoInicial: 300,
          });

        const pagoPendiente =
          crearPago({
            monto: 300,

            fecha:
              "2026-10-22",

            creadoEn:
              "2026-10-22T10:00:00.000Z",

            estadoTarjeta:
              "pendiente",
          });

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            [],
            [],
            [pagoPendiente],
            new Date(
              "2026-10-22T12:00:00",
            ),
          );

        expect(
          resumen.saldoActual,
        ).toBe(300);

        expect(
          resumen.saldoProyectado,
        ).toBe(0);

        expect(
          resumen.corteCubierto,
        ).toBe(false);

        expect(
          resumen.pagosPendientes,
        ).toBe(300);

        expect(
          resumen.montoReservarCuenta,
        ).toBe(300);

        expect(
          resumen.montoReservarCuenta,
        ).not.toBe(600);
      },
    );

    it(
      "detecta compra posterior cuando primero se cubre el pago principal el mismo día",
      () => {
        const tarjeta =
          crearTarjeta({
            saldoInicial: 100,
          });

        const pago =
          crearPago({
            id: "pago-principal",

            monto: 100,

            fecha:
              "2026-10-20",

            creadoEn:
              "2026-10-20T09:00:00.000Z",
          });

        const compra =
          crearGasto({
            id: "compra-posterior",

            monto: 40,

            fecha:
              "2026-10-20",

            creadoEn:
              "2026-10-20T10:00:00.000Z",
          });

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            [compra],
            [],
            [pago],
            new Date(
              "2026-10-22T12:00:00",
            ),
          );

        expect(
          resumen.corteCubierto,
        ).toBe(true);

        expect(
          resumen.pagoPrincipalCorte
            ?.pagoId,
        ).toBe(
          "pago-principal",
        );

        expect(
          resumen.saldoActual,
        ).toBe(40);

        expect(
          resumen.comprasPosterioresCobertura,
        ).toBe(40);

        expect(
          resumen.saldoAdicionalAntesCorte,
        ).toBe(40);

        expect(
          resumen.requierePagoAdicionalAntesCorte,
        ).toBe(true);

        expect(
          resumen.montoReservarCuenta,
        ).toBe(40);
      },
    );

    it(
      "una compra antes del pago principal el mismo día queda cubierta por ese pago",
      () => {
        const tarjeta =
          crearTarjeta({
            saldoInicial: 100,
          });

        const compra =
          crearGasto({
            id: "compra-antes",

            monto: 40,

            fecha:
              "2026-10-20",

            creadoEn:
              "2026-10-20T09:00:00.000Z",
          });

        const pago =
          crearPago({
            id: "pago-despues",

            monto: 140,

            fecha:
              "2026-10-20",

            creadoEn:
              "2026-10-20T10:00:00.000Z",
          });

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            [compra],
            [],
            [pago],
            new Date(
              "2026-10-22T12:00:00",
            ),
          );

        expect(
          resumen.corteCubierto,
        ).toBe(true);

        expect(
          resumen.saldoActual,
        ).toBe(0);

        expect(
          resumen.comprasPosterioresCobertura,
        ).toBe(0);

        expect(
          resumen.saldoAdicionalAntesCorte,
        ).toBe(0);

        expect(
          resumen.requierePagoAdicionalAntesCorte,
        ).toBe(false);

        expect(
          resumen.montoReservarCuenta,
        ).toBe(0);
      },
    );

    it(
      "un sobrepago cubre parte de una compra posterior antes de generar pago adicional",
      () => {
        const tarjeta =
          crearTarjeta({
            saldoInicial: 100,
          });

        const pago =
          crearPago({
            id: "sobrepago",

            monto: 120,

            fecha:
              "2026-10-20",

            creadoEn:
              "2026-10-20T09:00:00.000Z",
          });

        const compra =
          crearGasto({
            id: "compra-despues",

            monto: 30,

            fecha:
              "2026-10-20",

            creadoEn:
              "2026-10-20T10:00:00.000Z",
          });

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            [compra],
            [],
            [pago],
            new Date(
              "2026-10-22T12:00:00",
            ),
          );

        expect(
          resumen.corteCubierto,
        ).toBe(true);

        expect(
          resumen.pagoPrincipalCorte
            ?.saldoDespuesPago,
        ).toBe(-20);

        expect(
          resumen.comprasPosterioresCobertura,
        ).toBe(30);

        expect(
          resumen.saldoAdicionalAntesCorte,
        ).toBe(10);

        expect(
          resumen.saldoActual,
        ).toBe(10);

        expect(
          resumen.montoReservarCuenta,
        ).toBe(10);
      },
    );

    it(
      "un pago fijo con tarjeta registrado antes del pago principal participa en la deuda del corte",
      () => {
        const tarjeta =
          crearTarjeta({
            saldoInicial: 100,
          });

        const fijo =
          crearPagoFijo({
            id: "fijo-50",

            monto: 50,

            fecha:
              "2026-10-20",
          });

        const pago =
          crearPago({
            id: "pago-150",

            monto: 150,

            fecha:
              "2026-10-20",

            creadoEn:
              "2026-10-20T12:00:00.000Z",
          });

        const resumen =
          crearResumenTarjeta(
            tarjeta,
            [],
            [fijo],
            [pago],
            new Date(
              "2026-10-22T12:00:00",
            ),
          );

        expect(
          resumen.cargosFijosDesdeSaldo,
        ).toBe(50);

        expect(
          resumen.pagosDesdeSaldo,
        ).toBe(150);

        expect(
          resumen.saldoActual,
        ).toBe(0);

        expect(
          resumen.corteCubierto,
        ).toBe(true);

        expect(
          resumen.saldoAdicionalAntesCorte,
        ).toBe(0);

        expect(
          resumen.montoReservarCuenta,
        ).toBe(0);
      },
    );
  },
);