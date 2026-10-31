// Prepara alertas de presupuesto y tarjetas antes de solicitar su reserva.
import { CATEGORY_KEYS } from "./types";
import { calcularCarryOverQuincenal } from "@/lib/budget/carry-over";
import type {
  AlertaPresupuestoPendiente,
  AlertaTarjetaPendiente,
  PrepararAlertasPresupuestoArgs,
  PrepararAlertasTarjetasArgs,
} from "./types";
import { sumarMontos } from "./utils";
import { reclamarAlertaPresupuesto } from "./budget-alert-state";
import { obtenerFechaZonaHorariaISO } from "./dates";
import { calcularEstadoPagoTarjeta } from "./card-calculations";
import { reclamarAlertaTarjeta } from "./card-alert-state";

export async function prepararAlertasPresupuesto({
  uid,
  usarCarryOver = false,
  periodo,
  quincena,
  limites,
  datos,
}: PrepararAlertasPresupuestoArgs): Promise<
  AlertaPresupuestoPendiente[]
> {
  const alertas:
    AlertaPresupuestoPendiente[] =
      [];

  const carry = usarCarryOver ? calcularCarryOverQuincenal({
    movimientos: datos.gastos.flatMap(movimiento => movimiento.categoria === null ? [] : [{ ...movimiento, categoria: movimiento.categoria }]),
    limites, periodoObjetivo: periodo, quincenaObjetivo: quincena,
  }) : null;

  for (
    const categoria of
    CATEGORY_KEYS
  ) {
    const gastosCategoria =
      datos.gastos.filter(
        (
          movimiento,
        ) =>
          movimiento.categoria === categoria && movimiento.periodo === periodo,
      );

    const saldoMensual =
      Math.max(
        sumarMontos(
          gastosCategoria,
        ),
        0,
      );

    const alertaMensual =
      await reclamarAlertaPresupuesto({
        uid,

        categoria,

        periodo,

        alcance:
          "mensual",

        quincena:
          null,

        saldo:
          saldoMensual,

        limite:
          limites[
            categoria
          ].mensual,
      });

    if (
      alertaMensual
    ) {
      alertas.push(
        alertaMensual,
      );
    }

    const gastosQuincena =
      gastosCategoria.filter(
        (
          movimiento,
        ) =>
          movimiento.quincena ===
          quincena,
      );

    const saldoQuincenal = carry ? carry[categoria].consumoAjustadoQuincena :
      Math.max(
        sumarMontos(
          gastosQuincena,
        ),
        0,
      );

    const alertaQuincenal =
      await reclamarAlertaPresupuesto({
        uid,

        categoria,

        periodo,

        alcance:
          "quincenal",

        quincena,

        saldo:
          saldoQuincenal,

        limite:
          limites[
            categoria
          ].quincenal,
      });

    if (
      alertaQuincenal
    ) {
      alertas.push(
        alertaQuincenal,
      );
    }
  }

  return alertas;
}

export async function prepararAlertasTarjetas({
  uid,
  ahora,
  datos,
}: PrepararAlertasTarjetasArgs): Promise<
  AlertaTarjetaPendiente[]
> {
  const alertas:
    AlertaTarjetaPendiente[] =
      [];

  const hoyISO =
    obtenerFechaZonaHorariaISO(
      ahora,
    );

  for (
    const tarjeta of
    datos.tarjetas
  ) {
    const movimientos =
      datos.movimientos.filter(
        (
          movimiento,
        ) =>
          movimiento.tarjetaId ===
          tarjeta.id,
      );

    const estado =
      calcularEstadoPagoTarjeta({
        tarjeta,

        movimientos,

        hoyISO,
      });

    const principal =
      await reclamarAlertaTarjeta({
        uid,

        tarjeta,

        clase:
          "principal",

        activa:
          estado.requierePrincipal,

        monto:
          estado.montoPrincipal,

        calendario:
          estado.calendario,

        estadoVentana:
          estado.estadoVentana,
      });

    if (
      principal
    ) {
      alertas.push(
        principal,
      );
    }

    const adicional =
      await reclamarAlertaTarjeta({
        uid,

        tarjeta,

        clase:
          "adicional",

        activa:
          estado.requiereAdicional,

        monto:
          estado.montoAdicional,

        calendario:
          estado.calendario,

        estadoVentana:
          estado.estadoVentana,
      });

    if (
      adicional
    ) {
      alertas.push(
        adicional,
      );
    }
  }

  return alertas;
}
