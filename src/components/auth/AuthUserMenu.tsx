"use client";

import {
  ChevronDown,
  LoaderCircle,
  LogOut,
} from "lucide-react";

import {
  useState,
} from "react";

import {
  useAuth,
} from "@/contexts/AuthContext";

export function AuthUserMenu() {
  const {
    user,
    signingOut,
    signOutUser,
  } = useAuth();

  const [
    open,
    setOpen,
  ] =
    useState(false);

  if (
    !user
  ) {
    return null;
  }

  const label =
    user.displayName ??
    user.email ??
    "Usuario";

  const initial =
    label
      .trim()
      .charAt(0)
      .toUpperCase() || "F";

  const handleSignOut =
    async () => {
      const success =
        await signOutUser();

      if (
        success
      ) {
        setOpen(
          false,
        );
      }
    };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(
            (current) =>
              !current,
          );
        }}
        aria-label="Abrir menú de usuario"
        aria-expanded={open}
        aria-controls="auth-user-menu"
        title={label}
        className="flex h-[42px] items-center gap-1 rounded-2xl border border-white/10 bg-white/5 px-2.5 text-white transition hover:bg-white/10 active:scale-95"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-xs font-black text-slate-950">
          {initial}
        </span>

        <ChevronDown
          className={`h-3.5 w-3.5 text-indigo-200 transition ${
            open
              ? "rotate-180"
              : ""
          }`}
        />
      </button>

      {open ? (
        <div
          id="auth-user-menu"
          className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl"
        >
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="truncate text-sm font-black">
              {label}
            </p>

            {user.email ? (
              <p className="mt-1 truncate text-xs font-medium text-slate-500">
                {user.email}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={signingOut}
            onClick={() => {
              void handleSignOut();
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}

            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}