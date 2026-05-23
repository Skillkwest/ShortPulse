/**
 * Lightweight per-instance API rate limiting for public and abuse-sensitive routes.
 * This is a defense-in-depth guard; platform/WAF limits should still cover distributed traffic.
 */
import type { NextApiRequest, NextApiResponse } from "next";

type ApiRateLimitOptions = {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
  nowMs?: number;
};

type ApiRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type RateLimitBucket = {
  count: number;
  resetAtMs: number;
};

const buckets = new Map<string, RateLimitBucket>();

const readHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
};

export const resolveApiClientIp = (req: Pick<NextApiRequest, "headers" | "socket">): string => {
  const headers = req.headers ?? {};
  const forwardedFor = readHeaderValue(headers["x-forwarded-for"]);
  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0]?.trim();
    if (firstHop) return firstHop;
  }

  return (
    readHeaderValue(headers["x-real-ip"]) ?? req.socket?.remoteAddress?.trim() ?? "unknown-client"
  );
};

export const checkApiRateLimit = (
  req: Pick<NextApiRequest, "headers" | "socket">,
  { keyPrefix, maxRequests, windowMs, nowMs = Date.now() }: ApiRateLimitOptions
): ApiRateLimitDecision => {
  const key = `${keyPrefix}:${resolveApiClientIp(req)}`;
  const existing = buckets.get(key);
  if (!existing || existing.resetAtMs <= nowMs) {
    buckets.set(key, { count: 1, resetAtMs: nowMs + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count <= maxRequests) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000)),
  };
};

export const enforceApiRateLimit = (
  req: Pick<NextApiRequest, "headers" | "socket">,
  res: NextApiResponse,
  options: ApiRateLimitOptions
): boolean => {
  const decision = checkApiRateLimit(req, options);
  if (decision.allowed) return true;

  res.setHeader("Retry-After", String(decision.retryAfterSeconds));
  res.status(429).json({
    error: "Too many requests",
    retryAfterSeconds: decision.retryAfterSeconds,
  });
  return false;
};

export const resetApiRateLimitForTests = () => {
  buckets.clear();
};
