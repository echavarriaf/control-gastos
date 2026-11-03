import { describe, expect, it } from "vitest";
import { cambiosHistorial, mezclarDatos } from "./types";
import { fechaHistorial, valorHistorial } from "./display";

describe("Financial history comparisons", () => {
  it("captures amount, date and funding-source changes without altering their values", () => {
    const antes = { monto: 10, fecha: "2026-11-03", origenFondos: "cuenta_gastos", creadoEn: "original" };
    const despues = { ...antes, monto: 15, fecha: "2026-11-04", origenFondos: "cuenta_externa", actualizadoEn: "now" };
    expect(cambiosHistorial(antes, despues)).toEqual([
      { campo: "monto", etiqueta: "Monto", antes: 10, despues: 15 }, { campo: "fecha", etiqueta: "Fecha", antes: "2026-11-03", despues: "2026-11-04" },
      { campo: "origenFondos", etiqueta: "Cuenta de origen", antes: "cuenta_gastos", despues: "cuenta_externa" },
    ]);
    expect(antes).toEqual({ monto: 10, fecha: "2026-11-03", origenFondos: "cuenta_gastos", creadoEn: "original" });
  });
  it("does not create financial changes for timestamps or map key ordering", () => {
    expect(cambiosHistorial({ limites: { comida: { mensual: 100, quincenal: 50 } }, actualizadoEn: "old" },
      { limites: { comida: { quincenal: 50, mensual: 100 } }, actualizadoEn: "new" })).toEqual([]);
  });
  it("represents creation and deletion with a genuine absent side", () => {
    expect(cambiosHistorial(null, { monto: 10 })[0]).toMatchObject({ antes: null, despues: 10 });
    expect(cambiosHistorial({ monto: 10 }, null)[0]).toMatchObject({ antes: 10, despues: null });
  });
  it("merges nested fields like setDoc merge while replacing arrays and empty maps", () => {
    const antes = { limites: { comida: { mensual: 100, quincenal: 50 }, gas: { mensual: 20 } }, lista: [1, 2], notas: "Original" };
    expect(mezclarDatos(antes, { limites: { comida: { mensual: 120 } }, lista: [3] })).toEqual({
      limites: { comida: { mensual: 120, quincenal: 50 }, gas: { mensual: 20 } }, lista: [3], notas: "Original",
    });
    expect(mezclarDatos(antes, { limites: {} }).limites).toEqual({});
    expect(antes.lista).toEqual([1, 2]);
  });
});
describe("Human readable history", () => {
  it("formats money and statuses but preserves free text exactly", () => {
    expect(valorHistorial("monto", -25)).toBe("-$25.00");
    expect(valorHistorial("origenFondos", "cuenta_externa")).toBe("Otra cuenta externa");
    expect(valorHistorial("estadoTarjeta", "pendiente")).toBe("Pendiente");
    expect(valorHistorial("notas", "entrada")).toBe("entrada");
    expect(valorHistorial("nombre", "gas")).toBe("gas");
  });
  it("distinguishes empty values and resolves references only from this user's known records", () => {
    expect(valorHistorial("notas", "")).toBe("Vacío");
    expect(valorHistorial("notas", null)).toBe("Sin valor registrado");
    expect(valorHistorial("tarjetaId", "card", new Map([["tarjetaId:card", "Visa · 1234"]]))).toBe("Visa · 1234");
    expect(valorHistorial("tarjetaId", "foreign")).toBe("Referencia no disponible");
  });
  it("handles native timestamps and malformed dates without pretending they happened today", () => {
    expect(fechaHistorial({ toDate: () => new Date("2026-11-03T12:00:00Z") })).not.toBe("Fecha no disponible");
    expect(fechaHistorial("invalid")).toBe("Fecha no disponible");
  });
});
