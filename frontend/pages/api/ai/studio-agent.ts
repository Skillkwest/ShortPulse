/**
 * Retired AI Studio generic agent route.
 * Keeps compatibility callers fail-closed so mode-specific routes own execution.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  resolveStudioAgentTraceId,
  sendStudioAgentError,
  setStudioAgentContractHeaders,
} from "../../../features/agent-runtime/studioAgentRouteEnvelope";
import { requireApiUser } from "../../../lib/server/api/auth";

/**
 * Rejects generic studio-agent calls after authenticating the caller.
 */
export default async function retiredStudioAgentCompatibilityRoute(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const traceId = resolveStudioAgentTraceId(req);
  setStudioAgentContractHeaders(res, traceId);
  if (req.method !== "POST") {
    return sendStudioAgentError(res, 405, {
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed",
      traceId,
    });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  return sendStudioAgentError(res, 410, {
    code: "INVALID_REQUEST",
    message:
      "The generic studio-agent route is retired. Use /api/ai/studio-agent-standard or /api/ai/studio-agent-pulse.",
    traceId,
  });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};
