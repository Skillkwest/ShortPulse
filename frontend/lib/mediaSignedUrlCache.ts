/**
 * Shared client-side signed URL cache for media assets.
 * Deduplicates concurrent sign requests and reuses URLs until shortly before expiry.
 */
import { fetchWithAuth } from "./authenticatedFetch";
import { ensureSupabaseClient } from "./supabaseClient";

type SignedMediaUrlOptions = {
  bucket: string;
  storagePath: string;
  expiresInSeconds?: number;
  forceRefresh?: boolean;
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
};

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_REFRESH_BUFFER_MS = 20_000;
const MAX_SIGNED_URL_CACHE_ENTRIES = 1200;
const MAX_BATCH_SIGN_PATHS = 60;

const signedUrlCache = new Map<string, SignedMediaUrlCacheEntry>();
const inFlightSignedUrlRequests = new Map<string, Promise<string | null>>();

const cacheKeyFor = (bucket: string, storagePath: string) => `${bucket}:${storagePath}`;

const chunkStoragePaths = (storagePaths: string[], chunkSize: number): string[][] => {
  const chunks: string[][] = [];
  for (let index = 0; index < storagePaths.length; index += chunkSize) {
    chunks.push(storagePaths.slice(index, index + chunkSize));
  }
  return chunks;
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
  signedUrl: string,
  expiresInSeconds: number
) => {
  signedUrlCache.set(cacheKeyFor(bucket, storagePath), {
    url: signedUrl,
    expiresAtMs: Date.now() + expiresInSeconds * 1000,
  });
  pruneSignedUrlCache();
};

const getCachedUrl = (bucket: string, storagePath: string): string | null => {
  const key = cacheKeyFor(bucket, storagePath);
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
  expiresInSeconds: number
): Promise<string | null> => {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data?.signedUrl ?? null;
};

const signStoragePathsViaApi = async (
  bucket: string,
  storagePaths: string[],
  expiresInSeconds: number
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
}: SignedMediaUrlOptions): Promise<string | null> => {
  if (!storagePath) return null;
  const key = cacheKeyFor(bucket, storagePath);
  if (!forceRefresh) {
    const cachedUrl = getCachedUrl(bucket, storagePath);
    if (cachedUrl) return cachedUrl;
  }

  const inFlight = inFlightSignedUrlRequests.get(key);
  if (inFlight && !forceRefresh) {
    return inFlight;
  }

  const task = (async () => {
    const url = await signStoragePathDirect(bucket, storagePath, expiresInSeconds);
    if (url) {
      setCachedUrl(bucket, storagePath, url, expiresInSeconds);
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
}: SignedMediaUrlBatchOptions): Promise<Map<string, string | null>> => {
  const dedupedPaths = Array.from(new Set(storagePaths.map((path) => path.trim()).filter(Boolean)));
  const result = new Map<string, string | null>();
  if (!dedupedPaths.length) return result;

  const unresolvedPaths: string[] = [];
  for (const path of dedupedPaths) {
    if (!forceRefresh) {
      const cachedUrl = getCachedUrl(bucket, path);
      if (cachedUrl) {
        result.set(path, cachedUrl);
        continue;
      }
    }
    unresolvedPaths.push(path);
  }

  if (!unresolvedPaths.length) return result;

  for (const unresolvedChunk of chunkStoragePaths(unresolvedPaths, MAX_BATCH_SIGN_PATHS)) {
    const apiResults = await signStoragePathsViaApi(bucket, unresolvedChunk, expiresInSeconds);
    if (apiResults) {
      for (const path of unresolvedChunk) {
        const signedUrl = apiResults[path] ?? null;
        if (signedUrl) {
          setCachedUrl(bucket, path, signedUrl, expiresInSeconds);
        } else {
          signedUrlCache.delete(cacheKeyFor(bucket, path));
        }
        result.set(path, signedUrl);
      }
      continue;
    }

    const directResults = await Promise.all(
      unresolvedChunk.map((path) =>
        getSignedMediaUrl({
          bucket,
          storagePath: path,
          expiresInSeconds,
          forceRefresh,
        }).then((signedUrl) => ({ path, signedUrl }))
      )
    );
    for (const { path, signedUrl } of directResults) {
      result.set(path, signedUrl ?? null);
    }
  }

  return result;
};

/**
 * Remove a storage object from the signed URL cache.
 */
export const invalidateSignedMediaUrl = (bucket: string, storagePath?: string | null) => {
  if (!storagePath) return;
  signedUrlCache.delete(cacheKeyFor(bucket, storagePath));
};
