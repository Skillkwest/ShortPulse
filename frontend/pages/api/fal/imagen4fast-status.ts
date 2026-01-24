/**
 * Proxies Fal.ai Imagen 4 Fast status + result fetch.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const IMAGEN4_FAST_STATUS_URL = "https://queue.fal.run/fal-ai/imagen4/requests";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FAL_KEY is not set on the server" });
  }

  const { requestId } = req.body || {};
  if (!requestId || typeof requestId !== "string") {
    return res.status(400).json({ error: "requestId is required" });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const statusResp = await fetch(`${IMAGEN4_FAST_STATUS_URL}/${requestId}/status`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal: controller.signal,
    });
    const statusJson = await statusResp.json();

    const normalizedStatus = statusJson?.status ? String(statusJson.status).toLowerCase() : null;
    const isComplete =
      normalizedStatus === "completed" ||
      normalizedStatus === "succeeded" ||
      normalizedStatus === "success" ||
      normalizedStatus === "done";

    if (!statusResp.ok || !isComplete) {
      return res.status(statusResp.status).json(statusJson);
    }

    const resultResp = await fetch(`${IMAGEN4_FAST_STATUS_URL}/${requestId}`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal: controller.signal,
    });
    const resultJson = await resultResp.json();
    return res.status(resultResp.status).json({
      status: normalizedStatus ?? "completed",
      request_id: requestId,
      ...resultJson,
    });
  } catch (error) {
    return res.status(500).json({ error: "Imagen 4 Fast status failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
