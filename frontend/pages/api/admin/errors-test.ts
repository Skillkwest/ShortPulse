/**
 * Admin API: trigger a synthetic incident for telemetry smoke-testing.
 * Creates a real log entry so operators can validate the Admin Errors UI end-to-end.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { logApiRouteException, writeAppErrorLog } from "../../../lib/server/api/appErrorLogs";

type TriggerScope = "app" | "generation";
type TriggerSeverity = "low" | "medium" | "high";

type TriggerRequest = {
  scope?: TriggerScope;
  severity?: TriggerSeverity;
  statusCode?: number;
  message?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

const asTrimmedString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const asScope = (value: unknown): TriggerScope => {
  return value === "generation" ? "generation" : "app";
};

const asSeverity = (value: unknown, statusCode: number): TriggerSeverity => {
  if (value === "low" || value === "medium" || value === "high") return value;
  return statusCode >= 500 ? "high" : "medium";
};

const asStatusCode = (value: unknown, scope: TriggerScope): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return scope === "generation" ? 502 : 500;
  const code = Math.trunc(parsed);
  if (code < 100 || code > 599) return scope === "generation" ? 502 : 500;
  return code;
};

const requestIdFromHeader = (req: NextApiRequest): string | null => {
  const headers =
    req && typeof req === "object" ? (req as { headers?: Record<string, unknown> }).headers : null;
  if (!headers || typeof headers !== "object") return null;
  const raw = headers["x-shortpulse-request-id"];
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 120);
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) {
    return raw[0].trim().slice(0, 120);
  }
  return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const body = (req.body ?? {}) as TriggerRequest;
  const scope = asScope(body.scope);
  const statusCode = asStatusCode(body.statusCode, scope);
  const severity = asSeverity(body.severity, statusCode);
  const nowIso = new Date().toISOString();
  const defaultMessage = `Admin synthetic ${scope} incident ${nowIso}`;
  const message = asTrimmedString(body.message, 400) ?? defaultMessage;
  const source = asTrimmedString(body.source, 80) ?? `admin.synthetic_test.${scope}`;
  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

  try {
    const writeResult = await writeAppErrorLog({
      source,
      scope,
      severity,
      message,
      route: "admin/errors-test",
      endpoint: req.url ?? "/api/admin/errors-test",
      requestId: requestIdFromHeader(req),
      statusCode,
      userId: adminUser.id,
      userEmail: adminUser.email ?? null,
      metadata: {
        synthetic: true,
        synthetic_source: "admin_ui",
        triggered_at: nowIso,
        triggered_by: adminUser.id,
        ...metadata,
      },
      occurredAt: nowIso,
    });

    if (!writeResult.ok) {
      return res.status(500).json({ error: "Failed to create synthetic incident." });
    }

    return res.status(201).json({
      ok: true,
      logged: !writeResult.skipped,
      skipped: writeResult.skipped,
      incidentId: writeResult.id,
      scope,
      severity,
      statusCode,
      source,
      occurredAt: nowIso,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/errors-test",
      user: adminUser,
      metadata: {
        requested_scope: scope,
        requested_source: source,
        requested_status_code: statusCode,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create synthetic incident.",
    });
  }
}
