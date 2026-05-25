/**
 * Admin agent-instruction workspace.
 * Standard, Style Extraction, Edit system presets, and Pulse built-ins all persist to shared global control planes.
 */
import React from "react";
import { CaretDown } from "phosphor-react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { agentPrompts } from "../../../lib/agentPromptsConfig";
import {
  CREATE_PULSE_GUIDED_AUTHORING_KIND,
  CREATE_PULSE_SCHEMA_VERSION,
  normalizeCreatePulseBuiltInPresetDefinitions,
  resolveCreatePulseBuiltInPresetDefinitions,
  type CreatePulseActivationMode,
  type CreatePulseArtifactTarget,
  type CreatePulseBuiltInPresetDefinition,
  type CreatePulseMemoryPolicy,
  type CreatePulseOutputMode,
  type CreatePulsePresetKind,
  type CreatePulseRuntimeMode,
} from "../../../lib/model-runtime/createPulseBuiltIns";
import { copyToClipboard } from "../logic/copyToClipboard";
import {
  normalizeExpertEditSystemPresetDefinitions,
  resolveExpertEditPresetCatalog,
  SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS,
  type ExpertEditSystemPresetDefinition,
} from "../../../lib/model-runtime/expertEditPresetDomain";
import styles from "../../../styles/admin.module.css";

type CopyFeedbackMap = Record<string, string | null>;
type AdminPulseDraft = {
  localId: string;
  presetId: string;
  label: string;
  description: string;
  starterAssistantMessage: string;
  workflowStageHints: string;
  artifactTarget: CreatePulseArtifactTarget;
  systemInstructions: string;
  pulseKind: CreatePulsePresetKind;
  runtimeMode: CreatePulseRuntimeMode;
  activationMode: CreatePulseActivationMode;
  outputMode: CreatePulseOutputMode;
  memoryPolicy: CreatePulseMemoryPolicy;
  schemaVersion: number;
};
type SaveState = "idle" | "saving" | "saved" | "error";
type AdminEditPresetDraft = {
  presetId: string;
  label: string;
  prompt: string;
};
type PendingEditSystemPresetState = {
  presetId: string;
  originalLabel: string;
  label: string;
  prompt: string;
};
type StandardPromptDraft = {
  promptBody: string;
  source: "control_plane" | "seed";
  updatedAt: string | null;
  updatedByEmail: string | null;
  degraded: boolean;
};
type StyleExtractPromptDraft = {
  promptBody: string;
  source: "control_plane" | "seed";
  updatedAt: string | null;
  updatedByEmail: string | null;
  degraded: boolean;
};
type EditSystemPresetCatalogDraft = {
  presetDefinitions: ExpertEditSystemPresetDefinition[];
  source: "control_plane" | "seed";
  updatedAt: string | null;
  updatedByEmail: string | null;
  degraded: boolean;
};
type PulseBuiltInCatalogDraft = {
  drafts: AdminPulseDraft[];
  source: "control_plane" | "seed";
  updatedAt: string | null;
  updatedByEmail: string | null;
  degraded: boolean;
};

const STANDARD_AGENT_ENTRY_ID = "standard-create-agent";
const SEEDED_STANDARD_SYSTEM_PROMPT = agentPrompts.STUDIO_AGENT_SYSTEM;
const SEEDED_STYLE_EXTRACT_PROMPT = agentPrompts.OPENAI_PROMPT_STYLE_EXTRACT;
const PULSE_ARTIFACT_TARGET_OPTIONS: Array<{
  value: CreatePulseArtifactTarget;
  label: string;
}> = [
  { value: "image_prompt", label: "Image Prompt" },
  { value: "video_prompt", label: "Video Prompt" },
  { value: "storyboard", label: "Storyboard" },
  { value: "text_artifact", label: "Text Artifact" },
];

const buildPulseDraftFromDefinition = (
  definition: CreatePulseBuiltInPresetDefinition,
  index: number,
  localId = `seed-${index}-${definition.presetId}`
): AdminPulseDraft => ({
  localId,
  presetId: definition.presetId,
  label: definition.label,
  description: definition.description,
  starterAssistantMessage: definition.starterAssistantMessage ?? "",
  workflowStageHints: definition.workflowStageHints?.join(", ") ?? "",
  artifactTarget: definition.artifactTarget,
  systemInstructions: definition.systemInstructions,
  pulseKind: definition.pulseKind,
  runtimeMode: definition.runtimeMode,
  activationMode: definition.activationMode,
  outputMode: definition.outputMode,
  memoryPolicy: definition.memoryPolicy,
  schemaVersion: definition.schemaVersion,
});

const buildPulseDraftsFromDefinitions = (
  definitions: readonly CreatePulseBuiltInPresetDefinition[],
  options?: {
    templateDrafts?: readonly Pick<AdminPulseDraft, "localId">[];
  }
): AdminPulseDraft[] =>
  definitions.map((definition, index) =>
    buildPulseDraftFromDefinition(
      definition,
      index,
      options?.templateDrafts?.[index]?.localId ?? `seed-${index}-${definition.presetId}`
    )
  );

const buildPulseDefinitionFromDraft = (
  draft: AdminPulseDraft
): CreatePulseBuiltInPresetDefinition => ({
  presetId: draft.presetId.trim(),
  label: draft.label.trim(),
  description: draft.description.trim(),
  starterAssistantMessage: draft.starterAssistantMessage.trim() || null,
  workflowStageHints: draft.workflowStageHints
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0),
  artifactTarget: draft.artifactTarget,
  systemInstructions: draft.systemInstructions.trim(),
  pulseKind: draft.pulseKind,
  runtimeMode: draft.runtimeMode,
  activationMode: draft.activationMode,
  outputMode: draft.outputMode,
  memoryPolicy: draft.memoryPolicy,
  schemaVersion: draft.schemaVersion,
});

const buildEmptyPulseDraft = (counter: number): AdminPulseDraft => ({
  localId: `draft-${counter}`,
  presetId: "",
  label: "",
  description: "",
  starterAssistantMessage: "",
  workflowStageHints: "",
  artifactTarget: "text_artifact",
  systemInstructions: "",
  pulseKind: CREATE_PULSE_GUIDED_AUTHORING_KIND,
  runtimeMode: "workflow_gpt",
  activationMode: "activate_and_start",
  outputMode: "chat_reply",
  memoryPolicy: "session",
  schemaVersion: CREATE_PULSE_SCHEMA_VERSION,
});

const isPulseDraftPersistable = (draft: AdminPulseDraft): boolean =>
  draft.presetId.trim().length > 0 &&
  draft.label.trim().length > 0 &&
  draft.description.trim().length > 0 &&
  draft.systemInstructions.trim().length > 0;

const arePulseDraftsEqual = (left: AdminPulseDraft, right: AdminPulseDraft): boolean =>
  left.presetId === right.presetId &&
  left.label === right.label &&
  left.description === right.description &&
  left.starterAssistantMessage === right.starterAssistantMessage &&
  left.workflowStageHints === right.workflowStageHints &&
  left.artifactTarget === right.artifactTarget &&
  left.systemInstructions === right.systemInstructions &&
  left.pulseKind === right.pulseKind &&
  left.runtimeMode === right.runtimeMode &&
  left.activationMode === right.activationMode &&
  left.outputMode === right.outputMode &&
  left.memoryPolicy === right.memoryPolicy &&
  left.schemaVersion === right.schemaVersion;

const arePulseDraftListsEqual = (
  left: readonly AdminPulseDraft[],
  right: readonly AdminPulseDraft[]
): boolean =>
  left.length === right.length &&
  left.every((draft, index) => {
    const candidate = right[index];
    return candidate ? arePulseDraftsEqual(draft, candidate) : false;
  });

const isPulseDraftBlank = (draft: AdminPulseDraft): boolean =>
  draft.presetId.trim().length === 0 &&
  draft.label.trim().length === 0 &&
  draft.description.trim().length === 0 &&
  draft.starterAssistantMessage.trim().length === 0 &&
  draft.workflowStageHints.trim().length === 0 &&
  draft.systemInstructions.trim().length === 0 &&
  draft.artifactTarget === "text_artifact";

const buildAdminEditPresetDrafts = (
  presetDefinitions: readonly ExpertEditSystemPresetDefinition[] = SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS
): AdminEditPresetDraft[] =>
  resolveExpertEditPresetCatalog(undefined, presetDefinitions)
    .filter((preset) => !preset.isCustom)
    .map((preset) => ({
      presetId: preset.presetId,
      label: preset.label,
      prompt: preset.prompt,
    }));

const buildEmptyAdminEditPresetDraft = (counter: number): PendingEditSystemPresetState => ({
  presetId: `admin_global_${counter}`,
  originalLabel: "",
  label: "",
  prompt: "",
});

const readResponseErrorMessage = async (
  response: Response,
  fallbackMessage: string
): Promise<string> => {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof payload?.error === "string" && payload.error.trim().length > 0
    ? payload.error
    : fallbackMessage;
};

const loadStandardPromptDraft = async (): Promise<StandardPromptDraft> => {
  const response = await fetchWithAuth("/api/admin/agent-instructions/standard-system-prompt", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      await readResponseErrorMessage(response, "Unable to load the Standard system prompt.")
    );
  }
  const payload = (await response.json()) as {
    promptBody?: unknown;
    source?: "control_plane" | "seed";
    updatedAt?: string | null;
    updatedByEmail?: string | null;
    degraded?: boolean;
  };
  return {
    promptBody: typeof payload.promptBody === "string" ? payload.promptBody : "",
    source: payload.source === "control_plane" ? "control_plane" : "seed",
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
    updatedByEmail: typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null,
    degraded: payload.degraded === true,
  };
};

const loadStyleExtractPromptDraft = async (): Promise<StyleExtractPromptDraft> => {
  const response = await fetchWithAuth("/api/admin/agent-instructions/style-extract-prompt", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      await readResponseErrorMessage(response, "Unable to load the style extraction prompt.")
    );
  }
  const payload = (await response.json()) as {
    promptBody?: unknown;
    source?: "control_plane" | "seed";
    updatedAt?: string | null;
    updatedByEmail?: string | null;
    degraded?: boolean;
  };
  return {
    promptBody: typeof payload.promptBody === "string" ? payload.promptBody : "",
    source: payload.source === "control_plane" ? "control_plane" : "seed",
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
    updatedByEmail: typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null,
    degraded: payload.degraded === true,
  };
};

const loadPulseBuiltInCatalog = async (): Promise<PulseBuiltInCatalogDraft> => {
  const response = await fetchWithAuth("/api/admin/agent-instructions/pulse-builtins", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      await readResponseErrorMessage(response, "Unable to load the global Pulse built-in set.")
    );
  }
  const payload = (await response.json()) as {
    builtInDefinitions?: unknown;
    source?: "control_plane" | "seed";
    updatedAt?: string | null;
    updatedByEmail?: string | null;
    degraded?: boolean;
  };
  const definitions = normalizeCreatePulseBuiltInPresetDefinitions(payload.builtInDefinitions);
  return {
    drafts: buildPulseDraftsFromDefinitions(
      Array.isArray(payload.builtInDefinitions)
        ? definitions
        : resolveCreatePulseBuiltInPresetDefinitions()
    ),
    source: payload.source === "control_plane" ? "control_plane" : "seed",
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
    updatedByEmail: typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null,
    degraded: payload.degraded === true,
  };
};

const loadEditSystemPresetCatalog = async (): Promise<EditSystemPresetCatalogDraft> => {
  const response = await fetchWithAuth("/api/admin/agent-instructions/edit-system-presets", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      await readResponseErrorMessage(response, "Unable to load global Edit system presets.")
    );
  }
  const payload = (await response.json()) as {
    presetDefinitions?: unknown;
    source?: "control_plane" | "seed";
    updatedAt?: string | null;
    updatedByEmail?: string | null;
    degraded?: boolean;
  };
  return {
    presetDefinitions: normalizeExpertEditSystemPresetDefinitions(payload.presetDefinitions),
    source: payload.source === "control_plane" ? "control_plane" : "seed",
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
    updatedByEmail: typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null,
    degraded: payload.degraded === true,
  };
};

/**
 * Renders the admin draft-edit surface for Standard and built-in Pulse agent instructions.
 */
export function AdminAgentInstructionsSection() {
  const [standardInstructions, setStandardInstructions] = React.useState<string>(
    SEEDED_STANDARD_SYSTEM_PROMPT
  );
  const [storedStandardInstructions, setStoredStandardInstructions] = React.useState<string>(
    SEEDED_STANDARD_SYSTEM_PROMPT
  );
  const [standardCardCollapsed, setStandardCardCollapsed] = React.useState(true);
  const [standardPromptSource, setStandardPromptSource] = React.useState<"control_plane" | "seed">(
    "seed"
  );
  const [standardPromptUpdatedAt, setStandardPromptUpdatedAt] = React.useState<string | null>(null);
  const [standardPromptUpdatedByEmail, setStandardPromptUpdatedByEmail] = React.useState<
    string | null
  >(null);
  const [standardPromptLoading, setStandardPromptLoading] = React.useState(true);
  const [standardPromptSaveState, setStandardPromptSaveState] = React.useState<SaveState>("idle");
  const [standardPromptLoadIssue, setStandardPromptLoadIssue] = React.useState<string | null>(null);
  const [styleExtractPromptCardCollapsed, setStyleExtractPromptCardCollapsed] =
    React.useState(true);
  const [styleExtractPrompt, setStyleExtractPrompt] = React.useState<string>(
    SEEDED_STYLE_EXTRACT_PROMPT
  );
  const [storedStyleExtractPrompt, setStoredStyleExtractPrompt] = React.useState<string>(
    SEEDED_STYLE_EXTRACT_PROMPT
  );
  const [styleExtractPromptSource, setStyleExtractPromptSource] = React.useState<
    "control_plane" | "seed"
  >("seed");
  const [styleExtractPromptUpdatedAt, setStyleExtractPromptUpdatedAt] = React.useState<
    string | null
  >(null);
  const [styleExtractPromptUpdatedByEmail, setStyleExtractPromptUpdatedByEmail] = React.useState<
    string | null
  >(null);
  const [styleExtractPromptLoading, setStyleExtractPromptLoading] = React.useState(true);
  const [styleExtractPromptSaveState, setStyleExtractPromptSaveState] =
    React.useState<SaveState>("idle");
  const [styleExtractPromptLoadIssue, setStyleExtractPromptLoadIssue] = React.useState<
    string | null
  >(null);
  const [editSystemPresetCardCollapsed, setEditSystemPresetCardCollapsed] = React.useState(true);
  const [editSystemPresetDrafts, setEditSystemPresetDrafts] = React.useState<
    AdminEditPresetDraft[]
  >(() => buildAdminEditPresetDrafts());
  const [editSystemPresetSource, setEditSystemPresetSource] = React.useState<
    "control_plane" | "seed"
  >("seed");
  const [editSystemPresetUpdatedAt, setEditSystemPresetUpdatedAt] = React.useState<string | null>(
    null
  );
  const [editSystemPresetUpdatedByEmail, setEditSystemPresetUpdatedByEmail] = React.useState<
    string | null
  >(null);
  const [editSystemPresetLoading, setEditSystemPresetLoading] = React.useState(true);
  const [editSystemPresetSaveState, setEditSystemPresetSaveState] =
    React.useState<SaveState>("idle");
  const [editSystemPresetLoadIssue, setEditSystemPresetLoadIssue] = React.useState<string | null>(
    null
  );
  const [nextEditPresetDraftIndex, setNextEditPresetDraftIndex] = React.useState(
    () => buildAdminEditPresetDrafts().length + 1
  );
  const [pendingEditSystemPreset, setPendingEditSystemPreset] =
    React.useState<PendingEditSystemPresetState | null>(null);
  const [pulseSectionCollapsed, setPulseSectionCollapsed] = React.useState(false);
  const [pulseDrafts, setPulseDrafts] = React.useState<AdminPulseDraft[]>([]);
  const [pulseCardCollapsed, setPulseCardCollapsed] = React.useState<Record<string, boolean>>({});
  const [storedPulseDrafts, setStoredPulseDrafts] = React.useState<AdminPulseDraft[]>([]);
  const [copyFeedback, setCopyFeedback] = React.useState<CopyFeedbackMap>({});
  const [nextPulseDraftIndex, setNextPulseDraftIndex] = React.useState(1);
  const [pulseLoading, setPulseLoading] = React.useState(true);
  const [pulseSaveState, setPulseSaveState] = React.useState<SaveState>("idle");
  const [pulseCatalogSource, setPulseCatalogSource] = React.useState<"control_plane" | "seed">(
    "seed"
  );
  const [pulseCatalogUpdatedAt, setPulseCatalogUpdatedAt] = React.useState<string | null>(null);
  const [pulseCatalogUpdatedByEmail, setPulseCatalogUpdatedByEmail] = React.useState<string | null>(
    null
  );
  const [pulseCatalogDegraded, setPulseCatalogDegraded] = React.useState(false);
  const [pulseCatalogLoadIssue, setPulseCatalogLoadIssue] = React.useState<string | null>(null);
  const [pulseSaveIssue, setPulseSaveIssue] = React.useState<string | null>(null);

  const storedPulseDraftsById = React.useMemo(
    () =>
      Object.fromEntries(storedPulseDrafts.map((draft) => [draft.localId, draft])) satisfies Record<
        string,
        AdminPulseDraft
      >,
    [storedPulseDrafts]
  );
  const hasPulseUnsavedChanges = React.useMemo(
    () => !arePulseDraftListsEqual(pulseDrafts, storedPulseDrafts),
    [pulseDrafts, storedPulseDrafts]
  );
  const hasUnpublishablePulseDrafts = React.useMemo(
    () => pulseDrafts.some((draft) => isPulseDraftBlank(draft) || !isPulseDraftPersistable(draft)),
    [pulseDrafts]
  );
  const hasStandardPromptUnsavedChanges = standardInstructions !== storedStandardInstructions;
  const hasStyleExtractPromptUnsavedChanges = styleExtractPrompt !== storedStyleExtractPrompt;
  const isPulseSaveBlockedByDegradedCatalog = pulseCatalogDegraded;
  const pulseSaveExpectedUpdatedAt = pulseCatalogUpdatedAt;
  const standardPromptUpdatedLabel = React.useMemo(() => {
    if (!standardPromptUpdatedAt) return null;
    const timestamp = new Date(standardPromptUpdatedAt);
    if (Number.isNaN(timestamp.getTime())) return null;
    return timestamp.toLocaleString();
  }, [standardPromptUpdatedAt]);
  const pulseCatalogUpdatedLabel = React.useMemo(() => {
    if (!pulseCatalogUpdatedAt) return null;
    const timestamp = new Date(pulseCatalogUpdatedAt);
    if (Number.isNaN(timestamp.getTime())) return null;
    return timestamp.toLocaleString();
  }, [pulseCatalogUpdatedAt]);
  const editSystemPresetUpdatedLabel = React.useMemo(() => {
    if (!editSystemPresetUpdatedAt) return null;
    const timestamp = new Date(editSystemPresetUpdatedAt);
    if (Number.isNaN(timestamp.getTime())) return null;
    return timestamp.toLocaleString();
  }, [editSystemPresetUpdatedAt]);
  const styleExtractPromptUpdatedLabel = React.useMemo(() => {
    if (!styleExtractPromptUpdatedAt) return null;
    const timestamp = new Date(styleExtractPromptUpdatedAt);
    if (Number.isNaN(timestamp.getTime())) return null;
    return timestamp.toLocaleString();
  }, [styleExtractPromptUpdatedAt]);

  const setTimedCopyFeedback = React.useCallback((key: string, message: string) => {
    setCopyFeedback((current) => ({ ...current, [key]: message }));
    window.setTimeout(() => {
      setCopyFeedback((current) => ({ ...current, [key]: null }));
    }, 1800);
  }, []);

  const handleCopy = React.useCallback(
    async (key: string, value: string) => {
      const copied = await copyToClipboard(value);
      setTimedCopyFeedback(key, copied ? "Copied." : "Copy failed.");
    },
    [setTimedCopyFeedback]
  );

  const hydrateStandardPrompt = React.useCallback((draft: StandardPromptDraft) => {
    setStandardInstructions(draft.promptBody);
    setStoredStandardInstructions(draft.promptBody);
    setStandardPromptSource(draft.source);
    setStandardPromptUpdatedAt(draft.updatedAt);
    setStandardPromptUpdatedByEmail(draft.updatedByEmail);
  }, []);

  const hydrateEditSystemPresetCatalog = React.useCallback(
    (catalog: EditSystemPresetCatalogDraft) => {
      const drafts = buildAdminEditPresetDrafts(catalog.presetDefinitions);
      setEditSystemPresetDrafts(drafts);
      setNextEditPresetDraftIndex(drafts.length + 1);
      setEditSystemPresetSource(catalog.source);
      setEditSystemPresetUpdatedAt(catalog.updatedAt);
      setEditSystemPresetUpdatedByEmail(catalog.updatedByEmail);
    },
    []
  );

  const hydratePulseDrafts = React.useCallback((catalog: PulseBuiltInCatalogDraft) => {
    setPulseDrafts(catalog.drafts);
    setStoredPulseDrafts(catalog.drafts);
    setNextPulseDraftIndex(catalog.drafts.length + 1);
    setPulseCatalogSource(catalog.source);
    setPulseCatalogUpdatedAt(catalog.updatedAt);
    setPulseCatalogUpdatedByEmail(catalog.updatedByEmail);
    setPulseCatalogDegraded(catalog.degraded);
  }, []);

  const hydrateStyleExtractPrompt = React.useCallback((draft: StyleExtractPromptDraft) => {
    setStyleExtractPrompt(draft.promptBody);
    setStoredStyleExtractPrompt(draft.promptBody);
    setStyleExtractPromptSource(draft.source);
    setStyleExtractPromptUpdatedAt(draft.updatedAt);
    setStyleExtractPromptUpdatedByEmail(draft.updatedByEmail);
  }, []);

  const refreshStandardPrompt = React.useCallback(async () => {
    setStandardPromptLoading(true);
    try {
      const draft = await loadStandardPromptDraft();
      hydrateStandardPrompt(draft);
      setStandardPromptLoadIssue(null);
      setStandardPromptSaveState("idle");
    } catch (error) {
      hydrateStandardPrompt({
        promptBody: SEEDED_STANDARD_SYSTEM_PROMPT,
        source: "seed",
        updatedAt: null,
        updatedByEmail: null,
        degraded: false,
      });
      setStandardPromptLoadIssue(
        error instanceof Error
          ? `${error.message} Showing the local code copy for reference until the runtime prompt is restored.`
          : "Unable to load the live Standard system prompt. Showing the local code copy for reference until the runtime prompt is restored."
      );
      setStandardPromptSaveState("error");
    } finally {
      setStandardPromptLoading(false);
    }
  }, [hydrateStandardPrompt]);

  const refreshStyleExtractPrompt = React.useCallback(async () => {
    setStyleExtractPromptLoading(true);
    try {
      const draft = await loadStyleExtractPromptDraft();
      hydrateStyleExtractPrompt(draft);
      setStyleExtractPromptLoadIssue(
        draft.degraded
          ? "Live control-plane lookup failed. Showing the seeded code prompt until the admin route recovers."
          : null
      );
      setStyleExtractPromptSaveState("idle");
    } catch (error) {
      hydrateStyleExtractPrompt({
        promptBody: SEEDED_STYLE_EXTRACT_PROMPT,
        source: "seed",
        updatedAt: null,
        updatedByEmail: null,
        degraded: false,
      });
      setStyleExtractPromptLoadIssue(
        error instanceof Error
          ? `${error.message} Showing the seeded code prompt until the admin route recovers.`
          : "Showing the seeded code prompt because the live admin route could not be reached."
      );
      setStyleExtractPromptSaveState("error");
    } finally {
      setStyleExtractPromptLoading(false);
    }
  }, [hydrateStyleExtractPrompt]);

  const refreshPulseBuiltIns = React.useCallback(async () => {
    setPulseLoading(true);
    try {
      const catalog = await loadPulseBuiltInCatalog();
      hydratePulseDrafts(catalog);
      setPulseCatalogLoadIssue(
        catalog.degraded
          ? "Live Pulse catalog lookup failed. Showing fallback Pulse content. Reload before saving so the live shared set is not overwritten."
          : null
      );
      setPulseSaveIssue(null);
      setPulseSaveState("idle");
    } catch (error) {
      hydratePulseDrafts({
        drafts: buildPulseDraftsFromDefinitions(resolveCreatePulseBuiltInPresetDefinitions()),
        source: "seed",
        updatedAt: null,
        updatedByEmail: null,
        degraded: true,
      });
      setPulseCatalogLoadIssue(
        error instanceof Error
          ? `${error.message} Showing seeded fallback Pulse content. Reload before saving so the live shared set is not overwritten.`
          : "Showing seeded fallback Pulse content because the live admin route could not be reached. Reload before saving so the live shared set is not overwritten."
      );
      setPulseSaveIssue(null);
      setPulseSaveState("error");
    } finally {
      setPulseLoading(false);
    }
  }, [hydratePulseDrafts]);

  const refreshEditSystemPresetCatalog = React.useCallback(async () => {
    setEditSystemPresetLoading(true);
    try {
      const catalog = await loadEditSystemPresetCatalog();
      hydrateEditSystemPresetCatalog(catalog);
      setEditSystemPresetLoadIssue(
        catalog.degraded
          ? "Live Edit preset catalog lookup failed. Showing the seeded fallback set until the admin route recovers."
          : null
      );
      setEditSystemPresetSaveState("idle");
    } catch (error) {
      hydrateEditSystemPresetCatalog({
        presetDefinitions: [...SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS],
        source: "seed",
        updatedAt: null,
        updatedByEmail: null,
        degraded: false,
      });
      setEditSystemPresetLoadIssue(
        error instanceof Error
          ? `${error.message} Showing the seeded Edit preset catalog until the admin route recovers.`
          : "Showing the seeded Edit preset catalog because the live admin route could not be reached."
      );
      setEditSystemPresetSaveState("error");
    } finally {
      setEditSystemPresetLoading(false);
    }
  }, [hydrateEditSystemPresetCatalog]);

  React.useEffect(() => {
    void refreshStandardPrompt();
  }, [refreshStandardPrompt]);

  React.useEffect(() => {
    void refreshStyleExtractPrompt();
  }, [refreshStyleExtractPrompt]);

  React.useEffect(() => {
    void refreshEditSystemPresetCatalog();
  }, [refreshEditSystemPresetCatalog]);

  React.useEffect(() => {
    void refreshPulseBuiltIns();
  }, [refreshPulseBuiltIns]);

  React.useEffect(() => {
    setPulseCardCollapsed((current) => {
      const next: Record<string, boolean> = {};
      for (const draft of pulseDrafts) {
        next[draft.localId] = current[draft.localId] ?? true;
      }
      return next;
    });
  }, [pulseDrafts]);

  const updatePulseDraft = React.useCallback(
    <K extends keyof AdminPulseDraft>(localId: string, field: K, value: AdminPulseDraft[K]) => {
      setPulseDrafts((current) =>
        current.map((draft) => (draft.localId === localId ? { ...draft, [field]: value } : draft))
      );
      setPulseSaveState("idle");
      setPulseSaveIssue(null);
    },
    []
  );

  const handleAddEditSystemPreset = React.useCallback(() => {
    setPendingEditSystemPreset(buildEmptyAdminEditPresetDraft(nextEditPresetDraftIndex));
    setNextEditPresetDraftIndex((current) => current + 1);
  }, [nextEditPresetDraftIndex]);

  const handleSaveStandardPrompt = React.useCallback(async () => {
    setStandardPromptSaveState("saving");
    try {
      const response = await fetchWithAuth("/api/admin/agent-instructions/standard-system-prompt", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          promptBody: standardInstructions,
          expectedUpdatedAt: standardPromptUpdatedAt,
        }),
      });
      const payload = (await response.json()) as {
        promptBody?: unknown;
        source?: "control_plane" | "seed";
        updatedAt?: string | null;
        updatedByEmail?: string | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save the Standard system prompt.");
      }
      hydrateStandardPrompt({
        promptBody:
          typeof payload.promptBody === "string" ? payload.promptBody : standardInstructions,
        source: payload.source === "control_plane" ? "control_plane" : "seed",
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
        updatedByEmail: typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null,
        degraded: false,
      });
      setStandardPromptLoadIssue(null);
      setStandardPromptSaveState("saved");
    } catch {
      setStandardPromptSaveState("error");
    }
  }, [hydrateStandardPrompt, standardInstructions, standardPromptUpdatedAt]);

  const handleSaveStyleExtractPrompt = React.useCallback(async () => {
    setStyleExtractPromptSaveState("saving");
    try {
      const response = await fetchWithAuth("/api/admin/agent-instructions/style-extract-prompt", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ promptBody: styleExtractPrompt }),
      });
      const payload = (await response.json()) as {
        promptBody?: unknown;
        source?: "control_plane" | "seed";
        updatedAt?: string | null;
        updatedByEmail?: string | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save the style extraction prompt.");
      }
      hydrateStyleExtractPrompt({
        promptBody:
          typeof payload.promptBody === "string" ? payload.promptBody : styleExtractPrompt,
        source: payload.source === "control_plane" ? "control_plane" : "seed",
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
        updatedByEmail: typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null,
        degraded: false,
      });
      setStyleExtractPromptLoadIssue(null);
      setStyleExtractPromptSaveState("saved");
    } catch {
      setStyleExtractPromptSaveState("error");
    }
  }, [hydrateStyleExtractPrompt, styleExtractPrompt]);

  const handleSaveEditSystemPreset = React.useCallback(async () => {
    if (!pendingEditSystemPreset) return;
    const nextLabel = pendingEditSystemPreset.label.trim();
    const nextPrompt = pendingEditSystemPreset.prompt.trim();
    if (!nextLabel || !nextPrompt) return;
    const nextDrafts = (() => {
      const existingIndex = editSystemPresetDrafts.findIndex(
        (draft) => draft.presetId === pendingEditSystemPreset.presetId
      );
      if (existingIndex === -1) {
        return [
          ...editSystemPresetDrafts,
          {
            presetId: pendingEditSystemPreset.presetId,
            label: nextLabel,
            prompt: nextPrompt,
          },
        ];
      }
      return editSystemPresetDrafts.map((draft) =>
        draft.presetId === pendingEditSystemPreset.presetId
          ? {
              ...draft,
              label: nextLabel,
              prompt: nextPrompt,
            }
          : draft
      );
    })();

    setEditSystemPresetSaveState("saving");
    try {
      const response = await fetchWithAuth("/api/admin/agent-instructions/edit-system-presets", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          presetDefinitions: nextDrafts.map((draft) => ({
            presetId: draft.presetId.trim(),
            label: draft.label.trim(),
            prompt: draft.prompt.trim(),
          })),
          expectedUpdatedAt: editSystemPresetUpdatedAt,
        }),
      });
      const payload = (await response.json()) as {
        presetDefinitions?: unknown;
        updatedAt?: string | null;
        updatedByEmail?: string | null;
        source?: "control_plane" | "seed";
        degraded?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save global Edit system presets.");
      }
      hydrateEditSystemPresetCatalog({
        presetDefinitions: normalizeExpertEditSystemPresetDefinitions(payload.presetDefinitions),
        source: payload.source === "control_plane" ? "control_plane" : "seed",
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
        updatedByEmail: typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null,
        degraded: payload.degraded === true,
      });
      setEditSystemPresetLoadIssue(null);
      setEditSystemPresetSaveState("saved");
      setPendingEditSystemPreset(null);
    } catch {
      setEditSystemPresetSaveState("error");
    }
  }, [
    editSystemPresetDrafts,
    editSystemPresetUpdatedAt,
    hydrateEditSystemPresetCatalog,
    pendingEditSystemPreset,
  ]);

  const handleDeleteEditSystemPreset = React.useCallback(
    async (presetId: string) => {
      const nextDrafts = editSystemPresetDrafts.filter((draft) => draft.presetId !== presetId);
      setEditSystemPresetSaveState("saving");
      try {
        const response = await fetchWithAuth("/api/admin/agent-instructions/edit-system-presets", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            presetDefinitions: nextDrafts.map((draft) => ({
              presetId: draft.presetId.trim(),
              label: draft.label.trim(),
              prompt: draft.prompt.trim(),
            })),
            expectedUpdatedAt: editSystemPresetUpdatedAt,
          }),
        });
        const payload = (await response.json()) as {
          presetDefinitions?: unknown;
          updatedAt?: string | null;
          updatedByEmail?: string | null;
          source?: "control_plane" | "seed";
          degraded?: boolean;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to save global Edit system presets.");
        }
        hydrateEditSystemPresetCatalog({
          presetDefinitions: normalizeExpertEditSystemPresetDefinitions(payload.presetDefinitions),
          source: payload.source === "control_plane" ? "control_plane" : "seed",
          updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
          updatedByEmail:
            typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null,
          degraded: payload.degraded === true,
        });
        setEditSystemPresetLoadIssue(null);
        setEditSystemPresetSaveState("saved");
        setPendingEditSystemPreset((current) => (current?.presetId === presetId ? null : current));
      } catch {
        setEditSystemPresetSaveState("error");
      }
    },
    [editSystemPresetDrafts, editSystemPresetUpdatedAt, hydrateEditSystemPresetCatalog]
  );

  const handleResetPulseDraft = React.useCallback(
    (localId: string) => {
      const stored = storedPulseDraftsById[localId];
      setPulseDrafts((current) =>
        current.map((draft) => {
          if (draft.localId !== localId) return draft;
          return stored
            ? { ...stored }
            : buildEmptyPulseDraft(Number(localId.replace("draft-", "")) || 0);
        })
      );
      setPulseSaveState("idle");
      setPulseSaveIssue(null);
    },
    [storedPulseDraftsById]
  );

  const handleRemovePulseDraft = React.useCallback((localId: string) => {
    setPulseDrafts((current) => current.filter((draft) => draft.localId !== localId));
    setPulseCardCollapsed((current) => {
      const next = { ...current };
      delete next[localId];
      return next;
    });
    setPulseSaveState("idle");
    setPulseSaveIssue(null);
  }, []);

  const handleAddPulseDraft = React.useCallback(() => {
    const nextDraft = buildEmptyPulseDraft(nextPulseDraftIndex);
    setPulseDrafts((current) => [...current, nextDraft]);
    setPulseCardCollapsed((current) => ({ ...current, [nextDraft.localId]: false }));
    setPulseSectionCollapsed(false);
    setNextPulseDraftIndex((current) => current + 1);
    setPulseSaveState("idle");
    setPulseSaveIssue(null);
  }, [nextPulseDraftIndex]);

  const handleResetAllPulseDrafts = React.useCallback(() => {
    setPulseDrafts(storedPulseDrafts);
    setNextPulseDraftIndex(storedPulseDrafts.length + 1);
    setPulseSaveState("idle");
    setPulseSaveIssue(null);
  }, [storedPulseDrafts]);

  const handleSavePulseDrafts = React.useCallback(async () => {
    if (isPulseSaveBlockedByDegradedCatalog) {
      setPulseSaveState("error");
      setPulseSaveIssue(
        "Reload the live Pulse catalog before saving. Fallback content cannot be published as the global built-in set."
      );
      return;
    }
    if (hasUnpublishablePulseDrafts) {
      setPulseSaveState("error");
      setPulseSaveIssue(
        "Complete or remove every Pulse slot before saving the shared built-in set."
      );
      return;
    }
    setPulseSaveState("saving");
    setPulseSaveIssue(null);
    try {
      const builtInDefinitions = pulseDrafts.map(buildPulseDefinitionFromDraft);
      const response = await fetchWithAuth("/api/admin/agent-instructions/pulse-builtins", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          builtInDefinitions,
          expectedUpdatedAt: pulseSaveExpectedUpdatedAt,
        }),
      });
      const payload = (await response.json()) as {
        builtInDefinitions?: unknown;
        updatedAt?: string | null;
        updatedByEmail?: string | null;
        source?: "control_plane" | "seed";
        degraded?: boolean;
        code?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save the global Pulse built-in set.");
      }
      const normalizedDefinitions = normalizeCreatePulseBuiltInPresetDefinitions(
        payload.builtInDefinitions
      );
      hydratePulseDrafts({
        drafts: buildPulseDraftsFromDefinitions(normalizedDefinitions, {
          templateDrafts: pulseDrafts,
        }),
        source: payload.source === "control_plane" ? "control_plane" : "seed",
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
        updatedByEmail: typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null,
        degraded: payload.degraded === true,
      });
      setPulseCatalogLoadIssue(null);
      setPulseSaveState("saved");
    } catch (error) {
      setPulseSaveState("error");
      setPulseSaveIssue(
        error instanceof Error ? error.message : "Unable to save the global Pulse built-in set."
      );
    }
  }, [
    hydratePulseDrafts,
    hasUnpublishablePulseDrafts,
    isPulseSaveBlockedByDegradedCatalog,
    pulseDrafts,
    pulseSaveExpectedUpdatedAt,
  ]);

  const handleSavePulseDraft = React.useCallback(
    async (localId: string) => {
      const targetDraft = pulseDrafts.find((draft) => draft.localId === localId);
      if (!targetDraft) return;
      if (isPulseSaveBlockedByDegradedCatalog) {
        setPulseSaveState("error");
        setPulseSaveIssue(
          "Reload the live Pulse catalog before saving. Fallback content cannot be published as the global built-in set."
        );
        return;
      }
      const payloadDrafts = storedPulseDraftsById[localId]
        ? storedPulseDrafts.map((draft) => (draft.localId === localId ? targetDraft : draft))
        : [...storedPulseDrafts, targetDraft];

      setPulseSaveState("saving");
      setPulseSaveIssue(null);
      try {
        const response = await fetchWithAuth("/api/admin/agent-instructions/pulse-builtins", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            builtInDefinitions: payloadDrafts.map(buildPulseDefinitionFromDraft),
            expectedUpdatedAt: pulseSaveExpectedUpdatedAt,
          }),
        });
        const payload = (await response.json()) as {
          builtInDefinitions?: unknown;
          updatedAt?: string | null;
          updatedByEmail?: string | null;
          source?: "control_plane" | "seed";
          degraded?: boolean;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to save this Pulse card.");
        }

        const nextStoredDrafts = buildPulseDraftsFromDefinitions(
          normalizeCreatePulseBuiltInPresetDefinitions(payload.builtInDefinitions),
          { templateDrafts: payloadDrafts }
        );
        const storedDraftsById = Object.fromEntries(
          storedPulseDrafts.map((draft) => [draft.localId, draft])
        ) satisfies Record<string, AdminPulseDraft>;
        const payloadDraftIds = new Set(payloadDrafts.map((draft) => draft.localId));

        setStoredPulseDrafts(nextStoredDrafts);
        setPulseDrafts((current) => {
          const unsavedExtras = current.filter((draft) => !payloadDraftIds.has(draft.localId));
          const nextVisibleDrafts = nextStoredDrafts.map((savedDraft) => {
            if (savedDraft.localId === localId) return savedDraft;
            const currentDraft = current.find((draft) => draft.localId === savedDraft.localId);
            const previousStoredDraft = storedDraftsById[savedDraft.localId];
            if (
              currentDraft &&
              previousStoredDraft &&
              !arePulseDraftsEqual(currentDraft, previousStoredDraft)
            ) {
              return currentDraft;
            }
            return savedDraft;
          });
          return [...nextVisibleDrafts, ...unsavedExtras];
        });
        setNextPulseDraftIndex((current) => Math.max(current, nextStoredDrafts.length + 1));
        setPulseCatalogSource(payload.source === "control_plane" ? "control_plane" : "seed");
        setPulseCatalogUpdatedAt(typeof payload.updatedAt === "string" ? payload.updatedAt : null);
        setPulseCatalogUpdatedByEmail(
          typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null
        );
        setPulseCatalogDegraded(payload.degraded === true);
        setPulseCatalogLoadIssue(null);
        setPulseSaveState("saved");
      } catch (error) {
        setPulseSaveState("error");
        setPulseSaveIssue(
          error instanceof Error ? error.message : "Unable to save this Pulse card."
        );
      }
    },
    [
      isPulseSaveBlockedByDegradedCatalog,
      pulseSaveExpectedUpdatedAt,
      pulseDrafts,
      storedPulseDrafts,
      storedPulseDraftsById,
    ]
  );

  return (
    <>
      <div className={styles.agentInstructionWorkspace}>
        <article
          className={`${styles.agentInstructionCard} ${styles.agentInstructionStandardCard}`}
        >
          <div className={styles.agentInstructionHeader}>
            <div>
              <div className={styles.agentInstructionTitleRow}>
                <button
                  type="button"
                  className={styles.agentInstructionCollapseToggle}
                  onClick={() => setStandardCardCollapsed((current) => !current)}
                  aria-expanded={!standardCardCollapsed}
                  aria-controls="admin-standard-agent-card-body"
                >
                  <CaretDown
                    size={16}
                    weight="bold"
                    className={`${styles.agentInstructionCollapseIcon} ${standardCardCollapsed ? styles.agentInstructionCollapseIconCollapsed : ""}`}
                  />
                  <span>{standardCardCollapsed ? "Expand" : "Collapse"}</span>
                </button>
                <h3 className={styles.agentInstructionTitle}>Standard Create Agent</h3>
                <span
                  className={`${styles.pill} ${hasStandardPromptUnsavedChanges ? styles.pillWarn : styles.pillOk}`}
                >
                  {standardPromptLoadIssue
                    ? "Runtime blocked"
                    : hasStandardPromptUnsavedChanges
                      ? "Unsaved edits"
                      : standardPromptSource === "control_plane"
                        ? "Live runtime"
                        : "Local code copy"}
                </span>
              </div>
              <p className={styles.agentInstructionDescription}>
                Controls the Standard Create agent system prompt used by
                <code> /api/ai/studio-agent-standard</code> for all users.
              </p>
            </div>
            <div className={styles.agentInstructionActions}>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => void handleCopy(STANDARD_AGENT_ENTRY_ID, standardInstructions)}
                disabled={standardInstructions.trim().length === 0}
              >
                Copy
              </button>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => setStandardInstructions(storedStandardInstructions)}
                disabled={!hasStandardPromptUnsavedChanges || standardPromptLoading}
              >
                Reset to stored
              </button>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => void handleSaveStandardPrompt()}
                disabled={
                  standardPromptLoading ||
                  standardPromptSaveState === "saving" ||
                  standardInstructions.trim().length === 0 ||
                  !hasStandardPromptUnsavedChanges
                }
              >
                {standardPromptSaveState === "saving" ? "Saving..." : "Save prompt"}
              </button>
            </div>
          </div>

          <div
            id="admin-standard-agent-card-body"
            className={styles.agentInstructionCollapsibleBody}
            hidden={standardCardCollapsed}
          >
            <label
              className={styles.agentInstructionLabel}
              htmlFor="admin-standard-agent-instructions"
            >
              Runtime system prompt
            </label>
            <textarea
              id="admin-standard-agent-instructions"
              className={styles.agentInstructionTextarea}
              value={standardInstructions}
              onChange={(event) => {
                setStandardInstructions(event.target.value);
                setStandardPromptSaveState("idle");
              }}
              placeholder="Paste the runtime Standard Create system prompt here."
              spellCheck={false}
              rows={14}
            />
            <p className={styles.agentInstructionNote}>
              {copyFeedback[STANDARD_AGENT_ENTRY_ID] ??
                (standardPromptLoadIssue
                  ? standardPromptLoadIssue
                  : standardPromptSaveState === "error"
                    ? "Unable to save the live Standard system prompt."
                    : standardPromptSource === "control_plane"
                      ? `Live Standard runtime prompt${standardPromptUpdatedByEmail ? ` last updated by ${standardPromptUpdatedByEmail}` : ""}${standardPromptUpdatedLabel ? ` on ${standardPromptUpdatedLabel}` : ""}.`
                      : "Showing the local code copy. Standard runtime remains blocked until the live control-plane prompt exists.")}
            </p>
          </div>
          {standardCardCollapsed ? (
            <p className={styles.agentInstructionCollapsedSummary}>
              {standardPromptSource === "control_plane"
                ? "Live Standard runtime prompt is active."
                : "Standard runtime prompt is missing; local code copy shown for reference."}
            </p>
          ) : null}
        </article>

        <article className={styles.agentInstructionCard}>
          <div className={styles.agentInstructionHeader}>
            <div>
              <div className={styles.agentInstructionTitleRow}>
                <button
                  type="button"
                  className={styles.agentInstructionCollapseToggle}
                  onClick={() => setStyleExtractPromptCardCollapsed((current) => !current)}
                  aria-expanded={!styleExtractPromptCardCollapsed}
                  aria-controls="admin-style-extract-prompt-card-body"
                >
                  <CaretDown
                    size={16}
                    weight="bold"
                    className={`${styles.agentInstructionCollapseIcon} ${styleExtractPromptCardCollapsed ? styles.agentInstructionCollapseIconCollapsed : ""}`}
                  />
                  <span>{styleExtractPromptCardCollapsed ? "Expand" : "Collapse"}</span>
                </button>
                <h3 className={styles.agentInstructionTitle}>Style Extraction System Prompt</h3>
                <span
                  className={`${styles.pill} ${hasStyleExtractPromptUnsavedChanges ? styles.pillWarn : styles.pillOk}`}
                >
                  {styleExtractPromptLoadIssue
                    ? "Seeded local copy"
                    : hasStyleExtractPromptUnsavedChanges
                      ? "Unsaved edits"
                      : styleExtractPromptSource === "control_plane"
                        ? "Live override"
                        : "Seed fallback"}
                </span>
              </div>
              <p className={styles.agentInstructionDescription}>
                Controls how Styles Library extraction interprets uploaded reference images and
                outputs reusable style add-on prompts for <code>/api/ai/extract-style</code>.
              </p>
            </div>
            <div className={styles.agentInstructionActions}>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => void handleCopy("style-extract-prompt", styleExtractPrompt)}
                disabled={styleExtractPrompt.trim().length === 0}
              >
                Copy
              </button>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => setStyleExtractPrompt(storedStyleExtractPrompt)}
                disabled={!hasStyleExtractPromptUnsavedChanges || styleExtractPromptLoading}
              >
                Reset to stored
              </button>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => void handleSaveStyleExtractPrompt()}
                disabled={
                  styleExtractPromptLoading ||
                  styleExtractPromptSaveState === "saving" ||
                  styleExtractPrompt.trim().length === 0 ||
                  !hasStyleExtractPromptUnsavedChanges
                }
              >
                {styleExtractPromptSaveState === "saving" ? "Saving..." : "Save prompt"}
              </button>
            </div>
          </div>

          <div
            id="admin-style-extract-prompt-card-body"
            className={styles.agentInstructionCollapsibleBody}
            hidden={styleExtractPromptCardCollapsed}
          >
            <label className={styles.agentInstructionLabel} htmlFor="admin-style-extract-prompt">
              Runtime system prompt
            </label>
            <textarea
              id="admin-style-extract-prompt"
              className={styles.agentInstructionTextarea}
              value={styleExtractPrompt}
              onChange={(event) => {
                setStyleExtractPrompt(event.target.value);
                setStyleExtractPromptSaveState("idle");
              }}
              placeholder="Paste the runtime style extraction system prompt here."
              spellCheck={false}
              rows={20}
            />
            <p className={styles.agentInstructionNote}>
              {copyFeedback["style-extract-prompt"] ??
                (styleExtractPromptLoadIssue
                  ? styleExtractPromptLoadIssue
                  : styleExtractPromptSaveState === "error"
                    ? "Unable to save the live style extraction prompt."
                    : styleExtractPromptSource === "control_plane"
                      ? `Live runtime override${styleExtractPromptUpdatedByEmail ? ` last updated by ${styleExtractPromptUpdatedByEmail}` : ""}${styleExtractPromptUpdatedLabel ? ` on ${styleExtractPromptUpdatedLabel}` : ""}.`
                      : "No runtime override yet. The extractor is currently using the seeded code prompt fallback.")}
            </p>
          </div>
          {styleExtractPromptCardCollapsed ? (
            <p className={styles.agentInstructionCollapsedSummary}>
              {styleExtractPromptSource === "control_plane"
                ? "Live override active for the Styles Library extraction system prompt."
                : "Seed fallback active for the Styles Library extraction system prompt."}
            </p>
          ) : null}
        </article>

        <article
          className={`${styles.agentInstructionCard} ${styles.agentInstructionEditPresetCard}`}
        >
          <div className={styles.agentInstructionHeader}>
            <div>
              <div className={styles.agentInstructionTitleRow}>
                <button
                  type="button"
                  className={styles.agentInstructionCollapseToggle}
                  onClick={() => setEditSystemPresetCardCollapsed((current) => !current)}
                  aria-expanded={!editSystemPresetCardCollapsed}
                  aria-controls="admin-edit-system-presets-card-body"
                >
                  <CaretDown
                    size={16}
                    weight="bold"
                    className={`${styles.agentInstructionCollapseIcon} ${editSystemPresetCardCollapsed ? styles.agentInstructionCollapseIconCollapsed : ""}`}
                  />
                  <span>{editSystemPresetCardCollapsed ? "Expand" : "Collapse"}</span>
                </button>
                <h3 className={styles.agentInstructionTitle}>Edit Mode System Presets</h3>
                <span
                  className={`${styles.pill} ${editSystemPresetSaveState === "error" || editSystemPresetLoadIssue ? styles.pillWarn : styles.pillOk}`}
                >
                  {editSystemPresetLoadIssue
                    ? "Seeded fallback"
                    : editSystemPresetSource === "control_plane"
                      ? "Live catalog"
                      : "Seed fallback"}
                </span>
              </div>
              <p className={styles.agentInstructionDescription}>
                Controls the shared Expert Edit system preset catalog shown in AI Studio for all
                users.
              </p>
              <p className={styles.agentInstructionNote}>
                {editSystemPresetLoadIssue
                  ? editSystemPresetLoadIssue
                  : editSystemPresetSaveState === "error"
                    ? "Unable to save the live Edit preset catalog."
                    : editSystemPresetSource === "control_plane"
                      ? `Live global Edit preset catalog${editSystemPresetUpdatedByEmail ? ` last updated by ${editSystemPresetUpdatedByEmail}` : ""}${editSystemPresetUpdatedLabel ? ` on ${editSystemPresetUpdatedLabel}` : ""}.`
                      : "Showing the seeded Edit preset catalog. Saving here creates or replaces the shared preset set for all users."}
              </p>
            </div>
          </div>

          <div
            id="admin-edit-system-presets-card-body"
            className={styles.agentInstructionCollapsibleBody}
            hidden={editSystemPresetCardCollapsed}
          >
            <div
              className={styles.agentEditPresetGrid}
              role="list"
              aria-label="Edit mode system presets"
            >
              {editSystemPresetDrafts.map((preset) => (
                <article
                  key={preset.presetId}
                  role="listitem"
                  className={styles.agentEditPresetTile}
                >
                  <button
                    type="button"
                    className={styles.agentEditPresetTileDelete}
                    onClick={() => handleDeleteEditSystemPreset(preset.presetId)}
                    aria-label={`Delete ${preset.label} preset`}
                    disabled={editSystemPresetLoading || editSystemPresetSaveState === "saving"}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className={styles.agentEditPresetTileButton}
                    onClick={() =>
                      setPendingEditSystemPreset({
                        presetId: preset.presetId,
                        originalLabel: preset.label,
                        label: preset.label,
                        prompt: preset.prompt,
                      })
                    }
                    disabled={editSystemPresetLoading || editSystemPresetSaveState === "saving"}
                  >
                    <span className={styles.agentEditPresetTileTitle}>{preset.label}</span>
                    <span className={styles.agentEditPresetTilePrompt}>{preset.prompt}</span>
                  </button>
                </article>
              ))}
              <button
                type="button"
                className={`${styles.agentEditPresetTile} ${styles.agentEditPresetTileAdd}`}
                onClick={handleAddEditSystemPreset}
                disabled={editSystemPresetLoading || editSystemPresetSaveState === "saving"}
              >
                <span className={styles.agentEditPresetTileAddIcon}>+</span>
                <span className={styles.agentEditPresetTileTitle}>Add preset</span>
                <span className={styles.agentEditPresetTilePrompt}>
                  Create another global system preset for Edit mode.
                </span>
              </button>
            </div>
          </div>
          {editSystemPresetCardCollapsed ? (
            <p className={styles.agentInstructionCollapsedSummary}>
              {editSystemPresetDrafts.length} system presets available for Edit mode. Expand this
              card to browse and edit the shared global set.
            </p>
          ) : null}
        </article>

        <div
          className={`${styles.agentInstructionModeSection} ${styles.agentInstructionPulseSection}`}
        >
          <div className={styles.agentInstructionModeHeader}>
            <div className={styles.agentInstructionModeHeaderTop}>
              <div>
                <p className={styles.agentInstructionModeEyebrow}>Pulse mode</p>
                <h3 className={styles.agentInstructionModeTitle}>Global built-in Pulse set</h3>
              </div>
            </div>
            <p className={styles.agentInstructionModeDescription}>
              These entries are the shared built-in Pulse catalog. Seeded content is just a starting
              point. Save applies the current set for all Create users.
            </p>
            <p className={styles.agentInstructionNote}>
              {pulseSaveIssue
                ? pulseSaveIssue
                : pulseCatalogLoadIssue
                  ? pulseCatalogLoadIssue
                  : pulseCatalogSource === "control_plane"
                    ? `Live global Pulse catalog${pulseCatalogUpdatedByEmail ? ` last updated by ${pulseCatalogUpdatedByEmail}` : ""}${pulseCatalogUpdatedLabel ? ` on ${pulseCatalogUpdatedLabel}` : ""}.`
                    : "Showing the seeded Pulse catalog. Saving here creates or replaces the shared built-in set for all users."}
            </p>
            <div className={styles.agentInstructionModeMetaRow}>
              <button
                type="button"
                className={styles.agentInstructionCollapseToggle}
                onClick={() => setPulseSectionCollapsed((current) => !current)}
                aria-expanded={!pulseSectionCollapsed}
                aria-controls="admin-pulse-mode-card-list"
              >
                <CaretDown
                  size={16}
                  weight="bold"
                  className={`${styles.agentInstructionCollapseIcon} ${pulseSectionCollapsed ? styles.agentInstructionCollapseIconCollapsed : ""}`}
                />
                <span>{pulseSectionCollapsed ? "Expand section" : "Collapse section"}</span>
              </button>
            </div>
          </div>

          <div
            id="admin-pulse-mode-card-list"
            className={styles.agentInstructionCardList}
            hidden={pulseSectionCollapsed}
          >
            {pulseDrafts.map((draft, index) => {
              const stored = storedPulseDraftsById[draft.localId];
              const isCollapsed = pulseCardCollapsed[draft.localId] ?? true;
              const isDirty = stored
                ? !arePulseDraftsEqual(draft, stored)
                : !isPulseDraftBlank(draft);
              const feedbackKey = `pulse:${draft.localId}`;
              const cardTitle =
                draft.label.trim().length > 0 ? draft.label : `Pulse Slot ${index + 1}`;
              const statusLabel = stored ? (isDirty ? "Unsaved edits" : "Stored") : "New slot";
              const note = stored
                ? isDirty
                  ? "This slot differs from the stored global Pulse set."
                  : "Matches the stored global Pulse set."
                : "New slot. Save applies it to the shared built-in Pulse catalog.";
              const canSaveCard =
                !pulseLoading &&
                pulseSaveState !== "saving" &&
                !isPulseSaveBlockedByDegradedCatalog &&
                isDirty &&
                isPulseDraftPersistable(draft);
              const copyValue = [
                `Preset ID: ${draft.presetId}`,
                `Label: ${draft.label}`,
                `Description: ${draft.description}`,
                `Artifact target: ${draft.artifactTarget}`,
                `Starter assistant: ${draft.starterAssistantMessage}`,
                `Stage hints: ${draft.workflowStageHints}`,
                "",
                draft.systemInstructions,
              ].join("\n");

              return (
                <article key={draft.localId} className={styles.agentInstructionCard}>
                  <div className={styles.agentInstructionHeader}>
                    <div>
                      <div className={styles.agentInstructionTitleRow}>
                        <button
                          type="button"
                          className={styles.agentInstructionCollapseToggle}
                          onClick={() =>
                            setPulseCardCollapsed((current) => ({
                              ...current,
                              [draft.localId]: !isCollapsed,
                            }))
                          }
                          aria-expanded={!isCollapsed}
                          aria-controls={`admin-pulse-card-body-${draft.localId}`}
                        >
                          <CaretDown
                            size={16}
                            weight="bold"
                            className={`${styles.agentInstructionCollapseIcon} ${isCollapsed ? styles.agentInstructionCollapseIconCollapsed : ""}`}
                          />
                          <span>{isCollapsed ? "Expand" : "Collapse"}</span>
                        </button>
                        <h4 className={styles.agentInstructionTitle}>{cardTitle}</h4>
                        <span
                          className={`${styles.pill} ${isDirty ? styles.pillWarn : styles.pillOk}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p className={styles.agentInstructionDescription}>
                        Define the full built-in Pulse slot here. The runtime will use the stored
                        server copy for built-in preset ids.
                      </p>
                    </div>
                    <div className={styles.agentInstructionActions}>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => void handleCopy(feedbackKey, copyValue)}
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => handleResetPulseDraft(draft.localId)}
                        disabled={!isDirty}
                      >
                        {stored ? "Reset to stored" : "Clear slot"}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => void handleSavePulseDraft(draft.localId)}
                        disabled={!canSaveCard}
                      >
                        {pulseSaveState === "saving" ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => handleRemovePulseDraft(draft.localId)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div
                    id={`admin-pulse-card-body-${draft.localId}`}
                    className={styles.agentInstructionCollapsibleBody}
                    hidden={isCollapsed}
                  >
                    <div className={styles.agentInstructionFormGrid}>
                      <label className={styles.agentInstructionField}>
                        <span className={styles.agentInstructionLabel}>Pulse name</span>
                        <input
                          className={styles.agentInstructionInput}
                          type="text"
                          value={draft.label}
                          onChange={(event) =>
                            updatePulseDraft(draft.localId, "label", event.target.value)
                          }
                          placeholder="Video Prompt Magic"
                        />
                      </label>

                      <label className={styles.agentInstructionField}>
                        <span className={styles.agentInstructionLabel}>Preset ID</span>
                        <input
                          className={`${styles.agentInstructionInput} ${styles.adminMonoCell}`}
                          type="text"
                          value={draft.presetId}
                          onChange={(event) =>
                            updatePulseDraft(draft.localId, "presetId", event.target.value)
                          }
                          placeholder="video_prompt_magic"
                        />
                      </label>

                      <label className={styles.agentInstructionField}>
                        <span className={styles.agentInstructionLabel}>Artifact target</span>
                        <select
                          className={styles.agentInstructionSelect}
                          value={draft.artifactTarget}
                          onChange={(event) =>
                            updatePulseDraft(
                              draft.localId,
                              "artifactTarget",
                              event.target.value as CreatePulseArtifactTarget
                            )
                          }
                        >
                          {PULSE_ARTIFACT_TARGET_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className={styles.agentInstructionField}>
                      <span className={styles.agentInstructionLabel}>Description</span>
                      <textarea
                        className={styles.agentInstructionSubTextarea}
                        value={draft.description}
                        onChange={(event) =>
                          updatePulseDraft(draft.localId, "description", event.target.value)
                        }
                        placeholder="What this built-in Pulse is for."
                        spellCheck={false}
                        rows={3}
                      />
                    </label>

                    <div className={styles.agentInstructionFormGrid}>
                      <label className={styles.agentInstructionField}>
                        <span className={styles.agentInstructionLabel}>
                          Starter assistant message
                        </span>
                        <textarea
                          className={styles.agentInstructionSubTextarea}
                          value={draft.starterAssistantMessage}
                          onChange={(event) =>
                            updatePulseDraft(
                              draft.localId,
                              "starterAssistantMessage",
                              event.target.value
                            )
                          }
                          placeholder="Upload your image to get the process started :)"
                          spellCheck={false}
                          rows={3}
                        />
                      </label>

                      <label className={styles.agentInstructionField}>
                        <span className={styles.agentInstructionLabel}>Stage hints</span>
                        <textarea
                          className={styles.agentInstructionSubTextarea}
                          value={draft.workflowStageHints}
                          onChange={(event) =>
                            updatePulseDraft(
                              draft.localId,
                              "workflowStageHints",
                              event.target.value
                            )
                          }
                          placeholder="Image Gate, Camera Motion, Action Selection"
                          spellCheck={false}
                          rows={3}
                        />
                      </label>
                    </div>

                    <label
                      className={styles.agentInstructionLabel}
                      htmlFor={`admin-pulse-agent-instructions-${draft.localId}`}
                    >
                      System instructions
                    </label>
                    <textarea
                      id={`admin-pulse-agent-instructions-${draft.localId}`}
                      className={styles.agentInstructionTextarea}
                      value={draft.systemInstructions}
                      onChange={(event) =>
                        updatePulseDraft(draft.localId, "systemInstructions", event.target.value)
                      }
                      placeholder="Paste the full built-in Pulse system instructions here."
                      spellCheck={false}
                      rows={18}
                    />
                    <p className={styles.agentInstructionNote}>
                      {copyFeedback[feedbackKey] ?? note}
                    </p>
                  </div>
                  {isCollapsed ? (
                    <p className={styles.agentInstructionCollapsedSummary}>
                      {draft.description.trim().length > 0
                        ? draft.description.trim()
                        : "Expand this Pulse card to review or edit its full configuration."}
                    </p>
                  ) : null}
                </article>
              );
            })}

            <article className={`${styles.agentInstructionCard} ${styles.agentInstructionAddCard}`}>
              <button
                type="button"
                className={styles.agentInstructionAddTile}
                onClick={handleAddPulseDraft}
              >
                <span className={styles.agentInstructionAddIcon}>+</span>
                <span className={styles.agentInstructionAddTitle}>Add built-in Pulse</span>
                <span className={styles.agentInstructionAddDescription}>
                  Create another shared Pulse slot at the bottom of this catalog.
                </span>
              </button>
              <div className={styles.agentInstructionFooterActions}>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={handleResetAllPulseDrafts}
                  disabled={!hasPulseUnsavedChanges || pulseLoading}
                >
                  Reset to stored set
                </button>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={() => void handleSavePulseDrafts()}
                  disabled={
                    pulseLoading ||
                    pulseSaveState === "saving" ||
                    isPulseSaveBlockedByDegradedCatalog ||
                    hasUnpublishablePulseDrafts ||
                    !hasPulseUnsavedChanges
                  }
                >
                  {pulseSaveState === "saving" ? "Saving..." : "Save Pulse set"}
                </button>
              </div>
            </article>
          </div>
          {pulseSectionCollapsed ? (
            <p className={styles.agentInstructionCollapsedSummary}>
              {pulseDrafts.length} built-in Pulse slot{pulseDrafts.length === 1 ? "" : "s"} ready to
              expand and edit.
            </p>
          ) : null}
        </div>
      </div>

      {pendingEditSystemPreset ? (
        <div
          className={styles.adminModalBackdrop}
          onClick={() => setPendingEditSystemPreset(null)}
          role="presentation"
        >
          <div
            className={`${styles.adminModalCard} ${styles.agentEditPresetModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              pendingEditSystemPreset.originalLabel.trim().length > 0
                ? `Edit ${pendingEditSystemPreset.originalLabel} preset`
                : "Create preset"
            }
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className={styles.agentEditPresetModalTitle}>
              {pendingEditSystemPreset.originalLabel.trim().length > 0
                ? "Edit Preset"
                : "Create Preset"}
            </h3>
            <label className={styles.agentInstructionLabel} htmlFor="admin-edit-preset-name">
              Preset Name
            </label>
            <input
              id="admin-edit-preset-name"
              className={styles.agentInstructionInput}
              type="text"
              value={pendingEditSystemPreset.label}
              onChange={(event) =>
                setPendingEditSystemPreset((current) =>
                  current
                    ? {
                        ...current,
                        label: event.target.value,
                      }
                    : current
                )
              }
            />
            <label className={styles.agentInstructionLabel} htmlFor="admin-edit-preset-prompt">
              Preset Prompt
            </label>
            <textarea
              id="admin-edit-preset-prompt"
              className={`${styles.agentInstructionTextarea} ${styles.agentEditPresetModalTextarea}`}
              value={pendingEditSystemPreset.prompt}
              rows={8}
              onChange={(event) =>
                setPendingEditSystemPreset((current) =>
                  current
                    ? {
                        ...current,
                        prompt: event.target.value,
                      }
                    : current
                )
              }
            />
            {editSystemPresetSaveState === "error" ? (
              <p className={styles.agentInstructionNote}>
                Unable to save the live Edit preset catalog.
              </p>
            ) : null}
            <div className={styles.agentEditPresetModalActions}>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => setPendingEditSystemPreset(null)}
                disabled={editSystemPresetSaveState === "saving"}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => void handleSaveEditSystemPreset()}
                disabled={
                  editSystemPresetSaveState === "saving" ||
                  pendingEditSystemPreset.label.trim().length === 0 ||
                  pendingEditSystemPreset.prompt.trim().length === 0
                }
              >
                {editSystemPresetSaveState === "saving"
                  ? "Saving..."
                  : pendingEditSystemPreset.originalLabel.trim().length > 0
                    ? "Save"
                    : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
