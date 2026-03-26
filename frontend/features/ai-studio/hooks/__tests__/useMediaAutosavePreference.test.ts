import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaAutosavePreference } from "../useMediaAutosavePreference";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";

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

const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
  readSupabaseUserId: readSupabaseUserIdMock,
}));

describe("useMediaAutosavePreference", () => {
  beforeEach(() => {
    vi.mocked(ensureSupabaseQueryClient).mockReset();
    vi.mocked(readSupabaseUserId).mockReset();
    window.localStorage.clear();
  });

  it("loads local preference and becomes ready when no user session exists", async () => {
    window.localStorage.setItem("shortpulse.ai_studio.media_autosave_enabled", "false");

    vi.mocked(readSupabaseUserId).mockResolvedValue(null);
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({ from: vi.fn() } as never);

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

    vi.mocked(readSupabaseUserId).mockResolvedValue("user-1");
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({
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
    } as never);

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
