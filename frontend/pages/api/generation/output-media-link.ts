/**
 * Authenticated generation-output media-link route.
 * Moves the final browser-owned output mutation behind server-authoritative
 * generation and media ownership checks.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { attachOwnedMediaFileToGenerationOutput } from "../../../lib/server/api/generationOutputs";

type OutputMediaLinkResponse = { ok: true } | { error: string; details?: string };

const readRequiredId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 160 ? normalized : null;
};

const readOutputIndex = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 49) {
    return null;
  }
  return value;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OutputMediaLinkResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "generation.output-media-link.auth",
      scope: "generation",
    });
    return res.status(500).json({ error: "Unable to link generated media." });
  }
  if (!user) return;

  const generationId = readRequiredId(req.body?.generationId);
  const mediaFileId = readRequiredId(req.body?.mediaFileId);
  const outputIndex = readOutputIndex(req.body?.outputIndex);
  const resultUrl = typeof req.body?.resultUrl === "string" ? req.body.resultUrl.trim() : null;
  if (!generationId || !mediaFileId || outputIndex === null) {
    return res.status(400).json({
      error: "Invalid request",
      details: "generationId, mediaFileId, and a bounded outputIndex are required.",
    });
  }

  try {
    await attachOwnedMediaFileToGenerationOutput({
      generationId,
      userId: user.id,
      outputIndex,
      mediaFileId,
      resultUrl,
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.name === "GenerationOutputOwnershipError") {
      return res.status(404).json({ error: "Generation or media was not found." });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "generation.output-media-link",
      scope: "generation",
      user,
    });
    return res.status(500).json({ error: "Unable to link generated media." });
  }
}
