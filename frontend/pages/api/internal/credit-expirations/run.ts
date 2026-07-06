/**
 * Internal worker route for expiring unused subscription credit grants.
 */
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

const ROUTE_LABEL = "internal/credit-expirations/run";

const secureCompare = (left: string, right: string): boolean => {
  try {
    return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
  } catch {
    return false;
  }
};

const readHeader = (req: NextApiRequest, name: string): string | null => {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === "string" ? raw : null;
};

const readBearerToken = (req: NextApiRequest): string | null => {
  const authHeader = readHeader(req, "authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.trim().toLowerCase() !== "bearer") return null;
  const trimmed = token.trim();
  return trimmed.length ? trimmed : null;
};

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const readBatchSize = (): number => {
  const parsed = Number(process.env.SHORTPULSE_CREDIT_EXPIRATIONS_BATCH_SIZE ?? 500);
  if (!Number.isFinite(parsed)) return 500;
  return Math.max(1, Math.min(5000, Math.trunc(parsed)));
};

const isWorkerEnabled = (): boolean =>
  parseBooleanEnv(process.env.SHORTPULSE_CREDIT_EXPIRATIONS_ENABLED, false);

const isAuthorized = (req: NextApiRequest): boolean => {
  const headerSecret = readHeader(req, "x-shortpulse-cron-secret");
  const bearerToken = readBearerToken(req);
  const expectedSecrets = [
    process.env.SHORTPULSE_CREDIT_EXPIRATIONS_CRON_SECRET,
    process.env.CRON_SECRET,
  ]
    .map((value) => value?.trim() ?? null)
    .filter((value): value is string => Boolean(value));

  return (
    expectedSecrets.length > 0 &&
    expectedSecrets.some((expected) => {
      const headerMatches = headerSecret !== null && secureCompare(headerSecret, expected);
      const bearerMatches = bearerToken !== null && secureCompare(bearerToken, expected);
      return headerMatches || bearerMatches;
    })
  );
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isWorkerEnabled()) {
    return res.status(404).json({ error: "Not found" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const batchSize = readBatchSize();
    const rpcClient = getSupabaseAdmin() as unknown as {
      rpc: (
        name: string,
        params: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message?: string } | null }>;
    };
    const { data, error } = await rpcClient.rpc("expire_credit_grants", {
      p_batch_size: batchSize,
    });
    if (error) {
      throw new Error(error.message ?? "Credit expiration RPC failed.");
    }

    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : null;

    return res.status(200).json({
      ok: true,
      expiredGrants: Number(row?.expired_grants ?? 0),
      expiredCents: Number(row?.expired_cents ?? 0),
      batchSize,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: ROUTE_LABEL,
    });
    return res.status(500).json({ error: "Credit expiration failed." });
  }
}
