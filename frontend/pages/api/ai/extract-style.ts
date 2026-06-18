/**
 * Extracts reusable visual style descriptors from an image using OpenAI vision.
 * Uses the runtime style extraction system prompt resolved through the admin prompt control plane.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { applyAgentLegacyDeprecationHeaders } from "../../../features/agent-runtime/legacyDeprecation";
import { buildAgentMachineOutcome } from "../../../features/agent-runtime/agentMachineOutcome";
import {
  executeStyleExtraction,
  type StyleExtractionDiagnostics,
} from "../../../features/agent-runtime/styleExtractionService";

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
    return res.status(405).json({
      ...buildAgentMachineOutcome({
        outcomeClass: "route_error",
        reasonCode: "REQUEST_INVALID",
      }),
      error: "Method not allowed",
    });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: `${routeLabel}.auth`,
      scope: "app",
    });
    return res.status(500).json({
      ...buildAgentMachineOutcome({
        outcomeClass: "route_error",
        reasonCode: "ROUTE_ERROR",
      }),
      error: "Style extraction is temporarily unavailable.",
    });
  }
  if (!user) return;
  const result = await executeStyleExtraction({
    req,
    user,
    imageDataUrl: (req.body as { imageDataUrl?: unknown })?.imageDataUrl,
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
      sizeLimit: "8mb",
    },
  },
};
