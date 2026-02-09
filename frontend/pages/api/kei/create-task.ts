/**
 * Proxies Kie.ai createTask calls so the API key stays server-side.
 * Accepts `{ model, input }` and forwards to `https://api.kie.ai/api/v1/jobs/createTask`.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { chargeGenerationRequest } from "../_utils/generationBilling";
import { getModelConfig } from "../../../features/ai-studio/logic/pricing";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = getKey();
  if (!apiKey) {
    return res.status(500).json({ error: "KEI_API_KEY is not set on the server" });
  }

  const payload = typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
  const modelId = typeof payload.model === "string" ? payload.model.trim() : "";
  if (!modelId) {
    return res.status(400).json({ error: "model is required" });
  }
  if (!getModelConfig(modelId)) {
    return res.status(400).json({ error: `Unsupported model '${modelId}' for billed generation.` });
  }
  const pricingPayload =
    payload.input && typeof payload.input === "object"
      ? ({ ...(payload.input as Record<string, unknown>), model: modelId } as Record<string, unknown>)
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
    }
    return res.status(upstream.status).json(data);
  } catch (error) {
    await charge.refund("Auto-refund: Kie.ai createTask transport failure.", {
      error: String(error),
    });
    return res.status(500).json({ error: "Kie.ai createTask failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
