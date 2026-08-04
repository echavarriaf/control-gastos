/*
 * Nombre: Tipos de autenticación y solicitudes de acceso
 * Ruta: src/lib/auth/types.ts
 * Autor: Felix Echavarria
 * Fecha: 2026-08-03
 *
 * Descripción:
 * Define la estructura utilizada para guardar y administrar las
 * solicitudes de acceso de usuarios que iniciaron sesión con Google,
 * pero todavía no han sido autorizados para entrar a la aplicación.
 */

/**
 * Representa las decisiones posibles para una solicitud de acceso.
 *
 * La solicitud comienza como pendiente y posteriormente el
 * administrador puede aprobarla o rechazarla.
 */
export type EstadoSolicitudAcceso =
  | "pendiente"
  | "aprobada"
  | "rechazada";

/**
 * Representa una solicitud de acceso almacenada en Firestore.
 *
 * Conserva la información pública recibida de Google, el estado
 * administrativo y los campos usados para controlar el envío del
 * correo sin generar notificaciones duplicadas.
 */
export interface SolicitudAcceso {
  uid: string;
  nombre: string;
  email: string;
  fotoUrl: string | null;

  estado:
    EstadoSolicitudAcceso;

  solicitadoEn: string;
  actualizadoEn: string;

  revisadoEn:
    string | null;

  revisadoPor:
    string | null;

  correoNotificacionEnviado:
    boolean;

  correoNotificacionEnviadoEn:
    string | null;
}

/**
 * Contiene los datos que el navegador puede registrar cuando una
 * cuenta autenticada todavía no aparece en allowedUsers.
 *
 * Inicializa los campos administrativos en null y el indicador de
 * correo en false. Después de crearla, el navegador no debe modificar
 * esos campos; la aprobación y la notificación se manejarán aparte.
 */
export type NuevaSolicitudAcceso =
  SolicitudAcceso;