import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { archivarMovimiento, ErrorPapelera, listarPapelera, restaurarMovimiento } from "@/lib/movement-trash/server";
import { esIdDocumento } from "@/lib/movement-trash/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}
async function ejecutar(request: NextRequest, accion: "listar" | "eliminar" | "restaurar") {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/)?.[1];
  if (!token) return json({ ok: false, error: "Autenticación requerida." }, 401);
  let uid: string;
  try { uid = (await getAdminAuth().verifyIdToken(token, true)).uid; }
  catch { return json({ ok: false, error: "La sesión no es válida." }, 401); }
  if (!esIdDocumento(uid)) return json({ ok: false, error: "La sesión no es válida." }, 401);
  try {
    if (accion === "listar") return json({ ok: true, ...await listarPapelera(getAdminDb(), uid, request.nextUrl.searchParams.get("cursor")) });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ErrorPapelera("Solicitud no válida.", 400);
    const datos = body as Record<string, unknown>;
    const movimiento = accion === "eliminar"
      ? await archivarMovimiento(getAdminDb(), uid, datos.coleccion, datos.documentoId)
      : await restaurarMovimiento(getAdminDb(), uid, datos.id);
    return json({ ok: true, movimiento });
  } catch (error) {
    if (error instanceof ErrorPapelera) return json({ ok: false, error: error.message }, error.status);
    console.error("Error de papelera de movimientos:", error);
    return json({ ok: false, error: "No se pudo completar la operación. Actualiza la papelera para comprobar su estado." }, 500);
  }
}
export async function GET(request: NextRequest) { return ejecutar(request, "listar"); }
export async function DELETE(request: NextRequest) { return ejecutar(request, "eliminar"); }
export async function POST(request: NextRequest) { return ejecutar(request, "restaurar"); }
