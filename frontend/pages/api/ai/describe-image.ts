/**
 * Generates a descriptive caption for an image using OpenAI vision.
 * System prompt comes from frontend/lib/agentPromptsConfig.ts (Agent 2) with env fallback.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { applyAgentLegacyDeprecationHeaders } from "../../../features/agent-runtime/legacyDeprecation";
import { agentRuntimeService } from "../../../features/agent-runtime/agentRuntimeService";
import { buildAgentMachineOutcome } from "../../../features/agent-runtime/agentMachineOutcome";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const routeLabel = "ai/describe-image";
  applyAgentLegacyDeprecationHeaders(res);
  if (req.method !== "POST") {
    return res.status(405).json({
      ...buildAgentMachineOutcome({
        outcomeClass: "route_error",
        reasonCode: "REQUEST_INVALID",
      }),
      error: "Method not allowed",
    });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  const result = await agentRuntimeService.describeImage({
    req,
    user,
    imageUrl: (req.body as { imageUrl?: unknown })?.imageUrl,
    routeLabel,
  });
  if (!result.ok) {
    return res.status(result.status).json(result.payload);
  }
  return res.status(200).json(result.payload);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
