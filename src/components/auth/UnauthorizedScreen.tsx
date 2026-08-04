"use client";

/*
 * Nombre: Pantalla de solicitud de acceso
 * Ruta: src/components/auth/UnauthorizedScreen.tsx
 * Autor: Felix Echavarria
 * Fecha: 2026-08-04
 *
 * Descripción:
 * Informa al usuario autenticado que su solicitud de acceso fue
 * registrada y permanece pendiente de revisión. No muestra el UID
 * ni instrucciones internas de Firebase.
 */

import {
  Clock3,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  useAuth,
} from "@/contexts/AuthContext";

/**
 * Muestra el estado de la solicitud de acceso del usuario actual.
 *
 * Obtiene la solicitud desde AuthContext y adapta el mensaje cuando
 * está pendiente, rechazada o todavía no pudo cargarse. También
 * permite comprobar nuevamente la autorización y cerrar la sesión.
 */
export function UnauthorizedScreen() {
  const {
    user,
    accessRequest,
    error,
    checkingAuthorization,
    creatingAccessRequest,
    signingOut,
    refreshAuthorization,
    signOutUser,
  } = useAuth();

  if (!user) {
    return null;
  }

  const solicitudRechazada =
    accessRequest?.estado ===
    "rechazada";

  const procesando =
    checkingAuthorization ||
    creatingAccessRequest ||
    signingOut;

  const titulo =
    solicitudRechazada
      ? "La solicitud no fue aprobada"
      : "Solicitud de acceso enviada";

  const descripcion =
    solicitudRechazada
      ? "El administrador revisó esta cuenta y decidió no habilitar su acceso."
      : "El administrador recibió tu solicitud. Podrás entrar cuando sea aprobada.";

  const correo =
    accessRequest?.email ||
    user.email ||
    "Cuenta de Google";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-900 antialiased">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-50 p-6 shadow-2xl sm:p-8">
        <div className="flex items-start gap-4">
          <div
            className={`rounded-2xl p-3 ${
              solicitudRechazada
                ? "bg-rose-100 text-rose-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {solicitudRechazada ? (
              <XCircle className="h-7 w-7" />
            ) : (
              <Clock3 className="h-7 w-7" />
            )}
          </div>

          <div className="min-w-0">
            <p
              className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                solicitudRechazada
                  ? "text-rose-700"
                  : "text-amber-700"
              }`}
            >
              {solicitudRechazada
                ? "Acceso rechazado"
                : "Pendiente de autorización"}
            </p>

            <h1 className="mt-2 text-2xl font-black text-slate-950">
              {titulo}
            </h1>

            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              {descripcion}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-sm font-black text-indigo-700">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                (
                  user.displayName ??
                  correo
                )
                  .trim()
                  .charAt(0)
                  .toUpperCase() ||
                "U"
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">
                {accessRequest?.nombre ||
                  user.displayName ||
                  "Usuario de Google"}
              </p>

              <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                {correo}
              </p>
            </div>
          </div>
        </div>

        {!solicitudRechazada ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />

            <p className="text-sm font-semibold leading-6">
              No necesitas enviar ningún código ni realizar otro paso.
              Usa <strong>Comprobar acceso</strong> después de recibir
              la confirmación del administrador.
            </p>
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={procesando}
            onClick={() => {
              void refreshAuthorization();
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3.5 text-sm font-black text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkingAuthorization ||
            creatingAccessRequest ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}

            Comprobar acceso
          </button>

          <button
            type="button"
            disabled={procesando}
            onClick={() => {
              void signOutUser();
            }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}

            Cerrar sesión
          </button>
        </div>
      </section>
    </main>
  );
}