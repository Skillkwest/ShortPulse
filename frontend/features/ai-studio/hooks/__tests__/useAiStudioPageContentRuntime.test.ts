import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AiStudioDetailNavigationContract } from "../contracts/pageContentContracts";
import { useAiStudioPageContentRuntime } from "../useAiStudioPageContentRuntime";

type PageContentRuntimeParams = Parameters<typeof useAiStudioPageContentRuntime>[0];

const createParams = (
  overrides: Partial<PageContentRuntimeParams> = {}
): PageContentRuntimeParams =>
  ({
    sessionId: "session-1",
    referenceGridFileInputRef: { current: null },
    onFileBrowserSelection: vi.fn(),
    uiError: null,
    uiNotice: null,
    experimentalNoPlanLanding: false,
    onDismissUiError: vi.fn(),
    onDismissUiNotice: vi.fn(),
    balanceCredits: null,
    creditTotalCredits: null,
    pendingHoldCredits: null,
    balanceLoading: false,
    visibleFailures: [],
    onDismissFailure: vi.fn(),
    onInspectFailure: vi.fn(),
    selectedTool: "image",
    characterCreateRequestKey: 0,
    elementCreateRequestKey: 0,
    showCreateTools: true,
    onOpenProjects: vi.fn(),
    onSelectTool: vi.fn(),
    onToggleCreateTools: vi.fn(),
    propertiesCreate: {} as never,
    propertiesEditExpert: {} as never,
    propertiesVideo: {} as never,
    propertiesMusic: {} as never,
    propertiesSoundEffects: {} as never,
    propertiesVoices: {} as never,
    refreshCharacterOptions: vi.fn(),
    resolveCharacterAvatarUrlById: vi.fn(),
    isTemplateView: false,
    referenceGridProps: {} as never,
    studioPreviewProps: {} as never,
    detailModalOutput: null,
    detailNavigation: null,
    sharedDetailModalItem: null,
    isMediaStorageFull: false,
    onDetailClose: vi.fn(),
    onUpdateOutputPrompt: vi.fn(),
    onDeleteOutput: vi.fn(),
    onDetailDownload: vi.fn(),
    onDetailSaveReference: vi.fn(),
    onSnapshotVideoFrame: vi.fn(),
    onSnapshotVideoFrameError: vi.fn(),
    onDetailReloadWorkflow: vi.fn(),
    onDetailSavePrompt: vi.fn(),
    onAddLibraryMediaReference: vi.fn(),
    onAddLibraryPromptReference: vi.fn(),
    onDeleteMediaRowsFromWorkspace: vi.fn(),
    mediaLibraryDetailSelectionTarget: null,
    onMediaLibraryDetailSelectionTargetChange: vi.fn(),
    projectId: "project-1",
    projectRouteRequested: false,
    rightRailLayout: {} as never,
    onRightRailLayoutChange: vi.fn(),
    projectName: "Project",
    onProjectNameCommit: vi.fn(),
    onOpenProjectNameEditor: vi.fn(),
    mediaLibraryProjectNameFocusRequestKey: 0,
    resolveMediaLibraryInternalDropItem: vi.fn(),
    resolveStyleLibraryInternalDrop: vi.fn(),
    onOpenMediaLibrary: vi.fn(),
    modelModalState: {
      isOpen: false,
      options: [],
      onClose: vi.fn(),
      onSelect: vi.fn(),
    },
    handleReferenceGridFiles: vi.fn(),
    triggerFilePicker: vi.fn(),
    resolveCharacterDropReference: vi.fn(),
    canvasTearOutTargetRegistry: undefined,
    pendingCharacterUploadRequest: null,
    onCharacterUploadRequestHandled: vi.fn(),
    createSelectedCharacterId: null,
    onCreateSelectedCharacterIdChange: vi.fn(),
    resolveElementProfileImageDropSource: vi.fn(),
    resolveVoiceChangerInternalReferenceSource: vi.fn(),
    onRegisterWorkflowReloadStylePrep: vi.fn(),
    onSelectedStylePromptChange: vi.fn(),
    onSelectedStyleContextChange: vi.fn(),
    ...overrides,
  }) as PageContentRuntimeParams;

describe("useAiStudioPageContentRuntime", () => {
  it("preserves Reference Grid detail navigation for AiStudioPageContent", () => {
    const detailNavigation: AiStudioDetailNavigationContract = {
      sourceSurface: "reference-grid",
      canNavigatePrevious: true,
      canNavigateNext: true,
      onNavigatePrevious: vi.fn(),
      onNavigateNext: vi.fn(),
    };

    const { result } = renderHook(() =>
      useAiStudioPageContentRuntime(createParams({ detailNavigation }))
    );

    expect(result.current.detailNavigation).toBe(detailNavigation);
  });

  it("passes through the experimental no-plan landing flag", () => {
    const { result } = renderHook(() =>
      useAiStudioPageContentRuntime(createParams({ experimentalNoPlanLanding: true }))
    );

    expect(result.current.experimentalNoPlanLanding).toBe(true);
  });
});
