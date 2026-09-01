import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAdminDb,
} from "@/lib/firebase-admin";

import {
  evaluarAlertasUsuario,
  type EvaluacionAlertasUsuarioResultado,
} from "@/lib/push/evaluate-user-alerts";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

const CONCURRENCIA_USUARIOS =
  3;

interface ResultadoUsuarioCron {
  ok:
    boolean;

  resultado?:
    EvaluacionAlertasUsuarioResultado;

  error?:
    string;
}

/**
 * ============================================================
 * GET
 * ============================================================
 *
 * Vercel Cron ejecuta este endpoint automáticamente.
 *
 * Seguridad:
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * No acepta:
 *
 * - UID por query;
 * - UID por body;
 * - usuario seleccionado por cliente.
 *
 * Siempre obtiene la lista desde allowedUsers.
 */
export async function GET(
  request:
    NextRequest,
): Promise<NextResponse> {
  if (
    !cronAutorizado(
      request,
    )
  ) {
    return json(
      {
        ok: false,

        error:
          "Cron no autorizado.",
      },
      401,
    );
  }

  const inicio =
    Date.now();

  try {
    const usuarios =
      await obtenerUsuariosActivos();

    if (
      usuarios.length ===
      0
    ) {
      return json({
        ok: true,

        usuariosActivos:
          0,

        usuariosEvaluados:
          0,

        usuariosCorrectos:
          0,

        usuariosFallidos:
          0,

        alertas:
          0,

        alertasTarjetas:
          0,

        enviadas:
          0,

        fallidas:
          0,

        duracionMs:
          Date.now() -
          inicio,

        mensaje:
          "No existen usuarios activos.",
      });
    }

    /**
     * Todos los usuarios usan la misma referencia temporal
     * para que una ejecución de cron sea consistente.
     */
    const ahora =
      new Date();

    const resultados =
      await procesarEnLotes(
        usuarios,
        CONCURRENCIA_USUARIOS,
        async (
          uid,
        ): Promise<ResultadoUsuarioCron> => {
          try {
            const resultado =
              await evaluarAlertasUsuario(
                uid,
                ahora,
              );

            return {
              ok:
                true,

              resultado,
            };
          } catch (
            error
          ) {
            console.error(
              "Falló la evaluación automática de un usuario:",
              {
                uid,

                error,
              },
            );

            return {
              ok:
                false,

              error:
                obtenerMensajeError(
                  error,
                ),
            };
          }
        },
      );

    const correctos =
      resultados.filter(
        (
          item,
        ) =>
          item.ok,
      );

    const fallidos =
      resultados.filter(
        (
          item,
        ) =>
          !item.ok,
      );

    const evaluaciones =
      correctos.flatMap(
        (
          item,
        ) =>
          item.resultado
            ? [
                item.resultado,
              ]
            : [],
      );

    const totalAlertas =
      sumar(
        evaluaciones.map(
          (
            item,
          ) =>
            item.alertas,
        ),
      );

    const totalAlertasTarjetas =
      sumar(
        evaluaciones.map(
          (
            item,
          ) =>
            item.alertasTarjetas,
        ),
      );

    const totalEnviadas =
      sumar(
        evaluaciones.map(
          (
            item,
          ) =>
            item.enviadas,
        ),
      );

    const totalFallidas =
      sumar(
        evaluaciones.map(
          (
            item,
          ) =>
            item.fallidas,
        ),
      );

    /**
     * Si absolutamente todos los usuarios fallaron,
     * marcamos la función como error.
     *
     * Si algunos funcionaron, reportamos éxito parcial
     * para no perder el trabajo ya realizado.
     */
    const status =
      correctos.length ===
        0 &&
      fallidos.length >
        0
        ? 500
        : 200;

    return json(
      {
        ok:
          fallidos.length ===
          0,

        parcial:
          correctos.length >
            0 &&
          fallidos.length >
            0,

        usuariosActivos:
          usuarios.length,

        usuariosEvaluados:
          resultados.length,

        usuariosCorrectos:
          correctos.length,

        usuariosFallidos:
          fallidos.length,

        alertas:
          totalAlertas,

        alertasTarjetas:
          totalAlertasTarjetas,

        enviadas:
          totalEnviadas,

        fallidas:
          totalFallidas,

        duracionMs:
          Date.now() -
          inicio,
      },
      status,
    );
  } catch (
    error
  ) {
    console.error(
      "Falló la ejecución automática de alertas:",
      error,
    );

    return json(
      {
        ok: false,

        error:
          "No se pudo ejecutar la evaluación automática de alertas.",

        duracionMs:
          Date.now() -
          inicio,
      },
      500,
    );
  }
}

/**
 * No permitimos ejecutar este cron mediante POST.
 */
export async function POST():
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
        "GET",
    },
  );
}

/**
 * ============================================================
 * SEGURIDAD
 * ============================================================
 *
 * Vercel añade automáticamente:
 *
 * Authorization: Bearer <CRON_SECRET>
 */
function cronAutorizado(
  request:
    NextRequest,
): boolean {
  const secret =
    process.env
      .CRON_SECRET
      ?.trim();

  if (
    !secret
  ) {
    console.error(
      "CRON_SECRET no está configurado.",
    );

    return false;
  }

  const authorization =
    request.headers.get(
      "authorization",
    );

  return (
    authorization ===
    `Bearer ${secret}`
  );
}

/**
 * ============================================================
 * USUARIOS
 * ============================================================
 *
 * Solo evaluamos cuentas autorizadas y activas.
 *
 * No depende del root users/{uid}.
 */
async function obtenerUsuariosActivos():
  Promise<string[]> {
  const snapshot =
    await getAdminDb()
      .collection(
        "allowedUsers",
      )
      .where(
        "activo",
        "==",
        true,
      )
      .get();

  return snapshot.docs
    .map(
      (
        documento,
      ) =>
        documento.id
          .trim(),
    )
    .filter(
      Boolean,
    );
}

/**
 * ============================================================
 * CONCURRENCIA CONTROLADA
 * ============================================================
 *
 * No disparamos todos los usuarios simultáneamente.
 *
 * Esto protege:
 *
 * - Firestore;
 * - Firebase Messaging;
 * - tiempo/memoria de la función.
 */
async function procesarEnLotes<
  TEntrada,
  TSalida
>(
  entradas:
    TEntrada[],

  tamanoLote:
    number,

  procesar:
    (
      entrada:
        TEntrada,
    ) => Promise<TSalida>,
): Promise<TSalida[]> {
  const resultados:
    TSalida[] = [];

  const tamano =
    Math.max(
      1,
      Math.trunc(
        tamanoLote,
      ),
    );

  for (
    let indice =
      0;

    indice <
    entradas.length;

    indice +=
      tamano
  ) {
    const lote =
      entradas.slice(
        indice,
        indice +
          tamano,
      );

    const resultadosLote =
      await Promise.all(
        lote.map(
          procesar,
        ),
      );

    resultados.push(
      ...resultadosLote,
    );
  }

  return resultados;
}

function sumar(
  valores:
    number[],
): number {
  return valores.reduce(
    (
      total,
      valor,
    ) =>
      total +
      valor,
    0,
  );
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