/**
 * Admin agent-instruction workspace.
 * Standard remains a local scaffold. Pulse built-ins load from and persist to the shared control plane.
 */
import React from "react";
import { CaretDown } from "phosphor-react";
import { agentPrompts } from "../../../lib/agentPromptsConfig";
import { copyToClipboard } from "../logic/copyToClipboard";
import {
  normalizeCreatePulseBuiltInPresetDefinitions,
  resolveCreatePulseBuiltInPresetDefinitions,
  type CreatePulseArtifactTarget,
  type CreatePulseBuiltInPresetDefinition,
} from "../../ai-studio/components/create/createPulsePresets";
import { resolveExpertEditPresetCatalog } from "../../ai-studio/components/edit/expertEditPresets";
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
type StyleExtractPromptDraft = {
  promptBody: string;
  source: "control_plane" | "seed";
  updatedAt: string | null;
  updatedByEmail: string | null;
};

const STANDARD_AGENT_ENTRY_ID = "standard-create-agent";
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
  index: number
): AdminPulseDraft => ({
  localId: `seed-${index}-${definition.presetId}`,
  presetId: definition.presetId,
  label: definition.label,
  description: definition.description,
  starterAssistantMessage: definition.starterAssistantMessage ?? "",
  workflowStageHints: definition.workflowStageHints?.join(", ") ?? "",
  artifactTarget: definition.artifactTarget,
  systemInstructions: definition.systemInstructions,
});

const buildPulseDraftsFromDefinitions = (
  definitions: readonly CreatePulseBuiltInPresetDefinition[]
): AdminPulseDraft[] => definitions.map(buildPulseDraftFromDefinition);

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
  runtimeMode: "workflow_gpt",
  activationMode: "activate_and_start",
  outputMode: "chat_reply",
  memoryPolicy: "session",
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
});

const arePulseDraftsEqual = (left: AdminPulseDraft, right: AdminPulseDraft): boolean =>
  left.presetId === right.presetId &&
  left.label === right.label &&
  left.description === right.description &&
  left.starterAssistantMessage === right.starterAssistantMessage &&
  left.workflowStageHints === right.workflowStageHints &&
  left.artifactTarget === right.artifactTarget &&
  left.systemInstructions === right.systemInstructions;

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

const buildAdminEditPresetDrafts = (): AdminEditPresetDraft[] =>
  resolveExpertEditPresetCatalog()
    .filter((preset) => !preset.isCustom)
    .map((preset) => ({
      presetId: preset.presetId,
      label: preset.label,
      prompt: preset.prompt,
    }));

const buildEmptyAdminEditPresetDraft = (counter: number): PendingEditSystemPresetState => ({
  presetId: `local_custom_${counter}`,
  originalLabel: "",
  label: "",
  prompt: "",
});

const loadStyleExtractPromptDraft = async (): Promise<StyleExtractPromptDraft> => {
  const response = await fetch("/api/admin/agent-instructions/style-extract-prompt", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Unable to load the style extraction prompt.");
  }
  const payload = (await response.json()) as {
    promptBody?: unknown;
    source?: "control_plane" | "seed";
    updatedAt?: string | null;
    updatedByEmail?: string | null;
  };
  return {
    promptBody: typeof payload.promptBody === "string" ? payload.promptBody : "",
    source: payload.source === "control_plane" ? "control_plane" : "seed",
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
    updatedByEmail: typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null,
  };
};

const loadPulseBuiltInCatalog = async (): Promise<{
  drafts: AdminPulseDraft[];
  source: "control_plane" | "seed";
  updatedAt: string | null;
  updatedByEmail: string | null;
}> => {
  const response = await fetch("/api/admin/agent-instructions/pulse-builtins", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Unable to load the global Pulse built-in set.");
  }
  const payload = (await response.json()) as {
    builtInDefinitions?: unknown;
    source?: "control_plane" | "seed";
    updatedAt?: string | null;
    updatedByEmail?: string | null;
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
  };
};

/**
 * Renders the admin draft-edit surface for Standard and built-in Pulse agent instructions.
 */
export function AdminAgentInstructionsSection() {
  const [standardInstructions, setStandardInstructions] = React.useState("");
  const [standardCardCollapsed, setStandardCardCollapsed] = React.useState(true);
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
  const hasStyleExtractPromptUnsavedChanges = styleExtractPrompt !== storedStyleExtractPrompt;
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

  const hydratePulseDrafts = React.useCallback((drafts: AdminPulseDraft[]) => {
    setPulseDrafts(drafts);
    setStoredPulseDrafts(drafts);
    setNextPulseDraftIndex(drafts.length + 1);
  }, []);

  const hydrateStyleExtractPrompt = React.useCallback((draft: StyleExtractPromptDraft) => {
    setStyleExtractPrompt(draft.promptBody);
    setStoredStyleExtractPrompt(draft.promptBody);
    setStyleExtractPromptSource(draft.source);
    setStyleExtractPromptUpdatedAt(draft.updatedAt);
    setStyleExtractPromptUpdatedByEmail(draft.updatedByEmail);
  }, []);

  const refreshStyleExtractPrompt = React.useCallback(async () => {
    setStyleExtractPromptLoading(true);
    try {
      const draft = await loadStyleExtractPromptDraft();
      hydrateStyleExtractPrompt(draft);
      setStyleExtractPromptLoadIssue(null);
      setStyleExtractPromptSaveState("idle");
    } catch (error) {
      hydrateStyleExtractPrompt({
        promptBody: SEEDED_STYLE_EXTRACT_PROMPT,
        source: "seed",
        updatedAt: null,
        updatedByEmail: null,
      });
      setStyleExtractPromptLoadIssue(
        "Showing the seeded code prompt because the live admin route could not be reached."
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
      hydratePulseDrafts(catalog.drafts);
      setPulseSaveState("idle");
    } catch (error) {
      const fallbackDrafts = buildPulseDraftsFromDefinitions(
        resolveCreatePulseBuiltInPresetDefinitions()
      );
      hydratePulseDrafts(fallbackDrafts);
      setPulseSaveState("error");
    } finally {
      setPulseLoading(false);
    }
  }, [hydratePulseDrafts]);

  React.useEffect(() => {
    void refreshStyleExtractPrompt();
  }, [refreshStyleExtractPrompt]);

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
    },
    []
  );

  const handleResetEditSystemPresets = React.useCallback(() => {
    setEditSystemPresetDrafts(buildAdminEditPresetDrafts());
    setNextEditPresetDraftIndex(buildAdminEditPresetDrafts().length + 1);
    setPendingEditSystemPreset(null);
  }, []);

  const handleAddEditSystemPreset = React.useCallback(() => {
    setPendingEditSystemPreset(buildEmptyAdminEditPresetDraft(nextEditPresetDraftIndex));
    setNextEditPresetDraftIndex((current) => current + 1);
  }, [nextEditPresetDraftIndex]);

  const handleSaveStyleExtractPrompt = React.useCallback(async () => {
    setStyleExtractPromptSaveState("saving");
    try {
      const response = await fetch("/api/admin/agent-instructions/style-extract-prompt", {
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
      });
      setStyleExtractPromptLoadIssue(null);
      setStyleExtractPromptSaveState("saved");
    } catch (error) {
      setStyleExtractPromptSaveState("error");
    }
  }, [hydrateStyleExtractPrompt, styleExtractPrompt]);

  const handleSaveEditSystemPreset = React.useCallback(() => {
    if (!pendingEditSystemPreset) return;
    const nextLabel = pendingEditSystemPreset.label.trim();
    const nextPrompt = pendingEditSystemPreset.prompt.trim();
    if (!nextLabel || !nextPrompt) return;
    setEditSystemPresetDrafts((current) => {
      const existingIndex = current.findIndex(
        (draft) => draft.presetId === pendingEditSystemPreset.presetId
      );
      if (existingIndex === -1) {
        return [
          ...current,
          {
            presetId: pendingEditSystemPreset.presetId,
            label: nextLabel,
            prompt: nextPrompt,
          },
        ];
      }
      return current.map((draft) =>
        draft.presetId === pendingEditSystemPreset.presetId
          ? {
              ...draft,
              label: nextLabel,
              prompt: nextPrompt,
            }
          : draft
      );
    });
    setPendingEditSystemPreset(null);
  }, [pendingEditSystemPreset]);

  const handleDeleteEditSystemPreset = React.useCallback((presetId: string) => {
    setEditSystemPresetDrafts((current) => current.filter((draft) => draft.presetId !== presetId));
    setPendingEditSystemPreset((current) => (current?.presetId === presetId ? null : current));
  }, []);

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
  }, []);

  const handleAddPulseDraft = React.useCallback(() => {
    const nextDraft = buildEmptyPulseDraft(nextPulseDraftIndex);
    setPulseDrafts((current) => [...current, nextDraft]);
    setPulseCardCollapsed((current) => ({ ...current, [nextDraft.localId]: false }));
    setPulseSectionCollapsed(false);
    setNextPulseDraftIndex((current) => current + 1);
    setPulseSaveState("idle");
  }, [nextPulseDraftIndex]);

  const handleResetAllPulseDrafts = React.useCallback(() => {
    setPulseDrafts(storedPulseDrafts);
    setNextPulseDraftIndex(storedPulseDrafts.length + 1);
    setPulseSaveState("idle");
  }, [storedPulseDrafts]);

  const handleSavePulseDrafts = React.useCallback(async () => {
    setPulseSaveState("saving");
    try {
      const builtInDefinitions = pulseDrafts.map(buildPulseDefinitionFromDraft);
      const response = await fetch("/api/admin/agent-instructions/pulse-builtins", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ builtInDefinitions }),
      });
      const payload = (await response.json()) as {
        builtInDefinitions?: unknown;
        updatedAt?: string | null;
        updatedByEmail?: string | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save the global Pulse built-in set.");
      }
      const normalizedDefinitions = normalizeCreatePulseBuiltInPresetDefinitions(
        payload.builtInDefinitions
      );
      const nextDrafts = buildPulseDraftsFromDefinitions(normalizedDefinitions);
      hydratePulseDrafts(nextDrafts);
      setPulseSaveState("saved");
    } catch (error) {
      setPulseSaveState("error");
    }
  }, [hydratePulseDrafts, pulseDrafts]);

  return (
    <section className={`${styles.adminSection} ${styles.adminAgentInstructionsSection}`}>
      <div className={styles.agentInstructionToolbarRow}>
        <div className={styles.agentInstructionActions}>
          <button type="button" className="ghost-btn mini" onClick={handleAddPulseDraft}>
            Add built-in Pulse
          </button>
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
            disabled={pulseLoading || pulseSaveState === "saving" || !hasPulseUnsavedChanges}
          >
            {pulseSaveState === "saving" ? "Saving..." : "Save Pulse set"}
          </button>
        </div>
      </div>

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
                <span className={`${styles.pill} ${styles.pillWarn}`}>Draft only</span>
              </div>
              <p className={styles.agentInstructionDescription}>
                Reserved for future Standard-mode system instructions. This field is intentionally
                not connected to runtime execution yet.
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
                onClick={() => setStandardInstructions("")}
                disabled={standardInstructions.length === 0}
              >
                Clear
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
              System instructions draft
            </label>
            <textarea
              id="admin-standard-agent-instructions"
              className={styles.agentInstructionTextarea}
              value={standardInstructions}
              onChange={(event) => setStandardInstructions(event.target.value)}
              placeholder="Standard mode is raw pass-through today. Draft future system instructions here."
              spellCheck={false}
              rows={14}
            />
            <p className={styles.agentInstructionNote}>
              {copyFeedback[STANDARD_AGENT_ENTRY_ID] ??
                "Local draft only. Editing this field does not affect the Standard route today."}
            </p>
          </div>
          {standardCardCollapsed ? (
            <p className={styles.agentInstructionCollapsedSummary}>
              Draft-only local instructions. Expand this card to view or edit the Standard scaffold.
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
                <span className={`${styles.pill} ${styles.pillWarn}`}>Local draft</span>
              </div>
              <p className={styles.agentInstructionDescription}>
                Seeded from the canonical Expert Edit system preset catalog. This admin card is UI
                only for now and does not persist to a shared control plane yet.
              </p>
            </div>
            <div className={styles.agentInstructionActions}>
              <button type="button" className="ghost-btn mini" onClick={handleAddEditSystemPreset}>
                Add preset
              </button>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={handleResetEditSystemPresets}
              >
                Reset to defaults
              </button>
            </div>
          </div>

          <div
            id="admin-edit-system-presets-card-body"
            className={styles.agentInstructionCollapsibleBody}
            hidden={editSystemPresetCardCollapsed}
          >
            <div className={styles.agentEditPresetSurfaceHeader}>
              <span className={styles.agentEditPresetModePill}>Edit</span>
              <h4 className={styles.agentEditPresetSurfaceTitle}>Edit Mode Presets</h4>
            </div>
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
              >
                <span className={styles.agentEditPresetTileAddIcon}>+</span>
                <span className={styles.agentEditPresetTileTitle}>Add preset</span>
                <span className={styles.agentEditPresetTilePrompt}>
                  Create another local draft system preset for Edit mode.
                </span>
              </button>
            </div>
          </div>
          {editSystemPresetCardCollapsed ? (
            <p className={styles.agentInstructionCollapsedSummary}>
              {editSystemPresetDrafts.length} system presets available for Edit mode. Expand this
              card to browse and edit the local draft set.
            </p>
          ) : null}
        </article>

        <div
          className={`${styles.agentInstructionModeSection} ${styles.agentInstructionPulseSection}`}
        >
          <div className={styles.agentInstructionModeHeader}>
            <div>
              <p className={styles.agentInstructionModeEyebrow}>Pulse mode</p>
              <h3 className={styles.agentInstructionModeTitle}>Global built-in Pulse set</h3>
            </div>
            <p className={styles.agentInstructionModeDescription}>
              These entries are the shared built-in Pulse catalog. Seeded content is just a starting
              point. Save applies the current set for all Create users.
            </p>
            <div className={styles.agentInstructionModeActions}>
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
                        onClick={() => handleRemovePulseDraft(draft.localId)}
                      >
                        Remove
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

            {pulseDrafts.length === 0 ? (
              <article className={styles.agentInstructionCard}>
                <div className={styles.agentInstructionModeHeader}>
                  <h4 className={styles.agentInstructionTitle}>No built-in Pulse slots drafted</h4>
                  <p className={styles.agentInstructionModeDescription}>
                    Add a new slot to define the shared built-in Pulse catalog from a blank slate.
                  </p>
                </div>
                <div className={styles.agentInstructionActions}>
                  <button type="button" className="ghost-btn mini" onClick={handleAddPulseDraft}>
                    Add built-in Pulse
                  </button>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => void refreshPulseBuiltIns()}
                  >
                    Reload stored set
                  </button>
                </div>
              </article>
            ) : null}
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
            <div className={styles.agentEditPresetModalActions}>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => setPendingEditSystemPreset(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={handleSaveEditSystemPreset}
                disabled={
                  pendingEditSystemPreset.label.trim().length === 0 ||
                  pendingEditSystemPreset.prompt.trim().length === 0
                }
              >
                {pendingEditSystemPreset.originalLabel.trim().length > 0 ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
