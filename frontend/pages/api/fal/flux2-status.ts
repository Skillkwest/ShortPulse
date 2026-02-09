/**
 * Proxies Fal.ai FLUX 2 status + result fetch.
 * Accepts { requestId }, fetches status first, then result when ready.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const FAL_FLUX2_STATUS_URL = "https://queue.fal.run/fal-ai/flux-2/requests";

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
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const statusResp = await fetch(`${FAL_FLUX2_STATUS_URL}/${requestId}/status`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal: controller.signal,
    });

    // Check if response is JSON before parsing
    const contentType = statusResp.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await statusResp.text();
      return res.status(500).json({
        error: "Fal FLUX 2 returned non-JSON response",
        detail: text.substring(0, 500)
      });
    }

    const statusJson = await statusResp.json();

    // Handle content policy violations and other 4xx/5xx errors
    if (!statusResp.ok) {
      // Check for content policy violation
      if (statusResp.status === 422 && statusJson?.detail) {
        const policyError = Array.isArray(statusJson.detail)
          ? statusJson.detail.find((d: any) => d.type === "content_policy_violation")
          : null;

        if (policyError) {
          return res.status(statusResp.status).json({
            status: "error",
            error: policyError.msg || "Content policy violation",
            detail: policyError.msg || "The content was flagged by the content checker",
            request_id: requestId,
          });
        }
      }

      // Generic error handling for other non-OK responses
      return res.status(statusResp.status).json({
        status: "error",
        error: statusJson?.error || statusJson?.message || "Generation failed",
        detail: JSON.stringify(statusJson),
        request_id: requestId,
      });
    }

    const normalizedStatus = statusJson?.status ? String(statusJson.status).toLowerCase() : null;
    const isComplete =
      normalizedStatus === "completed" ||
      normalizedStatus === "succeeded" ||
      normalizedStatus === "success" ||
      normalizedStatus === "done";

    if (!isComplete) {
      return res.status(statusResp.status).json(statusJson);
    }

    const resultResp = await fetch(`${FAL_FLUX2_STATUS_URL}/${requestId}`, {
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
    return res.status(500).json({ error: "Fal FLUX 2 status failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
