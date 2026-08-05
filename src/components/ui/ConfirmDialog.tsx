// src/components/ui/ConfirmDialog.tsx

"use client";

import {
  AlertTriangle,
  LoaderCircle,
  X,
} from "lucide-react";

interface ConfirmDialogProps {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  procesando?: boolean;
  peligroso?: boolean;
  onConfirmar: () => void | Promise<void>;
  onCancelar: () => void;
}

export function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  procesando = false,
  peligroso = false,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  if (!abierto) {
    return null;
  }

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !procesando
        ) {
          onCancelar();
        }
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-sm rounded-[2rem] bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              peligroso
                ? "bg-rose-100 text-rose-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            <AlertTriangle className="h-6 w-6" />
          </div>

          <button
            type="button"
            onClick={onCancelar}
            disabled={procesando}
            aria-label="Cerrar confirmación"
            className="rounded-xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2
          id="confirm-dialog-title"
          className="mt-5 text-xl font-black text-slate-950"
        >
          {titulo}
        </h2>

        <p
          id="confirm-dialog-description"
          className="mt-2 text-sm font-semibold leading-6 text-slate-500"
        >
          {mensaje}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={procesando}
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {textoCancelar}
          </button>

          <button
            type="button"
            onClick={onConfirmar}
            disabled={procesando}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              peligroso
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {procesando ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}

            {procesando
              ? "Procesando..."
              : textoConfirmar}
          </button>
        </div>
      </section>
    </div>
  );
}