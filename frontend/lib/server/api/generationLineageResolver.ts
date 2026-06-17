/**
 * Shared generation lineage resolver for provider request ids.
 * Gives runtime recovery, settlement repair, webhook ingest, and future
 * diagnostics one attempt/projection fallback order to share.
 */
import { lookupGenerationAttemptByProviderRequest } from "./generationAttempts";
import {
  readGenerationProjectionLinkByGenerationId,
  readGenerationProjectionLinkByProviderRequestId,
  readGenerationProjectionLinkByRequestId,
} from "./generationProjection";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type GenerationLineageEvidence =
  | "generation_attempt"
  | "generation_request_id"
  | "projection_generation_id"
  | "projection_provider_request_id"
  | "projection_request_id";

export type GenerationLineageResolution = {
  generationId: string | null;
  generationAttemptId: string | null;
  userId: string | null;
  modelId: string | null;
  sourceRef: string | null;
  requestId: string | null;
  providerRequestId: string;
  evidence: GenerationLineageEvidence[];
  attemptLookupError: { code?: string | null; message?: string | null } | null;
};

export type ResolveGenerationLineageByProviderRequestInput = {
  providerRequestId: string;
  userId?: string | null;
  includeProjection?: boolean;
  throwOnAttemptLookupError?: boolean;
};

const normalizeString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const emptyResolution = (
  providerRequestId: string,
  attemptLookupError: GenerationLineageResolution["attemptLookupError"] = null
): GenerationLineageResolution => ({
  generationId: null,
  generationAttemptId: null,
  userId: null,
  modelId: null,
  sourceRef: null,
  requestId: null,
  providerRequestId,
  evidence: [],
  attemptLookupError,
});

const lookupGenerationByRequestId = async ({
  requestId,
  userId,
}: {
  requestId: string;
  userId?: string | null;
}): Promise<{
  generationId: string | null;
  userId: string | null;
  modelId: string | null;
  requestId: string | null;
} | null> => {
  const query = getSupabaseAdmin()
    .from("ai_generations")
    .select("id, user_id, model_id, request_id")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1);
  const scopedQuery = userId ? query.eq("user_id", userId) : query;
  const { data, error } = await scopedQuery.maybeSingle();
  if (error) return null;
  const row = data as {
    id?: unknown;
    user_id?: unknown;
    model_id?: unknown;
    request_id?: unknown;
  } | null;
  const generationId = normalizeString(row?.id as string | null | undefined);
  if (!generationId) return null;
  return {
    generationId,
    userId: normalizeString(row?.user_id as string | null | undefined),
    modelId: normalizeString(row?.model_id as string | null | undefined),
    requestId: normalizeString(row?.request_id as string | null | undefined),
  };
};

/**
 * Resolves the canonical generation/source lineage for a provider request id.
 * Projection rows are treated as repair/read-model evidence, not ownership authority.
 */
export const resolveGenerationLineageByProviderRequest = async ({
  providerRequestId,
  userId = null,
  includeProjection = true,
  throwOnAttemptLookupError = false,
}: ResolveGenerationLineageByProviderRequestInput): Promise<GenerationLineageResolution> => {
  const normalizedProviderRequestId = normalizeString(providerRequestId);
  if (!normalizedProviderRequestId) return emptyResolution("");

  const evidence: GenerationLineageEvidence[] = [];
  let generationId: string | null = null;
  let generationAttemptId: string | null = null;
  let lineageUserId: string | null = null;
  let modelId: string | null = null;
  const sourceRef: string | null = null;
  const requestId: string | null = null;
  let attemptLookupError: GenerationLineageResolution["attemptLookupError"] = null;

  const attemptLookup = await lookupGenerationAttemptByProviderRequest({
    providerRequestId: normalizedProviderRequestId,
    userId,
  });
  if (attemptLookup.error) {
    attemptLookupError = {
      code: attemptLookup.error.code ?? null,
      message: attemptLookup.error.message ?? null,
    };
    if (throwOnAttemptLookupError) {
      throw new Error(attemptLookupError.message ?? "attempt_provider_request_lookup_failed");
    }
  } else if (attemptLookup.data?.generationId) {
    generationId = normalizeString(attemptLookup.data.generationId);
    generationAttemptId = normalizeString(attemptLookup.data.id);
    lineageUserId = normalizeString(attemptLookup.data.userId);
    modelId = normalizeString(attemptLookup.data.modelId);
    if (generationId) evidence.push("generation_attempt");
  }

  if (!includeProjection || !userId) {
    if (includeProjection && !generationId) {
      const generationRequestLink = await lookupGenerationByRequestId({
        requestId: normalizedProviderRequestId,
        userId,
      }).catch(() => null);
      if (generationRequestLink?.generationId) {
        return {
          generationId: generationRequestLink.generationId,
          generationAttemptId,
          userId: generationRequestLink.userId,
          modelId: generationRequestLink.modelId,
          sourceRef,
          requestId: generationRequestLink.requestId,
          providerRequestId: normalizedProviderRequestId,
          evidence: [...evidence, "generation_request_id"],
          attemptLookupError,
        };
      }
    }

    return {
      generationId,
      generationAttemptId,
      userId: lineageUserId,
      modelId,
      sourceRef,
      requestId,
      providerRequestId: normalizedProviderRequestId,
      evidence,
      attemptLookupError,
    };
  }

  if (generationId) {
    const projectionLink = await readGenerationProjectionLinkByGenerationId({
      userId,
      generationId,
    }).catch(() => null);
    if (projectionLink?.generationId) {
      return {
        generationId: projectionLink.generationId,
        generationAttemptId,
        userId: lineageUserId,
        modelId,
        sourceRef: projectionLink.sourceRef,
        requestId: projectionLink.requestId,
        providerRequestId: normalizedProviderRequestId,
        evidence: [...evidence, "projection_generation_id"],
        attemptLookupError,
      };
    }
  }

  if (!generationId) {
    const generationRequestLink = await lookupGenerationByRequestId({
      requestId: normalizedProviderRequestId,
      userId,
    }).catch(() => null);
    if (generationRequestLink?.generationId) {
      return {
        generationId: generationRequestLink.generationId,
        generationAttemptId,
        userId: generationRequestLink.userId,
        modelId: generationRequestLink.modelId,
        sourceRef,
        requestId: generationRequestLink.requestId,
        providerRequestId: normalizedProviderRequestId,
        evidence: [...evidence, "generation_request_id"],
        attemptLookupError,
      };
    }
  }

  const projectionProviderLink = await readGenerationProjectionLinkByProviderRequestId({
    userId,
    providerRequestId: normalizedProviderRequestId,
  }).catch(() => null);
  if (projectionProviderLink?.generationId) {
    return {
      generationId: projectionProviderLink.generationId,
      generationAttemptId,
      userId: lineageUserId,
      modelId,
      sourceRef: projectionProviderLink.sourceRef,
      requestId: projectionProviderLink.requestId,
      providerRequestId: normalizedProviderRequestId,
      evidence: [...evidence, "projection_provider_request_id"],
      attemptLookupError,
    };
  }

  const projectionRequestLink = await readGenerationProjectionLinkByRequestId({
    userId,
    requestId: normalizedProviderRequestId,
  }).catch(() => null);
  if (projectionRequestLink?.generationId) {
    return {
      generationId: projectionRequestLink.generationId,
      generationAttemptId,
      userId: lineageUserId,
      modelId,
      sourceRef: projectionRequestLink.sourceRef,
      requestId: projectionRequestLink.requestId,
      providerRequestId: normalizedProviderRequestId,
      evidence: [...evidence, "projection_request_id"],
      attemptLookupError,
    };
  }

  return {
    generationId,
    generationAttemptId,
    userId: lineageUserId,
    modelId,
    sourceRef,
    requestId,
    providerRequestId: normalizedProviderRequestId,
    evidence,
    attemptLookupError,
  };
};
