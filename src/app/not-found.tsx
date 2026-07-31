import Link from "next/link";
import {
  ArrowLeft,
  Home,
  SearchX,
  WalletCards,
} from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      <div
        aria-hidden="true"
        className="absolute left-[-6rem] top-[-6rem] h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="absolute bottom-[-7rem] right-[-5rem] h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl"
      />

      <section className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-xl shadow-slate-200/60 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
          <SearchX
            aria-hidden="true"
            className="h-8 w-8"
          />
        </div>

        <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-indigo-600">
          Error 404
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Esta página no existe
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm font-medium leading-6 text-slate-500 sm:text-base">
          La dirección puede estar incorrecta o la página fue movida.
          Tu información de Presupuesto Felo continúa segura.
        </p>

        <div className="mt-7 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-700">
              <WalletCards
                aria-hidden="true"
                className="h-5 w-5"
              />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                Presupuesto Felo
              </p>

              <p className="mt-0.5 text-sm font-bold text-slate-800">
                Regresa al panel para continuar administrando tu dinero.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 active:scale-[0.98]"
          >
            <Home
              aria-hidden="true"
              className="h-4 w-4"
            />

            Ir al presupuesto
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 active:scale-[0.98]"
          >
            <ArrowLeft
              aria-hidden="true"
              className="h-4 w-4"
            />

            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}