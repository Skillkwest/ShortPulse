import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  resolveGenerationLineageByProviderRequest,
  resolveGenerationLineageBySourceRef,
} from "../../../lib/server/api/generationLineageResolver";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type JsonRow = Record<string, unknown>;
type PricingObservabilityRecord = {
  sourceType: "generation" | "reservation" | "ledger";
  rowId: string | null;
  generationId: string | null;
  requestId: string | null;
  providerRequestId: string | null;
  sourceRef: string | null;
  observedAt: string | null;
  displayedBilledCredits: number | null;
  actualBilledCredits: number | null;
  deltaCredits: number | null;
  mismatch: boolean;
  pricingDisplaySource: string | null;
  pricingPolicyReady: boolean | null;
  displayedPricingPolicyVersion: number | null;
  actualPricingPolicyVersion: number | null;
  displayedPricingVariantId: string | null;
  actualPricingVariantId: string | null;
};
type PricingPolicyConflictRecord = {
  rowId: string | null;
  requestId: string | null;
  sourceRef: string | null;
  observedAt: string | null;
  code: string | null;
  message: string | null;
  modelId: string | null;
  displayedBilledCredits: number | null;
  activeBilledCredits: number | null;
  displayedPricingPolicyVersion: number | null;
  activePricingPolicyVersion: number | null;
  displayedPricingVariantId: string | null;
  activePricingVariantId: string | null;
};

const asSingleString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    const trimmed = value[0].trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
};

const dedupeRowsById = (rows: JsonRow[]): JsonRow[] => {
  const map = new Map<string, JsonRow>();
  rows.forEach((row) => {
    const id = row.id;
    if (typeof id !== "string" || !id.trim()) return;
    if (!map.has(id)) map.set(id, row);
  });
  return Array.from(map.values());
};

const appendObjectRows = (target: JsonRow[], rows: unknown) => {
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      target.push(row as JsonRow);
    }
  });
};

const readErrorMessage = (error: unknown): string => {
  if (!error) return "unknown";
  if (typeof error === "string") return error;
  if (typeof error === "object" && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim().length) return message;
  }
  return "unknown";
};

const isMissingAiGenerationsColumnError = (error: unknown): boolean => {
  const message = readErrorMessage(error).toLowerCase();
  return (
    (message.includes("ai_generations") && message.includes("does not exist")) ||
    (message.includes("could not find the") && message.includes("ai_generations"))
  );
};

const sortRowsDesc = (rows: JsonRow[]): JsonRow[] =>
  rows.slice().sort((a, b) => {
    const aTs =
      (typeof a.created_at === "string" && a.created_at) ||
      (typeof a.occurred_at === "string" && a.occurred_at) ||
      (typeof a.updated_at === "string" && a.updated_at) ||
      "";
    const bTs =
      (typeof b.created_at === "string" && b.created_at) ||
      (typeof b.occurred_at === "string" && b.occurred_at) ||
      (typeof b.updated_at === "string" && b.updated_at) ||
      "";
    return bTs.localeCompare(aTs);
  });

const readRequestId = (row: JsonRow): string | null => {
  const requestId = row.request_id;
  if (typeof requestId !== "string") return null;
  const trimmed = requestId.trim();
  return trimmed.length ? trimmed : null;
};

const readPricingObservabilityMismatch = (row: JsonRow): boolean => {
  const observability = readPricingObservability(row);
  return observability?.mismatch === true;
};

const readPricingObservability = (row: JsonRow): JsonRow | null => {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const directObservability = (metadata as JsonRow).pricing_observability;
  if (
    directObservability &&
    typeof directObservability === "object" &&
    !Array.isArray(directObservability)
  ) {
    return directObservability as JsonRow;
  }
  const pricingMetadata = (metadata as JsonRow).pricing_metadata;
  if (pricingMetadata && typeof pricingMetadata === "object" && !Array.isArray(pricingMetadata)) {
    const nestedObservability = (pricingMetadata as JsonRow).pricing_observability;
    if (
      nestedObservability &&
      typeof nestedObservability === "object" &&
      !Array.isArray(nestedObservability)
    ) {
      return nestedObservability as JsonRow;
    }
  }
  return null;
};

const readMetadataObject = (row: JsonRow): JsonRow | null => {
  const metadata = row.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as JsonRow)
    : null;
};

const readFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length ? value.trim() : null;

const buildPricingObservabilityRecord = ({
  row,
  sourceType,
}: {
  row: JsonRow;
  sourceType: PricingObservabilityRecord["sourceType"];
}): PricingObservabilityRecord | null => {
  const observability = readPricingObservability(row);
  if (!observability || observability.mismatch !== true) return null;
  return {
    sourceType,
    rowId: readNullableString(row.id),
    generationId: sourceType === "generation" ? readNullableString(row.id) : null,
    requestId: readNullableString(row.request_id),
    providerRequestId: readNullableString(row.provider_request_id),
    sourceRef: readNullableString(row.source_ref),
    observedAt:
      readNullableString(row.created_at) ??
      readNullableString(row.updated_at) ??
      readNullableString(row.occurred_at),
    displayedBilledCredits: readFiniteNumber(observability.displayed_billed_credits),
    actualBilledCredits: readFiniteNumber(observability.actual_billed_credits),
    deltaCredits: readFiniteNumber(observability.delta_credits),
    mismatch: true,
    pricingDisplaySource: readNullableString(observability.pricing_display_source),
    pricingPolicyReady:
      typeof observability.pricing_policy_ready === "boolean"
        ? observability.pricing_policy_ready
        : null,
    displayedPricingPolicyVersion: readFiniteNumber(observability.displayed_pricing_policy_version),
    actualPricingPolicyVersion: readFiniteNumber(observability.actual_pricing_policy_version),
    displayedPricingVariantId: readNullableString(observability.displayed_pricing_variant_id),
    actualPricingVariantId: readNullableString(observability.actual_pricing_variant_id),
  };
};

const buildPricingPolicyConflictRecord = (row: JsonRow): PricingPolicyConflictRecord | null => {
  if (readNullableString(row.source) !== "api.generation_billing_pricing_policy_conflict") {
    return null;
  }
  const metadata = readMetadataObject(row);
  if (!metadata) return null;
  return {
    rowId: readNullableString(row.id),
    requestId: readNullableString(row.request_id),
    sourceRef: readNullableString(metadata.source_ref),
    observedAt: readNullableString(row.occurred_at) ?? readNullableString(row.created_at),
    code: readNullableString(metadata.code),
    message: readNullableString(row.message),
    modelId: readNullableString(metadata.model_id),
    displayedBilledCredits: readFiniteNumber(metadata.displayed_billed_credits),
    activeBilledCredits: readFiniteNumber(metadata.active_billed_credits),
    displayedPricingPolicyVersion: readFiniteNumber(metadata.displayed_pricing_policy_version),
    activePricingPolicyVersion: readFiniteNumber(metadata.active_pricing_policy_version),
    displayedPricingVariantId: readNullableString(metadata.displayed_pricing_variant_id),
    activePricingVariantId: readNullableString(metadata.active_pricing_variant_id),
  };
};

const selectGenerationFields = [
  "id",
  "user_id",
  "provider",
  "model_id",
  "request_id",
  "status",
  "error_message",
  "recovery_state",
  "recovery_attempts",
  "last_recovery_at",
  "next_recovery_at",
  "last_media_detected_at",
  "created_at",
  "completed_at",
  "metadata",
].join(", ");

const selectGenerationFieldsLegacy = [
  "id",
  "user_id",
  "provider",
  "model_id",
  "request_id",
  "status",
  "error_message",
  "created_at",
  "completed_at",
  "metadata",
].join(", ");

const selectErrorEventFields = [
  "id",
  "source",
  "scope",
  "severity",
  "message",
  "endpoint",
  "request_id",
  "metadata",
  "occurred_at",
  "created_at",
].join(", ");

const selectLedgerFields = [
  "id",
  "source",
  "source_ref",
  "change_cents",
  "reason",
  "metadata",
  "created_at",
].join(", ");

const selectReservationFields = [
  "id",
  "source_ref",
  "provider_request_id",
  "model_id",
  "amount_cents",
  "status",
  "reason",
  "metadata",
  "created_at",
  "updated_at",
  "captured_at",
  "released_at",
].join(", ");

const selectAttemptFields = [
  "id",
  "generation_id",
  "provider",
  "provider_request_id",
  "status",
  "attempt_index",
  "created_at",
  "updated_at",
].join(", ");

const selectOutputFields = [
  "id",
  "generation_id",
  "output_index",
  "media_file_id",
  "result_url",
  "provider_request_id",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

const selectProjectionFields = [
  "generation_id",
  "source_ref",
  "request_id",
  "provider_request_id",
  "updated_at",
].join(", ");

const selectMediaEventFields = [
  "id",
  "event_type",
  "entity_type",
  "entity_id",
  "metadata",
  "created_at",
].join(", ");

const selectMediaFileFields = [
  "id",
  "source",
  "source_ref",
  "storage_path",
  "file_type",
  "metadata",
  "created_at",
].join(", ");

const runGenerationQueryWithFallback = async ({
  execute,
  warnings,
  label,
}: {
  execute: (selectFields: string) => PromiseLike<{ data: unknown; error: unknown }>;
  warnings: string[];
  label: string;
}): Promise<{ data: unknown; error: unknown }> => {
  const primary = await execute(selectGenerationFields);
  if (!primary.error) return primary;
  if (!isMissingAiGenerationsColumnError(primary.error)) return primary;

  warnings.push(`${label} fell back to legacy ai_generations fields (migration 019 missing).`);
  const fallback = await execute(selectGenerationFieldsLegacy);
  return fallback;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin.generation_trace.auth",
    });
    return res.status(500).json({ error: "Failed to load generation trace timeline." });
  }
  if (!adminUser) return;

  const generationId = asSingleString(req.query.generationId);
  const requestId = asSingleString(req.query.requestId);
  const traceId = asSingleString(req.query.traceId);
  const userId = asSingleString(req.query.userId);

  if (!generationId && !requestId && !traceId && !userId) {
    return res
      .status(400)
      .json({ error: "Provide at least one of generationId, requestId, traceId, or userId." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const warnings: string[] = [];
    const generationRows: JsonRow[] = [];
    const resolvedRequestIds = new Set<string>();

    const appendLineageGeneration = async ({
      generationId: resolvedGenerationId,
      label,
    }: {
      generationId: string | null;
      label: string;
    }) => {
      if (!resolvedGenerationId) return;
      const { data, error } = await runGenerationQueryWithFallback({
        warnings,
        label,
        execute: (selectFields) =>
          supabaseAdmin
            .from("ai_generations")
            .select(selectFields)
            .eq("id", resolvedGenerationId)
            .limit(5),
      });
      if (error) {
        warnings.push(`${label} failed: ${readErrorMessage(error)}`);
      } else {
        appendObjectRows(generationRows, data);
      }
    };

    if (generationId) {
      const { data, error } = await runGenerationQueryWithFallback({
        warnings,
        label: "ai_generations.id lookup",
        execute: (selectFields) =>
          supabaseAdmin.from("ai_generations").select(selectFields).eq("id", generationId).limit(5),
      });
      if (error) {
        warnings.push(`ai_generations.id lookup failed: ${readErrorMessage(error)}`);
      } else {
        appendObjectRows(generationRows, data);
      }
    }

    if (requestId) {
      const { data, error } = await runGenerationQueryWithFallback({
        warnings,
        label: "ai_generations.request_id lookup",
        execute: (selectFields) =>
          supabaseAdmin
            .from("ai_generations")
            .select(selectFields)
            .eq("request_id", requestId)
            .limit(25),
      });
      if (error) {
        warnings.push(`ai_generations.request_id lookup failed: ${readErrorMessage(error)}`);
      } else {
        appendObjectRows(generationRows, data);
      }
    }

    if (userId) {
      const { data, error } = await runGenerationQueryWithFallback({
        warnings,
        label: "ai_generations.user_id lookup",
        execute: (selectFields) =>
          supabaseAdmin
            .from("ai_generations")
            .select(selectFields)
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(25),
      });
      if (error) {
        warnings.push(`ai_generations.user_id lookup failed: ${readErrorMessage(error)}`);
      } else {
        appendObjectRows(generationRows, data);
      }
    }

    if (traceId) {
      const [tracePrimary, traceFallback, traceSourceRef] = await Promise.all([
        runGenerationQueryWithFallback({
          warnings,
          label: "ai_generations.generation_trace_id lookup",
          execute: (selectFields) =>
            supabaseAdmin
              .from("ai_generations")
              .select(selectFields)
              .contains("metadata", { generation_trace_id: traceId })
              .limit(25),
        }),
        runGenerationQueryWithFallback({
          warnings,
          label: "ai_generations.submission_trace_id lookup",
          execute: (selectFields) =>
            supabaseAdmin
              .from("ai_generations")
              .select(selectFields)
              .contains("metadata", { submission_trace_id: traceId })
              .limit(25),
        }),
        runGenerationQueryWithFallback({
          warnings,
          label: "ai_generations.source_ref lookup",
          execute: (selectFields) =>
            supabaseAdmin
              .from("ai_generations")
              .select(selectFields)
              .contains("metadata", { source_ref: traceId })
              .limit(25),
        }),
      ]);
      if (tracePrimary.error) {
        warnings.push(
          `ai_generations.generation_trace_id lookup failed: ${readErrorMessage(tracePrimary.error)}`
        );
      } else {
        appendObjectRows(generationRows, tracePrimary.data);
      }
      if (traceFallback.error) {
        warnings.push(
          `ai_generations.submission_trace_id lookup failed: ${readErrorMessage(traceFallback.error)}`
        );
      } else {
        appendObjectRows(generationRows, traceFallback.data);
      }
      if (traceSourceRef.error) {
        warnings.push(
          `ai_generations.source_ref lookup failed: ${readErrorMessage(traceSourceRef.error)}`
        );
      } else {
        appendObjectRows(generationRows, traceSourceRef.data);
      }
    }

    if (userId && requestId) {
      try {
        const lineage = await resolveGenerationLineageByProviderRequest({
          userId,
          providerRequestId: requestId,
          supabaseAdmin,
        });
        await appendLineageGeneration({
          generationId: lineage.generationId,
          label: "shared lineage provider request lookup",
        });
        if (lineage.requestId) resolvedRequestIds.add(lineage.requestId);
        if (lineage.providerRequestId) resolvedRequestIds.add(lineage.providerRequestId);
      } catch (error) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "admin.generation_trace.provider_request_lineage",
          metadata: {
            query_user_id: userId ?? null,
            provider_request_id: requestId ?? null,
          },
          user: adminUser,
        });
        warnings.push(`shared lineage provider request lookup failed: ${readErrorMessage(error)}`);
      }
    }

    if (userId && traceId) {
      try {
        const lineage = await resolveGenerationLineageBySourceRef({
          userId,
          sourceRef: traceId,
          supabaseAdmin,
        });
        await appendLineageGeneration({
          generationId: lineage.generationId,
          label: "shared lineage source_ref lookup",
        });
        if (lineage.requestId) resolvedRequestIds.add(lineage.requestId);
        if (lineage.providerRequestId) resolvedRequestIds.add(lineage.providerRequestId);
      } catch (error) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "admin.generation_trace.source_ref_lineage",
          metadata: {
            query_user_id: userId ?? null,
            trace_id: traceId ?? null,
          },
          user: adminUser,
        });
        warnings.push(`shared lineage source_ref lookup failed: ${readErrorMessage(error)}`);
      }
    }

    let generations = sortRowsDesc(dedupeRowsById(generationRows));
    let generationIds = generations
      .map((row) => row.id)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    const requestIds = new Set<string>();
    if (requestId) requestIds.add(requestId);
    resolvedRequestIds.forEach((resolvedRequestId) => requestIds.add(resolvedRequestId));
    generations.forEach((row) => {
      const rowRequestId = readRequestId(row);
      if (rowRequestId) requestIds.add(rowRequestId);
    });

    const requestIdList = Array.from(requestIds);
    const generationAttempts: JsonRow[] = [];
    const generationOutputs: JsonRow[] = [];
    const generationProjectionRows: JsonRow[] = [];

    const attemptQueries: Array<PromiseLike<{ data: unknown; error: unknown }>> = [];
    if (generationIds.length) {
      attemptQueries.push(
        supabaseAdmin
          .from("generation_attempts")
          .select(selectAttemptFields)
          .in("generation_id", generationIds)
          .order("created_at", { ascending: false })
          .limit(200)
      );
    }
    if (requestIdList.length) {
      attemptQueries.push(
        supabaseAdmin
          .from("generation_attempts")
          .select(selectAttemptFields)
          .in("provider_request_id", requestIdList)
          .order("created_at", { ascending: false })
          .limit(200)
      );
    }
    if (attemptQueries.length) {
      const attemptResults = await Promise.all(attemptQueries);
      attemptResults.forEach((result) => {
        if (result.error) {
          warnings.push(`generation_attempts lookup failed: ${readErrorMessage(result.error)}`);
          return;
        }
        appendObjectRows(generationAttempts, result.data);
      });
    }

    const projectionQueries: Array<PromiseLike<{ data: unknown; error: unknown }>> = [];
    if (requestIdList.length) {
      projectionQueries.push(
        supabaseAdmin
          .from("generation_projection")
          .select(selectProjectionFields)
          .in("provider_request_id", requestIdList)
          .order("updated_at", { ascending: false })
          .limit(200)
      );
      projectionQueries.push(
        supabaseAdmin
          .from("generation_projection")
          .select(selectProjectionFields)
          .in("request_id", requestIdList)
          .order("updated_at", { ascending: false })
          .limit(200)
      );
    }
    if (projectionQueries.length) {
      const projectionResults = await Promise.all(projectionQueries);
      projectionResults.forEach((result) => {
        if (result.error) {
          warnings.push(`generation_projection lookup failed: ${readErrorMessage(result.error)}`);
          return;
        }
        appendObjectRows(generationProjectionRows, result.data);
      });
    }

    const dedupedAttempts = sortRowsDesc(dedupeRowsById(generationAttempts));
    const attemptGenerationIds = dedupedAttempts
      .map((row) => row.generation_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    const projectionGenerationIds = generationProjectionRows
      .map((row) => row.generation_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    const missingGenerationIds = Array.from(
      new Set([...attemptGenerationIds, ...projectionGenerationIds])
    ).filter((id) => !generationIds.includes(id));

    if (missingGenerationIds.length) {
      const { data, error } = await runGenerationQueryWithFallback({
        warnings,
        label: "ai_generations.generation_attempts expansion lookup",
        execute: (selectFields) =>
          supabaseAdmin
            .from("ai_generations")
            .select(selectFields)
            .in("id", missingGenerationIds)
            .limit(50),
      });
      if (error) {
        warnings.push(
          `ai_generations.generation_attempts expansion lookup failed: ${readErrorMessage(error)}`
        );
      } else {
        appendObjectRows(generationRows, data);
        generations = sortRowsDesc(dedupeRowsById(generationRows));
        generationIds = generations
          .map((row) => row.id)
          .filter((value): value is string => typeof value === "string" && value.length > 0);
      }
    }

    const mediaEvents: JsonRow[] = [];
    const mediaFiles: JsonRow[] = [];
    const reservations: JsonRow[] = [];
    const ledgerRows: JsonRow[] = [];
    const errorEvents: JsonRow[] = [];

    if (generationIds.length) {
      const outputResult = await supabaseAdmin
        .from("ai_generation_outputs")
        .select(selectOutputFields)
        .in("generation_id", generationIds)
        .order("created_at", { ascending: false })
        .limit(200);

      if (outputResult.error) {
        warnings.push(
          `ai_generation_outputs lookup failed: ${readErrorMessage(outputResult.error)}`
        );
      } else {
        appendObjectRows(generationOutputs, outputResult.data);
      }
    }

    const dedupedOutputs = sortRowsDesc(dedupeRowsById(generationOutputs));
    const outputMediaFileIds = dedupedOutputs
      .map((row) => row.media_file_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    if (generationIds.length) {
      const fileQueries: Array<PromiseLike<{ data: unknown; error: unknown }>> = [
        supabaseAdmin
          .from("media_events")
          .select(selectMediaEventFields)
          .eq("entity_type", "ai_generation")
          .in("entity_id", generationIds)
          .order("created_at", { ascending: false })
          .limit(200),
        supabaseAdmin
          .from("media_files")
          .select(selectMediaFileFields)
          .in("source_ref", generationIds)
          .order("created_at", { ascending: false })
          .limit(200),
      ];
      if (outputMediaFileIds.length) {
        fileQueries.push(
          supabaseAdmin
            .from("media_files")
            .select(selectMediaFileFields)
            .in("id", outputMediaFileIds)
            .order("created_at", { ascending: false })
            .limit(200)
        );
      }

      const [eventsResult, ...fileResults] = await Promise.all(fileQueries);

      if (eventsResult.error) {
        warnings.push(`media_events lookup failed: ${readErrorMessage(eventsResult.error)}`);
      } else {
        appendObjectRows(mediaEvents, eventsResult.data);
      }

      fileResults.forEach((filesResult) => {
        if (filesResult.error) {
          warnings.push(`media_files lookup failed: ${readErrorMessage(filesResult.error)}`);
        } else {
          appendObjectRows(mediaFiles, filesResult.data);
        }
      });
    }

    const reservationQueries: Array<PromiseLike<{ data: unknown; error: unknown }>> = [];
    if (requestIdList.length) {
      reservationQueries.push(
        supabaseAdmin
          .from("ai_credit_reservations")
          .select(selectReservationFields)
          .in("provider_request_id", requestIdList)
          .order("created_at", { ascending: false })
          .limit(200)
      );
    }
    if (traceId) {
      reservationQueries.push(
        supabaseAdmin
          .from("ai_credit_reservations")
          .select(selectReservationFields)
          .eq("source_ref", traceId)
          .order("created_at", { ascending: false })
          .limit(200)
      );
    }
    if (reservationQueries.length) {
      const reservationResults = await Promise.all(reservationQueries);
      reservationResults.forEach((result) => {
        if (result.error) {
          warnings.push(`ai_credit_reservations lookup failed: ${readErrorMessage(result.error)}`);
          return;
        }
        appendObjectRows(reservations, result.data);
      });
    }

    const ledgerQueries: Array<PromiseLike<{ data: unknown; error: unknown }>> = [];
    if (traceId) {
      ledgerQueries.push(
        supabaseAdmin
          .from("ai_credit_ledger")
          .select(selectLedgerFields)
          .eq("source_ref", traceId)
          .order("created_at", { ascending: false })
          .limit(200)
      );
    }
    requestIdList.forEach((id) => {
      ledgerQueries.push(
        supabaseAdmin
          .from("ai_credit_ledger")
          .select(selectLedgerFields)
          .contains("metadata", { provider_request_id: id })
          .order("created_at", { ascending: false })
          .limit(200)
      );
    });
    if (ledgerQueries.length) {
      const ledgerResults = await Promise.all(ledgerQueries);
      ledgerResults.forEach((result) => {
        if (result.error) {
          warnings.push(`ai_credit_ledger lookup failed: ${readErrorMessage(result.error)}`);
          return;
        }
        appendObjectRows(ledgerRows, result.data);
      });
    }

    const errorQueries: Array<PromiseLike<{ data: unknown; error: unknown }>> = [];
    if (requestIdList.length) {
      errorQueries.push(
        supabaseAdmin
          .from("app_error_events")
          .select(selectErrorEventFields)
          .in("request_id", requestIdList)
          .order("created_at", { ascending: false })
          .limit(200)
      );
      requestIdList.forEach((id) => {
        errorQueries.push(
          supabaseAdmin
            .from("app_error_events")
            .select(selectErrorEventFields)
            .contains("metadata", { provider_request_id: id })
            .order("created_at", { ascending: false })
            .limit(200)
        );
      });
    }
    generationIds.forEach((id) => {
      errorQueries.push(
        supabaseAdmin
          .from("app_error_events")
          .select(selectErrorEventFields)
          .contains("metadata", { generation_id: id })
          .order("created_at", { ascending: false })
          .limit(200)
      );
    });
    if (traceId) {
      errorQueries.push(
        supabaseAdmin
          .from("app_error_events")
          .select(selectErrorEventFields)
          .contains("metadata", { generation_trace_id: traceId })
          .order("created_at", { ascending: false })
          .limit(200)
      );
      errorQueries.push(
        supabaseAdmin
          .from("app_error_events")
          .select(selectErrorEventFields)
          .contains("metadata", { submission_trace_id: traceId })
          .order("created_at", { ascending: false })
          .limit(200)
      );
      errorQueries.push(
        supabaseAdmin
          .from("app_error_events")
          .select(selectErrorEventFields)
          .contains("metadata", { source_ref: traceId })
          .order("created_at", { ascending: false })
          .limit(200)
      );
    }
    if (errorQueries.length) {
      const errorResults = await Promise.all(errorQueries);
      errorResults.forEach((result) => {
        if (result.error) {
          warnings.push(`app_error_events lookup failed: ${readErrorMessage(result.error)}`);
          return;
        }
        appendObjectRows(errorEvents, result.data);
      });
    }

    const dedupedReservations = sortRowsDesc(dedupeRowsById(reservations));
    const dedupedLedger = sortRowsDesc(dedupeRowsById(ledgerRows));
    const dedupedErrors = sortRowsDesc(dedupeRowsById(errorEvents));
    const dedupedMediaEvents = sortRowsDesc(dedupeRowsById(mediaEvents));
    const dedupedMediaFiles = sortRowsDesc(dedupeRowsById(mediaFiles));
    const pricingObservabilityMismatchRows = [
      ...generations
        .map((row) => buildPricingObservabilityRecord({ row, sourceType: "generation" }))
        .filter((row): row is PricingObservabilityRecord => row != null),
      ...dedupedReservations
        .map((row) => buildPricingObservabilityRecord({ row, sourceType: "reservation" }))
        .filter((row): row is PricingObservabilityRecord => row != null),
      ...dedupedLedger
        .map((row) => buildPricingObservabilityRecord({ row, sourceType: "ledger" }))
        .filter((row): row is PricingObservabilityRecord => row != null),
    ];
    const pricingObservabilityMismatches = [
      ...generations,
      ...dedupedReservations,
      ...dedupedLedger,
    ].filter(readPricingObservabilityMismatch).length;
    const pricingPolicyConflictRows = dedupedErrors
      .map(buildPricingPolicyConflictRecord)
      .filter((row): row is PricingPolicyConflictRecord => row != null);

    return res.status(200).json({
      query: {
        generationId: generationId ?? null,
        requestId: requestId ?? null,
        traceId: traceId ?? null,
        userId: userId ?? null,
      },
      summary: {
        generations: generations.length,
        attempts: dedupedAttempts.length,
        outputs: dedupedOutputs.length,
        mediaEvents: dedupedMediaEvents.length,
        mediaFiles: dedupedMediaFiles.length,
        reservations: dedupedReservations.length,
        ledgerEntries: dedupedLedger.length,
        errorEvents: dedupedErrors.length,
        pricingObservabilityMismatches,
        pricingPolicyConflicts: pricingPolicyConflictRows.length,
      },
      generations,
      generationAttempts: dedupedAttempts,
      generationOutputs: dedupedOutputs,
      mediaEvents: dedupedMediaEvents,
      mediaFiles: dedupedMediaFiles,
      reservations: dedupedReservations,
      ledgerEntries: dedupedLedger,
      pricingObservabilityMismatchRows,
      pricingPolicyConflictRows,
      errorEvents: dedupedErrors,
      warnings,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      routeLabel: "admin.generation_trace",
      error,
      metadata: {
        generation_id: generationId ?? null,
        request_id: requestId ?? null,
        trace_id: traceId ?? null,
        user_id: userId ?? null,
      },
      user: adminUser,
    });
    return res.status(500).json({ error: "Failed to load generation trace timeline." });
  }
}
