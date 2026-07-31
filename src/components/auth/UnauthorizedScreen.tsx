"use client";

import {
  Check,
  Clipboard,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import {
  useState,
} from "react";

import {
  useAuth,
} from "@/contexts/AuthContext";

export function UnauthorizedScreen() {
  const {
    user,
    error,
    checkingAuthorization,
    signingOut,
    refreshAuthorization,
    signOutUser,
  } = useAuth();

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  if (
    !user
  ) {
    return null;
  }

  const copyUid =
    async () => {
      try {
        await navigator.clipboard.writeText(
          user.uid,
        );

        setCopied(
          true,
        );

        window.setTimeout(
          () =>
            setCopied(
              false,
            ),
          2_000,
        );
      } catch (
        copyError
      ) {
        console.error(
          "No se pudo copiar el UID:",
          copyError,
        );
      }
    };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-900 antialiased">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-50 p-6 shadow-2xl sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              Cuenta pendiente de autorización
            </p>

            <h1 className="mt-2 text-2xl font-black text-slate-950">
              Tu sesión funciona, pero todavía no tiene acceso
            </h1>

            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Agrega este UID como documento en Firestore para
              habilitar la cuenta de{" "}
              {user.email ?? "Google"}.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            ID del documento
          </p>

          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-slate-100 px-3 py-3 text-xs font-bold text-slate-700">
              {user.uid}
            </code>

            <button
              type="button"
              onClick={() => {
                void copyUid();
              }}
              className="shrink-0 rounded-xl border border-slate-200 bg-white p-3 text-slate-600 transition hover:bg-slate-50"
              aria-label="Copiar UID"
              title="Copiar UID"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Clipboard className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-semibold leading-6 text-indigo-950">
          <p>
            En Firebase Console crea:
          </p>

          <code className="mt-2 block rounded-xl bg-white/70 px-3 py-2 text-xs">
            allowedUsers/{user.uid}
          </code>

          <p className="mt-2">
            Y agrega un campo booleano:
          </p>

          <code className="mt-2 block rounded-xl bg-white/70 px-3 py-2 text-xs">
            activo: true
          </code>
        </div>

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
            disabled={
              checkingAuthorization ||
              signingOut
            }
            onClick={() => {
              void refreshAuthorization();
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3.5 text-sm font-black text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkingAuthorization ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}

            Comprobar acceso
          </button>

          <button
            type="button"
            disabled={
              signingOut ||
              checkingAuthorization
            }
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