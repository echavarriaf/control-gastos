import {
  FieldValue,
  type DocumentData,
} from "firebase-admin/firestore";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  autorizarAdministrador,
  type AdministradorAutorizado,
} from "@/lib/auth/admin-server";

import {
  esAccionSolicitudAcceso,
  esEstadoSolicitudAcceso,
  esRolUsuario,
  type AccionSolicitudAcceso,
  type EstadoSolicitudAcceso,
  type SolicitudAcceso,
  type RolUsuario,
} from "@/lib/auth/types";

import {
  getAdminDb,
} from "@/lib/firebase-admin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  30;

const ACCESS_REQUESTS_COLLECTION =
  "accessRequests";

const ALLOWED_USERS_COLLECTION =
  "allowedUsers";

const USERS_COLLECTION =
  "users";

class AdminRequestError extends Error {
  status: number;

  constructor(
    status: number,
    message: string,
  ) {
    super(message);

    this.name =
      "AdminRequestError";

    this.status =
      status;
  }
}

/**
 * Lista las solicitudes de acceso.
 *
 * Ejemplos:
 *
 * /api/admin/access-requests
 * /api/admin/access-requests?estado=pendiente
 * /api/admin/access-requests?estado=aprobada
 * /api/admin/access-requests?estado=rechazada
 * /api/admin/access-requests?estado=todas
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const autorizacion =
    await autorizarAdministrador(
      request,
    );

  if (!autorizacion.ok) {
    return autorizacion.response;
  }

  const estadoSolicitado =
    obtenerEstadoFiltro(
      request,
    );

  if (
    estadoSolicitado ===
    "invalido"
  ) {
    return respuestaJson(
      {
        ok: false,

        error:
          "El filtro estado no es válido.",
      },
      400,
    );
  }

  try {
    const snapshot =
      await getAdminDb()
        .collection(
          ACCESS_REQUESTS_COLLECTION,
        )
        .get();

    const solicitudes =
      snapshot.docs
        .flatMap(
          (
            documento,
          ) => {
            const solicitud =
              normalizarSolicitud(
                documento.id,
                documento.data(),
              );

            return solicitud
              ? [
                  solicitud,
                ]
              : [];
          },
        )
        .filter(
          (
            solicitud,
          ) =>
            estadoSolicitado ===
              "todas" ||
            solicitud.estado ===
              estadoSolicitado,
        )
        .sort(
          (
            a,
            b,
          ) =>
            b.solicitadoEn.localeCompare(
              a.solicitadoEn,
            ),
        );

    return respuestaJson({
      ok: true,

      admin: {
        uid:
          autorizacion
            .admin.uid,

        nombre:
          autorizacion
            .admin.nombre,
      },

      estado:
        estadoSolicitado,

      total:
        solicitudes.length,

      solicitudes,
    });
  } catch (
    error
  ) {
    console.error(
      "No se pudieron listar las solicitudes de acceso:",
      error,
    );

    return respuestaJson(
      {
        ok: false,

        error:
          "No se pudieron cargar las solicitudes de acceso.",
      },
      500,
    );
  }
}

/**
 * Revisa una solicitud.
 *
 * Body:
 *
 * {
 *   "accion": "aprobar",
 *   "uid": "UID"
 * }
 *
 * o:
 *
 * {
 *   "accion": "rechazar",
 *   "uid": "UID"
 * }
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const autorizacion =
    await autorizarAdministrador(
      request,
    );

  if (!autorizacion.ok) {
    return autorizacion.response;
  }

  const body =
    await leerJson(
      request,
    );

  if (!body) {
    return respuestaJson(
      {
        ok: false,

        error:
          "El cuerpo de la solicitud no es JSON válido.",
      },
      400,
    );
  }

  const accion =
    body.accion;

  const uid =
    normalizarUid(
      body.uid,
    );

  if (
    !esAccionSolicitudAcceso(
      accion,
    )
  ) {
    return respuestaJson(
      {
        ok: false,

        error:
          "La acción administrativa no es válida.",
      },
      400,
    );
  }

  if (!uid) {
    return respuestaJson(
      {
        ok: false,

        error:
          "Se requiere un UID válido.",
      },
      400,
    );
  }

  if (
    uid ===
    autorizacion.admin.uid
  ) {
    return respuestaJson(
      {
        ok: false,

        error:
          "Un administrador no puede revisar su propia solicitud desde esta ruta.",
      },
      409,
    );
  }

  try {
    const resultado =
      await revisarSolicitud({
        admin:
          autorizacion.admin,

        accion,

        uid,
      });

    return respuestaJson({
      ok: true,

      ...resultado,
    });
  } catch (
    error
  ) {
    if (
      error instanceof
      AdminRequestError
    ) {
      return respuestaJson(
        {
          ok: false,

          error:
            error.message,
        },
        error.status,
      );
    }

    console.error(
      "No se pudo revisar la solicitud de acceso:",
      error,
    );

    return respuestaJson(
      {
        ok: false,

        error:
          "No se pudo completar la revisión de la solicitud.",
      },
      500,
    );
  }
}

interface RevisarSolicitudArgs {
  admin:
    AdministradorAutorizado;

  accion:
    AccionSolicitudAcceso;

  uid:
    string;
}

interface ResultadoRevision {
  accion:
    AccionSolicitudAcceso;

  solicitud:
    SolicitudAcceso;

  usuarioAutorizado:
    boolean;

  usuarioPresupuestoCreado:
    boolean;
}

async function revisarSolicitud({
  admin,
  accion,
  uid,
}: RevisarSolicitudArgs): Promise<
  ResultadoRevision
> {
  const db =
    getAdminDb();

  const requestRef =
    db
      .collection(
        ACCESS_REQUESTS_COLLECTION,
      )
      .doc(
        uid,
      );

  const allowedUserRef =
    db
      .collection(
        ALLOWED_USERS_COLLECTION,
      )
      .doc(
        uid,
      );

  const userRef =
    db
      .collection(
        USERS_COLLECTION,
      )
      .doc(
        uid,
      );

  return db.runTransaction(
    async (
      transaction,
    ) => {
      const requestSnapshot =
        await transaction.get(
          requestRef,
        );

      const allowedUserSnapshot =
        await transaction.get(
          allowedUserRef,
        );

      const userSnapshot =
        await transaction.get(
          userRef,
        );

      if (
        !requestSnapshot.exists
      ) {
        throw new AdminRequestError(
          404,

          "No se encontró la solicitud de acceso.",
        );
      }

      /*
       * Firebase Admin tipa data() como:
       *
       * DocumentData | undefined
       *
       * incluso después de comprobar snapshot.exists.
       * Por eso hacemos esta validación explícita.
       */
      const requestData =
        requestSnapshot.data();

      if (!requestData) {
        throw new AdminRequestError(
          422,

          "La solicitud de acceso no contiene datos.",
        );
      }

      const solicitud =
        normalizarSolicitud(
          requestSnapshot.id,
          requestData,
        );

      if (!solicitud) {
        throw new AdminRequestError(
          422,

          "La solicitud de acceso tiene datos inválidos.",
        );
      }

      /*
       * =====================================================
       * RECHAZAR
       * =====================================================
       */
      if (
        accion ===
        "rechazar"
      ) {
        if (
          allowedUserSnapshot
            .exists &&
          allowedUserSnapshot
            .data()
            ?.activo ===
            true
        ) {
          throw new AdminRequestError(
            409,

            "El usuario ya tiene acceso activo. La desactivación se manejará desde la administración de usuarios.",
          );
        }

        const solicitudActualizada =
          construirSolicitudRevisada(
            solicitud,
            "rechazada",
            admin.uid,
          );

        transaction.set(
          requestRef,
          solicitudActualizada,
          {
            merge:
              true,
          },
        );

        return {
          accion,

          solicitud:
            solicitudActualizada,

          usuarioAutorizado:
            false,

          usuarioPresupuestoCreado:
            false,
        };
      }

      /*
       * =====================================================
       * APROBAR
       * =====================================================
       */
      const solicitudActualizada =
        construirSolicitudRevisada(
          solicitud,
          "aprobada",
          admin.uid,
        );

      const allowedUserData =
        allowedUserSnapshot.data();

      const rolExistente =
        allowedUserData?.rol;

      /*
       * Si el usuario ya fuera admin por alguna razón,
       * nunca degradamos automáticamente su rol.
       *
       * Para cualquier cuenta nueva:
       * rol = usuario.
       */
      const rolDestino:
        RolUsuario =
        esRolUsuario(
          rolExistente,
        ) &&
        rolExistente ===
          "admin"
          ? "admin"
          : "usuario";

      const allowedPayload:
        Record<
          string,
          unknown
        > = {
          uid,

          activo:
            true,

          rol:
            rolDestino,

          nombre:
            solicitud.nombre,

          email:
            solicitud.email,

          fotoUrl:
            solicitud.fotoUrl,

          actualizadoEn:
            FieldValue
              .serverTimestamp(),

          autorizadoPor:
            admin.uid,
        };

      /*
       * autorizadoEn representa la primera autorización.
       * No queremos reemplazarla en futuras reactivaciones.
       */
      if (
        !allowedUserSnapshot
          .exists ||
        !allowedUserData
          ?.autorizadoEn
      ) {
        allowedPayload
          .autorizadoEn =
          FieldValue
            .serverTimestamp();
      }

      transaction.set(
        allowedUserRef,
        allowedPayload,
        {
          merge:
            true,
        },
      );

      /*
       * =====================================================
       * USER ROOT
       * =====================================================
       */

      const usuarioPresupuestoCreado =
        !userSnapshot.exists;

      if (
        usuarioPresupuestoCreado
      ) {
        transaction.set(
          userRef,
          {
            uid,

            nombre:
              solicitud.nombre,

            email:
              solicitud.email,

            fotoUrl:
              solicitud.fotoUrl,

            presupuestoInicializado:
              false,

            migracionLegacy:
              false,

            creadoEn:
              FieldValue
                .serverTimestamp(),

            actualizadoEn:
              FieldValue
                .serverTimestamp(),
          },
        );
      } else {
        /*
         * Si ya existiera el root por una migración o proceso
         * anterior, preservamos los campos financieros/metadatos.
         */
        transaction.set(
          userRef,
          {
            uid,

            nombre:
              solicitud.nombre,

            email:
              solicitud.email,

            fotoUrl:
              solicitud.fotoUrl,

            actualizadoEn:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge:
              true,
          },
        );
      }

      /*
       * =====================================================
       * ACCESS REQUEST
       * =====================================================
       */

      transaction.set(
        requestRef,
        solicitudActualizada,
        {
          merge:
            true,
        },
      );

      return {
        accion,

        solicitud:
          solicitudActualizada,

        usuarioAutorizado:
          true,

        usuarioPresupuestoCreado,
      };
    },
  );
}

function construirSolicitudRevisada(
  solicitud:
    SolicitudAcceso,

  estado:
    Extract<
      EstadoSolicitudAcceso,
      "aprobada" |
        "rechazada"
    >,

  adminUid:
    string,
): SolicitudAcceso {
  const ahora =
    new Date()
      .toISOString();

  return {
    ...solicitud,

    estado,

    actualizadoEn:
      ahora,

    revisadoEn:
      ahora,

    revisadoPor:
      adminUid,
  };
}

function normalizarSolicitud(
  documentId:
    string,

  data:
    DocumentData,
): SolicitudAcceso | null {
  const uid =
    normalizarUid(
      data.uid,
    );

  const nombre =
    normalizarTexto(
      data.nombre,
    );

  const email =
    normalizarTexto(
      data.email,
    )
      .toLowerCase();

  const fotoUrl =
    normalizarTextoONull(
      data.fotoUrl,
    );

  const estado =
    data.estado;

  const solicitadoEn =
    normalizarTexto(
      data.solicitadoEn,
    );

  const actualizadoEn =
    normalizarTexto(
      data.actualizadoEn,
    );

  const revisadoEn =
    normalizarTextoONull(
      data.revisadoEn,
    );

  const revisadoPor =
    normalizarTextoONull(
      data.revisadoPor,
    );

  const correoNotificacionEnviado =
    data
      .correoNotificacionEnviado;

  const correoNotificacionEnviadoEn =
    normalizarTextoONull(
      data
        .correoNotificacionEnviadoEn,
    );

  if (
    !uid ||
    uid !== documentId ||
    !nombre ||
    !email ||
    !esEstadoSolicitudAcceso(
      estado,
    ) ||
    !solicitadoEn ||
    !actualizadoEn ||
    typeof correoNotificacionEnviado !==
      "boolean"
  ) {
    return null;
  }

  return {
    uid,

    nombre,

    email,

    fotoUrl,

    estado,

    solicitadoEn,

    actualizadoEn,

    revisadoEn,

    revisadoPor,

    correoNotificacionEnviado,

    correoNotificacionEnviadoEn,
  };
}

function obtenerEstadoFiltro(
  request:
    NextRequest,
):
  | EstadoSolicitudAcceso
  | "todas"
  | "invalido" {
  const value =
    new URL(
      request.url,
    )
      .searchParams
      .get(
        "estado",
      ) ??
    "pendiente";

  if (
    value ===
    "todas"
  ) {
    return "todas";
  }

  return esEstadoSolicitudAcceso(
    value,
  )
    ? value
    : "invalido";
}

async function leerJson(
  request:
    NextRequest,
): Promise<
  Record<
    string,
    unknown
  > | null
> {
  try {
    const value =
      await request.json();

    return esObjeto(
      value,
    )
      ? value
      : null;
  } catch {
    return null;
  }
}

function normalizarUid(
  value:
    unknown,
): string {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  const uid =
    value.trim();

  if (
    uid.length < 1 ||
    uid.length > 128
  ) {
    return "";
  }

  return uid;
}

function normalizarTexto(
  value:
    unknown,
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function normalizarTextoONull(
  value:
    unknown,
): string | null {
  if (
    value == null
  ) {
    return null;
  }

  const text =
    normalizarTexto(
      value,
    );

  return text ||
    null;
}

function esObjeto(
  value:
    unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null
  );
}

function respuestaJson(
  body:
    Record<
      string,
      unknown
    >,

  status =
    200,
): NextResponse {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    },
  );
}