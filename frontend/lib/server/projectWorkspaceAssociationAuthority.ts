/**
 * Project workspace association authority helpers.
 * Owns snapshot association collection, ownership resolution, checksums, and project backfills.
 */
import { computeAiStudioSessionChecksum } from "../ai-studio-session/projectWorkspaceSnapshot";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { backfillProjectGenerationAssociationsForSnapshot } from "./projectGenerationAssociationsService";
import { chunkValues } from "./queryBatching";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_WORKSPACE_OWNED_ID_RESOLUTION_TIMEOUT_MS = 8_000;

type ProjectWorkspaceOwnedAssociationResults = [
  PromiseSettledResult<string[]>,
  PromiseSettledResult<string[]>,
  PromiseSettledResult<string[]>,
];

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeUuid = (value: unknown): string | null => {
  const normalized = normalizeOptionalString(value);
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
};

const normalizeUuidList = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((entry) => normalizeUuid(entry))
            .filter((entry): entry is string => Boolean(entry))
        )
      )
    : [];

const safeStringifyError = (error: unknown): string | null => {
  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : null;
  } catch {
    return null;
  }
};

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  const record = asRecord(error);
  const parts = [
    normalizeOptionalString(record.message),
    normalizeOptionalString(record.details),
    normalizeOptionalString(record.hint),
    normalizeOptionalString(record.code),
  ].filter((entry): entry is string => Boolean(entry));
  if (parts.length > 0) return parts.join(" ");
  return safeStringifyError(error) ?? fallback;
};

const withProjectWorkspaceBestEffortTimeout = async <T>(
  promise: Promise<T>,
  stage: string,
  timeoutMs: number
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${stage} exceeded ${timeoutMs}ms budget`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const readProjectAssetAssociationChecksum = (
  snapshot: Record<string, unknown>
): string | null =>
  normalizeOptionalString(asRecord(snapshot.meta).projectAssetAssociationChecksum);

const uniqueSortedStrings = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();

export const computeProjectAssetAssociationChecksum = ({
  mediaFileIds,
  promptIds,
  generationIds,
}: {
  mediaFileIds: string[];
  promptIds: string[];
  generationIds: string[];
}): string =>
  computeAiStudioSessionChecksum({
    generationIds: uniqueSortedStrings(generationIds),
    mediaFileIds: uniqueSortedStrings(mediaFileIds),
    promptIds: uniqueSortedStrings(promptIds),
  });

export const computeComparableProjectAssetAssociationChecksum = (
  snapshot: Record<string, unknown>
): string | null => {
  const { mediaFileIds, promptIds } = collectSnapshotAssociationIds(snapshot);
  const { generationIds, runtimeRequestIds } = collectSnapshotGenerationAuthorityKeys(snapshot);
  if (runtimeRequestIds.length > 0) return null;
  return computeProjectAssetAssociationChecksum({
    mediaFileIds: normalizeUuidList(mediaFileIds),
    promptIds: normalizeUuidList(promptIds),
    generationIds: normalizeUuidList(generationIds),
  });
};

export const patchProjectAssetAssociationChecksum = (
  snapshot: Record<string, unknown>,
  projectAssetAssociationChecksum: string | null
): Record<string, unknown> => {
  const metaWithAssociationChecksum: Record<string, unknown> = {
    ...asRecord(snapshot.meta),
  };
  if (projectAssetAssociationChecksum) {
    metaWithAssociationChecksum.projectAssetAssociationChecksum = projectAssetAssociationChecksum;
  } else {
    delete metaWithAssociationChecksum.projectAssetAssociationChecksum;
  }
  const { checksum: _existingChecksum, ...metaWithoutChecksum } = metaWithAssociationChecksum;
  void _existingChecksum;
  const snapshotWithoutChecksum = {
    ...snapshot,
    meta: metaWithoutChecksum,
  };
  return {
    ...snapshotWithoutChecksum,
    meta: {
      ...metaWithoutChecksum,
      checksum: computeAiStudioSessionChecksum(snapshotWithoutChecksum),
    },
  };
};

const collectSnapshotAssociationIds = (snapshot: Record<string, unknown>) => {
  const outputsRecord = asRecord(snapshot.outputs);
  const rows = [
    ...(Array.isArray(outputsRecord.active) ? outputsRecord.active : []),
    ...(Array.isArray(outputsRecord.archived) ? outputsRecord.archived : []),
  ];
  const mediaFileIds = new Set<string>();
  const promptIds = new Set<string>();

  rows.forEach((row) => {
    const normalizedRow = asRecord(row);
    const promptId =
      typeof normalizedRow.promptId === "string" ? normalizedRow.promptId.trim() : "";
    if (promptId) {
      promptIds.add(promptId);
    }
    const savedMediaIds = Array.isArray(normalizedRow.savedMediaIds)
      ? normalizedRow.savedMediaIds
      : [];
    savedMediaIds.forEach((value) => {
      const mediaFileId = typeof value === "string" ? value.trim() : "";
      if (mediaFileId) {
        mediaFileIds.add(mediaFileId);
      }
    });
  });

  return {
    mediaFileIds: [...mediaFileIds],
    promptIds: [...promptIds],
  };
};

const collectSnapshotGenerationAuthorityKeys = (snapshot: Record<string, unknown>) => {
  const outputsRecord = asRecord(snapshot.outputs);
  const rows = [
    ...(Array.isArray(outputsRecord.active) ? outputsRecord.active : []),
    ...(Array.isArray(outputsRecord.archived) ? outputsRecord.archived : []),
  ];
  const generationIds = new Set<string>();
  const runtimeRequestIds = new Set<string>();

  rows.forEach((row) => {
    const normalizedRow = asRecord(row);
    const generationId =
      typeof normalizedRow.generationId === "string" ? normalizedRow.generationId.trim() : "";
    if (generationId) {
      generationIds.add(generationId);
    }
    const taskId = normalizeOptionalString(normalizedRow.taskId);
    if (taskId) {
      runtimeRequestIds.add(taskId);
    }
    const sourceRef = normalizeOptionalString(normalizedRow.sourceRef);
    if (sourceRef) {
      runtimeRequestIds.add(sourceRef);
    }
  });

  return {
    generationIds: [...generationIds],
    runtimeRequestIds: [...runtimeRequestIds],
  };
};

const resolveOwnedIds = async ({
  table,
  idColumn,
  userId,
  ids,
}: {
  table: "media_files" | "media_prompts";
  idColumn: "id";
  userId: string;
  ids: string[];
}): Promise<string[]> => {
  const canonicalIds = normalizeUuidList(ids);
  if (canonicalIds.length === 0) return [];
  const supabaseAdmin = getSupabaseAdmin();
  const ownedIds = new Set<string>();

  for (const idChunk of chunkValues(canonicalIds)) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(idColumn)
      .eq("user_id", userId)
      .in(idColumn, idChunk);

    if (error) {
      const tableLabel = table === "media_files" ? "media ids" : "prompt ids";
      throw new Error(error.message || `Failed to resolve owned ${tableLabel}`);
    }

    (Array.isArray(data) ? data : []).forEach((row) => {
      const record = asRecord(row);
      const idValue = record[idColumn];
      if (typeof idValue === "string" && idValue.trim().length > 0) {
        ownedIds.add(idValue.trim());
      }
    });
  }

  return [...ownedIds];
};

const resolveOwnedGenerationIds = async ({
  userId,
  generationIds,
  runtimeRequestIds,
}: {
  userId: string;
  generationIds: string[];
  runtimeRequestIds: string[];
}): Promise<string[]> => {
  const canonicalGenerationIds = normalizeUuidList(generationIds);
  const canonicalRuntimeRequestIds = Array.from(
    new Set(
      runtimeRequestIds
        .map((value) => normalizeOptionalString(value))
        .filter((value): value is string => Boolean(value))
    )
  );
  if (canonicalGenerationIds.length === 0 && canonicalRuntimeRequestIds.length === 0) return [];
  const supabaseAdmin = getSupabaseAdmin();
  const ownedGenerationIds = new Set<string>();

  for (const generationIdChunk of chunkValues(canonicalGenerationIds)) {
    const [
      { data: generationData, error: generationError },
      { data: projectionData, error: projectionError },
    ] = await Promise.all([
      supabaseAdmin
        .from("ai_generations")
        .select("id")
        .eq("user_id", userId)
        .in("id", generationIdChunk),
      supabaseAdmin
        .from("generation_projection")
        .select("generation_id")
        .eq("user_id", userId)
        .in("generation_id", generationIdChunk),
    ]);

    if (generationError) {
      throw new Error(generationError.message || "Failed to resolve owned generation ids");
    }
    if (projectionError) {
      throw new Error(
        projectionError.message || "Failed to resolve owned generation projection ids"
      );
    }

    (Array.isArray(generationData) ? generationData : []).forEach((row) => {
      const idValue = asRecord(row).id;
      if (typeof idValue === "string" && idValue.trim().length > 0) {
        ownedGenerationIds.add(idValue.trim());
      }
    });
    (Array.isArray(projectionData) ? projectionData : []).forEach((row) => {
      const idValue = asRecord(row).generation_id;
      if (typeof idValue === "string" && idValue.trim().length > 0) {
        ownedGenerationIds.add(idValue.trim());
      }
    });
  }

  for (const requestIdChunk of chunkValues(canonicalRuntimeRequestIds)) {
    const [
      { data: generationData, error: generationError },
      { data: projectionRequestData, error: projectionRequestError },
      { data: projectionSourceRefData, error: projectionSourceRefError },
    ] = await Promise.all([
      supabaseAdmin
        .from("ai_generations")
        .select("id")
        .eq("user_id", userId)
        .in("request_id", requestIdChunk),
      supabaseAdmin
        .from("generation_projection")
        .select("generation_id")
        .eq("user_id", userId)
        .in("request_id", requestIdChunk),
      supabaseAdmin
        .from("generation_projection")
        .select("generation_id")
        .eq("user_id", userId)
        .in("source_ref", requestIdChunk),
    ]);

    if (generationError) {
      throw new Error(generationError.message || "Failed to resolve owned generation request ids");
    }
    if (projectionRequestError) {
      throw new Error(
        projectionRequestError.message ||
          "Failed to resolve owned generation projection request ids"
      );
    }
    if (projectionSourceRefError) {
      throw new Error(
        projectionSourceRefError.message ||
          "Failed to resolve owned generation projection source refs"
      );
    }

    (Array.isArray(generationData) ? generationData : []).forEach((row) => {
      const idValue = asRecord(row).id;
      if (typeof idValue === "string" && idValue.trim().length > 0) {
        ownedGenerationIds.add(idValue.trim());
      }
    });
    (Array.isArray(projectionRequestData) ? projectionRequestData : []).forEach((row) => {
      const idValue = asRecord(row).generation_id;
      if (typeof idValue === "string" && idValue.trim().length > 0) {
        ownedGenerationIds.add(idValue.trim());
      }
    });
    (Array.isArray(projectionSourceRefData) ? projectionSourceRefData : []).forEach((row) => {
      const idValue = asRecord(row).generation_id;
      if (typeof idValue === "string" && idValue.trim().length > 0) {
        ownedGenerationIds.add(idValue.trim());
      }
    });
  }

  return [...ownedGenerationIds];
};

const resolveOwnedSnapshotAssociationIds = async ({
  userId,
  snapshot,
}: {
  userId: string;
  snapshot: Record<string, unknown>;
}) => {
  const { mediaFileIds, promptIds } = collectSnapshotAssociationIds(snapshot);
  const { generationIds, runtimeRequestIds } = collectSnapshotGenerationAuthorityKeys(snapshot);
  const [ownedMediaFileIds, ownedPromptIds, ownedGenerationIds] = await Promise.all([
    resolveOwnedIds({
      table: "media_files",
      idColumn: "id",
      userId,
      ids: mediaFileIds,
    }),
    resolveOwnedIds({
      table: "media_prompts",
      idColumn: "id",
      userId,
      ids: promptIds,
    }),
    resolveOwnedGenerationIds({
      userId,
      generationIds,
      runtimeRequestIds,
    }),
  ]);

  return {
    ownedMediaFileIds,
    ownedPromptIds,
    ownedGenerationIds,
  };
};

const resolveOwnedSnapshotAssociationResults = async ({
  userId,
  mediaFileIds,
  promptIds,
  generationIds,
  runtimeRequestIds,
  stage,
}: {
  userId: string;
  mediaFileIds: string[];
  promptIds: string[];
  generationIds: string[];
  runtimeRequestIds: string[];
  stage: string;
}): Promise<ProjectWorkspaceOwnedAssociationResults> => {
  const [mediaResult, promptResult, generationResult] = await Promise.allSettled([
    withProjectWorkspaceBestEffortTimeout(
      resolveOwnedIds({
        table: "media_files",
        idColumn: "id",
        userId,
        ids: mediaFileIds,
      }),
      `${stage} media`,
      PROJECT_WORKSPACE_OWNED_ID_RESOLUTION_TIMEOUT_MS
    ),
    withProjectWorkspaceBestEffortTimeout(
      resolveOwnedIds({
        table: "media_prompts",
        idColumn: "id",
        userId,
        ids: promptIds,
      }),
      `${stage} prompt`,
      PROJECT_WORKSPACE_OWNED_ID_RESOLUTION_TIMEOUT_MS
    ),
    withProjectWorkspaceBestEffortTimeout(
      resolveOwnedGenerationIds({
        userId,
        generationIds,
        runtimeRequestIds,
      }),
      `${stage} generation`,
      PROJECT_WORKSPACE_OWNED_ID_RESOLUTION_TIMEOUT_MS
    ),
  ]);

  return [mediaResult, promptResult, generationResult];
};

export const resolveOwnedSnapshotAssociationIdsForWrite = async ({
  userId,
  snapshot,
}: {
  userId: string;
  snapshot: Record<string, unknown>;
}): Promise<{
  ownedMediaFileIds: string[];
  ownedPromptIds: string[];
  ownedGenerationIds: string[];
  failedAuthorities: string[];
  failureMessages: string[];
}> => {
  const { mediaFileIds, promptIds } = collectSnapshotAssociationIds(snapshot);
  const { generationIds, runtimeRequestIds } = collectSnapshotGenerationAuthorityKeys(snapshot);
  const settledResults = await resolveOwnedSnapshotAssociationResults({
    userId,
    mediaFileIds,
    promptIds,
    generationIds,
    runtimeRequestIds,
    stage: "owned id resolution",
  });
  const [mediaResult, promptResult, generationResult] = settledResults;

  const failedAuthorities: string[] = [];
  const failureMessages: string[] = [];
  const resolveSettledIds = ({
    result,
    authority,
  }: {
    result: PromiseSettledResult<string[]>;
    authority: string;
  }): string[] => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    failedAuthorities.push(authority);
    failureMessages.push(toErrorMessage(result.reason, `${authority} ownership unavailable`));
    return [];
  };

  return {
    ownedMediaFileIds: resolveSettledIds({
      result: mediaResult,
      authority: "media",
    }),
    ownedPromptIds: resolveSettledIds({
      result: promptResult,
      authority: "prompt",
    }),
    ownedGenerationIds: resolveSettledIds({
      result: generationResult,
      authority: "generation",
    }),
    failedAuthorities,
    failureMessages,
  };
};

export const resolveOwnedSnapshotAssociationIdsForRead = async ({
  userId,
  snapshot,
}: {
  userId: string;
  snapshot: Record<string, unknown>;
}): Promise<{
  ownedMediaFileIds: string[];
  ownedPromptIds: string[];
  ownedGenerationIds: string[];
  failedAuthorities: string[];
  failureMessages: string[];
}> => {
  const { mediaFileIds, promptIds } = collectSnapshotAssociationIds(snapshot);
  const { generationIds, runtimeRequestIds } = collectSnapshotGenerationAuthorityKeys(snapshot);
  const settledResults = await resolveOwnedSnapshotAssociationResults({
    userId,
    mediaFileIds,
    promptIds,
    generationIds,
    runtimeRequestIds,
    stage: "read owned id resolution",
  });
  const [mediaResult, promptResult, generationResult] = settledResults;

  const failedAuthorities: string[] = [];
  const failureMessages: string[] = [];
  const resolveSettledIds = ({
    result,
    authority,
  }: {
    result: PromiseSettledResult<string[]>;
    authority: string;
  }): string[] => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    failedAuthorities.push(authority);
    failureMessages.push(toErrorMessage(result.reason, `${authority} ownership unavailable`));
    return [];
  };

  return {
    ownedMediaFileIds: resolveSettledIds({
      result: mediaResult,
      authority: "media",
    }),
    ownedPromptIds: resolveSettledIds({
      result: promptResult,
      authority: "prompt",
    }),
    ownedGenerationIds: resolveSettledIds({
      result: generationResult,
      authority: "generation",
    }),
    failedAuthorities,
    failureMessages,
  };
};

export const backfillProjectAssetAssociationsForSnapshot = async ({
  userId,
  projectId,
  snapshot,
  ownedMediaFileIds,
  ownedPromptIds,
  ownedGenerationIds,
}: {
  userId: string;
  projectId: string;
  snapshot: Record<string, unknown>;
  ownedMediaFileIds?: string[];
  ownedPromptIds?: string[];
  ownedGenerationIds?: string[];
}): Promise<void> => {
  const resolvedOwnedIds =
    ownedMediaFileIds && ownedPromptIds
      ? { ownedMediaFileIds, ownedPromptIds }
      : await resolveOwnedSnapshotAssociationIds({ userId, snapshot });

  const supabaseAdmin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  if (resolvedOwnedIds.ownedMediaFileIds.length > 0) {
    const { error } = await supabaseAdmin.from("project_media_items").upsert(
      resolvedOwnedIds.ownedMediaFileIds.map((mediaFileId) => ({
        project_id: projectId,
        media_file_id: mediaFileId,
        user_id: userId,
        updated_at: nowIso,
      })),
      {
        onConflict: "project_id,media_file_id",
      }
    );
    if (error) {
      throw new Error(error.message || "Failed to backfill project media associations");
    }
  }

  if (resolvedOwnedIds.ownedPromptIds.length > 0) {
    const { error } = await supabaseAdmin.from("project_prompt_items").upsert(
      resolvedOwnedIds.ownedPromptIds.map((promptId) => ({
        project_id: projectId,
        prompt_id: promptId,
        user_id: userId,
        updated_at: nowIso,
      })),
      {
        onConflict: "project_id,prompt_id",
      }
    );
    if (error) {
      throw new Error(error.message || "Failed to backfill project prompt associations");
    }
  }

  try {
    await backfillProjectGenerationAssociationsForSnapshot({
      userId,
      projectId,
      snapshot,
      ownedGenerationIds,
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, "Failed to backfill project generation associations"));
  }
};
