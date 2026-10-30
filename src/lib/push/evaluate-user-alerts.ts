// Coordina carga, preparación, entrega y confirmación de alertas; conserva la API pública.
import { CATEGORY_KEYS } from "./types";
import type { AlertaPendiente, EvaluacionAlertasUsuarioResultado } from "./types";
import { obtenerInfoPeriodo } from "./dates";
import { cargarDatosPeriodo, cargarDatosTarjetas, cargarFidsActivos, cargarLimites } from "./repository";
import { prepararAlertasPresupuesto, prepararAlertasTarjetas } from "./prepare-alerts";
import { liberarAlertaParaReintento, marcarAlertaEntregada } from "./delivery-state";
import { enviarAlerta } from "./delivery";
import { obtenerMensajeError } from "./utils";

/**
 * ============================================================
 * API PÚBLICA SERVER-SIDE
 * ============================================================
 *
 * Coordina la lectura, los cálculos, la deduplicación y la entrega.
 * Cada responsabilidad se implementa en su módulo de push.
 *
 * Puede ser llamada desde:
 *
 * - /api/push/evaluate
 * - /api/cron/push-evaluate
 *
 * No confía en datos calculados por el navegador.
 */
export async function evaluarAlertasUsuario(
  uid:
    string,

  ahora =
    new Date(),
): Promise<EvaluacionAlertasUsuarioResultado> {
  if (
    !uid.trim()
  ) {
    throw new Error(
      "Se requiere un UID válido para evaluar alertas.",
    );
  }

  const infoPeriodo =
    obtenerInfoPeriodo(
      ahora,
    );

  const [
    limites,
    datosPeriodo,
    datosTarjetas,
  ] =
    await Promise.all([
      cargarLimites(
        uid,
      ),

      cargarDatosPeriodo(
        uid,
        infoPeriodo.periodo,
      ),

      cargarDatosTarjetas(
        uid,
      ),
    ]);

  const [
    alertasPresupuesto,
    alertasTarjetas,
  ] =
    await Promise.all([
      prepararAlertasPresupuesto({
        uid,

        periodo:
          infoPeriodo.periodo,

        quincena:
          infoPeriodo.quincena,

        limites,

        datos:
          datosPeriodo,
      }),

      prepararAlertasTarjetas({
        uid,

        ahora,

        datos:
          datosTarjetas,
      }),
    ]);

  const alertas:
    AlertaPendiente[] = [
      ...alertasPresupuesto,
      ...alertasTarjetas,
    ];

  const evaluadasPresupuesto =
    CATEGORY_KEYS.length *
    2;

  const evaluadasTarjetas =
    datosTarjetas
      .tarjetas
      .length *
    2;

  const evaluadas =
    evaluadasPresupuesto +
    evaluadasTarjetas;

  if (
    alertas.length ===
    0
  ) {
    return {
      uid,

      periodo:
        infoPeriodo.periodo,

      quincena:
        infoPeriodo.quincena,

      evaluadas,

      evaluadasPresupuesto,

      evaluadasTarjetas,

      alertas:
        0,

      alertasPresupuesto:
        0,

      alertasTarjetas:
        0,

      enviadas:
        0,

      fallidas:
        0,

      dispositivos:
        0,

      mensaje:
        "No hay alertas nuevas.",
    };
  }

  const fids =
    await cargarFidsActivos(
      uid,
    );

  if (
    fids.length ===
    0
  ) {
    await Promise.all(
      alertas.map(
        (
          alerta,
        ) =>
          liberarAlertaParaReintento(
            uid,
            alerta,
            "No hay dispositivos push activos.",
          ),
      ),
    );

    return {
      uid,

      periodo:
        infoPeriodo.periodo,

      quincena:
        infoPeriodo.quincena,

      evaluadas,

      evaluadasPresupuesto,

      evaluadasTarjetas,

      alertas:
        alertas.length,

      alertasPresupuesto:
        alertasPresupuesto
          .length,

      alertasTarjetas:
        alertasTarjetas
          .length,

      enviadas:
        0,

      fallidas:
        0,

      dispositivos:
        0,

      mensaje:
        "No hay dispositivos push activos.",
    };
  }

  let enviados =
    0;

  let fallidos =
    0;

  for (
    const alerta of
    alertas
  ) {
    try {
      const resultado =
        await enviarAlerta(
          uid,
          alerta,
          fids,
        );

      enviados +=
        resultado.enviados;

      fallidos +=
        resultado.fallidos;

      await marcarAlertaEntregada(
        uid,
        alerta,
        resultado,
      );
    } catch (
      error
    ) {
      fallidos +=
        fids.length;

      await liberarAlertaParaReintento(
        uid,
        alerta,
        obtenerMensajeError(
          error,
        ),
      );

      console.error(
        "Error enviando alerta push:",
        {
          uid,

          alertKey:
            alerta.alertKey,

          tipo:
            alerta.tipo,

          error,
        },
      );
    }
  }

  return {
    uid,

    periodo:
      infoPeriodo.periodo,

    quincena:
      infoPeriodo.quincena,

    evaluadas,

    evaluadasPresupuesto,

    evaluadasTarjetas,

    alertas:
      alertas.length,

    alertasPresupuesto:
      alertasPresupuesto
        .length,

    alertasTarjetas:
      alertasTarjetas
        .length,

    enviadas:
      enviados,

    fallidas:
      fallidos,

    dispositivos:
      fids.length,
  };
}
export type { EvaluacionAlertasUsuarioResultado } from "./types";
