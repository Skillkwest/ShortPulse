import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { recordGenerationAbandonment } from "../../../lib/server/api/generationAbandonment";

type GenerationAbandonRequestBody = {
  output_id?: unknown;
  source_ref?: unknown;
  generation_id?: unknown;
  request_id?: unknown;
  reason?: unknown;
};

type GenerationAbandonResponse =
  | {
      ok: true;
      matchedGenerationIds: string[];
      cancelAttempted: false;
      cancelUnsupported: true;
    }
  | {
      error: string;
      details?: string;
    };

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerationAbandonResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const body = (req.body ?? {}) as GenerationAbandonRequestBody;
    const outputId = normalizeString(body.output_id);
    const sourceRef = normalizeString(body.source_ref);
    const generationId = normalizeString(body.generation_id);
    const requestId = normalizeString(body.request_id);
    const reason = normalizeString(body.reason) ?? "reference_grid_clear";

    if (!sourceRef && !generationId && !requestId) {
      return res.status(400).json({
        error: "Invalid request",
        details: "source_ref, generation_id, or request_id is required.",
      });
    }

    const result = await recordGenerationAbandonment({
      userId: user.id,
      sourceRef,
      generationId,
      requestId,
      reason,
      metadata: {
        output_id: outputId,
        route: "/api/generation/abandon",
      },
      noRefund: true,
    });

    return res.status(200).json({
      ok: true,
      matchedGenerationIds: result.matchedGenerationIds,
      cancelAttempted: false,
      cancelUnsupported: true,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "generation-abandon",
      scope: "generation",
      user,
    });
    return res.status(500).json({
      error: "Unable to abandon generation",
    });
  }
}
