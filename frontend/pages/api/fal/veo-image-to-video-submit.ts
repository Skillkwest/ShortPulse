/**
 * Proxies Fal.ai Veo 3.1 image-to-video submit requests.
 * Keeps FAL_KEY server-side and forwards payloads to the Fal queue.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { chargeGenerationRequest } from "../../../lib/server/api/generationBilling";

const FAL_VEO_I2V_SUBMIT_URL = "https://queue.fal.run/fal-ai/veo3.1/image-to-video";
const FAL_VEO_I2V_SUBMIT_FALLBACK_URL = "https://queue.fal.run/fal-ai/veo3.1/reference-to-video";

const readJsonSafe = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: "Non-JSON response from Fal",
      raw: text.slice(0, 4000),
    };
  }
};

const readProviderRequestId = (payload: Record<string, unknown>): string | null => {
  const requestId = payload.request_id ?? payload.requestId;
  if (typeof requestId !== "string") return null;
  const trimmed = requestId.trim();
  return trimmed.length ? trimmed : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FAL_KEY is not set on the server" });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  const payload = typeof req.body === "object" && req.body ? { ...req.body } : {};
  const charge = await chargeGenerationRequest({
    req,
    res,
    modelId: "fal-ai/veo3.1/image-to-video",
    payload,
    reason: "Fal Veo image-to-video generation",
  });
  if (!charge) return;

  try {
    const firstImageUrl = Array.isArray(payload.image_urls)
      ? payload.image_urls[0]
      : typeof payload.image_urls === "string"
        ? payload.image_urls
        : payload.image_url;
    const legacyPayload = {
      ...payload,
      image_url: firstImageUrl,
    };
    const fallbackPayload = {
      ...payload,
      image_urls: Array.isArray(payload.image_urls)
        ? payload.image_urls
        : firstImageUrl
          ? [firstImageUrl]
          : undefined,
    };

    const submitTo = async (url: string, body: Record<string, unknown>) => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await readJsonSafe(response);
      return { response, data };
    };

    let result = await submitTo(FAL_VEO_I2V_SUBMIT_URL, legacyPayload);
    if (!result.response.ok) {
      const fallback = await submitTo(FAL_VEO_I2V_SUBMIT_FALLBACK_URL, fallbackPayload);
      if (fallback.response.ok) {
        result = fallback;
      } else {
        result = result.response.status === 404 ? fallback : result;
      }
    }

    if (!result.response.ok) {
      await charge.refund("Auto-refund: Fal Veo image-to-video submit rejected.", {
        upstream_status: result.response.status,
        upstream_error: result.data,
      });
    } else {
      const providerRequestId = readProviderRequestId(result.data);
      if (!providerRequestId) {
        await charge.refund("Auto-refund: Fal Veo image-to-video submit missing request id.", {
          upstream_status: result.response.status,
          upstream_payload: result.data,
        });
        return res.status(502).json({
          error: "Fal Veo image-to-video submit response did not include request_id",
        });
      }
      await charge.markSubmitted(providerRequestId, {
        route: req.url ?? null,
        upstream_status: result.response.status,
      });
    }

    return res.status(result.response.status).json(result.data);
  } catch (error) {
    await charge.refund("Auto-refund: Fal Veo image-to-video transport failure.", {
      error: String(error),
    });
    return res
      .status(500)
      .json({ error: "Fal Veo image-to-video submit failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
