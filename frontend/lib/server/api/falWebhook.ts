import crypto from "crypto";
import type { NextApiRequest } from "next";
import { readRawRequestBody } from "./requestBody";

type JsonObject = Record<string, unknown>;

export type FalWebhookHeaders = {
  requestId: string | null;
  userId: string | null;
  eventId: string | null;
  timestamp: string | null;
  signature: string | null;
};

export type FalWebhookVerifyResult = {
  ok: boolean;
  method: "fal" | null;
  reason?: string;
  payloadHash?: string;
};

type JwkKey = JsonObject & {
  kid?: string;
  kty?: string;
  crv?: string;
  alg?: string;
  x?: string;
};

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const FAL_WEBHOOK_JWKS_URL = "https://rest.alpha.fal.ai/.well-known/jwks.json";
const FAL_WEBHOOK_TOLERANCE_SECONDS = 300;

let jwksCache: {
  url: string;
  fetchedAtMs: number;
  keys: JwkKey[];
} | null = null;

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const secureCompareBytes = (left: Buffer, right: Buffer): boolean => {
  try {
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
};

const parseTimestampSeconds = (timestamp: string | null): number | null => {
  if (!timestamp) return null;
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

const isTimestampFresh = (timestampSeconds: number, toleranceSeconds: number): boolean => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - timestampSeconds) <= toleranceSeconds;
};

const parseFalSignatureCandidates = (headerValue: string): Buffer[] => {
  const trimmed = headerValue.trim();
  if (!trimmed) return [];
  const tokens = trimmed
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const signatures: Buffer[] = [];

  for (const token of tokens) {
    if (/^v\d+$/i.test(token)) continue;
    const value = token.includes("=") ? token.split("=").slice(1).join("=") : token;
    const candidate = value.trim();
    if (!candidate) continue;
    if (/^[0-9a-fA-F]+$/.test(candidate) && candidate.length % 2 === 0) {
      signatures.push(Buffer.from(candidate, "hex"));
      continue;
    }
    const normalizedBase64 = candidate.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalizedBase64 + "=".repeat((4 - (normalizedBase64.length % 4)) % 4);
    try {
      signatures.push(Buffer.from(padded, "base64"));
    } catch {
      continue;
    }
  }

  return signatures.filter((buffer) => buffer.byteLength > 0);
};

const filterFalJwksKeys = (value: unknown): JwkKey[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const keys = (value as { keys?: unknown }).keys;
  if (!Array.isArray(keys)) return [];
  return keys
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => item as JwkKey)
    .filter((item) => {
      const kty = asString(item.kty)?.toUpperCase();
      const crv = asString(item.crv)?.toLowerCase();
      const x = asString(item.x);
      return Boolean(kty === "OKP" && crv === "ed25519" && x);
    });
};

const fetchFalJwksKeys = async (jwksUrl: string, forceRefresh = false): Promise<JwkKey[]> => {
  const now = Date.now();
  if (
    !forceRefresh &&
    jwksCache &&
    jwksCache.url === jwksUrl &&
    now - jwksCache.fetchedAtMs <= JWKS_CACHE_TTL_MS
  ) {
    return jwksCache.keys;
  }

  const response = await fetch(jwksUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`JWKS fetch failed (${response.status})`);
  }
  const parsed = (await response.json()) as unknown;
  const keys = filterFalJwksKeys(parsed);
  jwksCache = {
    url: jwksUrl,
    fetchedAtMs: now,
    keys,
  };
  return keys;
};

export const buildFalWebhookSignedMessage = ({
  requestId,
  userId,
  timestamp,
  payloadHash,
}: {
  requestId: string;
  userId: string;
  timestamp: string;
  payloadHash: string;
}): string => {
  return [requestId, userId, timestamp, payloadHash].join("\n");
};

const verifyWithFalJwks = async ({
  rawBody,
  headers,
  jwksUrl = FAL_WEBHOOK_JWKS_URL,
  toleranceSeconds = FAL_WEBHOOK_TOLERANCE_SECONDS,
}: {
  rawBody: string;
  headers: FalWebhookHeaders;
  jwksUrl?: string;
  toleranceSeconds?: number;
}): Promise<FalWebhookVerifyResult> => {
  if (!headers.requestId || !headers.userId || !headers.timestamp || !headers.signature) {
    return { ok: false, method: null, reason: "missing_required_fal_headers" };
  }
  const timestampSeconds = parseTimestampSeconds(headers.timestamp);
  if (timestampSeconds === null) {
    return { ok: false, method: null, reason: "invalid_timestamp" };
  }
  if (!isTimestampFresh(timestampSeconds, toleranceSeconds)) {
    return { ok: false, method: null, reason: "timestamp_out_of_window" };
  }

  const payloadHash = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
  const message = buildFalWebhookSignedMessage({
    requestId: headers.requestId,
    userId: headers.userId,
    timestamp: headers.timestamp,
    payloadHash,
  });
  const messageBytes = Buffer.from(message, "utf8");
  const signatureCandidates = parseFalSignatureCandidates(headers.signature);
  if (!signatureCandidates.length) {
    return { ok: false, method: null, reason: "invalid_signature_format", payloadHash };
  }

  const attemptVerify = async (forceRefresh: boolean): Promise<boolean> => {
    const keys = await fetchFalJwksKeys(jwksUrl, forceRefresh);
    for (const key of keys) {
      let publicKey: crypto.KeyObject;
      try {
        publicKey = crypto.createPublicKey({
          key: key as unknown as crypto.JsonWebKey,
          format: "jwk",
        });
      } catch {
        continue;
      }
      for (const signature of signatureCandidates) {
        try {
          if (crypto.verify(null, messageBytes, publicKey, signature)) {
            return true;
          }
        } catch {
          continue;
        }
      }
    }
    return false;
  };

  try {
    if (await attemptVerify(false)) {
      return { ok: true, method: "fal", payloadHash };
    }
    if (await attemptVerify(true)) {
      return { ok: true, method: "fal", payloadHash };
    }
  } catch {
    return { ok: false, method: null, reason: "fal_jwks_unavailable", payloadHash };
  }
  return { ok: false, method: null, reason: "fal_signature_verification_failed", payloadHash };
};

const readHeader = (req: NextApiRequest, name: string): string | null => {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return asString(value[0]);
  return asString(value);
};

export const readFalWebhookHeaders = (req: NextApiRequest): FalWebhookHeaders => ({
  requestId:
    readHeader(req, "x-fal-webhook-request-id") ??
    readHeader(req, "x-fal-request-id") ??
    readHeader(req, "x-fal-requestid"),
  userId: readHeader(req, "x-fal-webhook-user-id") ?? readHeader(req, "x-fal-user-id"),
  eventId: readHeader(req, "x-fal-webhook-event-id") ?? readHeader(req, "x-fal-event-id"),
  timestamp: readHeader(req, "x-fal-webhook-timestamp") ?? readHeader(req, "x-fal-timestamp"),
  signature: readHeader(req, "x-fal-webhook-signature") ?? readHeader(req, "x-fal-signature"),
});

export const readRawBody = async (
  req: NextApiRequest,
  options?: { maxBytes?: number }
): Promise<string> =>
  readRawRequestBody(req, {
    maxBytes: options?.maxBytes ?? 512 * 1024,
  });

export const verifyFalWebhookSignature = async ({
  rawBody,
  headers,
  config,
}: {
  rawBody: string;
  headers: FalWebhookHeaders;
  config?: {
    jwksUrl?: string;
    toleranceSeconds?: number;
  };
}): Promise<FalWebhookVerifyResult> => {
  const toleranceSeconds = config?.toleranceSeconds ?? FAL_WEBHOOK_TOLERANCE_SECONDS;
  return await verifyWithFalJwks({
    rawBody,
    headers,
    jwksUrl: config?.jwksUrl ?? FAL_WEBHOOK_JWKS_URL,
    toleranceSeconds,
  });
};

export const verifyFalWebhookBodyHash = ({
  rawBody,
  expectedHash,
}: {
  rawBody: string;
  expectedHash: string | null;
}): boolean => {
  const normalizedExpected = asString(expectedHash);
  if (!normalizedExpected) return true;
  const actual = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
  return secureCompareBytes(Buffer.from(actual, "utf8"), Buffer.from(normalizedExpected, "utf8"));
};
