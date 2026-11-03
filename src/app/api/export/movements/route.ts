import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { validarOpcionesExportacion, prepararFilasExportacion, generarCSV } from "@/lib/export/csv";
import { cargarExportacion } from "@/lib/export/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const json = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/)?.[1];
  if (!token) return json("Autenticación requerida.", 401);
  let uid: string;
  try { uid = (await getAdminAuth().verifyIdToken(token, true)).uid; }
  catch { return json("La sesión no es válida.", 401); }
  if (!uid || uid.includes("/")) return json("La sesión no es válida.", 401);
  try {
    const db = getAdminDb();
    if ((await db.doc(`allowedUsers/${uid}`).get()).data()?.activo !== true) return json("Usuario no autorizado.", 403);
    let opciones;
    try { opciones = validarOpcionesExportacion(request.nextUrl.searchParams); }
    catch (error) { return json(error instanceof Error ? error.message : "Opciones no válidas.", 400); }
    const { registros, tarjetas } = await cargarExportacion(db, uid, opciones);
    const filas = prepararFilasExportacion(registros, opciones, tarjetas);
    const csv = generarCSV(filas, opciones.formato);
    return new NextResponse(csv, { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${opciones.formato}_${opciones.desde}_${opciones.hasta}.csv"`,
      "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff", "X-Export-Record-Count": String(filas.length),
    } });
  } catch (error) {
    console.error("No se pudo exportar el historial:", error);
    return json("No se pudo completar la exportación. Prueba un intervalo menor o vuelve a intentarlo.", 500);
  }
}
