"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";

import type { ReactNode } from "react";

import { LoginScreen } from "@/components/auth/LoginScreen";

import { UnauthorizedScreen } from "@/components/auth/UnauthorizedScreen";

import { useAuth } from "@/contexts/AuthContext";

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const {
    user,
    authorized,
    loading,
    error,
    accessRequest,
    refreshAuthorization,
    signOutUser,
  } = useAuth();

  if (loading) {
    if (process.env.NODE_ENV === "development") {
      console.log(`USER: ${user}`);
      console.log(`AUTHORIZED: ${authorized}`);
      console.log(`LOADING: ${loading}`);
      console.log(`ERROR: ${error}`);
      console.log(`ACCESS REQUEST: ${accessRequest}`);
    }
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!authorized) {
    if (error && !accessRequest) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
          <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6">
            <h1 className="text-xl font-bold">
              No se pudo verificar el acceso
            </h1>
            <p role="alert" className="mt-3 text-sm text-slate-300">
              {error}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void refreshAuthorization()}
                className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-500"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="rounded-xl border border-white/20 px-4 py-3 font-semibold"
              >
                Cerrar sesión
              </button>
            </div>
          </section>
        </main>
      );
    }
    return <UnauthorizedScreen />;
  }

  return <>{children}</>;
}

function AuthLoadingScreen() {
  return (
    <>
      <noscript>
        <style>{`[data-auth-loading] { display: none !important; }`}</style>
        <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
          <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6">
            <h1 className="text-xl font-bold">
              Activa JavaScript para continuar
            </h1>
            <p className="mt-3 text-sm text-slate-300">
              El navegador tiene JavaScript desactivado. Actívalo para este
              sitio y recarga la página para verificar tu sesión.
            </p>
          </section>
        </main>
      </noscript>
      <main
        data-auth-loading
        className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white antialiased"
      >
        <div
          role="status"
          aria-live="polite"
          className="flex w-full max-w-sm flex-col items-center rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur"
        >
          <div className="relative">
            <ShieldCheck className="h-10 w-10 text-emerald-300" />

            <LoaderCircle className="absolute -right-3 -top-3 h-5 w-5 animate-spin text-indigo-300" />
          </div>

          <p className="mt-5 text-lg font-black">Verificando acceso</p>

          <p className="mt-2 text-sm font-medium text-slate-400">
            Recuperando tu sesión y comprobando los permisos del presupuesto.
          </p>
        </div>
      </main>
    </>
  );
}
