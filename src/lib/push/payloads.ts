// Mensajes y datos públicos que recibe el service worker para mostrar una alerta.
import type { AlertaPendiente, AlertaPresupuestoPendiente, AlertaTarjetaPendiente } from "./types";
import { CATEGORY_LABELS } from "./constants";
import { formatoMoneda } from "./utils";
import { formatearFechaCalendario } from "./dates";

export function crearPayloadAlerta(
  alerta:
    AlertaPendiente,
): Record<string, string> {
  if (
    alerta.tipo ===
    "tarjeta"
  ) {
    return crearPayloadAlertaTarjeta(
      alerta,
    );
  }

  return crearPayloadAlertaPresupuesto(
    alerta,
  );
}

function crearPayloadAlertaPresupuesto(
  alerta:
    AlertaPresupuestoPendiente,
): Record<string, string> {
  const label =
    CATEGORY_LABELS[
      alerta.categoria
    ];

  const periodoTexto =
    alerta.alcance ===
    "mensual"
      ? "este mes"
      : `en la quincena ${alerta.quincena}`;

  const disponible =
    Math.max(
      alerta.limite -
        alerta.saldo,
      0,
    );

  const excedente =
    Math.max(
      alerta.saldo -
        alerta.limite,
      0,
    );

  const title =
    alerta.nivel ===
    "100"
      ? `🚨 ${label}: límite superado`
      : `⚠️ ${label} llegó al 90%`;

  const body =
    alerta.nivel ===
    "100"
      ? `Has usado ${formatoMoneda(
          alerta.saldo,
        )} de ${formatoMoneda(
          alerta.limite,
        )} ${periodoTexto}. Exceso: ${formatoMoneda(
          excedente,
        )}.`
      : `Has usado ${alerta.porcentaje.toFixed(
          0,
        )}% de ${label} ${periodoTexto}. Quedan ${formatoMoneda(
          disponible,
        )}.`;

  return {
    title,

    body,

    url:
      "/",

    tag:
      `${alerta.alertKey}_${alerta.nivel}`,

    tipo:
      "presupuesto",

    categoria:
      alerta.categoria,

    alcance:
      alerta.alcance,

    quincena:
      alerta.quincena
        ?.toString() ??
      "",

    nivel:
      alerta.nivel,

    porcentaje:
      alerta.porcentaje.toFixed(
        2,
      ),

    saldo:
      alerta.saldo.toFixed(
        2,
      ),

    limite:
      alerta.limite.toFixed(
        2,
      ),

    timestamp:
      Date.now()
        .toString(),

    renotify:
      "true",

    requireInteraction:
      alerta.nivel ===
      "100"
        ? "true"
        : "false",
  };
}

function crearPayloadAlertaTarjeta(
  alerta:
    AlertaTarjetaPendiente,
): Record<string, string> {
  const sufijo =
    alerta.ultimosCuatro
      ? ` •••• ${alerta.ultimosCuatro}`
      : "";

  const fechaCorte =
    formatearFechaCalendario(
      alerta.fechaCorteISO,
    );

  const corteHoy =
    alerta.estadoVentana ===
    "corte_hoy";

  let title:
    string;

  let body:
    string;

  if (
    alerta.clase ===
    "principal"
  ) {
    title =
      corteHoy
        ? `🚨 ${alerta.tarjetaNombre}: pagar hoy`
        : `💳 ${alerta.tarjetaNombre}: pagar ahora`;

    body =
      corteHoy
        ? `El corte es hoy. Paga ${formatoMoneda(
            alerta.monto,
          )} para cubrir el saldo${sufijo}.`
        : `Paga ${formatoMoneda(
            alerta.monto,
          )} antes del corte del ${fechaCorte}${sufijo}.`;
  } else {
    title =
      corteHoy
        ? `🚨 ${alerta.tarjetaNombre}: pago adicional hoy`
        : `💳 ${alerta.tarjetaNombre}: pago adicional`;

    body =
      corteHoy
        ? `Después del pago principal quedaron ${formatoMoneda(
            alerta.monto,
          )} por cubrir antes del corte de hoy${sufijo}.`
        : `Después del pago principal, paga ${formatoMoneda(
            alerta.monto,
          )} adicional antes del corte del ${fechaCorte}${sufijo}.`;
  }

  return {
    title,

    body,

    url:
      "/",

    tag:
      `${alerta.alertKey}_${alerta.estadoVentana}`,

    tipo:
      "tarjeta",

    tarjetaId:
      alerta.tarjetaId,

    tarjetaNombre:
      alerta.tarjetaNombre,

    ultimosCuatro:
      alerta.ultimosCuatro,

    clase:
      alerta.clase,

    estadoVentana:
      alerta.estadoVentana,

    monto:
      alerta.monto.toFixed(
        2,
      ),

    fechaCorteISO:
      alerta.fechaCorteISO,

    fechaObjetivoPagoISO:
      alerta.fechaObjetivoPagoISO,

    timestamp:
      Date.now()
        .toString(),

    renotify:
      "true",

    requireInteraction:
      corteHoy
        ? "true"
        : "false",
  };
}
