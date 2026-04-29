/**
 * Pulse AI Studio agent route.
 * Enforces the Pulse lane boundary before running the Pulse runtime.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { runPulseStudioAgentRuntime } from "../../../features/agent-runtime/pulseStudioAgentRuntime/runtime";

const hasPulseContext = (value: unknown): boolean =>
  Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "pulse" in value &&
    (value as { pulse?: unknown }).pulse != null
  );

/**
 * Handles Pulse agent turns and rejects Standard-shaped payloads at the route boundary.
 */
export default async function pulseStudioAgentHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    if (req.body?.runtimeMode === "standard" || !hasPulseContext(req.body?.context)) {
      return res.status(400).json({
        code: "INVALID_REQUEST",
        message: "Pulse agent route requires Pulse runtime context.",
      });
    }
    req.body = {
      ...req.body,
      directOpenAiBypass: false,
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
