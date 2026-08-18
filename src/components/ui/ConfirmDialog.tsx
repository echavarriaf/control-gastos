"use client";

import {
  AlertTriangle,
  LoaderCircle,
  X,
} from "lucide-react";

import {
  useEffect,
  useRef,
} from "react";

interface ConfirmDialogProps {
  abierto: boolean;
  titulo: string;
  mensaje: string;

  textoConfirmar?: string;
  textoCancelar?: string;

  procesando?: boolean;
  peligroso?: boolean;

  onConfirmar: () =>
    | void
    | Promise<void>;

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
  const botonCancelarRef =
    useRef<HTMLButtonElement | null>(
      null,
    );

  useEffect(() => {
    if (!abierto) {
      return;
    }

    const overflowAnterior =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const temporizador =
      window.setTimeout(() => {
        botonCancelarRef.current?.focus();
      }, 50);

    const manejarEscape = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key !== "Escape"
      ) {
        return;
      }

      /*
       * Evita que Escape cierre también otro modal
       * que se encuentre detrás de este diálogo.
       */
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (!procesando) {
        onCancelar();
      }
    };

    window.addEventListener(
      "keydown",
      manejarEscape,
      true,
    );

    return () => {
      window.clearTimeout(
        temporizador,
      );

      window.removeEventListener(
        "keydown",
        manejarEscape,
        true,
      );

      document.body.style.overflow =
        overflowAnterior;
    };
  }, [
    abierto,
    onCancelar,
    procesando,
  ]);

  if (!abierto) {
    return null;
  }

  const ejecutarConfirmacion =
    () => {
      if (procesando) {
        return;
      }

      void onConfirmar();
    };

  const claseIcono = peligroso
    ? "bg-rose-100 text-rose-600"
    : "bg-amber-100 text-amber-600";

  const claseBotonConfirmar =
    peligroso
      ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-200"
      : "bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-200";

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !procesando
        ) {
          onCancelar();
        }
      }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center"
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${claseIcono}`}
            >
              <AlertTriangle
                aria-hidden="true"
                className="h-5 w-5"
              />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Confirmación requerida
              </p>

              <h2
                id="confirm-dialog-title"
                className="mt-1 text-lg font-black text-slate-950"
              >
                {titulo}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancelar}
            disabled={procesando}
            aria-label="Cerrar confirmación"
            className="rounded-xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X
              aria-hidden="true"
              className="h-4 w-4"
            />
          </button>
        </header>

        <div className="p-5">
          <p
            id="confirm-dialog-message"
            className="text-sm font-medium leading-6 text-slate-600"
          >
            {mensaje}
          </p>

          {peligroso ? (
            <p className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs font-bold leading-5 text-rose-700">
              Esta acción no se puede deshacer.
            </p>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              ref={botonCancelarRef}
              type="button"
              onClick={onCancelar}
              disabled={procesando}
              className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {textoCancelar}
            </button>

            <button
              type="button"
              onClick={
                ejecutarConfirmacion
              }
              disabled={procesando}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black text-white transition focus-visible:outline-none focus-visible:ring-4 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${claseBotonConfirmar}`}
            >
              {procesando ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />

                  Eliminando...
                </>
              ) : (
                textoConfirmar
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ConfirmDialog;