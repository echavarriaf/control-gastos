// Entrega FCM por lotes y desactivación de instalaciones inválidas.
import type { AlertaPendiente, ResultadoEnvio } from "./types";
import { crearPayloadAlerta } from "./payloads";
import { MAX_FIDS_PER_BATCH } from "./constants";
import type { FidMulticastMessage } from "firebase-admin/messaging";
import { getAdminMessaging } from "@/lib/firebase-admin";
import { esFidInvalido } from "./utils";
import { desactivarFidsInvalidos } from "./repository";

/**
 * ============================================================
 * FCM
 * ============================================================
 */

export async function enviarAlerta(
  uid:
    string,

  alerta:
    AlertaPendiente,

  fids:
    string[],
): Promise<ResultadoEnvio> {
  const data =
    crearPayloadAlerta(
      alerta,
    );

  let enviados =
    0;

  let fallidos =
    0;

  for (
    let index =
      0;

    index <
    fids.length;

    index +=
      MAX_FIDS_PER_BATCH
  ) {
    const batchFids =
      fids.slice(
        index,
        index +
          MAX_FIDS_PER_BATCH,
      );

    const urgente =
      alerta.tipo ===
      "presupuesto"
        ? alerta.nivel ===
          "100"
        : alerta.estadoVentana ===
          "corte_hoy";

    const message:
      FidMulticastMessage = {
        fids:
          batchFids,

        data,

        webpush: {
          headers: {
            Urgency:
              urgente
                ? "high"
                : "normal",
          },
        },
      };

    const response =
      await getAdminMessaging()
        .sendEachForMulticast(
          message,
        );

    enviados +=
      response.successCount;

    fallidos +=
      response.failureCount;

    const invalidos:
      string[] = [];

    response.responses.forEach(
      (
        resultado,
        responseIndex,
      ) => {
        if (
          resultado.success
        ) {
          return;
        }

        const fid =
          batchFids[
            responseIndex
          ];

        const code =
          resultado.error
            ?.code ??
          "";

        console.warn(
          "Falló el envío a un dispositivo:",
          {
            uid,

            fid,

            code,

            message:
              resultado.error
                ?.message,
          },
        );

        if (
          esFidInvalido(
            code,
          )
        ) {
          invalidos.push(
            fid,
          );
        }
      },
    );

    await desactivarFidsInvalidos(
      uid,
      invalidos,
    );
  }

  return {
    enviados,

    fallidos,

    dispositivos:
      fids.length,
  };
}
