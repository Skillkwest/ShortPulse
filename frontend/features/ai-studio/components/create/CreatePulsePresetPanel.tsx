/**
 * Create Pulse preset rail panel.
 * Renders the inline selected presets plus the Create-specific More Presets surface.
 */
import React from "react";
import { GearSix, Sliders, X } from "phosphor-react";
import { AppMessage, useTransientAppMessage } from "../../../../components/AppMessage";
import { PulsePresetsLibraryPanel } from "../PulsePresetsLibraryPanel";
import { AiStudioModalLayer, useAiStudioModalActivity } from "../modal-layer/AiStudioModalLayer";
import { useGuardedBackdropDismiss } from "../../../../components/useGuardedBackdropDismiss";
import type { AiStudioPulsePresetChangeOptions } from "../../hooks/useAiStudioCreateModeRuntime";
import { CreatePulsePresetsSurface } from "./CreatePulsePresetsSurface";
import {
  CREATE_PULSE_MORE_LABEL,
  type CreatePulseBuiltInPresetDefinition,
  type CreatePulsePresetId,
  type CreatePulsePresetStartResult,
  type CreatePulseResolvedPreset,
  type CreatePulseSavedPreset,
} from "./createPulsePresets";
import { useCreatePulseGenerationPresetRuntime } from "./useCreatePulseGenerationPresetRuntime";
import { useCreatePulsePresetRuntime } from "./useCreatePulsePresetRuntime";

const STATUS_TOAST_VISIBLE_MS = 1_000;
const STATUS_TOAST_FADE_MS = 220;
const MORE_PULSES_SURFACE_GAP_PX = 26;
const MORE_PULSES_SURFACE_VIEWPORT_MARGIN_PX = 16;
const MORE_PULSES_SURFACE_MAX_WIDTH_PX = 540;
const MORE_PULSES_SURFACE_MIN_WIDTH_PX = 320;

type CreatePulsePresetPanelProps = {
  activePresetId?: CreatePulsePresetId | null;
  onActivePresetIdChange?: (
    presetId: CreatePulsePresetId | null,
    options?: AiStudioPulsePresetChangeOptions
  ) => string | null | void;
  onPresetStart?: (
    preset: CreatePulseResolvedPreset,
    options?: {
      pulseSessionInstanceId?: string | null;
      deferWorkflowSessionCommit?: boolean;
      allowInterruptCurrentPulse?: boolean;
    }
  ) => Promise<CreatePulsePresetStartResult | void> | CreatePulsePresetStartResult | void;
  selectedPresetIds?: readonly CreatePulsePresetId[];
  onSelectedPresetIdsChange?: (
    presetIds: CreatePulsePresetId[]
  ) => Promise<boolean> | boolean | void;
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[];
  refreshBuiltInDefinitions?: () => Promise<readonly CreatePulseBuiltInPresetDefinition[] | null>;
  isBuiltInCatalogLoading?: boolean;
  isBuiltInCatalogAuthoritative?: boolean;
  savedPresets?: readonly CreatePulseSavedPreset[];
  onSavedPresetsChange?: (presets: CreatePulseSavedPreset[]) => Promise<boolean> | boolean | void;
  onOpenPresetsLibrary?: () => void;
  isActivationBusy?: boolean;
  shouldRestartActivePreset?: (presetId: CreatePulsePresetId) => boolean;
};

/**
 * Renders the Pulse preset rail used in Create Pulse mode.
 */
export function CreatePulsePresetPanel({
  activePresetId,
  onActivePresetIdChange,
  onPresetStart,
  selectedPresetIds,
  onSelectedPresetIdsChange,
  builtInDefinitions,
  refreshBuiltInDefinitions,
  isBuiltInCatalogLoading = false,
  isBuiltInCatalogAuthoritative = true,
  savedPresets,
  onSavedPresetsChange,
  onOpenPresetsLibrary,
  isActivationBusy = false,
  shouldRestartActivePreset,
}: CreatePulsePresetPanelProps) {
  const morePresetsSurfaceId = React.useId();
  const presetsCardRef = React.useRef<HTMLDivElement | null>(null);
  const morePresetsButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const [morePresetsSurfaceStyle, setMorePresetsSurfaceStyle] =
    React.useState<React.CSSProperties | null>(null);
  const statusToast = useTransientAppMessage({
    visibleMs: STATUS_TOAST_VISIBLE_MS,
    fadeMs: STATUS_TOAST_FADE_MS,
  });
  const [persistentStatusMessage, setPersistentStatusMessage] = React.useState<string | null>(null);
  const [persistentStatusTone, setPersistentStatusTone] = React.useState<"info" | "warning">(
    "warning"
  );
  const [isPulseLibraryOpen, setIsPulseLibraryOpen] = React.useState(false);
  const {
    availableCatalogPresets,
    hasSelectedPresetIds,
    isMorePresetsSurfaceOpen,
    savedPresets: resolvedSavedPresets,
    selectedPresetIds: resolvedSelectedPresetIds,
    selectedPanelPresets,
    setIsMorePresetsSurfaceOpen,
    toggleMorePresetsSurface,
    updateSavedPresets,
    updateSelectedPresetIds,
  } = useCreatePulseGenerationPresetRuntime({
    controlledPresetIds: selectedPresetIds,
    onSelectedPresetIdsChange,
    builtInDefinitions,
    controlledSavedPresets: savedPresets,
    onSavedPresetsChange,
  });

  const handlePulseLibrarySavedPresetsChange = React.useCallback(
    (nextSavedPresets: CreatePulseSavedPreset[]) => {
      return updateSavedPresets(() => nextSavedPresets);
    },
    [updateSavedPresets]
  );

  React.useEffect(() => {
    if (!isPulseLibraryOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsPulseLibraryOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPulseLibraryOpen]);

  useAiStudioModalActivity("create-pulse-library-modal", isPulseLibraryOpen);

  const clearStatusMessage = React.useCallback(() => {
    setPersistentStatusMessage(null);
  }, []);

  const showStatusToast = React.useCallback(
    (message: string, tone: "info" | "warning" = "info") => {
      statusToast.show(message, tone);
    },
    [statusToast]
  );

  const showPersistentStatus = React.useCallback(
    (message: string, tone: "info" | "warning" = "warning") => {
      setPersistentStatusMessage(message);
      setPersistentStatusTone(tone);
    },
    []
  );

  const {
    handleCustomPresetSave,
    handlePanelPresetApply,
    handlePanelPresetDragStart,
    handleSurfacePresetSelect,
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
    builtInDefinitions,
    refreshBuiltInDefinitions,
    activePresetId: activePresetId ?? null,
    updateSelectedPresetIds,
    updateSavedPresets,
    setActivePresetId: onActivePresetIdChange ?? (() => {}),
    onPresetStart,
    showStatusToast,
    showPersistentStatus,
    clearStatusMessage,
    isActivationBusy,
    shouldRestartActivePreset,
  });

  const closeMorePresetsSurface = React.useCallback(() => {
    setIsMorePresetsSurfaceOpen(false);
  }, [setIsMorePresetsSurfaceOpen]);

  const updateMorePresetsSurfacePosition = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const anchor = presetsCardRef.current ?? morePresetsButtonRef.current;
    if (!anchor) return;
    const anchorRect = anchor.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const surfaceWidth = Math.max(
      MORE_PULSES_SURFACE_MIN_WIDTH_PX,
      Math.min(
        MORE_PULSES_SURFACE_MAX_WIDTH_PX,
        viewportWidth - MORE_PULSES_SURFACE_VIEWPORT_MARGIN_PX * 2
      )
    );
    const preferredLeft = anchorRect.right + MORE_PULSES_SURFACE_GAP_PX;
    const maxLeft = viewportWidth - surfaceWidth - MORE_PULSES_SURFACE_VIEWPORT_MARGIN_PX;
    const left = Math.max(MORE_PULSES_SURFACE_VIEWPORT_MARGIN_PX, Math.min(preferredLeft, maxLeft));
    const top = Math.max(MORE_PULSES_SURFACE_VIEWPORT_MARGIN_PX, anchorRect.top);
    setMorePresetsSurfaceStyle({
      left,
      top,
      width: surfaceWidth,
      maxWidth: surfaceWidth,
    });
  }, []);

  React.useLayoutEffect(() => {
    if (!isMorePresetsSurfaceOpen) {
      setMorePresetsSurfaceStyle(null);
      return undefined;
    }
    updateMorePresetsSurfacePosition();
    window.addEventListener("resize", updateMorePresetsSurfacePosition);
    window.addEventListener("scroll", updateMorePresetsSurfacePosition, true);
    return () => {
      window.removeEventListener("resize", updateMorePresetsSurfacePosition);
      window.removeEventListener("scroll", updateMorePresetsSurfacePosition, true);
    };
  }, [isMorePresetsSurfaceOpen, updateMorePresetsSurfacePosition]);

  const handleSurfacePresetSelectAndClose = React.useCallback(
    async (presetId: CreatePulsePresetId) => {
      const addResult = await handleSurfacePresetSelect(presetId);
      if (addResult === "added" || addResult === "already_present") {
        closeMorePresetsSurface();
      }
    },
    [closeMorePresetsSurface, handleSurfacePresetSelect]
  );

  const openPulseLibrary = React.useCallback(() => {
    setIsMorePresetsSurfaceOpen(false);
    if (onOpenPresetsLibrary) {
      onOpenPresetsLibrary();
      return;
    }
    setIsPulseLibraryOpen(true);
  }, [onOpenPresetsLibrary, setIsMorePresetsSurfaceOpen]);

  const closePulseLibrary = React.useCallback(() => {
    setIsPulseLibraryOpen(false);
  }, []);
  const pulseLibraryBackdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(closePulseLibrary);

  const isPulseActivationEnabled = Boolean(onActivePresetIdChange);
  const shouldHoldPulseCatalog = !isBuiltInCatalogAuthoritative;
  const isPulsePresetInteractionBlocked =
    !isPulseActivationEnabled || shouldHoldPulseCatalog || (isActivationBusy && !activePresetId);
  const shouldEmphasizePulseRail = !activePresetId;
  const pulseCatalogStatusMessage = isBuiltInCatalogLoading
    ? "Loading pulses..."
    : "Pulse catalog unavailable. Reload and try again.";

  return (
    <section className="create-composer-presets-panel" aria-label="Create pulse presets">
      <div
        ref={presetsCardRef}
        className={`create-composer-presets-card ${
          shouldEmphasizePulseRail ? "is-awaiting-pulse-selection" : ""
        }`.trim()}
      >
        <div className="create-composer-presets-title-card">
          <p className="create-composer-presets-title">Pulses</p>
          <span className="create-composer-presets-title-icon" aria-hidden="true">
            <Sliders size={14} weight="regular" />
          </span>
        </div>
        <div className="create-composer-presets-list" aria-label="Selected pulse presets">
          <div
            className={`create-composer-presets-dropzone ${
              hasSelectedPresetIds ? "is-populated" : "is-empty"
            } ${isPresetPanelDropActive ? "is-drop-active" : ""}`.trim()}
            aria-label="Pulse preset panel list"
            onDragOver={handlePresetPanelDragOver}
            onDragLeave={handlePresetPanelDragLeave}
            onDrop={handlePresetPanelDrop}
          >
            {shouldHoldPulseCatalog ? (
              <div
                className="create-composer-presets-loading"
                role={isBuiltInCatalogLoading ? "status" : "alert"}
                aria-live="polite"
              >
                {pulseCatalogStatusMessage}
              </div>
            ) : hasSelectedPresetIds ? (
              selectedPanelPresets.map((preset) => (
                <button
                  key={preset.presetId}
                  type="button"
                  draggable
                  aria-pressed={activePresetId === preset.presetId}
                  className={`create-composer-presets-btn create-composer-presets-btn--selected ${
                    activePresetId === preset.presetId ? "create-composer-presets-btn--active" : ""
                  }`.trim()}
                  aria-label={`${preset.label} preset`}
                  aria-disabled={isPulsePresetInteractionBlocked}
                  onClick={() => handlePanelPresetApply(preset.presetId)}
                  onDragStart={(event) => handlePanelPresetDragStart(event, preset.presetId)}
                  onDragEnd={handlePresetDragEnd}
                >
                  <span className="create-composer-presets-btn-label">{preset.label}</span>
                </button>
              ))
            ) : (
              <button
                type="button"
                className="create-composer-presets-empty-drop"
                aria-label="Empty pulse preset drop target"
                onClick={() => setIsMorePresetsSurfaceOpen(true)}
                disabled={shouldHoldPulseCatalog}
              >
                Choose from catalog
              </button>
            )}
          </div>
          <div className="create-composer-presets-divider" aria-hidden="true" />
          <button
            ref={morePresetsButtonRef}
            type="button"
            className="create-composer-presets-btn create-composer-presets-btn--more"
            aria-label={CREATE_PULSE_MORE_LABEL}
            aria-expanded={isMorePresetsSurfaceOpen}
            aria-controls={morePresetsSurfaceId}
            onClick={toggleMorePresetsSurface}
            disabled={shouldHoldPulseCatalog}
          >
            <span className="create-composer-presets-btn-icon" aria-hidden="true">
              <GearSix size={12} weight="regular" />
            </span>
            {CREATE_PULSE_MORE_LABEL}
          </button>
        </div>
        {isMorePresetsSurfaceOpen ? (
          <AiStudioModalLayer>
            <CreatePulsePresetsSurface
              id={morePresetsSurfaceId}
              isOpen={isMorePresetsSurfaceOpen}
              presets={availableCatalogPresets}
              activePresetId={activePresetId ?? null}
              selectedPresetIds={resolvedSelectedPresetIds}
              onClose={closeMorePresetsSurface}
              onOpenPresetsLibrary={openPulseLibrary}
              onPresetSelect={handleSurfacePresetSelectAndClose}
              onPresetDragStart={handleSurfacePresetDragStart}
              onPresetDragEnd={handlePresetDragEnd}
              onSurfaceDragOver={handlePresetsSurfaceDragOver}
              onSurfaceDragLeave={handlePresetsSurfaceDragLeave}
              onSurfaceDrop={handlePresetsSurfaceDrop}
              onCustomPresetSave={handleCustomPresetSave}
              isDropActive={isPresetsSurfaceDropActive}
              isActivationBusy={isActivationBusy}
              isLayered
              surfaceStyle={morePresetsSurfaceStyle ?? undefined}
            />
          </AiStudioModalLayer>
        ) : null}
        {isPulseLibraryOpen ? (
          <AiStudioModalLayer>
            <div className="create-pulse-library-modal-backdrop" {...pulseLibraryBackdropDismiss}>
              <div
                className="create-pulse-library-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Pulse Library"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="ghost-btn mini create-pulse-library-modal-close"
                  aria-label="Close Pulse Library"
                  onClick={closePulseLibrary}
                >
                  <X size={16} weight="bold" />
                </button>
                <div className="create-pulse-library-modal-body">
                  <PulsePresetsLibraryPanel
                    savedPresets={resolvedSavedPresets}
                    builtInDefinitions={builtInDefinitions}
                    onSavedPresetsChange={handlePulseLibrarySavedPresetsChange}
                  />
                </div>
              </div>
            </div>
          </AiStudioModalLayer>
        ) : null}
        {persistentStatusMessage ? (
          <AppMessage
            className={`create-composer-presets-status-banner is-${persistentStatusTone}`.trim()}
            tone={persistentStatusTone}
            mode="banner"
            message={persistentStatusMessage}
            role={persistentStatusTone === "warning" ? "alert" : "status"}
            ariaLive="polite"
            onDismiss={clearStatusMessage}
          />
        ) : null}
        {statusToast.message ? (
          <AppMessage
            className={`create-composer-presets-status-toast is-${statusToast.message.tone} ${
              statusToast.message.fading ? "is-fading" : ""
            }`.trim()}
            tone={statusToast.message.tone}
            mode="toast"
            message={statusToast.message.message}
            role="status"
            ariaLive="polite"
          />
        ) : null}
      </div>
    </section>
  );
}
