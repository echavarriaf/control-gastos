// Umbrales, configuración temporal y límites de entrega push.
import type { CategoriaVariable, LimitesVariables } from "./types";

export const TIME_ZONE =
  "America/New_York";

export const DEVICE_COLLECTION =
  "notificationDevices";

export const ALERT_STATE_COLLECTION =
  "notificationAlertStates";

export const ALERT_THRESHOLD =
  90;

export const EXCEEDED_THRESHOLD =
  100;

export const DELIVERY_LEASE_MS =
  60_000;

export const MAX_FIDS_PER_BATCH =
  500;

export const DIAS_ANTICIPACION_PAGO_TARJETA =
  5;

export const TOLERANCIA_SALDO =
  0.005;

export const DEFAULT_LIMITS:
  LimitesVariables = {
    comida: {
      mensual: 0,
      quincenal: 0,
    },

    gas: {
      mensual: 0,
      quincenal: 0,
    },
  };

export const CATEGORY_LABELS:
  Record<
    CategoriaVariable,
    string
  > = {
    comida:
      "Comida",

    gas:
      "Gas",
  };
