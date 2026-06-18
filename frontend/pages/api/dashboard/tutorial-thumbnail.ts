/**
 * Stable public delivery route for dashboard tutorial thumbnail assets.
 *
 * Public pages use this path instead of embedding changing Supabase signed URLs,
 * which lets browsers cache the same thumbnail URL across reloads.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  DASHBOARD_TUTORIAL_THUMBNAIL_BUCKET,
  isDashboardTutorialThumbnailObjectStoragePath,
} from "../../../lib/server/api/dashboardTutorialThumbnailShared";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type TutorialThumbnailErrorResponse = {
  error: string;
};

const DASHBOARD_TUTORIAL_THUMBNAIL_DELIVERY_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800, immutable";
const DASHBOARD_TUTORIAL_THUMBNAIL_MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;
const DASHBOARD_TUTORIAL_THUMBNAIL_MEMORY_CACHE_MAX_BYTES = 8 * 1024 * 1024;

type CachedDashboardTutorialThumbnail = {
  body: Buffer;
  contentType: string;
  etag: string;
  loadedAt: number;
};

type SignedDashboardTutorialThumbnail = {
  signedUrl: string;
};

type ByteRange = {
  end: number;
  start: number;
};

const thumbnailMemoryCache = new Map<string, CachedDashboardTutorialThumbnail>();
let thumbnailMemoryCacheBytes = 0;

const inferDashboardTutorialThumbnailContentType = (storagePath: string): string => {
  const normalized = storagePath.toLowerCase();
  if (normalized.endsWith(".mp4")) return "video/mp4";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
};

const readPathQuery = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : (value ?? "")).trim();

const createThumbnailEtag = (storagePath: string, body: Buffer): string =>
  `"${createHash("sha1").update(storagePath).update(":").update(body).digest("hex")}"`;

const createStoragePathEtag = (storagePath: string): string =>
  `"${createHash("sha1").update(storagePath).digest("hex")}"`;

const readFirstHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const readFreshCachedThumbnail = (storagePath: string): CachedDashboardTutorialThumbnail | null => {
  const cached = thumbnailMemoryCache.get(storagePath);
  if (!cached) return null;
  if (Date.now() - cached.loadedAt > DASHBOARD_TUTORIAL_THUMBNAIL_MEMORY_CACHE_TTL_MS) {
    thumbnailMemoryCache.delete(storagePath);
    thumbnailMemoryCacheBytes -= cached.body.byteLength;
    return null;
  }
  thumbnailMemoryCache.delete(storagePath);
  thumbnailMemoryCache.set(storagePath, cached);
  return cached;
};

const rememberThumbnail = (
  storagePath: string,
  thumbnail: CachedDashboardTutorialThumbnail
): void => {
  const existing = thumbnailMemoryCache.get(storagePath);
  if (existing) {
    thumbnailMemoryCacheBytes -= existing.body.byteLength;
    thumbnailMemoryCache.delete(storagePath);
  }

  thumbnailMemoryCache.set(storagePath, thumbnail);
  thumbnailMemoryCacheBytes += thumbnail.body.byteLength;

  while (
    thumbnailMemoryCacheBytes > DASHBOARD_TUTORIAL_THUMBNAIL_MEMORY_CACHE_MAX_BYTES &&
    thumbnailMemoryCache.size > 0
  ) {
    const oldestKey = thumbnailMemoryCache.keys().next().value;
    if (!oldestKey) return;
    const oldest = thumbnailMemoryCache.get(oldestKey);
    thumbnailMemoryCache.delete(oldestKey);
    if (oldest) {
      thumbnailMemoryCacheBytes -= oldest.body.byteLength;
    }
  }
};

const parseByteRange = (rangeHeader: string | undefined, size: number): ByteRange | null => {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  const [, startRaw, endRaw] = match;
  if (!startRaw && !endRaw) return null;

  if (!startRaw) {
    const suffixLength = Number(endRaw);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    const start = Math.max(0, size - suffixLength);
    return { start, end: size - 1 };
  }

  const start = Number(startRaw);
  const requestedEnd = endRaw ? Number(endRaw) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= size
  ) {
    return null;
  }

  return { start, end: Math.min(requestedEnd, size - 1) };
};

const signDashboardTutorialThumbnail = async (
  storagePath: string
): Promise<SignedDashboardTutorialThumbnail | null> => {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(DASHBOARD_TUTORIAL_THUMBNAIL_BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return { signedUrl: data.signedUrl };
};

const loadDashboardTutorialThumbnail = async (
  storagePath: string
): Promise<CachedDashboardTutorialThumbnail | null> => {
  const cached = readFreshCachedThumbnail(storagePath);
  if (cached) return cached;

  const signedThumbnail = await signDashboardTutorialThumbnail(storagePath);
  if (!signedThumbnail) return null;

  const upstream = await fetch(signedThumbnail.signedUrl);
  if (!upstream.ok) {
    return null;
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  const thumbnail = {
    body,
    contentType:
      upstream.headers.get("content-type") ??
      inferDashboardTutorialThumbnailContentType(storagePath),
    etag: createThumbnailEtag(storagePath, body),
    loadedAt: Date.now(),
  };
  rememberThumbnail(storagePath, thumbnail);
  return thumbnail;
};

const proxyDashboardTutorialThumbnailRange = async ({
  method,
  rangeHeader,
  res,
  storagePath,
}: {
  method: string | undefined;
  rangeHeader: string;
  res: NextApiResponse<Buffer | TutorialThumbnailErrorResponse>;
  storagePath: string;
}): Promise<boolean> => {
  const signedThumbnail = await signDashboardTutorialThumbnail(storagePath);
  if (!signedThumbnail) return false;

  const upstream = await fetch(signedThumbnail.signedUrl, {
    headers: {
      Range: rangeHeader,
    },
  });

  if (upstream.status === 416) {
    const upstreamContentRange = upstream.headers.get("content-range");
    if (upstreamContentRange) {
      res.setHeader("Content-Range", upstreamContentRange);
    }
    res.status(416).end();
    return true;
  }

  if (upstream.status !== 206) {
    return false;
  }

  res.setHeader("Cache-Control", DASHBOARD_TUTORIAL_THUMBNAIL_DELIVERY_CACHE_CONTROL);
  res.setHeader("Accept-Ranges", upstream.headers.get("accept-ranges") ?? "bytes");
  res.setHeader(
    "Content-Type",
    upstream.headers.get("content-type") ?? inferDashboardTutorialThumbnailContentType(storagePath)
  );
  res.setHeader("ETag", upstream.headers.get("etag") ?? createStoragePathEtag(storagePath));
  const upstreamContentRange = upstream.headers.get("content-range");
  if (upstreamContentRange) {
    res.setHeader("Content-Range", upstreamContentRange);
  }
  const upstreamContentLength = upstream.headers.get("content-length");
  if (upstreamContentLength) {
    res.setHeader("Content-Length", upstreamContentLength);
  }

  if (method === "HEAD") {
    res.status(206).end();
    return true;
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  if (!upstreamContentLength) {
    res.setHeader("Content-Length", String(body.byteLength));
  }
  res.status(206).send(body);
  return true;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Buffer | TutorialThumbnailErrorResponse>
) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const storagePath = readPathQuery(req.query.path);
  if (!isDashboardTutorialThumbnailObjectStoragePath(storagePath)) {
    return res.status(400).json({ error: "Invalid thumbnail path." });
  }

  try {
    const requestHeaders = req.headers ?? {};
    const ifNoneMatchHeader = readFirstHeaderValue(requestHeaders["if-none-match"]);
    const rangeHeader = readFirstHeaderValue(requestHeaders.range);
    const cachedThumbnail = readFreshCachedThumbnail(storagePath);

    if (rangeHeader && !cachedThumbnail) {
      const proxiedRange = await proxyDashboardTutorialThumbnailRange({
        method: req.method,
        rangeHeader,
        res,
        storagePath,
      });
      if (proxiedRange) return;
    }

    const thumbnail = cachedThumbnail ?? (await loadDashboardTutorialThumbnail(storagePath));
    if (!thumbnail) {
      return res.status(404).json({ error: "Thumbnail not found." });
    }

    res.setHeader("Cache-Control", DASHBOARD_TUTORIAL_THUMBNAIL_DELIVERY_CACHE_CONTROL);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", thumbnail.contentType);
    res.setHeader("ETag", thumbnail.etag);

    if (ifNoneMatchHeader === thumbnail.etag && !rangeHeader) {
      return res.status(304).end();
    }

    const range = parseByteRange(rangeHeader, thumbnail.body.byteLength);
    if (rangeHeader && !range) {
      res.setHeader("Content-Range", `bytes */${thumbnail.body.byteLength}`);
      return res.status(416).end();
    }

    if (range) {
      const body = thumbnail.body.subarray(range.start, range.end + 1);
      res.setHeader(
        "Content-Range",
        `bytes ${range.start}-${range.end}/${thumbnail.body.byteLength}`
      );
      res.setHeader("Content-Length", String(body.byteLength));
      if (req.method === "HEAD") {
        return res.status(206).end();
      }
      return res.status(206).send(body);
    }

    res.setHeader("Content-Length", String(thumbnail.body.byteLength));

    if (req.method === "HEAD") {
      return res.status(200).end();
    }

    return res.status(200).send(thumbnail.body);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "dashboard/tutorial-thumbnail",
      user: null,
      metadata: {
        source: "api.dashboard.tutorial-thumbnail",
      },
    });
    return res.status(500).json({ error: "Unable to load thumbnail." });
  }
}
