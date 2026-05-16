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
  characterError: AiStudioPageContentProps["characterError"];
  onDismissUiError: AiStudioPageContentProps["onDismissUiError"];
  onDismissUiNotice: AiStudioPageContentProps["onDismissUiNotice"];
  onDismissCharacterError: AiStudioPageContentProps["onDismissCharacterError"];
  balanceCredits: AiStudioPageContentProps["balanceCredits"];
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
  isMediaStorageFull: AiStudioPageContentProps["isMediaStorageFull"];
  onDetailClose: AiStudioPageContentProps["onDetailClose"];
  onUpdateOutputPrompt: AiStudioPageContentProps["onUpdateOutputPrompt"];
  onDeleteOutput: AiStudioPageContentProps["onDeleteOutput"];
  onDetailDownload: AiStudioPageContentProps["onDetailDownload"];
  onDetailSaveReference: AiStudioPageContentProps["onDetailSaveReference"];
  onDetailSavePrompt: AiStudioPageContentProps["onDetailSavePrompt"];
  onAddLibraryMediaReference: AiStudioPageContentProps["onAddLibraryMediaReference"];
  onAddLibraryPromptReference: AiStudioPageContentProps["onAddLibraryPromptReference"];
  projectId: AiStudioPageContentProps["projectId"];
  projectName: AiStudioPageContentProps["projectName"];
  onProjectNameCommit: AiStudioPageContentProps["onProjectNameCommit"];
  resolveMediaLibraryInternalDropItem: AiStudioPageContentProps["resolveMediaLibraryInternalDropItem"];
  resolveStyleLibraryInternalDrop: AiStudioPageContentProps["resolveStyleLibraryInternalDrop"];
  onOpenMediaLibrary: AiStudioPageContentProps["onOpenMediaLibrary"];
  modelModalState: AiStudioPageContentProps["modelModalState"];
  handleReferenceGridFiles: AiStudioPageContentProps["handleReferenceGridFiles"];
  triggerFilePicker: AiStudioPageContentProps["triggerFilePicker"];
  resolveCharacterDropReference: AiStudioPageContentProps["resolveCharacterDropReference"];
  pendingCharacterUploadRequest: AiStudioPageContentProps["pendingCharacterUploadRequest"];
  onCharacterUploadRequestHandled: AiStudioPageContentProps["onCharacterUploadRequestHandled"];
  resolveElementProfileImageDropSource: AiStudioPageContentProps["resolveElementProfileImageDropSource"];
  resolveVoiceChangerInternalReferenceSource: AiStudioPageContentProps["resolveVoiceChangerInternalReferenceSource"];
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
  characterError,
  onDismissUiError,
  onDismissUiNotice,
  onDismissCharacterError,
  balanceCredits,
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
  isMediaStorageFull,
  onDetailClose,
  onUpdateOutputPrompt,
  onDeleteOutput,
  onDetailDownload,
  onDetailSaveReference,
  onDetailSavePrompt,
  onAddLibraryMediaReference,
  onAddLibraryPromptReference,
  projectId,
  projectName,
  onProjectNameCommit,
  resolveMediaLibraryInternalDropItem,
  resolveStyleLibraryInternalDrop,
  onOpenMediaLibrary,
  modelModalState,
  handleReferenceGridFiles,
  triggerFilePicker,
  resolveCharacterDropReference,
  pendingCharacterUploadRequest,
  onCharacterUploadRequestHandled,
  resolveElementProfileImageDropSource,
  resolveVoiceChangerInternalReferenceSource,
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
      characterError,
      onDismissUiError,
      onDismissUiNotice,
      onDismissCharacterError,
      balanceCredits,
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
      isMediaStorageFull,
      onDetailClose,
      onUpdateOutputPrompt,
      onDeleteOutput,
      onDetailDownload,
      onDetailSaveReference,
      onDetailSavePrompt,
      onAddLibraryMediaReference,
      onAddLibraryPromptReference,
      projectId,
      projectName,
      onProjectNameCommit,
      resolveMediaLibraryInternalDropItem,
      resolveStyleLibraryInternalDrop,
      onOpenMediaLibrary,
      modelModalState,
      handleReferenceGridFiles,
      triggerFilePicker,
      resolveCharacterDropReference,
      pendingCharacterUploadRequest,
      onCharacterUploadRequestHandled,
      resolveElementProfileImageDropSource,
      resolveVoiceChangerInternalReferenceSource,
      onSelectedStylePromptChange,
      onSelectedStyleContextChange,
    }),
    [
      sessionId,
      referenceGridFileInputRef,
      onFileBrowserSelection,
      uiError,
      uiNotice,
      characterError,
      onDismissUiError,
      onDismissUiNotice,
      onDismissCharacterError,
      balanceCredits,
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
      isMediaStorageFull,
      onDetailClose,
      onUpdateOutputPrompt,
      onDeleteOutput,
      onDetailDownload,
      onDetailSaveReference,
      onDetailSavePrompt,
      onAddLibraryMediaReference,
      onAddLibraryPromptReference,
      projectId,
      projectName,
      onProjectNameCommit,
      resolveMediaLibraryInternalDropItem,
      resolveStyleLibraryInternalDrop,
      onOpenMediaLibrary,
      modelModalState,
      handleReferenceGridFiles,
      triggerFilePicker,
      resolveCharacterDropReference,
      pendingCharacterUploadRequest,
      onCharacterUploadRequestHandled,
      resolveElementProfileImageDropSource,
      resolveVoiceChangerInternalReferenceSource,
      onSelectedStylePromptChange,
      onSelectedStyleContextChange,
    ]
  );
