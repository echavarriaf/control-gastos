import {
  LoaderCircle,
} from "lucide-react";

function LoadingState() {
  return (
    <div
      role="status"
      className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"
    >
      <LoaderCircle className="h-7 w-7 animate-spin text-indigo-600" />

      <p className="mt-3 text-sm font-black text-slate-800">
        Cargando presupuesto...
      </p>

      <p className="mt-1 text-xs font-medium text-slate-500">
        Consultando gastos, pagos y límites en
        Firestore.
      </p>
    </div>
  )
}

export default LoadingState