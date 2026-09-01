import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  autorizarAdministrador,
} from "@/lib/auth/admin-server";

import {
  esRolUsuario,
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

const ALLOWED_USERS_COLLECTION =
  "allowedUsers";

type AccionUsuarioAdmin =
  | "activar"
  | "desactivar";

interface UsuarioAdministrado {
  uid: string;
  nombre: string;
  email: string;
  fotoUrl: string | null;

  activo: boolean;
  rol: RolUsuario;

  autorizadoEn: string | null;
  actualizadoEn: string | null;

  administradorDesde:
    string | null;

  desactivadoEn:
    string | null;

  desactivadoPor:
    string | null;

  reactivadoEn:
    string | null;

  reactivadoPor:
    string | null;
}

class AdminUsersError extends Error {
  status: number;

  constructor(
    status: number,
    message: string,
  ) {
    super(
      message,
    );

    this.name =
      "AdminUsersError";

    this.status =
      status;
  }
}

/**
 * Lista todos los usuarios autorizados.
 *
 * El cliente nunca lista allowedUsers directamente
 * desde Firestore.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const autorizacion =
    await autorizarAdministrador(
      request,
    );

  if (
    !autorizacion.ok
  ) {
    return autorizacion.response;
  }

  try {
    const snapshot =
      await getAdminDb()
        .collection(
          ALLOWED_USERS_COLLECTION,
        )
        .get();

    const usuarios =
      snapshot.docs
        .map(
          (
            documento,
          ) =>
            normalizarUsuario(
              documento.id,
              documento.data(),
            ),
        )
        .sort(
          (
            a,
            b,
          ) => {
            if (
              a.activo !==
              b.activo
            ) {
              return a.activo
                ? -1
                : 1;
            }

            if (
              a.rol !==
              b.rol
            ) {
              return a.rol ===
                "admin"
                ? -1
                : 1;
            }

            return a.nombre.localeCompare(
              b.nombre,
              "es",
              {
                sensitivity:
                  "base",
              },
            );
          },
        );

    return respuestaJson({
      ok:
        true,

      total:
        usuarios.length,

      activos:
        usuarios.filter(
          (
            usuario,
          ) =>
            usuario.activo,
        ).length,

      desactivados:
        usuarios.filter(
          (
            usuario,
          ) =>
            !usuario.activo,
        ).length,

      administradores:
        usuarios.filter(
          (
            usuario,
          ) =>
            usuario.rol ===
            "admin",
        ).length,

      usuarios,
    });
  } catch (
    error
  ) {
    console.error(
      "No se pudieron listar los usuarios autorizados:",
      error,
    );

    return respuestaJson(
      {
        ok:
          false,

        error:
          "No se pudieron cargar los usuarios autorizados.",
      },
      500,
    );
  }
}

/**
 * Activa o desactiva una cuenta ya autorizada.
 *
 * Body:
 *
 * {
 *   "accion": "activar" | "desactivar",
 *   "uid": "UID"
 * }
 *
 * Nunca elimina users/{uid} ni sus subcolecciones.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const autorizacion =
    await autorizarAdministrador(
      request,
    );

  if (
    !autorizacion.ok
  ) {
    return autorizacion.response;
  }

  const body =
    await leerJson(
      request,
    );

  if (
    !body
  ) {
    return respuestaJson(
      {
        ok:
          false,

        error:
          "El cuerpo de la solicitud no es JSON válido.",
      },
      400,
    );
  }

  const uid =
    normalizarUid(
      body.uid,
    );

  const accion =
    normalizarAccion(
      body.accion,
    );

  if (
    !uid
  ) {
    return respuestaJson(
      {
        ok:
          false,

        error:
          "Se requiere un UID válido.",
      },
      400,
    );
  }

  if (
    !accion
  ) {
    return respuestaJson(
      {
        ok:
          false,

        error:
          "La acción administrativa no es válida.",
      },
      400,
    );
  }

  /*
   * Protección adicional:
   *
   * el administrador no puede quitarse a sí mismo
   * el acceso desde esta ruta.
   */
  if (
    accion ===
      "desactivar" &&
    uid ===
      autorizacion
        .admin
        .uid
  ) {
    return respuestaJson(
      {
        ok:
          false,

        error:
          "No puedes desactivar tu propia cuenta administrativa.",
      },
      409,
    );
  }

  try {
    const usuario =
      await actualizarEstadoUsuario({
        uid,

        accion,

        adminUid:
          autorizacion
            .admin
            .uid,
      });

    return respuestaJson({
      ok:
        true,

      accion,

      usuario,
    });
  } catch (
    error
  ) {
    if (
      error instanceof
      AdminUsersError
    ) {
      return respuestaJson(
        {
          ok:
            false,

          error:
            error.message,
        },
        error.status,
      );
    }

    console.error(
      "No se pudo actualizar el acceso del usuario:",
      error,
    );

    return respuestaJson(
      {
        ok:
          false,

        error:
          "No se pudo actualizar el acceso del usuario.",
      },
      500,
    );
  }
}

interface ActualizarEstadoUsuarioArgs {
  uid: string;

  accion:
    AccionUsuarioAdmin;

  adminUid:
    string;
}

async function actualizarEstadoUsuario({
  uid,
  accion,
  adminUid,
}: ActualizarEstadoUsuarioArgs): Promise<
  UsuarioAdministrado
> {
  const db =
    getAdminDb();

  const referencia =
    db
      .collection(
        ALLOWED_USERS_COLLECTION,
      )
      .doc(
        uid,
      );

  return db.runTransaction(
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          referencia,
        );

      if (
        !snapshot.exists
      ) {
        throw new AdminUsersError(
          404,
          "No se encontró el usuario autorizado.",
        );
      }

      const data =
        snapshot.data();

      if (
        !data
      ) {
        throw new AdminUsersError(
          422,
          "El documento del usuario no contiene datos.",
        );
      }

      const usuarioActual =
        normalizarUsuario(
          snapshot.id,
          data,
        );

      const activar =
        accion ===
        "activar";

      /*
       * Idempotencia:
       *
       * si ya está en el estado solicitado,
       * devolvemos el usuario sin fallar.
       */
      if (
        usuarioActual.activo ===
        activar
      ) {
        return usuarioActual;
      }

      const cambios:
        Record<
          string,
          unknown
        > = {
          activo:
            activar,

          actualizadoEn:
            FieldValue
              .serverTimestamp(),
        };

      if (
        activar
      ) {
        cambios.reactivadoEn =
          FieldValue
            .serverTimestamp();

        cambios.reactivadoPor =
          adminUid;
      } else {
        cambios.desactivadoEn =
          FieldValue
            .serverTimestamp();

        cambios.desactivadoPor =
          adminUid;
      }

      transaction.set(
        referencia,
        cambios,
        {
          merge:
            true,
        },
      );

      const ahora =
        new Date()
          .toISOString();

      return {
        ...usuarioActual,

        activo:
          activar,

        actualizadoEn:
          ahora,

        desactivadoEn:
          activar
            ? usuarioActual
                .desactivadoEn
            : ahora,

        desactivadoPor:
          activar
            ? usuarioActual
                .desactivadoPor
            : adminUid,

        reactivadoEn:
          activar
            ? ahora
            : usuarioActual
                .reactivadoEn,

        reactivadoPor:
          activar
            ? adminUid
            : usuarioActual
                .reactivadoPor,
      };
    },
  );
}

function normalizarUsuario(
  documentId:
    string,

  data:
    DocumentData,
): UsuarioAdministrado {
  const uidGuardado =
    normalizarUid(
      data.uid,
    );

  const rol:
    RolUsuario =
    esRolUsuario(
      data.rol,
    )
      ? data.rol
      : "usuario";

  return {
    uid:
      uidGuardado ||
      documentId,

    nombre:
      normalizarTexto(
        data.nombre,
      ) ||
      normalizarTexto(
        data.displayName,
      ) ||
      "Usuario",

    email:
      normalizarTexto(
        data.email,
      )
        .toLowerCase(),

    fotoUrl:
      normalizarTextoONull(
        data.fotoUrl,
      ),

    activo:
      data.activo ===
      true,

    rol,

    autorizadoEn:
      normalizarFecha(
        data.autorizadoEn,
      ),

    actualizadoEn:
      normalizarFecha(
        data.actualizadoEn,
      ),

    administradorDesde:
      normalizarFecha(
        data.administradorDesde,
      ),

    desactivadoEn:
      normalizarFecha(
        data.desactivadoEn,
      ),

    desactivadoPor:
      normalizarTextoONull(
        data.desactivadoPor,
      ),

    reactivadoEn:
      normalizarFecha(
        data.reactivadoEn,
      ),

    reactivadoPor:
      normalizarTextoONull(
        data.reactivadoPor,
      ),
  };
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

function normalizarAccion(
  value:
    unknown,
):
  | AccionUsuarioAdmin
  | null {
  return (
    value ===
      "activar" ||
    value ===
      "desactivar"
  )
    ? value
    : null;
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

  return (
    uid.length >= 1 &&
    uid.length <= 128
  )
    ? uid
    : "";
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
  const text =
    normalizarTexto(
      value,
    );

  return text ||
    null;
}

function normalizarFecha(
  value:
    unknown,
): string | null {
  if (
    value instanceof
    Timestamp
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (
    value instanceof
    Date
  ) {
    return Number.isNaN(
      value.getTime(),
    )
      ? null
      : value.toISOString();
  }

  if (
    typeof value ===
      "string" &&
    value.trim()
  ) {
    const fecha =
      new Date(
        value,
      );

    return Number.isNaN(
      fecha.getTime(),
    )
      ? value.trim()
      : fecha.toISOString();
  }

  return null;
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