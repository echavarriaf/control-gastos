// Reserva transaccional de alertas de tarjeta por corte, clase y fase.
import type { AlertaTarjetaPendiente, ReclamarAlertaTarjetaArgs } from "./types";
import { randomUUID } from "node:crypto";
import { convertirTimestampMilisegundos, obtenerReferenciaEstadoAlerta } from "./delivery-state";
import { normalizarFaseTarjeta, redondearMoneda } from "./utils";
import { getAdminDb } from "@/lib/firebase-admin";
import { DELIVERY_LEASE_MS, TOLERANCIA_SALDO } from "./constants";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export async function reclamarAlertaTarjeta({
  uid,
  tarjeta,
  clase,
  activa,
  monto,
  calendario,
  estadoVentana,
}: ReclamarAlertaTarjetaArgs): Promise<
  AlertaTarjetaPendiente | null
> {
  const alertKey = [
    "tarjeta",
    tarjeta.id,
    calendario.fechaCorteISO,
    clase,
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

  const montoNormalizado =
    redondearMoneda(
      Math.max(
        monto,
        0,
      ),
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

        const estadoAnterior =
          anterior
            ?.estadoAlerta ===
          "activa"
            ? "activa"
            : "normal";

        const faseAnterior =
          normalizarFaseTarjeta(
            anterior?.fase,
          );

        if (
          !activa ||
          !estadoVentana ||
          montoNormalizado <=
            TOLERANCIA_SALDO
        ) {
          if (
            estadoAnterior !==
              "normal" ||
            entregaPendiente
          ) {
            transaction.set(
              referencia,
              {
                tipo:
                  "tarjeta",

                estadoAlerta:
                  "normal",

                fase:
                  null,

                deliveryPending:
                  false,

                leaseUntil:
                  null,

                attemptId:
                  null,

                monto:
                  montoNormalizado,

                fechaCorteISO:
                  calendario
                    .fechaCorteISO,

                fechaObjetivoPagoISO:
                  calendario
                    .fechaObjetivoPagoISO,

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

        const mismaFaseEntregada =
          estadoAnterior ===
            "activa" &&
          !entregaPendiente &&
          faseAnterior ===
            estadoVentana;

        const alertaAnteriorMasFuerte =
          estadoAnterior ===
            "activa" &&
          !entregaPendiente &&
          faseAnterior ===
            "corte_hoy";

        if (
          mismaFaseEntregada ||
          alertaAnteriorMasFuerte
        ) {
          return;
        }

        reclamada =
          true;

        transaction.set(
          referencia,
          {
            tipo:
              "tarjeta",

            tarjetaId:
              tarjeta.id,

            tarjetaNombre:
              tarjeta.nombre,

            clase,

            estadoAlerta:
              "activa",

            fase:
              estadoVentana,

            monto:
              montoNormalizado,

            fechaCorteISO:
              calendario
                .fechaCorteISO,

            fechaObjetivoPagoISO:
              calendario
                .fechaObjetivoPagoISO,

            deliveryPending:
              true,

            attemptId,

            leaseUntil:
              Timestamp.fromMillis(
                Date.now() +
                  DELIVERY_LEASE_MS,
              ),

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
    !estadoVentana
  ) {
    return null;
  }

  return {
    tipo:
      "tarjeta",

    alertKey,

    attemptId,

    tarjetaId:
      tarjeta.id,

    tarjetaNombre:
      tarjeta.nombre,

    ultimosCuatro:
      tarjeta.ultimosCuatro,

    clase,

    estadoVentana,

    monto:
      montoNormalizado,

    fechaCorteISO:
      calendario
        .fechaCorteISO,

    fechaObjetivoPagoISO:
      calendario
        .fechaObjetivoPagoISO,
  };
}
