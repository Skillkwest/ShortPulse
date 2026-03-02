/**
 * Returns one persisted AI Studio session snapshot for the authenticated user.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import {
  getAiStudioSessionSnapshot,
  parseAiStudioSessionId,
} from "../../../../lib/server/api/aiStudioSessions";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (process.env.SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED === "false") {
    return res.status(503).json({ error: "AI Studio sessions API is disabled" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const sessionId = parseAiStudioSessionId(req.query?.sid);
  if (!sessionId) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  try {
    const session = await getAiStudioSessionSnapshot({ userId: user.id, sessionId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    return res.status(200).json(session);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/sessions/:sid",
      metadata: { user_id: user.id, session_id: sessionId },
    });
    return res.status(500).json({ error: "Failed to load AI Studio session" });
  }
}
