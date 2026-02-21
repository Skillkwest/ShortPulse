/**
 * Generates an improved text prompt using OpenAI.
 * System prompt + API key are provided via environment variables to keep secrets server-side.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { applyAgentLegacyDeprecationHeaders } from "../../../features/agent-runtime/legacyDeprecation";
import { executeLegacyPromptGeneration } from "../../../features/agent-runtime/legacyPromptGenerationService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const routeLabel = "ai/generate-prompt";
  applyAgentLegacyDeprecationHeaders(res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  const result = await executeLegacyPromptGeneration({
    req,
    user,
    prompt: (req.body as { prompt?: unknown })?.prompt,
    routeLabel,
  });

  if (!result.ok) {
    return res.status(result.status).json(result.payload);
  }
  return res.status(200).json(result.payload);
}
