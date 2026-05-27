/**
 * Shared client-side signed URL cache for media assets.
 * Deduplicates concurrent sign requests and reuses URLs until shortly before expiry.
 */
import { fetchWithAuth } from "./authenticatedFetch";
import { resolvePolicySignedImageTransform } from "./mediaSignedTransformPolicy";
import {
  resolvePreviewProfileForSurface,
  type MediaPreviewTransformProfile,
} from "./mediaPreviewTransformProfile";
import { ensureSupabaseQueryClient } from "./supabaseClient";

type SignedMediaUrlOptions = {
  bucket: string;
  storagePath: string;
  expiresInSeconds?: number;
  forceRefresh?: boolean;
  previewProfile?: MediaPreviewTransformProfile;
};

type SignedMediaUrlCacheEntry = {
  url: string;
  expiresAtMs: number;
};

type SignedMediaUrlBatchOptions = {
  bucket: string;
  storagePaths: string[];
  expiresInSeconds?: number;
  forceRefresh?: boolean;
  surface?:
    | "media-library-modal"
    | "media-library-panel"
    | "elements-media-panel"
    | "character-media-panel"
    | "reference-grid"
    | "quick-slot"
    | "character-grid"
    | "detail-modal";
  queryMode?: "default" | "search";
  tab?: string;
  previewProfile?: MediaPreviewTransformProfile;
};

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_REFRESH_BUFFER_MS = 20_000;
const MAX_SIGNED_URL_CACHE_ENTRIES = 1200;
const MAX_BATCH_SIGN_PATHS = 60;
const DEFAULT_BATCH_SIGN_CHUNK_CONCURRENCY = 2;
const MAX_BATCH_SIGN_CHUNK_CONCURRENCY = 3;
const BATCH_SIGN_CHUNK_CONCURRENCY = Math.min(
  MAX_BATCH_SIGN_CHUNK_CONCURRENCY,
  DEFAULT_BATCH_SIGN_CHUNK_CONCURRENCY
);

const signedUrlCache = new Map<string, SignedMediaUrlCacheEntry>();
const inFlightSignedUrlRequests = new Map<string, Promise<string | null>>();

const cacheKeyFor = (
  bucket: string,
  storagePath: string,
  previewProfile: MediaPreviewTransformProfile
) => `${bucket}:${storagePath}:${previewProfile}`;

const chunkStoragePaths = (storagePaths: string[], chunkSize: number): string[][] => {
  const chunks: string[][] = [];
  for (let index = 0; index < storagePaths.length; index += chunkSize) {
    chunks.push(storagePaths.slice(index, index + chunkSize));
  }
  return chunks;
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve,
    reject,
  };
};

const runWithConcurrency = async <T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> => {
  if (!items.length) return;
  const workerCount = Math.min(items.length, Math.max(1, concurrency));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const nextIndex = cursor;
        cursor += 1;
        if (nextIndex >= items.length) return;
        await worker(items[nextIndex] as T);
      }
    })
  );
};

const pruneSignedUrlCache = () => {
  while (signedUrlCache.size > MAX_SIGNED_URL_CACHE_ENTRIES) {
    const oldestKey = signedUrlCache.keys().next().value;
    if (!oldestKey) return;
    signedUrlCache.delete(oldestKey);
  }
};

const setCachedUrl = (
  bucket: string,
  storagePath: string,
  previewProfile: MediaPreviewTransformProfile,
  signedUrl: string,
  expiresInSeconds: number
) => {
  signedUrlCache.set(cacheKeyFor(bucket, storagePath, previewProfile), {
    url: signedUrl,
    expiresAtMs: Date.now() + expiresInSeconds * 1000,
  });
  pruneSignedUrlCache();
};

const getCachedUrl = (
  bucket: string,
  storagePath: string,
  previewProfile: MediaPreviewTransformProfile
): string | null => {
  const key = cacheKeyFor(bucket, storagePath, previewProfile);
  const now = Date.now();
  const cached = signedUrlCache.get(key);
  if (!cached) return null;
  if (cached.expiresAtMs - SIGNED_URL_REFRESH_BUFFER_MS <= now) {
    signedUrlCache.delete(key);
    return null;
  }
  // Refresh LRU position.
  signedUrlCache.delete(key);
  signedUrlCache.set(key, cached);
  return cached.url;
};

const signStoragePathDirect = async (
  bucket: string,
  storagePath: string,
  expiresInSeconds: number,
  previewProfile: MediaPreviewTransformProfile
): Promise<string | null> => {
  const supabase = ensureSupabaseQueryClient();
  const transform = resolvePolicySignedImageTransform(previewProfile, storagePath);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds, transform ? { transform } : undefined);
  if (error) throw error;
  return data?.signedUrl ?? null;
};

const signStoragePathsViaApi = async (
  bucket: string,
  storagePaths: string[],
  expiresInSeconds: number,
  options?: {
    surface?: string;
    queryMode?: string;
    tab?: string;
    previewProfile?: MediaPreviewTransformProfile;
  }
): Promise<Record<string, string | null> | null> => {
  if (!storagePaths.length) return {};
  const response = await fetchWithAuth("/api/media/sign-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucket,
      paths: storagePaths,
      expiresInSeconds,
      surface: options?.surface,
      queryMode: options?.queryMode,
      tab: options?.tab,
      previewProfile: options?.previewProfile,
    }),
    shortpulseLogScope: "app",
  }).catch(() => null);

  if (!response?.ok) return null;
  const payload = (await response.json().catch(() => null)) as {
    urls?: Record<string, string | null>;
  } | null;
  return payload?.urls ?? {};
};

/**
 * Resolve a signed URL for a storage object, with in-memory caching and request dedupe.
 */
export const getSignedMediaUrl = async ({
  bucket,
  storagePath,
  expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
  forceRefresh = false,
  previewProfile = "none",
}: SignedMediaUrlOptions): Promise<string | null> => {
  if (!storagePath) return null;
  const key = cacheKeyFor(bucket, storagePath, previewProfile);
  if (!forceRefresh) {
    const cachedUrl = getCachedUrl(bucket, storagePath, previewProfile);
    if (cachedUrl) return cachedUrl;
  }

  const inFlight = inFlightSignedUrlRequests.get(key);
  if (inFlight && !forceRefresh) {
    return inFlight;
  }

  const task = (async () => {
    const url = await signStoragePathDirect(bucket, storagePath, expiresInSeconds, previewProfile);
    if (url) {
      setCachedUrl(bucket, storagePath, previewProfile, url, expiresInSeconds);
    } else {
      signedUrlCache.delete(key);
    }
    return url;
  })()
    .catch(() => null)
    .finally(() => {
      inFlightSignedUrlRequests.delete(key);
    });

  inFlightSignedUrlRequests.set(key, task);
  return task;
};

/**
 * Resolve signed URLs for multiple storage objects, with cache-first behavior and batched API signing.
 */
export const getSignedMediaUrlsBatch = async ({
  bucket,
  storagePaths,
  expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
  forceRefresh = false,
  surface,
  queryMode,
  tab,
  previewProfile,
}: SignedMediaUrlBatchOptions): Promise<Map<string, string | null>> => {
  const resolvedPreviewProfile =
    previewProfile ?? resolvePreviewProfileForSurface(surface ?? undefined);
  const dedupedPaths = Array.from(new Set(storagePaths.map((path) => path.trim()).filter(Boolean)));
  const result = new Map<string, string | null>();
  if (!dedupedPaths.length) return result;

  const unresolvedPaths: string[] = [];
  for (const path of dedupedPaths) {
    if (!forceRefresh) {
      const cachedUrl = getCachedUrl(bucket, path, resolvedPreviewProfile);
      if (cachedUrl) {
        result.set(path, cachedUrl);
        continue;
      }
    }
    unresolvedPaths.push(path);
  }

  if (!unresolvedPaths.length) return result;

  const pendingSharedByPath = new Map<string, Promise<string | null>>();
  const ownedPaths: string[] = [];
  const ownedDeferredByPath = new Map<string, ReturnType<typeof createDeferred<string | null>>>();
  const resolvedOwnedByPath = new Map<string, string | null>();
  for (const path of unresolvedPaths) {
    const key = cacheKeyFor(bucket, path, resolvedPreviewProfile);
    const inFlight = !forceRefresh ? inFlightSignedUrlRequests.get(key) : undefined;
    if (inFlight && !forceRefresh) {
      pendingSharedByPath.set(path, inFlight);
      continue;
    }
    ownedPaths.push(path);
    if (forceRefresh) continue;
    const deferred = createDeferred<string | null>();
    ownedDeferredByPath.set(path, deferred);
    inFlightSignedUrlRequests.set(
      key,
      deferred.promise.finally(() => {
        inFlightSignedUrlRequests.delete(key);
      })
    );
  }

  await Promise.all(
    Array.from(pendingSharedByPath.entries()).map(async ([path, pending]) => {
      const signedUrl = await pending.catch(() => null);
      result.set(path, signedUrl ?? null);
    })
  );
  if (!ownedPaths.length) return result;

  const settleOwnedPath = (path: string, signedUrl: string | null) => {
    if (signedUrl) {
      setCachedUrl(bucket, path, resolvedPreviewProfile, signedUrl, expiresInSeconds);
    } else {
      signedUrlCache.delete(cacheKeyFor(bucket, path, resolvedPreviewProfile));
    }
    resolvedOwnedByPath.set(path, signedUrl);
    const deferred = ownedDeferredByPath.get(path);
    if (!deferred) return;
    deferred.resolve(signedUrl);
    ownedDeferredByPath.delete(path);
  };

  const ownedChunks = chunkStoragePaths(ownedPaths, MAX_BATCH_SIGN_PATHS);
  try {
    await runWithConcurrency(
      ownedChunks,
      BATCH_SIGN_CHUNK_CONCURRENCY,
      async (unresolvedChunk: string[]) => {
        try {
          const apiResults = await signStoragePathsViaApi(
            bucket,
            unresolvedChunk,
            expiresInSeconds,
            {
              surface,
              queryMode,
              tab,
              previewProfile: resolvedPreviewProfile,
            }
          );
          if (apiResults) {
            for (const path of unresolvedChunk) {
              settleOwnedPath(path, apiResults[path] ?? null);
            }
            return;
          }
        } catch {
          // Fall through to direct sign fallback below.
        }

        await Promise.all(
          unresolvedChunk.map(async (path) => {
            const signedUrl = await signStoragePathDirect(
              bucket,
              path,
              expiresInSeconds,
              resolvedPreviewProfile
            ).catch(() => null);
            settleOwnedPath(path, signedUrl ?? null);
          })
        );
      }
    );
  } finally {
    for (const [path, deferred] of ownedDeferredByPath.entries()) {
      deferred.resolve(resolvedOwnedByPath.get(path) ?? null);
      ownedDeferredByPath.delete(path);
    }
  }

  for (const path of ownedPaths) {
    result.set(path, resolvedOwnedByPath.get(path) ?? null);
  }
  return result;
};

/**
 * Remove a storage object from the signed URL cache.
 */
export const invalidateSignedMediaUrl = (bucket: string, storagePath?: string | null) => {
  if (!storagePath) return;
  const prefix = `${bucket}:${storagePath}:`;
  for (const key of signedUrlCache.keys()) {
    if (!key.startsWith(prefix)) continue;
    signedUrlCache.delete(key);
  }
};
