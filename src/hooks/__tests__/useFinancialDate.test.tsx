import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { asignarFechaAPresupuesto } from "@/lib/budget/budget-periods";

const state = vi.hoisted(() => ({ value: undefined as string | undefined, effect: undefined as (() => () => void) | undefined }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: () => string) => {
    state.value ??= initial();
    return [state.value, (next: string) => { state.value = next; }];
  },
  useEffect: (effect: () => () => void) => { state.effect = effect; },
}));
import { useFinancialDate } from "@/hooks/useFinancialDate";

let fakeDocument: EventTarget & { visibilityState: string };
function render() {
  let value = "";
  function Probe() { value = useFinancialDate(); return null; }
  renderToStaticMarkup(<Probe />);
  return value;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 29, 23, 59, 30));
  state.value = undefined; state.effect = undefined;
  fakeDocument = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("window", { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("changes to the third paycheck's budget after midnight without a page reload", async () => {
  expect(render()).toBe("2026-10-29");
  const cleanup = state.effect?.();
  await vi.advanceTimersByTimeAsync(60_000);
  const fecha = render();
  expect(fecha).toBe("2026-10-30");
  expect(asignarFechaAPresupuesto(fecha, { fechaAncla: "2026-10-02", intervaloDias: 14 }))
    .toEqual({ periodoPresupuestario: "2026-11", quincenaPresupuestaria: 1 });
  cleanup?.();
  expect(vi.getTimerCount()).toBe(0);
});

it("refreshes a suspended tab when it becomes visible", () => {
  render(); const cleanup = state.effect?.();
  vi.setSystemTime(new Date(2026, 10, 13, 8));
  fakeDocument.dispatchEvent(new Event("visibilitychange"));
  expect(render()).toBe("2026-11-13");
  cleanup?.();
});
