import type {
    FidMulticastMessage,
} from "firebase-admin/messaging";

import {
    NextRequest,
    NextResponse,
} from "next/server";

import {
    getAdminDb,
    getAdminMessaging,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEVICE_COLLECTION =
    "notificationDevices";

export async function POST(
    request: NextRequest,
): Promise<NextResponse> {
    if (!esSolicitudPermitida(request)) {
        return NextResponse.json(
            {
                ok: false,
                error:
                    "Solicitud no permitida.",
            },
            {
                status: 403,
            },
        );
    }

    try {
        const snapshot =
            await getAdminDb()
                .collection(
                    DEVICE_COLLECTION,
                )
                .where(
                    "activo",
                    "==",
                    true,
                )
                .get();

        const documentosPorFid =
            new Map<string, string>();

        snapshot.docs.forEach(
            (documento) => {
                const installationId =
                    documento.data()
                        .installationId;

                if (
                    typeof installationId !==
                    "string"
                ) {
                    return;
                }

                const fid =
                    installationId.trim();

                if (!fid) {
                    return;
                }

                documentosPorFid.set(
                    fid,
                    documento.id,
                );
            },
        );

        const fids =
            Array.from(
                documentosPorFid.keys(),
            );

        const fidsObjetivo =
            fids.slice(0, 500);

        if (fids.length === 0) {
            return NextResponse.json({
                ok: false,
                dispositivos: 0,
                enviadas: 0,
                fallidas: 0,
                mensaje:
                    "No se encontraron dispositivos activos.",
            });
        }

        /*
         * Espera tres segundos para darte tiempo
         * de minimizar Safari.
         */
        await new Promise<void>(
            (resolve) => {
                setTimeout(
                    resolve,
                    3_000,
                );
            },
        );

        const message:
            FidMulticastMessage = {
            fids: fidsObjetivo,

            data: {
                title:
                    "✅ Prueba FCM exitosa",

                body:
                    "Esta notificación fue enviada desde Firebase Admin.",

                url:
                    "/",

                tag:
                    `prueba-fcm-${Date.now()}`,

                renotify:
                    "true",

                requireInteraction:
                    "true",

                timestamp:
                    Date.now().toString(),
            },

            webpush: {
                headers: {
                    Urgency:
                        "high",
                },
            },
        };

        const resultado =
            await getAdminMessaging()
                .sendEachForMulticast(
                    message,
                );

        const errores =
            resultado.responses
                .map(
                    (
                        respuesta,
                        index,
                    ) => {
                        if (
                            respuesta.success
                        ) {
                            return null;
                        }

                        return {
                            indice:
                                index,

                            documentoId:
                                documentosPorFid.get(
                                    fidsObjetivo[index],
                                ) ?? null,

                            fidFinal:
                                fidsObjetivo[index]
                                    ?.slice(-10) ??
                                null,

                            code:
                                respuesta.error
                                    ?.code ??
                                "desconocido",

                            message:
                                respuesta.error
                                    ?.message ??
                                "Error desconocido",
                        };
                    },
                )
                .filter(Boolean);

        return NextResponse.json({
            ok:
                resultado.successCount >
                0,

            dispositivos:
                fids.length,

            enviadas:
                resultado.successCount,

            fallidas:
                resultado.failureCount,

            errores,
        });
    } catch (error) {
        console.error(
            "Error enviando la prueba FCM:",
            error,
        );

        return NextResponse.json(
            {
                ok: false,

                error:
                    "No se pudo enviar la notificación de prueba.",

                detalle:
                    error instanceof Error
                        ? error.message
                        : String(error),
            },
            {
                status: 500,
            },
        );
    }
}

export async function GET(): Promise<NextResponse> {
    return NextResponse.json(
        {
            ok: false,
            error:
                "Método no permitido.",
        },
        {
            status: 405,
            headers: {
                Allow:
                    "POST",
            },
        },
    );
}

function esSolicitudPermitida(
    request: NextRequest,
): boolean {
    const origin =
        request.headers.get(
            "origin",
        );

    if (!origin) {
        return false;
    }

    const requestOrigin =
        new URL(
            request.url,
        ).origin;

    return (
        origin ===
        requestOrigin
    );
}