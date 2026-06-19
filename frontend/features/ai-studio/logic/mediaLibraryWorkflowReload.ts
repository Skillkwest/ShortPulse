/**
 * Adapts explicit saved media workflow reload metadata into the AI Studio reload contract.
 */
import type { StudioOutput, WorkflowReloadConfigV1, WorkflowReloadMediaKindHint } from "../types";
import { resolveMediaRowKind } from "../../../lib/mediaRowKind";
import { resolveMediaMetadataModelId, type MediaFileRow } from "./mediaLibraryModalModel";
import { isWorkflowReloadConfigV1 } from "./workflowReload";

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
    mediaSource: "generated",
    saveState: "saved",
    workflowReload: config,
  };
};

export const canReloadMediaLibraryWorkflow = (file: MediaFileRow): boolean =>
  createMediaLibraryWorkflowReloadOutput(file) != null;
