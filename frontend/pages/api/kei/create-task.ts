/**
 * Proxies Kie.ai createTask calls so the API key stays server-side.
 * Accepts `{ model, input }` and forwards to `https://api.kie.ai/api/v1/jobs/createTask`.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { chargeGenerationRequest } from "../../../lib/server/api/generationBilling";
import { getModelConfig } from "../../../features/ai-studio/logic/pricing";
import { logGenerationFailure } from "../../../lib/server/api/appErrorLogs";

const KEI_BASE_URL = "https://api.kie.ai/api/v1";

const getKey = () => process.env.KEI_API_KEY;

const readJsonSafe = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: "Non-JSON response from Kie.ai", raw: text.slice(0, 4000) };
  }
};

const readTaskId = (payload: Record<string, unknown>): string | null => {
  const direct = payload.taskId;
  if (typeof direct === "string" && direct.trim().length) return direct.trim();
  const nested = payload.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const candidate = (nested as { taskId?: unknown }).taskId;
    if (typeof candidate === "string" && candidate.trim().length) return candidate.trim();
  }
  return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const routeLabel = "kei/create-task";
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = getKey();
  if (!apiKey) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.kei_create_task.config_missing",
      message: "KEI_API_KEY is not set on the server",
      statusCode: 500,
    });
    return res.status(500).json({ error: "KEI_API_KEY is not set on the server" });
  }

  const payload =
    typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
  const modelId = typeof payload.model === "string" ? payload.model.trim() : "";
  if (!modelId) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.kei_create_task.validation_failed",
      message: "model is required",
      statusCode: 400,
    });
    return res.status(400).json({ error: "model is required" });
  }
  if (!getModelConfig(modelId)) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.kei_create_task.validation_failed",
      message: `Unsupported model '${modelId}' for billed generation.`,
      statusCode: 400,
      metadata: { model_id: modelId },
    });
    return res.status(400).json({ error: `Unsupported model '${modelId}' for billed generation.` });
  }
  const pricingPayload =
    payload.input && typeof payload.input === "object"
      ? ({ ...(payload.input as Record<string, unknown>), model: modelId } as Record<
          string,
          unknown
        >)
      : payload;
  const charge = await chargeGenerationRequest({
    req,
    res,
    modelId,
    payload: pricingPayload,
    reason: "Kie.ai generation",
  });
  if (!charge) return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(`${KEI_BASE_URL}/jobs/createTask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    const data = await readJsonSafe(upstream);
    if (!upstream.ok) {
      await charge.refund("Auto-refund: Kie.ai createTask rejected.", {
        upstream_status: upstream.status,
        upstream_error: data,
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.kei_create_task.upstream_error",
        message:
          (typeof data.error === "string" && data.error) ||
          (typeof data.message === "string" && data.message) ||
          "Kie.ai createTask rejected",
        statusCode: upstream.status,
        userId: charge.userId,
        metadata: {
          model_id: modelId,
          upstream_payload: data,
        },
      });
    } else {
      const taskId = readTaskId(data);
      if (taskId) {
        await charge.markSubmitted(taskId, {
          provider: "kei",
          route: "create-task",
          upstream_status: upstream.status,
        });
      }
    }
    return res.status(upstream.status).json(data);
  } catch (error) {
    await charge.refund("Auto-refund: Kie.ai createTask transport failure.", {
      error: String(error),
    });
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.kei_create_task.transport_error",
      message: "Kie.ai createTask failed",
      statusCode: 500,
      stack: error instanceof Error ? (error.stack ?? null) : null,
      userId: charge.userId,
      metadata: {
        model_id: modelId,
        detail: String(error),
      },
    });
    return res.status(500).json({ error: "Kie.ai createTask failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
