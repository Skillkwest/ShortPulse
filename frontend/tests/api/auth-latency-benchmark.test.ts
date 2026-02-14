/**
 * Synthetic latency benchmark for auth-boundary behavior.
 * Compares protected-route auth with middleware context (no duplicate user lookup)
 * against token-only fallback that performs Supabase /auth/v1/user verification.
 */
import { performance } from "node:perf_hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireApiUser } from "../../lib/server/api/auth";

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
};

const measureAuthResolutionLatency = async (options: {
  iterations: number;
  reqFactory: (i: number) => Record<string, unknown>;
}): Promise<number[]> => {
  const samples: number[] = [];
  for (let i = 0; i < options.iterations; i += 1) {
    const req = options.reqFactory(i);
    const res = createMockResponse();
    const startedAt = performance.now();
    await requireApiUser(req as never, res as never);
    samples.push(performance.now() - startedAt);
  }
  return samples;
};

describe("auth boundary latency benchmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("shows lower p50/p95 latency when protected routes reuse middleware auth context", async () => {
    const upstreamDelayMs = 12;
    const fetchMock = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, upstreamDelayMs));
      return {
        ok: true,
        json: async () => ({
          id: "user-1",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const iterations = 40;
    const proxyContextSamples = await measureAuthResolutionLatency({
      iterations,
      reqFactory: (i) => ({
        url: "/api/media/sign-batch",
        headers: {
          "x-shortpulse-authenticated": "1",
          "x-shortpulse-user-id": `user-${i}`,
          "x-shortpulse-user-app-metadata": encodeURIComponent("{}"),
          "x-shortpulse-user-user-metadata": encodeURIComponent("{}"),
        },
      }),
    });
    const fallbackSamples = await measureAuthResolutionLatency({
      iterations,
      reqFactory: () => ({
        url: "/api/media/sign-batch",
        headers: {
          authorization: "Bearer valid-token",
        },
      }),
    });

    const proxyP50 = percentile(proxyContextSamples, 50);
    const proxyP95 = percentile(proxyContextSamples, 95);
    const fallbackP50 = percentile(fallbackSamples, 50);
    const fallbackP95 = percentile(fallbackSamples, 95);

    console.info(
      `[auth-latency-benchmark] proxy-context p50=${proxyP50.toFixed(2)}ms p95=${proxyP95.toFixed(
        2
      )}ms | fallback p50=${fallbackP50.toFixed(2)}ms p95=${fallbackP95.toFixed(2)}ms`
    );

    expect(proxyP50).toBeLessThan(fallbackP50);
    expect(proxyP95).toBeLessThan(fallbackP95);
    expect(fallbackP50 - proxyP50).toBeGreaterThanOrEqual(8);
    expect(fetchMock).toHaveBeenCalledTimes(iterations);
  });
});
