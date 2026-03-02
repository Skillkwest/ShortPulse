/**
 * Saves one AI Studio session snapshot for the authenticated user.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import {
  parseAiStudioSessionId,
  parseAiStudioSessionSnapshot,
  saveAiStudioSessionSnapshot,
} from "../../../../lib/server/api/aiStudioSessions";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";

type SaveSessionRequestBody = {
  sid?: unknown;
  snapshot?: unknown;
  schemaVersion?: unknown;
  title?: unknown;
};

const parseSchemaVersion = (value: unknown): number | undefined => {
  if (typeof value === "undefined") return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
  if (value < 1 || value > 100) return undefined;
  return value;
};

const parseTitle = (value: unknown): string | null | undefined => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (process.env.SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED === "false") {
    return res.status(503).json({ error: "AI Studio sessions API is disabled" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as SaveSessionRequestBody;
  const sessionId = parseAiStudioSessionId(body.sid);
  if (!sessionId) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  const snapshot = parseAiStudioSessionSnapshot(body.snapshot);
  if (!snapshot) {
    return res.status(400).json({ error: "Invalid session snapshot payload" });
  }

  const hasSchemaVersion = typeof body.schemaVersion !== "undefined";
  const schemaVersion = parseSchemaVersion(body.schemaVersion);
  if (hasSchemaVersion && typeof schemaVersion === "undefined") {
    return res.status(400).json({ error: "Invalid schemaVersion" });
  }

  const title = parseTitle(body.title);
  if (typeof body.title !== "undefined" && typeof title === "undefined") {
    return res.status(400).json({ error: "Invalid title" });
  }

  try {
    const result = await saveAiStudioSessionSnapshot({
      userId: user.id,
      sessionId,
      snapshot,
      schemaVersion,
      title,
    });
    return res.status(200).json(result);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/sessions/save",
      metadata: { user_id: user.id, session_id: sessionId },
    });
    return res.status(500).json({ error: "Failed to save AI Studio session" });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};
