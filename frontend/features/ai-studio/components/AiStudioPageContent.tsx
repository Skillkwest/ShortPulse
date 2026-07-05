/**
 * AI Studio page layout (presentational only).
 * Receives a prepared view model from the page and renders toolbar, panels, previews, and system banners.
 */
import Link from "next/link";
import React from "react";
import { FlowArrow, Globe, PencilSimple, type IconProps, SquaresFour } from "phosphor-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  AppMessage,
  AppMessageStack,
  type AppMessageAction,
  type AppMessageTone,
} from "../../../components/AppMessage";
import {
  normalizeCustomerFacingProviderError,
  normalizeProviderSideGenerationFailure,
} from "../../../lib/customerFacingProviderText";
import { AiStudioToolbar } from "./AiStudioToolbar";
import { AiStudioToolbarRail } from "./AiStudioToolbarRail";
import { PresetsPanelLoader } from "./PresetsPanelLoader";
import { StandardCreatePropertiesPanel } from "./create/StandardCreatePropertiesPanel";
import { PulseCreatePropertiesPanel } from "./create/PulseCreatePropertiesPanel";
import { CreateModeToggle } from "./create/CreateModeToggle";
import type { SharedMediaDetailItemBase } from "./detail-modal/detailModalPlatformTypes";
import { resolveSharedMediaDetailMediaActionItems } from "./detail-modal/sharedMediaDetailActions";
import type { ModelModalContext } from "./ModelModal";
import { AiStudioShellFrame } from "./AiStudioShellFrame";
import { StudioPreview } from "./StudioPreview";
import type { ModelOption } from "../constants";
import type { MusicPropertiesPanelProps } from "./MusicPropertiesPanel";
import type { SoundEffectsPropertiesPanelProps } from "./SoundEffectsPropertiesPanel";
import type {
  ActiveVoiceChangerSourceVideo,
  VoicesPropertiesPanelProps,
} from "./VoicesPropertiesPanel";
import type { ResolveVoiceChangerInternalReferenceSource } from "./VoiceChangerSourceDropzone";
import type {
  SharedMediaDetailSelectionTarget,
  SharedMediaDetailVideoSnapshotErrorHandler,
  SharedMediaDetailVideoSnapshotHandler,
} from "./detail-modal/detailModalPlatformTypes";
import { useAiStudioShellResize } from "../hooks/useAiStudioShellResize";
import { useAiStudioShellDndController } from "../hooks/useAiStudioShellDndController";
import { useAiStudioStabilityLifecycleTelemetry } from "../hooks/useAiStudioStabilityLifecycleTelemetry";
import { useAiStudioStylesRuntime } from "../hooks/useAiStudioStylesRuntime";
import type { CanvasTearOutComposerTargetRegistry } from "../hooks/useAiStudioCanvasTearOutTargets";
import type { CharacterPanelUploadRequest } from "../../../lib/characterPanelUploadRequest";
import type { ResolveCharacterDropReference } from "../../character-manager/hooks/useCharacterManagerDroppedReferenceController";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type {
  AiStudioCreatePanelContract,
  AiStudioDetailNavigationContract,
  AiStudioReferenceGridContract,
} from "../hooks/contracts/pageContentContracts";
import type { GenerationAccessCta } from "../logic/generationAccessCta";
import type { StudioOutput, ToolId, WorkflowReloadMediaKindHint } from "../types";
import type {
  LibraryMediaReferencePayload,
  LibraryPromptReferencePayload,
} from "../reference-grid/referenceGridTypes";
import type { MediaFileRow } from "../logic/mediaLibraryModalModel";
import { resolvePropertiesPanelKind } from "../logic/propertiesPanelRouting";
import { isCharacterShellTool, isPrimaryCharacterTool } from "../logic/primaryCharacterTool";
import { isSoundWorkflow } from "../logic/workflowIdentity";
import { resolveAiStudioErrorPresentation } from "../logic/errorPresentation";
import { isInsufficientCreditsLike } from "../logic/insufficientCredits";
import { downloadUrlToFile } from "../logic/referenceDownload";
import {
  PERF_FLAG_SHELL_BOUNDARY_SPLIT,
  PERF_FLAG_SHELL_DECOUPLE,
  PERF_FLAG_SHELL_DND_BACKPRESSURE,
  PERF_FLAG_SHELL_HIGH_DENSITY_MODE,
  PERF_FLAG_SHELL_PANEL_MEMOIZATION,
} from "../logic/perfProfileFlags";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";
import {
  AI_SHELL_LEFT_CHARACTER_MIN_PX,
  AI_SHELL_LEFT_CHARACTER_DEFAULT_RATIO,
  AI_SHELL_LEFT_CREATE_MIN_PX,
  AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX,
  AI_SHELL_LEFT_MEDIA_LIBRARY_MIN_PX,
  AI_SHELL_LEFT_PRESETS_MIN_PX,
  AI_SHELL_LEFT_SOUND_MIN_PX,
  AI_SHELL_LEFT_VIDEO_DEFAULT_RATIO,
  AI_SHELL_LEFT_VIDEO_MIN_PX,
  AI_SHELL_RIGHT_COLLAPSED_MIN_PX,
  resolveCreateShellResizeAction,
  shouldCollapseCreateOnSessionChange,
  shouldCollapseAiShellOnInitialSoundSelection,
  shouldResetAiShellToDefaultOnToolSelect,
} from "../logic/shellResize";
import { useOutputCounts } from "../hooks/aiStudioOutputStore";
import {
  resolveEffectivePanelVisibility,
  resolveHeaderShortcutStateMap,
  togglePanelVisibilityByShortcut,
  type HeaderShortcutId,
  type PanelVisibilityState,
} from "../logic/panelVisibility";
import type { AiStudioRightRailLayoutV1 } from "../logic/rightRailLayout";
import {
  EDIT_PRESET_DELETED_OVERRIDE_LABEL,
  EDIT_PRESET_DELETED_OVERRIDE_PROMPT,
  isExpertEditCustomPresetId,
  resolveExpertEditPresetCatalog,
  type ExpertEditPresetId,
  type ExpertEditPresetOverride,
} from "./edit/expertEditPresets";
import { type InternalReferenceDragPayload } from "../utils/dragDrop";
import {
  doesReferenceGridOwnFileDrop,
  shouldBypassRightRailShellCapture,
} from "../logic/referenceGridDropOwnership";
import type { ResolveInternalStyleDrop } from "../logic/styleCreatorIntake";
import {
  resolveRightColumnDropMode,
  resolveRightColumnDropPayload,
  type RightColumnDropMode,
} from "../logic/rightColumnDropPayload";
import { CreditFillCoin, formatCreditFractionLabel } from "./AiStudioCreditDisplay";

type FailureCard = Pick<
  StudioOutput,
  | "id"
  | "model"
  | "modelId"
  | "prompt"
  | "errorMessage"
  | "errorMessageShort"
  | "errorDetail"
  | "errorPayload"
>;

type GroupedFailureCard = {
  ids: string[];
  modelLabel: string;
  failureMessage: string;
  count: number;
};

type ComingSoonToolId = "templates" | "workflows" | "community";
type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

const comingSoonCopy: Record<
  ComingSoonToolId,
  { title: string; summary: string; detail: string; icon: IconComponent }
> = {
  templates: {
    title: "Templates",
    summary: "Preset model and setting bundles for common generation tasks.",
    detail:
      "Templates allow you to select pre-set models and selections for specific generative tasks.",
    icon: SquaresFour,
  },
  workflows: {
    title: "Workflows",
    summary: "Reusable Canvas Node Builder pipelines for advanced automations.",
    detail: "Workflows will be a library of pre-made Canvas Node Builder workflows.",
    icon: FlowArrow,
  },
  community: {
    title: "Community",
    summary: "Browse the shared gallery from other creators.",
    detail: "Community is where you can see community members' generated content in the gallery.",
    icon: Globe,
  },
};

const areActiveVoiceChangerSourceVideosEqual = (
  left: ActiveVoiceChangerSourceVideo | null,
  right: ActiveVoiceChangerSourceVideo | null
): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.referenceOutputId === right.referenceOutputId &&
    left.referenceMediaId === right.referenceMediaId &&
    left.aspect === right.aspect
  );
};

const isComingSoonTool = (tool: ToolId | null): tool is ComingSoonToolId =>
  tool === "templates" || tool === "workflows" || tool === "community";

const AI_STUDIO_HEADER_SHORTCUT_BUTTONS = [
  { id: "quick-slot-inventory", label: "Quick Slot Inventory" },
  { id: "reference-grid", label: "Reference Grid" },
] as const;
const LazyExpertEditPanelView = React.lazy(() =>
  import("./edit/ExpertEditPanelView").then((module) => ({
    default: module.ExpertEditPanelView,
  }))
);
const LazyCharacterPanel = React.lazy(() =>
  import("./CharacterPanel").then((module) => ({
    default: module.CharacterPanel,
  }))
);
const LazyStylesLibraryPanel = React.lazy(() =>
  import("./StylesLibraryPanel").then((module) => ({
    default: module.StylesLibraryPanel,
  }))
);
const LazyVideoPropertiesPanel = React.lazy(() =>
  import("./VideoPropertiesPanel").then((module) => ({
    default: module.VideoPropertiesPanel,
  }))
);
const LazyMusicPropertiesPanel = React.lazy(() =>
  import("./MusicPropertiesPanel").then((module) => ({
    default: module.MusicPropertiesPanel,
  }))
);
const LazySoundPropertiesPanel = React.lazy(() =>
  import("./SoundPropertiesPanel").then((module) => ({
    default: module.SoundPropertiesPanel,
  }))
);
const LazySoundEffectsPropertiesPanel = React.lazy(() =>
  import("./SoundEffectsPropertiesPanel").then((module) => ({
    default: module.SoundEffectsPropertiesPanel,
  }))
);
const LazyVoicesPropertiesPanel = React.lazy(() =>
  import("./VoicesPropertiesPanel").then((module) => ({
    default: module.VoicesPropertiesPanel,
  }))
);
const LazyElementsPanel = React.lazy(() =>
  import("./ElementsPanel").then((module) => ({
    default: module.ElementsPanel,
  }))
);
const LazyMediaLibraryPanel = React.lazy(() =>
  import("./MediaLibraryPanel").then((module) => ({
    default: module.MediaLibraryPanel,
  }))
);
const LazyAiStudioInsufficientCreditsModal = React.lazy(() =>
  import("./AiStudioInsufficientCreditsModal").then((module) => ({
    default: module.AiStudioInsufficientCreditsModal,
  }))
);
const LazyModelModal = React.lazy(() =>
  import("./ModelModal").then((module) => ({
    default: module.ModelModal,
  }))
);
const LazyDetailModal = React.lazy(() =>
  import("./DetailModal").then((module) => ({
    default: module.DetailModal,
  }))
);
const LazySharedMediaDetailPreviewModal = React.lazy(() =>
  import("./detail-modal/SharedMediaDetailPreviewModal").then((module) => ({
    default: module.SharedMediaDetailPreviewModal,
  }))
);
const lazyPanelFallback = <p className="tiny subdued">Loading panel...</p>;
const lazyModalFallback = null;

type CreateSectionProps = AiStudioCreatePanelContract;
type EditExpertSectionProps = React.ComponentProps<typeof LazyExpertEditPanelView>;
type VideoSectionProps = React.ComponentProps<typeof LazyVideoPropertiesPanel>;
const PERFORMANCE_DENSE_REFERENCE_COUNT = 40;
const FLAG_SHELL_DECOUPLE = PERF_FLAG_SHELL_DECOUPLE;
const FLAG_DND_BACKPRESSURE = PERF_FLAG_SHELL_DND_BACKPRESSURE;
const FLAG_PANEL_MEMOIZATION = PERF_FLAG_SHELL_PANEL_MEMOIZATION;
const FLAG_SHELL_BOUNDARY_SPLIT = PERF_FLAG_SHELL_BOUNDARY_SPLIT;
const FLAG_HIGH_DENSITY_SHELL_MODE = PERF_FLAG_SHELL_HIGH_DENSITY_MODE;

type AiStudioAlertsStackProps = {
  uiError: string | null;
  uiNotice: string | null;
  visibleFailures: FailureCard[];
  mediaPlanNotice: {
    message: string;
    action: AppMessageAction;
  } | null;
  onDismissUiError: () => void;
  onDismissUiNotice: () => void;
  onDismissMediaPlanNotice: () => void;
  onDismissFailure: (id: string) => void;
};

type AiStudioAlertBannerProps = {
  message: string;
  variant: "error" | "warning" | "plan-access";
  role: "alert" | "status";
  live: "assertive" | "polite";
  action?: AppMessageAction;
  onDismiss: () => void;
};

const AI_STUDIO_ALERT_AUTO_DISMISS_MIN_MS = 9000;
const AI_STUDIO_ALERT_AUTO_DISMISS_MAX_MS = 16000;
const AI_STUDIO_ALERT_AUTO_DISMISS_MS_PER_CHAR = 60;

export const resolveAiStudioAlertAutoDismissMs = (message: string): number => {
  const textLength = message.trim().length;
  const calculatedMs = 3000 + textLength * AI_STUDIO_ALERT_AUTO_DISMISS_MS_PER_CHAR;
  return Math.min(
    AI_STUDIO_ALERT_AUTO_DISMISS_MAX_MS,
    Math.max(AI_STUDIO_ALERT_AUTO_DISMISS_MIN_MS, calculatedMs)
  );
};

const AiStudioAlertBanner = ({
  message,
  variant,
  role,
  live,
  action,
  onDismiss,
}: AiStudioAlertBannerProps) => {
  const tone: AppMessageTone = variant === "plan-access" ? "info" : variant;
  return (
    <AppMessage
      className={`ai-alert-banner ai-alert-banner--${variant}`}
      tone={tone}
      mode="banner"
      message={message}
      role={role}
      ariaLive={live}
      action={action}
      onDismiss={onDismiss}
    />
  );
};

const normalizeAlertText = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export const resolveCustomerFacingAiStudioUiError = (
  uiError: string | null | undefined
): string | null => {
  const normalizedFailure = normalizeCustomerFacingProviderError(uiError, "").trim();
  if (!normalizedFailure) return null;
  return normalizeProviderSideGenerationFailure({
    rawFailure: uiError,
    normalizedFailure,
    modelLabel: null,
  });
};

export const groupVisibleFailuresForAlertStack = (
  visibleFailures: FailureCard[]
): GroupedFailureCard[] => {
  const grouped = new Map<string, GroupedFailureCard>();
  visibleFailures.forEach((item) => {
    const presentation = resolveAiStudioErrorPresentation(item);
    const modelLabel = presentation.modelLabel;
    const failureMessage = presentation.bannerMessage;
    const groupKey = `${normalizeAlertText(modelLabel)}::${normalizeAlertText(failureMessage)}`;
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.ids.push(item.id);
      existing.count += 1;
      return;
    }
    grouped.set(groupKey, {
      ids: [item.id],
      modelLabel,
      failureMessage,
      count: 1,
    });
  });
  return Array.from(grouped.values());
};

const AiStudioAlertsStack = React.memo(function AiStudioAlertsStack({
  uiError,
  uiNotice,
  visibleFailures,
  mediaPlanNotice,
  onDismissUiError,
  onDismissUiNotice,
  onDismissMediaPlanNotice,
  onDismissFailure,
}: AiStudioAlertsStackProps) {
  const normalizedUiError = normalizeAlertText(uiError);
  const suppressUiErrorForFailureStack =
    normalizedUiError.length > 0 &&
    visibleFailures.some((item) => {
      const presentation = resolveAiStudioErrorPresentation(item);
      const normalizedDetail = normalizeAlertText(presentation.bannerMessage);
      if (!normalizedDetail) return false;
      const normalizedModelLabel = normalizeAlertText(presentation.modelLabel);
      return (
        normalizedUiError === normalizedDetail ||
        normalizedUiError === `${normalizedModelLabel} failed: ${normalizedDetail}`
      );
    });
  const isInsufficientCreditsUiError = isInsufficientCreditsLike(uiError);
  const effectiveUiError =
    suppressUiErrorForFailureStack || isInsufficientCreditsUiError
      ? null
      : resolveCustomerFacingAiStudioUiError(uiError);
  const groupedFailures = React.useMemo(
    () =>
      groupVisibleFailuresForAlertStack(
        visibleFailures.filter(
          (item) => resolveAiStudioErrorPresentation(item).category !== "insufficient_credits"
        )
      ),
    [visibleFailures]
  );
  const groupedFailureIdsKey = React.useMemo(
    () =>
      groupedFailures
        .flatMap((group) => group.ids)
        .sort()
        .join("|"),
    [groupedFailures]
  );
  const dismissGroupedFailures = React.useCallback(() => {
    groupedFailures.forEach((group) => {
      group.ids.forEach((id) => onDismissFailure(id));
    });
  }, [groupedFailures, onDismissFailure]);
  const hasVisibleAlerts = Boolean(
    mediaPlanNotice || effectiveUiError || uiNotice || groupedFailures.length
  );
  const dismissUiErrorRef = React.useRef(onDismissUiError);
  const dismissUiNoticeRef = React.useRef(onDismissUiNotice);

  React.useEffect(() => {
    dismissUiErrorRef.current = onDismissUiError;
  }, [onDismissUiError]);

  React.useEffect(() => {
    dismissUiNoticeRef.current = onDismissUiNotice;
  }, [onDismissUiNotice]);

  React.useEffect(() => {
    if (!effectiveUiError) return undefined;
    const timeoutId = window.setTimeout(() => {
      dismissUiErrorRef.current();
    }, resolveAiStudioAlertAutoDismissMs(effectiveUiError));
    return () => window.clearTimeout(timeoutId);
  }, [effectiveUiError]);

  React.useEffect(() => {
    if (!uiNotice) return undefined;
    const timeoutId = window.setTimeout(() => {
      dismissUiNoticeRef.current();
    }, resolveAiStudioAlertAutoDismissMs(uiNotice));
    return () => window.clearTimeout(timeoutId);
  }, [uiNotice]);

  React.useEffect(() => {
    if (!groupedFailureIdsKey) return undefined;
    const groupedFailureText = groupedFailures
      .map((group) => `${group.modelLabel} ${group.failureMessage}`)
      .join(" ");
    const timeoutId = window.setTimeout(() => {
      dismissGroupedFailures();
    }, resolveAiStudioAlertAutoDismissMs(groupedFailureText));
    return () => window.clearTimeout(timeoutId);
  }, [dismissGroupedFailures, groupedFailureIdsKey, groupedFailures]);

  if (!hasVisibleAlerts) return null;

  return (
    <AppMessageStack
      className="ai-alerts-stack"
      placement="viewport"
      label="AI Studio notifications"
    >
      {mediaPlanNotice ? (
        <AiStudioAlertBanner
          message={mediaPlanNotice.message}
          variant="plan-access"
          role="status"
          live="polite"
          action={mediaPlanNotice.action}
          onDismiss={onDismissMediaPlanNotice}
        />
      ) : null}
      {effectiveUiError ? (
        <AiStudioAlertBanner
          message={effectiveUiError}
          variant="error"
          role="alert"
          live="assertive"
          onDismiss={onDismissUiError}
        />
      ) : null}
      {uiNotice ? (
        <AiStudioAlertBanner
          message={uiNotice}
          variant="warning"
          role="status"
          live="polite"
          onDismiss={onDismissUiNotice}
        />
      ) : null}
      {groupedFailures.length ? (
        <AppMessage
          className="ai-error-stack"
          tone="error"
          mode="banner"
          role="alert"
          ariaLive="polite"
          onDismiss={dismissGroupedFailures}
        >
          <ul className="ai-error-list">
            {groupedFailures.map((group) => {
              const title =
                group.count > 1 ? `${group.modelLabel} (${group.count})` : group.modelLabel;
              return (
                <li key={`${group.modelLabel}:${group.failureMessage}`} className="ai-error-row">
                  <div className="ai-error-row-copy">
                    <p className="ai-error-row-title">{title}</p>
                    <p className="ai-error-row-message">{group.failureMessage}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </AppMessage>
      ) : null}
    </AppMessageStack>
  );
});

export type AiStudioPageContentProps = {
  sessionId?: string | null;
  referenceGridFileInputRef: React.RefObject<HTMLInputElement>;
  onFileBrowserSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uiError: string | null;
  uiNotice: string | null;
  mediaPlanNoticeMessage?: string | null;
  mediaPlanNoticeCta?: GenerationAccessCta | null;
  onMediaPlanAccessAttempt?: () => void;
  onDismissUiError: () => void;
  onDismissUiNotice: () => void;
  onDismissMediaPlanNotice?: () => void;
  balanceCredits: number | null;
  creditTotalCredits: number | null;
  pendingHoldCredits: number | null;
  balanceLoading: boolean;
  visibleFailures: FailureCard[];
  onDismissFailure: (id: string) => void;
  onInspectFailure: (id: string) => void;
  selectedTool: ToolId | null;
  characterCreateRequestKey?: number;
  elementCreateRequestKey?: number;
  showCreateTools: boolean;
  onOpenProjects?: () => void;
  onSelectTool: (tool: ToolId | null) => void;
  onToggleCreateTools: (value: boolean) => void;
  propertiesCreate: CreateSectionProps;
  propertiesEditExpert: EditExpertSectionProps;
  propertiesVideo: VideoSectionProps;
  propertiesMusic?: MusicPropertiesPanelProps;
  propertiesSoundEffects?: SoundEffectsPropertiesPanelProps;
  propertiesVoices?: VoicesPropertiesPanelProps;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
  isTemplateView: boolean;
  referenceGridProps: AiStudioReferenceGridContract;
  studioPreviewProps: React.ComponentProps<typeof StudioPreview>;
  detailModalOutput: StudioOutput | null;
  detailNavigation?: AiStudioDetailNavigationContract | null;
  sharedDetailModalItem?: SharedMediaDetailItemBase | null;
  isMediaStorageFull?: boolean;
  onDetailClose: () => void;
  onUpdateOutputPrompt: (id: string, prompt: string) => void;
  onDeleteOutput: (id: string) => void;
  onDetailDownload?: (id: string) => void;
  onDetailSaveReference?: (id: string) => void;
  onSnapshotVideoFrame?: SharedMediaDetailVideoSnapshotHandler;
  onSnapshotVideoFrameError?: SharedMediaDetailVideoSnapshotErrorHandler;
  onDetailReloadWorkflow?: (
    output: StudioOutput,
    options?: { mediaKindHint?: WorkflowReloadMediaKindHint | null }
  ) => void;
  onMediaLibraryRerollWorkflow?: (output: StudioOutput) => void;
  onDetailSavePrompt?: (promptText: string) => void | boolean | Promise<boolean>;
  onAddLibraryMediaReference?: (payload: LibraryMediaReferencePayload) => void;
  onAddLibraryMediaReferences?: (payloads: LibraryMediaReferencePayload[]) => void;
  onAddLibraryPromptReference?: (payload: LibraryPromptReferencePayload) => void;
  onDeleteMediaRowsFromWorkspace?: (rows: MediaFileRow[]) => void;
  mediaLibraryDetailSelectionTarget?: SharedMediaDetailSelectionTarget | null;
  onMediaLibraryDetailSelectionTargetChange?: (
    target: SharedMediaDetailSelectionTarget | null
  ) => void;
  projectId?: string | null;
  projectRouteRequested?: boolean;
  rightRailLayout: AiStudioRightRailLayoutV1;
  onRightRailLayoutChange: React.Dispatch<React.SetStateAction<AiStudioRightRailLayoutV1>>;
  projectName?: string | null;
  onProjectNameCommit?: (value: string) => void;
  onOpenProjectNameEditor?: () => void;
  mediaLibraryProjectNameFocusRequestKey?: number;
  resolveMediaLibraryInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  resolveStyleLibraryInternalDrop?: ResolveInternalStyleDrop;
  onOpenMediaLibrary?: () => void;
  modelModalState: {
    isOpen: boolean;
    options: ModelOption[];
    resolveCreditsForModel?: (modelId: string) => number | null;
    onClose: () => void;
    onSelect: (value: string) => void;
    context?: ModelModalContext | null;
    onPresentationResolved?: (payload: {
      context: ModelModalContext | null;
      suppliedOptionCount: number;
      visibleOptionCount: number;
    }) => void;
  };
  handleReferenceGridFiles: (files: FileList) => void;
  triggerFilePicker: () => void;
  resolveCharacterDropReference?: ResolveCharacterDropReference;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  pendingCharacterUploadRequest?: CharacterPanelUploadRequest | null;
  onCharacterUploadRequestHandled?: (requestId: number) => void;
  createSelectedCharacterId?: string | null;
  onCreateSelectedCharacterIdChange?: (characterId: string | null) => void;
  resolveElementProfileImageDropSource?: ResolveInternalReferenceDrop;
  resolveVoiceChangerInternalReferenceSource?: ResolveVoiceChangerInternalReferenceSource;
  onRegisterWorkflowReloadStylePrep?: (
    handler: ((styleContext: StudioOutput["styleContext"] | null) => void) | null
  ) => void;
  onSelectedStylePromptChange?: (stylePrompt: string | null) => void;
  onSelectedStyleContextChange?: (styleContext: StudioOutput["styleContext"] | null) => void;
};

export function AiStudioPageContent({
  sessionId = null,
  referenceGridFileInputRef,
  onFileBrowserSelection,
  uiError,
  uiNotice,
  mediaPlanNoticeMessage = null,
  mediaPlanNoticeCta = null,
  onMediaPlanAccessAttempt,
  onDismissUiError,
  onDismissUiNotice,
  onDismissMediaPlanNotice,
  balanceCredits,
  creditTotalCredits,
  balanceLoading,
  visibleFailures,
  onDismissFailure,
  selectedTool,
  characterCreateRequestKey = 0,
  elementCreateRequestKey = 0,
  showCreateTools,
  onOpenProjects,
  onSelectTool,
  onToggleCreateTools,
  propertiesCreate,
  propertiesEditExpert,
  propertiesVideo,
  propertiesMusic,
  propertiesSoundEffects,
  propertiesVoices,
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
  isTemplateView,
  referenceGridProps,
  studioPreviewProps,
  detailModalOutput,
  detailNavigation = null,
  sharedDetailModalItem = null,
  isMediaStorageFull = false,
  onDetailClose,
  onUpdateOutputPrompt,
  onDeleteOutput,
  onDetailDownload,
  onDetailSaveReference,
  onSnapshotVideoFrame,
  onSnapshotVideoFrameError,
  onDetailReloadWorkflow,
  onMediaLibraryRerollWorkflow,
  onDetailSavePrompt,
  onAddLibraryMediaReference,
  onAddLibraryMediaReferences,
  onAddLibraryPromptReference,
  onDeleteMediaRowsFromWorkspace,
  mediaLibraryDetailSelectionTarget = null,
  onMediaLibraryDetailSelectionTargetChange,
  projectId = null,
  projectRouteRequested = false,
  rightRailLayout,
  onRightRailLayoutChange,
  projectName,
  onProjectNameCommit,
  onOpenProjectNameEditor,
  mediaLibraryProjectNameFocusRequestKey = 0,
  resolveMediaLibraryInternalDropItem,
  resolveStyleLibraryInternalDrop,
  onOpenMediaLibrary,
  modelModalState,
  handleReferenceGridFiles,
  triggerFilePicker,
  resolveCharacterDropReference,
  canvasTearOutTargetRegistry,
  pendingCharacterUploadRequest = null,
  onCharacterUploadRequestHandled,
  createSelectedCharacterId = null,
  onCreateSelectedCharacterIdChange,
  resolveElementProfileImageDropSource,
  resolveVoiceChangerInternalReferenceSource,
  onRegisterWorkflowReloadStylePrep,
  onSelectedStylePromptChange,
  onSelectedStyleContextChange,
}: AiStudioPageContentProps) {
  const mediaPlanNotice = React.useMemo(
    () =>
      mediaPlanNoticeMessage && mediaPlanNoticeCta
        ? {
            message: mediaPlanNoticeMessage,
            action: {
              label: mediaPlanNoticeCta.label,
              href: mediaPlanNoticeCta.href,
            },
          }
        : null,
    [mediaPlanNoticeCta, mediaPlanNoticeMessage]
  );
  const handleDismissMediaPlanNotice = React.useCallback(() => {
    onDismissMediaPlanNotice?.();
  }, [onDismissMediaPlanNotice]);
  useAiStudioStabilityLifecycleTelemetry({
    projectId,
    projectRouteRequested,
  });

  const visibleProjectName =
    typeof projectName === "string" && projectName.trim().length > 0 ? projectName.trim() : null;
  const creditValueLabel = formatCreditFractionLabel({
    remainingCredits: balanceCredits,
    totalCredits: creditTotalCredits,
    loading: balanceLoading,
  });
  const resolvedReferenceGridFileInputRef = referenceGridFileInputRef;
  const resolvedCreateProperties = propertiesCreate;
  const resolvedStandardCreateProperties =
    resolvedCreateProperties.expertCreateMode === "standard"
      ? resolvedCreateProperties.standard
      : null;
  const resolvedPulseCreateProperties =
    resolvedCreateProperties.expertCreateMode === "pulse" ? resolvedCreateProperties.pulse : null;
  const detailPromptPinHandler =
    resolvedStandardCreateProperties?.onPinPromptReference ??
    propertiesEditExpert.onPinPromptReference ??
    propertiesVideo.onPinPromptReference;
  const resolvedReferenceGridProps = referenceGridProps;
  const selectedComingSoonTool = isComingSoonTool(selectedTool) ? selectedTool : null;
  const comingSoon = selectedComingSoonTool ? comingSoonCopy[selectedComingSoonTool] : null;
  const ComingSoonIcon = comingSoon ? comingSoon.icon : null;
  const referenceGridFileAccept = "image/*,video/*,audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga";
  const propertiesPanelKind = resolvePropertiesPanelKind(selectedTool);
  const showCreatePropertiesPanel = propertiesPanelKind === "create";
  const showExpertEditPanel = propertiesPanelKind === "edit";
  const showVideoPropertiesPanel = propertiesPanelKind === "video";
  const showStylesPanelEligible =
    showExpertEditPanel || showCreatePropertiesPanel || showVideoPropertiesPanel;
  const isPrimaryCharacterPanelOpen = isPrimaryCharacterTool(selectedTool);
  const isCharacterShellPanelOpen = isCharacterShellTool(selectedTool);
  const isCanvasVisible = rightRailLayout.panels.canvas;
  const [isStylesPanelVisible, setIsStylesPanelVisible] = React.useState(false);
  const panelVisibility = React.useMemo<PanelVisibilityState>(
    () => ({
      quickSlot: rightRailLayout.panels.quickSlot,
      referenceGrid: rightRailLayout.panels.referenceGrid,
      styles: isStylesPanelVisible,
    }),
    [isStylesPanelVisible, rightRailLayout.panels.quickSlot, rightRailLayout.panels.referenceGrid]
  );
  const [selectedStyleId, setSelectedStyleId] = React.useState<string | null>(null);
  const handleWorkflowReloadStylePrep = React.useCallback(
    (styleContext: StudioOutput["styleContext"] | null) => {
      const nextStyleId = styleContext?.applied ? styleContext.styleId?.trim() || null : null;
      setSelectedStyleId(nextStyleId);
      setIsStylesPanelVisible(false);
    },
    []
  );
  React.useEffect(() => {
    onRegisterWorkflowReloadStylePrep?.(handleWorkflowReloadStylePrep);
    return () => onRegisterWorkflowReloadStylePrep?.(null);
  }, [handleWorkflowReloadStylePrep, onRegisterWorkflowReloadStylePrep]);
  const [activeVoiceChangerSourceVideo, setActiveVoiceChangerSourceVideo] =
    React.useState<ActiveVoiceChangerSourceVideo | null>(null);
  const externalActiveVoiceChangerSourceVideoChange =
    propertiesVoices?.onActiveVoiceChangerSourceVideoChange;
  const handleActiveVoiceChangerSourceVideoChange = React.useCallback(
    (source: ActiveVoiceChangerSourceVideo | null) => {
      const nextSource = source ?? null;
      setActiveVoiceChangerSourceVideo((currentSource) =>
        areActiveVoiceChangerSourceVideosEqual(currentSource, nextSource)
          ? currentSource
          : nextSource
      );
      externalActiveVoiceChangerSourceVideoChange?.(nextSource);
    },
    [externalActiveVoiceChangerSourceVideoChange]
  );
  const [selectedPresetId, setSelectedPresetId] = React.useState<ExpertEditPresetId | null>(null);
  const [promptPresetEditRequest, setPromptPresetEditRequest] = React.useState<{
    presetId: ExpertEditPresetId;
    requestId: number;
  } | null>(null);
  const [uncontrolledExpertCreateMode, setUncontrolledExpertCreateMode] = React.useState<
    "standard" | "pulse"
  >("standard");
  const isExpertCreateModeControlled =
    resolvedCreateProperties.expertCreateMode != null &&
    resolvedCreateProperties.onExpertCreateModeChange != null;
  const expertCreateMode =
    resolvedCreateProperties.expertCreateMode ?? uncontrolledExpertCreateMode;
  const isQuickSlotToggleAvailable = Boolean(
    resolvedReferenceGridProps.onAddCuratedReference &&
    resolvedReferenceGridProps.onRemoveCuratedReference &&
    resolvedReferenceGridProps.onReorderCuratedReference
  );
  const isStylesToggleAvailable = !isPrimaryCharacterPanelOpen && showStylesPanelEligible;
  const panelToggleAvailability = React.useMemo(
    () => ({
      quickSlot: isQuickSlotToggleAvailable,
      styles: isStylesToggleAvailable,
    }),
    [isQuickSlotToggleAvailable, isStylesToggleAvailable]
  );
  const effectivePanelVisibility = React.useMemo(() => {
    const baseVisibility = resolveEffectivePanelVisibility({
      panelVisibility,
      availability: panelToggleAvailability,
    });
    if (selectedTool === "styles") {
      return {
        quickSlot: false,
        referenceGrid: true,
        styles: false,
      };
    }
    return baseVisibility;
  }, [panelToggleAvailability, panelVisibility, selectedTool]);
  const isStylesPanelOpen = effectivePanelVisibility.styles;
  const shouldWarmStylesCatalog =
    isStylesPanelOpen || selectedTool === "styles" || selectedStyleId != null;
  const [stylesCatalogWarmRequested, setStylesCatalogWarmRequested] =
    React.useState(shouldWarmStylesCatalog);
  React.useEffect(() => {
    if (stylesCatalogWarmRequested || !shouldWarmStylesCatalog) return;
    setStylesCatalogWarmRequested(true);
  }, [shouldWarmStylesCatalog, stylesCatalogWarmRequested]);
  const shouldLoadStylesCatalog = stylesCatalogWarmRequested || shouldWarmStylesCatalog;
  const {
    handleDeleteStyle,
    handleReorderStyle,
    handleRestoreBuiltInStyles,
    styleDetailsSaveError,
    stylesDeleteError,
    upsertStyleDetails,
    visibleStylesCatalog,
  } = useAiStudioStylesRuntime({
    enabled: shouldLoadStylesCatalog,
    selectedStyleId,
    setSelectedStyleId,
    onSelectedStylePromptChange,
    onSelectedStyleContextChange,
  });
  const headerShortcutStates = React.useMemo(
    () =>
      resolveHeaderShortcutStateMap({
        effectiveVisibility: effectivePanelVisibility,
        availability: panelToggleAvailability,
      }),
    [effectivePanelVisibility, panelToggleAvailability]
  );
  const visibleHeaderShortcutButtons = React.useMemo(() => AI_STUDIO_HEADER_SHORTCUT_BUTTONS, []);
  const handleHeaderShortcutToggle = React.useCallback(
    (shortcutId: HeaderShortcutId) => {
      if (shortcutId === "styles") {
        setIsStylesPanelVisible(
          (previous) =>
            togglePanelVisibilityByShortcut({
              panelVisibility: {
                quickSlot: rightRailLayout.panels.quickSlot,
                referenceGrid: rightRailLayout.panels.referenceGrid,
                styles: previous,
              },
              shortcutId,
              availability: panelToggleAvailability,
            }).styles
        );
        return;
      }
      onRightRailLayoutChange((previous) => {
        const nextVisibility = togglePanelVisibilityByShortcut({
          panelVisibility: {
            quickSlot: previous.panels.quickSlot,
            referenceGrid: previous.panels.referenceGrid,
            styles: false,
          },
          shortcutId,
          availability: panelToggleAvailability,
        });
        return {
          ...previous,
          panels: {
            ...previous.panels,
            quickSlot: nextVisibility.quickSlot,
            referenceGrid: nextVisibility.referenceGrid,
          },
        };
      });
    },
    [
      onRightRailLayoutChange,
      panelToggleAvailability,
      rightRailLayout.panels.quickSlot,
      rightRailLayout.panels.referenceGrid,
    ]
  );
  const { activeCount } = useOutputCounts();
  React.useEffect(() => {
    if (selectedTool === "voice-changer") return;
    setActiveVoiceChangerSourceVideo(null);
  }, [selectedTool]);
  const isPerformanceDenseSession =
    FLAG_HIGH_DENSITY_SHELL_MODE && activeCount >= PERFORMANCE_DENSE_REFERENCE_COUNT;
  const minLeftWidthPx = isCharacterShellPanelOpen
    ? AI_SHELL_LEFT_CHARACTER_MIN_PX
    : isSoundWorkflow(selectedTool)
      ? AI_SHELL_LEFT_SOUND_MIN_PX
      : selectedTool === "video" || selectedTool === "kling"
        ? AI_SHELL_LEFT_VIDEO_MIN_PX
        : selectedTool === "media-library"
          ? AI_SHELL_LEFT_MEDIA_LIBRARY_MIN_PX
          : selectedTool === "presets" || selectedTool === "styles"
            ? AI_SHELL_LEFT_PRESETS_MIN_PX
            : showCreatePropertiesPanel
              ? AI_SHELL_LEFT_CREATE_MIN_PX
              : showExpertEditPanel
                ? AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX
                : undefined;
  const isCollapsibleRightRailShell =
    showCreatePropertiesPanel ||
    showExpertEditPanel ||
    showVideoPropertiesPanel ||
    isSoundWorkflow(selectedTool);
  const minRightWidthPx = isCollapsibleRightRailShell ? AI_SHELL_RIGHT_COLLAPSED_MIN_PX : undefined;
  const defaultLeftRatio = isSoundWorkflow(selectedTool)
    ? 0.65
    : selectedTool === "character" || selectedTool === "elements"
      ? AI_SHELL_LEFT_CHARACTER_DEFAULT_RATIO
      : selectedTool === "video" || selectedTool === "kling"
        ? AI_SHELL_LEFT_VIDEO_DEFAULT_RATIO
        : undefined;
  const {
    shellRef,
    leftColumnRef,
    leftWidthPx,
    showDivider,
    isResizing,
    isLayoutAnimating,
    shellStyle,
    shellLayoutMode,
    collapseToMin,
    resetToDefaultWidth,
    restoreWidth,
    expandToMax,
    dividerProps,
    leftColumnHidden,
    rightColumnHidden,
  } = useAiStudioShellResize({
    enabled: Boolean(selectedTool),
    minLeftWidthPx,
    minRightWidthPx,
    defaultLeftRatio,
    minWidthResetKey: projectId,
    allowLeftCollapse: isCollapsibleRightRailShell,
  });
  const mediaLibraryExpandedWidthRef = React.useRef<number | null>(null);
  const [isMediaLibraryPanelExpanded, setIsMediaLibraryPanelExpanded] = React.useState(false);
  const handleExpandMediaLibraryPanel = React.useCallback(() => {
    if (isMediaLibraryPanelExpanded) return;
    mediaLibraryExpandedWidthRef.current =
      typeof leftWidthPx === "number" && Number.isFinite(leftWidthPx) ? leftWidthPx : null;
    expandToMax();
    setIsMediaLibraryPanelExpanded(true);
  }, [expandToMax, isMediaLibraryPanelExpanded, leftWidthPx]);
  const handleCollapseMediaLibraryPanel = React.useCallback(() => {
    restoreWidth(mediaLibraryExpandedWidthRef.current);
    mediaLibraryExpandedWidthRef.current = null;
    setIsMediaLibraryPanelExpanded(false);
  }, [restoreWidth]);
  React.useEffect(() => {
    if (selectedTool === "media-library") return;
    mediaLibraryExpandedWidthRef.current = null;
    setIsMediaLibraryPanelExpanded(false);
  }, [selectedTool]);
  const effectiveRightColumnHidden = rightColumnHidden;
  const shellClassName = [
    "ai-shell",
    "ai-shell-motion-flat",
    selectedTool ? "" : "ai-shell-wide",
    showDivider ? "ai-shell-resizable" : "",
    showCreatePropertiesPanel ? "ai-shell-expert-create" : "",
    showExpertEditPanel ? "ai-shell-expert-edit" : "",
    isCharacterShellPanelOpen ? "ai-shell-character-open" : "",
    `ai-shell-mode-${shellLayoutMode}`,
    isPerformanceDenseSession ? "ai-shell-performance-dense" : "",
    isResizing ? "ai-shell-resizing" : "",
    isLayoutAnimating ? "ai-shell-layout-animating" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const previousSelectedToolRef = React.useRef<ToolId | null>(null);
  const previousExpertCreateModeRef = React.useRef<"standard" | "pulse">(expertCreateMode);
  const previousSessionIdRef = React.useRef<string | null>(sessionId);
  React.useEffect(() => {
    const previousSelectedTool = previousSelectedToolRef.current;
    const previousExpertCreateMode = previousExpertCreateModeRef.current;
    const previousSessionId = previousSessionIdRef.current;
    const shouldResetForToolbarSelection = shouldResetAiShellToDefaultOnToolSelect(
      previousSelectedTool,
      selectedTool
    );
    if (shouldResetForToolbarSelection) {
      resetToDefaultWidth();
      previousSelectedToolRef.current = selectedTool;
      previousExpertCreateModeRef.current = expertCreateMode;
      previousSessionIdRef.current = sessionId;
      return;
    }
    const shouldCollapseForStandardCreateSession = shouldCollapseCreateOnSessionChange({
      previousSessionId,
      nextSessionId: sessionId,
      nextTool: selectedTool,
      nextMode: expertCreateMode,
      createModeEnabled: showCreatePropertiesPanel,
    });
    if (shouldCollapseForStandardCreateSession) {
      collapseToMin();
      previousSelectedToolRef.current = selectedTool;
      previousExpertCreateModeRef.current = expertCreateMode;
      previousSessionIdRef.current = sessionId;
      return;
    }
    const expertCreateShellResizeAction = resolveCreateShellResizeAction({
      previousTool: previousSelectedTool,
      nextTool: selectedTool,
      previousMode: previousExpertCreateMode,
      nextMode: expertCreateMode,
      createModeEnabled: showCreatePropertiesPanel,
    });
    const isInitialSoundSelection = shouldCollapseAiShellOnInitialSoundSelection(
      previousSelectedTool,
      selectedTool
    );
    if (isInitialSoundSelection) {
      collapseToMin();
      previousSelectedToolRef.current = selectedTool;
      previousExpertCreateModeRef.current = expertCreateMode;
      previousSessionIdRef.current = sessionId;
      return;
    }
    if (expertCreateShellResizeAction != null) {
      collapseToMin();
    }
    previousSelectedToolRef.current = selectedTool;
    previousExpertCreateModeRef.current = expertCreateMode;
    previousSessionIdRef.current = sessionId;
  }, [
    collapseToMin,
    expertCreateMode,
    resetToDefaultWidth,
    sessionId,
    selectedTool,
    showCreatePropertiesPanel,
  ]);
  const rightColumnRef = React.useRef<HTMLDivElement | null>(null);
  const handleStylesPanelToggle = React.useCallback(() => {
    setIsStylesPanelVisible(
      (previous) =>
        togglePanelVisibilityByShortcut({
          panelVisibility: {
            quickSlot: rightRailLayout.panels.quickSlot,
            referenceGrid: rightRailLayout.panels.referenceGrid,
            styles: previous,
          },
          shortcutId: "styles",
          availability: panelToggleAvailability,
        }).styles
    );
  }, [
    panelToggleAvailability,
    rightRailLayout.panels.quickSlot,
    rightRailLayout.panels.referenceGrid,
  ]);
  const handleExpertCreateModeChange = React.useCallback(
    (nextMode: "standard" | "pulse") => {
      if (expertCreateMode === nextMode) return;
      if (isExpertCreateModeControlled) {
        resolvedCreateProperties.onExpertCreateModeChange?.(nextMode);
        return;
      }
      setUncontrolledExpertCreateMode(nextMode);
    },
    [expertCreateMode, isExpertCreateModeControlled, resolvedCreateProperties]
  );
  const handleCanvasVisibilityToggle = React.useCallback(() => {
    onRightRailLayoutChange((previous) => ({
      ...previous,
      panels: {
        ...previous.panels,
        canvas: !previous.panels.canvas,
      },
    }));
  }, [onRightRailLayoutChange]);
  const handleSelectedStyleIdChange = React.useCallback((styleId: string | null) => {
    setSelectedStyleId(styleId);
    setIsStylesPanelVisible(false);
  }, []);
  const handleToolSelection = React.useCallback(
    (tool: ToolId | null) => {
      onSelectTool(tool);
    },
    [onSelectTool]
  );
  const handleOpenPromptPresetsLibrary = React.useCallback(
    (presetId?: ExpertEditPresetId | null) => {
      const requestedPresetId = presetId ?? null;
      if (requestedPresetId) {
        setSelectedPresetId(requestedPresetId);
        setPromptPresetEditRequest((previous) => ({
          presetId: requestedPresetId,
          requestId: (previous?.requestId ?? 0) + 1,
        }));
      }
      handleToolSelection("presets");
    },
    [handleToolSelection]
  );
  const handlePromptPresetEditRequestConsumed = React.useCallback(() => {
    setPromptPresetEditRequest(null);
  }, []);
  const resolvedExpertEditProperties = React.useMemo(
    () => ({
      ...propertiesEditExpert,
      isStylesPanelOpen,
      onStylesPanelToggle: handleStylesPanelToggle,
      onOpenPresetsLibrary: handleOpenPromptPresetsLibrary,
      selectedStyleId,
      stylesCatalog: visibleStylesCatalog,
    }),
    [
      handleOpenPromptPresetsLibrary,
      handleStylesPanelToggle,
      isStylesPanelOpen,
      propertiesEditExpert,
      selectedStyleId,
      visibleStylesCatalog,
    ]
  );
  const createModeToggle = React.useMemo(
    () => <CreateModeToggle value={expertCreateMode} onChange={handleExpertCreateModeChange} />,
    [expertCreateMode, handleExpertCreateModeChange]
  );
  const resolvedStandardCreatePropertiesWithStyles = React.useMemo(
    () =>
      resolvedStandardCreateProperties
        ? {
            ...resolvedStandardCreateProperties,
            isStylesPanelOpen,
            onStylesPanelToggle: handleStylesPanelToggle,
            onOpenPresetsLibrary: handleOpenPromptPresetsLibrary,
            selectedStyleId,
            stylesCatalog: visibleStylesCatalog,
            createModeToggle,
          }
        : null,
    [
      createModeToggle,
      handleOpenPromptPresetsLibrary,
      handleStylesPanelToggle,
      isStylesPanelOpen,
      resolvedStandardCreateProperties,
      selectedStyleId,
      visibleStylesCatalog,
    ]
  );
  const resolvedVideoPropertiesWithStyles = React.useMemo(
    () => ({
      ...propertiesVideo,
      isStylesPanelOpen,
      onStylesPanelToggle: handleStylesPanelToggle,
      selectedStyleId,
      stylesCatalog: visibleStylesCatalog,
    }),
    [
      handleStylesPanelToggle,
      isStylesPanelOpen,
      propertiesVideo,
      selectedStyleId,
      visibleStylesCatalog,
    ]
  );
  const resolvedPulseCreatePropertiesWithRuntime = React.useMemo(
    () =>
      resolvedPulseCreateProperties
        ? {
            ...resolvedPulseCreateProperties,
            onOpenPresetsLibrary: handleOpenPromptPresetsLibrary,
            createModeToggle,
          }
        : null,
    [createModeToggle, handleOpenPromptPresetsLibrary, resolvedPulseCreateProperties]
  );
  const resolvedReferenceGridPropsWithStylesPanel = React.useMemo(
    () => ({
      ...resolvedReferenceGridProps,
      railCanvasProps: isCanvasVisible ? resolvedReferenceGridProps.railCanvasProps : undefined,
      rightRailLayout,
      onRightRailLayoutChange,
      isShellResizeActive: isResizing,
      panelVisibility: effectivePanelVisibility,
      stylesPanel: {
        isOpen: isStylesPanelOpen,
        selectedStyleId,
        styles: visibleStylesCatalog,
        onSelectStyle: handleSelectedStyleIdChange,
      },
    }),
    [
      effectivePanelVisibility,
      handleSelectedStyleIdChange,
      isResizing,
      isStylesPanelOpen,
      isCanvasVisible,
      onRightRailLayoutChange,
      resolvedReferenceGridProps,
      rightRailLayout,
      selectedStyleId,
      visibleStylesCatalog,
    ]
  );
  const promptCustomPresetOverrides = propertiesEditExpert.customPresetOverrides;
  const promptSystemPresetDefinitions = propertiesEditExpert.systemPresetDefinitions;
  const promptDeletedSystemPresetIds = propertiesEditExpert.deletedSystemPresetIds;
  const onPromptCustomPresetOverridesChange = propertiesEditExpert.onCustomPresetOverridesChange;
  const onDeletePromptSystemPreset = propertiesEditExpert.onDeleteSystemPreset;
  const onRestorePromptBuiltIns = propertiesEditExpert.onRestoreDeletedSystemPresets;
  const presetsLibraryCatalog = React.useMemo(
    () =>
      resolveExpertEditPresetCatalog(
        promptCustomPresetOverrides,
        promptSystemPresetDefinitions,
        promptDeletedSystemPresetIds
      ),
    [promptCustomPresetOverrides, promptDeletedSystemPresetIds, promptSystemPresetDefinitions]
  );
  const handleSelectedPresetIdChange = React.useCallback((presetId: ExpertEditPresetId | null) => {
    setSelectedPresetId(presetId);
  }, []);
  const handlePresetOverrideSave = React.useCallback(
    async (presetId: ExpertEditPresetId, override: ExpertEditPresetOverride): Promise<boolean> => {
      const isDeletedOverride =
        override.label === EDIT_PRESET_DELETED_OVERRIDE_LABEL &&
        override.prompt === EDIT_PRESET_DELETED_OVERRIDE_PROMPT;
      if (!isExpertEditCustomPresetId(presetId)) {
        if (!isDeletedOverride || !onDeletePromptSystemPreset) return false;
        const deleteResult = await onDeletePromptSystemPreset(presetId);
        return deleteResult !== false;
      }
      const onCustomPresetOverridesChange = onPromptCustomPresetOverridesChange;
      if (!onCustomPresetOverridesChange) return false;
      const currentOverrides = promptCustomPresetOverrides ?? {};
      const saveResult = await onCustomPresetOverridesChange({
        ...currentOverrides,
        [presetId]: {
          label: override.label,
          prompt: override.prompt,
        },
      });
      return saveResult !== false;
    },
    [onDeletePromptSystemPreset, onPromptCustomPresetOverridesChange, promptCustomPresetOverrides]
  );
  const handleRestorePromptBuiltIns = React.useCallback(async (): Promise<boolean> => {
    if (!onRestorePromptBuiltIns) return true;
    const restoreResult = await onRestorePromptBuiltIns();
    return restoreResult !== false;
  }, [onRestorePromptBuiltIns]);
  const shouldReferenceGridOwnFileDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>): boolean =>
      doesReferenceGridOwnFileDrop(event, rightColumnRef.current),
    [rightColumnRef]
  );

  useVisibleErrorTelemetry({
    source: "telemetry.ai_studio.ui_error_banner",
    scope: "app",
    severity: "low",
    message: uiError,
    metadata: {
      selected_tool: selectedTool,
    },
  });

  useVisibleErrorTelemetry({
    source: "telemetry.ai_studio.notice_banner",
    scope: "app",
    severity: "low",
    message: uiNotice,
    metadata: {
      selected_tool: selectedTool,
    },
  });

  const visibleFailureIds = React.useMemo(
    () => visibleFailures.map((item) => item.id).slice(0, 20),
    [visibleFailures]
  );

  useVisibleErrorTelemetry({
    source: "telemetry.ai_studio.failure_stack",
    scope: "generation",
    severity: "low",
    message:
      visibleFailures.length > 0
        ? `${visibleFailures.length} generation failure card(s) visible in UI.`
        : null,
    metadata: {
      selected_tool: selectedTool,
      failure_count: visibleFailures.length,
      failure_ids: visibleFailureIds,
    },
  });

  const createPropertiesPanelContent = React.useMemo(() => {
    const shouldRenderPulseCreateProperties =
      resolvedCreateProperties.expertCreateMode === "pulse" &&
      resolvedPulseCreatePropertiesWithRuntime;
    if (shouldRenderPulseCreateProperties) {
      return (
        <PulseCreatePropertiesPanel
          key="pulse-create-runtime"
          {...resolvedPulseCreatePropertiesWithRuntime}
        />
      );
    }
    if (!resolvedStandardCreatePropertiesWithStyles) return null;
    return (
      <StandardCreatePropertiesPanel
        key="standard-create-runtime"
        {...resolvedStandardCreatePropertiesWithStyles}
      />
    );
  }, [
    resolvedCreateProperties.expertCreateMode,
    resolvedPulseCreatePropertiesWithRuntime,
    resolvedStandardCreatePropertiesWithStyles,
  ]);
  const editPropertiesPanelContent = React.useMemo(
    () => (
      <React.Suspense fallback={lazyPanelFallback}>
        <LazyExpertEditPanelView {...resolvedExpertEditProperties} />
      </React.Suspense>
    ),
    [resolvedExpertEditProperties]
  );
  const videoPropertiesPanelContent = React.useMemo(
    () => (
      <React.Suspense fallback={lazyPanelFallback}>
        <LazyVideoPropertiesPanel {...resolvedVideoPropertiesWithStyles} />
      </React.Suspense>
    ),
    [resolvedVideoPropertiesWithStyles]
  );
  const characterPropertiesPanelContent = React.useMemo(
    () => (
      <React.Suspense fallback={lazyPanelFallback}>
        <LazyCharacterPanel
          createRequestKey={characterCreateRequestKey}
          externalUploadRequest={pendingCharacterUploadRequest}
          onExternalUploadRequestHandled={onCharacterUploadRequestHandled}
          projectId={projectId}
          projectRouteRequested={projectRouteRequested}
          isStorageQuotaBlocked={isMediaStorageFull}
          selectedCharacterId={createSelectedCharacterId}
          onSelectedCharacterIdChange={onCreateSelectedCharacterIdChange}
          resolveCharacterDropReference={resolveCharacterDropReference}
          canvasTearOutTargetRegistry={canvasTearOutTargetRegistry}
          resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
          detailSelectionTarget={mediaLibraryDetailSelectionTarget}
          onDetailSelectionTargetChange={onMediaLibraryDetailSelectionTargetChange}
          onSnapshotVideoFrame={onSnapshotVideoFrame}
          onSnapshotVideoFrameError={onSnapshotVideoFrameError}
          generationAccessCta={mediaPlanNoticeCta}
        />
      </React.Suspense>
    ),
    [
      characterCreateRequestKey,
      canvasTearOutTargetRegistry,
      createSelectedCharacterId,
      onCharacterUploadRequestHandled,
      onCreateSelectedCharacterIdChange,
      pendingCharacterUploadRequest,
      mediaLibraryDetailSelectionTarget,
      onMediaLibraryDetailSelectionTargetChange,
      onSnapshotVideoFrame,
      onSnapshotVideoFrameError,
      isMediaStorageFull,
      projectId,
      projectRouteRequested,
      resolveCharacterDropReference,
      resolveMediaLibraryInternalDropItem,
      mediaPlanNoticeCta,
    ]
  );
  const sharedDetailModalActionItems = React.useMemo(() => {
    if (!sharedDetailModalItem) return [];
    const downloadUrl =
      sharedDetailModalItem.media.fullUrl?.trim() ||
      sharedDetailModalItem.media.previewUrl?.trim() ||
      sharedDetailModalItem.media.url.trim();
    const downloadName =
      sharedDetailModalItem.media.filename?.trim() ||
      sharedDetailModalItem.presentation?.title?.trim() ||
      sharedDetailModalItem.media.id;
    return resolveSharedMediaDetailMediaActionItems({
      canDownload: sharedDetailModalItem.capabilities.canDownload,
      onDownload: downloadUrl ? () => downloadUrlToFile(downloadUrl, downloadName) : null,
    });
  }, [sharedDetailModalItem]);
  const presetsPropertiesPanelContent = React.useMemo(
    () => (
      <PresetsPanelLoader
        promptPresets={presetsLibraryCatalog}
        selectedPromptPresetId={selectedPresetId}
        openPromptPresetEditRequest={promptPresetEditRequest}
        onOpenPromptPresetEditRequestConsumed={handlePromptPresetEditRequestConsumed}
        onOpenCreateWorkflow={() => handleToolSelection("create")}
        onOpenEditWorkflow={() => handleToolSelection("edit")}
        onSelectPromptPreset={handleSelectedPresetIdChange}
        onSavePromptPresetOverride={handlePresetOverrideSave}
        onRestorePromptBuiltIns={handleRestorePromptBuiltIns}
      />
    ),
    [
      handleToolSelection,
      handlePresetOverrideSave,
      handlePromptPresetEditRequestConsumed,
      handleSelectedPresetIdChange,
      handleRestorePromptBuiltIns,
      promptPresetEditRequest,
      presetsLibraryCatalog,
      selectedPresetId,
    ]
  );
  const elementsPropertiesPanelContent = React.useMemo(
    () => (
      <React.Suspense fallback={lazyPanelFallback}>
        <LazyElementsPanel
          createRequestKey={elementCreateRequestKey}
          projectId={projectId}
          isStorageQuotaBlocked={isMediaStorageFull}
          resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
          resolveProfileImageDropSource={resolveElementProfileImageDropSource}
          canvasTearOutTargetRegistry={canvasTearOutTargetRegistry}
          detailSelectionTarget={mediaLibraryDetailSelectionTarget}
          onDetailSelectionTargetChange={onMediaLibraryDetailSelectionTargetChange}
          onSnapshotVideoFrame={onSnapshotVideoFrame}
          onSnapshotVideoFrameError={onSnapshotVideoFrameError}
          generationAccessCta={mediaPlanNoticeCta}
        />
      </React.Suspense>
    ),
    [
      elementCreateRequestKey,
      canvasTearOutTargetRegistry,
      mediaLibraryDetailSelectionTarget,
      onMediaLibraryDetailSelectionTargetChange,
      onSnapshotVideoFrame,
      onSnapshotVideoFrameError,
      isMediaStorageFull,
      projectId,
      resolveElementProfileImageDropSource,
      resolveMediaLibraryInternalDropItem,
      mediaPlanNoticeCta,
    ]
  );
  const stylesPropertiesPanelContent = React.useMemo(
    () => (
      <React.Suspense fallback={lazyPanelFallback}>
        <LazyStylesLibraryPanel
          styles={visibleStylesCatalog}
          onReorderStyle={handleReorderStyle}
          onSaveStyleDetails={upsertStyleDetails}
          saveError={styleDetailsSaveError}
          onDeleteStyle={handleDeleteStyle}
          deleteError={stylesDeleteError}
          onRestoreBuiltInStyles={handleRestoreBuiltInStyles}
          resolveInternalStyleDrop={resolveStyleLibraryInternalDrop}
        />
      </React.Suspense>
    ),
    [
      handleDeleteStyle,
      handleReorderStyle,
      handleRestoreBuiltInStyles,
      resolveStyleLibraryInternalDrop,
      styleDetailsSaveError,
      stylesDeleteError,
      upsertStyleDetails,
      visibleStylesCatalog,
    ]
  );
  const mediaLibraryPropertiesPanelContent = React.useMemo(
    () =>
      onAddLibraryMediaReference && onAddLibraryPromptReference ? (
        <React.Suspense fallback={<p className="tiny subdued">Loading Media Library...</p>}>
          <LazyMediaLibraryPanel
            key={projectId ?? "no-project"}
            onSelectMedia={onAddLibraryMediaReference}
            onSelectPrompt={onAddLibraryPromptReference}
            projectId={projectId}
            projectName={projectName ?? null}
            onProjectNameCommit={onProjectNameCommit}
            projectNameFocusRequestKey={mediaLibraryProjectNameFocusRequestKey}
            isMediaLibraryPanelExpanded={isMediaLibraryPanelExpanded}
            isStorageQuotaBlocked={isMediaStorageFull}
            isPlanAccessBlocked={Boolean(mediaPlanNoticeCta)}
            onPlanAccessBlockedUploadAttempt={onMediaPlanAccessAttempt}
            onExpandMediaLibraryPanel={handleExpandMediaLibraryPanel}
            onCollapseMediaLibraryPanel={handleCollapseMediaLibraryPanel}
            resolveInternalDropItem={resolveMediaLibraryInternalDropItem}
            onDeleteMediaRowsFromWorkspace={onDeleteMediaRowsFromWorkspace}
            onRerollWorkflowFromMedia={onMediaLibraryRerollWorkflow}
            onSnapshotVideoFrame={onSnapshotVideoFrame}
            onSnapshotVideoFrameError={onSnapshotVideoFrameError}
            detailSelectionTarget={mediaLibraryDetailSelectionTarget}
            onDetailSelectionTargetChange={onMediaLibraryDetailSelectionTargetChange}
          />
        </React.Suspense>
      ) : (
        <p className="tiny subdued">Media Library panel is unavailable.</p>
      ),
    [
      onAddLibraryMediaReference,
      onAddLibraryPromptReference,
      onDeleteMediaRowsFromWorkspace,
      onMediaLibraryRerollWorkflow,
      onSnapshotVideoFrame,
      onSnapshotVideoFrameError,
      mediaLibraryDetailSelectionTarget,
      onMediaLibraryDetailSelectionTargetChange,
      projectId,
      isMediaStorageFull,
      handleCollapseMediaLibraryPanel,
      handleExpandMediaLibraryPanel,
      isMediaLibraryPanelExpanded,
      mediaLibraryProjectNameFocusRequestKey,
      mediaPlanNoticeCta,
      onMediaPlanAccessAttempt,
      onProjectNameCommit,
      projectName,
      resolveMediaLibraryInternalDropItem,
    ]
  );
  const resolvePropertiesPanelContent = React.useCallback(
    (kind: typeof propertiesPanelKind) => {
      switch (kind) {
        case "create":
          return createPropertiesPanelContent;
        case "edit":
          return editPropertiesPanelContent;
        case "video":
          return videoPropertiesPanelContent;
        case "music":
          return (
            <React.Suspense fallback={lazyPanelFallback}>
              <LazyMusicPropertiesPanel
                canvasTearOutTargetRegistry={canvasTearOutTargetRegistry}
                {...propertiesMusic}
              />
            </React.Suspense>
          );
        case "sound":
          return (
            <React.Suspense fallback={lazyPanelFallback}>
              <LazySoundPropertiesPanel onSelectTool={handleToolSelection} />
            </React.Suspense>
          );
        case "sound-effects":
          return (
            <React.Suspense fallback={lazyPanelFallback}>
              <LazySoundEffectsPropertiesPanel
                canvasTearOutTargetRegistry={canvasTearOutTargetRegistry}
                {...propertiesSoundEffects}
              />
            </React.Suspense>
          );
        case "voices":
          return (
            <React.Suspense fallback={lazyPanelFallback}>
              <LazyVoicesPropertiesPanel
                selectedTool={selectedTool}
                canvasTearOutTargetRegistry={canvasTearOutTargetRegistry}
                {...propertiesVoices}
                onActiveVoiceChangerSourceVideoChange={handleActiveVoiceChangerSourceVideoChange}
                resolveVoiceChangerInternalReferenceSource={
                  resolveVoiceChangerInternalReferenceSource
                }
              />
            </React.Suspense>
          );
        case "character":
          return characterPropertiesPanelContent;
        case "presets":
          return presetsPropertiesPanelContent;
        case "elements":
          return elementsPropertiesPanelContent;
        case "styles":
          return stylesPropertiesPanelContent;
        case "media-library":
          return mediaLibraryPropertiesPanelContent;
        case "none":
        default:
          return null;
      }
    },
    [
      characterPropertiesPanelContent,
      canvasTearOutTargetRegistry,
      createPropertiesPanelContent,
      elementsPropertiesPanelContent,
      editPropertiesPanelContent,
      handleToolSelection,
      mediaLibraryPropertiesPanelContent,
      propertiesMusic,
      propertiesSoundEffects,
      propertiesVoices,
      handleActiveVoiceChangerSourceVideoChange,
      resolveVoiceChangerInternalReferenceSource,
      presetsPropertiesPanelContent,
      selectedTool,
      stylesPropertiesPanelContent,
      videoPropertiesPanelContent,
    ]
  );
  const memoizedPropertiesPanelContent = React.useMemo(
    () => resolvePropertiesPanelContent(propertiesPanelKind),
    [propertiesPanelKind, resolvePropertiesPanelContent]
  );
  const propertiesPanelContent = FLAG_PANEL_MEMOIZATION
    ? memoizedPropertiesPanelContent
    : resolvePropertiesPanelContent(propertiesPanelKind);
  const toolbarRail = FLAG_SHELL_BOUNDARY_SPLIT ? (
    <AiStudioToolbarRail
      selectedTool={selectedTool}
      showCreateTools={showCreateTools}
      onOpenProjects={onOpenProjects}
      onSelectTool={handleToolSelection}
      onToggleCreateTools={onToggleCreateTools}
    />
  ) : (
    <AiStudioToolbar
      selectedTool={selectedTool}
      showCreateTools={showCreateTools}
      onOpenProjects={onOpenProjects}
      onSelectTool={handleToolSelection}
      onToggleCreateTools={onToggleCreateTools}
    />
  );

  const {
    dropMode: rightColumnDropMode,
    handleDragEnterCapture: handleRightColumnDragEnterCapture,
    handleDragOverCapture: handleRightColumnDragOverCapture,
    handleDragLeaveCapture: handleRightColumnDragLeaveCapture,
    handleDropCapture: handleRightColumnDropCapture,
    handleShellDragOverCapture,
    handleShellDropCapture,
  } = useAiStudioShellDndController({
    shellRef: shellRef as React.RefObject<HTMLElement | null>,
    rightColumnRef: rightColumnRef as React.RefObject<HTMLElement | null>,
    resolveDropMode: (transfer) => resolveRightColumnDropMode(transfer) as RightColumnDropMode,
    resolveDropPayload: (transfer) => resolveRightColumnDropPayload(transfer),
    onDropFiles: handleReferenceGridFiles,
    onDropMediaReference: resolvedReferenceGridPropsWithStylesPanel.onPasteMediaReference,
    onDropLibraryMediaReference: onAddLibraryMediaReference,
    onDropLibraryMediaReferences: onAddLibraryMediaReferences,
    onDropLibraryPromptReference: onAddLibraryPromptReference,
    onDropTextReference: resolvedReferenceGridPropsWithStylesPanel.onPasteTextReference,
    useRafBackpressure: FLAG_SHELL_DECOUPLE && FLAG_DND_BACKPRESSURE,
    shouldOwnFileDrop: shouldReferenceGridOwnFileDrop,
    shouldBypassCapture: (event, context) =>
      shouldBypassRightRailShellCapture(event, rightColumnRef.current, context),
  });
  const detailModalContext =
    selectedTool === "voice-changer" &&
    detailModalOutput?.mode === "video" &&
    activeVoiceChangerSourceVideo &&
    (activeVoiceChangerSourceVideo.referenceOutputId === detailModalOutput.id ||
      (activeVoiceChangerSourceVideo.referenceMediaId != null &&
        detailModalOutput.savedMediaIds?.includes(activeVoiceChangerSourceVideo.referenceMediaId)))
      ? {
          activeVoiceChangerSourceVideo: {
            aspect: activeVoiceChangerSourceVideo.aspect,
          },
        }
      : null;
  const insufficientCreditFailureIds = React.useMemo(
    () =>
      visibleFailures
        .filter(
          (item) => resolveAiStudioErrorPresentation(item).category === "insufficient_credits"
        )
        .map((item) => item.id),
    [visibleFailures]
  );
  const isInsufficientCreditsModalOpen =
    isInsufficientCreditsLike(uiError) || insufficientCreditFailureIds.length > 0;
  const handleCloseInsufficientCreditsModal = React.useCallback(() => {
    onDismissUiError();
    insufficientCreditFailureIds.forEach((id) => onDismissFailure(id));
  }, [insufficientCreditFailureIds, onDismissFailure, onDismissUiError]);

  return (
    <>
      {isInsufficientCreditsModalOpen ? (
        <React.Suspense fallback={lazyModalFallback}>
          <LazyAiStudioInsufficientCreditsModal
            isOpen
            availableCredits={balanceCredits}
            onClose={handleCloseInsufficientCreditsModal}
            onCheckoutStarted={handleCloseInsufficientCreditsModal}
          />
        </React.Suspense>
      ) : null}
      <main
        className="page page-wide ai-studio-page"
        data-shell-boundary-split={FLAG_SHELL_BOUNDARY_SPLIT ? "on" : "off"}
        data-selected-tool={selectedTool ?? undefined}
      >
        <input
          ref={resolvedReferenceGridFileInputRef}
          type="file"
          accept={referenceGridFileAccept}
          multiple
          style={{ display: "none" }}
          onChange={onFileBrowserSelection}
        />

        <section className="ai-hero panel hero-banner ai-amber-hero">
          <div className="hero-text">
            <h1 className="ai-hero-title">AI Studio</h1>
            <Link
              href="/profile?section=credits"
              className="ai-credit-inline header-embedded"
              aria-label="Open credits and billing"
            >
              <span className="credit-label">Credits</span>
              <CreditFillCoin
                remainingCredits={balanceCredits}
                totalCredits={creditTotalCredits}
                loading={balanceLoading}
              />
              <span className="credit-value">{creditValueLabel}</span>
            </Link>
          </div>
          {visibleProjectName ? (
            <div className="ai-hero-project-name">
              {onOpenProjectNameEditor ? (
                <button
                  type="button"
                  className="ai-hero-project-name-anchor ai-hero-project-name-trigger"
                  aria-label={`Edit project ${visibleProjectName} in Media panel`}
                  title="Edit project name"
                  onClick={onOpenProjectNameEditor}
                >
                  <span
                    className="ai-hero-project-name-text"
                    role="status"
                    aria-live="polite"
                    aria-label={`Current project: ${visibleProjectName}`}
                    title={visibleProjectName}
                  >
                    {visibleProjectName}
                  </span>
                  <span className="ai-hero-project-name-edit-button" aria-hidden="true">
                    <PencilSimple size={13} weight="bold" aria-hidden="true" />
                  </span>
                </button>
              ) : (
                <div className="ai-hero-project-name-anchor">
                  <span
                    className="ai-hero-project-name-text"
                    role="status"
                    aria-live="polite"
                    aria-label={`Current project: ${visibleProjectName}`}
                    title={visibleProjectName}
                  >
                    {visibleProjectName}
                  </span>
                </div>
              )}
            </div>
          ) : null}
          <div className="hero-right">
            <div className="ai-hero-shortcut-cluster">
              <div className="ai-hero-shortcut-buttons" aria-label="AI Studio header shortcuts">
                <button
                  type="button"
                  className="ai-hero-shortcut-button"
                  aria-pressed={isCanvasVisible}
                  onClick={handleCanvasVisibilityToggle}
                >
                  Canvas
                </button>
                {visibleHeaderShortcutButtons.map((shortcut) => {
                  const buttonState = headerShortcutStates[shortcut.id];
                  return (
                    <button
                      key={shortcut.id}
                      type="button"
                      className="ai-hero-shortcut-button"
                      aria-pressed={buttonState.pressed}
                      disabled={buttonState.disabled}
                      onClick={() => handleHeaderShortcutToggle(shortcut.id)}
                    >
                      {shortcut.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <AiStudioAlertsStack
          uiError={uiError}
          uiNotice={uiNotice}
          visibleFailures={visibleFailures}
          mediaPlanNotice={mediaPlanNotice}
          onDismissUiError={onDismissUiError}
          onDismissUiNotice={onDismissUiNotice}
          onDismissMediaPlanNotice={handleDismissMediaPlanNotice}
          onDismissFailure={onDismissFailure}
        />

        <div className={`ai-layout${isTemplateView ? " templates-active" : ""}`}>
          {toolbarRail}

          <div className="ai-content">
            <AiStudioShellFrame
              shellRef={shellRef as React.RefObject<HTMLElement>}
              leftColumnRef={leftColumnRef as React.RefObject<HTMLElement>}
              rightColumnRef={rightColumnRef}
              shellClassName={shellClassName}
              shellStyle={shellStyle}
              shellLayoutMode={shellLayoutMode}
              selectedTool={selectedTool}
              showDivider={showDivider}
              dividerProps={dividerProps}
              propertiesPanelKey={selectedTool}
              leftColumnHidden={leftColumnHidden}
              rightColumnHidden={effectiveRightColumnHidden}
              propertiesPanelContent={propertiesPanelContent}
              rightColumnDropMode={rightColumnDropMode as RightColumnDropMode}
              onRightColumnDropCapture={handleRightColumnDropCapture}
              onRightColumnDragOverCapture={handleRightColumnDragOverCapture}
              onRightColumnDragEnterCapture={handleRightColumnDragEnterCapture}
              onRightColumnDragLeaveCapture={handleRightColumnDragLeaveCapture}
              onShellDragOverCapture={handleShellDragOverCapture}
              onShellDropCapture={handleShellDropCapture}
              referenceGridProps={resolvedReferenceGridPropsWithStylesPanel}
              studioPreviewProps={studioPreviewProps}
              handleReferenceGridFiles={handleReferenceGridFiles}
              triggerFilePicker={triggerFilePicker}
              onOpenMediaLibrary={onOpenMediaLibrary}
              showPreviewRail
            />
            {comingSoon ? (
              <section className="ai-coming-soon" aria-live="polite">
                <div
                  className="panel ai-panel ai-coming-soon-card"
                  data-tool={selectedComingSoonTool}
                >
                  <div className="ai-coming-soon-header">
                    <div className="ai-coming-soon-title-block">
                      <span className="ai-coming-soon-icon" aria-hidden="true">
                        {ComingSoonIcon ? <ComingSoonIcon size={22} weight="bold" /> : null}
                      </span>
                      <div>
                        <p className="eyebrow">AI Studio</p>
                        <h2 className="ai-coming-soon-title">{comingSoon.title}</h2>
                      </div>
                    </div>
                    <span className="ai-coming-soon-pill">Coming soon</span>
                  </div>
                  <p className="ai-coming-soon-summary">{comingSoon.summary}</p>
                  <p className="ai-coming-soon-detail">{comingSoon.detail}</p>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>
      {modelModalState.isOpen ? (
        <React.Suspense fallback={lazyModalFallback}>
          <LazyModelModal
            isOpen
            onClose={modelModalState.onClose}
            onSelect={modelModalState.onSelect}
            options={modelModalState.options}
            resolveCreditsForModel={modelModalState.resolveCreditsForModel}
            context={modelModalState.context}
            onPresentationResolved={modelModalState.onPresentationResolved}
          />
        </React.Suspense>
      ) : null}
      {detailModalOutput ? (
        <React.Suspense fallback={lazyModalFallback}>
          <LazyDetailModal
            output={detailModalOutput}
            detailNavigation={detailNavigation}
            isMediaStorageFull={isMediaStorageFull}
            context={detailModalContext}
            projectId={projectId}
            onClose={onDetailClose}
            onUpdatePrompt={onUpdateOutputPrompt}
            onDeleteOutput={onDeleteOutput}
            onDownloadReference={onDetailDownload}
            onSaveReference={onDetailSaveReference}
            onSnapshotVideoFrame={onSnapshotVideoFrame}
            onSnapshotVideoFrameError={onSnapshotVideoFrameError}
            onReloadWorkflowReference={onDetailReloadWorkflow}
            onPinPromptReference={detailPromptPinHandler}
            onSavePrompt={onDetailSavePrompt}
            refreshCharacterOptions={refreshCharacterOptions}
            resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
          />
        </React.Suspense>
      ) : null}
      {sharedDetailModalItem ? (
        <React.Suspense fallback={lazyModalFallback}>
          <LazySharedMediaDetailPreviewModal
            item={sharedDetailModalItem}
            onClose={onDetailClose}
            onSnapshotVideoFrame={onSnapshotVideoFrame}
            onSnapshotVideoFrameError={onSnapshotVideoFrameError}
            topBarActionItems={sharedDetailModalActionItems}
            onPinPromptReference={detailPromptPinHandler}
            modalActivityId="ai-studio-shared-detail-preview-modal"
            backdropDataTestId="ai-studio-shared-detail-preview-backdrop"
            closeLabel="Close media detail"
          />
        </React.Suspense>
      ) : null}
    </>
  );
}
