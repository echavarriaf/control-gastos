import { afterEach, describe, expect, it, vi } from "vitest";
import { withAuthTimeout } from "./with-timeout";

afterEach(() => vi.useRealTimers());

describe("withAuthTimeout", () => {
  it("preserves the response and clears the deadline", async () => {
    vi.useFakeTimers();
    await expect(withAuthTimeout(Promise.resolve(false), "timeout")).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a stalled request instead of waiting indefinitely", async () => {
    vi.useFakeTimers();
    const pending = withAuthTimeout(new Promise(() => {}), "Sin conexión");
    const assertion = expect(pending).rejects.toThrow("Sin conexión");
    await vi.advanceTimersByTimeAsync(12000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves permission errors", async () => {
    const error = new Error("permission-denied");
    await expect(withAuthTimeout(Promise.reject(error), "timeout")).rejects.toBe(error);
  });
});
