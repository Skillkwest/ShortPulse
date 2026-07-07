/**
 * Adapts explicit saved media workflow reload metadata into the AI Studio reload contract.
 */
import type { StudioOutput, WorkflowReloadConfigV1, WorkflowReloadMediaKindHint } from "../types";
import { resolveMediaRowKind } from "../../../lib/mediaRowKind";
import {
  resolveMediaFileRowDurationMs,
  resolveMediaMetadataModelId,
  type MediaFileRow,
} from "./mediaLibraryModalModel";
import { isGenerationReplayConfigV1, isGenerationReplayConfigV2 } from "./generationReplay";
import { canRerollOutput } from "./workflowReroll";
import { canReloadWorkflowOutput, isWorkflowReloadConfigV1 } from "./workflowReload";

const AI_STUDIO_MEDIA_SOURCE = "ai_studio";

const modeFromFileType = (
  fileType: string | null | undefined
): WorkflowReloadMediaKindHint | null => {
  const normalized = (fileType ?? "").toLowerCase();
  if (normalized.startsWith("image")) return "image";
  if (normalized.startsWith("video")) return "video";
  if (normalized.startsWith("audio")) return "audio";
  return null;
};

export const resolveMediaLibraryWorkflowReloadMediaKindHint = (
  file: MediaFileRow
): WorkflowReloadMediaKindHint | null => {
  const rowKind = resolveMediaRowKind(file);
  if (rowKind !== "unknown") return rowKind;
  const workflowMode = resolveMediaLibraryWorkflowReloadConfig(file.metadata)?.outputMode;
  return modeFromFileType(workflowMode);
};

const aspectFromWorkflowReload = (config: WorkflowReloadConfigV1): string => {
  if (config.payload.kind === "image" || config.payload.kind === "video") {
    return config.payload.aspect;
  }
  return "auto";
};

const resolveSavedMediaWorkflowMode = (
  file: MediaFileRow,
  config: WorkflowReloadConfigV1
): StudioOutput["mode"] => {
  const rowKind = resolveMediaRowKind(file);
  if (rowKind !== "unknown") return rowKind;
  return config.outputMode;
};

const resolveSavedMediaWorkflowModelId = (
  file: MediaFileRow,
  config: WorkflowReloadConfigV1
): string => resolveMediaMetadataModelId(file.metadata) ?? config.model.id;

export const resolveMediaLibraryWorkflowReloadConfig = (
  metadata: Record<string, unknown> | null | undefined
): WorkflowReloadConfigV1 | null => {
  const candidate = metadata?.workflow_reload;
  return isWorkflowReloadConfigV1(candidate) ? candidate : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const resolveMediaLibraryGenerationReplayConfig = (
  metadata: Record<string, unknown> | null | undefined
): StudioOutput["generationReplay"] | null => {
  const candidate = metadata?.generation_replay ?? metadata?.generationReplay;
  return isGenerationReplayConfigV1(candidate) || isGenerationReplayConfigV2(candidate)
    ? candidate
    : null;
};

export const resolveMediaLibraryCharacterContext = (
  metadata: Record<string, unknown> | null | undefined,
  config: WorkflowReloadConfigV1 | null = resolveMediaLibraryWorkflowReloadConfig(metadata)
): StudioOutput["characterContext"] | null => {
  const candidate =
    asRecord(metadata?.character_context) ??
    asRecord(metadata?.characterContext) ??
    (config?.payload.kind === "image" ? asRecord(config.payload.characterContext) : null);
  return candidate?.applied === true ? (candidate as StudioOutput["characterContext"]) : null;
};

export const resolveMediaLibraryStyleContext = (
  metadata: Record<string, unknown> | null | undefined,
  config: WorkflowReloadConfigV1 | null = resolveMediaLibraryWorkflowReloadConfig(metadata)
): StudioOutput["styleContext"] | null => {
  const candidate =
    asRecord(metadata?.style_context) ??
    asRecord(metadata?.styleContext) ??
    (config?.payload.kind === "image" || config?.payload.kind === "video"
      ? asRecord(config.payload.styleContext)
      : null);
  return candidate?.applied === true ? (candidate as StudioOutput["styleContext"]) : null;
};

export const createMediaLibraryWorkflowReloadOutput = (file: MediaFileRow): StudioOutput | null => {
  if (file.source !== AI_STUDIO_MEDIA_SOURCE) return null;
  const config = resolveMediaLibraryWorkflowReloadConfig(file.metadata);
  if (!config) return null;

  const timestamp = file.created_at ?? config.capturedAt;
  const previewUrl = file.signedUrl?.trim() || undefined;
  const storagePath = file.storage_path?.trim() || null;
  const generationId = file.source_ref?.trim() || undefined;
  const mode = resolveSavedMediaWorkflowMode(file, config);
  const modelId = resolveSavedMediaWorkflowModelId(file, config);
  const generationReplay = resolveMediaLibraryGenerationReplayConfig(file.metadata);
  const characterContext = resolveMediaLibraryCharacterContext(file.metadata, config);
  const styleContext = resolveMediaLibraryStyleContext(file.metadata, config);

  return {
    id: `media-library:${file.id}`,
    prompt: config.prompt.display,
    mode,
    aspect: aspectFromWorkflowReload(config),
    model: modelId,
    modelId,
    createdAt: file.created_at ?? config.capturedAt,
    generationId,
    savedMediaIds: [file.id],
    status: "ready",
    timestamp,
    previewUrl,
    previewStoragePath: file.preview_variant_path ?? file.thumb_variant_path ?? storagePath,
    previewPosterStoragePath: file.poster_variant_path ?? null,
    fullStoragePath: storagePath,
    mimeType: file.file_type ?? null,
    width: file.width ?? null,
    height: file.height ?? null,
    durationMs: resolveMediaFileRowDurationMs(file),
    mediaSource: "generated",
    saveState: "saved",
    workflowReload: config,
    generationReplay: generationReplay ?? undefined,
    characterContext: characterContext ?? undefined,
    styleContext: styleContext ?? undefined,
  };
};

export const canReloadMediaLibraryWorkflow = (file: MediaFileRow): boolean => {
  const output = createMediaLibraryWorkflowReloadOutput(file);
  if (!output) return false;
  return canReloadWorkflowOutput(output, {
    mediaKindHint: resolveMediaLibraryWorkflowReloadMediaKindHint(file),
  });
};

export const canRerollMediaLibraryWorkflow = (file: MediaFileRow): boolean => {
  const output = createMediaLibraryWorkflowReloadOutput(file);
  if (!output) return false;
  return canRerollOutput(output, {
    mediaKindHint: resolveMediaLibraryWorkflowReloadMediaKindHint(file),
  });
};
