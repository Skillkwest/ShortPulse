import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { assertUserScopedMediaStoragePath } from "../../../../lib/mediaStoragePath";
import {
  asString,
  extractResponseUrl,
  hasMediaPayload,
  normalizeStatus,
  toRecord,
} from "../../../../lib/server/falIntegration/falAdapter";
import {
  selectBestResultCandidate,
  selectBestStatusCandidate,
} from "../../../../lib/server/falIntegration/retrievalEngine";
import type {
  ResultProbeCandidate,
  StatusProbeCandidate,
} from "../../../../lib/server/falIntegration/contracts";

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
  recovery_attempts: number | null;
  completed_at: string | null;
};

type ReplayResponse = {
  ok: boolean;
  requestId: string | null;
  generationId: string | null;
  state: "recovered" | "already_persisted" | "no_media" | "provider_running" | "provider_failed";
  mediaFileIds: string[];
  mediaUrls: string[];
  details?: string;
};

type JsonReadResult = {
  ok: boolean;
  status: number;
  json: JsonObject;
};

const MEDIA_BUCKET = "media_library";
const FETCH_TIMEOUT_MS = 60000;
const FETCH_RETRY_ATTEMPTS = 2;

const completedStatuses = new Set(["completed", "succeeded", "success", "done"]);
const failedStatuses = new Set(["failed", "error", "cancelled", "canceled"]);

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

const readBodyValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

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
    recovery_attempts: typeof row.recovery_attempts === "number" ? row.recovery_attempts : null,
    completed_at: asString(row.completed_at),
  };
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
  return [
    payload,
    data,
    output,
    result,
    response,
    asObject(data.result),
    asObject(result.data),
    asObject(response.result),
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

const sanitizeFilename = (value: string): string => value.replace(/[^\w.-]+/g, "_");

const clampPrompt = (value?: string | null): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "ai-studio-generation";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48).trim()}...` : trimmed;
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

const probeProviderResult = async ({
  requestId,
  modelId,
  apiKey,
}: {
  requestId: string;
  modelId: string;
  apiKey: string;
}): Promise<{
  state: "running" | "failed" | "completed";
  payload: JsonObject | null;
  mediaUrls: string[];
}> => {
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
    const statusValue =
      normalizeStatus(statusData.json.status) ?? normalizeStatus(toRecord(statusData.json).state);
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
      hasResponseUrl: Boolean(extractResponseUrl(statusData.json)),
      hasMedia: hasMediaPayload(statusData.json),
    });
    payloadByStatusIndex.set(index, statusData.json);
    const responseUrl = extractResponseUrl(statusData.json);
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
    const statusValue =
      normalizeStatus(resultData.json.status) ?? normalizeStatus(toRecord(resultData.json).state);
    const hasError =
      Boolean(asString(resultData.json.error)) || Boolean(asString(resultData.json.detail));
    resultCandidates.push({
      index,
      baseUrl,
      isJson: true,
      isRetryableAlias: resultResponse.status === 404 || resultResponse.status === 405,
      httpStatus: resultResponse.status,
      isHttpOk: resultResponse.ok,
      status: statusValue,
      hasError,
      hasMedia: hasMediaPayload(resultData.json),
    });
    payloadByResultIndex.set(index, resultData.json);
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
  generationId,
  updates,
}: {
  generationId: string;
  updates: Record<string, unknown>;
}) => {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("ai_generations")
    .update(updates)
    .eq("id", generationId);
  if (error) throw error;
};

const readGenerationRow = async ({
  generationId,
  requestId,
}: {
  generationId: string | null;
  requestId: string | null;
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
    "completed_at",
  ].join(", ");
  if (generationId) {
    const { data, error } = await supabaseAdmin
      .from("ai_generations")
      .select(selectFields)
      .eq("id", generationId)
      .limit(1);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    return parseGenerationRow(row);
  }
  if (!requestId) return null;
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select(selectFields)
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return parseGenerationRow(row);
};

const readExistingMediaFileRows = async (generationId: string) => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("media_files")
    .select("id, source_ref")
    .eq("source_ref", generationId)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => asObject(row))
    .map((row) => asString(row.id))
    .filter((id): id is string => Boolean(id));
};

const persistMediaFilesForGeneration = async ({
  generation,
  mediaUrls,
}: {
  generation: GenerationRow;
  mediaUrls: string[];
}): Promise<string[]> => {
  const existingIds = await readExistingMediaFileRows(generation.id);
  if (existingIds.length) return existingIds;

  const supabaseAdmin = getSupabaseAdmin();
  const mediaFileIds: string[] = [];
  const promptBase = clampPrompt(generation.prompt_text);
  const generationMetadata = asObject(generation.metadata);
  const generationTraceId = asString(generationMetadata.generation_trace_id);
  const submissionTraceId = asString(generationMetadata.submission_trace_id);

  for (let index = 0; index < mediaUrls.length; index += 1) {
    const mediaUrl = mediaUrls[index];
    const { buffer, contentType } = await fetchBufferWithRetry(mediaUrl);
    const fileType = resolveFileType(contentType, mediaUrl);
    const extension = resolveExtension(contentType, mediaUrl);
    const storagePath = assertUserScopedMediaStoragePath({
      path: `${generation.user_id}/generations/${fileType === "video" ? "videos" : "images"}/${randomUUID()}-${index}.${extension}`,
      userId: generation.user_id,
      label: "Recovery replay media storage path",
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
          index,
          task_id: generation.request_id,
          generation_trace_id: generationTraceId,
          submission_trace_id: submissionTraceId,
          recovery_replay: true,
        },
      })
      .select("id")
      .single();
    if (insertError) {
      throw new Error(`media_files insert failed: ${insertError.message}`);
    }
    const mediaFileId = asString(asObject(data).id);
    if (mediaFileId) {
      mediaFileIds.push(mediaFileId);
    }
  }

  await supabaseAdmin.from("media_events").insert({
    user_id: generation.user_id,
    event_type: "generation_saved",
    entity_type: "ai_generation",
    entity_id: generation.id,
    metadata: {
      replay: true,
      request_id: generation.request_id,
      media_file_ids: mediaFileIds,
      model_id: generation.model_id,
      provider: generation.provider,
    },
  });

  return mediaFileIds;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReplayResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const generationIdRaw = readBodyValue(req.body?.generationId);
  const requestIdRaw = readBodyValue(req.body?.requestId);
  const generationId = generationIdRaw;
  const requestId = requestIdRaw;
  if (!generationId && !requestId) {
    return res.status(400).json({ error: "Provide generationId or requestId." });
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FAL_KEY is not set on the server." });
  }

  try {
    let generation = await readGenerationRow({
      generationId,
      requestId,
    });
    if (!generation && generationId && !requestId) {
      generation = await readGenerationRow({
        generationId: null,
        requestId: generationId,
      });
    }
    if (!generation) {
      return res.status(404).json({ error: "Generation not found." });
    }
    if (!generation.request_id) {
      return res.status(400).json({ error: "Generation has no provider request_id." });
    }
    if (!generation.provider.toLowerCase().includes("fal")) {
      return res.status(400).json({ error: "Replay currently supports Fal generations only." });
    }

    const existingMediaIds = await readExistingMediaFileRows(generation.id);
    if (existingMediaIds.length) {
      const nowIso = new Date().toISOString();
      const generationMetadata = asObject(generation.metadata);
      const mediaUrls = Array.isArray(generationMetadata.result_urls)
        ? generationMetadata.result_urls
            .map((value) => (typeof value === "string" ? value : null))
            .filter((value): value is string => Boolean(value))
        : [];
      await updateGenerationRecoveryState({
        generationId: generation.id,
        updates: {
          status: "success",
          completed_at: generation.completed_at ?? nowIso,
          metadata: {
            ...generationMetadata,
            media_file_ids: existingMediaIds,
            recovery_replay_at: nowIso,
            recovery_replay_by: adminUser.id,
          },
          recovery_state: "recovered",
          recovery_attempts: Number(generation.recovery_attempts ?? 0) + 1,
          last_recovery_at: nowIso,
          last_media_detected_at: nowIso,
        },
      });
      return res.status(200).json({
        ok: true,
        generationId: generation.id,
        requestId: generation.request_id,
        state: "already_persisted",
        mediaFileIds: existingMediaIds,
        mediaUrls,
      });
    }

    const providerProbe = await probeProviderResult({
      requestId: generation.request_id,
      modelId: generation.model_id,
      apiKey,
    });
    const nowIso = new Date().toISOString();
    if (providerProbe.state === "running") {
      await updateGenerationRecoveryState({
        generationId: generation.id,
        updates: {
          recovery_state: "queued",
          recovery_attempts: Number(generation.recovery_attempts ?? 0) + 1,
          last_recovery_at: nowIso,
          next_recovery_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        },
      });
      return res.status(200).json({
        ok: true,
        generationId: generation.id,
        requestId: generation.request_id,
        state: "provider_running",
        mediaFileIds: [],
        mediaUrls: [],
        details: "Provider still reports running/pending state.",
      });
    }

    if (providerProbe.state === "failed") {
      await updateGenerationRecoveryState({
        generationId: generation.id,
        updates: {
          status: "fail",
          completed_at: nowIso,
          failure_reason_code: "provider_error",
          recovery_state: "exhausted",
          recovery_attempts: Number(generation.recovery_attempts ?? 0) + 1,
          last_recovery_at: nowIso,
          next_recovery_at: null,
        },
      });
      return res.status(200).json({
        ok: true,
        generationId: generation.id,
        requestId: generation.request_id,
        state: "provider_failed",
        mediaFileIds: [],
        mediaUrls: [],
        details: "Provider reported failed state.",
      });
    }

    const recoveredUrls = providerProbe.mediaUrls.filter(
      (url) => typeof url === "string" && url.trim().length
    );
    if (!recoveredUrls.length) {
      await updateGenerationRecoveryState({
        generationId: generation.id,
        updates: {
          failure_reason_code: "terminal_success_no_media",
          recovery_state: "queued",
          recovery_attempts: Number(generation.recovery_attempts ?? 0) + 1,
          last_recovery_at: nowIso,
          next_recovery_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        },
      });
      return res.status(200).json({
        ok: true,
        generationId: generation.id,
        requestId: generation.request_id,
        state: "no_media",
        mediaFileIds: [],
        mediaUrls: [],
        details: "Provider completed but no media URL was extracted.",
      });
    }

    const mediaFileIds = await persistMediaFilesForGeneration({
      generation,
      mediaUrls: recoveredUrls,
    });
    const generationMetadata = asObject(generation.metadata);
    await updateGenerationRecoveryState({
      generationId: generation.id,
      updates: {
        status: "success",
        completed_at: nowIso,
        metadata: {
          ...generationMetadata,
          result_urls: recoveredUrls,
          media_file_ids: mediaFileIds,
          recovery_replay_at: nowIso,
          recovery_replay_by: adminUser.id,
        },
        recovery_state: "recovered",
        recovery_attempts: Number(generation.recovery_attempts ?? 0) + 1,
        last_recovery_at: nowIso,
        next_recovery_at: null,
        last_media_detected_at: nowIso,
        failure_reason_code: null,
      },
    });

    return res.status(200).json({
      ok: true,
      generationId: generation.id,
      requestId: generation.request_id,
      state: "recovered",
      mediaFileIds,
      mediaUrls: recoveredUrls,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      routeLabel: "admin.generation_recovery.replay",
      error,
      metadata: {
        generation_id: generationIdRaw ?? null,
        request_id: requestIdRaw ?? null,
      },
      user: adminUser,
    });
    return res.status(500).json({ error: "Failed to replay generation recovery." });
  }
}
