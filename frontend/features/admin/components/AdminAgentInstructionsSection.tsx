/**
 * Admin agent-instruction workspace.
 * Standard remains a local scaffold. Built-in guided workflows load from and persist to the shared control plane.
 */
import React from "react";
import { copyToClipboard } from "../logic/copyToClipboard";
import {
  CREATE_PULSE_SCHEMA_VERSION,
  normalizeCreatePulseBuiltInPresetDefinitions,
  resolveCreatePulseBuiltInPresetDefinitions,
  type CreatePulseArtifactTarget,
  type CreatePulseBuiltInPresetDefinition,
} from "../../ai-studio/components/create/createPulsePresets";
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

const STANDARD_AGENT_ENTRY_ID = "standard-create-agent";
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
  pulseKind: "guided_workflow",
  runtimeMode: "workflow_gpt",
  activationMode: "activate_and_start",
  outputMode: "chat_reply",
  memoryPolicy: "session",
  schemaVersion: CREATE_PULSE_SCHEMA_VERSION,
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

const formatPulseBuiltInUpdateMeta = (updatedAt: string | null, updatedByEmail: string | null) => {
  if (!updatedAt) {
    return "Using seeded fallback. Save once to create the shared guided workflow catalog row.";
  }
  const byline = updatedByEmail ? ` by ${updatedByEmail}` : "";
  return `Last saved${byline} on ${new Date(updatedAt).toLocaleString()}.`;
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
    throw new Error("Unable to load the global guided workflow set.");
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
 * Renders the admin draft-edit surface for Standard and built-in guided workflow instructions.
 */
export function AdminAgentInstructionsSection() {
  const [standardInstructions, setStandardInstructions] = React.useState("");
  const [pulseDrafts, setPulseDrafts] = React.useState<AdminPulseDraft[]>([]);
  const [storedPulseDrafts, setStoredPulseDrafts] = React.useState<AdminPulseDraft[]>([]);
  const [copyFeedback, setCopyFeedback] = React.useState<CopyFeedbackMap>({});
  const [nextPulseDraftIndex, setNextPulseDraftIndex] = React.useState(1);
  const [pulseLoading, setPulseLoading] = React.useState(true);
  const [pulseError, setPulseError] = React.useState<string | null>(null);
  const [pulseSaveState, setPulseSaveState] = React.useState<SaveState>("idle");
  const [pulseSource, setPulseSource] = React.useState<"control_plane" | "seed">("seed");
  const [pulseUpdatedAt, setPulseUpdatedAt] = React.useState<string | null>(null);
  const [pulseUpdatedByEmail, setPulseUpdatedByEmail] = React.useState<string | null>(null);

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
  const pulseEditedCount = React.useMemo(
    () =>
      pulseDrafts.reduce((count, draft) => {
        const stored = storedPulseDraftsById[draft.localId];
        if (stored) {
          return count + (arePulseDraftsEqual(draft, stored) ? 0 : 1);
        }
        return count + (isPulseDraftBlank(draft) ? 0 : 1);
      }, 0),
    [pulseDrafts, storedPulseDraftsById]
  );

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

  const hydratePulseDrafts = React.useCallback(
    (
      drafts: AdminPulseDraft[],
      options?: {
        source?: "control_plane" | "seed";
        updatedAt?: string | null;
        updatedByEmail?: string | null;
      }
    ) => {
      setPulseDrafts(drafts);
      setStoredPulseDrafts(drafts);
      setNextPulseDraftIndex(drafts.length + 1);
      if (options?.source) setPulseSource(options.source);
      setPulseUpdatedAt(options?.updatedAt ?? null);
      setPulseUpdatedByEmail(options?.updatedByEmail ?? null);
    },
    []
  );

  const refreshPulseBuiltIns = React.useCallback(async () => {
    setPulseLoading(true);
    setPulseError(null);
    try {
      const catalog = await loadPulseBuiltInCatalog();
      hydratePulseDrafts(catalog.drafts, catalog);
      setPulseSaveState("idle");
    } catch (error) {
      setPulseError(
        error instanceof Error ? error.message : "Unable to load the global guided workflow set."
      );
      const fallbackDrafts = buildPulseDraftsFromDefinitions(
        resolveCreatePulseBuiltInPresetDefinitions()
      );
      hydratePulseDrafts(fallbackDrafts, {
        source: "seed",
        updatedAt: null,
        updatedByEmail: null,
      });
      setPulseSaveState("error");
    } finally {
      setPulseLoading(false);
    }
  }, [hydratePulseDrafts]);

  React.useEffect(() => {
    void refreshPulseBuiltIns();
  }, [refreshPulseBuiltIns]);

  const updatePulseDraft = React.useCallback(
    <K extends keyof AdminPulseDraft>(localId: string, field: K, value: AdminPulseDraft[K]) => {
      setPulseDrafts((current) =>
        current.map((draft) => (draft.localId === localId ? { ...draft, [field]: value } : draft))
      );
      setPulseSaveState("idle");
    },
    []
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
    },
    [storedPulseDraftsById]
  );

  const handleRemovePulseDraft = React.useCallback((localId: string) => {
    setPulseDrafts((current) => current.filter((draft) => draft.localId !== localId));
    setPulseSaveState("idle");
  }, []);

  const handleAddPulseDraft = React.useCallback(() => {
    setPulseDrafts((current) => [...current, buildEmptyPulseDraft(nextPulseDraftIndex)]);
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
    setPulseError(null);
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
        throw new Error(payload.error || "Unable to save the global guided workflow set.");
      }
      const normalizedDefinitions = normalizeCreatePulseBuiltInPresetDefinitions(
        payload.builtInDefinitions
      );
      const nextDrafts = buildPulseDraftsFromDefinitions(normalizedDefinitions);
      hydratePulseDrafts(nextDrafts, {
        source: "control_plane",
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
        updatedByEmail: typeof payload.updatedByEmail === "string" ? payload.updatedByEmail : null,
      });
      setPulseSaveState("saved");
    } catch (error) {
      setPulseSaveState("error");
      setPulseError(
        error instanceof Error ? error.message : "Unable to save the global guided workflow set."
      );
    }
  }, [hydratePulseDrafts, pulseDrafts]);

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Create properties panel</p>
          <h2 className={styles.adminSectionTitle}>Agent Instructions</h2>
          <p className="tiny subdued">
            Standard stays scaffold-only for now. Built-in guided workflows here load from the
            shared admin control plane and can be replaced for every Create user.
          </p>
        </div>
        <div className={styles.agentInstructionActions}>
          <button type="button" className="ghost-btn mini" onClick={handleAddPulseDraft}>
            Add guided workflow
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
            {pulseSaveState === "saving" ? "Saving..." : "Save guided workflow set"}
          </button>
        </div>
      </div>

      <div className={styles.agentInstructionsSummaryGrid}>
        <div className={styles.adminCard}>
          <p className={styles.agentInstructionSummaryLabel}>Standard mode</p>
          <strong className={styles.agentInstructionSummaryValue}>UI scaffold only</strong>
          <p className={styles.adminSubtext}>
            Standard currently runs raw pass-through and does not load local system instructions.
          </p>
        </div>
        <div className={styles.adminCard}>
          <p className={styles.agentInstructionSummaryLabel}>Built-in guided workflows</p>
          <strong className={styles.agentInstructionSummaryValue}>
            {pulseDrafts.length} editable slot{pulseDrafts.length === 1 ? "" : "s"}
          </strong>
          <p className={styles.adminSubtext}>
            {pulseLoading
              ? "Loading the shared guided workflow catalog."
              : pulseError
                ? pulseError
                : formatPulseBuiltInUpdateMeta(pulseUpdatedAt, pulseUpdatedByEmail)}
          </p>
          <p className={styles.adminSubtext}>
            Source: {pulseSource === "control_plane" ? "persisted admin catalog" : "seed fallback"}.
            {hasPulseUnsavedChanges
              ? ` ${pulseEditedCount} unsaved draft change${pulseEditedCount === 1 ? "" : "s"}.`
              : " No unsaved changes."}
          </p>
        </div>
      </div>

      <div className={styles.agentInstructionWorkspace}>
        <article className={styles.agentInstructionCard}>
          <div className={styles.agentInstructionHeader}>
            <div>
              <div className={styles.agentInstructionTitleRow}>
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
        </article>

        <div className={styles.agentInstructionModeSection}>
          <div className={styles.agentInstructionModeHeader}>
            <div>
              <p className={styles.agentInstructionModeEyebrow}>Guided workflows</p>
              <h3 className={styles.agentInstructionModeTitle}>
                Global built-in guided workflow set
              </h3>
            </div>
            <p className={styles.agentInstructionModeDescription}>
              These entries are the shared built-in guided workflow catalog. Seeded content is just
              a starting point. Save applies the current set for all Create users.
            </p>
          </div>

          <div className={styles.agentInstructionCardList}>
            {pulseDrafts.map((draft, index) => {
              const stored = storedPulseDraftsById[draft.localId];
              const isDirty = stored
                ? !arePulseDraftsEqual(draft, stored)
                : !isPulseDraftBlank(draft);
              const feedbackKey = `pulse:${draft.localId}`;
              const cardTitle =
                draft.label.trim().length > 0 ? draft.label : `Workflow Slot ${index + 1}`;
              const statusLabel = stored ? (isDirty ? "Unsaved edits" : "Stored") : "New slot";
              const note = stored
                ? isDirty
                  ? "This slot differs from the stored global guided workflow set."
                  : "Matches the stored global guided workflow set."
                : "New slot. Save applies it to the shared built-in guided workflow catalog.";
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
                        <h4 className={styles.agentInstructionTitle}>{cardTitle}</h4>
                        <span
                          className={`${styles.pill} ${isDirty ? styles.pillWarn : styles.pillOk}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p className={styles.agentInstructionDescription}>
                        Define the full built-in guided workflow here. The runtime will use the
                        stored server copy for built-in preset ids.
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

                  <div className={styles.agentInstructionFormGrid}>
                    <label className={styles.agentInstructionField}>
                      <span className={styles.agentInstructionLabel}>Workflow name</span>
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
                      placeholder="What this built-in guided workflow is for."
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
                          updatePulseDraft(draft.localId, "workflowStageHints", event.target.value)
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
                    placeholder="Paste the full built-in guided workflow system instructions here."
                    spellCheck={false}
                    rows={18}
                  />
                  <p className={styles.agentInstructionNote}>{copyFeedback[feedbackKey] ?? note}</p>
                </article>
              );
            })}

            {pulseDrafts.length === 0 ? (
              <article className={styles.agentInstructionCard}>
                <div className={styles.agentInstructionModeHeader}>
                  <h4 className={styles.agentInstructionTitle}>
                    No built-in guided workflows drafted
                  </h4>
                  <p className={styles.agentInstructionModeDescription}>
                    Add a new slot to define the shared built-in guided workflow catalog from a
                    blank slate.
                  </p>
                </div>
                <div className={styles.agentInstructionActions}>
                  <button type="button" className="ghost-btn mini" onClick={handleAddPulseDraft}>
                    Add guided workflow
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
        </div>
      </div>
    </section>
  );
}
