/**
 * Standard AI Studio agent route.
 * Enforces the Standard lane boundary before running the Standard runtime.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { runStandardStudioAgentRuntime } from "../../../features/agent-runtime/standardStudioAgentRuntime/runtime";

const hasPulseContext = (value: unknown): boolean =>
  Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "pulse" in value &&
    (value as { pulse?: unknown }).pulse != null
  );

/**
 * Handles Standard agent turns and rejects Pulse-shaped payloads at the route boundary.
 */
export default async function standardStudioAgentHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    if (req.body?.runtimeMode === "pulse" || hasPulseContext(req.body?.context)) {
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
