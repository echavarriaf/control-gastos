import { describe, expect, it } from "vitest";
import { celdaCSV, fechaDeExportacion, generarCSV, prepararFilasExportacion, validarOpcionesExportacion } from "./csv";
import type { OpcionesExportacion, RegistroExportable } from "./types";

const opciones: OpcionesExportacion = { desde: "2026-11-01", hasta: "2026-11-30", zonaHoraria: "America/New_York", formato: "movimientos" };
const gasto = (id: string, datos: Record<string, unknown> = {}): RegistroExportable => ({ id, coleccion: "gastos",
  datos: { fecha: "2026-11-03", concepto: "Café", monto: 100, categoria: "comida", metodoPago: "debito", ...datos } });

describe("CSV export options and dates", () => {
  it("accepts an inclusive leap-year interval of 366 days", () => {
    expect(validarOpcionesExportacion(new URLSearchParams({ desde: "2024-01-01", hasta: "2024-12-31" })))
      .toMatchObject({ desde: "2024-01-01", hasta: "2024-12-31", zonaHoraria: "America/New_York", formato: "movimientos" });
  });
  it.each([
    { desde: "2026-02-30", hasta: "2026-03-01" }, { desde: "2026-11-03", hasta: "2026-11-02" },
    { desde: "2024-01-01", hasta: "2025-01-01" }, { desde: "2026-11-01", hasta: "2026-11-30", zonaHoraria: "invalid/zone" },
    { desde: "2026-11-01", hasta: "2026-11-30", formato: "xlsx" },
  ])("rejects invalid or oversized export %j", params => {
    expect(() => validarOpcionesExportacion(new URLSearchParams(params))).toThrow();
  });
  it("keeps calendar dates literal but converts instants to the requested time zone", () => {
    expect(fechaDeExportacion("2026-11-01", "America/New_York")).toBe("2026-11-01");
    expect(fechaDeExportacion("2026-11-01T02:00:00Z", "America/New_York")).toBe("2026-10-31");
    expect(fechaDeExportacion("2026-11-01T02:00:00Z", "UTC")).toBe("2026-11-01");
    expect(fechaDeExportacion({ toDate: () => new Date("2026-11-01T02:00:00Z") }, "America/New_York")).toBe("2026-10-31");
    expect(fechaDeExportacion("2026-02-30T12:00:00Z", "America/New_York")).toBe("");
  });
});

describe("Financial export rows", () => {
  it("filters inclusive boundaries in the chosen calendar and sorts stably", () => {
    const filas = prepararFilasExportacion([gasto("before", { fecha: "2026-11-01T02:00:00Z" }),
      gasto("start", { fecha: "2026-11-01" }), gasto("end", { fecha: "2026-12-01T02:00:00Z" }), gasto("later", { fecha: "2026-12-01" })], opciones);
    expect(filas.map(fila => [fila.id, fila.fecha])).toEqual([["start", "2026-11-01"], ["end", "2026-11-30"]]);
  });
  it("deduplicates overlapping queries by collection and ID while keeping unrelated same IDs", () => {
    const filas = prepararFilasExportacion([gasto("same"), gasto("same"), { ...gasto("same"), coleccion: "pagosTarjeta" }], opciones);
    expect(filas).toHaveLength(2);
    expect(filas.map(fila => fila.tipo)).toEqual(["Gasto", "Pago a tarjeta"]);
  });
  it("uses receipt dates for received income, and scheduled dates for projected or cancelled income", () => {
    const registro = (id: string, estado: string, fechaProgramada: string, fechaRecibida: string | null): RegistroExportable =>
      ({ id, coleccion: "ingresos", datos: { monto: 1000, descripcion: "Salario", estado, fechaProgramada, fechaRecibida } });
    const filas = prepararFilasExportacion([registro("late", "recibido", "2025-01-01", "2026-11-03"),
      registro("old", "recibido", "2026-11-03", "2025-01-01"), registro("projected", "proyectado", "2026-11-06", null),
      registro("cancelled", "cancelado", "2026-11-06", null)], opciones);
    expect(filas.map(fila => fila.id).sort()).toEqual(["cancelled", "late", "projected"]);
    expect(filas.find(fila => fila.id === "late")).toMatchObject({ fecha: "2026-11-03", fechaProgramada: "2025-01-01", estado: "recibido" });
  });
  it("preserves historical payment defaults and explicit external pending payments", () => {
    const filas = prepararFilasExportacion([
      { ...gasto("historical"), coleccion: "pagosTarjeta", datos: { fecha: "2026-11-03", monto: 100, tarjetaId: "card" } },
      { ...gasto("external"), coleccion: "pagosTarjeta", datos: { fecha: "2026-11-03", monto: 50, tarjetaId: "card", origenFondos: "cuenta_externa", estadoTarjeta: "pendiente" } },
    ], opciones, new Map([["card", "Visa"]]));
    expect(filas.find(fila => fila.id === "historical")).toMatchObject({ origen: "Cuenta configurada", estado: "contabilizada", tarjeta: "Visa" });
    expect(filas.find(fila => fila.id === "external")).toMatchObject({ origen: "Otra cuenta externa", estado: "pendiente", monto: 50 });
  });
  it("retains custom categories, fixed payments and manual directions without inventing bank balances", () => {
    const filas = prepararFilasExportacion([gasto("custom", { categoria: null, categoriaTarjetaNombre: "Regalos", tarjetaId: "missing", metodoPago: "tarjeta_credito" }),
      { id: "fixed", coleccion: "pagosFijos", datos: { fecha: "2026-11-04", descripcion: "Renta", monto: 500, metodo: "transferencia", compromisoId: "rent", notas: "Parcial" } },
      { id: "manual", coleccion: "movimientosCuenta", datos: { fecha: "2026-11-05", concepto: "Reembolso", monto: 50, direccion: "entrada" } }], opciones);
    expect(filas[0]).toMatchObject({ categoria: "Sin presupuesto", categoriaTarjeta: "Regalos", tarjeta: "Tarjeta sin nombre disponible", estado: "contabilizada" });
    expect(filas[1]).toMatchObject({ tipo: "Pago fijo", compromisoId: "rent", notas: "Parcial" });
    expect(filas[2]).toMatchObject({ direccion: "Entrada" });
    expect(filas[0]).not.toHaveProperty("saldo");
  });
  it("keeps invalid amounts blank while accepting finite historical numeric strings", () => {
    const filas = prepararFilasExportacion([gasto("invalid", { monto: "unknown" }), gasto("legacy", { monto: "12.34" })], opciones);
    expect(filas[0].monto).toBeNull(); expect(filas[1].monto).toBe(12.34);
    expect(generarCSV(filas, "resumen")).toContain('"2","12.34","1"');
  });
});

describe("Spreadsheet compatible CSV", () => {
  it("escapes quotes, commas and multiline comments with UTF-8 BOM and CRLF records", () => {
    const filas = prepararFilasExportacion([gasto("special", { concepto: 'Café, "especial"', comentario: "Línea 1\nLínea 2" })], opciones);
    const csv = generarCSV(filas, "movimientos");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Café, ""especial"""');
    expect(csv).toContain('"Línea 1\nLínea 2"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  it.each(["=SUM(A1:A2)", "+cmd", "-cmd", "@formula", " \t=1+1", "\r\n@SUM(A1)", "\u0000=1+1"])("treats formula-like user text %j as text", value => {
    expect(celdaCSV(value)).toBe(`"'${value}"`);
  });
  it("keeps negative numeric amounts numeric rather than treating them as formula text", () => {
    expect(celdaCSV(-12.5)).toBe('"-12.50"');
    expect(celdaCSV(null)).toBe('""');
  });
  it("groups calendar halves while separating purchases, card payments, states and funding sources", () => {
    const filas = prepararFilasExportacion([gasto("one", { fecha: "2026-11-13", monto: 0.1 }), gasto("two", { fecha: "2026-11-15", monto: 0.2 }),
      gasto("q2", { fecha: "2026-11-16", monto: 20 }), { ...gasto("payment"), coleccion: "pagosTarjeta" },
      { ...gasto("external"), coleccion: "pagosTarjeta", datos: { fecha: "2026-11-13", monto: 10, origenFondos: "cuenta_externa", estadoTarjeta: "pendiente" } }], opciones);
    const csv = generarCSV(filas, "resumen");
    expect(csv).toContain('"2026-11","Q1 (1–15)","Gasto","Salida","Comida","","registrado","","2","0.30","0"');
    expect(csv).toContain('"2026-11","Q2 (16–fin)","Gasto"');
    expect(csv).toContain('"Pago a tarjeta"'); expect(csv).toContain('"Otra cuenta externa"');
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(5);
  });
  it("exports an empty interval as a valid header-only file", () => {
    expect(generarCSV([], "movimientos").split("\r\n").filter(Boolean)).toHaveLength(1);
    expect(generarCSV([], "resumen")).toContain("Total registrado USD");
  });
});
