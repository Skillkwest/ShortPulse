/**
 * Proxies Fal.ai Veo 3.1 image-to-video status + result fetch.
 * Accepts { requestId }, returns status as-is, and fetches the result when completed.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../_utils/auth";
import {
  captureSucceededGenerationByProviderRequest,
  settleFailedGenerationByProviderRequest,
} from "../_utils/generationBilling";

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

const respondError = (res: NextApiResponse, requestId: string, error: string, detail: unknown) => {
  return res.status(200).json({
    status: "error",
    state: "error",
    error,
    detail,
    request_id: requestId,
  });
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

  const user = await requireApiUser(req, res);
  if (!user) return;

  const requestId =
    (Array.isArray(req.query.requestId) ? req.query.requestId[0] : req.query.requestId) ??
    req.body?.requestId;
  if (!requestId || typeof requestId !== "string") {
    return res.status(400).json({ error: "Missing requestId" });
  }

  const controller = new AbortController();
  // Veo status calls can take time to materialize; give them breathing room.
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const statusUrl = `${FAL_VEO_QUEUE_BASE}/${requestId}/status`;
    const statusResp = await fetch(statusUrl, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal: controller.signal,
    });

    // Check if response is JSON before parsing
    const contentType = statusResp.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await statusResp.text();
      await settleFailedGenerationByProviderRequest({
        userId: user.id,
        providerRequestId: requestId,
        reason: "Auto-release: Fal Veo image-to-video status payload malformed.",
        routeLabel: "Fal Veo image-to-video",
        detail: {
          stage: "status",
          malformed: true,
        },
      });
      return respondError(
        res,
        requestId,
        "Fal Veo image-to-video returned non-JSON response",
        text.substring(0, 500)
      );
    }

    const statusJson = await statusResp.json();
    const { responseUrl } = extractQueueUrls(statusJson);

    // Handle content policy violations and other 4xx/5xx errors
    if (!statusResp.ok) {
      // Check for content policy violation
      if (statusResp.status === 422 && statusJson?.detail) {
        const policyError = Array.isArray(statusJson.detail)
          ? statusJson.detail.find((d: any) => d.type === "content_policy_violation")
          : null;

        if (policyError) {
          await settleFailedGenerationByProviderRequest({
            userId: user.id,
            providerRequestId: requestId,
            reason: "Auto-refund: Fal Veo image-to-video blocked by content policy.",
            routeLabel: "Fal Veo image-to-video",
            detail: {
              stage: "status",
              payload: statusJson,
            },
          });
          return respondError(
            res,
            requestId,
            policyError.msg || "Content policy violation",
            policyError.msg || "The content was flagged by the content checker"
          );
        }
      }

      // Generic error handling for other non-OK responses
      await settleFailedGenerationByProviderRequest({
        userId: user.id,
        providerRequestId: requestId,
        reason: "Auto-release: Fal Veo image-to-video status endpoint returned non-OK response.",
        routeLabel: "Fal Veo image-to-video",
        detail: {
          stage: "status",
          upstream_status: statusResp.status,
          payload: statusJson,
        },
      });
      return respondError(
        res,
        requestId,
        String(statusJson?.error || statusJson?.message || "Generation failed"),
        statusJson
      );
    }

    const normalizedStatus = statusJson?.status ? String(statusJson.status).toLowerCase() : null;
    const isComplete =
      normalizedStatus === "completed" ||
      normalizedStatus === "succeeded" ||
      normalizedStatus === "success" ||
      normalizedStatus === "done";
    const isFailed = normalizedStatus === "failed" || normalizedStatus === "error";

    if (isFailed) {
      await settleFailedGenerationByProviderRequest({
        userId: user.id,
        providerRequestId: requestId,
        reason: "Auto-refund: Fal Veo image-to-video failed during status polling.",
        routeLabel: "Fal Veo image-to-video",
        detail: {
          stage: "status",
          payload: statusJson,
        },
      });
      return respondError(
        res,
        requestId,
        String(
          statusJson?.error ||
            statusJson?.message ||
            statusJson?.statusMessage ||
            "Generation failed"
        ),
        statusJson
      );
    }

    if (!isComplete) {
      if (responseUrl) {
        const direct = await fetchJson(responseUrl, controller.signal, apiKey);
        if (direct.response.ok && hasVideoPayload(direct.json)) {
          const captureResult = await captureSucceededGenerationByProviderRequest({
            userId: user.id,
            providerRequestId: requestId,
            reason: "Generation charge captured after successful Fal Veo image-to-video output.",
            routeLabel: "Fal Veo image-to-video",
            detail: {
              stage: "response_url_probe",
            },
          });
          if (!captureResult.settled && captureResult.note !== "charge_not_found") {
            console.error("[veo-image-status] capture during response_url_probe did not settle", {
              requestId,
              note: captureResult.note,
            });
          }
          return res.status(200).json({
            status: "completed",
            request_id: requestId,
            ...direct.json,
          });
        }
      }
      return res.status(statusResp.status).json(statusJson);
    }

    const resultUrl = responseUrl ?? `${FAL_VEO_QUEUE_BASE}/${requestId}`;
    const resultResp = await fetchJson(resultUrl, controller.signal, apiKey);
    const resultStatus =
      typeof resultResp.json?.status === "string" ? resultResp.json.status.toLowerCase() : null;
    const resultState =
      typeof resultResp.json?.state === "string" ? resultResp.json.state.toLowerCase() : null;
    const hasResultError =
      !resultResp.response.ok ||
      resultStatus === "error" ||
      resultStatus === "failed" ||
      resultState === "error" ||
      Boolean((resultResp.json as any)?.error) ||
      !hasVideoPayload(resultResp.json);

    if (hasResultError) {
      await settleFailedGenerationByProviderRequest({
        userId: user.id,
        providerRequestId: requestId,
        reason: "Auto-refund: Fal Veo image-to-video completed without usable output.",
        routeLabel: "Fal Veo image-to-video",
        detail: {
          stage: "result",
          upstream_status: resultResp.response.status,
          payload: resultResp.json,
        },
      });
      return respondError(
        res,
        requestId,
        String(
          (resultResp.json as any)?.error ||
            (resultResp.json as any)?.message ||
            "Generation failed"
        ),
        resultResp.json
      );
    }

    const captureResult = await captureSucceededGenerationByProviderRequest({
      userId: user.id,
      providerRequestId: requestId,
      reason: "Generation charge captured after successful Fal Veo image-to-video output.",
      routeLabel: "Fal Veo image-to-video",
      detail: {
        stage: "result",
      },
    });
    if (!captureResult.settled && captureResult.note !== "charge_not_found") {
      console.error("[veo-image-status] capture on result did not settle", {
        requestId,
        note: captureResult.note,
      });
    }

    return res.status(resultResp.response.status).json({
      status: normalizedStatus ?? "completed",
      request_id: requestId,
      ...resultResp.json,
    });
  } catch (error) {
    await settleFailedGenerationByProviderRequest({
      userId: user.id,
      providerRequestId: requestId,
      reason: "Auto-release: Fal Veo image-to-video status transport failure.",
      routeLabel: "Fal Veo image-to-video",
      detail: {
        stage: "status",
        transport_error: String(error),
      },
    });
    return respondError(res, requestId, "Fal Veo image-to-video status failed", String(error));
  } finally {
    clearTimeout(timeoutId);
  }
}
