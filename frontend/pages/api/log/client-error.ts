/**
 * Client error ingest endpoint.
 * Accepts authenticated browser runtime/API failure reports and stores actionable app incidents.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { writeAppErrorLog } from "../../../lib/server/api/appErrorLogs";

type ClientErrorRequest = {
  source?: string;
  scope?: "app" | "generation";
  severity?: "low" | "medium" | "high";
  message?: string;
  stack?: string | null;
  route?: string | null;
  endpoint?: string | null;
  requestId?: string | null;
  statusCode?: number | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) {
    return;
  }

  try {
    const payload = (
      typeof req.body === "object" && req.body ? req.body : {}
    ) as ClientErrorRequest;
    const writeResult = await writeAppErrorLog({
      source: payload.source ?? "client.runtime",
      scope: payload.scope ?? "app",
      severity: payload.severity,
      message: payload.message ?? "Unknown client error",
      stack: payload.stack ?? null,
      route: payload.route ?? null,
      endpoint: payload.endpoint ?? null,
      requestId: payload.requestId ?? null,
      statusCode: payload.statusCode ?? null,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        ...((payload.metadata ?? {}) as Record<string, unknown>),
        user_agent: req.headers["user-agent"] ?? null,
        host: req.headers.host ?? null,
        vercel_id: req.headers["x-vercel-id"] ?? null,
      },
      occurredAt: payload.occurredAt ?? null,
    });

    return res.status(202).json({
      logged: writeResult.ok && !writeResult.skipped,
      skipped: writeResult.skipped,
      id: writeResult.id,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Client error log ingestion failed.",
    });
  }
}
