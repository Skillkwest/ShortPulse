/**
 * Internal API: run one admin user-health fleet scan.
 */
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { runAdminUserHealthFleetScan } from "../../../../lib/server/adminUserHealth/fleet";
import { readAdminUserHealthFleetRuntimeFlags } from "../../../../lib/server/adminUserHealth/runtime";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const flags = readAdminUserHealthFleetRuntimeFlags();
  if (!flags.enabled) {
    return res.status(404).json({ error: "Not found" });
  }

  const headerSecret = readHeader(req, "x-shortpulse-cron-secret");
  const bearerToken = readBearerToken(req);
  const expectedSecrets = [flags.cronSecret, process.env.CRON_SECRET]
    .map((value) => value?.trim() ?? null)
    .filter((value): value is string => Boolean(value));

  const isAuthorized =
    expectedSecrets.length > 0 &&
    expectedSecrets.some((expected) => {
      const headerMatches = headerSecret !== null && secureCompare(headerSecret, expected);
      const bearerMatches = bearerToken !== null && secureCompare(bearerToken, expected);
      return headerMatches || bearerMatches;
    });

  if (!isAuthorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const triggerSource = req.method === "POST" ? "manual" : "scheduled";
    const result = await runAdminUserHealthFleetScan({
      triggerSource,
    });

    if (!result.ok && result.status === "running") {
      return res.status(409).json(result);
    }

    return res.status(result.status === "failed" ? 500 : 200).json(result);
  } catch (error) {
    await logApiRouteException({
      req,
      routeLabel: "internal/admin-user-health-fleet/run",
      error,
      metadata: {
        enabled: flags.enabled,
      },
    });

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Fleet scan failed",
    });
  }
}
