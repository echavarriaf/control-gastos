// Reserva transaccional de alertas de presupuesto y control de niveles ya entregados.
import type { AlertaPresupuestoPendiente, ReclamarAlertaPresupuestoArgs } from "./types";
import { nivelNumerico, normalizarNivel, obtenerNivelAlerta } from "./utils";
import { randomUUID } from "node:crypto";
import { convertirTimestampMilisegundos, obtenerReferenciaEstadoAlerta } from "./delivery-state";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { DELIVERY_LEASE_MS } from "./constants";

export async function reclamarAlertaPresupuesto({
  uid,
  categoria,
  periodo,
  alcance,
  quincena,
  saldo,
  limite,
}: ReclamarAlertaPresupuestoArgs): Promise<
  AlertaPresupuestoPendiente | null
> {
  const porcentaje =
    limite > 0
      ? (
          saldo /
          limite
        ) *
        100
      : 0;

  const nivel =
    limite > 0
      ? obtenerNivelAlerta(
          porcentaje,
        )
      : "normal";

  const alertKey = [
    periodo,

    categoria,

    alcance ===
    "mensual"
      ? "mensual"
      : `q${quincena}`,
  ].join(
    "_",
  );

  const attemptId =
    randomUUID();

  const referencia =
    obtenerReferenciaEstadoAlerta(
      uid,
      alertKey,
    );

  let reclamada =
    false;

  await getAdminDb()
    .runTransaction(
      async (
        transaction,
      ) => {
        const snapshot =
          await transaction.get(
            referencia,
          );

        const anterior =
          snapshot.data();

        const nivelAnterior =
          normalizarNivel(
            anterior?.nivel,
          );

        const entregaPendiente =
          anterior
            ?.deliveryPending ===
          true;

        const leaseUntil =
          convertirTimestampMilisegundos(
            anterior?.leaseUntil,
          );

        const leaseActivo =
          entregaPendiente &&
          leaseUntil >
            Date.now();

        if (
          nivel ===
          "normal"
        ) {
          if (
            nivelAnterior !==
              "normal" ||
            entregaPendiente
          ) {
            transaction.set(
              referencia,
              {
                tipo:
                  "presupuesto",

                nivel:
                  "normal",

                deliveryPending:
                  false,

                leaseUntil:
                  null,

                attemptId:
                  null,

                porcentaje,

                saldo,

                limite,

                updatedAt:
                  FieldValue
                    .serverTimestamp(),
              },
              {
                merge:
                  true,
              },
            );
          }

          return;
        }

        if (
          leaseActivo
        ) {
          return;
        }

        if (
          !entregaPendiente &&
          nivelNumerico(
            nivel,
          ) <=
            nivelNumerico(
              nivelAnterior,
            )
        ) {
          return;
        }

        reclamada =
          true;

        transaction.set(
          referencia,
          {
            tipo:
              "presupuesto",

            nivel,

            deliveryPending:
              true,

            attemptId,

            leaseUntil:
              Timestamp.fromMillis(
                Date.now() +
                  DELIVERY_LEASE_MS,
              ),

            porcentaje,

            saldo,

            limite,

            lastAttemptAt:
              FieldValue
                .serverTimestamp(),

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

  if (
    !reclamada ||
    nivel ===
      "normal"
  ) {
    return null;
  }

  return {
    tipo:
      "presupuesto",

    alertKey,

    attemptId,

    categoria,

    alcance,

    quincena,

    nivel,

    porcentaje,

    saldo,

    limite,
  };
}
