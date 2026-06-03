/**
 * Regression coverage for the AI Studio header project-name display.
 * Verifies the current project title is rendered in the centered hero/header slot only when available.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiStudioPageContent } from "../AiStudioPageContent";

vi.mock("../AiStudioToolbar", () => ({
  AiStudioToolbar: () => <div data-testid="ai-studio-toolbar" />,
}));

vi.mock("../AiStudioToolbarRail", () => ({
  AiStudioToolbarRail: () => <div data-testid="ai-studio-toolbar-rail" />,
}));

vi.mock("../create/StandardCreatePropertiesPanel", () => ({
  StandardCreatePropertiesPanel: () => <div data-testid="standard-create-properties-panel" />,
}));

vi.mock("../create/PulseCreatePropertiesPanel", () => ({
  PulseCreatePropertiesPanel: () => <div data-testid="pulse-create-properties-panel" />,
}));

vi.mock("../create/CreateModeToggle", () => ({
  CreateModeToggle: () => <div data-testid="create-mode-toggle" />,
}));

vi.mock("../DetailModal", () => ({
  DetailModal: () => null,
}));

vi.mock("../ModelModal", () => ({
  ModelModal: () => null,
}));

vi.mock("../AiStudioShellFrame", () => ({
  AiStudioShellFrame: () => <div data-testid="ai-studio-shell-frame" />,
}));

vi.mock("../edit/ExpertEditPanelView", () => ({
  ExpertEditPanelView: () => <div data-testid="expert-edit-panel-view" />,
}));

vi.mock("../StudioPreview", () => ({
  StudioPreview: () => <div data-testid="studio-preview" />,
}));

vi.mock("../CharacterPanel", () => ({
  CharacterPanel: () => <div data-testid="character-panel" />,
}));

vi.mock("../StylesLibraryPanel", () => ({
  StylesLibraryPanel: () => <div data-testid="styles-library-panel" />,
}));

vi.mock("../UnifiedPresetsLibraryPanel", () => ({
  UnifiedPresetsLibraryPanel: () => <div data-testid="unified-presets-library-panel" />,
}));

vi.mock("../VideoPropertiesPanel", () => ({
  VideoPropertiesPanel: () => <div data-testid="video-properties-panel" />,
}));

vi.mock("../MusicPropertiesPanel", () => ({
  MusicPropertiesPanel: () => <div data-testid="music-properties-panel" />,
}));

vi.mock("../SoundPropertiesPanel", () => ({
  SoundPropertiesPanel: () => <div data-testid="sound-properties-panel" />,
}));

vi.mock("../SoundEffectsPropertiesPanel", () => ({
  SoundEffectsPropertiesPanel: () => <div data-testid="sound-effects-properties-panel" />,
}));

vi.mock("../VoicesPropertiesPanel", () => ({
  VoicesPropertiesPanel: () => <div data-testid="voices-properties-panel" />,
}));

vi.mock("../MediaLibraryPanel", () => ({
  MediaLibraryPanel: () => <div data-testid="media-library-panel" />,
}));

vi.mock("../ElementsPanel", () => ({
  ElementsPanel: () => <div data-testid="elements-panel" />,
}));

vi.mock("../../hooks/useAiStudioShellResize", () => ({
  useAiStudioShellResize: () => ({
    shellRef: { current: null },
    leftColumnRef: { current: null },
    leftWidthPx: null,
    showDivider: false,
    isResizing: false,
    shellStyle: {},
    collapseToMin: vi.fn(),
    resetToDefaultWidth: vi.fn(),
    restoreWidth: vi.fn(),
    expandToMax: vi.fn(),
    dividerProps: {},
    rightColumnHidden: false,
  }),
}));

vi.mock("../../hooks/useAiStudioShellDndController", () => ({
  useAiStudioShellDndController: () => ({
    dropMode: "none",
    handleDragEnterCapture: vi.fn(),
    handleDragOverCapture: vi.fn(),
    handleDragLeaveCapture: vi.fn(),
    handleDropCapture: vi.fn(),
    handleShellDragOverCapture: vi.fn(),
    handleShellDropCapture: vi.fn(),
  }),
}));

vi.mock("../../hooks/useVoiceChangerSourceController", () => ({
  useVoiceChangerSourceController: () => ({
    voiceChangerSource: null,
    handleVoiceChangerSourceChange: vi.fn(),
  }),
}));

vi.mock("../../hooks/useAiStudioStylesRuntime", () => ({
  useAiStudioStylesRuntime: () => ({
    handleDeleteStyle: vi.fn(),
    handleReorderStyle: vi.fn(),
    styleDetailsSaveError: null,
    stylesDeleteError: null,
    upsertStyleDetails: vi.fn(),
    visibleStylesCatalog: [],
  }),
}));

vi.mock("../../hooks/aiStudioOutputStore", () => ({
  useOutputCounts: () => ({ activeCount: 0 }),
}));

vi.mock("../../../../lib/useVisibleErrorTelemetry", () => ({
  useVisibleErrorTelemetry: () => undefined,
}));

const createProps = (): React.ComponentProps<typeof AiStudioPageContent> => ({
  sessionId: null,
  referenceGridFileInputRef: { current: null },
  onFileBrowserSelection: vi.fn(),
  uiError: null,
  uiNotice: null,
  onDismissUiError: vi.fn(),
  onDismissUiNotice: vi.fn(),
  balanceCredits: 16860,
  pendingHoldCredits: null,
  balanceLoading: false,
  visibleFailures: [],
  onDismissFailure: vi.fn(),
  onInspectFailure: vi.fn(),
  selectedTool: null,
  showCreateTools: false,
  onOpenProjects: vi.fn(),
  onSelectTool: vi.fn(),
  onToggleCreateTools: vi.fn(),
  propertiesCreate: {
    expertCreateMode: "standard",
    standard: {},
    pulse: {},
    onExpertCreateModeChange: vi.fn(),
  } as never,
  propertiesEditExpert: {} as never,
  propertiesVideo: {} as never,
  isTemplateView: false,
  referenceGridProps: {
    outputs: [],
    activeOutputId: null,
    onSelectOutput: vi.fn(),
    onOpenDetails: vi.fn(),
    onPasteTextReference: vi.fn(),
    onPasteMediaReference: vi.fn(),
  } as never,
  studioPreviewProps: {
    activeOutput: null,
    referenceImageUrl: null,
    referenceText: null,
    onReferenceImageChange: vi.fn(),
    onReferenceTextChange: vi.fn(),
    onRegenerate: vi.fn(),
  } as never,
  detailModalOutput: null,
  onDetailClose: vi.fn(),
  onUpdateOutputPrompt: vi.fn(),
  onDeleteOutput: vi.fn(),
  projectId: "project-1",
  projectRouteRequested: true,
  projectName: null,
  onProjectNameCommit: vi.fn(),
  modelModalState: {
    isOpen: false,
    options: [],
    onClose: vi.fn(),
    onSelect: vi.fn(),
  } as never,
  handleReferenceGridFiles: vi.fn(),
  triggerFilePicker: vi.fn(),
});

describe("AiStudioPageContent header project name", () => {
  it("renders the active project name in the centered header area", () => {
    render(<AiStudioPageContent {...createProps()} projectName="Campaign Alpha" />);

    expect(
      screen.getByRole("status", { name: "Current project: Campaign Alpha" })
    ).toHaveTextContent("Campaign Alpha");
  });

  it("opens the Media panel rename path from the header pencil button", () => {
    const onOpenMediaLibrary = vi.fn();
    render(
      <AiStudioPageContent
        {...createProps()}
        projectName="Campaign Alpha"
        onOpenMediaLibrary={onOpenMediaLibrary}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit project name in Media panel" }));

    expect(onOpenMediaLibrary).toHaveBeenCalledTimes(1);
  });

  it("omits the centered project name when no project title is available", () => {
    render(<AiStudioPageContent {...createProps()} projectName={null} />);

    expect(screen.queryByRole("status", { name: /current project:/i })).not.toBeInTheDocument();
  });
});
