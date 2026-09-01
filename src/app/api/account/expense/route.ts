import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase-admin";

import {
  EXPENSE_ACCOUNT_ID,
  normalizarCuentaGastos,
  validarCuentaGastos,
} from "@/lib/budget/expense-account";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  15;

interface AutorizacionExitosa {
  ok: true;
  uid: string;
}

interface AutorizacionFallida {
  ok: false;
  response: NextResponse;
}

type ResultadoAutorizacion =
  | AutorizacionExitosa
  | AutorizacionFallida;

function respuestaJson(
  data: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(
    data,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    },
  );
}

function obtenerBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers
      .get(
        "authorization",
      )
      ?.trim();

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer ",
    )
  ) {
    return null;
  }

  const token =
    authorization
      .slice(
        "Bearer ".length,
      )
      .trim();

  return token ||
    null;
}

function obtenerFechaCalendario(
  value: unknown,
): string {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .trim()
    .slice(
      0,
      10,
    );
}

function esGastoDeCuenta(
  data:
    Record<
      string,
      unknown
    >,
): boolean {
  return (
    data.metodoPago ===
      "debito" ||
    data.metodoPago ===
      "cuenta_bancaria"
  );
}

function esPagoFijoDeCuenta(
  data:
    Record<
      string,
      unknown
    >,
): boolean {
  return (
    data.metodo ===
      "debito_automatico" ||
    data.metodo ===
      "transferencia"
  );
}

/**
 * Verifica el Firebase ID Token y que allowedUsers/{uid}
 * continúe activo.
 *
 * El UID siempre procede del token verificado.
 */
async function autorizarUsuario(
  request: NextRequest,
): Promise<ResultadoAutorizacion> {
  const token =
    obtenerBearerToken(
      request,
    );

  if (
    !token
  ) {
    return {
      ok: false,

      response:
        respuestaJson(
          {
            ok: false,

            error:
              "Autenticación requerida.",
          },
          401,
        ),
    };
  }

  try {
    const decodedToken =
      await getAdminAuth()
        .verifyIdToken(
          token,
          true,
        );

    const uid =
      decodedToken.uid;

    const allowedSnapshot =
      await getAdminDb()
        .collection(
          "allowedUsers",
        )
        .doc(
          uid,
        )
        .get();

    if (
      !allowedSnapshot.exists ||
      allowedSnapshot
        .data()
        ?.activo !==
        true
    ) {
      return {
        ok: false,

        response:
          respuestaJson(
            {
              ok: false,

              error:
                "Usuario no autorizado.",
            },
            403,
          ),
      };
    }

    return {
      ok: true,
      uid,
    };
  } catch (
    error
  ) {
    console.error(
      "No se pudo autorizar la cuenta de gastos:",
      error,
    );

    return {
      ok: false,

      response:
        respuestaJson(
          {
            ok: false,

            error:
              "La sesión no es válida.",
          },
          401,
        ),
    };
  }
}

function obtenerReferenciaCuenta(
  uid: string,
) {
  return getAdminDb()
    .collection(
      "users",
    )
    .doc(
      uid,
    )
    .collection(
      "cuentas",
    )
    .doc(
      EXPENSE_ACCOUNT_ID,
    );
}

function obtenerColeccionUsuario(
  uid: string,
  nombre: string,
) {
  return getAdminDb()
    .collection(
      "users",
    )
    .doc(
      uid,
    )
    .collection(
      nombre,
    );
}

async function obtenerIdsIngresosIncluidos(
  uid: string,

  fechaSaldoInicial:
    string,
): Promise<string[]> {
  const snapshot =
    await obtenerColeccionUsuario(
      uid,
      "ingresos",
    )
      .where(
        "estado",
        "==",
        "recibido",
      )
      .get();

  return snapshot.docs
    .filter(
      (documento) => {
        const data =
          documento.data();

        const fechaRecibida =
          obtenerFechaCalendario(
            data
              .fechaRecibida,
          );

        return (
          fechaRecibida !==
            "" &&
          fechaRecibida <=
            fechaSaldoInicial
        );
      },
    )
    .map(
      (documento) =>
        documento.id,
    )
    .sort();
}

async function obtenerIdsGastosIncluidos(
  uid: string,

  fechaSaldoInicial:
    string,
): Promise<string[]> {
  const snapshot =
    await obtenerColeccionUsuario(
      uid,
      "gastos",
    ).get();

  return snapshot.docs
    .filter(
      (documento) => {
        const data =
          documento.data();

        if (
          !esGastoDeCuenta(
            data,
          )
        ) {
          return false;
        }

        const fecha =
          obtenerFechaCalendario(
            data.fecha,
          );

        return (
          fecha !== "" &&
          fecha <=
            fechaSaldoInicial
        );
      },
    )
    .map(
      (documento) =>
        documento.id,
    )
    .sort();
}

/**
 * Guarda como incluidos los pagos fijos bancarios
 * ya reflejados por el banco en la fotografía base.
 */
async function obtenerIdsPagosFijosIncluidos(
  uid: string,

  fechaSaldoInicial:
    string,
): Promise<string[]> {
  const snapshot =
    await obtenerColeccionUsuario(
      uid,
      "pagosFijos",
    ).get();

  return snapshot.docs
    .filter(
      (documento) => {
        const data =
          documento.data();

        if (
          !esPagoFijoDeCuenta(
            data,
          )
        ) {
          return false;
        }

        const fecha =
          obtenerFechaCalendario(
            data.fecha,
          );

        return (
          fecha !== "" &&
          fecha <=
            fechaSaldoInicial
        );
      },
    )
    .map(
      (documento) =>
        documento.id,
    )
    .sort();
}

/**
 * Todos los documentos de pagosTarjeta representan
 * pagos reales efectuados a una tarjeta.
 *
 * Mientras exista una sola Cuenta de gastos,
 * se asume que estos pagos salen de ella.
 *
 * Los pagos realizados hasta la fecha de la fotografía
 * quedan incluidos en saldoInicial y no se restan nuevamente.
 */
async function obtenerIdsPagosTarjetaIncluidos(
  uid: string,

  fechaSaldoInicial:
    string,
): Promise<string[]> {
  const snapshot =
    await obtenerColeccionUsuario(
      uid,
      "pagosTarjeta",
    ).get();

  return snapshot.docs
    .filter(
      (documento) => {
        const data =
          documento.data();

        const fecha =
          obtenerFechaCalendario(
            data.fecha,
          );

        return (
          fecha !== "" &&
          fecha <=
            fechaSaldoInicial
        );
      },
    )
    .map(
      (documento) =>
        documento.id,
    )
    .sort();
}

/**
 * Obtiene la configuración actual de la Cuenta de gastos.
 *
 * También completa automáticamente los snapshots añadidos
 * durante fases posteriores del desarrollo.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const autorizacion =
    await autorizarUsuario(
      request,
    );

  if (
    !autorizacion.ok
  ) {
    return autorizacion.response;
  }

  try {
    const referencia =
      obtenerReferenciaCuenta(
        autorizacion.uid,
      );

    const snapshot =
      await referencia.get();

    if (
      !snapshot.exists
    ) {
      return respuestaJson({
        ok: true,

        cuenta:
          null,
      });
    }

    const data =
      snapshot.data();

    const cuenta =
      normalizarCuentaGastos(
        data,
      );

    if (
      !cuenta
    ) {
      console.error(
        "La Cuenta de gastos almacenada tiene un formato inválido:",
        {
          uid:
            autorizacion.uid,
        },
      );

      return respuestaJson(
        {
          ok: false,

          error:
            "La configuración de la cuenta almacenada no es válida.",
        },
        500,
      );
    }

    const tieneSnapshotIngresos =
      Array.isArray(
        data
          ?.ingresosIncluidosEnSaldoInicial,
      );

    const tieneSnapshotGastos =
      Array.isArray(
        data
          ?.gastosIncluidosEnSaldoInicial,
      );

    const tieneSnapshotPagosFijos =
      Array.isArray(
        data
          ?.pagosFijosIncluidosEnSaldoInicial,
      );

    const tieneSnapshotPagosTarjeta =
      Array.isArray(
        data
          ?.pagosTarjetaIncluidosEnSaldoInicial,
      );

    const actualizaciones:
      Record<
        string,
        unknown
      > = {};

    if (
      !tieneSnapshotIngresos
    ) {
      const ids =
        await obtenerIdsIngresosIncluidos(
          autorizacion.uid,
          cuenta
            .fechaSaldoInicial,
        );

      cuenta
        .ingresosIncluidosEnSaldoInicial =
        ids;

      actualizaciones
        .ingresosIncluidosEnSaldoInicial =
        ids;
    }

    if (
      !tieneSnapshotGastos
    ) {
      const ids =
        await obtenerIdsGastosIncluidos(
          autorizacion.uid,
          cuenta
            .fechaSaldoInicial,
        );

      cuenta
        .gastosIncluidosEnSaldoInicial =
        ids;

      actualizaciones
        .gastosIncluidosEnSaldoInicial =
        ids;
    }

    if (
      !tieneSnapshotPagosFijos
    ) {
      const ids =
        await obtenerIdsPagosFijosIncluidos(
          autorizacion.uid,
          cuenta
            .fechaSaldoInicial,
        );

      cuenta
        .pagosFijosIncluidosEnSaldoInicial =
        ids;

      actualizaciones
        .pagosFijosIncluidosEnSaldoInicial =
        ids;
    }

    if (
      !tieneSnapshotPagosTarjeta
    ) {
      const ids =
        await obtenerIdsPagosTarjetaIncluidos(
          autorizacion.uid,
          cuenta
            .fechaSaldoInicial,
        );

      cuenta
        .pagosTarjetaIncluidosEnSaldoInicial =
        ids;

      actualizaciones
        .pagosTarjetaIncluidosEnSaldoInicial =
        ids;
    }

    if (
      Object.keys(
        actualizaciones,
      ).length >
      0
    ) {
      await referencia.set(
        actualizaciones,
        {
          merge: true,
        },
      );
    }

    return respuestaJson({
      ok: true,
      cuenta,
    });
  } catch (
    error
  ) {
    console.error(
      "No se pudo leer la Cuenta de gastos:",
      error,
    );

    return respuestaJson(
      {
        ok: false,

        error:
          "No se pudo cargar la Cuenta de gastos.",
      },
      500,
    );
  }
}

/**
 * Crea o recalibra la Cuenta de gastos.
 *
 * Al guardar una nueva fotografía, todos los movimientos
 * conocidos hasta esa fecha quedan incluidos dentro del
 * saldo inicial para impedir duplicaciones.
 */
export async function PUT(
  request: NextRequest,
): Promise<NextResponse> {
  const autorizacion =
    await autorizarUsuario(
      request,
    );

  if (
    !autorizacion.ok
  ) {
    return autorizacion.response;
  }

  try {
    const body =
      await request.json();

    const datos =
      validarCuentaGastos(
        body,
      );

    const [
      ingresosIncluidosEnSaldoInicial,
      gastosIncluidosEnSaldoInicial,
      pagosFijosIncluidosEnSaldoInicial,
      pagosTarjetaIncluidosEnSaldoInicial,
    ] =
      await Promise.all([
        obtenerIdsIngresosIncluidos(
          autorizacion.uid,
          datos
            .fechaSaldoInicial,
        ),

        obtenerIdsGastosIncluidos(
          autorizacion.uid,
          datos
            .fechaSaldoInicial,
        ),

        obtenerIdsPagosFijosIncluidos(
          autorizacion.uid,
          datos
            .fechaSaldoInicial,
        ),

        obtenerIdsPagosTarjetaIncluidos(
          autorizacion.uid,
          datos
            .fechaSaldoInicial,
        ),
      ]);

    const referencia =
      obtenerReferenciaCuenta(
        autorizacion.uid,
      );

    const existente =
      await referencia.get();

    const datosFirestore:
      Record<
        string,
        unknown
      > = {
        nombre:
          datos.nombre,

        saldoInicial:
          datos.saldoInicial,

        fechaSaldoInicial:
          datos.fechaSaldoInicial,

        activa:
          datos.activa,

        ingresosIncluidosEnSaldoInicial,

        gastosIncluidosEnSaldoInicial,

        pagosFijosIncluidosEnSaldoInicial,

        pagosTarjetaIncluidosEnSaldoInicial,

        actualizadoEn:
          FieldValue
            .serverTimestamp(),
      };

    if (
      !existente.exists
    ) {
      datosFirestore
        .creadoEn =
        FieldValue
          .serverTimestamp();
    }

    await referencia.set(
      datosFirestore,
      {
        merge: true,
      },
    );

    return respuestaJson({
      ok: true,

      cuenta: {
        id:
          EXPENSE_ACCOUNT_ID,

        ...datos,

        ingresosIncluidosEnSaldoInicial,

        gastosIncluidosEnSaldoInicial,

        pagosFijosIncluidosEnSaldoInicial,

        pagosTarjetaIncluidosEnSaldoInicial,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "No se pudo guardar la Cuenta de gastos:",
      error,
    );

    const mensaje =
      error instanceof
      Error
        ? error.message
        : "No se pudo guardar la Cuenta de gastos.";

    return respuestaJson(
      {
        ok: false,

        error:
          mensaje,
      },
      400,
    );
  }
}

export async function POST():
Promise<NextResponse> {
  return respuestaJson(
    {
      ok: false,

      error:
        "Método no permitido.",
    },
    405,
  );
}

export async function DELETE():
Promise<NextResponse> {
  return respuestaJson(
    {
      ok: false,

      error:
        "Método no permitido.",
    },
    405,
  );
}