/**
 * Proxies Fal Veo 3.1 image-to-video status through the shared status handler.
 * Keeps GET/OPTIONS compatibility while routing retrieval through alias sweep logic.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import { getFalModelProfileByModelId } from "../../../lib/server/falIntegration/modelProfiles";

const veoI2vProfile = getFalModelProfileByModelId("fal-ai/veo3.1/image-to-video");
const baseHandler = veoI2vProfile
  ? createFalStatusHandler({
      queueBaseUrl: veoI2vProfile.statusBases,
      routeLabel: "Fal Veo image-to-video",
      timeoutMs: veoI2vProfile.timeoutMs,
    })
  : null;

const readQueryRequestId = (req: NextApiRequest): string | null => {
  const queryValue = Array.isArray(req.query.requestId)
    ? req.query.requestId[0]
    : req.query.requestId;
  if (typeof queryValue !== "string") return null;
  const trimmed = queryValue.trim();
  return trimmed.length ? trimmed : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("X-ShortPulse-Route", "fal-veo-image-to-video-status");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    if (!baseHandler) {
      return res.status(500).json({ error: "Fal Veo image-to-video is unavailable." });
    }
    const requestId = readQueryRequestId(req);
    const proxiedReq = {
      ...req,
      method: "POST",
      body: {
        ...(typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {}),
        requestId,
      },
    } as NextApiRequest;
    return baseHandler(proxiedReq, res);
  }

  if (!baseHandler) {
    return res.status(500).json({ error: "Fal Veo image-to-video is unavailable." });
  }
  return baseHandler(req, res);
}
