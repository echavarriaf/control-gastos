// Estado de entrega, identificación de intentos y liberación para reintentos.
import { getAdminDb } from "@/lib/firebase-admin";
import { ALERT_STATE_COLLECTION } from "./constants";
import type { AlertaPendiente, ResultadoEnvio } from "./types";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { esObjeto } from "./utils";

/**
 * ============================================================
 * ESTADO DE ALERTAS
 * ============================================================
 */

export function obtenerReferenciaEstadoAlerta(
  uid:
    string,

  alertKey:
    string,
) {
  return getAdminDb()
    .collection(
      "users",
    )
    .doc(
      uid,
    )
    .collection(
      ALERT_STATE_COLLECTION,
    )
    .doc(
      alertKey,
    );
}

export async function marcarAlertaEntregada(
  uid:
    string,

  alerta:
    AlertaPendiente,

  resultado:
    ResultadoEnvio,
): Promise<void> {
  const referencia =
    obtenerReferenciaEstadoAlerta(
      uid,
      alerta.alertKey,
    );

  await getAdminDb()
    .runTransaction(
      async (
        transaction,
      ) => {
        const snapshot =
          await transaction.get(
            referencia,
          );

        const actual =
          snapshot.data();

        if (
          actual?.attemptId !==
          alerta.attemptId
        ) {
          return;
        }

        transaction.set(
          referencia,
          {
            deliveryPending:
              false,

            leaseUntil:
              null,

            attemptId:
              null,

            lastSentAt:
              FieldValue
                .serverTimestamp(),

            successCount:
              resultado.enviados,

            failureCount:
              resultado.fallidos,

            lastError:
              null,

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );
      },
    );
}

export async function liberarAlertaParaReintento(
  uid:
    string,

  alerta:
    AlertaPendiente,

  error:
    string,
): Promise<void> {
  const referencia =
    obtenerReferenciaEstadoAlerta(
      uid,
      alerta.alertKey,
    );

  await getAdminDb()
    .runTransaction(
      async (
        transaction,
      ) => {
        const snapshot =
          await transaction.get(
            referencia,
          );

        const actual =
          snapshot.data();

        if (
          actual?.attemptId !==
          alerta.attemptId
        ) {
          return;
        }

        transaction.set(
          referencia,
          {
            deliveryPending:
              true,

            leaseUntil:
              Timestamp.fromMillis(
                0,
              ),

            lastError:
              error.slice(
                0,
                500,
              ),

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );
      },
    );
}

export function convertirTimestampMilisegundos(
  value:
    unknown,
): number {
  if (
    value instanceof
    Timestamp
  ) {
    return value
      .toMillis();
  }

  if (
    esObjeto(
      value,
    ) &&
    typeof value.toMillis ===
      "function"
  ) {
    try {
      const result =
        value.toMillis();

      return typeof result ===
        "number"
        ? result
        : 0;
    } catch {
      return 0;
    }
  }

  return 0;
}
