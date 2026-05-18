import type {
  AgentContext,
  AgentMessage,
  AgentPulseWorkflowSession,
  AgentRuntimeMode,
} from "../../prefabs/agent";
import {
  AGENT_MEDIA_MAX_ITEMS,
  pickSafeAgentImageMediaUrls,
} from "../../prefabs/agent/mediaUrlPolicy";
import { removeAspectRatioLanguage, sanitizeGenerationPromptText } from "../agent-core/promptText";

const MAX_MESSAGES = 24;
export const STUDIO_AGENT_MAX_MEDIA = AGENT_MEDIA_MAX_ITEMS;
const GUIDED_PULSE_KIND = "guided_workflow" as const;
const CUSTOM_PULSE_KIND = "custom_gpt" as const;
const GUIDED_PULSE_RUNTIME_MODE = "workflow_gpt" as const;
const CUSTOM_PULSE_RUNTIME_MODE = "custom_gpt" as const;
const DEFAULT_PULSE_ACTIVATION_MODE = "activate_and_start" as const;
const DEFAULT_PULSE_OUTPUT_MODE = "chat_reply" as const;
const DEFAULT_PULSE_SCHEMA_VERSION = 2 as const;

export const STUDIO_AGENT_MAX_TEXT_REQUEST_BYTES = 512 * 1024;
export const STUDIO_AGENT_MAX_MIXED_REQUEST_BYTES = 1536 * 1024;
export const STUDIO_AGENT_SESSION_KEY_MAX_CHARS = 160;
export const STUDIO_AGENT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const STUDIO_AGENT_RATE_LIMIT_MAX_REQUESTS = 24;
export const STUDIO_AGENT_RATE_LIMIT_MAX_TRACKED_USERS = 5000;

type RateLimitBucket = {
  timestamps: number[];
  lastSeenAt: number;
};

const requestTimestampsByUser = new Map<string, RateLimitBucket>();

const pruneRateLimitBuckets = (): void => {
  if (requestTimestampsByUser.size <= STUDIO_AGENT_RATE_LIMIT_MAX_TRACKED_USERS) return;
  const excess = requestTimestampsByUser.size - STUDIO_AGENT_RATE_LIMIT_MAX_TRACKED_USERS;
  const bucketsByLastSeen = [...requestTimestampsByUser.entries()].sort(
    (a, b) => a[1].lastSeenAt - b[1].lastSeenAt
  );
  for (let index = 0; index < excess; index += 1) {
    const oldestUserId = bucketsByLastSeen[index]?.[0];
    if (!oldestUserId) break;
    requestTimestampsByUser.delete(oldestUserId);
  }
};

export const isStudioAgentRateLimited = (userId: string): boolean => {
  pruneRateLimitBuckets();
  const now = Date.now();
  const windowStart = now - STUDIO_AGENT_RATE_LIMIT_WINDOW_MS;
  const bucket = requestTimestampsByUser.get(userId);
  const history = (bucket?.timestamps ?? []).filter((value) => value >= windowStart);
  if (history.length >= STUDIO_AGENT_RATE_LIMIT_MAX_REQUESTS) {
    requestTimestampsByUser.set(userId, {
      timestamps: history,
      lastSeenAt: now,
    });
    return true;
  }
  history.push(now);
  requestTimestampsByUser.set(userId, {
    timestamps: history,
    lastSeenAt: now,
  });
  return false;
};

export const readStudioAgentRequestBodyBytes = (body: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(body ?? {}), "utf8");
  } catch {
    return 0;
  }
};

export const resolveStudioAgentMaxRequestBytes = (body: unknown): number => {
  const candidate = body as { context?: { media?: unknown[] } } | undefined;
  const hasMediaPayload =
    Array.isArray(candidate?.context?.media) && candidate.context.media.length > 0;
  return hasMediaPayload
    ? STUDIO_AGENT_MAX_MIXED_REQUEST_BYTES
    : STUDIO_AGENT_MAX_TEXT_REQUEST_BYTES;
};

export const parseStudioAgentSessionKey = (
  rawSessionKey: unknown
):
  | { ok: true; sessionKey: string }
  | { ok: false; message: string; details?: Record<string, unknown> } => {
  const sessionKey = typeof rawSessionKey === "string" ? rawSessionKey.trim() : "";
  if (!sessionKey) {
    return { ok: false, message: "clientSessionKey is required" };
  }
  if (sessionKey.length > STUDIO_AGENT_SESSION_KEY_MAX_CHARS) {
    return {
      ok: false,
      message: "clientSessionKey exceeds allowed length",
      details: {
        maxChars: STUDIO_AGENT_SESSION_KEY_MAX_CHARS,
      },
    };
  }
  return { ok: true, sessionKey };
};

export const parseStudioAgentMessages = (
  rawMessages: unknown
):
  | { ok: true; messages: AgentMessage[] }
  | {
      ok: false;
      code: "INVALID_MESSAGE_ROLE" | "MESSAGES_REQUIRED";
      message: string;
      details?: Record<string, unknown>;
    } => {
  if (!Array.isArray(rawMessages)) {
    return { ok: false, code: "MESSAGES_REQUIRED", message: "messages are required" };
  }
  const parsed: AgentMessage[] = [];
  for (let index = 0; index < rawMessages.length; index += 1) {
    const item = rawMessages[index];
    if (!item || typeof item !== "object") continue;
    const role = (item as AgentMessage).role;
    const content = (item as AgentMessage).content;
    if (role !== "user" && role !== "assistant") {
      return {
        ok: false,
        code: "INVALID_MESSAGE_ROLE",
        message: "Only user and assistant roles are allowed",
        details: {
          index,
          role,
          allowedRoles: ["user", "assistant"],
        },
      };
    }
    if (!content || typeof content !== "string") continue;
    parsed.push({ role, content });
  }
  return { ok: true, messages: parsed.slice(-MAX_MESSAGES) };
};

const normalizeFocusedSource = (
  value: AgentContext["focusedSource"] | "chat" | null | undefined
): AgentContext["focusedSource"] | undefined => {
  if (value === "image" || value === "prompt" || value === "agent-output") return value;
  if (value === "chat") return "agent-output";
  return undefined;
};

const normalizePulseArtifactTarget = (
  value: NonNullable<AgentContext["pulse"]>["artifactTarget"]
): NonNullable<AgentContext["pulse"]>["artifactTarget"] | undefined =>
  value === "image_prompt" ||
  value === "video_prompt" ||
  value === "storyboard" ||
  value === "text_artifact"
    ? value
    : undefined;

const normalizePulseKind = (
  pulse?: AgentContext["pulse"] | null
): NonNullable<AgentContext["pulse"]>["pulseKind"] | undefined => {
  if (!pulse) return undefined;
  if (pulse.pulseKind === GUIDED_PULSE_KIND || pulse.pulseKind === CUSTOM_PULSE_KIND) {
    return pulse.pulseKind;
  }
  const hasGuidedMetadata =
    (typeof pulse.starterAssistantMessage === "string" &&
      pulse.starterAssistantMessage.trim().length > 0) ||
    (Array.isArray(pulse.workflowStageHints) &&
      pulse.workflowStageHints.some(
        (entry) => typeof entry === "string" && entry.trim().length > 0
      )) ||
    pulse.source === "builtin";
  return hasGuidedMetadata ? GUIDED_PULSE_KIND : CUSTOM_PULSE_KIND;
};

const sanitizeStudioAgentPulseContext = (
  pulse?: AgentContext["pulse"] | null
): AgentContext["pulse"] | undefined => {
  if (!pulse) return undefined;
  const presetId = typeof pulse.presetId === "string" ? pulse.presetId.trim() : "";
  const label = typeof pulse.label === "string" ? pulse.label.trim() : "";
  const description =
    typeof pulse.description === "string" && pulse.description.trim().length > 0
      ? pulse.description.trim()
      : null;
  const instructions =
    typeof pulse.instructions === "string" && pulse.instructions.trim().length > 0
      ? pulse.instructions.trim()
      : null;
  const starterAssistantMessage =
    typeof pulse.starterAssistantMessage === "string" &&
    pulse.starterAssistantMessage.trim().length > 0
      ? pulse.starterAssistantMessage.trim()
      : null;
  const workflowStageHints = Array.isArray(pulse.workflowStageHints)
    ? pulse.workflowStageHints
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    : null;
  const rawWorkflowSessionPresetId =
    pulse.workflowSession && typeof pulse.workflowSession.presetId === "string"
      ? pulse.workflowSession.presetId.trim()
      : "";
  const workflowSession =
    pulse.workflowSession && typeof pulse.workflowSession.presetId === "string"
      ? ({
          presetId: rawWorkflowSessionPresetId,
          status: (pulse.workflowSession.status === "running" ||
          pulse.workflowSession.status === "awaiting_input" ||
          pulse.workflowSession.status === "completed"
            ? pulse.workflowSession.status
            : "idle") as AgentPulseWorkflowSession["status"],
          currentStepIndex:
            typeof pulse.workflowSession.currentStepIndex === "number" &&
            Number.isFinite(pulse.workflowSession.currentStepIndex)
              ? Math.max(1, Math.trunc(pulse.workflowSession.currentStepIndex))
              : null,
          currentStepLabel:
            typeof pulse.workflowSession.currentStepLabel === "string" &&
            pulse.workflowSession.currentStepLabel.trim().length > 0
              ? pulse.workflowSession.currentStepLabel.trim()
              : null,
          currentStepPrompt:
            typeof pulse.workflowSession.currentStepPrompt === "string" &&
            pulse.workflowSession.currentStepPrompt.trim().length > 0
              ? pulse.workflowSession.currentStepPrompt.trim()
              : null,
          collectedInputs: Array.isArray(pulse.workflowSession.collectedInputs)
            ? pulse.workflowSession.collectedInputs
                .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
                .filter((entry) => entry.length > 0)
            : [],
          lastArtifact:
            typeof pulse.workflowSession.lastArtifact === "string" &&
            pulse.workflowSession.lastArtifact.trim().length > 0
              ? pulse.workflowSession.lastArtifact.trim()
              : null,
          finalArtifactSource:
            pulse.workflowSession.finalArtifactSource === "apply_prompt" ||
            pulse.workflowSession.finalArtifactSource === "chat_reply"
              ? pulse.workflowSession.finalArtifactSource
              : null,
        } satisfies AgentPulseWorkflowSession)
      : null;
  const source = pulse.source === "builtin" || pulse.source === "custom" ? pulse.source : undefined;
  const hasInstructionPayload = (instructions?.length ?? 0) > 0;
  if (!presetId || !label || (!hasInstructionPayload && source !== "builtin")) return undefined;
  const pulseKind = normalizePulseKind(pulse);
  if (!pulseKind) return undefined;
  const presetBoundWorkflowSession =
    pulseKind === GUIDED_PULSE_KIND && workflowSession?.presetId === presetId
      ? workflowSession
      : null;
  const artifactTarget = normalizePulseArtifactTarget(pulse.artifactTarget);
  const activationMode =
    pulse.activationMode === "activate_only" || pulse.activationMode === "activate_and_start"
      ? pulse.activationMode
      : DEFAULT_PULSE_ACTIVATION_MODE;
  const outputMode =
    pulse.outputMode === "apply_prompt" || pulse.outputMode === "chat_reply"
      ? pulse.outputMode
      : DEFAULT_PULSE_OUTPUT_MODE;
  const runtimeMode =
    pulseKind === GUIDED_PULSE_KIND
      ? GUIDED_PULSE_RUNTIME_MODE
      : pulse.runtimeMode === CUSTOM_PULSE_RUNTIME_MODE
        ? pulse.runtimeMode
        : CUSTOM_PULSE_RUNTIME_MODE;
  const schemaVersion =
    typeof pulse.schemaVersion === "number" &&
    Number.isFinite(pulse.schemaVersion) &&
    pulse.schemaVersion > 0
      ? Math.trunc(pulse.schemaVersion)
      : DEFAULT_PULSE_SCHEMA_VERSION;
  if (pulseKind === CUSTOM_PULSE_KIND) {
    return {
      presetId,
      label,
      description,
      instructions: instructions ?? "",
      pulseKind,
      ...(source ? { source } : {}),
      schemaVersion,
    };
  }
  return {
    presetId,
    label,
    description,
    ...(hasInstructionPayload ? { instructions } : {}),
    pulseKind,
    runtimeMode,
    activationMode,
    starterAssistantMessage,
    workflowStageHints,
    outputMode,
    ...(artifactTarget ? { artifactTarget } : {}),
    memoryPolicy: "session",
    ...(source ? { source } : {}),
    workflowSession: presetBoundWorkflowSession,
    schemaVersion,
  };
};

const shouldKeepStandardMediaContext = (context: AgentContext): boolean =>
  context.modeHint === "reference" || context.modeHint === "describe";

export const sanitizeStudioAgentContext = (
  context?: AgentContext,
  runtimeMode?: AgentRuntimeMode | null
): AgentContext => {
  if (!context) return {};
  const media = pickSafeAgentImageMediaUrls(
    context.media
      ?.filter((item) => !item?.kind || item.kind === "image")
      .filter((item) => typeof item?.url === "string")
      .map((item) => ({
        id: item.id,
        url: item.url as string,
        thumbnailAlt: item.thumbnailAlt ?? undefined,
      })) ?? []
  ).map((item) => ({
    id: item.id,
    kind: "image" as const,
    url: item.url,
    thumbnailAlt: item.thumbnailAlt ?? undefined,
  }));

  const sanitized: AgentContext = {
    activePrompt: sanitizeGenerationPromptText(context.activePrompt ?? null),
    modelId: context.modelId ?? null,
    mode: context.mode,
    creditBalance: context.creditBalance ?? null,
    references: Array.isArray(context.references)
      ? context.references.slice(0, 24).map((reference) => ({
          ...reference,
          promptSnippet: removeAspectRatioLanguage(reference.promptSnippet ?? null),
          caption: removeAspectRatioLanguage(reference.caption ?? null),
        }))
      : [],
    media,
    selectedReferenceIds: Array.isArray(context.selectedReferenceIds)
      ? context.selectedReferenceIds.slice(0, 8)
      : [],
    focusedSource: normalizeFocusedSource(context.focusedSource),
    focusedReferenceId: context.focusedReferenceId ?? null,
    lastAssistantMessage: sanitizeGenerationPromptText(context.lastAssistantMessage ?? null),
    modeHint: context.modeHint ?? undefined,
    pulse: sanitizeStudioAgentPulseContext(context.pulse) ?? null,
  };
  if (runtimeMode === "pulse") {
    return {
      ...sanitized,
      activePrompt: null,
      lastAssistantMessage: null,
    };
  }
  if (runtimeMode !== "standard") return sanitized;
  const keepMedia = shouldKeepStandardMediaContext(sanitized);
  return {
    ...sanitized,
    references: keepMedia ? sanitized.references : [],
    media: keepMedia ? sanitized.media : [],
    selectedReferenceIds: keepMedia ? sanitized.selectedReferenceIds : [],
    focusedSource: keepMedia && sanitized.focusedSource === "image" ? "image" : "agent-output",
    focusedReferenceId: keepMedia ? sanitized.focusedReferenceId : null,
    pulse: null,
  };
};
