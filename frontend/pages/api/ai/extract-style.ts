/**
 * Extracts reusable visual style descriptors from an image using OpenAI vision.
 * Uses style extraction system prompt from frontend/lib/agentPromptsConfig.ts.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { applyAgentLegacyDeprecationHeaders } from "../../../features/agent-runtime/legacyDeprecation";
import { agentRuntimeService } from "../../../features/agent-runtime/agentRuntimeService";
import type { StyleExtractionDiagnostics } from "../../../features/agent-runtime/legacyStyleExtractionService";

const applyDiagnosticsHeaders = (
  res: NextApiResponse,
  diagnostics: StyleExtractionDiagnostics | undefined
) => {
  if (!diagnostics) return;
  if (typeof diagnostics.attemptCount === "number" && Number.isFinite(diagnostics.attemptCount)) {
    res.setHeader(
      "x-shortpulse-style-attempt-count",
      String(Math.max(0, diagnostics.attemptCount))
    );
  }
  if (typeof diagnostics.probeMs === "number" && Number.isFinite(diagnostics.probeMs)) {
    res.setHeader("x-shortpulse-style-probe-ms", String(Math.max(0, diagnostics.probeMs)));
  }
  if (typeof diagnostics.openAiMs === "number" && Number.isFinite(diagnostics.openAiMs)) {
    res.setHeader("x-shortpulse-style-openai-ms", String(Math.max(0, diagnostics.openAiMs)));
  }
  if (typeof diagnostics.parseMs === "number" && Number.isFinite(diagnostics.parseMs)) {
    res.setHeader("x-shortpulse-style-parse-ms", String(Math.max(0, diagnostics.parseMs)));
  }
  if (typeof diagnostics.totalMs === "number" && Number.isFinite(diagnostics.totalMs)) {
    res.setHeader("x-shortpulse-style-total-ms", String(Math.max(0, diagnostics.totalMs)));
  }
  if (typeof diagnostics.modelUsed === "string" && diagnostics.modelUsed.trim().length > 0) {
    res.setHeader("x-shortpulse-style-model-used", diagnostics.modelUsed.trim().slice(0, 120));
  }
};

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
  applyDiagnosticsHeaders(res, result.diagnostics);

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
