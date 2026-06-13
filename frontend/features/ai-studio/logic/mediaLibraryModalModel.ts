import {
  resolveMediaPreviewSignBudget,
  type MediaSignBudget,
} from "../../../lib/mediaPreviewRuntimePolicy";
import { normalizeAudioSourceMode } from "./audioSourceMode";
import type { StudioAudioSourceMode } from "../types";
import {
  buildMediaSearchOrClause as buildMediaSearchOrClauseShared,
  normalizeMediaSearchTerm as normalizeMediaSearchTermShared,
  withMediaSearchFilter as withMediaSearchFilterShared,
  withMediaTabFilter as withMediaTabFilterShared,
  withUserScopedPromptQuery as withUserScopedPromptQueryShared,
} from "../../media-library/logic/mediaQueryModel";

export type MediaFileRow = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path?: string;
  file_type: string;
  width?: number | null;
  height?: number | null;
  source?: string | null;
  source_ref?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
  companion_art_status?: string | null;
  companion_art_storage_path?: string | null;
  companion_art_url?: string | null;
  signedUrl?: string | null;
};

export type PromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode?: string | null;
  model_id?: string | null;
  source?: string | null;
  created_at?: string | null;
};

export type MediaTab =
  | "uploaded_images"
  | "uploaded_videos"
  | "private"
  | "saved_prompts"
  | "ai_generations";

export type MediaDataTab = Exclude<MediaTab, "saved_prompts">;

export type MediaCursor = {
  createdAt: string;
  id: string;
};

export type MediaTabCache = {
  rows: MediaFileRow[];
  nextCursor: MediaCursor | null;
  pagesLoaded: number;
  query: string;
  loadedAtMs: number | null;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

export type MediaTabRequestState = Record<MediaDataTab, number>;
export type MediaTabBooleanState = Record<MediaDataTab, boolean>;
export type MediaCardRefCallback = (node: HTMLElement | null) => void;
export type NavigatorWithConnection = Navigator & {
  connection?: {
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  };
};

export const BUCKET = "media_library";
export const PRIVATE_MEDIA_SOURCE = "private_upload";
export const PRIVATE_MEDIA_FOLDER = "private";
export const MEDIA_MODAL_PAGE_SIZE = 36;
export const MEDIA_MODAL_CACHE_TTL_MS = 60_000;
const MEDIA_MODAL_SIGN_SMALL_SCREEN_QUERY = "(max-width: 900px)";
const MEDIA_MODAL_SIGN_BUDGET_DESKTOP: MediaSignBudget = {
  initialSignLimit: 6,
  prefetchWindow: 10,
  signBatchSize: 4,
};
const MEDIA_MODAL_SIGN_BUDGET_SMALL_SCREEN: MediaSignBudget = {
  initialSignLimit: 5,
  prefetchWindow: 8,
  signBatchSize: 3,
};
const MEDIA_MODAL_SIGN_BUDGET_CONSTRAINED: MediaSignBudget = {
  initialSignLimit: 4,
  prefetchWindow: 6,
  signBatchSize: 2,
};
const NEXT_IMAGE_OPTIMIZER_PATH_PATTERN = /(?:^|\/)_next\/image\?/i;

export const isNextImageOptimizerUrl = (value: string | null | undefined): boolean => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && NEXT_IMAGE_OPTIMIZER_PATH_PATTERN.test(trimmed);
};

export const resolveNextImageOptimizerSourceUrl = (
  value: string | null | undefined
): string | null => {
  if (!isNextImageOptimizerUrl(value)) return null;
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed, "https://shortpulse.local");
    const source = parsed.searchParams.get("url");
    const resolved = source?.trim() ?? "";
    return resolved.length > 0 ? resolved : null;
  } catch {
    return null;
  }
};

export const resolveModalSignBudget = (): MediaSignBudget => {
  return resolveMediaPreviewSignBudget({
    desktop: MEDIA_MODAL_SIGN_BUDGET_DESKTOP,
    smallScreen: MEDIA_MODAL_SIGN_BUDGET_SMALL_SCREEN,
    constrained: MEDIA_MODAL_SIGN_BUDGET_CONSTRAINED,
    smallScreenQuery: MEDIA_MODAL_SIGN_SMALL_SCREEN_QUERY,
  });
};

export const isVideoFile = (fileType?: string | null) =>
  (fileType ?? "").toLowerCase().startsWith("video");

export const isAudioFile = (fileType?: string | null) =>
  (fileType ?? "").toLowerCase().startsWith("audio");

export const isImageFile = (fileType?: string | null) =>
  (fileType ?? "").toLowerCase().startsWith("image");

export const isPrivateStoragePath = (storagePath?: string | null) =>
  (storagePath ?? "").split("/").filter(Boolean).includes(PRIVATE_MEDIA_FOLDER);

export const isPrivateMediaFile = (file: Pick<MediaFileRow, "source" | "storage_path">) =>
  (file.source ?? "") === PRIVATE_MEDIA_SOURCE || isPrivateStoragePath(file.storage_path);

export const isMediaDataTab = (tab: MediaTab): tab is MediaDataTab => tab !== "saved_prompts";

export const getMediaDataTabForRow = (
  row: Pick<MediaFileRow, "source" | "storage_path" | "file_type">
): MediaDataTab => {
  if (isPrivateMediaFile(row)) return "private";
  if ((row.source ?? "upload") === "ai_studio") return "ai_generations";
  return isVideoFile(row.file_type) ? "uploaded_videos" : "uploaded_images";
};

export const createEmptyMediaTabCache = (): MediaTabCache => ({
  rows: [],
  nextCursor: null,
  pagesLoaded: 0,
  query: "",
  loadedAtMs: null,
  hasMore: true,
  loading: false,
  loaded: false,
  error: null,
});

export const createMediaTabCacheState = (): Record<MediaDataTab, MediaTabCache> => ({
  uploaded_images: createEmptyMediaTabCache(),
  uploaded_videos: createEmptyMediaTabCache(),
  private: createEmptyMediaTabCache(),
  ai_generations: createEmptyMediaTabCache(),
});

export const createMediaTabRequestState = (): MediaTabRequestState => ({
  uploaded_images: 0,
  uploaded_videos: 0,
  private: 0,
  ai_generations: 0,
});

export const createMediaTabBooleanState = (): MediaTabBooleanState => ({
  uploaded_images: false,
  uploaded_videos: false,
  private: false,
  ai_generations: false,
});

export const withMediaTabFilter = <
  T extends {
    eq: (column: string, value: string) => T;
    ilike: (column: string, pattern: string) => T;
    not: (column: string, operator: string, value: string) => T;
  },
>(
  query: T,
  tab: MediaDataTab
): T => withMediaTabFilterShared(query, tab, { privateMediaSource: PRIVATE_MEDIA_SOURCE });

export const normalizeMediaSearchTerm = normalizeMediaSearchTermShared;

export const buildMediaSearchOrClause = buildMediaSearchOrClauseShared;

export const withMediaSearchFilter = <T extends { or: (clause: string) => T }>(
  query: T,
  rawSearchTerm: string
): T => withMediaSearchFilterShared(query, rawSearchTerm);

export const withUserScopedPromptQuery = withUserScopedPromptQueryShared;

export const buildCursorFromRows = <T extends { id?: string | null; created_at?: string | null }>(
  rows: T[]
): MediaCursor | null => {
  if (!rows.length) return null;
  const tail = rows[rows.length - 1];
  const id = tail.id ?? "";
  const createdAt = tail.created_at ?? "";
  if (!id || !createdAt) return null;
  return { id, createdAt };
};

export const mergePageRows = (
  current: MediaFileRow[],
  incoming: MediaFileRow[]
): MediaFileRow[] => {
  if (!incoming.length) return current;
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const createdDelta = createdAtTime(b.created_at) - createdAtTime(a.created_at);
    if (createdDelta !== 0) return createdDelta;
    return (b.id ?? "").localeCompare(a.id ?? "");
  });
};

export const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const createdAtTime = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const sortByCreatedAtDesc = <T extends { created_at?: string | null; id?: string | null }>(
  rows: T[]
): T[] =>
  [...rows].sort((a, b) => {
    const createdDelta = createdAtTime(b.created_at) - createdAtTime(a.created_at);
    if (createdDelta !== 0) return createdDelta;
    return (b.id ?? "").localeCompare(a.id ?? "");
  });

export const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const resolveMediaMetadataPromptText = (
  metadata?: Record<string, unknown> | null
): string | null => {
  if (!metadata) return null;
  const prompt =
    typeof metadata.prompt === "string"
      ? metadata.prompt
      : typeof metadata.prompt_text === "string"
        ? metadata.prompt_text
        : typeof metadata.promptText === "string"
          ? metadata.promptText
          : "";
  const trimmed = prompt.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveMediaMetadataTranscriptText = (
  metadata?: Record<string, unknown> | null
): string | null => {
  if (!metadata) return null;
  const transcript =
    typeof metadata.transcript_text === "string"
      ? metadata.transcript_text
      : typeof metadata.transcriptText === "string"
        ? metadata.transcriptText
        : "";
  const trimmed = transcript.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveMediaMetadataLyricsText = (
  metadata?: Record<string, unknown> | null
): string | null => {
  if (!metadata) return null;
  const workflowReload =
    metadata.workflow_reload && typeof metadata.workflow_reload === "object"
      ? (metadata.workflow_reload as Record<string, unknown>)
      : null;
  const workflowPayload =
    workflowReload?.payload && typeof workflowReload.payload === "object"
      ? (workflowReload.payload as Record<string, unknown>)
      : null;
  const lyrics =
    typeof metadata.lyrics_text === "string"
      ? metadata.lyrics_text
      : typeof metadata.lyricsText === "string"
        ? metadata.lyricsText
        : typeof workflowPayload?.lyrics === "string"
          ? workflowPayload.lyrics
          : "";
  const trimmed = lyrics.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveMediaMetadataMusicMode = (
  metadata?: Record<string, unknown> | null
): "instrumental" | "vocal" | null => {
  if (!metadata) return null;
  const workflowReload =
    metadata.workflow_reload && typeof metadata.workflow_reload === "object"
      ? (metadata.workflow_reload as Record<string, unknown>)
      : null;
  const workflowPayload =
    workflowReload?.payload && typeof workflowReload.payload === "object"
      ? (workflowReload.payload as Record<string, unknown>)
      : null;
  const candidate =
    typeof metadata.music_mode === "string"
      ? metadata.music_mode
      : typeof metadata.musicMode === "string"
        ? metadata.musicMode
        : typeof workflowPayload?.mode === "string"
          ? workflowPayload.mode
          : "";
  const normalized = candidate.trim().toLowerCase();
  return normalized === "instrumental" || normalized === "vocal" ? normalized : null;
};

const normalizeMetadataDurationCandidateMs = (
  value: unknown,
  options?: { unit?: "ms" | "seconds" }
): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const durationMs = options?.unit === "seconds" ? value * 1000 : value;
  return Math.max(0, Math.round(durationMs));
};

export const resolveMediaMetadataDurationMs = (
  metadata?: Record<string, unknown> | null,
  options?: { fileType?: string | null }
): number | null => {
  if (!metadata) return null;

  const isAudio = isAudioFile(options?.fileType);
  const isVideo = isVideoFile(options?.fileType);

  const candidateGroups: Array<Array<{ value: unknown; unit?: "ms" | "seconds" }>> = [
    [
      { value: metadata.durationMs, unit: "ms" },
      { value: metadata.duration_ms, unit: "ms" },
      { value: metadata.durationSeconds, unit: "seconds" },
      { value: metadata.duration_seconds, unit: "seconds" },
    ],
  ];

  if (isAudio) {
    candidateGroups.push([
      { value: metadata.audioDurationMs, unit: "ms" },
      { value: metadata.audio_duration_ms, unit: "ms" },
      { value: metadata.audioDurationSeconds, unit: "seconds" },
      { value: metadata.audio_duration_seconds, unit: "seconds" },
    ]);
  }

  if (isVideo) {
    candidateGroups.push([
      { value: metadata.videoDurationMs, unit: "ms" },
      { value: metadata.video_duration_ms, unit: "ms" },
      { value: metadata.videoDurationSeconds, unit: "seconds" },
      { value: metadata.video_duration_seconds, unit: "seconds" },
      { value: metadata.source_duration_ms, unit: "ms" },
      { value: metadata.source_duration_seconds, unit: "seconds" },
    ]);
  }

  for (const candidates of candidateGroups) {
    for (const candidate of candidates) {
      const durationMs = normalizeMetadataDurationCandidateMs(candidate.value, {
        unit: candidate.unit,
      });
      if (durationMs != null) return durationMs;
    }
  }

  return null;
};

export const resolveMediaMetadataWaveformPeaks = (
  metadata?: Record<string, unknown> | null
): number[] | null => {
  if (!metadata) return null;
  const candidates = [
    metadata.waveformPeaks,
    metadata.waveform_peaks,
    metadata.audioWaveformPeaks,
    metadata.audio_waveform_peaks,
  ];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    const peaks = candidate.filter((value): value is number => typeof value === "number");
    if (peaks.length > 0) return peaks;
  }
  return null;
};

export const resolveMediaMetadataAudioSourceMode = (
  metadata?: Record<string, unknown> | null
): StudioAudioSourceMode | null => {
  if (!metadata) return null;
  return normalizeAudioSourceMode(
    metadata.source_mode ?? metadata.sourceMode ?? metadata.audio_mode
  );
};
