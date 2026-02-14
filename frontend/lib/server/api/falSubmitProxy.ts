/**
 * Shared charged submit proxy for Fal generation endpoints.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { chargeGenerationRequest } from "./generationBilling";
import { logGenerationFailure } from "./appErrorLogs";

type FalSubmitConfig = {
  modelId: string;
  submitUrl: string;
  routeLabel: string;
  timeoutMs?: number;
  validatePayload?: (payload: Record<string, unknown>) => {
    error: string;
    detail?: unknown;
  } | null;
};

type JsonValue = Record<string, unknown>;

const readJsonSafe = async (response: Response): Promise<JsonValue> => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: "Non-JSON response from Fal", raw: text.slice(0, 4000) };
  }
};

const readProviderRequestId = (payload: JsonValue): string | null => {
  const requestId = payload?.request_id ?? payload?.requestId;
  if (typeof requestId !== "string") return null;
  const trimmed = requestId.trim();
  return trimmed.length ? trimmed : null;
};

/**
 * Builds a Next.js API handler that debits credits before forwarding to Fal.
 */
export const createFalSubmitHandler =
  ({ modelId, submitUrl, routeLabel, timeoutMs = 20000, validatePayload }: FalSubmitConfig) =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.config_missing",
        message: "FAL_KEY is not set on the server",
        statusCode: 500,
        metadata: { model_id: modelId },
      });
      return res.status(500).json({ error: "FAL_KEY is not set on the server" });
    }

    const payload =
      typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
    const payloadValidation = validatePayload?.(payload);
    if (payloadValidation) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.validation_failed",
        message: payloadValidation.error,
        statusCode: 400,
        metadata: {
          model_id: modelId,
          detail: payloadValidation.detail ?? null,
        },
      });
      return res.status(400).json({
        error: payloadValidation.error,
        detail: payloadValidation.detail ?? null,
      });
    }
    const charge = await chargeGenerationRequest({
      req,
      res,
      modelId,
      payload,
      reason: `${routeLabel} generation`,
    });
    if (!charge) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetch(submitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await readJsonSafe(upstream);
      if (!upstream.ok) {
        await charge.refund("Auto-refund: Fal submit rejected.", {
          upstream_status: upstream.status,
          upstream_error: data,
        });
        await logGenerationFailure({
          req,
          routeLabel,
          source: "api.fal_submit.upstream_error",
          message:
            (typeof data.error === "string" && data.error) ||
            (typeof data.message === "string" && data.message) ||
            `${routeLabel} submit rejected`,
          statusCode: upstream.status,
          userId: charge.userId,
          metadata: {
            model_id: modelId,
            upstream_payload: data,
          },
        });
      } else {
        const providerRequestId = readProviderRequestId(data);
        if (!providerRequestId) {
          await charge.refund("Auto-refund: Fal submit missing request id.", {
            upstream_status: upstream.status,
            upstream_payload: data,
          });
          await logGenerationFailure({
            req,
            routeLabel,
            source: "api.fal_submit.missing_request_id",
            message: `${routeLabel} submit response did not include request_id`,
            statusCode: 502,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              upstream_payload: data,
            },
          });
          return res.status(502).json({
            error: `${routeLabel} submit response did not include request_id`,
          });
        }
        await charge.markSubmitted(providerRequestId, {
          route: req.url ?? null,
          upstream_status: upstream.status,
        });
      }
      return res.status(upstream.status).json(data);
    } catch (error) {
      await charge.refund("Auto-refund: Fal submit transport failure.", {
        error: String(error),
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.transport_error",
        message: `${routeLabel} submit failed`,
        statusCode: 500,
        userId: charge.userId,
        stack: error instanceof Error ? (error.stack ?? null) : null,
        metadata: {
          model_id: modelId,
          detail: String(error),
        },
      });
      return res.status(500).json({ error: `${routeLabel} submit failed`, detail: String(error) });
    } finally {
      clearTimeout(timeoutId);
    }
  };
