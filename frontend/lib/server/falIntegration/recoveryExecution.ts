/**
 * Shared Fal generation recovery execution engine.
 * Centralizes retrieval, persistence, settlement, and lifecycle transitions.
 */
import { randomUUID } from "crypto";
import { assertUserScopedMediaStoragePath } from "../../mediaStoragePath";
import { settleGenerationOutcome } from "../api/generationBilling";
import { readFalRuntimeFlags } from "../api/falRuntimeFlags";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  asString,
  extractResponseUrl,
  hasMediaPayload,
  normalizeStatus,
  toRecord,
} from "./falAdapter";
import type { ResultProbeCandidate, StatusProbeCandidate } from "./contracts";
import { selectBestResultCandidate, selectBestStatusCandidate } from "./retrievalEngine";
import { isLegalGenerationTransition, normalizeGenerationLifecycleState } from "./stateMachine";

type JsonObject = Record<string, unknown>;

type GenerationRow = {
  id: string;
  user_id: string;
  request_id: string | null;
  model_id: string;
  provider: string;
  mode: string;
  prompt_text: string;
  status: string;
  metadata: JsonObject;
  recovery_attempts: number;
  failure_reason_code: string | null;
  recovery_state: string;
  completed_at: string | null;
};

type JsonReadResult = {
  ok: boolean;
  status: number;
  json: JsonObject;
};

export type RecoveryProbeState = "running" | "failed" | "completed";
export type RecoveryActor = "reconciler" | "admin_replay" | "webhook" | "status_proxy";
export type RecoveryResultState =
  | "recovered"
  | "already_persisted"
  | "no_media"
  | "provider_running"
  | "provider_failed"
  | "exhausted"
  | "skipped"
  | "missing_generation";

export type RecoveryObservation = {
  state: RecoveryProbeState;
  payload: JsonObject | null;
  mediaUrls: string[];
};

export type RecoveryExecutionResult = {
  ok: boolean;
  state: RecoveryResultState;
  generationId: string | null;
  requestId: string | null;
  mediaFileIds: string[];
  mediaUrls: string[];
  processed: boolean;
  note?: string;
};

type ExecuteRecoveryInput = {
  actor: RecoveryActor;
  generationId?: string | null;
  requestId?: string | null;
  userId?: string | null;
  maxAttempts?: number;
  observation?: RecoveryObservation | null;
  routeLabel: string;
};

const MEDIA_BUCKET = "media_library";
const FETCH_TIMEOUT_MS = 60000;
const FETCH_RETRY_ATTEMPTS = 2;
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v"]);

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

const completedStatuses = new Set(["completed", "succeeded", "success", "done", "ok"]);
const failedStatuses = new Set(["failed", "error", "cancelled", "canceled"]);

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const parseGenerationRow = (value: unknown): GenerationRow | null => {
  const row = asObject(value);
  const id = asString(row.id);
  const userId = asString(row.user_id);
  const modelId = asString(row.model_id);
  const provider = asString(row.provider);
  const mode = asString(row.mode);
  const promptText = asString(row.prompt_text);
  const status = asString(row.status);
  const recoveryState = asString(row.recovery_state) ?? "none";
  if (!id || !userId || !modelId || !provider || !mode || !promptText || !status) {
    return null;
  }
  return {
    id,
    user_id: userId,
    request_id: asString(row.request_id),
    model_id: modelId,
    provider,
    mode,
    prompt_text: promptText,
    status,
    metadata: asObject(row.metadata),
    recovery_attempts: typeof row.recovery_attempts === "number" ? row.recovery_attempts : 0,
    failure_reason_code: asString(row.failure_reason_code),
    recovery_state: recoveryState,
    completed_at: asString(row.completed_at),
  };
};

const sanitizeFilename = (value: string): string => value.replace(/[^\w.-]+/g, "_");

const clampPrompt = (value?: string | null): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "ai-studio-generation";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48).trim()}...` : trimmed;
};

const extensionFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split("/").pop() ?? "";
    const ext = base.includes(".") ? (base.split(".").pop() ?? "") : "";
    return ext.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  } catch {
    return "";
  }
};

const resolveFileType = (contentType: string | null, url: string): "image" | "video" => {
  const normalizedType = (contentType ?? "").toLowerCase();
  if (normalizedType.startsWith("video/")) return "video";
  if (normalizedType.startsWith("image/")) return "image";
  const ext = extensionFromUrl(url);
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "image";
};

const resolveExtension = (contentType: string | null, url: string): string => {
  const normalizedType = (contentType ?? "").toLowerCase();
  if (normalizedType && CONTENT_TYPE_EXTENSION[normalizedType]) {
    return CONTENT_TYPE_EXTENSION[normalizedType];
  }
  const ext = extensionFromUrl(url);
  if (ext) return ext;
  return normalizedType.startsWith("video/") ? "mp4" : "png";
};

const readJsonSafe = async (response: Response): Promise<JsonReadResult> => {
  const text = await response.text();
  if (!text) return { ok: response.ok, status: response.status, json: {} };
  try {
    const parsed = JSON.parse(text);
    return { ok: response.ok, status: response.status, json: asObject(parsed) };
  } catch {
    return {
      ok: response.ok,
      status: response.status,
      json: { raw: text.slice(0, 4000) },
    };
  }
};

const extractUrlObjects = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return asString(item);
      const record = asObject(item);
      return (
        asString(record.url) ||
        asString(record.download_url) ||
        asString(record.video_url) ||
        asString(record.image_url) ||
        asString(record.file_url)
      );
    })
    .filter((url): url is string => Boolean(url));
};

const collectCandidates = (payload: JsonObject): JsonObject[] => {
  const data = asObject(payload.data);
  const output = asObject(payload.output);
  const result = asObject(payload.result);
  const response = asObject(payload.response);
  const rootPayload = asObject(payload.payload);
  return [
    payload,
    rootPayload,
    data,
    output,
    result,
    response,
    asObject(data.result),
    asObject(result.data),
    asObject(response.result),
    asObject(rootPayload.result),
  ].filter((item) => Object.keys(item).length > 0);
};

const extractMediaUrls = (payload: JsonObject): string[] => {
  const candidates = collectCandidates(payload);
  for (const candidate of candidates) {
    const fromImages = extractUrlObjects(candidate.images);
    if (fromImages.length) return fromImages;
    const fromVideos = extractUrlObjects(candidate.videos);
    if (fromVideos.length) return fromVideos;
    const fromOutputs = extractUrlObjects(candidate.outputs);
    if (fromOutputs.length) return fromOutputs;
    const fromArtifacts = extractUrlObjects(candidate.artifacts);
    if (fromArtifacts.length) return fromArtifacts;
    const fromResultUrls = extractUrlObjects(
      candidate.result_urls ?? candidate.resultUrls ?? candidate.image_urls ?? candidate.video_urls
    );
    if (fromResultUrls.length) return fromResultUrls;

    const mediaUrl =
      asString(candidate.url) ||
      asString(candidate.video) ||
      asString(candidate.image) ||
      asString(asObject(candidate.video).url) ||
      asString(asObject(candidate.image).url) ||
      asString(candidate.video_url) ||
      asString(candidate.image_url) ||
      asString(asObject(asObject(candidate.assets).video).url) ||
      asString(asObject(asObject(candidate.assets).image).url) ||
      asString(asObject(asObject(candidate.assets).video).download_url) ||
      asString(asObject(asObject(candidate.assets).image).download_url) ||
      asString(candidate.file_url) ||
      asString(candidate.media_url) ||
      asString(candidate.download_url);
    if (mediaUrl) return [mediaUrl];
  }
  return [];
};

const resolveQueueBaseUrlsForModel = (modelId: string): string[] => {
  switch (modelId) {
    case "fal/flux-2":
      return ["https://queue.fal.run/fal-ai/flux-2/requests"];
    case "fal/flux-2/edit":
      return [
        "https://queue.fal.run/fal-ai/flux-2/requests",
        "https://queue.fal.run/fal-ai/flux-2/edit/requests",
      ];
    case "fal-ai/flux-2/klein/9b":
      return [
        "https://queue.fal.run/fal-ai/flux-2/requests",
        "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests",
      ];
    case "fal/flux-2-pro":
      return ["https://queue.fal.run/fal-ai/flux-2-pro/requests"];
    case "fal/flux-2-pro/edit":
      return [
        "https://queue.fal.run/fal-ai/flux-2-pro/requests",
        "https://queue.fal.run/fal-ai/flux-2-pro/edit/requests",
      ];
    case "fal-ai/nano-banana":
      return ["https://queue.fal.run/fal-ai/nano-banana/requests"];
    case "fal-ai/nano-banana/edit":
      return [
        "https://queue.fal.run/fal-ai/nano-banana/requests",
        "https://queue.fal.run/fal-ai/nano-banana/edit/requests",
      ];
    case "fal-ai/nano-banana-pro":
      return ["https://queue.fal.run/fal-ai/nano-banana-pro/requests"];
    case "fal-ai/nano-banana-pro/edit":
      return [
        "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
        "https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests",
      ];
    case "fal-ai/bytedance/seedream/v4.5/text-to-image":
    case "fal-ai/bytedance/seedream/v4.5/edit":
      return [
        "https://queue.fal.run/fal-ai/bytedance/requests",
        "https://queue.fal.run/fal-ai/bytedance/seedream/requests",
        "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/requests",
        "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
        "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests",
      ];
    case "fal-ai/bytedance/seedance/v1.5/pro/text-to-video":
      return [
        "https://queue.fal.run/fal-ai/bytedance/requests",
        "https://queue.fal.run/fal-ai/bytedance/seedance/requests",
        "https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/text-to-video/requests",
      ];
    case "fal-ai/bytedance/seedance/v1.5/pro/image-to-video":
      return [
        "https://queue.fal.run/fal-ai/bytedance/requests",
        "https://queue.fal.run/fal-ai/bytedance/seedance/requests",
        "https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/image-to-video/requests",
      ];
    case "fal-ai/kling-video/v3/pro/text-to-video":
      return [
        "https://queue.fal.run/fal-ai/kling-video/requests",
        "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video/requests",
      ];
    case "fal-ai/kling-video/v3/pro/image-to-video":
      return [
        "https://queue.fal.run/fal-ai/kling-video/requests",
        "https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video/requests",
      ];
    case "fal-ai/veo3.1":
      return [
        "https://queue.fal.run/fal-ai/veo3.1/requests",
        "https://queue.fal.run/fal-ai/veo3.1/first-last-frame-to-video/requests",
        "https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests",
      ];
    case "fal-ai/veo3.1/image-to-video":
      return [
        "https://queue.fal.run/fal-ai/veo3.1/requests",
        "https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests",
        "https://queue.fal.run/fal-ai/veo3.1/reference-to-video/requests",
      ];
    case "fal-ai/sora-2/text-to-video/pro":
      return [
        "https://queue.fal.run/fal-ai/sora-2/requests",
        "https://queue.fal.run/fal-ai/sora-2/text-to-video/pro/requests",
      ];
    default:
      return [`https://queue.fal.run/${modelId}/requests`];
  }
};

const fetchBufferWithRetry = async (
  url: string
): Promise<{ buffer: Buffer; contentType: string | null }> => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= FETCH_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { method: "GET", signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Fetch failed (${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type");
      return { buffer: Buffer.from(arrayBuffer), contentType };
    } catch (error) {
      lastError = error;
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const isRetryable =
        message.includes("aborted") ||
        message.includes("aborterror") ||
        message.includes("timed out") ||
        message.includes("econnreset") ||
        message.includes("fetch failed");
      if (attempt < FETCH_RETRY_ATTEMPTS && isRetryable) {
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw (lastError as Error | null) ?? new Error("Unable to fetch media file.");
};

const readGenerationRow = async ({
  generationId,
  requestId,
  userId,
}: {
  generationId?: string | null;
  requestId?: string | null;
  userId?: string | null;
}): Promise<GenerationRow | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const selectFields = [
    "id",
    "user_id",
    "request_id",
    "model_id",
    "provider",
    "mode",
    "prompt_text",
    "status",
    "metadata",
    "recovery_attempts",
    "recovery_state",
    "failure_reason_code",
    "completed_at",
  ].join(", ");
  if (generationId) {
    let query = supabaseAdmin.from("ai_generations").select(selectFields).eq("id", generationId);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    return parseGenerationRow(row);
  }
  if (!requestId) return null;
  let query = supabaseAdmin.from("ai_generations").select(selectFields).eq("request_id", requestId);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return parseGenerationRow(row);
};

const readExistingMediaRows = async (
  generationId: string
): Promise<Array<{ id: string; index: number | null }>> => {
  const { data, error } = await getSupabaseAdmin()
    .from("media_files")
    .select("id, metadata")
    .eq("source_ref", generationId)
    .eq("source", "ai_studio")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  const rows: Array<{ id: string; index: number | null }> = [];
  for (const rawRow of data) {
    const row = asObject(rawRow);
    const id = asString(row.id);
    if (!id) continue;
    const rawIndex = Number.parseInt(
      String(asObject(row.metadata).generation_output_index ?? ""),
      10
    );
    rows.push({
      id,
      index: Number.isFinite(rawIndex) ? rawIndex : null,
    });
  }
  return rows;
};

const persistMediaFilesForGeneration = async ({
  generation,
  mediaUrls,
}: {
  generation: GenerationRow;
  mediaUrls: string[];
}): Promise<string[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const existingRows = await readExistingMediaRows(generation.id);
  if (existingRows.length && existingRows.length >= mediaUrls.length) {
    return existingRows.map((row) => row.id);
  }

  const existingByIndex = new Map<number, string>();
  for (const row of existingRows) {
    if (row.index !== null) {
      existingByIndex.set(row.index, row.id);
    }
  }

  const mediaFileIds: string[] = [];
  const promptBase = clampPrompt(generation.prompt_text);
  const generationMetadata = asObject(generation.metadata);
  const generationTraceId = asString(generationMetadata.generation_trace_id);
  const submissionTraceId = asString(generationMetadata.submission_trace_id);

  for (let index = 0; index < mediaUrls.length; index += 1) {
    const existingId = existingByIndex.get(index);
    if (existingId) {
      mediaFileIds.push(existingId);
      continue;
    }
    const mediaUrl = mediaUrls[index];
    const { buffer, contentType } = await fetchBufferWithRetry(mediaUrl);
    const fileType = resolveFileType(contentType, mediaUrl);
    const extension = resolveExtension(contentType, mediaUrl);
    const storagePath = assertUserScopedMediaStoragePath({
      path: `${generation.user_id}/generations/${fileType === "video" ? "videos" : "images"}/${randomUUID()}-${index}.${extension}`,
      userId: generation.user_id,
      label: "Recovery execution media storage path",
    });

    const { error: uploadError } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, buffer, {
        contentType: contentType ?? undefined,
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const filename = sanitizeFilename(`${promptBase}-${index + 1}.${extension}`);
    const { data, error: insertError } = await supabaseAdmin
      .from("media_files")
      .insert({
        user_id: generation.user_id,
        filename,
        storage_path: storagePath,
        file_type: fileType,
        file_size: buffer.byteLength,
        source: "ai_studio",
        source_ref: generation.id,
        prompt_id: null,
        metadata: {
          provider: generation.provider,
          model_id: generation.model_id,
          prompt: generation.prompt_text,
          generation_output_index: index,
          task_id: generation.request_id,
          generation_trace_id: generationTraceId,
          submission_trace_id: submissionTraceId,
          recovery_execution: true,
        },
      })
      .select("id")
      .single();
    if (insertError) {
      const duplicateError =
        insertError.code === "23505" ||
        String(insertError.message ?? "")
          .toLowerCase()
          .includes("duplicate");
      if (duplicateError) {
        const { data: existingData } = await supabaseAdmin
          .from("media_files")
          .select("id")
          .eq("source_ref", generation.id)
          .eq("source", "ai_studio")
          .contains("metadata", { generation_output_index: index })
          .limit(1)
          .maybeSingle();
        const existingRowId = asString(asObject(existingData).id);
        if (existingRowId) {
          mediaFileIds.push(existingRowId);
          continue;
        }
      }
      throw new Error(`media_files insert failed: ${insertError.message}`);
    }
    const mediaFileId = asString(asObject(data).id);
    if (mediaFileId) mediaFileIds.push(mediaFileId);
  }

  await supabaseAdmin.from("media_events").insert({
    user_id: generation.user_id,
    event_type: "generation_saved",
    entity_type: "ai_generation",
    entity_id: generation.id,
    metadata: {
      recovery_execution: true,
      request_id: generation.request_id,
      media_file_ids: mediaFileIds,
      model_id: generation.model_id,
      provider: generation.provider,
    },
  });

  return mediaFileIds;
};

const probeProviderResult = async ({
  requestId,
  modelId,
  apiKey,
}: {
  requestId: string;
  modelId: string;
  apiKey: string;
}): Promise<RecoveryObservation> => {
  const queueBaseUrls = resolveQueueBaseUrlsForModel(modelId);
  const responseUrlSet = new Set<string>();
  const statusCandidates: StatusProbeCandidate[] = [];
  const resultCandidates: ResultProbeCandidate[] = [];
  const payloadByStatusIndex = new Map<number, JsonObject>();
  const payloadByResultIndex = new Map<number, JsonObject>();

  for (const [index, baseUrl] of queueBaseUrls.entries()) {
    const statusResponse = await fetch(`${baseUrl}/${requestId}/status`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
    });
    const statusData = await readJsonSafe(statusResponse);
    const payload = Object.keys(statusData.json).length ? statusData.json : {};
    const statusValue = normalizeStatus(payload.status) ?? normalizeStatus(toRecord(payload).state);
    const isCompleted = Boolean(statusValue && completedStatuses.has(statusValue));
    const isFailed = Boolean(statusValue && failedStatuses.has(statusValue));
    statusCandidates.push({
      index,
      baseUrl,
      isJson: true,
      isRetryableAlias: statusResponse.status === 404 || statusResponse.status === 405,
      httpStatus: statusResponse.status,
      isHttpOk: statusResponse.ok,
      status: statusValue,
      isTerminal: isCompleted || isFailed,
      isCompleted,
      isFailed,
      hasResponseUrl: Boolean(extractResponseUrl(payload)),
      hasMedia: hasMediaPayload(payload),
    });
    payloadByStatusIndex.set(index, payload);
    const responseUrl = extractResponseUrl(payload);
    if (responseUrl) responseUrlSet.add(responseUrl);
  }

  const bestStatus = selectBestStatusCandidate(statusCandidates);
  if (bestStatus?.hasMedia) {
    const payload = payloadByStatusIndex.get(bestStatus.index) ?? null;
    if (payload) {
      return { state: "completed", payload, mediaUrls: extractMediaUrls(payload) };
    }
  }

  for (const responseUrl of responseUrlSet) {
    const responseProbe = await fetch(responseUrl, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
    });
    const responseData = await readJsonSafe(responseProbe);
    if (!responseProbe.ok || !hasMediaPayload(responseData.json)) continue;
    return {
      state: "completed",
      payload: responseData.json,
      mediaUrls: extractMediaUrls(responseData.json),
    };
  }

  for (const [index, baseUrl] of queueBaseUrls.entries()) {
    const resultResponse = await fetch(`${baseUrl}/${requestId}`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
    });
    const resultData = await readJsonSafe(resultResponse);
    const payload = Object.keys(resultData.json).length ? resultData.json : {};
    const statusValue = normalizeStatus(payload.status) ?? normalizeStatus(toRecord(payload).state);
    const hasError = Boolean(asString(payload.error)) || Boolean(asString(payload.detail));
    resultCandidates.push({
      index,
      baseUrl,
      isJson: true,
      isRetryableAlias: resultResponse.status === 404 || resultResponse.status === 405,
      httpStatus: resultResponse.status,
      isHttpOk: resultResponse.ok,
      status: statusValue,
      hasError,
      hasMedia: hasMediaPayload(payload),
    });
    payloadByResultIndex.set(index, payload);
  }

  const bestResult = selectBestResultCandidate(resultCandidates);
  if (bestResult?.hasMedia) {
    const payload = payloadByResultIndex.get(bestResult.index) ?? null;
    if (payload) {
      return { state: "completed", payload, mediaUrls: extractMediaUrls(payload) };
    }
  }

  if (bestStatus?.isFailed || (bestResult?.status && failedStatuses.has(bestResult.status))) {
    return { state: "failed", payload: null, mediaUrls: [] };
  }
  return { state: "running", payload: null, mediaUrls: [] };
};

const updateGenerationRecoveryState = async ({
  generation,
  updates,
}: {
  generation: GenerationRow;
  updates: Record<string, unknown>;
}) => {
  const { error } = await getSupabaseAdmin()
    .from("ai_generations")
    .update(updates)
    .eq("id", generation.id)
    .eq("user_id", generation.user_id);
  if (error) throw error;
};

const resolveRetryDelaySeconds = (attempts: number): number => {
  const base = 120;
  const scaled = base * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(900, Math.round(scaled));
};

const canTransitionToSuccess = (generation: GenerationRow): boolean => {
  const currentState = normalizeGenerationLifecycleState(generation.status);
  if (!currentState) return false;
  if (currentState === "fail") {
    const reason = (generation.failure_reason_code ?? "").toLowerCase();
    const recovery = (generation.recovery_state ?? "").toLowerCase();
    if (
      reason === "terminal_success_no_media" &&
      (recovery === "queued" || recovery === "recovering" || recovery === "recovered")
    ) {
      return true;
    }
  }
  return isLegalGenerationTransition({ from: currentState, to: "success" });
};

/**
 * Execute shared Fal recovery flow for reconciler, admin replay, webhook, and status proxy.
 */
export const executeGenerationRecovery = async ({
  actor,
  generationId,
  requestId,
  userId,
  maxAttempts,
  observation,
  routeLabel,
}: ExecuteRecoveryInput): Promise<RecoveryExecutionResult> => {
  const generation = await readGenerationRow({ generationId, requestId, userId });
  if (!generation) {
    return {
      ok: false,
      state: "missing_generation",
      generationId: null,
      requestId: requestId ?? null,
      mediaFileIds: [],
      mediaUrls: [],
      processed: false,
      note: "generation_not_found",
    };
  }
  const effectiveMaxAttempts = Math.max(
    maxAttempts ?? readFalRuntimeFlags().reconcilerMaxAttempts,
    1
  );
  const attempts = Number(generation.recovery_attempts ?? 0);
  const nowIso = new Date().toISOString();

  if (generation.status.toLowerCase() === "success") {
    const existingRows = await readExistingMediaRows(generation.id);
    if (existingRows.length) {
      return {
        ok: true,
        state: "already_persisted",
        generationId: generation.id,
        requestId: generation.request_id,
        mediaFileIds: existingRows.map((row) => row.id),
        mediaUrls: [],
        processed: false,
      };
    }
  }

  if (!generation.request_id) {
    await updateGenerationRecoveryState({
      generation,
      updates: {
        recovery_state: "exhausted",
        failure_reason_code: "recovery_exhausted",
        next_recovery_at: null,
        last_recovery_at: nowIso,
      },
    });
    return {
      ok: true,
      state: "exhausted",
      generationId: generation.id,
      requestId: null,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
      note: "missing_request_id",
    };
  }

  const existingRows = await readExistingMediaRows(generation.id);
  if (existingRows.length) {
    await settleGenerationOutcome({
      userId: generation.user_id,
      providerRequestId: generation.request_id,
      outcome: "success",
      reason: "Recovered generation media already persisted.",
      routeLabel,
      detail: {
        actor,
        generation_id: generation.id,
        existing_media_count: existingRows.length,
      },
    });
    await updateGenerationRecoveryState({
      generation,
      updates: {
        status: "success",
        completed_at: generation.completed_at ?? nowIso,
        recovery_state: "recovered",
        next_recovery_at: null,
        last_recovery_at: nowIso,
        last_media_detected_at: nowIso,
        failure_reason_code: null,
      },
    });
    return {
      ok: true,
      state: "already_persisted",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: existingRows.map((row) => row.id),
      mediaUrls: [],
      processed: true,
    };
  }

  let currentObservation = observation ?? null;
  if (!currentObservation) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      throw new Error("FAL_KEY is not set on the server.");
    }
    currentObservation = await probeProviderResult({
      requestId: generation.request_id,
      modelId: generation.model_id,
      apiKey,
    });
  }

  const recoveredUrls = Array.from(
    new Set(
      [
        ...currentObservation.mediaUrls,
        ...(currentObservation.payload ? extractMediaUrls(currentObservation.payload) : []),
      ]
        .map((url) => url.trim())
        .filter((url) => Boolean(url))
    )
  );

  if (currentObservation.state === "running") {
    const nextDelaySeconds = resolveRetryDelaySeconds(Math.max(attempts, 1));
    await updateGenerationRecoveryState({
      generation,
      updates: {
        recovery_state: attempts >= effectiveMaxAttempts ? "exhausted" : "queued",
        failure_reason_code: attempts >= effectiveMaxAttempts ? "recovery_exhausted" : null,
        last_recovery_at: nowIso,
        next_recovery_at:
          attempts >= effectiveMaxAttempts
            ? null
            : new Date(Date.now() + nextDelaySeconds * 1000).toISOString(),
      },
    });
    return {
      ok: true,
      state: attempts >= effectiveMaxAttempts ? "exhausted" : "provider_running",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    };
  }

  if (currentObservation.state === "failed") {
    await settleGenerationOutcome({
      userId: generation.user_id,
      providerRequestId: generation.request_id,
      outcome: "fail",
      reason: "Provider reported failed state during recovery execution.",
      routeLabel,
      detail: {
        actor,
        generation_id: generation.id,
      },
    });
    await updateGenerationRecoveryState({
      generation,
      updates: {
        status: "fail",
        completed_at: nowIso,
        failure_reason_code: "provider_error",
        recovery_state: "exhausted",
        last_recovery_at: nowIso,
        next_recovery_at: null,
      },
    });
    return {
      ok: true,
      state: "provider_failed",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    };
  }

  if (!recoveredUrls.length) {
    await settleGenerationOutcome({
      userId: generation.user_id,
      providerRequestId: generation.request_id,
      outcome: "fail",
      reason: "Provider terminal success without media payload.",
      routeLabel,
      detail: {
        actor,
        generation_id: generation.id,
      },
    });
    const nextDelaySeconds = resolveRetryDelaySeconds(Math.max(attempts, 1));
    await updateGenerationRecoveryState({
      generation,
      updates: {
        status: "fail",
        completed_at: nowIso,
        failure_reason_code: "terminal_success_no_media",
        recovery_state: attempts >= effectiveMaxAttempts ? "exhausted" : "queued",
        last_recovery_at: nowIso,
        next_recovery_at:
          attempts >= effectiveMaxAttempts
            ? null
            : new Date(Date.now() + nextDelaySeconds * 1000).toISOString(),
      },
    });
    return {
      ok: true,
      state: attempts >= effectiveMaxAttempts ? "exhausted" : "no_media",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    };
  }

  if (!canTransitionToSuccess(generation)) {
    return {
      ok: true,
      state: "skipped",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: recoveredUrls,
      processed: false,
      note: "transition_blocked",
    };
  }

  const mediaFileIds = await persistMediaFilesForGeneration({
    generation,
    mediaUrls: recoveredUrls,
  });
  const metadata = asObject(generation.metadata);
  await settleGenerationOutcome({
    userId: generation.user_id,
    providerRequestId: generation.request_id,
    outcome: "success",
    reason: "Generation recovered with persisted media.",
    routeLabel,
    detail: {
      actor,
      generation_id: generation.id,
      media_file_count: mediaFileIds.length,
    },
  });
  await updateGenerationRecoveryState({
    generation,
    updates: {
      status: "success",
      completed_at: nowIso,
      metadata: {
        ...metadata,
        result_urls: recoveredUrls,
        media_file_ids: mediaFileIds,
        recovery_execution_at: nowIso,
        recovery_execution_actor: actor,
      },
      recovery_state: "recovered",
      last_recovery_at: nowIso,
      next_recovery_at: null,
      last_media_detected_at: nowIso,
      failure_reason_code: null,
    },
  });
  return {
    ok: true,
    state: "recovered",
    generationId: generation.id,
    requestId: generation.request_id,
    mediaFileIds,
    mediaUrls: recoveredUrls,
    processed: true,
  };
};
