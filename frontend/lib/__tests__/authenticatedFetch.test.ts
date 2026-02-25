/**
 * Validates auth-session timeout behavior for authenticated client fetches.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_SESSION_TIMEOUT_CODE,
  fetchWithAuth,
  isAuthSessionTimeoutError,
} from "../authenticatedFetch";
import { ensureSupabaseClient } from "../supabaseClient";

vi.mock("../supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(),
}));

vi.mock("../appErrorReporter", () => ({
  reportAppError: vi.fn(),
}));

vi.mock("../clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
  redactUrlForTelemetry: (value: string) => value,
}));

const ensureSupabaseClientMock = vi.mocked(ensureSupabaseClient);

describe("fetchWithAuth auth-session timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects with an auth-timeout classification when session resolution exceeds the budget", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      ensureSupabaseClientMock.mockReturnValue({
        auth: {
          getSession: () => new Promise(() => undefined),
        },
      } as unknown as ReturnType<typeof ensureSupabaseClient>);

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
    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { access_token: "token-123" } },
          error: null,
        })),
      },
    } as unknown as ReturnType<typeof ensureSupabaseClient>);

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
});
