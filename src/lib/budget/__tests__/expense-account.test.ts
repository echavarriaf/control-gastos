import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calcularResumenCuentaGastos,
  gastoSaleDeCuenta,
  normalizarCuentaGastos,
  pagoFijoSaleDeCuenta,
  validarCuentaGastos,
} from "@/lib/budget/expense-account";

import type {
  CompromisoFijo,
  GastoVariable,
  Ingreso,
  PagoFijo,
  PagoTarjeta,
} from "@/lib/budget/types";

import type {
  CuentaGastos,
  SaldoTarjetaCuenta,
} from "@/lib/budget/expense-account";

/**
 * ============================================================
 * FIXTURES
 * ============================================================
 */

function crearCuenta(
  overrides: Partial<CuentaGastos> = {},
): CuentaGastos {
  return {
    id: "cuenta-gastos",
    nombre: "Cuenta de gastos",

    saldoInicial: 2873.45,

    fechaSaldoInicial:
      "2026-09-17",

    activa: true,

    ingresosIncluidosEnSaldoInicial:
      [],

    gastosIncluidosEnSaldoInicial:
      [],

    pagosFijosIncluidosEnSaldoInicial:
      [],

    pagosTarjetaIncluidosEnSaldoInicial:
      [],

    ...overrides,
  };
}

function crearIngreso(
  overrides: Partial<Ingreso> = {},
): Ingreso {
  return {
    id: "ingreso-1",

    descripcion:
      "Ingreso test",

    monto: 1000,

    fechaProgramada:
      "2026-10-01",

    fechaRecibida:
      "2026-10-01",

    periodo:
      "2026-10",

    quincena: 1,

    fuente:
      "salario",

    estado:
      "recibido",

    recurrente: false,

    notas: "",

    ...overrides,
  } as Ingreso;
}

function crearGasto(
  overrides: Partial<GastoVariable> = {},
): GastoVariable {
  return {
    id: "gasto-1",

    concepto:
      "Gasto test",

    monto: 100,

    categoria:
      "comida",

    fecha:
      "2026-10-05",

    creadoEn:
      "2026-10-05T12:00:00.000Z",

    metodoPago:
      "debito",

    tarjetaId: null,

    ...overrides,
  } as GastoVariable;
}

function crearCompromiso(
  overrides: Partial<CompromisoFijo> = {},
): CompromisoFijo {
  return {
    id: "compromiso-1",

    descripcion:
      "Compromiso test",

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

function crearPagoFijo(
  overrides: Partial<PagoFijo> = {},
): PagoFijo {
  return {
    id: "pago-fijo-1",

    compromisoId:
      "compromiso-1",

    descripcion:
      "Compromiso test",

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

    /**
     * Los pagos fijos con tarjeta
     * se consideran contabilizados
     * inmediatamente.
     */
    estadoTarjeta: null,

    ...overrides,
  } as PagoFijo;
}

function crearPagoTarjeta(
  overrides: Partial<PagoTarjeta> = {},
): PagoTarjeta {
  return {
    id: "pago-tarjeta-1",

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

    referencia: "",
    notas: "",

    ...overrides,
  } as PagoTarjeta;
}

function calcular({
  cuenta = crearCuenta(),

  ingresos = [],
  gastos = [],
  pagosFijos = [],
  compromisos = [],
  pagosTarjeta = [],
  saldosTarjetas = [],

  quincena = 1,

  fechaReferencia =
    new Date(
      "2026-10-10T12:00:00",
    ),
}: {
  cuenta?: CuentaGastos;

  ingresos?: Ingreso[];

  gastos?: GastoVariable[];

  pagosFijos?: PagoFijo[];

  compromisos?: CompromisoFijo[];

  pagosTarjeta?: PagoTarjeta[];

  saldosTarjetas?:
    SaldoTarjetaCuenta[];

  quincena?: 1 | 2;

  fechaReferencia?: Date;
} = {}) {
  return calcularResumenCuentaGastos(
    cuenta,
    ingresos,
    gastos,
    pagosFijos,
    compromisos,
    pagosTarjeta,
    saldosTarjetas,
    quincena,
    fechaReferencia,
  );
}

/**
 * ============================================================
 * MÉTODOS QUE REALMENTE AFECTAN EL BANCO
 * ============================================================
 */

describe(
  "expense-account - métodos bancarios",
  () => {
    it(
      "considera débito y cuenta bancaria como salidas reales de efectivo",
      () => {
        expect(
          gastoSaleDeCuenta(
            crearGasto({
              metodoPago:
                "debito",
            }),
          ),
        ).toBe(true);

        expect(
          gastoSaleDeCuenta(
            crearGasto({
              metodoPago:
                "cuenta_bancaria",
            }),
          ),
        ).toBe(true);

        expect(
          gastoSaleDeCuenta(
            crearGasto({
              metodoPago:
                "tarjeta_credito",
            }),
          ),
        ).toBe(false);
      },
    );

    it(
      "solo considera transferencia y débito automático como salidas bancarias de pagos fijos",
      () => {
        expect(
          pagoFijoSaleDeCuenta(
            crearPagoFijo({
              metodo:
                "transferencia",
            }),
          ),
        ).toBe(true);

        expect(
          pagoFijoSaleDeCuenta(
            crearPagoFijo({
              metodo:
                "debito_automatico",
            }),
          ),
        ).toBe(true);

        expect(
          pagoFijoSaleDeCuenta(
            crearPagoFijo({
              metodo:
                "tarjeta",
            }),
          ),
        ).toBe(false);

        expect(
          pagoFijoSaleDeCuenta(
            crearPagoFijo({
              metodo:
                "efectivo",
            }),
          ),
        ).toBe(false);
      },
    );
  },
);

/**
 * ============================================================
 * CONFIGURACIÓN DE CUENTA
 * ============================================================
 */

describe(
  "expense-account - configuración",
  () => {
    it(
      "valida y redondea una cuenta correctamente",
      () => {
        const resultado =
          validarCuentaGastos({
            nombre:
              "  Cuenta principal  ",

            saldoInicial:
              2873.456,

            fechaSaldoInicial:
              "2026-09-17",

            activa: true,
          });

        expect(
          resultado.nombre,
        ).toBe(
          "Cuenta principal",
        );

        expect(
          resultado.saldoInicial,
        ).toBe(2873.46);

        expect(
          resultado.fechaSaldoInicial,
        ).toBe(
          "2026-09-17",
        );

        expect(
          resultado.activa,
        ).toBe(true);
      },
    );

    it(
      "usa activa=true por defecto",
      () => {
        const resultado =
          validarCuentaGastos({
            nombre:
              "Cuenta",

            saldoInicial:
              100,

            fechaSaldoInicial:
              "2026-09-17",
          });

        expect(
          resultado.activa,
        ).toBe(true);
      },
    );

    it(
      "rechaza una fecha inválida",
      () => {
        expect(() =>
          validarCuentaGastos({
            nombre:
              "Cuenta",

            saldoInicial:
              100,

            fechaSaldoInicial:
              "2026-02-31",

            activa: true,
          }),
        ).toThrow();
      },
    );

    it(
      "normaliza y elimina ids duplicados de la recalibración",
      () => {
        const resultado =
          normalizarCuentaGastos({
            nombre:
              "Cuenta",

            saldoInicial:
              2873.45,

            fechaSaldoInicial:
              "2026-09-17",

            activa: true,

            gastosIncluidosEnSaldoInicial:
              [
                "gasto-1",
                " gasto-1 ",
                "gasto-2",
                "",
              ],

            ingresosIncluidosEnSaldoInicial:
              [
                "ingreso-1",
              ],

            pagosFijosIncluidosEnSaldoInicial:
              [],

            pagosTarjetaIncluidosEnSaldoInicial:
              [],
          });

        expect(
          resultado,
        ).not.toBeNull();

        expect(
          resultado
            ?.gastosIncluidosEnSaldoInicial,
        ).toEqual([
          "gasto-1",
          "gasto-2",
        ]);
      },
    );
  },
);

/**
 * ============================================================
 * SALDO REAL
 * ============================================================
 */

describe(
  "expense-account - saldo real",
  () => {
    it(
      "mantiene exactamente el saldo recalibrado cuando no existen movimientos posteriores",
      () => {
        const resumen =
          calcular();

        expect(
          resumen.saldoInicial,
        ).toBe(2873.45);

        expect(
          resumen.totalDepositosDesdeSaldoInicial,
        ).toBe(0);

        expect(
          resumen.totalEgresos,
        ).toBe(0);

        expect(
          resumen.saldoActual,
        ).toBe(2873.45);
      },
    );

    it(
      "suma solamente ingresos realmente recibidos",
      () => {
        const ingresos = [
          crearIngreso({
            id: "recibido",
            monto: 1000,

            estado:
              "recibido",
          }),

          crearIngreso({
            id: "proyectado",
            monto: 500,

            estado:
              "proyectado",
          }),

          crearIngreso({
            id: "cancelado",
            monto: 700,

            estado:
              "cancelado",
          }),
        ];

        const resumen =
          calcular({
            ingresos,
          });

        expect(
          resumen.totalDepositosDesdeSaldoInicial,
        ).toBe(1000);

        expect(
          resumen.saldoActual,
        ).toBe(3873.45);

        expect(
          resumen.cantidadDepositos,
        ).toBe(1);
      },
    );

    it(
      "un gasto con débito reduce la cuenta una sola vez",
      () => {
        const resumen =
          calcular({
            gastos: [
              crearGasto({
                monto: 125,
                metodoPago:
                  "debito",
              }),
            ],
          });

        expect(
          resumen.totalEgresosVariables,
        ).toBe(125);

        expect(
          resumen.saldoActual,
        ).toBe(2748.45);
      },
    );

    it(
      "un gasto con cuenta bancaria reduce la cuenta",
      () => {
        const resumen =
          calcular({
            gastos: [
              crearGasto({
                monto: 200,
                metodoPago:
                  "cuenta_bancaria",
              }),
            ],
          });

        expect(
          resumen.totalEgresosVariables,
        ).toBe(200);

        expect(
          resumen.saldoActual,
        ).toBe(2673.45);
      },
    );

    it(
      "una compra con tarjeta de crédito no reduce directamente el efectivo",
      () => {
        const resumen =
          calcular({
            gastos: [
              crearGasto({
                monto: 300,

                metodoPago:
                  "tarjeta_credito",

                tarjetaId:
                  "tarjeta-1",
              }),
            ],
          });

        expect(
          resumen.totalEgresosVariables,
        ).toBe(0);

        expect(
          resumen.saldoActual,
        ).toBe(2873.45);
      },
    );

    it(
      "ignora movimientos anteriores a la recalibración",
      () => {
        const resumen =
          calcular({
            ingresos: [
              crearIngreso({
                monto: 1000,

                fechaRecibida:
                  "2026-09-16",
              }),
            ],

            gastos: [
              crearGasto({
                monto: 500,

                fecha:
                  "2026-09-16",

                metodoPago:
                  "debito",
              }),
            ],

            pagosTarjeta: [
              crearPagoTarjeta({
                monto: 250,

                fecha:
                  "2026-09-16",
              }),
            ],
          });

        expect(
          resumen.totalDepositosDesdeSaldoInicial,
        ).toBe(0);

        expect(
          resumen.totalEgresos,
        ).toBe(0);

        expect(
          resumen.saldoActual,
        ).toBe(2873.45);
      },
    );

    it(
      "no vuelve a contar movimientos incluidos explícitamente en el saldo inicial",
      () => {
        const cuenta =
          crearCuenta({
            ingresosIncluidosEnSaldoInicial:
              ["ingreso-1"],

            gastosIncluidosEnSaldoInicial:
              ["gasto-1"],

            pagosTarjetaIncluidosEnSaldoInicial:
              [
                "pago-tarjeta-1",
              ],
          });

        const resumen =
          calcular({
            cuenta,

            ingresos: [
              crearIngreso(),
            ],

            gastos: [
              crearGasto(),
            ],

            pagosTarjeta: [
              crearPagoTarjeta(),
            ],
          });

        expect(
          resumen.totalDepositosDesdeSaldoInicial,
        ).toBe(0);

        expect(
          resumen.totalEgresosVariables,
        ).toBe(0);

        expect(
          resumen.totalEgresosTarjetas,
        ).toBe(0);

        expect(
          resumen.saldoActual,
        ).toBe(2873.45);
      },
    );
  },
);

/**
 * ============================================================
 * PAGOS FIJOS Y RESERVAS
 * ============================================================
 */

describe(
  "expense-account - compromisos fijos",
  () => {
    it(
      "mantiene reservado el monto completo durante un pago parcial",
      () => {
        const compromiso =
          crearCompromiso({
            monto: 145,
          });

        const pagoParcial =
          crearPagoFijo({
            monto: 50,

            metodo:
              "transferencia",
          });

        const resumen =
          calcular({
            compromisos: [
              compromiso,
            ],

            pagosFijos: [
              pagoParcial,
            ],
          });

        /**
         * El pago parcial todavía
         * no se reconoce como salida.
         */
        expect(
          resumen.totalEgresosFijos,
        ).toBe(0);

        expect(
          resumen.saldoActual,
        ).toBe(2873.45);

        /**
         * Se mantiene reservado
         * el compromiso completo.
         */
        expect(
          resumen.totalReservasFijas,
        ).toBe(145);

        expect(
          resumen.totalComprometido,
        ).toBe(145);

        expect(
          resumen.reservasCompromisos,
        ).toHaveLength(1);

        expect(
          resumen
            .reservasCompromisos[0]
            .estado,
        ).toBe("parcial");

        expect(
          resumen
            .reservasCompromisos[0]
            .montoPagadoRegistrado,
        ).toBe(50);

        expect(
          resumen
            .reservasCompromisos[0]
            .montoPendienteRegistrado,
        ).toBe(95);

        expect(
          resumen
            .reservasCompromisos[0]
            .montoReservado,
        ).toBe(145);
      },
    );

    it(
      "cuando el compromiso se completa libera la reserva y reconoce la salida bancaria",
      () => {
        const compromiso =
          crearCompromiso({
            monto: 100,
          });

        const pagos = [
          crearPagoFijo({
            id: "pago-1",
            monto: 60,
          }),

          crearPagoFijo({
            id: "pago-2",
            monto: 40,

            fecha:
              "2026-10-06",
          }),
        ];

        const resumen =
          calcular({
            compromisos: [
              compromiso,
            ],

            pagosFijos:
              pagos,
          });

        expect(
          resumen.totalEgresosFijos,
        ).toBe(100);

        expect(
          resumen.saldoActual,
        ).toBe(2773.45);

        expect(
          resumen.totalReservasFijas,
        ).toBe(0);

        expect(
          resumen.cantidadCompromisosReservados,
        ).toBe(0);

        expect(
          resumen.cantidadCompromisosFijosCompletos,
        ).toBe(1);
      },
    );

    it(
      "un compromiso inactivo no reserva dinero",
      () => {
        const resumen =
          calcular({
            compromisos: [
              crearCompromiso({
                activo: false,
                monto: 500,
              }),
            ],
          });

        expect(
          resumen.totalReservasFijas,
        ).toBe(0);

        expect(
          resumen.totalComprometido,
        ).toBe(0);
      },
    );

    it(
      "solo reserva compromisos de la quincena financiera seleccionada",
      () => {
        const q1 =
          crearCompromiso({
            id: "q1",
            monto: 100,

            quincenaPresupuestaria:
              1,
          });

        const q2 =
          crearCompromiso({
            id: "q2",
            monto: 250,

            quincenaPresupuestaria:
              2,
          });

        const resumenQ1 =
          calcular({
            compromisos: [
              q1,
              q2,
            ],

            quincena: 1,
          });

        expect(
          resumenQ1.totalReservasFijas,
        ).toBe(100);

        const resumenQ2 =
          calcular({
            compromisos: [
              q1,
              q2,
            ],

            quincena: 2,
          });

        expect(
          resumenQ2.totalReservasFijas,
        ).toBe(250);
      },
    );
  },
);

/**
 * ============================================================
 * TARJETAS + SOLAPAMIENTO
 * ============================================================
 */

describe(
  "expense-account - tarjetas y doble conteo",
  () => {
    it(
      "un pago fijo cargado a tarjeta no reduce directamente el banco",
      () => {
        const compromiso =
          crearCompromiso({
            monto: 145,

            tarjetaId:
              "apple",
          });

        const pagoFijo =
          crearPagoFijo({
            monto: 50,

            metodo:
              "tarjeta",

            tarjetaId:
              "apple",

            estadoTarjeta:
              "contabilizada",
          });

        const resumen =
          calcular({
            compromisos: [
              compromiso,
            ],

            pagosFijos: [
              pagoFijo,
            ],
          });

        expect(
          resumen.totalEgresosFijos,
        ).toBe(0);

        expect(
          resumen.saldoActual,
        ).toBe(2873.45);
      },
    );

    it(
      "evita duplicar una parte del compromiso fijo que ya está dentro de la deuda de tarjeta",
      () => {
        const compromiso =
          crearCompromiso({
            monto: 145,

            tarjetaId:
              "apple",
          });

        const pagoFijo =
          crearPagoFijo({
            monto: 50,

            metodo:
              "tarjeta",

            tarjetaId:
              "apple",

            estadoTarjeta:
              "contabilizada",
          });

        const saldosTarjetas:
          SaldoTarjetaCuenta[] =
          [
            {
              tarjetaId:
                "apple",

              montoReservarCuenta:
                50,
            },
          ];

        const resumen =
          calcular({
            compromisos: [
              compromiso,
            ],

            pagosFijos: [
              pagoFijo,
            ],

            saldosTarjetas,
          });

        expect(
          resumen.totalReservasFijas,
        ).toBe(145);

        expect(
          resumen.totalDeudaTarjetas,
        ).toBe(50);

        expect(
          resumen.totalSolapamientoTarjetas,
        ).toBe(50);

        /**
         * 145 + 50 - 50 = 145
         */
        expect(
          resumen.totalComprometido,
        ).toBe(145);

        expect(
          resumen.totalComprometido,
        ).not.toBe(195);
      },
    );

    it(
      "nunca resta más solapamiento que la deuda actual de la tarjeta",
      () => {
        const compromiso =
          crearCompromiso({
            monto: 145,
          });

        const pagoFijo =
          crearPagoFijo({
            monto: 80,

            metodo:
              "tarjeta",

            tarjetaId:
              "apple",
          });

        const resumen =
          calcular({
            compromisos: [
              compromiso,
            ],

            pagosFijos: [
              pagoFijo,
            ],

            saldosTarjetas: [
              {
                tarjetaId:
                  "apple",

                montoReservarCuenta:
                  30,
              },
            ],
          });

        expect(
          resumen.totalDeudaTarjetas,
        ).toBe(30);

        expect(
          resumen.totalSolapamientoTarjetas,
        ).toBe(30);

        expect(
          resumen.totalComprometido,
        ).toBe(145);
      },
    );

    it(
      "suma deuda de tarjeta independiente cuando no pertenece a un compromiso reservado",
      () => {
        const compromiso =
          crearCompromiso({
            monto: 145,
          });

        const resumen =
          calcular({
            compromisos: [
              compromiso,
            ],

            saldosTarjetas: [
              {
                tarjetaId:
                  "apple",

                montoReservarCuenta:
                  100,
              },
            ],
          });

        expect(
          resumen.totalReservasFijas,
        ).toBe(145);

        expect(
          resumen.totalDeudaTarjetas,
        ).toBe(100);

        expect(
          resumen.totalSolapamientoTarjetas,
        ).toBe(0);

        expect(
          resumen.totalComprometido,
        ).toBe(245);
      },
    );

    it(
      "un pago de tarjeta contabilizado reduce el saldo bancario una vez",
      () => {
        const resumen =
          calcular({
            pagosTarjeta: [
              crearPagoTarjeta({
                monto: 486.45,

                estadoTarjeta:
                  "contabilizada",
              }),
            ],
          });

        expect(
          resumen.totalEgresosTarjetas,
        ).toBe(486.45);

        expect(
          resumen.saldoActual,
        ).toBe(2387);

        expect(
          resumen.cantidadPagosTarjeta,
        ).toBe(1);
      },
    );

    /**
     * CASO CRÍTICO 2B
     *
     * Mientras un pago está pendiente:
     *
     * - todavía aparece el dinero en el banco;
     * - no debe reducir saldoActual;
     * - su reserva ya está representada desde
     *   el resumen de tarjeta.
     */
    it(
      "un pago de tarjeta pendiente no reduce todavía el saldo bancario",
      () => {
        const resumen =
          calcular({
            pagosTarjeta: [
              crearPagoTarjeta({
                monto: 486.45,

                estadoTarjeta:
                  "pendiente",
              }),
            ],

            saldosTarjetas: [
              {
                tarjetaId:
                  "tarjeta-1",

                montoReservarCuenta:
                  486.45,
              },
            ],
          });

        expect(
          resumen.totalEgresosTarjetas,
        ).toBe(0);

        expect(
          resumen.saldoActual,
        ).toBe(2873.45);

        expect(
          resumen.totalDeudaTarjetas,
        ).toBe(486.45);

        expect(
          resumen.totalComprometido,
        ).toBe(486.45);

        expect(
          resumen.disponibleReal,
        ).toBe(2387);
      },
    );
  },
);

/**
 * ============================================================
 * DISPONIBLE REAL
 * ============================================================
 */

describe(
  "expense-account - disponible real",
  () => {
    it(
      "calcula saldo menos comprometido",
      () => {
        const resumen =
          calcular({
            compromisos: [
              crearCompromiso({
                monto: 486.45,
              }),
            ],
          });

        expect(
          resumen.saldoActual,
        ).toBe(2873.45);

        expect(
          resumen.totalComprometido,
        ).toBe(486.45);

        expect(
          resumen.disponibleReal,
        ).toBe(2387);
      },
    );

    it(
      "permite Disponible real negativo para mostrar déficit verdadero",
      () => {
        const resumen =
          calcular({
            cuenta:
              crearCuenta({
                saldoInicial:
                  100,
              }),

            compromisos: [
              crearCompromiso({
                monto: 250,
              }),
            ],
          });

        expect(
          resumen.saldoActual,
        ).toBe(100);

        expect(
          resumen.totalComprometido,
        ).toBe(250);

        expect(
          resumen.disponibleReal,
        ).toBe(-150);

        expect(
          resumen.faltanteReal,
        ).toBe(150);
      },
    );

    it(
      "faltanteReal permanece en cero cuando existe suficiente efectivo",
      () => {
        const resumen =
          calcular({
            compromisos: [
              crearCompromiso({
                monto: 500,
              }),
            ],
          });

        expect(
          resumen.disponibleReal,
        ).toBe(2373.45);

        expect(
          resumen.faltanteReal,
        ).toBe(0);
      },
    );
  },
);

/**
 * ============================================================
 * LEDGER
 * ============================================================
 */

describe(
  "expense-account - ledger",
  () => {
    it(
      "incluye el saldo inicial y calcula el saldo después de cada movimiento",
      () => {
        const resumen =
          calcular({
            ingresos: [
              crearIngreso({
                id: "deposito",
                monto: 1000,

                fechaRecibida:
                  "2026-10-01",
              }),
            ],

            gastos: [
              crearGasto({
                id: "gasto",
                monto: 250,

                fecha:
                  "2026-10-02",

                metodoPago:
                  "debito",
              }),
            ],
          });

        const saldoInicial =
          resumen.movimientos.find(
            (movimiento) =>
              movimiento.tipo ===
              "saldo_inicial",
          );

        const deposito =
          resumen.movimientos.find(
            (movimiento) =>
              movimiento.id ===
              "deposito:deposito",
          );

        const gasto =
          resumen.movimientos.find(
            (movimiento) =>
              movimiento.id ===
              "gasto:gasto",
          );

        expect(
          saldoInicial
            ?.saldoDespues,
        ).toBe(2873.45);

        expect(
          deposito
            ?.saldoDespues,
        ).toBe(3873.45);

        expect(
          gasto
            ?.saldoDespues,
        ).toBe(3623.45);

        expect(
          resumen.saldoActual,
        ).toBe(3623.45);
      },
    );
  },
);