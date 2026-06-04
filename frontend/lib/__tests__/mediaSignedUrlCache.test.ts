/**
 * Ensures signed URL batch resolution processes every storage path without truncation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../authenticatedFetch";
import { getSignedMediaUrlsBatch } from "../mediaSignedUrlCache";
import { ensureSupabaseQueryClient } from "../supabaseClient";

vi.mock("../authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock("../supabaseClient", () => ({
  ensureSupabaseQueryClient: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);
const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushAsyncWork = () => new Promise((resolve) => setTimeout(resolve, 0));

const createSignedResponseForPaths = (paths: string[]) =>
  new Response(
    JSON.stringify({
      urls: Object.fromEntries(
        paths.map((path) => [path, `https://signed.test/${encodeURIComponent(path)}`])
      ),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

describe("getSignedMediaUrlsBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureSupabaseQueryClientMock.mockReturnValue({
      storage: {
        from: () => ({
          createSignedUrl: vi.fn(),
        }),
      },
    } as unknown as ReturnType<typeof ensureSupabaseQueryClient>);
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
    expect(capturedBatches.map((batch) => batch.length).sort((a, b) => a - b)).toEqual([
      10, 60, 60,
    ]);
    expect(signedByPath.size).toBe(130);
    for (const path of storagePaths) {
      expect(signedByPath.get(path)).toBe(`https://signed.test/${encodeURIComponent(path)}`);
    }
    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
  });

  it("serializes API signing chunks to avoid bursty media-heavy opens", async () => {
    const capturedBatches: string[][] = [];
    const deferredResponses: Array<ReturnType<typeof createDeferred<Response>>> = [];
    fetchWithAuthMock.mockImplementation(async (_url, init) => {
      const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")) as {
        paths?: string[];
      };
      const paths = payload.paths ?? [];
      capturedBatches.push(paths);
      const deferred = createDeferred<Response>();
      deferredResponses.push(deferred);
      return deferred.promise;
    });

    const storagePaths = Array.from({ length: 130 }, (_, index) => `user/path-${index + 1}.png`);
    const signedByPathPromise = getSignedMediaUrlsBatch({
      bucket: "media_library",
      storagePaths,
      forceRefresh: true,
    });

    await flushAsyncWork();
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    deferredResponses[0]?.resolve(createSignedResponseForPaths(capturedBatches[0] ?? []));
    await flushAsyncWork();
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);

    deferredResponses[1]?.resolve(createSignedResponseForPaths(capturedBatches[1] ?? []));
    await flushAsyncWork();
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(3);

    deferredResponses[2]?.resolve(createSignedResponseForPaths(capturedBatches[2] ?? []));
    const signedByPath = await signedByPathPromise;

    expect(capturedBatches.map((batch) => batch.length)).toEqual([60, 60, 10]);
    expect(signedByPath.size).toBe(130);
    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
  });

  it("coalesces concurrent batch callers for the same unresolved path", async () => {
    const path = "user/shared-path.png";
    const deferred = createDeferred<Response>();
    fetchWithAuthMock.mockImplementation(async () => deferred.promise);

    const firstBatchPromise = getSignedMediaUrlsBatch({
      bucket: "media_library",
      storagePaths: [path],
    });
    await Promise.resolve();
    const secondBatchPromise = getSignedMediaUrlsBatch({
      bucket: "media_library",
      storagePaths: [path],
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    deferred.resolve(
      new Response(
        JSON.stringify({
          urls: {
            [path]: "https://signed.test/shared-path",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const [firstBatch, secondBatch] = await Promise.all([firstBatchPromise, secondBatchPromise]);
    expect(firstBatch.get(path)).toBe("https://signed.test/shared-path");
    expect(secondBatch.get(path)).toBe("https://signed.test/shared-path");
  });
});
