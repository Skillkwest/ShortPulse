/**
 * Registry compatibility layer derived from the canonical model catalog.
 */
import type { ElevenLabsModelPricingAuthority } from "./elevenLabsModels";
import {
  getModelCatalogEntry,
  listModelCatalogEntries,
  type GenerationExecutionMode,
  type GenerationSubmitHandler,
  type GenerationWorkflowLane,
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
  sourceUrl?: string;
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
  generationLanes?: GenerationWorkflowLane[];
  executionMode?: GenerationExecutionMode;
  submitHandler?: GenerationSubmitHandler;
  gridEligible?: boolean;
  apiRouteSlug?: string;
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
  sourceUrl: entry.sourceUrl,
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
  generationLanes: entry.generationLanes,
  executionMode: entry.executionMode,
  submitHandler: entry.submitHandler,
  gridEligible: entry.gridEligible,
  apiRouteSlug: entry.apiRouteSlug,
});

const registryConfigs: ModelConfig[] = listModelCatalogEntries()
  .filter(isRegistryReadyCatalogEntry)
  .map(buildModelConfig);

const registry: Record<string, ModelConfig> = Object.fromEntries(
  registryConfigs.map((config) => [config.id, config])
);

const registryByApiRouteSlug: Record<string, ModelConfig> = Object.fromEntries(
  registryConfigs
    .filter((config): config is ModelConfig & { apiRouteSlug: string } =>
      Boolean(config.apiRouteSlug)
    )
    .map((config) => [config.apiRouteSlug, config])
);

export const getModelConfig = (id: string): ModelConfig | null => registry[id] ?? null;

export const getModelConfigByApiRouteSlug = (slug: string): ModelConfig | null =>
  registryByApiRouteSlug[slug] ?? null;

export const listModelConfigs = (): ModelConfig[] => Object.values(registry);
