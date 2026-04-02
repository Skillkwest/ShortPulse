import { getSupabaseAdmin } from "./supabaseAdmin";
import { readGenerationProjectionStatusContext } from "./generationProjection";
import { readPersistedGenerationOutputs } from "./generationOutputs";

type PersistedResultsParams = {
  userId: string;
  requestId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
};

export type PersistedGenerationStatusContext = {
  generationId: string | null;
  resultUrls: string[];
  taskState?: string | null;
  errorMessageShort?: string | null;
  errorDetail?: string | null;
};

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toResultUrlList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        return trimmed.length ? trimmed : null;
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const candidates = [row.url, row.download_url, row.video_url, row.image_url, row.file_url];
      for (const candidate of candidates) {
        if (typeof candidate !== "string") continue;
        const trimmed = candidate.trim();
        if (trimmed.length) return trimmed;
      }
      return null;
    })
    .filter((url): url is string => Boolean(url));
};

const dedupeUrls = (value: string[]): string[] => Array.from(new Set(value));

export const readPersistedResultUrlsFromMetadata = (metadata: unknown): string[] => {
  const rowMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : null;
  if (!rowMetadata) return [];

  const directUrls = dedupeUrls(toResultUrlList(rowMetadata.result_urls ?? rowMetadata.resultUrls));
  if (directUrls.length) return directUrls;
  return dedupeUrls(toResultUrlList(rowMetadata.media_urls ?? rowMetadata.mediaUrls));
};

export const buildPersistedCompletedPayload = ({
  requestId,
  resultUrls,
  generationId,
}: {
  requestId: string;
  resultUrls: string[];
  generationId?: string | null;
}) => ({
  request_id: requestId,
  ...(typeof generationId === "string" && generationId.trim().length > 0
    ? { generationId: generationId.trim() }
    : {}),
  status: "completed",
  state: "completed",
  resultUrls,
  result_urls: resultUrls,
  videos: resultUrls.map((url) => ({ url })),
});

export const readPersistedGenerationStatusContext = async ({
  userId,
  requestId,
  supabaseAdmin,
}: PersistedResultsParams): Promise<PersistedGenerationStatusContext> => {
  let adminClient = supabaseAdmin;
  if (!adminClient) {
    try {
      adminClient = getSupabaseAdmin();
    } catch {
      return { generationId: null, resultUrls: [] };
    }
  }

  try {
    const projectionContext = await readGenerationProjectionStatusContext({
      userId,
      requestId,
      supabaseAdmin: adminClient,
    }).catch(() => null);
    if (projectionContext?.resultUrls.length) {
      return {
        generationId: projectionContext.generationId,
        resultUrls: projectionContext.resultUrls,
        taskState: projectionContext.taskState,
        errorMessageShort: projectionContext.errorMessageShort,
        errorDetail: projectionContext.errorDetail,
      };
    }
    if (projectionContext?.taskState === "fail") {
      return {
        generationId: projectionContext.generationId,
        resultUrls: [],
        taskState: projectionContext.taskState,
        errorMessageShort: projectionContext.errorMessageShort,
        errorDetail: projectionContext.errorDetail,
      };
    }

    const { data, error } = await adminClient
      .from("ai_generations")
      .select("id, status, metadata, created_at")
      .eq("user_id", userId)
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error || !Array.isArray(data) || !data.length) {
      return { generationId: null, resultUrls: [] };
    }

    let latestGenerationId: string | null = null;
    for (const item of data) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      const generationId = asOptionalString(row.id);
      if (!latestGenerationId && generationId) {
        latestGenerationId = generationId;
      }
      const status = typeof row.status === "string" ? row.status.trim().toLowerCase() : null;
      if (status !== "success") continue;
      if (generationId) {
        try {
          const outputRows = await readPersistedGenerationOutputs({
            generationId,
            userId,
            supabaseAdmin: adminClient,
          });
          if (outputRows.length) {
            return {
              generationId,
              resultUrls: outputRows.map((row) => row.resultUrl),
            };
          }
        } catch {
          // fall back to compatibility metadata when canonical output reads fail
        }
      }
      const urls = readPersistedResultUrlsFromMetadata(row.metadata);
      if (urls.length) return { generationId, resultUrls: urls };
    }
    return { generationId: latestGenerationId, resultUrls: [] };
  } catch {
    return { generationId: null, resultUrls: [] };
  }
};

export const readPersistedSuccessResultUrls = async ({
  userId,
  requestId,
  supabaseAdmin,
}: PersistedResultsParams): Promise<string[]> => {
  const context = await readPersistedGenerationStatusContext({
    userId,
    requestId,
    supabaseAdmin,
  });
  return context.resultUrls;
};
