"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import {
  Banknote,
  Bell,
  BellOff,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Flame,
  Landmark,
  List,
  PiggyBank,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  Utensils,
  WalletCards,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";

type CategoriaVariable = "comida" | "gas";
type CategoriaPago = CategoriaVariable | "general";
type TipoMovimiento = "gasto" | "pago";
type Vista = "fijos" | "movimientos";
type Quincena = 1 | 2;
type PeriodicidadPagoFijo = "mensual" | "quincenal";
type MetodoPagoFijo =
  | "debito_automatico"
  | "transferencia"
  | "tarjeta"
  | "efectivo"
  | "otro";

interface LimiteCategoria {
  mensual: number;
  quincenal: number;
}

type LimitesVariables = Record<CategoriaVariable, LimiteCategoria>;

interface GastoVariable {
  id: string;
  concepto: string;
  monto: number;
  categoria: CategoriaVariable;
  fecha: string;
}

interface PagoTarjeta {
  id: string;
  concepto: string;
  monto: number;
  categoria: CategoriaPago;
  fecha: string;
}

interface CompromisoFijo {
  id: string;
  descripcion: string;
  monto: number;
}

interface PagoFijo {
  id: string;
  compromisoId: string;
  descripcion: string;
  monto: number;
  fecha: string;
  metodo: MetodoPagoFijo;
  periodicidad: PeriodicidadPagoFijo;
  referencia: string;
  notas: string;
}

type Movimiento =
  | ({ tipo: "gasto" } & GastoVariable)
  | ({ tipo: "pago" } & PagoTarjeta);

const CATEGORIAS_VARIABLES = {
  comida: {
    label: "Comida",
    icon: Utensils,
    color: "bg-amber-500",
    text: "text-amber-700",
    light: "bg-amber-50",
    border: "border-amber-200",
  },
  gas: {
    label: "Gas",
    icon: Car,
    color: "bg-blue-500",
    text: "text-blue-700",
    light: "bg-blue-50",
    border: "border-blue-200",
  },
} as const;

const LIMITES_PREDETERMINADOS: LimitesVariables = {
  comida: { mensual: 1200, quincenal: 600 },
  gas: { mensual: 200, quincenal: 100 },
};

const COMPROMISOS_FIJOS: CompromisoFijo[] = [
  { id: "iul-kids", descripcion: "IUL kids", monto: 65 },
  { id: "prestamo-amex", descripcion: "Préstamo Felo AMEX", monto: 145 },
  { id: "vehiculo-2", descripcion: "Vehículo 2 (F)", monto: 555 },
  { id: "ahorro-comun", descripcion: "Ahorro común", monto: 200 },
  { id: "ayuda-maria", descripcion: "Ayuda María Casa", monto: 60 },
  { id: "celular", descripcion: "Celular", monto: 25 },
  {
    id: "solar-tia-mise",
    descripcion: "Solar Tía Mise / AMEX F. Mariel",
    monto: 150,
  },
  { id: "iul-ea", descripcion: "IUL E/A", monto: 300 },
];

const METODOS_PAGO: Record<MetodoPagoFijo, string> = {
  debito_automatico: "Débito automático",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  otro: "Otro",
};

const CATEGORIA_KEYS = Object.keys(
  CATEGORIAS_VARIABLES,
) as CategoriaVariable[];

const formatoMoneda = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function obtenerPeriodo(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function obtenerPeriodoDesdeISO(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  return Number.isNaN(fecha.getTime()) ? "" : obtenerPeriodo(fecha);
}

function obtenerQuincena(fecha: Date): Quincena {
  return fecha.getDate() <= 15 ? 1 : 2;
}

function obtenerQuincenaDesdeISO(fechaISO: string): Quincena {
  const fecha = new Date(fechaISO);
  return Number.isNaN(fecha.getTime()) ? 1 : obtenerQuincena(fecha);
}

function etiquetaMes(periodo: string): string {
  const [year, month] = periodo.split("-").map(Number);
  const fecha = new Date(year, month - 1, 1);

  if (Number.isNaN(fecha.getTime())) return periodo;

  const resultado = fecha.toLocaleDateString("es-US", {
    month: "long",
    year: "numeric",
  });

  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}

function fechaInputLocal(fecha = new Date()): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fechaParaPeriodo(periodo: string, quincena: Quincena): string {
  const hoy = new Date();

  if (obtenerPeriodo(hoy) === periodo) return fechaInputLocal(hoy);

  const [year, month] = periodo.split("-").map(Number);
  const day = quincena === 1 ? 15 : new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )}`;
}

function convertirFechaInputAISO(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toISOString();
}

function normalizarCategoriaGasto(value: unknown): CategoriaVariable | null {
  if (value === "comida") return "comida";
  if (value === "gas" || value === "transporte") return "gas";
  return null;
}

function normalizarCategoriaPago(value: unknown): CategoriaPago {
  if (value === "comida" || value === "gas" || value === "general") {
    return value;
  }
  return "general";
}

function normalizarMetodoPago(value: unknown): MetodoPagoFijo {
  if (
    value === "debito_automatico" ||
    value === "transferencia" ||
    value === "tarjeta" ||
    value === "efectivo" ||
    value === "otro"
  ) {
    return value;
  }

  return "otro";
}

function normalizarPeriodicidad(value: unknown): PeriodicidadPagoFijo {
  return value === "quincenal" ? "quincenal" : "mensual";
}

function normalizarMonto(value: unknown, fallback: number): number {
  const numero = Number(value);
  return Number.isFinite(numero) && numero >= 0 ? numero : fallback;
}

function normalizarLimites(value: unknown): LimitesVariables {
  const data =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return CATEGORIA_KEYS.reduce((resultado, key) => {
    const limite =
      typeof data[key] === "object" && data[key] !== null
        ? (data[key] as Record<string, unknown>)
        : {};

    resultado[key] = {
      mensual: normalizarMonto(
        limite.mensual,
        LIMITES_PREDETERMINADOS[key].mensual,
      ),
      quincenal: normalizarMonto(
        limite.quincenal,
        LIMITES_PREDETERMINADOS[key].quincenal,
      ),
    };

    return resultado;
  }, {} as LimitesVariables);
}

function porcentaje(usado: number, limite: number): number {
  if (limite <= 0) return 0;
  return (usado / limite) * 100;
}

function anchoBarra(valor: number): number {
  return Math.min(Math.max(valor, 0), 100);
}

function colorBarra(valor: number): string {
  if (valor >= 100) return "bg-rose-600";
  if (valor >= 90) return "bg-rose-500";
  if (valor >= 70) return "bg-amber-400";
  return "bg-emerald-500";
}

function montoSeguro(value: string): number | null {
  const numero = Number(value);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function fechaCorta(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString("es-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Home() {
  const hoy = useMemo(() => new Date(), []);
  const periodoInicial = obtenerPeriodo(hoy);

  const [gastos, setGastos] = useState<GastoVariable[]>([]);
  const [pagos, setPagos] = useState<PagoTarjeta[]>([]);
  const [pagosFijos, setPagosFijos] = useState<PagoFijo[]>([]);
  const [limites, setLimites] = useState<LimitesVariables>(
    LIMITES_PREDETERMINADOS,
  );
  const [limitesEditables, setLimitesEditables] =
    useState<LimitesVariables>(LIMITES_PREDETERMINADOS);

  const [periodoActual, setPeriodoActual] = useState(periodoInicial);
  const [mesSeleccionado, setMesSeleccionado] = useState(periodoInicial);
  const [quincenaSeleccionada, setQuincenaSeleccionada] = useState<Quincena>(
    obtenerQuincena(hoy),
  );
  const [vista, setVista] = useState<Vista>("fijos");
  const [tipoMovimiento, setTipoMovimiento] =
    useState<TipoMovimiento>("gasto");

  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState<CategoriaVariable>("comida");
  const [categoriaPago, setCategoriaPago] =
    useState<CategoriaPago>("general");
  const [fechaMovimiento, setFechaMovimiento] = useState(fechaInputLocal());

  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);
  const [mostrarPagoFijo, setMostrarPagoFijo] = useState(false);
  const [compromisoSeleccionadoId, setCompromisoSeleccionadoId] =
    useState("");
  const [montoPagoFijo, setMontoPagoFijo] = useState("");
  const [fechaPagoFijo, setFechaPagoFijo] = useState(fechaInputLocal());
  const [metodoPagoFijo, setMetodoPagoFijo] =
    useState<MetodoPagoFijo>("transferencia");
  const [periodicidadPagoFijo, setPeriodicidadPagoFijo] =
    useState<PeriodicidadPagoFijo>("mensual");
  const [referenciaPagoFijo, setReferenciaPagoFijo] = useState("");
  const [notasPagoFijo, setNotasPagoFijo] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [guardandoPagoFijo, setGuardandoPagoFijo] = useState(false);
  const [guardandoLimites, setGuardandoLimites] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [eliminandoPagoFijoId, setEliminandoPagoFijoId] = useState<
    string | null
  >(null);
  const [cargandoGastos, setCargandoGastos] = useState(true);
  const [cargandoPagos, setCargandoPagos] = useState(true);
  const [cargandoPagosFijos, setCargandoPagosFijos] = useState(true);
  const [cargandoLimites, setCargandoLimites] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permisoNotificaciones, setPermisoNotificaciones] =
    useState<NotificationPermission | "unsupported">("default");

  const periodoActualRef = useRef(periodoInicial);

  useEffect(() => {
    const consulta = query(collection(db, "gastos"), orderBy("fecha", "desc"));

    return onSnapshot(
      consulta,
      (snapshot) => {
        const registros = snapshot.docs.flatMap((documento) => {
          const data = documento.data();
          const categoriaNormalizada = normalizarCategoriaGasto(data.categoria);

          if (!categoriaNormalizada) return [];

          return [
            {
              id: documento.id,
              concepto:
                typeof data.concepto === "string"
                  ? data.concepto
                  : "Gasto sin descripción",
              monto: normalizarMonto(data.monto, 0),
              categoria: categoriaNormalizada,
              fecha:
                typeof data.fecha === "string"
                  ? data.fecha
                  : new Date().toISOString(),
            } satisfies GastoVariable,
          ];
        });

        setGastos(registros);
        setCargandoGastos(false);
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError("No se pudieron cargar los gastos.");
        setCargandoGastos(false);
      },
    );
  }, []);

  useEffect(() => {
    const consulta = query(
      collection(db, "pagosTarjeta"),
      orderBy("fecha", "desc"),
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
        const registros = snapshot.docs.map((documento) => {
          const data = documento.data();

          return {
            id: documento.id,
            concepto:
              typeof data.concepto === "string"
                ? data.concepto
                : typeof data.tarjeta === "string"
                  ? data.tarjeta
                  : "Pago a tarjeta",
            monto: normalizarMonto(data.monto, 0),
            categoria: normalizarCategoriaPago(data.categoria),
            fecha:
              typeof data.fecha === "string"
                ? data.fecha
                : new Date().toISOString(),
          } satisfies PagoTarjeta;
        });

        setPagos(registros);
        setCargandoPagos(false);
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError("No se pudieron cargar los pagos de Comida y Gas.");
        setCargandoPagos(false);
      },
    );
  }, []);

  useEffect(() => {
    const consulta = query(
      collection(db, "pagosFijos"),
      orderBy("fecha", "desc"),
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
        const registros = snapshot.docs.map((documento) => {
          const data = documento.data();
          const compromiso = COMPROMISOS_FIJOS.find(
            (item) => item.id === data.compromisoId,
          );

          return {
            id: documento.id,
            compromisoId:
              typeof data.compromisoId === "string"
                ? data.compromisoId
                : "sin-asignar",
            descripcion:
              typeof data.descripcion === "string"
                ? data.descripcion
                : compromiso?.descripcion ?? "Pago fijo",
            monto: normalizarMonto(data.monto, 0),
            fecha:
              typeof data.fecha === "string"
                ? data.fecha
                : new Date().toISOString(),
            metodo: normalizarMetodoPago(data.metodo),
            periodicidad: normalizarPeriodicidad(data.periodicidad),
            referencia:
              typeof data.referencia === "string" ? data.referencia : "",
            notas: typeof data.notas === "string" ? data.notas : "",
          } satisfies PagoFijo;
        });

        setPagosFijos(registros);
        setCargandoPagosFijos(false);
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError("No se pudieron cargar los pagos de gastos fijos.");
        setCargandoPagosFijos(false);
      },
    );
  }, []);

  useEffect(() => {
    const referencia = doc(db, "configuracion", "presupuestoFelo");

    return onSnapshot(
      referencia,
      (snapshot) => {
        if (snapshot.exists()) {
          const limitesGuardados = normalizarLimites(snapshot.data().limites);
          setLimites(limitesGuardados);
          setLimitesEditables(limitesGuardados);
        } else {
          setLimites(LIMITES_PREDETERMINADOS);
          setLimitesEditables(LIMITES_PREDETERMINADOS);
        }

        setCargandoLimites(false);
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError("No se pudo cargar la configuración del presupuesto.");
        setCargandoLimites(false);
      },
    );
  }, []);

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermisoNotificaciones("unsupported");
      return;
    }

    setPermisoNotificaciones(Notification.permission);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nuevoPeriodo = obtenerPeriodo(new Date());

      if (nuevoPeriodo !== periodoActualRef.current) {
        periodoActualRef.current = nuevoPeriodo;
        setPeriodoActual(nuevoPeriodo);
        setMesSeleccionado(nuevoPeriodo);
        setQuincenaSeleccionada(obtenerQuincena(new Date()));
      }
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const gastosMes = useMemo(
    () =>
      gastos.filter(
        (gasto) => obtenerPeriodoDesdeISO(gasto.fecha) === mesSeleccionado,
      ),
    [gastos, mesSeleccionado],
  );

  const pagosMes = useMemo(
    () =>
      pagos.filter(
        (pago) => obtenerPeriodoDesdeISO(pago.fecha) === mesSeleccionado,
      ),
    [pagos, mesSeleccionado],
  );

  const pagosFijosMes = useMemo(
    () =>
      pagosFijos.filter(
        (pago) => obtenerPeriodoDesdeISO(pago.fecha) === mesSeleccionado,
      ),
    [pagosFijos, mesSeleccionado],
  );

  const gastosQuincena = useMemo(
    () =>
      gastosMes.filter(
        (gasto) =>
          obtenerQuincenaDesdeISO(gasto.fecha) === quincenaSeleccionada,
      ),
    [gastosMes, quincenaSeleccionada],
  );

  const pagosQuincena = useMemo(
    () =>
      pagosMes.filter(
        (pago) =>
          obtenerQuincenaDesdeISO(pago.fecha) === quincenaSeleccionada,
      ),
    [pagosMes, quincenaSeleccionada],
  );

  const pagosFijosQuincena = useMemo(
    () =>
      pagosFijosMes.filter(
        (pago) =>
          obtenerQuincenaDesdeISO(pago.fecha) === quincenaSeleccionada,
      ),
    [pagosFijosMes, quincenaSeleccionada],
  );

  const totalFijo = useMemo(
    () => COMPROMISOS_FIJOS.reduce((total, gasto) => total + gasto.monto, 0),
    [],
  );

  const limiteVariableMensual = useMemo(
    () =>
      CATEGORIA_KEYS.reduce(
        (total, key) => total + limites[key].mensual,
        0,
      ),
    [limites],
  );

  const limiteVariableQuincenal = useMemo(
    () =>
      CATEGORIA_KEYS.reduce(
        (total, key) => total + limites[key].quincenal,
        0,
      ),
    [limites],
  );

  const totalPlanMensual = totalFijo + limiteVariableMensual;

  const totalGastosMes = gastosMes.reduce(
    (total, gasto) => total + gasto.monto,
    0,
  );
  const totalPagosMes = pagosMes.reduce(
    (total, pago) => total + pago.monto,
    0,
  );
  const saldoVariableMes = Math.max(totalGastosMes - totalPagosMes, 0);
  const disponibleVariableMes = Math.max(
    limiteVariableMensual - saldoVariableMes,
    0,
  );
  const porcentajeVariableMes = porcentaje(
    saldoVariableMes,
    limiteVariableMensual,
  );

  const totalGastosQuincena = gastosQuincena.reduce(
    (total, gasto) => total + gasto.monto,
    0,
  );
  const totalPagosQuincena = pagosQuincena.reduce(
    (total, pago) => total + pago.monto,
    0,
  );
  const saldoVariableQuincena = Math.max(
    totalGastosQuincena - totalPagosQuincena,
    0,
  );
  const disponibleVariableQuincena = Math.max(
    limiteVariableQuincenal - saldoVariableQuincena,
    0,
  );

  const totalPagadoFijoMes = pagosFijosMes.reduce(
    (total, pago) => total + pago.monto,
    0,
  );
  const totalPendienteFijoMes = Math.max(totalFijo - totalPagadoFijoMes, 0);
  const porcentajeFijoPagado = porcentaje(totalPagadoFijoMes, totalFijo);
  const totalPagadoFijoQuincena = pagosFijosQuincena.reduce(
    (total, pago) => total + pago.monto,
    0,
  );

  const resumenCategorias = useMemo(
    () =>
      CATEGORIA_KEYS.map((key) => {
        const gastosCategoriaMes = gastosMes
          .filter((gasto) => gasto.categoria === key)
          .reduce((total, gasto) => total + gasto.monto, 0);
        const pagosCategoriaMes = pagosMes
          .filter((pago) => pago.categoria === key)
          .reduce((total, pago) => total + pago.monto, 0);
        const saldoMes = Math.max(gastosCategoriaMes - pagosCategoriaMes, 0);

        const gastosCategoriaQuincena = gastosQuincena
          .filter((gasto) => gasto.categoria === key)
          .reduce((total, gasto) => total + gasto.monto, 0);
        const pagosCategoriaQuincena = pagosQuincena
          .filter((pago) => pago.categoria === key)
          .reduce((total, pago) => total + pago.monto, 0);
        const saldoQuincena = Math.max(
          gastosCategoriaQuincena - pagosCategoriaQuincena,
          0,
        );

        return {
          key,
          saldoMes,
          disponibleMes: Math.max(limites[key].mensual - saldoMes, 0),
          porcentajeMes: porcentaje(saldoMes, limites[key].mensual),
          saldoQuincena,
          disponibleQuincena: Math.max(
            limites[key].quincenal - saldoQuincena,
            0,
          ),
          porcentajeQuincena: porcentaje(
            saldoQuincena,
            limites[key].quincenal,
          ),
        };
      }),
    [gastosMes, gastosQuincena, limites, pagosMes, pagosQuincena],
  );

  const resumenFijos = useMemo(
    () =>
      COMPROMISOS_FIJOS.map((compromiso) => {
        const registrosMes = pagosFijosMes.filter(
          (pago) => pago.compromisoId === compromiso.id,
        );
        const registrosQuincena = pagosFijosQuincena.filter(
          (pago) => pago.compromisoId === compromiso.id,
        );
        const pagadoMes = registrosMes.reduce(
          (total, pago) => total + pago.monto,
          0,
        );
        const pagadoQuincena = registrosQuincena.reduce(
          (total, pago) => total + pago.monto,
          0,
        );
        const pendienteMes = Math.max(compromiso.monto - pagadoMes, 0);
        const ultimoPago = registrosMes[0] ?? null;

        return {
          compromiso,
          registrosMes,
          pagadoMes,
          pagadoQuincena,
          pendienteMes,
          porcentajePagado: porcentaje(pagadoMes, compromiso.monto),
          ultimoPago,
          estado:
            pagadoMes >= compromiso.monto
              ? ("pagado" as const)
              : pagadoMes > 0
                ? ("parcial" as const)
                : ("pendiente" as const),
        };
      }),
    [pagosFijosMes, pagosFijosQuincena],
  );

  const movimientos = useMemo<Movimiento[]>(
    () =>
      [
        ...gastosMes.map((gasto) => ({ ...gasto, tipo: "gasto" as const })),
        ...pagosMes.map((pago) => ({ ...pago, tipo: "pago" as const })),
      ].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      ),
    [gastosMes, pagosMes],
  );

  const mesesDisponibles = useMemo(() => {
    const periodos = new Set<string>([periodoActual]);

    [...gastos, ...pagos, ...pagosFijos].forEach((registro) => {
      const periodo = obtenerPeriodoDesdeISO(registro.fecha);
      if (periodo) periodos.add(periodo);
    });

    return Array.from(periodos).sort((a, b) => b.localeCompare(a));
  }, [gastos, pagos, pagosFijos, periodoActual]);

  useEffect(() => {
    if (
      mesSeleccionado !== periodoActual ||
      permisoNotificaciones !== "granted"
    ) {
      return;
    }

    const alertas: Array<{ id: string; titulo: string; mensaje: string }> = [];

    resumenCategorias.forEach((resumen) => {
      const config = CATEGORIAS_VARIABLES[resumen.key];

      if (resumen.porcentajeMes >= 90) {
        alertas.push({
          id: `${periodoActual}-${resumen.key}-mensual-${
            resumen.porcentajeMes >= 100 ? "100" : "90"
          }`,
          titulo: `${config.label}: alerta mensual`,
          mensaje: `Has utilizado ${resumen.porcentajeMes.toFixed(
            0,
          )}% del límite mensual de ${config.label}.`,
        });
      }

      if (resumen.porcentajeQuincena >= 90) {
        alertas.push({
          id: `${periodoActual}-${quincenaSeleccionada}-${
            resumen.key
          }-quincenal-${resumen.porcentajeQuincena >= 100 ? "100" : "90"}`,
          titulo: `${config.label}: alerta quincenal`,
          mensaje: `Has utilizado ${resumen.porcentajeQuincena.toFixed(
            0,
          )}% del límite de la ${quincenaSeleccionada}.ª quincena.`,
        });
      }
    });

    alertas.forEach((alerta) => {
      const storageKey = `presupuesto-felo-alerta-${alerta.id}`;
      if (window.localStorage.getItem(storageKey)) return;

      new Notification(alerta.titulo, {
        body: alerta.mensaje,
        icon: "/favicon.ico",
      });
      window.localStorage.setItem(storageKey, "enviada");
    });
  }, [
    mesSeleccionado,
    periodoActual,
    permisoNotificaciones,
    quincenaSeleccionada,
    resumenCategorias,
  ]);

  const solicitarNotificaciones = async () => {
    if (!("Notification" in window)) {
      setPermisoNotificaciones("unsupported");
      return;
    }

    const permiso = await Notification.requestPermission();
    setPermisoNotificaciones(permiso);
  };

  const registrarMovimiento = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const montoNumerico = montoSeguro(monto);

    if (!concepto.trim()) {
      setError("Escribe una descripción para el movimiento.");
      return;
    }

    if (!montoNumerico) {
      setError("El monto debe ser mayor que cero.");
      return;
    }

    if (!fechaMovimiento) {
      setError("Selecciona la fecha del movimiento.");
      return;
    }

    setGuardando(true);

    try {
      if (tipoMovimiento === "gasto") {
        await addDoc(collection(db, "gastos"), {
          concepto: concepto.trim(),
          monto: montoNumerico,
          categoria,
          fecha: convertirFechaInputAISO(fechaMovimiento),
        });
      } else {
        await addDoc(collection(db, "pagosTarjeta"), {
          concepto: concepto.trim(),
          tarjeta: concepto.trim(),
          monto: montoNumerico,
          categoria: categoriaPago,
          fecha: convertirFechaInputAISO(fechaMovimiento),
        });
      }

      setConcepto("");
      setMonto("");
      setFechaMovimiento(fechaInputLocal());
    } catch (guardarError) {
      console.error(guardarError);
      setError("No se pudo guardar el movimiento. Revisa Firebase.");
    } finally {
      setGuardando(false);
    }
  };

  const abrirRegistroPagoFijo = (compromiso: CompromisoFijo) => {
    const resumen = resumenFijos.find(
      (item) => item.compromiso.id === compromiso.id,
    );

    setCompromisoSeleccionadoId(compromiso.id);
    setMontoPagoFijo(
      String(resumen?.pendienteMes || compromiso.monto),
    );
    setFechaPagoFijo(fechaParaPeriodo(mesSeleccionado, quincenaSeleccionada));
    setMetodoPagoFijo("transferencia");
    setPeriodicidadPagoFijo("mensual");
    setReferenciaPagoFijo("");
    setNotasPagoFijo("");
    setMostrarPagoFijo(true);
  };

  const registrarPagoFijo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const compromiso = COMPROMISOS_FIJOS.find(
      (item) => item.id === compromisoSeleccionadoId,
    );
    const montoNumerico = montoSeguro(montoPagoFijo);

    if (!compromiso) {
      setError("Selecciona un gasto fijo.");
      return;
    }

    if (!montoNumerico) {
      setError("El monto del pago debe ser mayor que cero.");
      return;
    }

    if (!fechaPagoFijo) {
      setError("Selecciona la fecha del pago.");
      return;
    }

    setGuardandoPagoFijo(true);

    try {
      await addDoc(collection(db, "pagosFijos"), {
        compromisoId: compromiso.id,
        descripcion: compromiso.descripcion,
        monto: montoNumerico,
        fecha: convertirFechaInputAISO(fechaPagoFijo),
        metodo: metodoPagoFijo,
        periodicidad: periodicidadPagoFijo,
        quincena: obtenerQuincena(
          new Date(`${fechaPagoFijo}T12:00:00`),
        ),
        periodo: fechaPagoFijo.slice(0, 7),
        referencia: referenciaPagoFijo.trim(),
        notas: notasPagoFijo.trim(),
        creadoEn: new Date().toISOString(),
      });

      setMostrarPagoFijo(false);
    } catch (guardarError) {
      console.error(guardarError);
      setError("No se pudo registrar el pago fijo.");
    } finally {
      setGuardandoPagoFijo(false);
    }
  };

  const eliminarMovimiento = async (movimiento: Movimiento) => {
    const confirmado = window.confirm(
      `¿Eliminar "${movimiento.concepto}" por ${formatoMoneda.format(
        movimiento.monto,
      )}?`,
    );

    if (!confirmado) return;

    setEliminandoId(`${movimiento.tipo}-${movimiento.id}`);
    setError(null);

    try {
      const coleccion =
        movimiento.tipo === "gasto" ? "gastos" : "pagosTarjeta";
      await deleteDoc(doc(db, coleccion, movimiento.id));
    } catch (eliminarError) {
      console.error(eliminarError);
      setError("No se pudo eliminar el movimiento.");
    } finally {
      setEliminandoId(null);
    }
  };

  const eliminarPagoFijo = async (pago: PagoFijo) => {
    const confirmado = window.confirm(
      `¿Eliminar el pago de ${pago.descripcion} por ${formatoMoneda.format(
        pago.monto,
      )}?`,
    );

    if (!confirmado) return;

    setEliminandoPagoFijoId(pago.id);
    setError(null);

    try {
      await deleteDoc(doc(db, "pagosFijos", pago.id));
    } catch (eliminarError) {
      console.error(eliminarError);
      setError("No se pudo eliminar el pago fijo.");
    } finally {
      setEliminandoPagoFijoId(null);
    }
  };

  const guardarLimites = async () => {
    const limitesValidados = normalizarLimites(limitesEditables);

    setGuardandoLimites(true);
    setError(null);

    try {
      await setDoc(
        doc(db, "configuracion", "presupuestoFelo"),
        {
          limites: limitesValidados,
          actualizadoEn: new Date().toISOString(),
        },
        { merge: true },
      );

      setMostrarConfiguracion(false);
    } catch (guardarError) {
      console.error(guardarError);
      setError("No se pudieron guardar los límites.");
    } finally {
      setGuardandoLimites(false);
    }
  };

  const cargando =
    cargandoGastos ||
    cargandoPagos ||
    cargandoPagosFijos ||
    cargandoLimites;

  const compromisoSeleccionado = COMPROMISOS_FIJOS.find(
    (item) => item.id === compromisoSeleccionadoId,
  );

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-4 text-slate-900 antialiased sm:px-5">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-5 text-white sm:p-7">
          <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
                Presupuesto mensual de Felo
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                {formatoMoneda.format(totalPlanMensual)}
              </h1>
              <p className="mt-1 text-xs text-slate-300">
                {formatoMoneda.format(totalFijo)} fijos +{" "}
                {formatoMoneda.format(limiteVariableMensual)} variables
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={solicitarNotificaciones}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10 active:scale-95"
                title="Activar notificaciones"
              >
                {permisoNotificaciones === "granted" ? (
                  <Bell className="h-4 w-4 text-emerald-300" />
                ) : (
                  <BellOff className="h-4 w-4 text-indigo-200" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLimitesEditables(limites);
                  setMostrarConfiguracion(true);
                }}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10 active:scale-95"
                title="Configurar límites"
              >
                <Settings className="h-4 w-4 text-indigo-200" />
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Saldo variable
              </p>
              <p className="mt-1 text-lg font-black">
                {formatoMoneda.format(saldoVariableMes)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Disponible
              </p>
              <p className="mt-1 text-lg font-black text-emerald-300">
                {formatoMoneda.format(disponibleVariableMes)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Fijos pagados
              </p>
              <p className="mt-1 text-lg font-black text-cyan-200">
                {formatoMoneda.format(totalPagadoFijoMes)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Fijos pendientes
              </p>
              <p className="mt-1 text-lg font-black text-amber-200">
                {formatoMoneda.format(totalPendienteFijoMes)}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-5 p-4 pb-24 sm:p-6 sm:pb-24">
          <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-xs font-black text-slate-600">
              <CalendarDays className="h-4 w-4 text-indigo-600" />
              Período
              <select
                value={mesSeleccionado}
                onChange={(event) => setMesSeleccionado(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                {mesesDisponibles.map((periodo) => (
                  <option key={periodo} value={periodo}>
                    {etiquetaMes(periodo)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex rounded-2xl bg-slate-200/70 p-1">
              {([1, 2] as Quincena[]).map((quincena) => (
                <button
                  key={quincena}
                  type="button"
                  onClick={() => setQuincenaSeleccionada(quincena)}
                  className={`flex-1 rounded-xl px-4 py-2 text-xs font-black transition ${
                    quincenaSeleccionada === quincena
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  {quincena}.ª quincena
                </button>
              ))}
            </div>
          </section>

          {mesSeleccionado !== periodoActual && (
            <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-xs font-semibold text-indigo-800">
              <RefreshCw className="h-4 w-4 shrink-0" />
              Estás viendo un mes anterior. Los estados se calculan usando los
              pagos registrados para ese mes.
            </div>
          )}

          {error && (
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {porcentajeVariableMes >= 90 && (
            <div
              className={`flex items-center gap-3 rounded-2xl border p-3 ${
                porcentajeVariableMes >= 100
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <Flame className="h-5 w-5 shrink-0" />
              <p className="text-xs font-bold">
                {porcentajeVariableMes >= 100
                  ? "Alcanzaste o superaste el límite variable mensual."
                  : "Ya utilizaste al menos 90% del límite variable mensual."}
              </p>
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-2">
            {resumenCategorias.map((resumen) => {
              const config = CATEGORIAS_VARIABLES[resumen.key];
              const Icono = config.icon;

              return (
                <article
                  key={resumen.key}
                  className={`rounded-3xl border ${config.border} ${config.light} p-4`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-2xl ${config.color} p-2.5 text-white`}>
                        <Icono className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className={`font-black ${config.text}`}>
                          {config.label}
                        </h2>
                        <p className="text-[11px] text-slate-500">
                          Mensual {formatoMoneda.format(limites[resumen.key].mensual)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full bg-white/80 px-2 py-1 text-[10px] font-black ${
                        resumen.porcentajeMes >= 90
                          ? "text-rose-600"
                          : "text-slate-600"
                      }`}
                    >
                      {resumen.porcentajeMes.toFixed(0)}%
                    </span>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
                    <div
                      className={`h-full rounded-full transition-all ${colorBarra(
                        resumen.porcentajeMes,
                      )}`}
                      style={{ width: `${anchoBarra(resumen.porcentajeMes)}%` }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-2xl bg-white/70 p-2.5">
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Debes
                      </p>
                      <p className="mt-1 font-black text-slate-800">
                        {formatoMoneda.format(resumen.saldoMes)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/70 p-2.5">
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Disponible
                      </p>
                      <p className="mt-1 font-black text-emerald-700">
                        {formatoMoneda.format(resumen.disponibleMes)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-white/60 p-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-500">
                        {quincenaSeleccionada}.ª quincena
                      </span>
                      <strong
                        className={
                          resumen.porcentajeQuincena >= 90
                            ? "text-rose-600"
                            : "text-slate-700"
                        }
                      >
                        {resumen.porcentajeQuincena.toFixed(0)}%
                      </strong>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${colorBarra(
                          resumen.porcentajeQuincena,
                        )}`}
                        style={{
                          width: `${anchoBarra(resumen.porcentajeQuincena)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                      <span>Saldo {formatoMoneda.format(resumen.saldoQuincena)}</span>
                      <span>
                        Disponible {formatoMoneda.format(resumen.disponibleQuincena)}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
                  Nuevo movimiento variable
                </p>
                <h2 className="text-lg font-black text-slate-900">
                  Solo Comida y Gas
                </h2>
              </div>
              <div className="flex rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setTipoMovimiento("gasto")}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                    tipoMovimiento === "gasto"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setTipoMovimiento("pago")}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                    tipoMovimiento === "pago"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Pago
                </button>
              </div>
            </div>

            <form onSubmit={registrarMovimiento} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <input
                  type="text"
                  value={concepto}
                  onChange={(event) => setConcepto(event.target.value)}
                  placeholder={
                    tipoMovimiento === "gasto"
                      ? "Ej.: Walmart, restaurante o gasolinera"
                      : "Ej.: Pago AMEX o transferencia"
                  }
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-indigo-500 focus:bg-white"
                  required
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={monto}
                  onChange={(event) => setMonto(event.target.value)}
                  placeholder="Monto"
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none transition focus:border-indigo-500 focus:bg-white"
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  value={fechaMovimiento}
                  onChange={(event) => setFechaMovimiento(event.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-indigo-500 focus:bg-white"
                  required
                />

                {tipoMovimiento === "gasto" ? (
                  <select
                    value={categoria}
                    onChange={(event) =>
                      setCategoria(event.target.value as CategoriaVariable)
                    }
                    className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="comida">Comida</option>
                    <option value="gas">Gas</option>
                  </select>
                ) : (
                  <select
                    value={categoriaPago}
                    onChange={(event) =>
                      setCategoriaPago(event.target.value as CategoriaPago)
                    }
                    className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="general">Pago general a tarjeta</option>
                    <option value="comida">Aplicar a Comida</option>
                    <option value="gas">Aplicar a Gas</option>
                  </select>
                )}
              </div>

              <button
                type="submit"
                disabled={guardando}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black text-white shadow-lg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
                  tipoMovimiento === "gasto"
                    ? "bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700"
                    : "bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700"
                }`}
              >
                {guardando ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : tipoMovimiento === "gasto" ? (
                  <Plus className="h-4 w-4" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {tipoMovimiento === "gasto"
                  ? "Registrar gasto"
                  : "Registrar pago"}
              </button>
            </form>
          </section>

          <div className="flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setVista("fijos")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
                vista === "fijos"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <Landmark className="h-4 w-4" /> Pagos fijos
            </button>
            <button
              type="button"
              onClick={() => setVista("movimientos")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
                vista === "movimientos"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <List className="h-4 w-4" /> Comida y Gas
            </button>
          </div>

          {vista === "fijos" ? (
            <section className="space-y-4">
              <div className="rounded-3xl bg-slate-950 p-4 text-white shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">
                      Estado de compromisos fijos
                    </p>
                    <h2 className="mt-1 text-lg font-black">
                      {etiquetaMes(mesSeleccionado)}
                    </h2>
                  </div>
                  <span className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-black">
                    {porcentajeFijoPagado.toFixed(0)}%
                  </span>
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${anchoBarra(porcentajeFijoPagado)}%` }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-[9px] font-bold uppercase text-slate-400">
                      Pagado mes
                    </p>
                    <p className="mt-1 text-sm font-black text-emerald-300">
                      {formatoMoneda.format(totalPagadoFijoMes)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-[9px] font-bold uppercase text-slate-400">
                      Pendiente
                    </p>
                    <p className="mt-1 text-sm font-black text-amber-200">
                      {formatoMoneda.format(totalPendienteFijoMes)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-[9px] font-bold uppercase text-slate-400">
                      {quincenaSeleccionada}.ª quincena
                    </p>
                    <p className="mt-1 text-sm font-black text-cyan-200">
                      {formatoMoneda.format(totalPagadoFijoQuincena)}
                    </p>
                  </div>
                </div>
              </div>

              {cargando ? (
                <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white py-14 text-sm font-bold text-slate-400">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Cargando pagos
                </div>
              ) : (
                <div className="space-y-3">
                  {resumenFijos.map((resumen) => {
                    const pagado = resumen.estado === "pagado";
                    const parcial = resumen.estado === "parcial";

                    return (
                      <article
                        key={resumen.compromiso.id}
                        className={`rounded-3xl border p-4 shadow-sm ${
                          pagado
                            ? "border-emerald-200 bg-emerald-50/70"
                            : parcial
                              ? "border-amber-200 bg-amber-50/70"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`rounded-2xl p-2.5 text-white ${
                                pagado
                                  ? "bg-emerald-500"
                                  : parcial
                                    ? "bg-amber-500"
                                    : "bg-slate-400"
                              }`}
                            >
                              {pagado ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <Clock3 className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-black text-slate-900">
                                {resumen.compromiso.descripcion}
                              </h3>
                              <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                                Compromiso mensual {formatoMoneda.format(resumen.compromiso.monto)}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${
                              pagado
                                ? "bg-emerald-100 text-emerald-700"
                                : parcial
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {pagado
                              ? "Pagado"
                              : parcial
                                ? "Pago parcial"
                                : "Pendiente"}
                          </span>
                        </div>

                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className={`h-full rounded-full ${
                              pagado
                                ? "bg-emerald-500"
                                : parcial
                                  ? "bg-amber-400"
                                  : "bg-slate-300"
                            }`}
                            style={{
                              width: `${anchoBarra(resumen.porcentajePagado)}%`,
                            }}
                          />
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-2xl bg-white/80 p-2.5">
                            <p className="text-[9px] font-bold uppercase text-slate-400">
                              Pagado mes
                            </p>
                            <p className="mt-1 text-xs font-black text-emerald-700">
                              {formatoMoneda.format(resumen.pagadoMes)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white/80 p-2.5">
                            <p className="text-[9px] font-bold uppercase text-slate-400">
                              Quincena {quincenaSeleccionada}
                            </p>
                            <p className="mt-1 text-xs font-black text-indigo-700">
                              {formatoMoneda.format(resumen.pagadoQuincena)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white/80 p-2.5">
                            <p className="text-[9px] font-bold uppercase text-slate-400">
                              Pendiente
                            </p>
                            <p className="mt-1 text-xs font-black text-slate-800">
                              {formatoMoneda.format(resumen.pendienteMes)}
                            </p>
                          </div>
                        </div>

                        {resumen.ultimoPago && (
                          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white bg-white/70 p-3 text-[10px] font-semibold text-slate-600">
                            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span>
                              Último: {fechaCorta(resumen.ultimoPago.fecha)} ·{" "}
                              {METODOS_PAGO[resumen.ultimoPago.metodo]} ·{" "}
                              {formatoMoneda.format(resumen.ultimoPago.monto)}
                              {resumen.ultimoPago.referencia
                                ? ` · Ref. ${resumen.ultimoPago.referencia}`
                                : ""}
                            </span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => abrirRegistroPagoFijo(resumen.compromiso)}
                          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-xs font-black text-white transition hover:bg-indigo-700 active:scale-[0.99]"
                        >
                          <Banknote className="h-4 w-4" />
                          {pagado
                            ? "Registrar otro pago"
                            : "Registrar pago o transferencia"}
                        </button>

                        {resumen.registrosMes.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                              Pagos registrados este mes
                            </p>
                            {resumen.registrosMes.map((pago) => (
                              <div
                                key={pago.id}
                                className="flex items-center gap-3 rounded-2xl bg-white/80 p-2.5"
                              >
                                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                                  {pago.metodo === "transferencia" ||
                                  pago.metodo === "debito_automatico" ? (
                                    <Landmark className="h-3.5 w-3.5" />
                                  ) : (
                                    <WalletCards className="h-3.5 w-3.5" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[11px] font-black text-slate-800">
                                    {METODOS_PAGO[pago.metodo]} ·{" "}
                                    {pago.periodicidad === "mensual"
                                      ? "Mensual"
                                      : `${obtenerQuincenaDesdeISO(pago.fecha)}.ª quincena`}
                                  </p>
                                  <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">
                                    {fechaCorta(pago.fecha)}
                                    {pago.referencia
                                      ? ` · Ref. ${pago.referencia}`
                                      : ""}
                                    {pago.notas ? ` · ${pago.notas}` : ""}
                                  </p>
                                </div>
                                <strong className="text-xs text-emerald-700">
                                  {formatoMoneda.format(pago.monto)}
                                </strong>
                                <button
                                  type="button"
                                  onClick={() => eliminarPagoFijo(pago)}
                                  disabled={eliminandoPagoFijoId === pago.id}
                                  className="rounded-lg p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
                                  title="Eliminar pago fijo"
                                >
                                  {eliminandoPagoFijoId === pago.id ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Historial variable
                  </p>
                  <h2 className="mt-1 text-lg font-black">
                    {etiquetaMes(mesSeleccionado)}
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
                  {movimientos.length} movimientos
                </span>
              </div>

              {cargando ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-slate-400">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Cargando
                </div>
              ) : movimientos.length === 0 ? (
                <div className="py-12 text-center">
                  <ReceiptText className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-500">
                    No hay movimientos en este mes.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {movimientos.map((movimiento) => {
                    const esGasto = movimiento.tipo === "gasto";
                    const etiquetaCategoria =
                      movimiento.tipo === "gasto"
                        ? CATEGORIAS_VARIABLES[movimiento.categoria].label
                        : movimiento.categoria === "general"
                          ? "Pago general"
                          : CATEGORIAS_VARIABLES[movimiento.categoria].label;
                    const idEliminacion = `${movimiento.tipo}-${movimiento.id}`;

                    return (
                      <article
                        key={idEliminacion}
                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <div
                          className={`rounded-xl p-2.5 text-white ${
                            esGasto ? "bg-slate-800" : "bg-emerald-500"
                          }`}
                        >
                          {movimiento.tipo === "gasto" ? (
                            movimiento.categoria === "comida" ? (
                              <Utensils className="h-4 w-4" />
                            ) : (
                              <Car className="h-4 w-4" />
                            )
                          ) : (
                            <WalletCards className="h-4 w-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-800">
                            {movimiento.concepto}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                            {etiquetaCategoria} · {fechaCorta(movimiento.fecha)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p
                            className={`text-sm font-black ${
                              esGasto ? "text-slate-900" : "text-emerald-600"
                            }`}
                          >
                            {esGasto ? "−" : "+"}
                            {formatoMoneda.format(movimiento.monto)}
                          </p>
                          <button
                            type="button"
                            onClick={() => eliminarMovimiento(movimiento)}
                            disabled={eliminandoId === idEliminacion}
                            className="mt-1 rounded-lg p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
                            title="Eliminar movimiento"
                          >
                            {eliminandoId === idEliminacion ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        <nav className="fixed bottom-3 left-1/2 z-30 flex w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 items-center justify-around rounded-3xl border border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-2xl backdrop-blur sm:bottom-5">
          <button
            type="button"
            onClick={() => {
              setVista("fijos");
              window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
            }}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
              vista === "fijos" ? "text-indigo-300" : "text-slate-500"
            }`}
          >
            <PiggyBank className="h-5 w-5" /> Pagos fijos
          </button>
          <button
            type="button"
            onClick={() => {
              setTipoMovimiento("gasto");
              window.scrollTo({ top: 650, behavior: "smooth" });
            }}
            className="-mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-900/40 transition active:scale-95"
            title="Registrar gasto variable"
          >
            <Plus className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => {
              setVista("movimientos");
              window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
            }}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
              vista === "movimientos" ? "text-indigo-300" : "text-slate-500"
            }`}
          >
            <List className="h-5 w-5" /> Historial
          </button>
        </nav>
      </div>

      {mostrarPagoFijo && compromisoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center">
          <section className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
                  Confirmar pago realizado
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {compromisoSeleccionado.descripcion}
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Compromiso mensual: {formatoMoneda.format(compromisoSeleccionado.monto)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarPagoFijo(false)}
                className="rounded-xl bg-slate-100 p-2 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={registrarPagoFijo} className="mt-5 space-y-3">
              <label className="block text-[10px] font-black uppercase text-slate-500">
                Monto pagado
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={montoPagoFijo}
                  onChange={(event) => setMontoPagoFijo(event.target.value)}
                  className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-emerald-500 focus:bg-white"
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[10px] font-black uppercase text-slate-500">
                  Fecha realizada
                  <input
                    type="date"
                    value={fechaPagoFijo}
                    onChange={(event) => setFechaPagoFijo(event.target.value)}
                    className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white"
                    required
                  />
                </label>

                <label className="block text-[10px] font-black uppercase text-slate-500">
                  Control
                  <select
                    value={periodicidadPagoFijo}
                    onChange={(event) =>
                      setPeriodicidadPagoFijo(
                        event.target.value as PeriodicidadPagoFijo,
                      )
                    }
                    className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white"
                  >
                    <option value="mensual">Pago mensual</option>
                    <option value="quincenal">Pago quincenal</option>
                  </select>
                </label>
              </div>

              <label className="block text-[10px] font-black uppercase text-slate-500">
                Método
                <select
                  value={metodoPagoFijo}
                  onChange={(event) =>
                    setMetodoPagoFijo(event.target.value as MetodoPagoFijo)
                  }
                  className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white"
                >
                  {Object.entries(METODOS_PAGO).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[10px] font-black uppercase text-slate-500">
                Referencia o confirmación
                <input
                  type="text"
                  value={referenciaPagoFijo}
                  onChange={(event) => setReferenciaPagoFijo(event.target.value)}
                  placeholder="Opcional: número de confirmación"
                  className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </label>

              <label className="block text-[10px] font-black uppercase text-slate-500">
                Nota
                <textarea
                  value={notasPagoFijo}
                  onChange={(event) => setNotasPagoFijo(event.target.value)}
                  placeholder="Opcional: cuenta, destinatario o detalle"
                  rows={3}
                  className="mt-1 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </label>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                Se registrará como realizado en {fechaPagoFijo || "la fecha seleccionada"}
                {periodicidadPagoFijo === "quincenal" && fechaPagoFijo
                  ? `, ${obtenerQuincena(
                      new Date(`${fechaPagoFijo}T12:00:00`),
                    )}.ª quincena`
                  : ""}.
              </div>

              <button
                type="submit"
                disabled={guardandoPagoFijo}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {guardandoPagoFijo ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirmar pago realizado
              </button>
            </form>
          </section>
        </div>
      )}

      {mostrarConfiguracion && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:items-center">
          <section className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
                  Configuración
                </p>
                <h2 className="mt-1 text-xl font-black">
                  Límites de Comida y Gas
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMostrarConfiguracion(false)}
                className="rounded-xl bg-slate-100 p-2 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {CATEGORIA_KEYS.map((key) => {
                const config = CATEGORIAS_VARIABLES[key];
                const Icono = config.icon;

                return (
                  <div
                    key={key}
                    className={`rounded-2xl border ${config.border} ${config.light} p-4`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Icono className={`h-4 w-4 ${config.text}`} />
                      <h3 className={`text-sm font-black ${config.text}`}>
                        {config.label}
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-[10px] font-bold uppercase text-slate-500">
                        Mensual
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={limitesEditables[key].mensual}
                          onChange={(event) =>
                            setLimitesEditables((actual) => ({
                              ...actual,
                              [key]: {
                                ...actual[key],
                                mensual: Number(event.target.value),
                              },
                            }))
                          }
                          className="mt-1 h-11 w-full rounded-xl border border-white bg-white px-3 text-sm font-black outline-none focus:border-indigo-500"
                        />
                      </label>
                      <label className="text-[10px] font-bold uppercase text-slate-500">
                        Quincenal
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={limitesEditables[key].quincenal}
                          onChange={(event) =>
                            setLimitesEditables((actual) => ({
                              ...actual,
                              [key]: {
                                ...actual[key],
                                quincenal: Number(event.target.value),
                              },
                            }))
                          }
                          className="mt-1 h-11 w-full rounded-xl border border-white bg-white px-3 text-sm font-black outline-none focus:border-indigo-500"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={guardarLimites}
              disabled={guardandoLimites}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {guardandoLimites ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar límites
            </button>
          </section>
        </div>
      )}
    </main>
  );
}