/**
 * Proxies Fal.ai Seedance 1.5 Pro text-to-video status + result fetch.
 * Accepts { requestId }, returns status as-is, and fetches the result when completed.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const FAL_SEEDANCE_STATUS_URL = "https://queue.fal.run/fal-ai/bytedance/seedance/requests";

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
    const statusResp = await fetch(`${FAL_SEEDANCE_STATUS_URL}/${requestId}/status`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal: controller.signal,
    });

    // Check if response is JSON before parsing
    const contentType = statusResp.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await statusResp.text();
      return res.status(500).json({
        error: "Fal Seedance returned non-JSON response",
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
          return res.status(200).json({
            status: "error",
            state: "error",  // Part D: Redundant field
            error: policyError.msg || "Content policy violation",
            detail: policyError.msg || "The content was flagged by the content checker",
            request_id: requestId,
          });
        }
      }

      // Generic error handling for other non-OK responses
      return res.status(200).json({
        status: "error",
        state: "error",  // Part D: Redundant field
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

    const isFailed = normalizedStatus === "failed" || normalizedStatus === "error";

    if (isFailed) {
      // Check for content policy violation in failed status
      if (statusJson?.detail) {
        const policyError = Array.isArray(statusJson.detail)
          ? statusJson.detail.find((d: any) => d.type === "content_policy_violation")
          : null;

        if (policyError) {
          return res.status(200).json({
            status: "error",
            state: "error",  // Part D: Redundant field
            error: policyError.msg || "Content policy violation",
            detail: policyError.msg || "The content was flagged by the content checker",
            request_id: requestId,
          });
        }
      }

      // Generic failed status handling
      return res.status(200).json({
        status: "error",
        state: "error",  // Part D: Redundant field
        error: statusJson?.error || statusJson?.message || statusJson?.statusMessage || "Generation failed",
        detail: JSON.stringify(statusJson),
        request_id: requestId,
      });
    }


    if (!isComplete) {
      return res.status(200).json(statusJson);  // Part C: Always HTTP 200
    }

    // Fetch result
    const resultResp = await fetch(`${FAL_SEEDANCE_STATUS_URL}/${requestId}`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal: controller.signal,
    });

    // Part A: Check result content type
    const resultContentType = resultResp.headers.get("content-type");
    if (!resultContentType || !resultContentType.includes("application/json")) {
      const text = await resultResp.text();
      return res.status(200).json({
        status: "error",
        state: "error",
        error: "Fal Seedance result returned non-JSON response",
        detail: text.substring(0, 500),
        request_id: requestId,
      });
    }

    const resultJson = await resultResp.json();

    // Part A: Check if result response is an error
    if (!resultResp.ok) {
      // Check for content policy violation in result
      if (resultResp.status === 422 && resultJson?.detail) {
        const policyError = Array.isArray(resultJson.detail)
          ? resultJson.detail.find((d: any) => d.type === "content_policy_violation")
          : null;

        if (policyError) {
          return res.status(200).json({
            status: "error",
            state: "error",
            error: policyError.msg || "Content policy violation",
            detail: policyError.msg || "The content was flagged by the content checker",
            request_id: requestId,
          });
        }
      }

      // Generic result error
      return res.status(200).json({
        status: "error",
        state: "error",
        error: resultJson?.error || resultJson?.message || "Generation failed",
        detail: JSON.stringify(resultJson),
        request_id: requestId,
      });
    }

    // Part A: Check if resultJson itself contains error indicators
    if (resultJson?.error || resultJson?.status === "error" || resultJson?.state === "error") {
      return res.status(200).json({
        status: "error",
        state: "error",
        error: resultJson.error || resultJson.message || "Generation failed",
        detail: resultJson.detail || JSON.stringify(resultJson),
        request_id: requestId,
      });
    }

    // Success - return result with HTTP 200 (Part C)
    return res.status(200).json({
      status: normalizedStatus ?? "completed",
      state: normalizedStatus ?? "completed",
      request_id: requestId,
      ...resultJson,
    });
  } catch (error) {
    // Part B: Return HTTP 200 instead of 500
    return res.status(200).json({
      status: "error",
      state: "error",
      error: "Fal Seedance status check failed",
      detail: String(error),
      request_id: requestId,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
