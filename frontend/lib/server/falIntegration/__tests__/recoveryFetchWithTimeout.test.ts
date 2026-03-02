import { describe, expect, it } from "vitest";
import { RecoveryFetchError, recoveryFetchWithTimeout } from "../recoveryFetchWithTimeout";

describe("recoveryFetchWithTimeout", () => {
  it("returns the execute result when request completes before timeout", async () => {
    const result = await recoveryFetchWithTimeout({
      timeoutMs: 100,
      execute: async () => "ok",
    });

    expect(result).toBe("ok");
  });

  it("throws timeout error when the request exceeds timeout", async () => {
    await expect(
      recoveryFetchWithTimeout({
        timeoutMs: 10,
        execute: (signal) =>
          new Promise<string>((resolve, reject) => {
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
            setTimeout(() => resolve("late"), 50);
          }),
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<RecoveryFetchError>>({
        name: "RecoveryFetchError",
        code: "timeout",
      })
    );
  });
});
