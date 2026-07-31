"use client";

import {
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

export function LoginScreen() {
  const {
    error,
    signingIn,
    signInWithGoogle,
    clearError,
  } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-900 antialiased">
      <section className="w-full max-w-md overflow-hidden rounded-4xl border border-white/10 bg-slate-50 shadow-2xl">
        <div className="relative overflow-hidden bg-linear-to-br from-slate-950 via-indigo-950 to-emerald-950 p-7 text-white">
          <div
            aria-hidden="true"
            className="absolute -right-14 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl"
          />

          <div
            aria-hidden="true"
            className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl"
          />

          <div className="relative">
            <div className="inline-flex rounded-2xl border border-white/10 bg-white/10 p-3">
              <WalletCards className="h-7 w-7 text-emerald-300" />
            </div>

            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
              Presupuesto
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Tus finanzas, ahora protegidas
            </h1>

            <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-slate-300">
              Inicia sesión con la cuenta de Google autorizada
              para consultar y modificar el presupuesto.
            </p>
          </div>
        </div>

        <div className="space-y-5 p-6 sm:p-7">
          <div className="grid gap-3 sm:grid-cols-2">
            <Feature
              icon={LockKeyhole}
              title="Acceso privado"
              description="Firestore bloqueará las solicitudes de cuentas no autorizadas."
            />

            <Feature
              icon={ShieldCheck}
              title="Sesión persistente"
              description="No tendrás que iniciar sesión cada vez que abras la aplicación."
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700"
            >
              <p>{error}</p>

              <button
                type="button"
                onClick={clearError}
                aria-label="Cerrar error"
                className="shrink-0 rounded-lg p-1 transition hover:bg-rose-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <button
            type="button"
            disabled={signingIn}
            onClick={() => {
              void signInWithGoogle();
            }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingIn ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}

            {signingIn
              ? "Conectando con Google..."
              : "Continuar con Google"}
          </button>

          <p className="text-center text-xs font-medium leading-5 text-slate-500">
            Solo las cuentas agregadas a la colección de
            usuarios autorizados podrán entrar al presupuesto.
          </p>
        </div>
      </section>
    </main>
  );
}

interface FeatureProps {
  icon: typeof LockKeyhole;
  title: string;
  description: string;
}

function Feature({
  icon: Icon,
  title,
  description,
}: FeatureProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-indigo-600" />

      <p className="mt-3 text-sm font-black text-slate-900">
        {title}
      </p>

      <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
    >
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />

      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.6-4.12H3.05v2.62A10 10 0 0 0 12 22Z"
      />

      <path
        fill="#FBBC05"
        d="M6.4 13.94A6 6 0 0 1 6.08 12c0-.67.12-1.32.32-1.94V7.44H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.56l3.35-2.62Z"
      />

      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.78.5 3.82 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.44l3.35 2.62c.8-2.36 3-4.12 5.6-4.12Z"
      />
    </svg>
  );
}