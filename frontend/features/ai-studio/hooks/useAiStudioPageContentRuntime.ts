/**
 * AI Studio page-content runtime.
 * Owns the final page-content component contract so the page shell stays focused on orchestration.
 */
import { useMemo } from "react";
import type { AiStudioPageContentProps } from "../components/AiStudioPageContent";

type UseAiStudioPageContentRuntimeParams = {
  sessionId: AiStudioPageContentProps["sessionId"];
  referenceGridFileInputRef: AiStudioPageContentProps["referenceGridFileInputRef"];
  onFileBrowserSelection: AiStudioPageContentProps["onFileBrowserSelection"];
  uiError: AiStudioPageContentProps["uiError"];
  uiNotice: AiStudioPageContentProps["uiNotice"];
  mediaPlanNoticeMessage: AiStudioPageContentProps["mediaPlanNoticeMessage"];
  mediaPlanNoticeCta: AiStudioPageContentProps["mediaPlanNoticeCta"];
  onMediaPlanAccessAttempt: AiStudioPageContentProps["onMediaPlanAccessAttempt"];
  billingPlanNoticeMessage: AiStudioPageContentProps["billingPlanNoticeMessage"];
  billingPlanNoticeHref: AiStudioPageContentProps["billingPlanNoticeHref"];
  onDismissBillingPlanNotice: AiStudioPageContentProps["onDismissBillingPlanNotice"];
  workflowPlanNoticeMessage: AiStudioPageContentProps["workflowPlanNoticeMessage"];
  workflowPlanAccessCta: AiStudioPageContentProps["workflowPlanAccessCta"];
  onWorkflowPlanAccessAttempt: AiStudioPageContentProps["onWorkflowPlanAccessAttempt"];
  onDismissUiError: AiStudioPageContentProps["onDismissUiError"];
  onDismissUiNotice: AiStudioPageContentProps["onDismissUiNotice"];
  onDismissMediaPlanNotice: AiStudioPageContentProps["onDismissMediaPlanNotice"];
  onDismissWorkflowPlanNotice: AiStudioPageContentProps["onDismissWorkflowPlanNotice"];
  balanceCredits: AiStudioPageContentProps["balanceCredits"];
  creditTotalCredits: AiStudioPageContentProps["creditTotalCredits"];
  pendingHoldCredits: AiStudioPageContentProps["pendingHoldCredits"];
  balanceLoading: AiStudioPageContentProps["balanceLoading"];
  visibleFailures: AiStudioPageContentProps["visibleFailures"];
  onDismissFailure: AiStudioPageContentProps["onDismissFailure"];
  onInspectFailure: AiStudioPageContentProps["onInspectFailure"];
  selectedTool: AiStudioPageContentProps["selectedTool"];
  characterCreateRequestKey: AiStudioPageContentProps["characterCreateRequestKey"];
  elementCreateRequestKey: AiStudioPageContentProps["elementCreateRequestKey"];
  showCreateTools: AiStudioPageContentProps["showCreateTools"];
  onOpenProjects: AiStudioPageContentProps["onOpenProjects"];
  onSelectTool: AiStudioPageContentProps["onSelectTool"];
  onToggleCreateTools: AiStudioPageContentProps["onToggleCreateTools"];
  propertiesCreate: AiStudioPageContentProps["propertiesCreate"];
  propertiesEditExpert: AiStudioPageContentProps["propertiesEditExpert"];
  propertiesVideo: AiStudioPageContentProps["propertiesVideo"];
  propertiesMusic: NonNullable<AiStudioPageContentProps["propertiesMusic"]>;
  propertiesSoundEffects: NonNullable<AiStudioPageContentProps["propertiesSoundEffects"]>;
  propertiesVoices: NonNullable<AiStudioPageContentProps["propertiesVoices"]>;
  refreshCharacterOptions: AiStudioPageContentProps["refreshCharacterOptions"];
  resolveCharacterAvatarUrlById: AiStudioPageContentProps["resolveCharacterAvatarUrlById"];
  isTemplateView: AiStudioPageContentProps["isTemplateView"];
  referenceGridProps: AiStudioPageContentProps["referenceGridProps"];
  studioPreviewProps: AiStudioPageContentProps["studioPreviewProps"];
  detailModalOutput: AiStudioPageContentProps["detailModalOutput"];
  detailNavigation: AiStudioPageContentProps["detailNavigation"];
  sharedDetailModalItem: AiStudioPageContentProps["sharedDetailModalItem"];
  isMediaStorageFull: AiStudioPageContentProps["isMediaStorageFull"];
  onDetailClose: AiStudioPageContentProps["onDetailClose"];
  onUpdateOutputPrompt: AiStudioPageContentProps["onUpdateOutputPrompt"];
  onDeleteOutput: AiStudioPageContentProps["onDeleteOutput"];
  onDetailDownload: AiStudioPageContentProps["onDetailDownload"];
  onDetailSaveReference: AiStudioPageContentProps["onDetailSaveReference"];
  onSnapshotVideoFrame: AiStudioPageContentProps["onSnapshotVideoFrame"];
  onSnapshotVideoFrameError: AiStudioPageContentProps["onSnapshotVideoFrameError"];
  onDetailReloadWorkflow: AiStudioPageContentProps["onDetailReloadWorkflow"];
  onMediaLibraryRerollWorkflow: AiStudioPageContentProps["onMediaLibraryRerollWorkflow"];
  onDetailSavePrompt: AiStudioPageContentProps["onDetailSavePrompt"];
  onAddLibraryMediaReference: AiStudioPageContentProps["onAddLibraryMediaReference"];
  onAddLibraryMediaReferences?: AiStudioPageContentProps["onAddLibraryMediaReferences"];
  onAddLibraryPromptReference: AiStudioPageContentProps["onAddLibraryPromptReference"];
  onDeleteMediaRowsFromWorkspace: AiStudioPageContentProps["onDeleteMediaRowsFromWorkspace"];
  mediaLibraryDetailSelectionTarget: AiStudioPageContentProps["mediaLibraryDetailSelectionTarget"];
  onMediaLibraryDetailSelectionTargetChange: AiStudioPageContentProps["onMediaLibraryDetailSelectionTargetChange"];
  projectId: AiStudioPageContentProps["projectId"];
  projectRouteRequested: AiStudioPageContentProps["projectRouteRequested"];
  rightRailLayout: AiStudioPageContentProps["rightRailLayout"];
  onRightRailLayoutChange: AiStudioPageContentProps["onRightRailLayoutChange"];
  projectName: AiStudioPageContentProps["projectName"];
  onProjectNameCommit: AiStudioPageContentProps["onProjectNameCommit"];
  onOpenProjectNameEditor: AiStudioPageContentProps["onOpenProjectNameEditor"];
  mediaLibraryProjectNameFocusRequestKey: AiStudioPageContentProps["mediaLibraryProjectNameFocusRequestKey"];
  resolveMediaLibraryInternalDropItem: AiStudioPageContentProps["resolveMediaLibraryInternalDropItem"];
  resolveStyleLibraryInternalDrop: AiStudioPageContentProps["resolveStyleLibraryInternalDrop"];
  onOpenMediaLibrary: AiStudioPageContentProps["onOpenMediaLibrary"];
  modelModalState: AiStudioPageContentProps["modelModalState"];
  handleReferenceGridFiles: AiStudioPageContentProps["handleReferenceGridFiles"];
  triggerFilePicker: AiStudioPageContentProps["triggerFilePicker"];
  resolveCharacterDropReference: AiStudioPageContentProps["resolveCharacterDropReference"];
  canvasTearOutTargetRegistry: AiStudioPageContentProps["canvasTearOutTargetRegistry"];
  pendingCharacterUploadRequest: AiStudioPageContentProps["pendingCharacterUploadRequest"];
  onCharacterUploadRequestHandled: AiStudioPageContentProps["onCharacterUploadRequestHandled"];
  createSelectedCharacterId: AiStudioPageContentProps["createSelectedCharacterId"];
  onCreateSelectedCharacterIdChange: AiStudioPageContentProps["onCreateSelectedCharacterIdChange"];
  resolveElementProfileImageDropSource: AiStudioPageContentProps["resolveElementProfileImageDropSource"];
  resolveVoiceChangerInternalReferenceSource: AiStudioPageContentProps["resolveVoiceChangerInternalReferenceSource"];
  onRegisterWorkflowReloadStylePrep: AiStudioPageContentProps["onRegisterWorkflowReloadStylePrep"];
  onSelectedStylePromptChange: AiStudioPageContentProps["onSelectedStylePromptChange"];
  onSelectedStyleContextChange: AiStudioPageContentProps["onSelectedStyleContextChange"];
};

/**
 * Returns the stable `AiStudioPageContent` prop contract for the page shell.
 */
export const useAiStudioPageContentRuntime = ({
  sessionId,
  referenceGridFileInputRef,
  onFileBrowserSelection,
  uiError,
  uiNotice,
  mediaPlanNoticeMessage,
  mediaPlanNoticeCta,
  onMediaPlanAccessAttempt,
  billingPlanNoticeMessage,
  billingPlanNoticeHref,
  onDismissBillingPlanNotice,
  workflowPlanNoticeMessage,
  workflowPlanAccessCta,
  onWorkflowPlanAccessAttempt,
  onDismissUiError,
  onDismissUiNotice,
  onDismissMediaPlanNotice,
  onDismissWorkflowPlanNotice,
  balanceCredits,
  creditTotalCredits,
  pendingHoldCredits,
  balanceLoading,
  visibleFailures,
  onDismissFailure,
  onInspectFailure,
  selectedTool,
  characterCreateRequestKey,
  elementCreateRequestKey,
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
  detailNavigation,
  sharedDetailModalItem,
  isMediaStorageFull,
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
  mediaLibraryDetailSelectionTarget,
  onMediaLibraryDetailSelectionTargetChange,
  projectId,
  projectRouteRequested,
  rightRailLayout,
  onRightRailLayoutChange,
  projectName,
  onProjectNameCommit,
  onOpenProjectNameEditor,
  mediaLibraryProjectNameFocusRequestKey,
  resolveMediaLibraryInternalDropItem,
  resolveStyleLibraryInternalDrop,
  onOpenMediaLibrary,
  modelModalState,
  handleReferenceGridFiles,
  triggerFilePicker,
  resolveCharacterDropReference,
  canvasTearOutTargetRegistry,
  pendingCharacterUploadRequest,
  onCharacterUploadRequestHandled,
  createSelectedCharacterId,
  onCreateSelectedCharacterIdChange,
  resolveElementProfileImageDropSource,
  resolveVoiceChangerInternalReferenceSource,
  onRegisterWorkflowReloadStylePrep,
  onSelectedStylePromptChange,
  onSelectedStyleContextChange,
}: UseAiStudioPageContentRuntimeParams): AiStudioPageContentProps =>
  useMemo(
    () => ({
      sessionId,
      referenceGridFileInputRef,
      onFileBrowserSelection,
      uiError,
      uiNotice,
      mediaPlanNoticeMessage,
      mediaPlanNoticeCta,
      onMediaPlanAccessAttempt,
      billingPlanNoticeMessage,
      billingPlanNoticeHref,
      onDismissBillingPlanNotice,
      workflowPlanNoticeMessage,
      workflowPlanAccessCta,
      onWorkflowPlanAccessAttempt,
      onDismissUiError,
      onDismissUiNotice,
      onDismissMediaPlanNotice,
      onDismissWorkflowPlanNotice,
      balanceCredits,
      creditTotalCredits,
      pendingHoldCredits,
      balanceLoading,
      visibleFailures,
      onDismissFailure,
      onInspectFailure,
      selectedTool,
      characterCreateRequestKey,
      elementCreateRequestKey,
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
      detailNavigation,
      sharedDetailModalItem,
      isMediaStorageFull,
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
      mediaLibraryDetailSelectionTarget,
      onMediaLibraryDetailSelectionTargetChange,
      projectId,
      projectRouteRequested,
      rightRailLayout,
      onRightRailLayoutChange,
      projectName,
      onProjectNameCommit,
      onOpenProjectNameEditor,
      mediaLibraryProjectNameFocusRequestKey,
      resolveMediaLibraryInternalDropItem,
      resolveStyleLibraryInternalDrop,
      onOpenMediaLibrary,
      modelModalState,
      handleReferenceGridFiles,
      triggerFilePicker,
      resolveCharacterDropReference,
      canvasTearOutTargetRegistry,
      pendingCharacterUploadRequest,
      onCharacterUploadRequestHandled,
      createSelectedCharacterId,
      onCreateSelectedCharacterIdChange,
      resolveElementProfileImageDropSource,
      resolveVoiceChangerInternalReferenceSource,
      onRegisterWorkflowReloadStylePrep,
      onSelectedStylePromptChange,
      onSelectedStyleContextChange,
    }),
    [
      sessionId,
      referenceGridFileInputRef,
      onFileBrowserSelection,
      uiError,
      uiNotice,
      mediaPlanNoticeMessage,
      mediaPlanNoticeCta,
      onMediaPlanAccessAttempt,
      billingPlanNoticeMessage,
      billingPlanNoticeHref,
      onDismissBillingPlanNotice,
      workflowPlanNoticeMessage,
      workflowPlanAccessCta,
      onWorkflowPlanAccessAttempt,
      onDismissUiError,
      onDismissUiNotice,
      onDismissMediaPlanNotice,
      onDismissWorkflowPlanNotice,
      balanceCredits,
      creditTotalCredits,
      pendingHoldCredits,
      balanceLoading,
      visibleFailures,
      onDismissFailure,
      onInspectFailure,
      selectedTool,
      characterCreateRequestKey,
      elementCreateRequestKey,
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
      detailNavigation,
      sharedDetailModalItem,
      isMediaStorageFull,
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
      mediaLibraryDetailSelectionTarget,
      onMediaLibraryDetailSelectionTargetChange,
      projectId,
      projectRouteRequested,
      rightRailLayout,
      onRightRailLayoutChange,
      projectName,
      onProjectNameCommit,
      onOpenProjectNameEditor,
      mediaLibraryProjectNameFocusRequestKey,
      resolveMediaLibraryInternalDropItem,
      resolveStyleLibraryInternalDrop,
      onOpenMediaLibrary,
      modelModalState,
      handleReferenceGridFiles,
      triggerFilePicker,
      resolveCharacterDropReference,
      canvasTearOutTargetRegistry,
      pendingCharacterUploadRequest,
      onCharacterUploadRequestHandled,
      createSelectedCharacterId,
      onCreateSelectedCharacterIdChange,
      resolveElementProfileImageDropSource,
      resolveVoiceChangerInternalReferenceSource,
      onRegisterWorkflowReloadStylePrep,
      onSelectedStylePromptChange,
      onSelectedStyleContextChange,
    ]
  );
