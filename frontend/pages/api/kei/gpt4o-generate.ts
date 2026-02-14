/**
 * Proxies Kie.ai 4o Image (GPT Image 1) generate endpoint.
 * Accepts GPT-4o image payload and returns the upstream response.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { chargeGenerationRequest } from "../../../lib/server/api/generationBilling";
import { logGenerationFailure } from "../../../lib/server/api/appErrorLogs";

const KEI_BASE_URL = "https://api.kie.ai/api/v1";
const GPT4O_IMAGE_MODEL_ID = "kei/gpt4o-image";

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
  const routeLabel = "kei/gpt4o-generate";
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.KEI_API_KEY;
  if (!apiKey) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.kei_gpt4o_generate.config_missing",
      message: "KEI_API_KEY is not set on the server",
      statusCode: 500,
    });
    return res.status(500).json({ error: "KEI_API_KEY is not set on the server" });
  }

  const payload =
    typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
  const charge = await chargeGenerationRequest({
    req,
    res,
    modelId: GPT4O_IMAGE_MODEL_ID,
    payload,
    reason: "Kie.ai GPT-4o image generation",
  });
  if (!charge) return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(`${KEI_BASE_URL}/gpt4o-image/generate`, {
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
      await charge.refund("Auto-refund: Kie.ai GPT-4o generate rejected.", {
        upstream_status: upstream.status,
        upstream_error: data,
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.kei_gpt4o_generate.upstream_error",
        message:
          (typeof data.error === "string" && data.error) ||
          (typeof data.message === "string" && data.message) ||
          "Kie.ai 4o image generate rejected",
        statusCode: upstream.status,
        userId: charge.userId,
        metadata: {
          model_id: GPT4O_IMAGE_MODEL_ID,
          upstream_payload: data,
        },
      });
    } else {
      const taskId = readTaskId(data);
      if (taskId) {
        await charge.markSubmitted(taskId, {
          provider: "kei",
          route: "gpt4o-generate",
          upstream_status: upstream.status,
        });
      }
    }
    return res.status(upstream.status).json(data);
  } catch (error) {
    await charge.refund("Auto-refund: Kie.ai GPT-4o generate transport failure.", {
      error: String(error),
    });
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.kei_gpt4o_generate.transport_error",
      message: "Kie.ai 4o image generate failed",
      statusCode: 500,
      stack: error instanceof Error ? (error.stack ?? null) : null,
      userId: charge.userId,
      metadata: {
        model_id: GPT4O_IMAGE_MODEL_ID,
        detail: String(error),
      },
    });
    return res
      .status(500)
      .json({ error: "Kie.ai 4o image generate failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
