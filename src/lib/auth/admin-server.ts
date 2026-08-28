import "server-only";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

import {
  esRolUsuario,
  type RolUsuario,
} from "@/lib/auth/types";

export interface AdministradorAutorizado {
  uid: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
}

export type ResultadoAutorizacionAdmin =
  | {
      ok: true;
      admin: AdministradorAutorizado;
    }
  | {
      ok: false;
      response: NextResponse;
    };

/**
 * Verifica una solicitud administrativa completa.
 *
 * Requisitos:
 * - mismo origen que la aplicación;
 * - Firebase ID Token válido y no revocado;
 * - allowedUsers/{uid}.activo === true;
 * - allowedUsers/{uid}.rol === "admin".
 *
 * El rol se consulta en Firestore en cada llamada para que una
 * desactivación o cambio de privilegios tenga efecto inmediatamente.
 */
export async function autorizarAdministrador(
  request: NextRequest,
): Promise<ResultadoAutorizacionAdmin> {
  if (!esSolicitudPermitida(request)) {
    return {
      ok: false,
      response: respuestaJson(
        {
          ok: false,
          error:
            "Solicitud administrativa no permitida.",
        },
        403,
      ),
    };
  }

  const authorizationHeader =
    request.headers.get(
      "authorization",
    );

  if (
    !authorizationHeader
      ?.startsWith(
        "Bearer ",
      )
  ) {
    return {
      ok: false,
      response: respuestaJson(
        {
          ok: false,
          error:
            "Se requiere autenticación administrativa.",
        },
        401,
        {
          "WWW-Authenticate":
            "Bearer",
        },
      ),
    };
  }

  const idToken =
    authorizationHeader
      .slice(
        "Bearer ".length,
      )
      .trim();

  if (!idToken) {
    return {
      ok: false,
      response: respuestaJson(
        {
          ok: false,
          error:
            "El token de autenticación está vacío.",
        },
        401,
        {
          "WWW-Authenticate":
            "Bearer",
        },
      ),
    };
  }

  try {
    const decodedToken =
      await getAdminAuth()
        .verifyIdToken(
          idToken,
          true,
        );

    const authorizationSnapshot =
      await getAdminDb()
        .collection(
          "allowedUsers",
        )
        .doc(
          decodedToken.uid,
        )
        .get();

    if (
      !authorizationSnapshot.exists
    ) {
      return {
        ok: false,
        response: respuestaJson(
          {
            ok: false,
            error:
              "La cuenta no está autorizada.",
          },
          403,
        ),
      };
    }

    const authorizationData =
      authorizationSnapshot.data();

    const rol =
      authorizationData?.rol;

    if (
      authorizationData?.activo !==
        true ||
      !esRolUsuario(rol) ||
      rol !== "admin"
    ) {
      return {
        ok: false,
        response: respuestaJson(
          {
            ok: false,
            error:
              "Se requieren permisos de administrador.",
          },
          403,
        ),
      };
    }

    return {
      ok: true,
      admin: {
        uid:
          decodedToken.uid,

        email:
          normalizarTexto(
            authorizationData
              ?.email,
          ) ||
          decodedToken.email ||
          "",

        nombre:
          normalizarTexto(
            authorizationData
              ?.nombre,
          ) ||
          decodedToken.name ||
          "Administrador",

        rol,
      },
    };
  } catch (error) {
    console.warn(
      "No se pudo autorizar la solicitud administrativa:",
      obtenerMensajeError(
        error,
      ),
    );

    return {
      ok: false,
      response: respuestaJson(
        {
          ok: false,
          error:
            "La sesión administrativa no es válida o expiró.",
        },
        401,
        {
          "WWW-Authenticate":
            "Bearer",
        },
      ),
    };
  }
}

/**
 * Protege las rutas administrativas contra llamadas desde otro origen.
 *
 * El Bearer token ya evita CSRF tradicional, pero conservar la misma
 * política de origen usada por las otras rutas sensibles reduce aún
 * más la superficie de ataque.
 */
function esSolicitudPermitida(
  request: NextRequest,
): boolean {
  const requestOrigin =
    new URL(
      request.url,
    ).origin;

  const origin =
    request.headers.get(
      "origin",
    ) ??
    obtenerOriginDesdeReferer(
      request.headers.get(
        "referer",
      ),
    );

  if (!origin) {
    return false;
  }

  const configuredOrigin =
    normalizarOrigin(
      process.env
        .NEXT_PUBLIC_APP_URL,
    );

  const allowedOrigins =
    new Set(
      [
        requestOrigin,
        configuredOrigin,
      ].filter(
        (
          value,
        ): value is string =>
          Boolean(
            value,
          ),
      ),
    );

  if (
    !allowedOrigins.has(
      origin,
    )
  ) {
    return false;
  }

  const fetchSite =
    request.headers.get(
      "sec-fetch-site",
    );

  return (
    !fetchSite ||
    fetchSite ===
      "same-origin" ||
    fetchSite ===
      "same-site" ||
    fetchSite ===
      "none"
  );
}

function obtenerOriginDesdeReferer(
  referer: string | null,
): string | null {
  if (!referer) {
    return null;
  }

  try {
    return new URL(
      referer,
    ).origin;
  } catch {
    return null;
  }
}

function normalizarOrigin(
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(
      value,
    ).origin;
  } catch {
    return null;
  }
}

function normalizarTexto(
  value: unknown,
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function obtenerMensajeError(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Error desconocido.";
}

function respuestaJson(
  body: Record<
    string,
    unknown
  >,
  status = 200,
  headers?: Record<
    string,
    string
  >,
): NextResponse {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
        ...headers,
      },
    },
  );
}