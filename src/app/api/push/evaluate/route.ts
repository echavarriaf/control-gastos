import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

import {
  evaluarAlertasUsuario,
} from "@/lib/push/evaluate-user-alerts";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  30;

/**
 * ============================================================
 * POST
 * ============================================================
 *
 * Evaluación solicitada desde el navegador.
 *
 * El UID nunca se recibe mediante body/query.
 * Se obtiene exclusivamente del Firebase ID Token.
 */
export async function POST(
  request:
    NextRequest,
): Promise<NextResponse> {
  if (
    !esSolicitudPermitida(
      request,
    )
  ) {
    return json(
      {
        ok: false,

        error:
          "Solicitud no permitida.",
      },
      403,
    );
  }

  const autorizacion =
    await autorizarSolicitud(
      request,
    );

  if (
    "response" in
    autorizacion
  ) {
    return autorizacion
      .response;
  }

  try {
    const resultado =
      await evaluarAlertasUsuario(
        autorizacion.uid,
      );

    return json({
      ok: true,

      ...resultado,
    });
  } catch (
    error
  ) {
    console.error(
      "No se pudieron evaluar las alertas:",
      error,
    );

    return json(
      {
        ok: false,

        error:
          "No se pudieron evaluar las alertas.",

        detalle:
          process.env
            .NODE_ENV ===
          "development"
            ? obtenerMensajeError(
                error,
              )
            : undefined,
      },
      500,
    );
  }
}

/**
 * Este endpoint no es el cron.
 *
 * GET permanece deshabilitado para impedir que una
 * visita normal produzca notificaciones.
 */
export async function GET():
  Promise<NextResponse> {
  return json(
    {
      ok: false,

      error:
        "Método no permitido.",
    },
    405,
    {
      Allow:
        "POST",
    },
  );
}

/**
 * ============================================================
 * AUTORIZACIÓN DEL USUARIO
 * ============================================================
 */

type ResultadoAutorizacion =
  | {
      ok: true;
      uid: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

async function autorizarSolicitud(
  request:
    NextRequest,
): Promise<ResultadoAutorizacion> {
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

      response:
        json(
          {
            ok: false,

            error:
              "Se requiere autenticación.",
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

  if (
    !idToken
  ) {
    return {
      ok: false,

      response:
        json(
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

    const authorized =
      authorizationSnapshot
        .exists &&
      authorizationSnapshot
        .data()
        ?.activo ===
        true;

    if (
      !authorized
    ) {
      return {
        ok: false,

        response:
          json(
            {
              ok: false,

              error:
                "Esta cuenta no tiene acceso a la evaluación de alertas.",
            },
            403,
          ),
      };
    }

    return {
      ok:
        true,

      uid:
        decodedToken.uid,
    };
  } catch (
    error
  ) {
    console.warn(
      "Token Firebase inválido o revocado:",
      obtenerMensajeError(
        error,
      ),
    );

    return {
      ok: false,

      response:
        json(
          {
            ok: false,

            error:
              "La sesión no es válida o expiró.",
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
 * Acepta el POST del navegador únicamente desde
 * el mismo sitio de la aplicación.
 */
function esSolicitudPermitida(
  request:
    NextRequest,
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

  if (
    !origin
  ) {
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
  referer:
    string | null,
): string | null {
  if (
    !referer
  ) {
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
  value:
    string | undefined,
): string | null {
  if (
    !value
  ) {
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

function obtenerMensajeError(
  error:
    unknown,
): string {
  return error instanceof
    Error
    ? error.message
    : "Error desconocido.";
}

function json(
  body:
    Record<
      string,
      unknown
    >,

  status =
    200,

  headers?:
    Record<
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