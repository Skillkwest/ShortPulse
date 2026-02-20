/**
 * Shared charged submit proxy for Fal generation endpoints.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { chargeGenerationRequest } from "./generationBilling";
import { logGenerationFailure } from "./appErrorLogs";
import { ensureSubmittedGenerationRecord } from "./generationSubmitPersistence";
import { readFalRuntimeFlags } from "./falRuntimeFlags";
import type { SubmitTarget } from "../falIntegration/contracts";
import { submitWithFallbackTargets } from "../falIntegration/submitEngine";

type FalSubmitConfig = {
  modelId: string;
  submitUrl?: string;
  submitTargets?: SubmitTarget[];
  routeLabel: string;
  timeoutMs?: number;
  validatePayload?: (payload: Record<string, unknown>) => {
    error: string;
    detail?: unknown;
  } | null;
};

type JsonValue = Record<string, unknown>;

const readProviderRequestId = (payload: JsonValue): string | null => {
  const requestId = payload?.request_id ?? payload?.requestId;
  if (typeof requestId !== "string") return null;
  const trimmed = requestId.trim();
  return trimmed.length ? trimmed : null;
};

const isFalQueueUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.hostname.endsWith("fal.run") || parsed.hostname.endsWith("fal.ai");
  } catch {
    return false;
  }
};

const appendFalWebhookParam = (targetUrl: string, webhookUrl: string): string => {
  const parsed = new URL(targetUrl);
  if (!parsed.searchParams.get("fal_webhook")) {
    parsed.searchParams.set("fal_webhook", webhookUrl);
  }
  return parsed.toString();
};

const resolveWebhookCallbackUrl = (): string | null => {
  const flags = readFalRuntimeFlags();
  const baseUrl = flags.publicApiBaseUrl;
  if (!flags.webhookEnabled || flags.integrationMode === "legacy" || !baseUrl) return null;
  try {
    return new URL("/api/fal/webhook", baseUrl).toString();
  } catch {
    return null;
  }
};

const withWebhookTargets = (targets: SubmitTarget[], webhookUrl: string | null): SubmitTarget[] => {
  if (!webhookUrl) return targets;
  return targets.map((target) => {
    if (!isFalQueueUrl(target.submitUrl)) return target;
    return {
      ...target,
      submitUrl: appendFalWebhookParam(target.submitUrl, webhookUrl),
    };
  });
};

/**
 * Builds a Next.js API handler that debits credits before forwarding to Fal.
 */
export const createFalSubmitHandler =
  ({
    modelId,
    submitUrl,
    submitTargets,
    routeLabel,
    timeoutMs = 20000,
    validatePayload,
  }: FalSubmitConfig) =>
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

    const resolvedSubmitTargets: SubmitTarget[] =
      submitTargets && submitTargets.length ? submitTargets : submitUrl ? [{ submitUrl }] : [];
    if (!resolvedSubmitTargets.length) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_submit.config_missing_target",
        message: "No Fal submit target configured for route",
        statusCode: 500,
        metadata: { model_id: modelId },
      });
      return res.status(500).json({ error: "No Fal submit target configured for route" });
    }
    const webhookCallbackUrl = resolveWebhookCallbackUrl();
    const resolvedTargetsWithWebhook = withWebhookTargets(
      resolvedSubmitTargets,
      webhookCallbackUrl
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstreamResult = await submitWithFallbackTargets({
        targets: resolvedTargetsWithWebhook,
        payload,
        apiKey,
        signal: controller.signal,
      });
      const upstream = upstreamResult.response;
      const data = upstreamResult.data;

      if (!upstream.ok) {
        await charge.refund("Auto-refund: Fal submit rejected.", {
          upstream_status: upstream.status,
          upstream_error: data,
          upstream_target_url: upstreamResult.targetUrl,
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
            upstream_target_url: upstreamResult.targetUrl,
            upstream_target_index: upstreamResult.targetIndex,
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
          upstream_target_url: upstreamResult.targetUrl,
          upstream_target_index: upstreamResult.targetIndex,
          webhook_callback_url: webhookCallbackUrl,
          webhook_registered: Boolean(webhookCallbackUrl),
        });
        const persistenceResult = await ensureSubmittedGenerationRecord({
          userId: charge.userId,
          modelId,
          routeLabel,
          payload,
          providerRequestId,
          sourceRef: charge.sourceRef,
          submitTargetUrl: upstreamResult.targetUrl,
          submitTargetIndex: upstreamResult.targetIndex,
        });
        if (!persistenceResult.ok) {
          await logGenerationFailure({
            req,
            routeLabel,
            source: "api.fal_submit.persist_generation_failed",
            message: "Failed to persist ai_generations row after submit.",
            statusCode: 500,
            userId: charge.userId,
            metadata: {
              model_id: modelId,
              provider_request_id: providerRequestId,
              source_ref: charge.sourceRef,
              persistence_error: persistenceResult.error,
            },
          });
        }
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
