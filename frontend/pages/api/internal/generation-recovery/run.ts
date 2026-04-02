import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { readFalRuntimeFlags } from "../../../../lib/server/api/falRuntimeFlags";
import { runGenerationControlPlaneCycle } from "../../../../lib/server/generationControlPlane/runCycle";
import type { GenerationControlPlaneLogContext } from "../../../../lib/server/generationControlPlane/types";

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
  const headerValue = readHeader(req, "authorization");
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(" ");
  if (!scheme || !token) return null;
  if (scheme.trim().toLowerCase() !== "bearer") return null;
  const trimmed = token.trim();
  return trimmed.length ? trimmed : null;
};

const ROUTE_LABEL = "internal/generation-recovery/run";

const readRequestedRunMode = (req: NextApiRequest): "primary" | "rescue" => {
  const rawMode =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as { runMode?: unknown }).runMode
      : null;
  return typeof rawMode === "string" && rawMode.trim().toLowerCase() === "full"
    ? "primary"
    : "rescue";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const flags = readFalRuntimeFlags();
  if (!flags.reconcilerEnabled || flags.integrationMode === "legacy") {
    return res.status(404).json({ error: "Not found" });
  }

  const providedHeaderSecret = readHeader(req, "x-shortpulse-cron-secret");
  const providedBearerToken = readBearerToken(req);
  const expectedSecrets = [flags.reconcilerCronSecret, process.env.CRON_SECRET]
    .map((value) => value?.trim() ?? null)
    .filter((value): value is string => Boolean(value));

  const isAuthorized =
    expectedSecrets.length > 0 &&
    expectedSecrets.some((expectedSecret) => {
      const headerMatches =
        providedHeaderSecret !== null && secureCompare(providedHeaderSecret, expectedSecret);
      const bearerMatches =
        providedBearerToken !== null && secureCompare(providedBearerToken, expectedSecret);
      return headerMatches || bearerMatches;
    });

  if (!isAuthorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const runMode = readRequestedRunMode(req);
    const context: GenerationControlPlaneLogContext = {
      req,
      routeLabel: ROUTE_LABEL,
    };
    const result = await runGenerationControlPlaneCycle({
      context,
      mode: runMode,
    });
    return res.status(200).json({
      ...result,
      runMode,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: ROUTE_LABEL,
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Recovery run failed",
    });
  }
}
