import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { readFalRuntimeFlags } from "../../../lib/server/api/falRuntimeFlags";
import {
  readFalWebhookHeaders,
  readRawBody,
  verifyFalWebhookSignature,
  verifyFalWebhookBodyHash,
} from "../../../lib/server/api/falWebhook";
import { RequestBodyTooLargeError } from "../../../lib/server/api/requestBody";
import {
  ingestFalWebhookEvent,
  parseFalWebhookPayload,
} from "../../../lib/server/falIntegration/falWebhookIngress";
const FAL_WEBHOOK_MAX_BODY_BYTES = 512 * 1024;

const readHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const flags = readFalRuntimeFlags();
  if (!flags.webhookEnabled || flags.integrationMode === "legacy") {
    return res.status(404).json({ error: "Not found" });
  }

  const webhookHeaders = readFalWebhookHeaders(req);

  try {
    const rawBody = await readRawBody(req, { maxBytes: FAL_WEBHOOK_MAX_BODY_BYTES });
    const verification = await verifyFalWebhookSignature({
      rawBody,
      headers: webhookHeaders,
      flags,
    });
    if (!verification.ok) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }
    if (
      !verifyFalWebhookBodyHash({
        rawBody,
        expectedHash: readHeaderValue(req.headers["x-fal-webhook-payload-hash"]),
      })
    ) {
      return res.status(400).json({ error: "Invalid webhook payload hash" });
    }

    let payload;
    try {
      payload = parseFalWebhookPayload(rawBody);
    } catch {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }
    const result = await ingestFalWebhookEvent({
      payload,
      headers: webhookHeaders,
      verificationMethod: verification.method,
      payloadHash: verification.payloadHash ?? null,
      maxAttempts: flags.reconcilerMaxAttempts,
    });

    if (result.kind === "ignored") {
      return res.status(202).json({ accepted: true, ignored: result.reason });
    }
    if (result.kind === "duplicate") {
      return res.status(200).json({ received: true, duplicate: true });
    }
    return res.status(200).json({
      received: true,
      request_id: result.requestId,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return res.status(413).json({ error: "Webhook payload too large." });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "fal/webhook",
      metadata: {
        fal_signature_present: Boolean(webhookHeaders.signature),
      },
    });
    return res.status(500).json({
      error: "Webhook processing failed.",
    });
  }
}
