import { describe, expect, it, vi } from "vitest";
import { DeadlineExceededError, withAbortableDeadline, withDeadline } from "../withDeadline";

describe("withDeadline", () => {
  it("resolves when work completes before timeout", async () => {
    const result = await withDeadline({
      timeoutMs: 1_000,
      timeoutMessage: "Timed out",
      run: async () => "ok",
    });

    expect(result).toBe("ok");
  });

  it("rejects with DeadlineExceededError when timeout is reached", async () => {
    vi.useFakeTimers();
    try {
      const pending = withDeadline({
        timeoutMs: 500,
        timeoutMessage: "Preparation timed out",
        run: async () => {
          await new Promise(() => {
            // intentionally unresolved
          });
          return "never";
        },
      });
      const rejection = pending.catch((error) => error);

      await vi.advanceTimersByTimeAsync(500);
      const error = await rejection;
      expect(error).toBeInstanceOf(DeadlineExceededError);
      expect(error).toMatchObject({
        name: "DeadlineExceededError",
        message: "Preparation timed out",
        code: "DEADLINE_EXCEEDED",
        timeoutMs: 500,
      } satisfies Partial<DeadlineExceededError>);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("withAbortableDeadline", () => {
  it("resolves when work completes before timeout", async () => {
    const result = await withAbortableDeadline({
      timeoutMs: 1_000,
      timeoutMessage: "Timed out",
      run: async () => "ok",
    });

    expect(result).toBe("ok");
  });

  it("aborts work and rejects with DeadlineExceededError when timeout is reached", async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      const pending = withAbortableDeadline({
        timeoutMs: 500,
        timeoutMessage: "Preparation timed out",
        run: async (signal) => {
          await new Promise<string>((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(new Error("aborted"));
              },
              { once: true }
            );
          });
          return "never";
        },
      });
      const rejection = pending.catch((error) => error);

      await vi.advanceTimersByTimeAsync(500);
      const error = await rejection;
      expect(aborted).toBe(true);
      expect(error).toBeInstanceOf(DeadlineExceededError);
      expect(error).toMatchObject({
        name: "DeadlineExceededError",
        message: "Preparation timed out",
        code: "DEADLINE_EXCEEDED",
        timeoutMs: 500,
      } satisfies Partial<DeadlineExceededError>);
    } finally {
      vi.useRealTimers();
    }
  });
});
