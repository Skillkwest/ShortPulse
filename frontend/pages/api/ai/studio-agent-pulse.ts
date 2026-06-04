/**
 * Pulse AI Studio agent route.
 * Enforces the Pulse lane boundary before running the Pulse runtime.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { runPulseStudioAgentRuntime } from "../../../features/agent-runtime/pulseStudioAgentRuntime/runtime";
import {
  hasInboundStudioAgentCanonicalPrompt,
  hasStudioAgentPulseContext,
  isRetiredCreatePulsePresetId,
  isPulseCreateAgentSessionNamespace,
  readPulsePresetIdFromContext,
  readPulsePresetIdFromSessionNamespace,
  readStudioAgentClientSessionNamespace,
} from "../../../features/agent-runtime/studioAgentRouteModeBoundary";

/**
 * Handles Pulse agent turns and rejects Standard-shaped payloads at the route boundary.
 */
export default async function pulseStudioAgentHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const clientSessionNamespace = readStudioAgentClientSessionNamespace(req.body);
    const contextPresetId = readPulsePresetIdFromContext(req.body?.context);
    const namespacePresetId = readPulsePresetIdFromSessionNamespace(clientSessionNamespace);
    if (
      req.body?.runtimeMode === "standard" ||
      !hasStudioAgentPulseContext(req.body?.context) ||
      !isPulseCreateAgentSessionNamespace(clientSessionNamespace) ||
      contextPresetId === null ||
      namespacePresetId === null ||
      namespacePresetId !== contextPresetId ||
      hasInboundStudioAgentCanonicalPrompt(req.body) ||
      isRetiredCreatePulsePresetId(contextPresetId) ||
      isRetiredCreatePulsePresetId(namespacePresetId)
    ) {
      return res.status(400).json({
        code: "INVALID_REQUEST",
        message: "Pulse agent route requires an active Pulse runtime context.",
      });
    }
    req.body = {
      ...req.body,
      canonicalPrompt: null,
      runtimeMode: "pulse",
    };
  }
  return runPulseStudioAgentRuntime(req, res);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};
