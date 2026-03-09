/**
 * Extracts reusable visual style descriptors from an image using OpenAI vision.
 * Uses style extraction system prompt from frontend/lib/agentPromptsConfig.ts.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { applyAgentLegacyDeprecationHeaders } from "../../../features/agent-runtime/legacyDeprecation";
import { agentRuntimeService } from "../../../features/agent-runtime/agentRuntimeService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const routeLabel = "ai/extract-style";
  applyAgentLegacyDeprecationHeaders(res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  const result = await agentRuntimeService.extractStyle({
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
