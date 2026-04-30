/**
 * Helper utilities for AI Studio state and provider plumbing.
 * Separated from hooks to keep business logic small and testable.
 */
import { klingAllowedAspects, modelOptions } from "../constants";
import { resolveEffectiveAspectForModel } from "./modelApiContracts";
import type { ModelMediaType, ModelOption } from "../constants";
import type { StudioMode, StudioOutput } from "../types";
import { KIE_KLING_30_MODEL_ID } from "../../../lib/model-runtime/providerModelIds";
import {
  getModelConfig,
  getModelConfigByApiRouteSlug,
} from "../../../lib/model-runtime/modelRegistry";

export type Provider =
  | "fal"
  | "fal-flux2-klein"
  | "fal-flux-pro-fill"
  | "fal-flux-kontext-inpaint"
  | "fal-bria-background-remove"
  | "fal-kling"
  | "fal-nano-banana"
  | "fal-nano-banana-2"
  | "fal-kling-3"
  | "fal-nano-banana-edit"
  | "fal-nano-banana-2-edit"
  | "fal-nano-banana-pro"
  | "fal-nano-banana-pro-edit"
  | "fal-seedance"
  | "fal-seedance-i2v"
  | "fal-seedream"
  | "fal-seedream-edit"
  | "fal-seedream-v5-lite"
  | "fal-seedream-v5-lite-edit"
  | "fal-veo"
  | "fal-veo-i2v"
  | "openai-image"
  | "kie-veo"
  | "kie-kling"
  | "kie-seedance"
  | "kie-seedance-2"
  | "kie-seedance-2-fast";

const activePollingProviders = new Set<Provider>([
  "fal-flux2-klein",
  "fal-flux-pro-fill",
  "fal-flux-kontext-inpaint",
  "fal-bria-background-remove",
  "fal-nano-banana",
  "fal-nano-banana-2",
  "fal-nano-banana-edit",
  "fal-nano-banana-2-edit",
  "fal-nano-banana-pro",
  "fal-nano-banana-pro-edit",
  "fal-seedream",
  "fal-seedream-edit",
  "fal-seedream-v5-lite",
  "fal-seedream-v5-lite-edit",
  "kie-veo",
  "kie-kling",
  "kie-seedance",
  "kie-seedance-2",
  "kie-seedance-2-fast",
]);

export const normalizeProviderForPolling = (
  value: string | null | undefined,
  fallback: Provider = "fal"
): Provider => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized.length) return fallback;
  if (normalized.startsWith("openai")) return "openai-image";
  if (normalized.startsWith("fal")) {
    if (
      normalized.includes("kling-3") ||
      normalized.includes("kling_v3") ||
      normalized.includes("kling-video/v3")
    ) {
      return "fal-kling-3";
    }
    if (normalized.includes("kling")) return "fal-kling";
    if (normalized.includes("seedance") && normalized.includes("i2v")) return "fal-seedance-i2v";
    if (normalized.includes("seedance")) return "fal-seedance";
    if (
      normalized.includes("seedream") &&
      normalized.includes("v5") &&
      normalized.includes("edit")
    ) {
      return "fal-seedream-v5-lite-edit";
    }
    if (normalized.includes("seedream") && normalized.includes("v5")) return "fal-seedream-v5-lite";
    if (normalized.includes("seedream") && normalized.includes("edit")) return "fal-seedream-edit";
    if (normalized.includes("seedream")) return "fal-seedream";
    if (normalized.includes("veo") && normalized.includes("i2v")) return "fal-veo-i2v";
    if (normalized.includes("veo")) return "fal-veo";
    if (normalized.includes("nano-banana-pro") && normalized.includes("edit")) {
      return "fal-nano-banana-pro-edit";
    }
    if (normalized.includes("nano-banana-pro")) return "fal-nano-banana-pro";
    if (normalized.includes("nano-banana-2") && normalized.includes("edit")) {
      return "fal-nano-banana-2-edit";
    }
    if (normalized.includes("nano-banana-2")) return "fal-nano-banana-2";
    if (normalized.includes("nano-banana") && normalized.includes("edit")) {
      return "fal-nano-banana-edit";
    }
    if (normalized.includes("nano-banana")) return "fal-nano-banana";
    if (normalized.includes("flux-kontext") && normalized.includes("inpaint")) {
      return "fal-flux-kontext-inpaint";
    }
    if (normalized.includes("flux-pro") && normalized.includes("fill")) return "fal-flux-pro-fill";
    if (
      normalized.includes("bria") &&
      normalized.includes("background") &&
      normalized.includes("remove")
    ) {
      return "fal-bria-background-remove";
    }
    if (
      (normalized.includes("flux-2") || normalized.includes("flux2")) &&
      normalized.includes("klein")
    ) {
      return "fal-flux2-klein";
    }
    return "fal";
  }
  if (normalized.startsWith("kie")) {
    if (normalized.includes("seedance-2-fast")) return "kie-seedance-2-fast";
    if (normalized.includes("seedance-2")) return "kie-seedance-2";
    if (normalized.includes("seedance")) return "kie-seedance";
    return normalized.includes("kling") ? "kie-kling" : "kie-veo";
  }
  return fallback;
};

const resolveActivePollingProvider = (value: string | null | undefined): Provider | null => {
  const provider = normalizeProviderForPolling(value, "fal");
  return activePollingProviders.has(provider) ? provider : null;
};

const pollingProviderRouteSlugAliases: Partial<Record<Provider, string>> = {
  "fal-flux2-klein": "flux2klein",
};

const resolveQueuedPollingModelId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const directModelConfig = getModelConfig(trimmed);
  if (directModelConfig?.executionMode === "queued") return directModelConfig.id;

  const provider = resolveActivePollingProvider(trimmed);
  if (!provider) return null;
  const routeSlug =
    pollingProviderRouteSlugAliases[provider] ??
    (provider.startsWith("fal-") ? provider.slice("fal-".length) : provider);
  const routeModelConfig = getModelConfigByApiRouteSlug(routeSlug);
  return routeModelConfig?.executionMode === "queued" ? routeModelConfig.id : null;
};

export const resolveTaskPollingProvider = ({
  provider,
  modelId,
}: {
  provider?: string | null;
  modelId?: string | null;
}): Provider | null => {
  return resolveActivePollingProvider(provider) ?? resolveActivePollingProvider(modelId);
};

export const resolveTaskPollingModelId = ({
  provider,
  modelId,
}: {
  provider?: string | null;
  modelId?: string | null;
}): string | null => {
  return resolveQueuedPollingModelId(modelId) ?? resolveQueuedPollingModelId(provider);
};

export const resolveModelLabel = (value?: string) =>
  value
    ? (modelOptions.find((opt) => opt.value === value)?.label ?? `Custom (${value})`)
    : "Choose Model";

export const normalizeAspectForFalNanoBanana = (value: string) =>
  resolveEffectiveAspectForModel("fal-ai/nano-banana", value, "1:1");
export const normalizeAspectForFalNanoBanana2 = (value: string) =>
  resolveEffectiveAspectForModel("fal-ai/nano-banana-2", value, "auto");
export const normalizeAspectForFalNanoBananaPro = (value: string) =>
  resolveEffectiveAspectForModel("fal-ai/nano-banana-pro", value, "4:5");
export const resolveKlingAspectRatio = (value: string): "16:9" | "9:16" | "1:1" => {
  const resolved = resolveEffectiveAspectForModel(KIE_KLING_30_MODEL_ID, value, "16:9");
  return klingAllowedAspects.has(resolved) ? (resolved as "16:9" | "9:16" | "1:1") : "16:9";
};
export const resolveKlingDuration = (seconds: number): 5 | 10 => (seconds <= 5 ? 5 : 10);
export const resolveKlingV3Duration = (seconds: number): number => {
  if (!Number.isFinite(seconds)) return 5;
  const rounded = Math.round(seconds);
  return Math.min(15, Math.max(3, rounded));
};
export const computeModalPosition = (target: HTMLElement): { top: number; left: number } => {
  const rect = target.getBoundingClientRect();
  const scrollY = window.scrollY || 0;
  const scrollX = window.scrollX || 0;
  const offsetX = 16;
  const top = rect.top + scrollY + rect.height / 2;
  const left = rect.right + scrollX + offsetX;
  return { top, left };
};

const VIDEO_EXTENSION_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;
const AUDIO_EXTENSION_PATTERN = /\.(aac|flac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/i;
const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:$|[?#])/i;
const VIDEO_SEGMENT_PATTERN = /\/(?:videos|video)(?:\/|$)/i;
const AUDIO_SEGMENT_PATTERN = /\/(?:audio|audios)(?:\/|$)/i;
const IMAGE_SEGMENT_PATTERN = /\/(?:images|image)(?:\/|$)/i;
const VIDEO_MARKER_PATTERN = /(?:[?#&]|^)video=1(?:$|[&#])/i;
const AUDIO_MARKER_PATTERN = /(?:[?#&]|^)audio=1(?:$|[&#])/i;
const NEXT_IMAGE_PATH_PATTERN = /\/_next\/image$/i;
const SUPABASE_RENDER_IMAGE_PATH_PATTERN = /\/storage\/v1\/render\/image\//i;

const parseMediaCandidateUrl = (value: string): URL | null => {
  try {
    return new URL(value, "https://shortpulse.local");
  } catch {
    return null;
  }
};

export const isVideoUrl = (url: string | null | undefined) => {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^data:video\//i.test(trimmed)) return true;
  if (/^data:image\//i.test(trimmed)) return false;
  if (/^blob:/i.test(trimmed)) return VIDEO_MARKER_PATTERN.test(trimmed);
  if (VIDEO_EXTENSION_PATTERN.test(trimmed)) return true;
  if (IMAGE_EXTENSION_PATTERN.test(trimmed)) return false;

  const parsed = parseMediaCandidateUrl(trimmed);
  if (!parsed) {
    const hasVideoSegment = VIDEO_SEGMENT_PATTERN.test(trimmed);
    const hasImageSegment = IMAGE_SEGMENT_PATTERN.test(trimmed);
    return hasVideoSegment && !hasImageSegment;
  }

  const decodedPathname = (() => {
    try {
      return decodeURIComponent(parsed.pathname);
    } catch {
      return parsed.pathname;
    }
  })();
  if (NEXT_IMAGE_PATH_PATTERN.test(decodedPathname)) return false;
  if (SUPABASE_RENDER_IMAGE_PATH_PATTERN.test(decodedPathname)) return false;
  if (VIDEO_EXTENSION_PATTERN.test(decodedPathname)) return true;
  if (IMAGE_EXTENSION_PATTERN.test(decodedPathname)) return false;

  const queryMimeType =
    parsed.searchParams.get("mimeType") ??
    parsed.searchParams.get("mime") ??
    parsed.searchParams.get("contentType") ??
    parsed.searchParams.get("type") ??
    "";
  const normalizedQueryMimeType = queryMimeType.toLowerCase();
  if (normalizedQueryMimeType.startsWith("video/")) return true;
  if (normalizedQueryMimeType.startsWith("image/")) return false;
  if (parsed.searchParams.get("video") === "1") return true;

  const hasVideoSegment = VIDEO_SEGMENT_PATTERN.test(decodedPathname);
  const hasImageSegment = IMAGE_SEGMENT_PATTERN.test(decodedPathname);
  return hasVideoSegment && !hasImageSegment;
};

export const isAudioUrl = (url: string | null | undefined) => {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^data:audio\//i.test(trimmed)) return true;
  if (/^data:(image|video)\//i.test(trimmed)) return false;
  if (/^blob:/i.test(trimmed)) return AUDIO_MARKER_PATTERN.test(trimmed);
  if (AUDIO_EXTENSION_PATTERN.test(trimmed)) return true;
  if (VIDEO_EXTENSION_PATTERN.test(trimmed) || IMAGE_EXTENSION_PATTERN.test(trimmed)) return false;

  const parsed = parseMediaCandidateUrl(trimmed);
  if (!parsed) {
    const hasAudioSegment = AUDIO_SEGMENT_PATTERN.test(trimmed);
    const hasVideoSegment = VIDEO_SEGMENT_PATTERN.test(trimmed);
    const hasImageSegment = IMAGE_SEGMENT_PATTERN.test(trimmed);
    return hasAudioSegment && !hasVideoSegment && !hasImageSegment;
  }

  const decodedPathname = (() => {
    try {
      return decodeURIComponent(parsed.pathname);
    } catch {
      return parsed.pathname;
    }
  })();
  if (NEXT_IMAGE_PATH_PATTERN.test(decodedPathname)) return false;
  if (SUPABASE_RENDER_IMAGE_PATH_PATTERN.test(decodedPathname)) return false;
  if (AUDIO_EXTENSION_PATTERN.test(decodedPathname)) return true;
  if (
    VIDEO_EXTENSION_PATTERN.test(decodedPathname) ||
    IMAGE_EXTENSION_PATTERN.test(decodedPathname)
  )
    return false;

  const queryMimeType =
    parsed.searchParams.get("mimeType") ??
    parsed.searchParams.get("mime") ??
    parsed.searchParams.get("contentType") ??
    parsed.searchParams.get("type") ??
    "";
  const normalizedQueryMimeType = queryMimeType.toLowerCase();
  if (normalizedQueryMimeType.startsWith("audio/")) return true;
  if (
    normalizedQueryMimeType.startsWith("video/") ||
    normalizedQueryMimeType.startsWith("image/")
  ) {
    return false;
  }
  if (parsed.searchParams.get("audio") === "1") return true;

  const hasAudioSegment = AUDIO_SEGMENT_PATTERN.test(decodedPathname);
  const hasVideoSegment = VIDEO_SEGMENT_PATTERN.test(decodedPathname);
  const hasImageSegment = IMAGE_SEGMENT_PATTERN.test(decodedPathname);
  return hasAudioSegment && !hasVideoSegment && !hasImageSegment;
};

type OutputLike = {
  id: string;
  previewUrl?: string | null;
  prompt?: string | null;
  previewText?: string | null;
  aspect?: string | null;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const extractDirectUrlFromRecord = (record: Record<string, unknown>): string | null =>
  asText(record.url) ||
  asText(record.download_url) ||
  asText(record.video_url) ||
  asText(record.image_url) ||
  asText(record.file_url) ||
  asText(record.media_url);

const extractUrlObjects = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return asText(item);
      const record = toRecord(item);
      return extractDirectUrlFromRecord(record);
    })
    .filter((url): url is string => Boolean(url));
};

const extractResultFieldUrls = (value: unknown): string[] => {
  const direct = asText(value);
  if (direct) return [direct];
  return extractUrlObjects(value);
};

export const mapAgentReferences = (outputs: OutputLike[], activeOutputId: string | null) => {
  const mapped = outputs.map((item) => ({
    id: item.id,
    kind: item.previewUrl ? (isVideoUrl(item.previewUrl) ? "video" : "image") : "prompt",
    promptSnippet: item.prompt ?? item.previewText ?? null,
    aspect: item.aspect ?? null,
    caption: item.previewText ?? null,
  }));
  if (!activeOutputId) return mapped;
  const selected = mapped.find((ref) => ref.id === activeOutputId);
  if (!selected) return mapped;
  return [selected, ...mapped.filter((ref) => ref.id !== activeOutputId)];
};

export const mapAgentMedia = (outputs: OutputLike[]) =>
  outputs
    .filter((item) => item.previewUrl)
    .map((item) => ({
      id: item.id,
      kind: isVideoUrl(item.previewUrl) ? "video" : "image",
      url: item.previewUrl ?? undefined,
      thumbnailAlt: item.prompt ?? item.previewText ?? null,
    }));

const extractVideoPosterDataUrl = async (videoUrl: string): Promise<string | null> => {
  if (typeof document === "undefined") return null;
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  return await new Promise<string | null>((resolve) => {
    let settled = false;
    const finalize = (value: string | null) => {
      if (settled) return;
      settled = true;
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleFailure);
      video.removeEventListener("seeked", handleSeeked);
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    const handleFailure = () => finalize(null);
    const handleSeeked = () => {
      try {
        const width = video.videoWidth || 0;
        const height = video.videoHeight || 0;
        if (width <= 0 || height <= 0) {
          finalize(null);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          finalize(null);
          return;
        }
        context.drawImage(video, 0, 0, width, height);
        finalize(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        finalize(null);
      }
    };
    const handleLoadedData = () => {
      try {
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          finalize(null);
          return;
        }
        const targetTime = Number.isFinite(video.duration) && video.duration > 0 ? 0.05 : 0;
        if (Math.abs((video.currentTime ?? 0) - targetTime) < 0.001) {
          handleSeeked();
          return;
        }
        video.currentTime = targetTime;
      } catch {
        finalize(null);
      }
    };

    video.addEventListener("loadeddata", handleLoadedData, { once: true });
    video.addEventListener("error", handleFailure, { once: true });
    video.addEventListener("seeked", handleSeeked, { once: true });
    video.src = videoUrl;
    video.load();
  });
};

export const mapUploadsFromFiles = async (
  files: FileList,
  mode: StudioMode,
  aspect: string,
  model: string | null,
  resolveModelLabelFn: (value?: string) => string,
  randomIdFn: () => string,
  source: "filePicker" | "drop" = "filePicker"
): Promise<StudioOutput[]> => {
  const mediaFiles = Array.from(files)
    .filter(
      (file) =>
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        file.type.startsWith("audio/")
    )
    .filter((file, index, all) => {
      const signature = `${file.name}:${file.type}:${file.size}:${file.lastModified}`;
      return (
        all.findIndex(
          (candidate) =>
            `${candidate.name}:${candidate.type}:${candidate.size}:${candidate.lastModified}` ===
            signature
        ) === index
      );
    });
  const timestampLabel = source === "drop" ? "Dropped" : "Uploaded";

  const supportsObjectUrl = typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
  const outputs = await Promise.all(
    mediaFiles.map(async (file) => {
      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/");
      const objectUrl = supportsObjectUrl ? URL.createObjectURL(file) : null;
      const fallbackDataUrl = await (async () => {
        if (objectUrl) return null;
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      })();
      // Keep url-shape compatibility for existing heuristics while retaining the raw object URL
      // for deterministic cleanup via URL.revokeObjectURL.
      const previewBase = objectUrl ?? fallbackDataUrl ?? "";
      const previewUrl = isVideo
        ? `${previewBase}#video=1`
        : isAudio && objectUrl
          ? `${previewBase}#audio=1`
          : previewBase;
      const previewPosterUrl =
        isVideo && previewBase ? await extractVideoPosterDataUrl(previewBase) : null;
      return {
        id: `upload-${randomIdFn()}`,
        prompt: file.name,
        mode: isVideo ? ("video" as const) : isAudio ? ("audio" as const) : ("image" as const),
        aspect,
        model: resolveModelLabelFn(model ?? undefined),
        modelId: model ?? undefined,
        status: "ready" as const,
        timestamp: timestampLabel,
        previewUrl,
        previewPosterUrl,
        previewTier: "full" as const,
        mimeType: file.type || null,
        mediaSource: "upload" as const,
        localObjectUrl: objectUrl,
        saveState: "idle" as const,
        saveError: null,
      };
    })
  );

  return outputs;
};

export const filterModelOptions = (
  mode: string,
  selectedTool: string | null,
  options: ModelOption[],
  getModelConfig: (
    id: string
  ) => { supportsImageToImage?: boolean; supportsTextToImage?: boolean } | null
): ModelOption[] => {
  const mediaFilter: Extract<ModelMediaType, "image" | "video"> | null = (() => {
    if (selectedTool === "create" || selectedTool === "text") {
      if (mode === "image") return "image";
      if (mode === "video") return "video";
    }
    if (selectedTool === "video" || selectedTool === "kling") return "video";
    if (selectedTool === "image" || selectedTool === "edit") return "image";
    return null;
  })();

  let filtered = options;
  if (mediaFilter) {
    filtered = filtered.filter((opt) => {
      if (!opt.mediaType || opt.mediaType === mediaFilter || opt.mediaType === "multi") return true;
      if (
        selectedTool === "video" &&
        (opt.mediaType === "image-to-video" || opt.mediaType === "keyframes")
      )
        return true;
      return false;
    });
  }
  if (selectedTool === "image" || selectedTool === "edit") {
    filtered = filtered.filter((opt) => {
      const config = getModelConfig(opt.value);
      return config?.supportsImageToImage;
    });
  }
  if ((selectedTool === "create" || selectedTool === "text") && mode === "image") {
    filtered = filtered.filter((opt) => {
      const config = getModelConfig(opt.value);
      return config?.supportsTextToImage;
    });
  }
  return filtered;
};

export const resolvePreviewUrlById = (outputs: OutputLike[], id: string | null | undefined) =>
  outputs.find((item) => item.id === id)?.previewUrl ?? null;

const collectFalCandidates = (status: unknown) => [
  status,
  toRecord(status).response,
  toRecord(toRecord(status).response).data,
  toRecord(toRecord(status).response).output,
  toRecord(toRecord(status).response).result,
  toRecord(status).data,
  toRecord(toRecord(status).data).output,
  toRecord(toRecord(status).data).result,
  toRecord(status).output,
  toRecord(toRecord(status).output).data,
  toRecord(toRecord(status).output).result,
  toRecord(status).result,
  toRecord(toRecord(status).result).data,
  toRecord(toRecord(status).result).output,
];

export const extractFalUrls = (status: unknown): string[] => {
  const candidates = collectFalCandidates(status);
  for (const candidate of candidates) {
    const candidateRecord = toRecord(candidate);
    const images = extractUrlObjects(candidateRecord.images);
    if (images.length) return images;
    const outputs = extractUrlObjects(candidateRecord.outputs);
    if (outputs.length) return outputs;
    const artifacts = extractUrlObjects(candidateRecord.artifacts);
    if (artifacts.length) return artifacts;
    const imageUrls = extractUrlObjects(candidateRecord.image_urls);
    if (imageUrls.length) return imageUrls;
    const resultUrls = extractUrlObjects(candidateRecord.result_urls ?? candidateRecord.resultUrls);
    if (resultUrls.length) return resultUrls;
    const imageUrl =
      asText(candidateRecord.image) ||
      asText(toRecord(candidateRecord.image).url) ||
      asText(candidateRecord.image_url) ||
      asText(candidateRecord.url) ||
      asText(toRecord(toRecord(candidateRecord.assets).image).url) ||
      asText(toRecord(toRecord(candidateRecord.assets).image).download_url);
    if (imageUrl) return [imageUrl];
  }
  return [];
};

const extractVideoUrlsFrom = (candidate: unknown): string[] => {
  const candidateRecord = toRecord(candidate);
  const videos = extractUrlObjects(candidateRecord.videos);
  if (videos.length) return videos;
  const outputs = extractUrlObjects(candidateRecord.outputs);
  if (outputs.length) return outputs;
  const artifacts = extractUrlObjects(candidateRecord.artifacts);
  if (artifacts.length) return artifacts;
  const videoUrls = extractUrlObjects(candidateRecord.video_urls);
  if (videoUrls.length) return videoUrls;
  const resultUrls = extractUrlObjects(candidateRecord.result_urls ?? candidateRecord.resultUrls);
  if (resultUrls.length) return resultUrls;
  const videoUrl =
    asText(candidateRecord.video) ||
    asText(candidateRecord.url) ||
    asText(toRecord(candidateRecord.video).url) ||
    asText(candidateRecord.video_url) ||
    asText(toRecord(toRecord(candidateRecord.assets).video).url) ||
    asText(toRecord(toRecord(candidateRecord.assets).video).download_url) ||
    asText(candidateRecord.file_url) ||
    asText(candidateRecord.download_url);
  return videoUrl ? [videoUrl] : [];
};

export const extractFalMediaUrls = (
  status: unknown,
  options?: { preferVideo?: boolean }
): string[] => {
  const candidates = collectFalCandidates(status);
  const preferVideo = options?.preferVideo === true;

  if (preferVideo) {
    for (const candidate of candidates) {
      const videoUrls = extractVideoUrlsFrom(candidate);
      if (videoUrls.length) return videoUrls;
    }
  }

  const imageUrls = extractFalUrls(status);
  if (imageUrls.length) return imageUrls;

  for (const candidate of candidates) {
    const videoUrls = extractVideoUrlsFrom(candidate);
    if (videoUrls.length) return videoUrls;
  }
  return [];
};

export const extractResultUrls = (resultJson: unknown, fallback?: unknown): string[] => {
  const extractGenericUrls = (value: unknown, depth = 0): string[] => {
    if (depth > 3) return [];
    const record = toRecord(value);
    const directUrls = extractResultFieldUrls(record.resultUrls);
    if (directUrls.length) return directUrls;
    const snakeCaseDirectUrls = extractResultFieldUrls(record.result_urls);
    if (snakeCaseDirectUrls.length) return snakeCaseDirectUrls;
    const responseRecord = toRecord(record.response);
    const responseResultUrls = extractResultFieldUrls(
      responseRecord.resultUrls ?? responseRecord.result_urls
    );
    if (responseResultUrls.length) return responseResultUrls;
    const dataRecord = toRecord(record.data);
    const dataResultUrls = extractResultFieldUrls(dataRecord.resultUrls ?? dataRecord.result_urls);
    if (dataResultUrls.length) return dataResultUrls;
    const dataResponseRecord = toRecord(dataRecord.response);
    const dataResponseResultUrls = extractResultFieldUrls(
      dataResponseRecord.resultUrls ?? dataResponseRecord.result_urls
    );
    if (dataResponseResultUrls.length) return dataResponseResultUrls;
    const infoRecord = toRecord(record.info);
    const infoUrls = extractResultFieldUrls(infoRecord.result_urls ?? infoRecord.resultUrls);
    if (infoUrls.length) return infoUrls;
    const encodedResultPayloads = [
      record.resultJson,
      record.result_json,
      toRecord(record.data).resultJson,
      toRecord(record.data).result_json,
      toRecord(record.response).resultJson,
      toRecord(record.response).result_json,
      toRecord(record.output).resultJson,
      toRecord(record.output).result_json,
    ];
    for (const encodedPayload of encodedResultPayloads) {
      if (typeof encodedPayload !== "string" || !encodedPayload.trim().length) continue;
      try {
        const parsed = JSON.parse(encodedPayload);
        const parsedUrls = extractGenericUrls(parsed, depth + 1);
        if (parsedUrls.length) return parsedUrls;
      } catch {
        // Ignore non-JSON provider fields.
      }
    }
    const videosFromRoot = extractUrlObjects(record.videos);
    if (videosFromRoot.length) return videosFromRoot;
    const videosFromData = extractUrlObjects(toRecord(record.data).videos);
    if (videosFromData.length) return videosFromData;
    const videosFromOutput = extractUrlObjects(toRecord(record.output).videos);
    if (videosFromOutput.length) return videosFromOutput;
    const videosFromResponse = extractUrlObjects(toRecord(record.response).videos);
    if (videosFromResponse.length) return videosFromResponse;
    const videoUrl =
      asText(toRecord(record.video).url) ||
      asText(toRecord(toRecord(record.data).video).url) ||
      asText(toRecord(toRecord(record.output).video).url) ||
      asText(toRecord(toRecord(record.response).video).url) ||
      asText(toRecord(record.response).video_url) ||
      asText(record.video_url) ||
      asText(toRecord(record.data).video_url) ||
      asText(toRecord(record.output).video_url);
    return videoUrl ? [videoUrl] : [];
  };

  if (!resultJson && fallback && typeof fallback === "object") {
    return extractGenericUrls(fallback);
  }
  if (!resultJson) return [];
  if (typeof resultJson === "string") {
    try {
      const parsed = JSON.parse(resultJson);
      return extractResultUrls(parsed);
    } catch {
      return [];
    }
  }
  if (typeof resultJson === "object" && resultJson) {
    return extractGenericUrls(resultJson);
  }
  return [];
};
