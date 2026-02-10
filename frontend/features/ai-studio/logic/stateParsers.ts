/**
 * Helper utilities for AI Studio state and provider plumbing.
 * Separated from hooks to keep business logic small and testable.
 */
import {
  falNanoBananaAllowedAspects,
  falNanoBananaProAllowedAspects,
  keiAllowedAspects,
  klingAllowedAspects,
  modelOptions,
} from "../constants";
import type { ModelMediaType, ModelOption } from "../constants";
import type { KeiTaskStatus } from "../../../lib/keiClient";
import type { FalKlingTextSubmitRequest } from "../../../lib/falClient";
import type { StudioMode, StudioOutput } from "../types";

export type Provider =
  | "kei"
  | "fal"
  | "fal-flux2"
  | "fal-flux2-klein"
  | "fal-flux2-edit"
  | "fal-flux2-pro"
  | "fal-flux2-pro-edit"
  | "fal-kling"
  | "fal-nano-banana"
  | "fal-kling-3"
  | "fal-nano-banana-edit"
  | "fal-nano-banana-pro"
  | "fal-nano-banana-pro-edit"
  | "fal-sora"
  | "fal-seedance"
  | "fal-seedance-i2v"
  | "fal-seedream"
  | "fal-veo"
  | "fal-veo-i2v";

export const resolveModelLabel = (value?: string) =>
  value
    ? (modelOptions.find((opt) => opt.value === value)?.label ?? `Custom (${value})`)
    : "Choose Model";

export const normalizeAspectForKei = (value: string) =>
  keiAllowedAspects.has(value) ? value : "auto";
export const normalizeAspectForFalNanoBanana = (value: string) =>
  falNanoBananaAllowedAspects.has(value) ? value : "1:1";
export const normalizeAspectForFalNanoBananaPro = (value: string) =>
  falNanoBananaProAllowedAspects.has(value) ? value : "4:5";
export const resolveKlingAspectRatio = (
  value: string
): FalKlingTextSubmitRequest["aspect_ratio"] =>
  klingAllowedAspects.has(value) ? (value as FalKlingTextSubmitRequest["aspect_ratio"]) : "16:9";
export const resolveKlingDuration = (seconds: number): FalKlingTextSubmitRequest["duration"] =>
  seconds <= 5 ? 5 : 10;
export const resolveKlingV3Duration = (seconds: number): number => {
  if (!Number.isFinite(seconds)) return 5;
  const rounded = Math.round(seconds);
  return Math.min(15, Math.max(3, rounded));
};
export const resolveSoraDuration = (seconds: number): 4 | 8 | 12 => {
  if (seconds <= 4) return 4;
  if (seconds <= 8) return 8;
  return 12;
};
export const resolveSeedreamImageSize = (aspect: string): string => {
  const normalized = aspect.trim();
  if (normalized === "1:1") return "square";
  if (normalized === "3:4" || normalized === "4:5" || normalized === "5:4") return "portrait_4_3";
  if (
    normalized === "4:3" ||
    normalized === "3:2" ||
    normalized === "21:9" ||
    normalized === "16:9"
  )
    return "landscape_16_9";
  if (normalized === "9:16" || normalized === "2:3") return "portrait_16_9";
  return "landscape_16_9";
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

export const isVideoUrl = (url: string | null | undefined) =>
  !!url &&
  (/\.mp4(\?|$)/i.test(url) ||
    url.includes("/video") ||
    url.includes("video=") ||
    (url.startsWith("blob:") && url.includes("video=1")));

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

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const extractUrlObjects = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asText(toRecord(item).url))
    .filter((url): url is string => Boolean(url));
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

/**
 * Converts a File to a data URL (base64) for persistent preview storage.
 * This avoids blob URL lifecycle issues where URLs can expire.
 */
const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const mapUploadsFromFiles = async (
  files: FileList,
  mode: StudioMode,
  aspect: string,
  model: string | null,
  resolveModelLabelFn: (value?: string) => string,
  randomIdFn: () => string
): Promise<StudioOutput[]> => {
  const mediaFiles = Array.from(files).filter(
    (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
  );

  const outputs = await Promise.all(
    mediaFiles.map(async (file) => {
      const dataUrl = await readFileAsDataUrl(file);
      const isVideo = file.type.startsWith("video/");
      // Add video marker to data URL for type detection
      const url = isVideo
        ? dataUrl.includes("?")
          ? `${dataUrl}&video=1`
          : `${dataUrl}#video=1`
        : dataUrl;

      return {
        id: `upload-${randomIdFn()}`,
        prompt: file.name,
        mode,
        aspect,
        model: resolveModelLabelFn(model ?? undefined),
        modelId: model ?? undefined,
        status: "ready" as const,
        timestamp: "Dropped",
        previewUrl: url,
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
    if (selectedTool === "image") return "image";
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
  if ((selectedTool === "create" || selectedTool === "text") && mode === "image") {
    filtered = filtered.filter((opt) => opt.value !== "fal/flux-2-pro");
  }
  if (selectedTool === "image") {
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
    const images = extractUrlObjects(toRecord(candidate).images);
    if (images.length) return images;
  }
  return [];
};

const extractVideoUrlsFrom = (candidate: unknown): string[] => {
  const candidateRecord = toRecord(candidate);
  const videos = extractUrlObjects(candidateRecord.videos);
  if (videos.length) return videos;
  const videoUrl =
    asText(toRecord(candidateRecord.video).url) ||
    asText(candidateRecord.video_url) ||
    asText(toRecord(toRecord(candidateRecord.assets).video).url) ||
    asText(candidateRecord.download_url);
  return videoUrl ? [videoUrl] : [];
};

export const extractFalMediaUrls = (status: unknown): string[] => {
  const imageUrls = extractFalUrls(status);
  if (imageUrls.length) return imageUrls;
  const candidates = collectFalCandidates(status);
  for (const candidate of candidates) {
    const videoUrls = extractVideoUrlsFrom(candidate);
    if (videoUrls.length) return videoUrls;
  }
  return [];
};

export const extractResultUrls = (
  resultJson: KeiTaskStatus["resultJson"],
  fallback?: unknown
): string[] => {
  const extractGenericUrls = (value: unknown): string[] => {
    const record = toRecord(value);
    const directUrls = asStringArray(record.resultUrls);
    if (directUrls.length) return directUrls;
    const infoUrls = asStringArray(toRecord(record.info).result_urls);
    if (infoUrls.length) return infoUrls;
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
