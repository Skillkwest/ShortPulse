/**
 * Proxies Fal.ai Veo 3.1 image-to-video status + result fetch.
 * Accepts { requestId }, returns status as-is, and fetches the result when completed.
 */
import type { NextApiRequest, NextApiResponse } from "next";

// Queue status/result endpoints use the base model id (no subpath).
const FAL_VEO_QUEUE_BASE = "https://queue.fal.run/fal-ai/veo3.1/requests";

const readJsonSafe = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_error) {
    return {
      error: "Non-JSON response from Fal",
      raw: text.slice(0, 4000),
    };
  }
};

const hasVideoPayload = (payload: any) => {
  if (!payload) return false;
  const videoUrl =
    payload?.video?.url ||
    payload?.data?.video?.url ||
    payload?.output?.video?.url ||
    payload?.result?.video?.url ||
    payload?.data?.result?.video?.url ||
    payload?.result?.data?.video?.url ||
    payload?.response?.video?.url ||
    payload?.response?.data?.video?.url ||
    payload?.response?.output?.video?.url ||
    payload?.response?.result?.video?.url;
  if (videoUrl) return true;
  const videos =
    payload?.videos ||
    payload?.data?.videos ||
    payload?.output?.videos ||
    payload?.result?.videos ||
    payload?.response?.videos;
  return Array.isArray(videos) && Boolean(videos[0]?.url);
};

const fetchJson = async (url: string, signal: AbortSignal, apiKey: string) => {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Key ${apiKey}` },
    signal,
  });
  const json = await readJsonSafe(response);
  return { response, json };
};

const extractQueueUrls = (payload: any) => {
  const statusUrl = typeof payload?.status_url === "string" ? payload.status_url : null;
  const responseUrl = typeof payload?.response_url === "string" ? payload.response_url : null;
  return { statusUrl, responseUrl };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = (req.method || "GET").toUpperCase();
  res.setHeader("X-ShortPulse-Route", "fal-veo-image-to-video-status");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (method === "OPTIONS") {
    return res.status(204).end();
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FAL_KEY is not set on the server" });
  }

  const requestId =
    (Array.isArray(req.query.requestId) ? req.query.requestId[0] : req.query.requestId) ?? req.body?.requestId;
  if (!requestId || typeof requestId !== "string") {
    return res.status(400).json({ error: "Missing requestId" });
  }

  const controller = new AbortController();
  // Veo status calls can take time to materialize; give them breathing room.
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const statusUrl = `${FAL_VEO_QUEUE_BASE}/${requestId}/status`;
    const statusResp = await fetchJson(statusUrl, controller.signal, apiKey);
    const statusJson = statusResp.json;
    const { responseUrl } = extractQueueUrls(statusJson);

    const normalizedStatus = statusJson?.status ? String(statusJson.status).toLowerCase() : null;
    const isComplete =
      normalizedStatus === "completed" ||
      normalizedStatus === "succeeded" ||
      normalizedStatus === "success" ||
      normalizedStatus === "done";

    if (!statusResp.response.ok) {
      return res.status(statusResp.response.status).json(statusJson);
    }

    if (!isComplete) {
      if (responseUrl) {
        const direct = await fetchJson(responseUrl, controller.signal, apiKey);
        if (direct.response.ok && hasVideoPayload(direct.json)) {
          return res.status(200).json({
            status: "completed",
            request_id: requestId,
            ...direct.json,
          });
        }
      }
      return res.status(statusResp.response.status).json(statusJson);
    }

    const resultUrl = responseUrl ?? `${FAL_VEO_QUEUE_BASE}/${requestId}`;
    const resultResp = await fetchJson(resultUrl, controller.signal, apiKey);
    return res.status(resultResp.response.status).json({
      status: normalizedStatus ?? "completed",
      request_id: requestId,
      ...resultResp.json,
    });
  } catch (error) {
    return res.status(500).json({ error: "Fal Veo image-to-video status failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
