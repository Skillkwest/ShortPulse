/**
 * Unified Presets library shell for AI Studio.
 * Combines the Pulse catalog and Prompt Preset libraries behind one left-rail surface while keeping their editors separate.
 */
import React from "react";
import { ArrowCounterClockwise, MagnifyingGlass, Selection, Sparkle } from "phosphor-react";
import { AppMessage, useTransientAppMessage } from "../../../components/AppMessage";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { PresetsLibraryPanel as PromptPresetsLibraryPanel } from "./PresetsLibraryPanel";
import { PulsePresetsLibraryPanel } from "./PulsePresetsLibraryPanel";
import {
  CreatePulsePreferenceProvider,
  useCreatePulsePreferenceRuntime,
} from "./create/CreatePulsePreferenceProvider";
import { AiStudioModalLayer } from "./modal-layer/AiStudioModalLayer";
import type {
  ExpertEditPresetId,
  ExpertEditPresetOverride,
  ExpertEditResolvedPreset,
} from "./edit/expertEditPresets";

type PresetsLibraryViewFilter = "all" | "pulses" | "prompt-presets";

export type UnifiedPresetsLibraryPanelProps = {
  promptPresets: readonly ExpertEditResolvedPreset[];
  selectedPromptPresetId: ExpertEditPresetId | null;
  openPromptPresetEditRequest?: { presetId: ExpertEditPresetId; requestId: number } | null;
  onOpenPromptPresetEditRequestConsumed?: () => void;
  onOpenCreateWorkflow?: () => void;
  onOpenEditWorkflow?: () => void;
  onSelectPromptPreset?: (presetId: ExpertEditPresetId | null) => void;
  onSavePromptPresetOverride?: (
    presetId: ExpertEditPresetId,
    override: ExpertEditPresetOverride
  ) => Promise<boolean> | boolean;
  onRestorePromptBuiltIns?: () => Promise<boolean> | boolean;
  promptSaveError?: string | null;
};

const FILTER_OPTIONS: ReadonlyArray<{
  id: PresetsLibraryViewFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "pulses", label: "Pulses" },
  { id: "prompt-presets", label: "Prompt Presets" },
];

const resolvePulseCatalogStatus = ({
  loading,
  error,
  source,
  degraded,
  authoritative,
}: {
  loading: boolean;
  error: string | null;
  source: "control_plane" | "seed" | null;
  degraded: boolean;
  authoritative: boolean;
}): { tone: "info" | "warning" | "error"; message: string } | null => {
  if (loading) {
    return { tone: "info", message: "Refreshing Pulse built-ins..." };
  }
  if (error) {
    return { tone: "error", message: error };
  }
  if (!authoritative || degraded || source === "seed") {
    return {
      tone: "warning",
      message: "Pulse built-ins are showing the seeded fallback until the admin catalog reloads.",
    };
  }
  return null;
};

/**
 * Renders the combined Presets library with internal sections for the Pulse catalog and Prompt Presets.
 */
export function UnifiedPresetsLibraryPanel({
  promptPresets,
  selectedPromptPresetId,
  openPromptPresetEditRequest,
  onOpenPromptPresetEditRequestConsumed,
  onOpenCreateWorkflow,
  onOpenEditWorkflow,
  onSelectPromptPreset,
  onSavePromptPresetOverride,
  onRestorePromptBuiltIns,
  promptSaveError = null,
}: UnifiedPresetsLibraryPanelProps) {
  return (
    <CreatePulsePreferenceProvider>
      <UnifiedPresetsLibraryPanelContent
        promptPresets={promptPresets}
        selectedPromptPresetId={selectedPromptPresetId}
        openPromptPresetEditRequest={openPromptPresetEditRequest}
        onOpenPromptPresetEditRequestConsumed={onOpenPromptPresetEditRequestConsumed}
        onOpenCreateWorkflow={onOpenCreateWorkflow}
        onOpenEditWorkflow={onOpenEditWorkflow}
        onSelectPromptPreset={onSelectPromptPreset}
        onSavePromptPresetOverride={onSavePromptPresetOverride}
        onRestorePromptBuiltIns={onRestorePromptBuiltIns}
        promptSaveError={promptSaveError}
      />
    </CreatePulsePreferenceProvider>
  );
}

const UnifiedPresetsLibraryPanelContent = ({
  promptPresets,
  selectedPromptPresetId,
  openPromptPresetEditRequest,
  onOpenPromptPresetEditRequestConsumed,
  onOpenCreateWorkflow,
  onOpenEditWorkflow,
  onSelectPromptPreset,
  onSavePromptPresetOverride,
  onRestorePromptBuiltIns,
  promptSaveError = null,
}: UnifiedPresetsLibraryPanelProps) => {
  const [viewFilter, setViewFilter] = React.useState<PresetsLibraryViewFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [restoreConfirmOpen, setRestoreConfirmOpen] = React.useState(false);
  const [restoreSubmitting, setRestoreSubmitting] = React.useState(false);
  const [restoreError, setRestoreError] = React.useState<string | null>(null);
  const {
    message: restoreStatus,
    show: showRestoreStatus,
    clear: clearRestoreStatus,
  } = useTransientAppMessage();
  const {
    deletedBuiltInPresetIds,
    restoreDeletedBuiltInPresetIds,
    builtInDefinitionsLoading,
    builtInDefinitionsError,
    builtInDefinitionsSource,
    builtInDefinitionsDegraded,
    builtInDefinitionsAuthoritative,
  } = useCreatePulsePreferenceRuntime();
  const showPulses = viewFilter === "all" || viewFilter === "pulses";
  const showPromptPresets = viewFilter === "all" || viewFilter === "prompt-presets";
  const normalizedSearchQuery = searchQuery.trim();
  const restoreDisabled = restoreSubmitting;
  const pulseCatalogStatus = resolvePulseCatalogStatus({
    loading: builtInDefinitionsLoading,
    error: builtInDefinitionsError,
    source: builtInDefinitionsSource,
    degraded: builtInDefinitionsDegraded,
    authoritative: builtInDefinitionsAuthoritative,
  });

  React.useEffect(() => {
    if (!openPromptPresetEditRequest) return;
    setViewFilter("prompt-presets");
  }, [openPromptPresetEditRequest]);

  const handleRestoreBuiltIns = React.useCallback(async () => {
    if (restoreSubmitting) return;
    setRestoreSubmitting(true);
    setRestoreError(null);
    clearRestoreStatus();
    try {
      const promptResult = onRestorePromptBuiltIns ? await onRestorePromptBuiltIns() : true;
      const pulseResult = await restoreDeletedBuiltInPresetIds();
      if (promptResult === false || pulseResult === false) {
        setRestoreError("Unable to restore built-ins right now.");
        return;
      }
      showRestoreStatus("Built-ins restored.", "success");
      setRestoreConfirmOpen(false);
    } catch {
      setRestoreError("Unable to restore built-ins right now.");
    } finally {
      setRestoreSubmitting(false);
    }
  }, [
    clearRestoreStatus,
    onRestorePromptBuiltIns,
    restoreDeletedBuiltInPresetIds,
    restoreSubmitting,
    showRestoreStatus,
  ]);

  return (
    <section className="merged-presets-library-panel" aria-label="Presets library">
      <header className="merged-presets-library-header">
        <div className="merged-presets-library-header-row">
          <p className="eyebrow">Presets Library</p>
          <button
            type="button"
            className="merged-presets-library-restore-btn"
            disabled={restoreDisabled}
            onClick={() => {
              setRestoreError(null);
              clearRestoreStatus();
              setRestoreConfirmOpen(true);
            }}
          >
            <ArrowCounterClockwise size={15} weight="bold" aria-hidden="true" />
            <span>{restoreSubmitting ? "Restoring..." : "Restore built-ins"}</span>
          </button>
        </div>
        {restoreStatus ? (
          <AppMessage
            className={`tiny merged-presets-library-restore-message ${
              restoreStatus.fading ? "is-fading" : ""
            }`.trim()}
            tone="success"
            mode="inline"
            message={restoreStatus.message}
          />
        ) : null}
        {restoreError && !restoreConfirmOpen ? (
          <AppMessage
            className="tiny merged-presets-library-restore-message"
            tone="error"
            mode="inline"
            message={restoreError}
          />
        ) : null}
      </header>
      <div className="merged-presets-library-filter-row">
        <div className="merged-presets-library-filter-tabs" role="group" aria-label="Presets views">
          {FILTER_OPTIONS.map((option) => {
            const isActive = viewFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                className={`merged-presets-library-filter-chip ${
                  isActive ? "is-active" : ""
                }`.trim()}
                onClick={() => setViewFilter(option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <label className="merged-presets-library-search">
          <MagnifyingGlass size={14} weight="bold" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search presets"
            placeholder="Search presets"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="merged-presets-library-body">
        {showPulses ? (
          <section
            className="merged-presets-library-section merged-presets-library-section--pulses"
            aria-labelledby="presets-pulses-title"
          >
            <div className="merged-presets-library-section-header">
              <div>
                <button
                  type="button"
                  className="toolbar-item merged-presets-library-section-action"
                  data-tool-id="create"
                  onClick={onOpenCreateWorkflow}
                >
                  <Sparkle size={18} weight="regular" aria-hidden="true" />
                  <span className="toolbar-copy">
                    <span className="toolbar-label">Create</span>
                  </span>
                </button>
                <h3 id="presets-pulses-title" className="merged-presets-library-section-title">
                  Pulses
                </h3>
              </div>
            </div>
            {pulseCatalogStatus ? (
              <AppMessage
                className="tiny merged-presets-library-catalog-status"
                tone={pulseCatalogStatus.tone}
                mode="inline"
                message={pulseCatalogStatus.message}
              />
            ) : null}
            <div className="merged-presets-library-section-body">
              <UnifiedPulsePresetsLibraryPanel searchQuery={normalizedSearchQuery} />
            </div>
          </section>
        ) : null}
        {showPromptPresets ? (
          <section
            className="merged-presets-library-section merged-presets-library-section--prompt-presets"
            aria-labelledby="presets-prompt-presets-title"
          >
            <div className="merged-presets-library-section-header">
              <div>
                <button
                  type="button"
                  className="toolbar-item merged-presets-library-section-action"
                  data-tool-id="edit"
                  onClick={onOpenEditWorkflow}
                >
                  <Selection size={18} weight="regular" aria-hidden="true" />
                  <span className="toolbar-copy">
                    <span className="toolbar-label">Edit</span>
                  </span>
                </button>
                <h3
                  id="presets-prompt-presets-title"
                  className="merged-presets-library-section-title"
                >
                  Prompt Presets
                </h3>
              </div>
            </div>
            <div className="merged-presets-library-section-body">
              <PromptPresetsLibraryPanel
                presets={promptPresets}
                searchQuery={normalizedSearchQuery}
                selectedPresetId={selectedPromptPresetId}
                openPresetEditRequest={openPromptPresetEditRequest}
                onOpenPresetEditRequestConsumed={onOpenPromptPresetEditRequestConsumed}
                onSelectPreset={onSelectPromptPreset}
                onSavePresetOverride={onSavePromptPresetOverride}
                saveError={promptSaveError}
              />
            </div>
          </section>
        ) : null}
      </div>
      {restoreConfirmOpen ? (
        <AiStudioModalLayer>
          <ConfirmationModal
            title="Restore built-ins?"
            body={
              <>
                <p>
                  Restore the current ShortPulse built-in Prompt Presets and Pulses to your library.
                </p>
                <p>Your custom presets and custom Pulses will stay unchanged.</p>
                {deletedBuiltInPresetIds.length > 0 ? null : (
                  <p>This will still refresh your built-in restore state.</p>
                )}
                {restoreError ? (
                  <AppMessage
                    className="tiny merged-presets-library-restore-message"
                    tone="error"
                    mode="inline"
                    message={restoreError}
                  />
                ) : null}
              </>
            }
            confirmLabel="Restore"
            confirmBusyLabel={restoreSubmitting ? "Restoring..." : undefined}
            confirmDisabled={restoreSubmitting}
            cancelDisabled={restoreSubmitting}
            onCancel={() => {
              if (restoreSubmitting) return;
              setRestoreConfirmOpen(false);
            }}
            onConfirm={() => {
              void handleRestoreBuiltIns();
            }}
          />
        </AiStudioModalLayer>
      ) : null}
    </section>
  );
};

const UnifiedPulsePresetsLibraryPanel = ({ searchQuery }: { searchQuery: string }) => {
  const { builtInDefinitions, savedPresets, setSavedPresets } = useCreatePulsePreferenceRuntime();
  return (
    <PulsePresetsLibraryPanel
      builtInDefinitions={builtInDefinitions}
      savedPresets={savedPresets}
      searchQuery={searchQuery}
      onSavedPresetsChange={setSavedPresets}
    />
  );
};
