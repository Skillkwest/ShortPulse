/**
 * Standard AI Studio agent route.
 * Enforces the Standard lane boundary before running the Standard runtime.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { runStandardStudioAgentRuntime } from "../../../features/agent-runtime/standardStudioAgentRuntime/runtime";
import {
  hasInboundStudioAgentCanonicalPrompt,
  hasStudioAgentPulseContext,
  isPulseCreateAgentSessionNamespace,
  isStandardCreateAgentSessionNamespace,
  readStudioAgentClientSessionNamespace,
} from "../../../features/agent-runtime/studioAgentRouteModeBoundary";

/**
 * Handles Standard agent turns and rejects Pulse-shaped payloads at the route boundary.
 */
export default async function standardStudioAgentHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const clientSessionNamespace = readStudioAgentClientSessionNamespace(req.body);
    const hasCrossModeContinuity =
      isPulseCreateAgentSessionNamespace(clientSessionNamespace) ||
      (hasInboundStudioAgentCanonicalPrompt(req.body) &&
        !isStandardCreateAgentSessionNamespace(clientSessionNamespace));
    if (
      req.body?.runtimeMode === "pulse" ||
      hasStudioAgentPulseContext(req.body?.context) ||
      hasCrossModeContinuity
    ) {
      return res.status(400).json({
        code: "INVALID_REQUEST",
        message: "Standard agent route does not accept Pulse runtime payloads.",
      });
    }
    req.body = {
      ...req.body,
      runtimeMode: "standard",
    };
  }
  return runStandardStudioAgentRuntime(req, res);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};
