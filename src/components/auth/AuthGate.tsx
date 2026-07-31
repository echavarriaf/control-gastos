"use client";

import {
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import type {
  ReactNode,
} from "react";

import {
  LoginScreen,
} from "@/components/auth/LoginScreen";

import {
  UnauthorizedScreen,
} from "@/components/auth/UnauthorizedScreen";

import {
  useAuth,
} from "@/contexts/AuthContext";

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({
  children,
}: AuthGateProps) {
  const {
    user,
    authorized,
    loading,
  } = useAuth();

  if (
    loading
  ) {
    return (
      <AuthLoadingScreen />
    );
  }

  if (
    !user
  ) {
    return (
      <LoginScreen />
    );
  }

  if (
    !authorized
  ) {
    return (
      <UnauthorizedScreen />
    );
  }

  return (
    <>
      {children}
    </>
  );
}

function AuthLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white antialiased">
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-sm flex-col items-center rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur"
      >
        <div className="relative">
          <ShieldCheck className="h-10 w-10 text-emerald-300" />

          <LoaderCircle className="absolute -right-3 -top-3 h-5 w-5 animate-spin text-indigo-300" />
        </div>

        <p className="mt-5 text-lg font-black">
          Verificando acceso
        </p>

        <p className="mt-2 text-sm font-medium text-slate-400">
          Recuperando tu sesión y comprobando los permisos del
          presupuesto.
        </p>
      </div>
    </main>
  );
}