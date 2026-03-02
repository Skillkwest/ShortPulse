/**
 * Lists persisted AI Studio sessions for the authenticated user.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import {
  decodeAiStudioSessionCursor,
  encodeAiStudioSessionCursor,
  listAiStudioSessions,
} from "../../../../lib/server/api/aiStudioSessions";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const parseLimit = (value: string | string[] | undefined): number | null => {
  if (typeof value === "undefined") return DEFAULT_LIMIT;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > MAX_LIMIT) return null;
  return parsed;
};

const parseCursor = (value: string | string[] | undefined) => {
  if (typeof value === "undefined") return { cursor: null, valid: true as const };
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return { cursor: null, valid: true as const };
  const cursor = decodeAiStudioSessionCursor(raw);
  return { cursor, valid: cursor !== null };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (process.env.SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED === "false") {
    return res.status(503).json({ error: "AI Studio sessions API is disabled" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const limit = parseLimit(req.query?.limit);
  if (limit === null) {
    return res.status(400).json({ error: "Invalid limit" });
  }

  const cursorState = parseCursor(req.query?.cursor);
  if (!cursorState.valid) {
    return res.status(400).json({ error: "Invalid cursor" });
  }

  try {
    const sessions = await listAiStudioSessions({
      userId: user.id,
      limit,
      cursor: cursorState.cursor,
    });
    const lastSession = sessions.at(-1);
    const nextCursor =
      sessions.length === limit && lastSession
        ? encodeAiStudioSessionCursor({
            updatedAt: lastSession.updatedAt,
            sessionId: lastSession.sessionId,
          })
        : null;

    return res.status(200).json({
      sessions,
      nextCursor,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/sessions",
      metadata: { user_id: user.id },
    });
    return res.status(500).json({ error: "Failed to list AI Studio sessions" });
  }
}
