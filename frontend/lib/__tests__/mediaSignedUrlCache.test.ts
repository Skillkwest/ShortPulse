/**
 * Ensures signed URL batch resolution processes every storage path without truncation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../authenticatedFetch";
import { getSignedMediaUrlsBatch } from "../mediaSignedUrlCache";
import { ensureSupabaseClient } from "../supabaseClient";

vi.mock("../authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock("../supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);
const ensureSupabaseClientMock = vi.mocked(ensureSupabaseClient);

describe("getSignedMediaUrlsBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureSupabaseClientMock.mockReturnValue({
      storage: {
        from: () => ({
          createSignedUrl: vi.fn(),
        }),
      },
    } as unknown as ReturnType<typeof ensureSupabaseClient>);
  });

  it("chunks API signing requests and resolves all paths when count exceeds batch limit", async () => {
    const capturedBatches: string[][] = [];
    fetchWithAuthMock.mockImplementation(async (_url, init) => {
      const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")) as {
        paths?: string[];
      };
      const paths = payload.paths ?? [];
      capturedBatches.push(paths);
      const urls = Object.fromEntries(
        paths.map((path) => [path, `https://signed.test/${encodeURIComponent(path)}`])
      );
      return new Response(JSON.stringify({ urls }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    const storagePaths = Array.from({ length: 130 }, (_, index) => `user/path-${index + 1}.png`);
    const signedByPath = await getSignedMediaUrlsBatch({
      bucket: "media_library",
      storagePaths,
      forceRefresh: true,
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(3);
    expect(capturedBatches.map((batch) => batch.length)).toEqual([60, 60, 10]);
    expect(signedByPath.size).toBe(130);
    for (const path of storagePaths) {
      expect(signedByPath.get(path)).toBe(`https://signed.test/${encodeURIComponent(path)}`);
    }
    expect(ensureSupabaseClientMock).not.toHaveBeenCalled();
  });
});
