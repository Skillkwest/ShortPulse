import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaAutosavePreference } from "../useMediaAutosavePreference";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const ensureSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: ensureSupabaseClientMock,
}));

describe("useMediaAutosavePreference", () => {
  beforeEach(() => {
    ensureSupabaseClientMock.mockReset();
    window.localStorage.clear();
  });

  it("loads local preference and becomes ready when no user session exists", async () => {
    window.localStorage.setItem("shortpulse.ai_studio.media_autosave_enabled", "false");

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
      from: vi.fn(),
    });

    const { result } = renderHook(() => useMediaAutosavePreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.mediaAutosaveEnabled).toBe(false);
    expect(result.current.syncState).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("ignores stale failed writes when a newer write succeeds", async () => {
    const firstWrite = createDeferred<{ error: null | { message: string } }>();
    const secondWrite = createDeferred<{ error: null | { message: string } }>();
    let upsertCall = 0;

    const upsert = vi.fn(() => {
      const nextCall = upsertCall;
      upsertCall += 1;
      if (nextCall === 0) return firstWrite.promise;
      return secondWrite.promise;
    });

    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { media_autosave_enabled: true }, error: null });

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table !== "user_preferences") throw new Error("Unexpected table");
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
          upsert,
        };
      }),
    });

    const { result } = renderHook(() => useMediaAutosavePreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.syncState).toBe("ready");
    });

    act(() => {
      result.current.setMediaAutosaveEnabled(false);
      result.current.setMediaAutosaveEnabled(true);
    });

    await act(async () => {
      secondWrite.resolve({ error: null });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.syncState).toBe("ready");
      expect(result.current.mediaAutosaveEnabled).toBe(true);
    });

    await act(async () => {
      firstWrite.reject(new Error("stale failure"));
      await Promise.resolve();
    });

    expect(result.current.mediaAutosaveEnabled).toBe(true);
    expect(result.current.error).toBeNull();
    expect(window.localStorage.getItem("shortpulse.ai_studio.media_autosave_enabled")).toBe("true");
  });
});
