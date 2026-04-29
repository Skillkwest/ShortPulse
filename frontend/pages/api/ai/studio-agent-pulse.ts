/**
 * Pulse AI Studio agent route.
 * Enforces the Pulse lane boundary before delegating to the shared execution handler.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import studioAgentHandler from "./studio-agent";

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
  return studioAgentHandler(req, res);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};
