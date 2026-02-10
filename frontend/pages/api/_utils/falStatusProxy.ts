/**
 * Shared Fal status proxy with failure-aware refund settlement.
 * Polls queue status/result and refunds failed generations idempotently.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "./auth";
import {
  captureSucceededGenerationByProviderRequest,
  settleFailedGenerationByProviderRequest,
} from "./generationBilling";

type FalStatusConfig = {
  queueBaseUrl: string;
  routeLabel: string;
  timeoutMs?: number;
  alwaysHttp200?: boolean;
};

type JsonObject = Record<string, unknown>;

type JsonReadResult = {
  json: JsonObject;
  text: string;
  isJson: boolean;
};

const completedStatuses = new Set(["completed", "succeeded", "success", "done"]);
const failedStatuses = new Set(["failed", "error", "cancelled", "canceled"]);

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeStatus = (value: unknown): string | null => {
  const text = asString(value);
  return text ? text.toLowerCase() : null;
};

const readJsonSafe = async (response: Response): Promise<JsonReadResult> => {
  const text = await response.text();
  if (!text) return { json: {}, text: "", isJson: true };
  try {
    return { json: JSON.parse(text), text, isJson: true };
  } catch {
    return { json: { raw: text.slice(0, 4000) }, text, isJson: false };
  }
};

const findContentPolicyMessage = (payload: JsonObject): string | null => {
  const detail = payload.detail;
  if (!Array.isArray(detail)) return null;
  const violation = detail.find(
    (item) => item && typeof item === "object" && (item as any).type === "content_policy_violation"
  ) as { msg?: unknown } | undefined;
  const message = asString(violation?.msg);
  return message ?? null;
};

const hasMediaPayload = (payload: JsonObject): boolean => {
  const candidates = [
    payload,
    (payload as any).data,
    (payload as any).output,
    (payload as any).result,
    (payload as any).response,
    (payload as any).data?.result,
    (payload as any).result?.data,
    (payload as any).response?.result,
  ].filter(Boolean) as any[];

  for (const candidate of candidates) {
    if (Array.isArray(candidate?.images) && Boolean(candidate.images[0]?.url)) return true;
    if (Array.isArray(candidate?.videos) && Boolean(candidate.videos[0]?.url)) return true;
    const urls = candidate?.resultUrls || candidate?.info?.result_urls;
    if (Array.isArray(urls) && urls.length > 0) return true;
    const mediaUrl =
      candidate?.video?.url ||
      candidate?.image?.url ||
      candidate?.video_url ||
      candidate?.image_url ||
      candidate?.assets?.video?.url ||
      candidate?.download_url;
    if (mediaUrl) return true;
  }

  return false;
};

const buildErrorPayload = ({
  requestId,
  error,
  detail,
}: {
  requestId: string;
  error: string;
  detail?: unknown;
}): JsonObject => ({
  status: "error",
  state: "error",
  error,
  detail: detail ?? error,
  request_id: requestId,
});

const settleFailure = async ({
  userId,
  requestId,
  reason,
  routeLabel,
  detail,
}: {
  userId: string;
  requestId: string;
  reason: string;
  routeLabel: string;
  detail?: JsonObject;
}) => {
  const result = await settleFailedGenerationByProviderRequest({
    userId,
    providerRequestId: requestId,
    reason,
    routeLabel,
    detail,
  });
  if (!result.settled && result.note !== "charge_not_found") {
    console.error("[falStatusProxy] settlement did not complete", {
      requestId,
      routeLabel,
      note: result.note,
      sourceRef: result.sourceRef ?? null,
    });
  }
};

const respondError = ({
  res,
  requestId,
  error,
  detail,
  alwaysHttp200,
  statusCode,
}: {
  res: NextApiResponse;
  requestId: string;
  error: string;
  detail?: unknown;
  alwaysHttp200: boolean;
  statusCode?: number;
}) => {
  const code = alwaysHttp200 ? 200 : (statusCode ?? 500);
  return res.status(code).json(buildErrorPayload({ requestId, error, detail }));
};

/**
 * Builds a Fal status route that normalizes failures and settles refunds.
 */
export const createFalStatusHandler = ({
  queueBaseUrl,
  routeLabel,
  timeoutMs = 60000,
  alwaysHttp200 = true,
}: FalStatusConfig) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireApiUser(req, res);
    if (!user) return;

    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "FAL_KEY is not set on the server" });
    }

    const requestId = asString(req.body?.requestId);
    if (!requestId) {
      return res.status(400).json({ error: "requestId is required" });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const statusResp = await fetch(`${queueBaseUrl}/${requestId}/status`, {
        method: "GET",
        headers: { Authorization: `Key ${apiKey}` },
        signal: controller.signal,
      });
      const statusData = await readJsonSafe(statusResp);

      if (!statusData.isJson) {
        return respondError({
          res,
          requestId,
          alwaysHttp200,
          statusCode: 500,
          error: `${routeLabel} returned non-JSON status response`,
          detail: statusData.text.slice(0, 500),
        });
      }

      const contentPolicyMessage = findContentPolicyMessage(statusData.json);
      if (contentPolicyMessage) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation blocked by content policy.",
          routeLabel,
          detail: {
            stage: "status",
            content_policy: true,
            payload: statusData.json,
          },
        });
        return respondError({
          res,
          requestId,
          alwaysHttp200,
          statusCode: 200,
          error: contentPolicyMessage,
          detail: contentPolicyMessage,
        });
      }

      const normalizedStatus = normalizeStatus(statusData.json.status);
      if (normalizedStatus && failedStatuses.has(normalizedStatus)) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation failed during status polling.",
          routeLabel,
          detail: {
            stage: "status",
            upstream_status: normalizedStatus,
            payload: statusData.json,
          },
        });
        return respondError({
          res,
          requestId,
          alwaysHttp200,
          statusCode: 200,
          error:
            asString(statusData.json.error) ||
            asString(statusData.json.message) ||
            asString((statusData.json as any).statusMessage) ||
            "Generation failed",
          detail: statusData.json,
        });
      }

      if (!statusResp.ok) {
        return respondError({
          res,
          requestId,
          alwaysHttp200,
          statusCode: statusResp.status,
          error:
            asString(statusData.json.error) ||
            asString(statusData.json.message) ||
            `${routeLabel} status request failed`,
          detail: statusData.json,
        });
      }

      const isComplete = Boolean(normalizedStatus && completedStatuses.has(normalizedStatus));
      if (!isComplete) {
        return res.status(alwaysHttp200 ? 200 : statusResp.status).json(statusData.json);
      }

      const resultResp = await fetch(`${queueBaseUrl}/${requestId}`, {
        method: "GET",
        headers: { Authorization: `Key ${apiKey}` },
        signal: controller.signal,
      });
      const resultData = await readJsonSafe(resultResp);

      if (!resultData.isJson) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation result was non-JSON.",
          routeLabel,
          detail: {
            stage: "result",
            upstream_status: resultResp.status,
            raw: resultData.text.slice(0, 500),
          },
        });
        return respondError({
          res,
          requestId,
          alwaysHttp200,
          statusCode: 200,
          error: `${routeLabel} result returned non-JSON response`,
          detail: resultData.text.slice(0, 500),
        });
      }

      const resultPolicyMessage = findContentPolicyMessage(resultData.json);
      if (resultPolicyMessage) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation blocked by content policy.",
          routeLabel,
          detail: {
            stage: "result",
            content_policy: true,
            payload: resultData.json,
          },
        });
        return respondError({
          res,
          requestId,
          alwaysHttp200,
          statusCode: 200,
          error: resultPolicyMessage,
          detail: resultPolicyMessage,
        });
      }

      if (!resultResp.ok) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation result endpoint failed.",
          routeLabel,
          detail: {
            stage: "result",
            upstream_status: resultResp.status,
            payload: resultData.json,
          },
        });
        return respondError({
          res,
          requestId,
          alwaysHttp200,
          statusCode: 200,
          error:
            asString(resultData.json.error) ||
            asString(resultData.json.message) ||
            "Generation failed",
          detail: resultData.json,
        });
      }

      const resultStatus =
        normalizeStatus(resultData.json.status) ?? normalizeStatus((resultData.json as any).state);
      if (
        resultStatus === "error" ||
        resultStatus === "failed" ||
        asString(resultData.json.error) ||
        !hasMediaPayload(resultData.json)
      ) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation completed without usable media.",
          routeLabel,
          detail: {
            stage: "result",
            payload: resultData.json,
          },
        });
        return respondError({
          res,
          requestId,
          alwaysHttp200,
          statusCode: 200,
          error: asString(resultData.json.error) || "Generation failed to produce media output",
          detail: resultData.json,
        });
      }

      const captureResult = await captureSucceededGenerationByProviderRequest({
        userId: user.id,
        providerRequestId: requestId,
        reason: "Generation charge captured after successful Fal output.",
        routeLabel,
        detail: {
          stage: "result",
          payload_status: resultStatus ?? normalizedStatus ?? "completed",
        },
      });
      if (!captureResult.settled && captureResult.note !== "charge_not_found") {
        console.error("[falStatusProxy] capture did not settle", {
          requestId,
          routeLabel,
          note: captureResult.note,
        });
      }

      return res.status(200).json({
        status: normalizedStatus ?? "completed",
        state: normalizedStatus ?? "completed",
        request_id: requestId,
        ...resultData.json,
      });
    } catch (error) {
      return respondError({
        res,
        requestId,
        alwaysHttp200,
        statusCode: 200,
        error: `${routeLabel} status check failed`,
        detail: String(error),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };
};
