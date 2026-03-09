/**
 * AI Studio session snapshot hydrator.
 * Normalizes persisted snapshot payloads into safe in-memory state values.
 */
import type { AiStudioSessionOutputV1, AiStudioSessionSnapshotV1 } from "./sessionSnapshot";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import type { AgentMessage, AgentMessageRole } from "../../../prefabs/agent/types";

const FALLBACK_MODE: StudioMode = "text";
const FALLBACK_ASPECT = "9:16";
const FALLBACK_VIDEO_REFERENCE_MODE = "standard" as const;
const FALLBACK_VIDEO_DURATION_SECONDS = 6;
const FALLBACK_VIDEO_RESOLUTION = "1080p";
const FALLBACK_IMAGE_RESOLUTION = "model_default";
const FALLBACK_KLING_CFG_SCALE = 0.5;
const FALLBACK_KLING_SHOT_TYPE = "customize" as const;
const FALLBACK_PROMPT_ORIGIN = "manual" as const;

const TOOL_IDS = new Set<ToolId>([
  "create",
  "media-library",
  "workflows",
  "presets",
  "styles",
  "templates",
  "my-generations",
  "community",
  "character",
  "image",
  "video",
  "text",
  "kling",
  "edit",
  "canvas",
]);

const asString = (value: unknown, fallback = ""): string => {
  return typeof value === "string" ? value : fallback;
};

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  return value;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const asMode = (value: unknown): StudioMode => {
  return value === "text" || value === "image" || value === "video" ? value : FALLBACK_MODE;
};

const asToolId = (value: unknown): ToolId | null => {
  if (typeof value !== "string") return null;
  return TOOL_IDS.has(value as ToolId) ? (value as ToolId) : null;
};

const asVideoReferenceMode = (value: unknown): "standard" | "keyframes" | "kling3" | "motion" => {
  return value === "standard" || value === "keyframes" || value === "kling3" || value === "motion"
    ? value
    : FALLBACK_VIDEO_REFERENCE_MODE;
};

const asFiniteNumber = (value: unknown, fallback: number): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const asBoolean = (value: unknown, fallback = false): boolean => {
  return typeof value === "boolean" ? value : fallback;
};

const asPromptOrigin = (value: unknown): "manual" | "agent" | "reference" => {
  return value === "manual" || value === "agent" || value === "reference"
    ? value
    : FALLBACK_PROMPT_ORIGIN;
};

const asAgentRole = (value: unknown): AgentMessageRole | null => {
  if (value === "user" || value === "assistant" || value === "system" || value === "observation") {
    return value;
  }
  return null;
};

const asKlingShotType = (value: unknown): "customize" | "intelligent" => {
  return value === "customize" || value === "intelligent" ? value : FALLBACK_KLING_SHOT_TYPE;
};

const asExtraImageUrls = (value: unknown): [string | null, string | null, string | null] => {
  if (!Array.isArray(value)) return [null, null, null];
  return [asNullableString(value[0]), asNullableString(value[1]), asNullableString(value[2])];
};

const asKlingVoiceIds = (value: unknown): [string, string] => {
  if (!Array.isArray(value)) return ["", ""];
  return [asString(value[0], ""), asString(value[1], "")];
};

const asKlingMultiPrompts = (
  value: unknown
): { id: string; prompt: string; duration: number }[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        id: asString(row.id, `kling-shot-${index}`),
        prompt: asString(row.prompt, ""),
        duration: Math.max(1, Math.trunc(asFiniteNumber(row.duration, 5))),
      };
    })
    .filter((item): item is { id: string; prompt: string; duration: number } => Boolean(item));
};

const asKlingElements = (
  value: unknown
): { id: string; frontalImageUrl: string; referenceImageUrls: string; videoUrl: string }[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        id: asString(row.id, `kling-element-${index}`),
        frontalImageUrl: asString(row.frontalImageUrl, ""),
        referenceImageUrls: asString(row.referenceImageUrls, ""),
        videoUrl: asString(row.videoUrl, ""),
      };
    })
    .filter(
      (
        item
      ): item is {
        id: string;
        frontalImageUrl: string;
        referenceImageUrls: string;
        videoUrl: string;
      } => Boolean(item)
    );
};

const hydrateOutput = (output: AiStudioSessionOutputV1): StudioOutput => ({
  id: output.id,
  prompt: output.prompt,
  mode: asMode(output.mode),
  aspect: typeof output.aspect === "string" ? output.aspect : FALLBACK_ASPECT,
  model: output.model,
  modelId: output.modelId,
  provider: output.provider,
  generationId: output.generationId,
  promptId: output.promptId,
  savedMediaIds: output.savedMediaIds,
  saveState: output.saveState,
  saveError: output.saveError ?? null,
  status: output.status,
  timestamp: output.timestamp,
  taskId: output.taskId,
  taskState: output.taskState,
  errorMessage: output.errorMessage ?? null,
  errorMessageShort: output.errorMessageShort ?? null,
  resultUrls: output.resultUrls,
  previewUrl: output.previewUrl,
  previewStoragePath: output.previewStoragePath ?? null,
  fullStoragePath: output.fullStoragePath ?? null,
  previewTier: output.previewTier,
  mediaSource: output.mediaSource,
  previewText: output.previewText,
  pinned: output.pinned,
  hiddenInReferenceGrid: output.hiddenInReferenceGrid,
  archivedAt: output.archivedAt ?? null,
  archiveReason: output.archiveReason ?? null,
  characterContext: output.characterContext,
  generationReplay: output.generationReplay,
});

const dedupeOutputs = (rows: StudioOutput[]): StudioOutput[] => {
  const byId = new Map<string, StudioOutput>();
  rows.forEach((row) => {
    if (!row.id) return;
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  });
  return [...byId.values()];
};

const normalizeAgentMessages = (value: unknown): AgentMessage[] => {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const normalized: AgentMessage[] = [];
  value.forEach((row, index) => {
    if (!row || typeof row !== "object") return;
    const message = row as Record<string, unknown>;
    const role = asAgentRole(message.role);
    if (!role) return;
    const content = asString(message.content, "").trim();
    if (!content) return;

    const candidateId = asString(message.id, "").trim();
    let resolvedId = candidateId || `agent-${role}-restored-${index}`;
    if (seenIds.has(resolvedId)) {
      let collisionIndex = 1;
      let nextId = `${resolvedId}-${collisionIndex}`;
      while (seenIds.has(nextId)) {
        collisionIndex += 1;
        nextId = `${resolvedId}-${collisionIndex}`;
      }
      resolvedId = nextId;
    }
    seenIds.add(resolvedId);
    normalized.push({
      id: resolvedId,
      role,
      content,
    });
  });
  return normalized;
};

export type AiStudioSessionHydrationPayload = {
  workspace: {
    mode: StudioMode;
    selectedTool: ToolId | null;
    prompt: string;
    model: string | null;
    aspect: string;
    referenceImageUrl: string | null;
    extraImageUrls: [string | null, string | null, string | null];
    editReferenceText: string;
    videoReferenceText: string;
    videoReferenceMode: "standard" | "keyframes" | "kling3" | "motion";
    videoDurationSeconds: number;
    videoResolution: string;
    imageResolution: string;
    videoGenerateAudio: boolean;
    videoCameraFixed: boolean;
    videoAutoFix: boolean;
    klingNegativePrompt: string;
    klingCfgScale: number;
    klingShotType: "customize" | "intelligent";
    klingVoiceIds: [string, string];
    klingMultiPrompts: { id: string; prompt: string; duration: number }[];
    klingElements: {
      id: string;
      frontalImageUrl: string;
      referenceImageUrls: string;
      videoUrl: string;
    }[];
    motionReferenceVideoUrl: string | null;
  };
  outputs: {
    active: StudioOutput[];
    archived: StudioOutput[];
    activeOutputId: string | null;
    curatedReferenceIds: string[];
    removedFromAllRefsIds: string[];
  };
  agent: {
    messages: AgentMessage[];
    input: string;
    latestAgentPrompt: string | null;
    promptOrigin: "manual" | "agent" | "reference";
    chatModeEnabled: boolean;
  };
};

/**
 * Builds normalized state payload used by snapshot hydration apply paths.
 */
export const buildAiStudioSessionHydrationPayload = (
  snapshot: AiStudioSessionSnapshotV1
): AiStudioSessionHydrationPayload => {
  const workspace = snapshot.workspace ?? ({} as AiStudioSessionSnapshotV1["workspace"]);
  const outputs = snapshot.outputs ?? ({} as AiStudioSessionSnapshotV1["outputs"]);
  const agent = snapshot.agent ?? ({} as AiStudioSessionSnapshotV1["agent"]);

  const activeOutputs = dedupeOutputs((outputs.active ?? []).map(hydrateOutput));
  const archivedOutputs = dedupeOutputs((outputs.archived ?? []).map(hydrateOutput));
  const allOutputIds = new Set<string>([
    ...activeOutputs.map((row) => row.id),
    ...archivedOutputs.map((row) => row.id),
  ]);

  const candidateActiveOutputId = asNullableString(outputs.activeOutputId);
  const activeOutputId =
    candidateActiveOutputId && allOutputIds.has(candidateActiveOutputId)
      ? candidateActiveOutputId
      : null;

  return {
    workspace: {
      mode: asMode(workspace.mode),
      selectedTool: asToolId(workspace.selectedTool),
      prompt: asString(workspace.prompt, ""),
      model: asNullableString(workspace.model),
      aspect: asString(workspace.aspect, FALLBACK_ASPECT),
      referenceImageUrl: asNullableString(workspace.referenceImageUrl),
      extraImageUrls: asExtraImageUrls(workspace.extraImageUrls),
      editReferenceText: asString(workspace.editReferenceText, ""),
      videoReferenceText: asString(workspace.videoReferenceText, ""),
      videoReferenceMode: asVideoReferenceMode(workspace.videoReferenceMode),
      videoDurationSeconds: Math.max(
        1,
        Math.trunc(asFiniteNumber(workspace.videoDurationSeconds, FALLBACK_VIDEO_DURATION_SECONDS))
      ),
      videoResolution: asString(workspace.videoResolution, FALLBACK_VIDEO_RESOLUTION),
      imageResolution: asString(workspace.imageResolution, FALLBACK_IMAGE_RESOLUTION),
      videoGenerateAudio: asBoolean(workspace.videoGenerateAudio),
      videoCameraFixed: asBoolean(workspace.videoCameraFixed),
      videoAutoFix: asBoolean(workspace.videoAutoFix),
      klingNegativePrompt: asString(workspace.klingNegativePrompt, ""),
      klingCfgScale: asFiniteNumber(workspace.klingCfgScale, FALLBACK_KLING_CFG_SCALE),
      klingShotType: asKlingShotType(workspace.klingShotType),
      klingVoiceIds: asKlingVoiceIds(workspace.klingVoiceIds),
      klingMultiPrompts: asKlingMultiPrompts(workspace.klingMultiPrompts),
      klingElements: asKlingElements(workspace.klingElements),
      motionReferenceVideoUrl: asNullableString(workspace.motionReferenceVideoUrl),
    },
    outputs: {
      active: activeOutputs,
      archived: archivedOutputs,
      activeOutputId,
      curatedReferenceIds: asStringArray(outputs.curatedReferenceIds).filter((id) =>
        allOutputIds.has(id)
      ),
      removedFromAllRefsIds: asStringArray(outputs.removedFromAllRefsIds).filter((id) =>
        allOutputIds.has(id)
      ),
    },
    agent: {
      messages: normalizeAgentMessages(agent.messages),
      input: asString(agent.input, ""),
      latestAgentPrompt: asNullableString(agent.latestAgentPrompt),
      promptOrigin: asPromptOrigin(agent.promptOrigin),
      chatModeEnabled: asBoolean(agent.chatModeEnabled, true),
    },
  };
};
