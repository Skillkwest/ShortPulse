/**
 * Proxies Fal.ai Nano Banana Image-to-Image status + result fetch.
 * Accepts { requestId }, fetches status first, then result when ready.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const FAL_NANO_BANANA_EDIT_STATUS_URL = "https://queue.fal.run/fal-ai/nano-banana/requests";

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
    const statusResp = await fetch(`${FAL_NANO_BANANA_EDIT_STATUS_URL}/${requestId}/status`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal: controller.signal,
    });

    const contentType = statusResp.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await statusResp.text();
      return res.status(500).json({
        error: "Fal Nano Banana Edit returned non-JSON response",
        detail: text.substring(0, 500)
      });
    }

    const statusJson = await statusResp.json();

    console.log("[Nano Banana Edit Status] Fal response:", {
      httpStatus: statusResp.status,
      ok: statusResp.ok,
      status: statusJson?.status,
      detail: statusJson?.detail,
      fullResponse: JSON.stringify(statusJson, null, 2)
    });

    if (!statusResp.ok) {
      console.log("[Nano Banana Edit Status] HTTP error detected, status:", statusResp.status);

      if (statusResp.status === 422 && statusJson?.detail) {
        const policyError = Array.isArray(statusJson.detail)
          ? statusJson.detail.find((d: any) => d.type === "content_policy_violation")
          : null;

        if (policyError) {
          const errorResponse = {
            status: "error",
            state: "error",  // Part D: Redundant field
            error: policyError.msg || "Content policy violation",
            detail: policyError.msg || "The content was flagged by the content checker",
            request_id: requestId,
          };
          console.log("[Nano Banana Edit Status] Returning policy violation with HTTP 200:", errorResponse);
          return res.status(200).json(errorResponse);
        }
      }

      const errorResponse = {
        status: "error",
        state: "error",  // Part D: Redundant field
        error: statusJson?.error || statusJson?.message || "Generation failed",
        detail: JSON.stringify(statusJson),
        request_id: requestId,
      };
      console.log("[Nano Banana Edit Status] Returning generic error with HTTP 200:", errorResponse);
      return res.status(200).json(errorResponse);
    }

    const normalizedStatus = statusJson?.status ? String(statusJson.status).toLowerCase() : null;
    const isComplete =
      normalizedStatus === "completed" ||
      normalizedStatus === "succeeded" ||
      normalizedStatus === "success" ||
      normalizedStatus === "done";

    const isFailed = normalizedStatus === "failed" || normalizedStatus === "error";

    if (isFailed) {
      console.log("[Nano Banana Edit Status] FAILED status detected, checking for policy violation...");

      // Check for content policy violation in failed status
      if (statusJson?.detail) {
        const policyError = Array.isArray(statusJson.detail)
          ? statusJson.detail.find((d: any) => d.type === "content_policy_violation")
          : null;

        if (policyError) {
          const errorResponse = {
            status: "error",
            state: "error",  // Part D: Redundant field
            error: policyError.msg || "Content policy violation",
            detail: policyError.msg || "The content was flagged by the content checker",
            request_id: requestId,
          };
          console.log("[Nano Banana Edit Status] Returning content policy violation from FAILED status:", errorResponse);
          return res.status(200).json(errorResponse);
        }
      }

      // Generic failed status handling
      const errorResponse = {
        status: "error",
        state: "error",  // Part D: Redundant field
        error: statusJson?.error || statusJson?.message || statusJson?.statusMessage || "Generation failed",
        detail: JSON.stringify(statusJson),
        request_id: requestId,
      };
      console.log("[Nano Banana Edit Status] Returning generic FAILED status:", errorResponse);
      return res.status(200).json(errorResponse);
    }

    if (!isComplete) {
      return res.status(200).json(statusJson);  // Part C: Always HTTP 200
    }

    // Fetch result
    const resultResp = await fetch(`${FAL_NANO_BANANA_EDIT_STATUS_URL}/${requestId}`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal: controller.signal,
    });

    // Part A: Check result content type
    const resultContentType = resultResp.headers.get("content-type");
    if (!resultContentType || !resultContentType.includes("application/json")) {
      const text = await resultResp.text();
      console.log("[Nano Banana Edit Status] Result returned non-JSON, returning error");
      return res.status(200).json({
        status: "error",
        state: "error",
        error: "Fal Nano Banana Edit result returned non-JSON response",
        detail: text.substring(0, 500),
        request_id: requestId,
      });
    }

    const resultJson = await resultResp.json();

    // Part A: Check if result response is an error
    if (!resultResp.ok) {
      console.log("[Nano Banana Edit Status] Result HTTP error detected:", resultResp.status);

      // Check for content policy violation in result
      if (resultResp.status === 422 && resultJson?.detail) {
        const policyError = Array.isArray(resultJson.detail)
          ? resultJson.detail.find((d: any) => d.type === "content_policy_violation")
          : null;

        if (policyError) {
          const errorResponse = {
            status: "error",
            state: "error",
            error: policyError.msg || "Content policy violation",
            detail: policyError.msg || "The content was flagged by the content checker",
            request_id: requestId,
          };
          console.log("[Nano Banana Edit Status] Returning result policy violation:", errorResponse);
          return res.status(200).json(errorResponse);
        }
      }

      // Generic result error
      const errorResponse = {
        status: "error",
        state: "error",
        error: resultJson?.error || resultJson?.message || "Generation failed",
        detail: JSON.stringify(resultJson),
        request_id: requestId,
      };
      console.log("[Nano Banana Edit Status] Returning result error:", errorResponse);
      return res.status(200).json(errorResponse);
    }

    // Part A: Check if resultJson itself contains error indicators
    if (resultJson?.error || resultJson?.status === "error" || resultJson?.state === "error") {
      const errorResponse = {
        status: "error",
        state: "error",
        error: resultJson.error || resultJson.message || "Generation failed",
        detail: resultJson.detail || JSON.stringify(resultJson),
        request_id: requestId,
      };
      console.log("[Nano Banana Edit Status] Result JSON contains error:", errorResponse);
      return res.status(200).json(errorResponse);
    }

    // Success - return result with HTTP 200 (Part C)
    console.log("[Nano Banana Edit Status] Returning successful result");
    return res.status(200).json({
      status: normalizedStatus ?? "completed",
      state: normalizedStatus ?? "completed",
      request_id: requestId,
      ...resultJson,
    });
  } catch (error) {
    // Part B: Return HTTP 200 instead of 500
    console.log("[Nano Banana Edit Status] Catch block error:", error);
    return res.status(200).json({
      status: "error",
      state: "error",
      error: "Fal Nano Banana Edit status check failed",
      detail: String(error),
      request_id: requestId,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
