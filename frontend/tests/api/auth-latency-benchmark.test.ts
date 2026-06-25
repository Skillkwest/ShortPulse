/**
 * Synthetic auth-boundary behavior benchmark.
 * Verifies protected-route auth dedupes bearer verification and never treats
 * legacy proxy headers as the identity authority.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireApiUser } from "../../lib/server/api/auth";
import { resetSupabaseUserVerificationCache } from "../../lib/server/api/authTokenVerifier";

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const runAuthResolution = async (options: {
  iterations: number;
  reqFactory: (i: number) => Record<string, unknown>;
}): Promise<void> => {
  for (let i = 0; i < options.iterations; i += 1) {
    const req = options.reqFactory(i);
    const res = createMockResponse();
    await requireApiUser(req as never, res as never);
  }
};

describe("auth boundary latency benchmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseUserVerificationCache();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SHORTPULSE_TRUST_PROXY_AUTH_HEADERS = "false";
  });

  it("dedupes repeated bearer verification regardless of legacy proxy headers", async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          id: "user-1",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const iterations = 40;
    await runAuthResolution({
      iterations,
      reqFactory: (i) => ({
        url: "/api/media/sign-batch",
        headers: {
          authorization: "Bearer valid-token",
          "x-shortpulse-authenticated": "1",
          "x-shortpulse-user-id": `proxy-user-${i}`,
          "x-shortpulse-user-app-metadata": encodeURIComponent("{}"),
          "x-shortpulse-user-user-metadata": encodeURIComponent("{}"),
        },
      }),
    });
    await runAuthResolution({
      iterations,
      reqFactory: () => ({
        url: "/api/media/sign-batch",
        headers: {
          authorization: "Bearer valid-token",
        },
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
