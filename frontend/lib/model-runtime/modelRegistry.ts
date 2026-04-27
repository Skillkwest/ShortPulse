/**
 * Registry compatibility layer derived from the canonical model catalog.
 */
import type { ElevenLabsModelPricingAuthority } from "./elevenLabsModels";
import {
  getModelCatalogEntry,
  listModelCatalogEntries,
  type ModelCatalogEntry,
  type ModelCatalogMediaType,
  type ModelProvider,
} from "./modelCatalog";
import { type AspectSize, falImageSizeMap } from "./modelSizes";
import type { PricingStrategyId } from "./pricingTypes";

export type ModelPricingAuthority = "shared_policy" | ElevenLabsModelPricingAuthority;

export type ModelConfig = {
  id: string;
  label: string;
  provider: ModelProvider | "other";
  mediaType: ModelCatalogMediaType;
  defaultAspect: string;
  allowedAspects: string[];
  pricingStrategy?: PricingStrategyId;
  pricingAuthority?: ModelPricingAuthority;
  sizeMap?: Record<string, AspectSize>;
  defaultDurationSeconds?: number;
  defaultGenerationCount?: number;
  defaultSourceDurationSeconds?: number;
  defaultTextCharacters?: number;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  defaultResolution?: string;
  defaultAudio?: boolean;
  allowedResolutions?: string[];
  allowedDurations?: number[];
  supportsTextToImage?: boolean;
  supportsImageToImage?: boolean;
  supportsImageToVideo?: boolean;
};

type RegistryReadyCatalogEntry = ModelCatalogEntry & {
  label: string;
  mediaType: ModelCatalogMediaType;
};

const isRegistryReadyCatalogEntry = (
  entry: ReturnType<typeof getModelCatalogEntry>
): entry is RegistryReadyCatalogEntry =>
  entry !== null &&
  typeof entry.label === "string" &&
  entry.label.length > 0 &&
  Boolean(entry.mediaType);

const resolveCatalogSizeMap = (
  entry: RegistryReadyCatalogEntry
): Record<string, AspectSize> | undefined => {
  if (entry.sizeMapId === "fal-image") return falImageSizeMap;
  return undefined;
};

const buildModelConfig = (entry: RegistryReadyCatalogEntry): ModelConfig => ({
  id: entry.modelId,
  label: entry.label,
  provider: entry.provider,
  mediaType: entry.mediaType,
  defaultAspect: entry.defaultAspect,
  allowedAspects: entry.allowedAspects,
  pricingStrategy: entry.pricingStrategy,
  pricingAuthority: entry.pricingAuthority,
  sizeMap: resolveCatalogSizeMap(entry),
  defaultDurationSeconds: entry.defaultDurationSeconds,
  defaultGenerationCount: entry.defaultGenerationCount,
  defaultSourceDurationSeconds: entry.defaultSourceDurationSeconds,
  defaultTextCharacters: entry.defaultTextCharacters,
  minDurationSeconds: entry.minDurationSeconds,
  maxDurationSeconds: entry.maxDurationSeconds,
  defaultResolution: entry.defaultResolution,
  defaultAudio: entry.defaultAudio,
  allowedResolutions: entry.allowedResolutions,
  allowedDurations: entry.allowedDurations,
  supportsTextToImage: entry.supportsTextToImage,
  supportsImageToImage: entry.supportsImageToImage,
  supportsImageToVideo: entry.supportsImageToVideo,
});

const registryConfigs: ModelConfig[] = listModelCatalogEntries()
  .filter(isRegistryReadyCatalogEntry)
  .map(buildModelConfig);

const registry: Record<string, ModelConfig> = Object.fromEntries(
  registryConfigs.map((config) => [config.id, config])
);

export const getModelConfig = (id: string): ModelConfig | null => registry[id] ?? null;

export const listModelConfigs = (): ModelConfig[] => Object.values(registry);
