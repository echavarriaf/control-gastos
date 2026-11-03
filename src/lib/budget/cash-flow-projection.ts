import type { CicloPago, CompromisoFijo, GastoVariable, Ingreso, PagoFijo, PagoTarjeta, TarjetaCredito } from "./types";
import type { CuentaGastos, ResumenCuentaGastos } from "./expense-account";
import { pagoFijoSaleDeCuenta } from "./expense-account";
import { esFechaCalendarioValida } from "./expense-account/validation";
import { redondearMoneda } from "./expense-account/utils";
import { pagoTarjetaSaleDeCuenta } from "./payment-origin";
import { crearResumenTarjeta } from "./credit-cards/summary";
import { calcularCalendarioPagoTarjeta } from "./credit-card-payment-calendar";
import { TOLERANCIA_MONEDA } from "./expense-account/constants";

export interface PartidaProyeccion {
  id: string;
  fecha: string;
  concepto: string;
  detalle: string;
  direccion: "entrada" | "salida";
  monto: number;
  tipo: "ingreso" | "proximo_cobro" | "fijo" | "tarjeta" | "pago_pendiente" | "variable";
}

interface ProyectarSaldoArgs {
  hoy: string;
  cuenta: CuentaGastos;
  resumenCuenta: Pick<ResumenCuentaGastos, "saldoActual">;
  proximoCiclo: CicloPago;
  montoEstimado: number;
  ingresos: Ingreso[];
  compromisos: CompromisoFijo[];
  pagosFijos: PagoFijo[];
  tarjetas: TarjetaCredito[];
  gastos: GastoVariable[];
  pagosTarjeta: PagoTarjeta[];
  otrosGastos?: number;
}

function fechaLocal(fecha: string) {
  const [year, month, day] = fecha.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}
function fechaVencimiento(periodo: string, dia: number) {
  const [year, month] = periodo.split("-").map(Number);
  const ultimo = new Date(year, month, 0).getDate();
  return `${periodo}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

/** A forecast starts from the existing bank balance, never from available-after-reserves. */
export function proyectarSaldoCuenta({ hoy, cuenta, resumenCuenta, proximoCiclo, montoEstimado, ingresos,
  compromisos, pagosFijos, tarjetas, gastos, pagosTarjeta, otrosGastos = 0 }: ProyectarSaldoArgs) {
  const fin = proximoCiclo.fechaPagoProgramada;
  if (!esFechaCalendarioValida(hoy) || !esFechaCalendarioValida(fin) || fin <= hoy || hoy < cuenta.fechaSaldoInicial) {
    throw new Error("La proyección requiere una cuenta vigente y un próximo cobro posterior a hoy.");
  }
  if (![resumenCuenta.saldoActual, montoEstimado, otrosGastos].every(Number.isFinite) || montoEstimado < 0 || otrosGastos < 0) {
    throw new Error("Revisa los importes de la proyección.");
  }
  const partidas: PartidaProyeccion[] = [];
  const agregar = (partida: PartidaProyeccion) => {
    if (partida.fecha >= hoy && partida.fecha <= fin && partida.monto > 0 && Number.isFinite(partida.monto)) {
      partidas.push({ ...partida, monto: redondearMoneda(partida.monto) });
    }
  };
  const ingresoCiclo = ingresos.find(ingreso => ingreso.id === proximoCiclo.id || ingreso.cicloPagoId === proximoCiclo.id);
  for (const ingreso of ingresos) {
    if (ingreso.estado !== "proyectado" || ingreso === ingresoCiclo || !esFechaCalendarioValida(ingreso.fechaProgramada)) continue;
    agregar({ id: `ingreso:${ingreso.id}`, fecha: ingreso.fechaProgramada, concepto: ingreso.descripcion,
      detalle: "Ingreso programado, aún no recibido", tipo: "ingreso", direccion: "entrada", monto: ingreso.monto });
  }
  if (!ingresoCiclo || ingresoCiclo.estado === "proyectado") {
    agregar({ id: `cobro:${proximoCiclo.id}`, fecha: ingresoCiclo?.fechaProgramada ?? fin,
      concepto: ingresoCiclo?.descripcion || "Próximo cobro", detalle: "Ingreso estimado, aún no recibido",
      tipo: "proximo_cobro", direccion: "entrada", monto: ingresoCiclo?.monto ?? montoEstimado });
  }

  const pagosIncluidos = new Set(cuenta.pagosFijosIncluidosEnSaldoInicial);
  // Enumerate calendar months rather than pay-cycle budget labels.
  let periodo = hoy.slice(0, 7);
  for (let mes = 0; periodo <= fin.slice(0, 7) && mes < 13; mes++) {
    for (const compromiso of compromisos) {
      if (!compromiso.activo) continue;
      const fecha = fechaVencimiento(periodo, compromiso.diaVencimiento);
      if (fecha > fin) continue;
      const pagos = pagosFijos.filter(pago => pago.compromisoId === compromiso.id && pago.fecha.slice(0, 7) === periodo);
      const registrado = redondearMoneda(pagos.reduce((total, pago) => total + pago.monto, 0));
      if (registrado + TOLERANCIA_MONEDA >= compromiso.monto) continue;
      const pendiente = redondearMoneda(Math.max(compromiso.monto - registrado, 0));
      // Bank accounting applies partial fixed payments only when the commitment is complete.
      // Include unapplied bank portions once; snapshot amounts already belong to the opening balance.
      const parcialBancoSinAplicar = pagos.filter(pago => pagoFijoSaleDeCuenta(pago) && !pagosIncluidos.has(pago.id)
        && pago.fecha.slice(0, 10) >= cuenta.fechaSaldoInicial).reduce((total, pago) => total + pago.monto, 0);
      const pendienteBanco = ["debito_automatico", "transferencia"].includes(compromiso.metodoPagoPreferido) ? pendiente : 0;
      agregar({ id: `fijo:${compromiso.id}:${periodo}`, fecha: fecha < hoy ? hoy : fecha,
        concepto: compromiso.descripcion, detalle: fecha < hoy ? `Vencimiento ${fecha}; importe bancario aún por aplicar` : "Pago fijo bancario previsto",
        direccion: "salida", tipo: "fijo", monto: parcialBancoSinAplicar + pendienteBanco });
    }
    const [year, month] = periodo.split("-").map(Number);
    periodo = `${year + (month === 12 ? 1 : 0)}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}`;
  }

  const pendientesHasta = (fecha: string) => pagosTarjeta.filter(pago => pago.estadoTarjeta === "pendiente" && pago.fecha.slice(0, 10) <= fecha);
  const pagosTarjetaIncluidos = new Set(cuenta.pagosTarjetaIncluidosEnSaldoInicial);
  for (const pago of pendientesHasta(fin)) {
    if (!pagoTarjetaSaleDeCuenta(pago) || pagosTarjetaIncluidos.has(pago.id) || pago.fecha.slice(0, 10) < cuenta.fechaSaldoInicial) continue;
    agregar({ id: `pendiente:${pago.id}`, fecha: pago.fecha.slice(0, 10) < hoy ? hoy : pago.fecha.slice(0, 10),
      concepto: pago.concepto || "Pago pendiente a tarjeta", detalle: "Se prevé su contabilización; la fecha puede variar",
      direccion: "salida", tipo: "pago_pendiente", monto: pago.monto });
  }
  for (const tarjeta of tarjetas) {
    if (!tarjeta.activa || tarjeta.fechaSaldoInicial.slice(0, 10) > hoy) continue;
    const calendario = calcularCalendarioPagoTarjeta(tarjeta.diaCorte, fechaLocal(hoy));
    const fecha = calendario.fechaObjetivoPagoISO < hoy ? hoy : calendario.fechaObjetivoPagoISO;
    if (fecha > fin) continue;
    const pagosHastaObjetivo = pagosTarjeta.filter(pago => pago.estadoTarjeta !== "pendiente" || pago.fecha.slice(0, 10) <= fecha);
    const resumen = crearResumenTarjeta(tarjeta,
      gastos.filter(gasto => gasto.fecha.slice(0, 10) <= fecha),
      pagosFijos.filter(pago => pago.fecha.slice(0, 10) <= fecha), pagosHastaObjetivo, fechaLocal(hoy));
    agregar({ id: `tarjeta:${tarjeta.id}`, fecha, concepto: tarjeta.nombre,
      detalle: `Saldo proyectado restante; pago previsto cinco días antes del corte (${calendario.fechaCorteISO})`,
      direccion: "salida", tipo: "tarjeta", monto: resumen.saldoProyectado });
  }
  agregar({ id: "otros-gastos", fecha: fin, concepto: "Otros gastos previstos", detalle: "Estimación indicada para este intervalo",
    direccion: "salida", tipo: "variable", monto: otrosGastos });

  // Same-day outflows precede deposits conservatively; the scheduled paycheck comes last.
  partidas.sort((a, b) => a.fecha.localeCompare(b.fecha)
    || Number(a.direccion === "entrada") - Number(b.direccion === "entrada")
    || Number(a.tipo === "proximo_cobro") - Number(b.tipo === "proximo_cobro")
    || a.id.localeCompare(b.id));
  let saldo = redondearMoneda(resumenCuenta.saldoActual);
  let saldoMinimo = saldo;
  let fechaSaldoMinimo = hoy;
  let entradasPrevistas = 0;
  let salidasPrevistas = 0;
  let cobroPrevisto = 0;
  let saldoAntesCobro: number | null = null;
  let saldoDespuesCobro: number | null = null;
  const movimientos = partidas.map(partida => {
    if (partida.direccion === "entrada") entradasPrevistas = redondearMoneda(entradasPrevistas + partida.monto);
    else salidasPrevistas = redondearMoneda(salidasPrevistas + partida.monto);
    if (partida.tipo === "proximo_cobro") {
      cobroPrevisto = redondearMoneda(cobroPrevisto + partida.monto);
      saldoAntesCobro = saldo;
    }
    saldo = redondearMoneda(saldo + (partida.direccion === "entrada" ? partida.monto : -partida.monto));
    if (partida.tipo === "proximo_cobro") saldoDespuesCobro = saldo;
    if (saldo < saldoMinimo) { saldoMinimo = saldo; fechaSaldoMinimo = partida.fecha; }
    return { ...partida, saldoDespues: saldo };
  });
  return { hoy, fin, saldoInicial: resumenCuenta.saldoActual, saldoAntesCobro: saldoAntesCobro ?? saldo,
    saldoDespuesCobro: saldoDespuesCobro ?? saldo, saldoFinal: saldo, saldoMinimo, fechaSaldoMinimo, entradasPrevistas, salidasPrevistas, cobroPrevisto,
    estadoCobro: ingresoCiclo?.estado ?? "proyectado", movimientos };
}
