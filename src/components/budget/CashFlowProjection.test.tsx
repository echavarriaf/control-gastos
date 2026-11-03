import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calcularResumenCuentaGastos, type CuentaGastos } from "@/lib/budget/expense-account";
import { generarCiclosPago } from "@/lib/budget/pay-cycles";

const state = vi.hoisted(() => ({ otrosGastos: "" }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: () => [state.otrosGastos, (valor: string) => { state.otrosGastos = valor; }],
}));
import { CashFlowProjection } from "./CashFlowProjection";

type Props = Parameters<typeof CashFlowProjection>[0];
const cuenta: CuentaGastos = { id: "cuenta-gastos", nombre: "Banco", saldoInicial: 1000, fechaSaldoInicial: "2026-10-01", activa: true,
  ingresosIncluidosEnSaldoInicial: [], gastosIncluidosEnSaldoInicial: [], pagosFijosIncluidosEnSaldoInicial: [], pagosTarjetaIncluidosEnSaldoInicial: [] };
let props: Props;
function html() { return renderToStaticMarkup(<CashFlowProjection {...props} />); }
beforeEach(() => {
  state.otrosGastos = "";
  props = { hoy: "2026-11-03", cuenta,
    resumenCuenta: calcularResumenCuentaGastos(cuenta, [], [], [], [], [], [], null, new Date(2026, 10, 3, 12)),
    proximoCiclo: generarCiclosPago({ configuracion: { id: "salary", fechaAncla: "2026-11-06", intervaloDias: 14 },
      fechaInicio: "2026-11-06", cantidad: 1, fechaReferencia: "2026-11-03" })[0],
    montoEstimado: 2000, ingresos: [], compromisos: [], pagosFijos: [], tarjetas: [], gastos: [], pagosTarjeta: [], cargando: false };
});

describe("Cash flow forecast view", () => {
  it("shows projected balances with an explicit estimate and chronological details", () => {
    const result = html();
    expect(result).toContain("Antes del cobro previsto");
    expect(result).toContain("$3,000.00");
    expect(result).toContain("Estimación, no saldo disponible");
    expect(result).toContain("Movimientos estimados hasta el próximo cobro");
  });
  it("updates the forecast when the user changes additional expenses", () => {
    const tree = CashFlowProjection(props);
    const visit = (node: unknown): React.ReactElement<Record<string, unknown>>[] => {
      if (Array.isArray(node)) return node.flatMap(visit);
      if (!React.isValidElement<Record<string, unknown>>(node)) return [];
      return [node, ...visit(node.props.children)];
    };
    const handler = visit(tree).find(element => element.type === "input")?.props.onChange;
    if (typeof handler !== "function") throw new Error("Missing estimate input");
    handler({ target: { value: "1100" } });
    expect(html()).toContain("Se prevé un déficit");
    expect(html()).toContain("-$100.00");
    expect(html()).toContain("$1,900.00");
  });
  it("does not present partial financial data as a completed projection", () => {
    props.cargando = true;
    expect(html()).toContain("Cargando los datos de la proyección");
    expect(html()).not.toContain("$3,000.00");
    props.cargando = false; props.errorDatos = "Error de ingresos";
    expect(html()).toContain("No se puede proyectar hasta resolver");
    expect(html()).not.toContain("Antes del cobro previsto");
  });
  it("provides configuration guidance when there is no upcoming paycheck", () => {
    props.proximoCiclo = null;
    expect(html()).toContain("Configura tu ingreso principal");
    expect(html()).not.toContain("Antes del cobro previsto");
  });
  it("rejects negative expense estimates instead of inflating projected cash", () => {
    state.otrosGastos = "-1";
    expect(html()).toContain("Revisa los importes de la proyección");
    expect(html()).not.toContain("$3,001.00");
  });
  it("distinguishes reserved savings from projected bank cash and identifies savings at risk", () => {
    props.ahorroApartado = 1200;
    const result = html();
    expect(result).toContain("Ahorro apartado: $1,200.00");
    expect(result).toContain("Saldo final sin usar ese ahorro: $1,800.00");
    expect(result).toContain("utilizar parte del dinero apartado");
  });
});
