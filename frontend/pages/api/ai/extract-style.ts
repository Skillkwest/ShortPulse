/**
 * Extracts reusable visual style descriptors from an image using OpenAI vision.
 * Uses the runtime style extraction system prompt resolved through the admin prompt control plane.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { buildAgentMachineOutcome } from "../../../features/agent-runtime/agentMachineOutcome";
import { setAgentContractVersionHeader } from "../../../features/agent-runtime/agentContractHeaders";
import {
  executeStyleExtraction,
  type StyleExtractionDiagnostics,
} from "../../../features/agent-runtime/styleExtractionService";
import {
  admitOpenAiInternalCapacityRequest,
  beginOpenAiInternalCapacityAttempt,
  extractOpenAiInternalCapacityUsage,
  OpenAiInternalCapacityError,
  resolveOpenAiInternalCapacityRequestId,
  settleOpenAiInternalCapacity,
  type OpenAiInternalCapacityAdmission,
} from "../../../lib/server/api/openAiInternalCapacityAdmission";

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
  setAgentContractVersionHeader(res);
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
  const userId = user.id;
  const imageDataUrl = (req.body as { imageDataUrl?: unknown })?.imageDataUrl;
  const normalizedImageDataUrl = typeof imageDataUrl === "string" ? imageDataUrl.trim() : "";
  if (
    !normalizedImageDataUrl ||
    !/^data:image\/[a-z0-9.+-]+;base64,/i.test(normalizedImageDataUrl)
  ) {
    const result = await executeStyleExtraction({ req, user, imageDataUrl, routeLabel });
    applyDiagnosticsHeaders(res, result.diagnostics);
    return result.ok
      ? res.status(200).json(result.payload)
      : res.status(result.status).json(result.payload);
  }

  let admission: OpenAiInternalCapacityAdmission;
  try {
    admission = await admitOpenAiInternalCapacityRequest({
      userId,
      lane: "ai.extract_style",
      requestId: resolveOpenAiInternalCapacityRequestId(req),
      internalBudgetMicrousd: 100_000,
      maxAttempts: 4,
    });
  } catch (error) {
    if (error instanceof OpenAiInternalCapacityError) {
      return res.status(error.status).json({
        ...buildAgentMachineOutcome({ outcomeClass: "route_error", reasonCode: "ROUTE_ERROR" }),
        error: error.message,
        code: error.code,
      });
    }
    throw error;
  }
  const result = await executeStyleExtraction({
    req,
    user,
    imageDataUrl: normalizedImageDataUrl,
    routeLabel,
    beforeProviderCall: (() => {
      let providerCallCount = 0;
      return async () => {
        providerCallCount += 1;
        if (providerCallCount === 1) return;
        await beginOpenAiInternalCapacityAttempt({ admissionId: admission.id, userId });
      };
    })(),
  });
  applyDiagnosticsHeaders(res, result.diagnostics);

  try {
    await settleOpenAiInternalCapacity({
      admissionId: admission.id,
      userId,
      status: result.ok ? "completed" : "failed",
      usage: {
        ...extractOpenAiInternalCapacityUsage(result.ok ? result.payload : null),
        requestCount: result.diagnostics?.attemptCount ?? 1,
      },
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: `${routeLabel}.admission-settlement`,
      scope: "app",
      user,
    });
    return res.status(503).json({
      ...buildAgentMachineOutcome({ outcomeClass: "route_error", reasonCode: "ROUTE_ERROR" }),
      error: "Style extraction is temporarily unavailable.",
    });
  }

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
