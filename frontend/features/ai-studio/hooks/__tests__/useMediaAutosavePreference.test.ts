import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaAutosavePreference } from "../useMediaAutosavePreference";
import { ensureSupabaseQueryClient, useSupabaseSessionState } from "../../../../lib/supabaseClient";

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
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
  useSupabaseSessionState: useSupabaseSessionStateMock,
}));

describe("useMediaAutosavePreference", () => {
  beforeEach(() => {
    vi.mocked(ensureSupabaseQueryClient).mockReset();
    vi.mocked(useSupabaseSessionState).mockReset();
    window.localStorage.clear();
  });

  it("loads local preference and becomes ready when no user session exists", async () => {
    window.localStorage.setItem("shortpulse.ai_studio.media_autosave_enabled", "false");

    vi.mocked(useSupabaseSessionState).mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({ from: vi.fn() } as never);

    const { result } = renderHook(() => useMediaAutosavePreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.mediaAutosaveEnabled).toBe(false);
    expect(result.current.syncState).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("prefers the signed-in remote preference over stale local fallback", async () => {
    window.localStorage.setItem("shortpulse.ai_studio.media_autosave_enabled", "false");
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { media_autosave_enabled: true }, error: null });

    vi.mocked(useSupabaseSessionState).mockReturnValue({
      initialized: true,
      session: { user: { id: "user-1" } } as never,
      user: { id: "user-1" } as never,
    });
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "user_preferences") throw new Error("Unexpected table");
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        };
      }),
    } as never);

    const { result } = renderHook(() => useMediaAutosavePreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.mediaAutosaveEnabled).toBe(true);
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

    vi.mocked(useSupabaseSessionState).mockReturnValue({
      initialized: true,
      session: { user: { id: "user-1" } } as never,
      user: { id: "user-1" } as never,
    });
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
      firstWrite.resolve({ error: { message: "stale failure" } });
      await Promise.resolve();
    });

    expect(result.current.mediaAutosaveEnabled).toBe(true);
    expect(result.current.error).toBeNull();
    expect(window.localStorage.getItem("shortpulse.ai_studio.media_autosave_enabled")).toBe("true");
  });

  it("retries a failed signed-in load on window focus", async () => {
    const maybeSingle = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary read failure"))
      .mockResolvedValueOnce({ data: { media_autosave_enabled: false }, error: null });

    vi.mocked(useSupabaseSessionState).mockReturnValue({
      initialized: true,
      session: { user: { id: "user-1" } } as never,
      user: { id: "user-1" } as never,
    });
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "user_preferences") throw new Error("Unexpected table");
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        };
      }),
    } as never);

    const { result } = renderHook(() => useMediaAutosavePreference());

    await waitFor(() => {
      expect(result.current.syncState).toBe("error");
    });
    expect(result.current.mediaAutosaveEnabled).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.syncState).toBe("ready");
    });
    expect(result.current.mediaAutosaveEnabled).toBe(false);
  });
});
