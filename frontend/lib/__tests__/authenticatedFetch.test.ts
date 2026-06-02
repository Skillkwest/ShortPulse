/**
 * Validates auth-session timeout behavior for authenticated client fetches.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_REQUIRED_CODE,
  AUTH_SESSION_TIMEOUT_CODE,
  fetchWithAuth,
  isAuthRequiredError,
  isAuthSessionTimeoutError,
} from "../authenticatedFetch";
import { readSupabaseAccessToken } from "../supabaseClient";

vi.mock("../supabaseClient", () => ({
  readSupabaseAccessToken: vi.fn(),
}));

vi.mock("../appErrorReporter", () => ({
  reportAppError: vi.fn(),
}));

vi.mock("../clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
  redactUrlForTelemetry: (value: string) => value,
}));

const readSupabaseAccessTokenMock = vi.mocked(readSupabaseAccessToken);

describe("fetchWithAuth auth-session timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects with an auth-timeout classification when session resolution exceeds the budget", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      readSupabaseAccessTokenMock.mockImplementation(() => new Promise(() => undefined));

      const pending = fetchWithAuth("/api/fal/nano-banana-pro-edit-submit", {
        shortpulseAuthTimeoutMs: 4,
      }).catch((error) => error);
      await vi.advanceTimersByTimeAsync(4);
      const error = await pending;

      expect(isAuthSessionTimeoutError(error)).toBe(true);
      expect((error as { code?: string }).code).toBe(AUTH_SESSION_TIMEOUT_CODE);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("preserves baseline behavior when auth timeout is not configured", async () => {
    readSupabaseAccessTokenMock.mockResolvedValue("token-123");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    try {
      const response = await fetchWithAuth("/api/test-auth", { method: "POST" });
      expect(response.ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, init] = fetchSpy.mock.calls[0] ?? [];
      const headers = new Headers((init as RequestInit | undefined)?.headers);
      expect(headers.get("Authorization")).toBe("Bearer token-123");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("forces one auth refresh when the initial token lookup is empty", async () => {
    readSupabaseAccessTokenMock.mockResolvedValueOnce(null).mockResolvedValueOnce("token-fresh");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    try {
      const response = await fetchWithAuth("/api/test-auth-refresh", { method: "GET" });

      expect(response.ok).toBe(true);
      expect(readSupabaseAccessTokenMock).toHaveBeenCalledTimes(2);
      expect(readSupabaseAccessTokenMock).toHaveBeenNthCalledWith(1, { forceRefresh: false });
      expect(readSupabaseAccessTokenMock).toHaveBeenNthCalledWith(2, { forceRefresh: true });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [, init] = fetchSpy.mock.calls[0] ?? [];
      const headers = new Headers((init as RequestInit | undefined)?.headers);
      expect(headers.get("Authorization")).toBe("Bearer token-fresh");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("rejects with an auth-required classification when no session token is available", async () => {
    readSupabaseAccessTokenMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      await expect(fetchWithAuth("/api/test-auth-required")).rejects.toSatisfy((error: unknown) => {
        expect(isAuthRequiredError(error)).toBe(true);
        expect((error as { code?: string }).code).toBe(AUTH_REQUIRED_CODE);
        return true;
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("retries once with a refreshed token after a 401 response", async () => {
    readSupabaseAccessTokenMock
      .mockResolvedValueOnce("token-stale")
      .mockResolvedValueOnce("token-refreshed");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    try {
      const response = await fetchWithAuth("/api/projects/project-1", { method: "GET" });

      expect(response.ok).toBe(true);
      expect(readSupabaseAccessTokenMock).toHaveBeenCalledTimes(2);
      expect(readSupabaseAccessTokenMock).toHaveBeenNthCalledWith(1, { forceRefresh: false });
      expect(readSupabaseAccessTokenMock).toHaveBeenNthCalledWith(2, { forceRefresh: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      const [, firstInit] = fetchSpy.mock.calls[0] ?? [];
      const firstHeaders = new Headers((firstInit as RequestInit | undefined)?.headers);
      expect(firstHeaders.get("Authorization")).toBe("Bearer token-stale");

      const [, secondInit] = fetchSpy.mock.calls[1] ?? [];
      const secondHeaders = new Headers((secondInit as RequestInit | undefined)?.headers);
      expect(secondHeaders.get("Authorization")).toBe("Bearer token-refreshed");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("supports opting out of 401 auth refresh retries", async () => {
    readSupabaseAccessTokenMock.mockResolvedValueOnce("token-stale");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    try {
      const response = await fetchWithAuth("/api/test-auth-no-retry", {
        method: "POST",
        shortpulseRetryAuth401: false,
      });

      expect(response.status).toBe(401);
      expect(readSupabaseAccessTokenMock).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
