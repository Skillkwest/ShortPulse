/**
 * Cron-authenticated media derivative worker route.
 * Claims image rows, generates thumb variants, and updates processing status via RPCs.
 */
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { readMediaDerivativesRuntimeFlags } from "../../../../lib/server/api/mediaDerivativesRuntimeFlags";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import {
  processClaimedMediaDerivative,
  type ClaimedMediaDerivativeRow,
} from "../../../../lib/server/mediaDerivatives/processMediaDerivative";

type JsonObject = Record<string, unknown>;

type RunDerivativesSuccessResponse = {
  ok: true;
  triggerSource: "scheduled" | "manual";
  durationMs: number;
  claimed: number;
  processed: number;
  ready: number;
  failed: number;
  retryScheduled: number;
  exhausted: number;
  variantRowsUpserted: number;
  errors: number;
};

type RunDerivativesErrorResponse = {
  error: string;
  details?: string;
};

type ClaimedDerivativeRow = {
  id: string;
  user_id: string;
  storage_path: string;
  file_type: string;
  processing_attempts: number;
  processing_status: string;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const asInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const parseClaimedDerivativeRow = (value: unknown): ClaimedDerivativeRow | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonObject;
  const id = asString(row.id);
  const userId = asString(row.user_id);
  const storagePath = asString(row.storage_path);
  const fileType = asString(row.file_type);
  const processingStatus = asString(row.processing_status);
  const processingAttempts = asInteger(row.processing_attempts);
  if (
    !id ||
    !userId ||
    !storagePath ||
    !fileType ||
    !processingStatus ||
    processingAttempts === null
  ) {
    return null;
  }
  return {
    id,
    user_id: userId,
    storage_path: storagePath,
    file_type: fileType,
    processing_attempts: Math.max(0, processingAttempts),
    processing_status: processingStatus,
  };
};

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
  const authorization = readHeader(req, "authorization");
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (!scheme || !token) return null;
  if (scheme.trim().toLowerCase() !== "bearer") return null;
  const normalized = token.trim();
  return normalized.length ? normalized : null;
};

const normalizeTriggerSource = (value: unknown): "scheduled" | "manual" => {
  return value === "manual" ? "manual" : "scheduled";
};

const readTriggerSource = (req: NextApiRequest): "scheduled" | "manual" => {
  const headerValue = readHeader(req, "x-shortpulse-trigger-source");
  if (headerValue !== null) {
    return normalizeTriggerSource(headerValue.trim().toLowerCase());
  }

  const triggerSourceQuery = req.query?.triggerSource;
  const queryValue = Array.isArray(triggerSourceQuery) ? triggerSourceQuery[0] : triggerSourceQuery;
  if (typeof queryValue === "string") {
    return normalizeTriggerSource(queryValue.trim().toLowerCase());
  }

  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return normalizeTriggerSource((req.body as JsonObject).triggerSource);
  }

  return "scheduled";
};

const resolveBackoffSeconds = ({
  attempts,
  baseSeconds,
  maxSeconds,
}: {
  attempts: number;
  baseSeconds: number;
  maxSeconds: number;
}): number => {
  const exponent = Math.max(0, attempts - 1);
  const backoff = baseSeconds * Math.pow(2, exponent);
  if (!Number.isFinite(backoff)) return maxSeconds;
  return Math.max(1, Math.min(maxSeconds, Math.trunc(backoff)));
};

const TERMINAL_DERIVATIVE_ERROR_PREFIXES = ["unsupported_input", "decode_failed"] as const;

const isTerminalDerivativeError = (message: string): boolean => {
  const normalized = message.trim().toLowerCase();
  if (normalized.includes("unsupported image format")) return true;
  return TERMINAL_DERIVATIVE_ERROR_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const toClaimedRows = (value: unknown): ClaimedMediaDerivativeRow[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => parseClaimedDerivativeRow(row))
    .filter((row): row is ClaimedDerivativeRow => Boolean(row));
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RunDerivativesSuccessResponse | RunDerivativesErrorResponse>
) {
  const startedAt = Date.now();

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const flags = readMediaDerivativesRuntimeFlags();
  if (!flags.enabled) {
    return res.status(404).json({ error: "Not found" });
  }

  const providedHeaderSecret = readHeader(req, "x-shortpulse-cron-secret");
  const providedBearerToken = readBearerToken(req);
  const expectedSecrets = [flags.cronSecret, process.env.CRON_SECRET]
    .map((value) => value?.trim() ?? null)
    .filter((value): value is string => Boolean(value));

  if (expectedSecrets.length === 0) {
    return res.status(503).json({
      error: "Derivative worker misconfigured",
      details: "Missing cron secret configuration",
    });
  }

  const isAuthorized = expectedSecrets.some((expectedSecret) => {
    const headerMatches =
      providedHeaderSecret !== null && secureCompare(providedHeaderSecret, expectedSecret);
    const bearerMatches =
      providedBearerToken !== null && secureCompare(providedBearerToken, expectedSecret);
    return headerMatches || bearerMatches;
  });

  if (!isAuthorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const triggerSource = readTriggerSource(req);

  try {
    const claimResponse = await supabaseAdmin.rpc("claim_media_derivative_batch", {
      p_limit: flags.batchSize,
      p_max_attempts: flags.maxAttempts,
      p_lease_seconds: flags.leaseSeconds,
    });
    if (claimResponse.error) {
      throw new Error(`Derivative claim failed: ${claimResponse.error.message}`);
    }

    const claimedRows = toClaimedRows(claimResponse.data);
    let processed = 0;
    let ready = 0;
    let failed = 0;
    let retryScheduled = 0;
    let exhausted = 0;
    let errors = 0;
    let variantRowsUpserted = 0;

    for (const row of claimedRows) {
      processed += 1;

      try {
        if (!row.file_type.toLowerCase().startsWith("image")) {
          await supabaseAdmin.rpc("mark_media_derivative_failed", {
            p_media_file_id: row.id,
            p_user_id: row.user_id,
            p_error: "unsupported_media_type",
            p_retry_seconds: flags.retryMaxSeconds,
            p_exhausted: true,
          });
          exhausted += 1;
          failed += 1;
          continue;
        }

        const result = await processClaimedMediaDerivative({
          row,
          flags,
          supabaseAdmin,
        });

        variantRowsUpserted += result.generatedVariants;

        const markReadyResponse = await supabaseAdmin.rpc("mark_media_derivative_ready", {
          p_media_file_id: row.id,
          p_user_id: row.user_id,
          p_thumb_variant_path: result.thumbPath,
          p_width: result.width,
          p_height: result.height,
        });

        if (markReadyResponse.error) {
          throw new Error(`mark_media_derivative_ready failed: ${markReadyResponse.error.message}`);
        }

        ready += 1;
      } catch (error) {
        errors += 1;
        failed += 1;
        const errorMessage =
          error instanceof Error ? error.message : "derivative_processing_failed";
        const attempts = Math.max(1, row.processing_attempts);
        const exhaustedNow =
          attempts >= flags.maxAttempts || isTerminalDerivativeError(errorMessage);
        const retrySeconds = resolveBackoffSeconds({
          attempts,
          baseSeconds: flags.retryBaseSeconds,
          maxSeconds: flags.retryMaxSeconds,
        });

        const markFailedResponse = await supabaseAdmin.rpc("mark_media_derivative_failed", {
          p_media_file_id: row.id,
          p_user_id: row.user_id,
          p_error: errorMessage,
          p_retry_seconds: retrySeconds,
          p_exhausted: exhaustedNow,
        });

        if (markFailedResponse.error) {
          await logApiRouteException({
            req,
            error: markFailedResponse.error,
            routeLabel: "internal/media-derivatives/run",
            metadata: {
              stage: "mark_failed",
              media_file_id: row.id,
            },
          });
        }

        if (exhaustedNow) {
          exhausted += 1;
        } else {
          retryScheduled += 1;
        }
      }
    }

    return res.status(200).json({
      ok: true,
      triggerSource,
      durationMs: Math.max(0, Date.now() - startedAt),
      claimed: claimedRows.length,
      processed,
      ready,
      failed,
      retryScheduled,
      exhausted,
      variantRowsUpserted,
      errors,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "internal/media-derivatives/run",
    });
    return res.status(500).json({
      error: "Derivative worker run failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
