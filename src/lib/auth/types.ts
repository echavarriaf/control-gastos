/*
 * Nombre: Tipos de autenticación y solicitudes de acceso
 * Ruta: src/lib/auth/types.ts
 * Autor: Felix Echavarria
 * Fecha: 2026-08-18
 *
 * Descripción:
 * Define los roles de la aplicación, la estructura de autorización
 * y las solicitudes de acceso creadas por cuentas autenticadas que
 * todavía no han sido aprobadas por un administrador.
 */

/**
 * Roles soportados por la aplicación.
 *
 * - admin: puede utilizar las rutas administrativas del servidor.
 * - usuario: puede utilizar únicamente su propio presupuesto.
 */
export type RolUsuario =
  | "admin"
  | "usuario";

/**
 * Acciones administrativas disponibles para revisar solicitudes.
 */
export type AccionSolicitudAcceso =
  | "aprobar"
  | "rechazar";

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
 * esos campos; la aprobación y la notificación se manejan en servidor.
 */
export type NuevaSolicitudAcceso =
  SolicitudAcceso;

/**
 * Representa la parte estable de un documento de allowedUsers.
 *
 * Los timestamps administrativos se mantienen fuera de esta interfaz
 * porque el servidor los almacena como timestamps nativos de Firestore.
 */
export interface UsuarioAutorizado {
  uid: string;
  activo: boolean;
  rol: RolUsuario;
  nombre: string;
  email: string;
  fotoUrl: string | null;
}

export function esRolUsuario(
  value: unknown,
): value is RolUsuario {
  return (
    value === "admin" ||
    value === "usuario"
  );
}

export function esAccionSolicitudAcceso(
  value: unknown,
): value is AccionSolicitudAcceso {
  return (
    value === "aprobar" ||
    value === "rechazar"
  );
}

export function esEstadoSolicitudAcceso(
  value: unknown,
): value is EstadoSolicitudAcceso {
  return (
    value === "pendiente" ||
    value === "aprobada" ||
    value === "rechazada"
  );
}