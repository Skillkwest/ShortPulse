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
import type { KeiTaskStatus } from "../../../lib/keiClient";
import type { FalKlingTextSubmitRequest } from "../../../lib/falClient";

export type Provider =
  | "kei"
  | "fal"
  | "fal-flux2"
  | "fal-flux2-edit"
  | "fal-flux2-pro"
  | "fal-flux2-pro-edit"
  | "fal-flux2-max"
  | "fal-imagen4-fast"
  | "fal-kling"
  | "fal-kling-25"
  | "fal-nano-banana"
  | "fal-nano-banana-edit"
  | "fal-nano-banana-pro"
  | "fal-nano-banana-pro-edit"
  | "fal-sora"
  | "fal-seedance"
  | "fal-seedream"
  | "fal-veo";

export const resolveModelLabel = (value?: string) =>
  value ? modelOptions.find((opt) => opt.value === value)?.label ?? `Custom (${value})` : "Select model here";

export const normalizeAspectForKei = (value: string) => (keiAllowedAspects.has(value) ? value : "auto");
export const normalizeAspectForFalNanoBanana = (value: string) => (falNanoBananaAllowedAspects.has(value) ? value : "1:1");
export const normalizeAspectForFalNanoBananaPro = (value: string) => (falNanoBananaProAllowedAspects.has(value) ? value : "4:5");
export const resolveKlingAspectRatio = (value: string): FalKlingTextSubmitRequest["aspect_ratio"] =>
  (klingAllowedAspects.has(value) ? (value as FalKlingTextSubmitRequest["aspect_ratio"]) : "16:9");
export const resolveKlingDuration = (seconds: number): FalKlingTextSubmitRequest["duration"] => (seconds <= 5 ? 5 : 10);
export const resolveSoraDuration = (seconds: number): 4 | 8 | 12 => {
  if (seconds <= 4) return 4;
  if (seconds <= 8) return 8;
  return 12;
};
export const resolveSeedreamImageSize = (aspect: string): string => {
  const normalized = aspect.trim();
  if (normalized === "1:1") return "square";
  if (normalized === "3:4" || normalized === "4:5" || normalized === "5:4") return "portrait_4_3";
  if (normalized === "4:3" || normalized === "3:2" || normalized === "21:9" || normalized === "16:9") return "landscape_16_9";
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
  !!url && (/\.mp4(\?|$)/i.test(url) || url.includes("/video") || url.includes("video="));

export const mapAgentReferences = (outputs: any[], activeOutputId: string | null) => {
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

export const mapAgentMedia = (outputs: any[]) =>
  outputs
    .filter((item) => item.previewUrl)
    .map((item) => ({
      id: item.id,
      kind: isVideoUrl(item.previewUrl) ? "video" : "image",
      url: item.previewUrl ?? undefined,
      thumbnailAlt: item.prompt ?? item.previewText ?? null,
    }));

export const mapUploadsFromFiles = (files: FileList, mode: any, aspect: string, model: string | null, resolveModelLabelFn: (value?: string) => string, randomIdFn: () => string) => {
  const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
  return imageFiles.map((file) => {
    const url = URL.createObjectURL(file);
    return {
      id: `upload-${randomIdFn()}`,
      prompt: file.name,
      mode,
      aspect,
      model: resolveModelLabelFn(model ?? undefined),
      modelId: model,
      status: "ready" as const,
      timestamp: "Dropped",
      previewUrl: url,
    };
  });
};

export const filterModelOptions = (
  mode: string,
  selectedTool: string | null,
  options: { value: string; label: string; mediaType?: string | null }[],
  getModelConfig: (id: string) => any,
) => {
  const mediaFilter = (() => {
    if (selectedTool === "create" || selectedTool === "text") {
      if (mode === "image") return "image";
      if (mode === "video") return "video";
    }
    if (selectedTool === "video") return "video";
    if (selectedTool === "image") return "image";
    return null;
  })();

  let filtered = options;
  if (mediaFilter) {
    filtered = filtered.filter((opt) => !opt.mediaType || opt.mediaType === mediaFilter || opt.mediaType === "multi");
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

export const resolvePreviewUrlById = (outputs: any[], id: string | null | undefined) =>
  outputs.find((item) => item.id === id)?.previewUrl ?? null;

export const extractFalUrls = (status: any): string[] => {
  const direct = status?.images;
  if (Array.isArray(direct) && direct[0]?.url) return direct.map((img) => img?.url).filter(Boolean) as string[];
  const nested = status?.data?.images;
  if (Array.isArray(nested) && nested[0]?.url) return nested.map((img) => img?.url).filter(Boolean) as string[];
  const output = status?.output?.images;
  if (Array.isArray(output) && output[0]?.url) return output.map((img) => img?.url).filter(Boolean) as string[];
  return [];
};

export const extractFalMediaUrls = (status: any): string[] => {
  const imageUrls = extractFalUrls(status);
  if (imageUrls.length) return imageUrls;
  const videos = status?.videos || status?.data?.videos || status?.output?.videos || status?.result?.videos;
  if (Array.isArray(videos) && videos[0]?.url) {
    return videos.map((vid) => vid?.url).filter(Boolean) as string[];
  }
  const videoUrl =
    status?.video?.url ||
    status?.data?.video?.url ||
    status?.output?.video?.url ||
    status?.result?.video?.url ||
    status?.data?.result?.video?.url ||
    status?.video_url ||
    status?.data?.video_url ||
    status?.output?.video_url ||
    status?.result?.video_url ||
    status?.data?.result?.video_url;
  return videoUrl ? [videoUrl] : [];
};

export const extractResultUrls = (resultJson: KeiTaskStatus["resultJson"], fallback?: unknown): string[] => {
  if (!resultJson && fallback && typeof fallback === "object") {
    const urls = (fallback as any)?.resultUrls || (fallback as any)?.info?.result_urls;
    if (Array.isArray(urls)) return urls as string[];
    const videos = (fallback as any)?.videos || (fallback as any)?.data?.videos || (fallback as any)?.output?.videos;
    if (Array.isArray(videos) && videos[0]?.url) {
      return videos.map((vid: any) => vid?.url).filter(Boolean) as string[];
    }
    const videoUrl =
      (fallback as any)?.video?.url ||
      (fallback as any)?.data?.video?.url ||
      (fallback as any)?.output?.video?.url ||
      (fallback as any)?.video_url ||
      (fallback as any)?.data?.video_url ||
      (fallback as any)?.output?.video_url;
    if (videoUrl) return [videoUrl];
  }
  if (!resultJson) return [];
  if (typeof resultJson === "string") {
    try {
      const parsed = JSON.parse(resultJson);
      return extractResultUrls(parsed as any);
    } catch (_error) {
      return [];
    }
  }
  if (typeof resultJson === "object" && resultJson) {
    const urls = (resultJson as any)?.resultUrls || (resultJson as any)?.info?.result_urls;
    if (Array.isArray(urls)) return urls as string[];
    const videos = (resultJson as any)?.videos || (resultJson as any)?.data?.videos || (resultJson as any)?.output?.videos;
    if (Array.isArray(videos) && videos[0]?.url) {
      return videos.map((vid: any) => vid?.url).filter(Boolean) as string[];
    }
    const videoUrl =
      (resultJson as any)?.video?.url ||
      (resultJson as any)?.data?.video?.url ||
      (resultJson as any)?.output?.video?.url ||
      (resultJson as any)?.video_url ||
      (resultJson as any)?.data?.video_url ||
      (resultJson as any)?.output?.video_url;
    if (videoUrl) return [videoUrl];
  }
  return [];
};
