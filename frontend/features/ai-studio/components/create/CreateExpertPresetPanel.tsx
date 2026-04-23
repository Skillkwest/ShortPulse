/**
 * Create Pulse preset rail panel.
 * Renders the inline selected presets plus the Create-specific More Presets surface.
 */
import React from "react";
import { GearSix, Sliders } from "phosphor-react";
import { CreatePulsePresetsSurface } from "./CreatePulsePresetsSurface";
import {
  CREATE_PULSE_MORE_LABEL,
  type CreatePulsePresetId,
  type CreatePulseResolvedPreset,
  type CreatePulseSavedPreset,
} from "./createPulsePresets";
import { useCreatePulseGenerationPresetRuntime } from "./useCreatePulseGenerationPresetRuntime";
import { useCreatePulsePresetRuntime } from "./useCreatePulsePresetRuntime";

const STATUS_TOAST_VISIBLE_MS = 1_000;
const STATUS_TOAST_FADE_MS = 220;

type CreateExpertPresetPanelProps = {
  activePresetId?: CreatePulsePresetId | null;
  onActivePresetIdChange?: (presetId: CreatePulsePresetId | null) => void;
  onPresetStart?: (preset: CreatePulseResolvedPreset) => Promise<void> | void;
  selectedPresetIds?: readonly CreatePulsePresetId[];
  onSelectedPresetIdsChange?: (presetIds: CreatePulsePresetId[]) => void;
  savedPresets?: readonly CreatePulseSavedPreset[];
  onSavedPresetsChange?: (presets: CreatePulseSavedPreset[]) => void;
};

/**
 * Renders the Pulse preset rail used in expert Create mode.
 */
export function CreateExpertPresetPanel({
  activePresetId,
  onActivePresetIdChange,
  onPresetStart,
  selectedPresetIds,
  onSelectedPresetIdsChange,
  savedPresets,
  onSavedPresetsChange,
}: CreateExpertPresetPanelProps) {
  const morePresetsSurfaceId = React.useId();
  const toastVisibleTimerRef = React.useRef<number | null>(null);
  const toastFadeTimerRef = React.useRef<number | null>(null);
  const [statusToastMessage, setStatusToastMessage] = React.useState<string | null>(null);
  const [statusToastTone, setStatusToastTone] = React.useState<"info" | "warning">("info");
  const [isStatusToastFading, setIsStatusToastFading] = React.useState(false);
  const {
    availablePresets,
    hasSelectedPresetIds,
    isMorePresetsSurfaceOpen,
    savedPresets: resolvedSavedPresets,
    selectedPanelPresets,
    setIsMorePresetsSurfaceOpen,
    toggleMorePresetsSurface,
    updateSavedPresets,
    updateSelectedPresetIds,
  } = useCreatePulseGenerationPresetRuntime({
    controlledPresetIds: selectedPresetIds,
    onSelectedPresetIdsChange,
    controlledSavedPresets: savedPresets,
    onSavedPresetsChange,
  });

  React.useEffect(() => {
    return () => {
      if (toastVisibleTimerRef.current != null) {
        window.clearTimeout(toastVisibleTimerRef.current);
      }
      if (toastFadeTimerRef.current != null) {
        window.clearTimeout(toastFadeTimerRef.current);
      }
    };
  }, []);

  const showStatusToast = React.useCallback(
    (message: string, tone: "info" | "warning" = "info") => {
      if (toastVisibleTimerRef.current != null) {
        window.clearTimeout(toastVisibleTimerRef.current);
      }
      if (toastFadeTimerRef.current != null) {
        window.clearTimeout(toastFadeTimerRef.current);
      }
      setStatusToastMessage(message);
      setStatusToastTone(tone);
      setIsStatusToastFading(false);
      toastVisibleTimerRef.current = window.setTimeout(() => {
        setIsStatusToastFading(true);
        toastFadeTimerRef.current = window.setTimeout(() => {
          setStatusToastMessage(null);
          setIsStatusToastFading(false);
          toastFadeTimerRef.current = null;
        }, STATUS_TOAST_FADE_MS);
        toastVisibleTimerRef.current = null;
      }, STATUS_TOAST_VISIBLE_MS);
    },
    []
  );

  const {
    handleCustomPresetSave,
    handlePanelPresetApply,
    handlePanelPresetDragStart,
    handlePresetDragEnd,
    handlePresetPanelDragLeave,
    handlePresetPanelDragOver,
    handlePresetPanelDrop,
    handlePresetsSurfaceDragLeave,
    handlePresetsSurfaceDragOver,
    handlePresetsSurfaceDrop,
    handleSurfacePresetDragStart,
    isPresetPanelDropActive,
    isPresetsSurfaceDropActive,
  } = useCreatePulsePresetRuntime({
    savedPresets: resolvedSavedPresets,
    activePresetId: activePresetId ?? null,
    updateSelectedPresetIds,
    updateSavedPresets,
    setActivePresetId: onActivePresetIdChange ?? (() => {}),
    onPresetStart,
    showStatusToast,
  });

  const closeMorePresetsSurface = React.useCallback(() => {
    setIsMorePresetsSurfaceOpen(false);
  }, [setIsMorePresetsSurfaceOpen]);

  const isPulseActivationEnabled = Boolean(onActivePresetIdChange);

  return (
    <section className="create-expert-presets-panel" aria-label="Create prompt presets">
      <div className="create-expert-presets-card">
        <div className="create-expert-presets-title-card">
          <p className="create-expert-presets-title">Pulse Presets</p>
          <span className="create-expert-presets-title-icon" aria-hidden="true">
            <Sliders size={14} weight="regular" />
          </span>
        </div>
        <div className="create-expert-presets-list" aria-label="Selected prompt presets">
          <div
            className={`create-expert-presets-dropzone ${
              hasSelectedPresetIds ? "is-populated" : "is-empty"
            } ${isPresetPanelDropActive ? "is-drop-active" : ""}`.trim()}
            aria-label="Pulse preset panel list"
            onDragOver={handlePresetPanelDragOver}
            onDragLeave={handlePresetPanelDragLeave}
            onDrop={handlePresetPanelDrop}
          >
            {hasSelectedPresetIds ? (
              selectedPanelPresets.map((preset) => (
                <button
                  key={preset.presetId}
                  type="button"
                  draggable
                  aria-pressed={activePresetId === preset.presetId}
                  className={`create-expert-presets-btn create-expert-presets-btn--selected ${
                    activePresetId === preset.presetId ? "create-expert-presets-btn--active" : ""
                  }`.trim()}
                  aria-label={`${preset.label} preset`}
                  disabled={!isPulseActivationEnabled}
                  onClick={() => handlePanelPresetApply(preset.presetId)}
                  onDragStart={(event) => handlePanelPresetDragStart(event, preset.presetId)}
                  onDragEnd={handlePresetDragEnd}
                >
                  {preset.label}
                </button>
              ))
            ) : (
              <button
                type="button"
                className="create-expert-presets-empty-drop"
                aria-label="Empty pulse preset drop target"
                onClick={() => setIsMorePresetsSurfaceOpen(true)}
              >
                Drag presets here
              </button>
            )}
          </div>
          <div className="create-expert-presets-divider" aria-hidden="true" />
          <button
            type="button"
            className="create-expert-presets-btn create-expert-presets-btn--more"
            aria-label={CREATE_PULSE_MORE_LABEL}
            aria-expanded={isMorePresetsSurfaceOpen}
            aria-controls={morePresetsSurfaceId}
            onClick={toggleMorePresetsSurface}
          >
            <span className="create-expert-presets-btn-icon" aria-hidden="true">
              <GearSix size={12} weight="regular" />
            </span>
            {CREATE_PULSE_MORE_LABEL}
          </button>
        </div>
        <CreatePulsePresetsSurface
          id={morePresetsSurfaceId}
          isOpen={isMorePresetsSurfaceOpen}
          presets={availablePresets}
          onClose={closeMorePresetsSurface}
          onPresetDragStart={handleSurfacePresetDragStart}
          onPresetDragEnd={handlePresetDragEnd}
          onSurfaceDragOver={handlePresetsSurfaceDragOver}
          onSurfaceDragLeave={handlePresetsSurfaceDragLeave}
          onSurfaceDrop={handlePresetsSurfaceDrop}
          onCustomPresetSave={handleCustomPresetSave}
          isDropActive={isPresetsSurfaceDropActive}
        />
        {statusToastMessage ? (
          <div
            className={`create-expert-presets-status-toast is-${statusToastTone} ${
              isStatusToastFading ? "is-fading" : ""
            }`.trim()}
            role="status"
            aria-live="polite"
          >
            {statusToastMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}
