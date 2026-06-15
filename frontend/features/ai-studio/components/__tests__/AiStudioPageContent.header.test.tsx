/**
 * Regression coverage for the AI Studio header project-name display.
 * Verifies the current project title is rendered in the centered hero/header slot only when available.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiStudioPageContent } from "../AiStudioPageContent";
import { AI_SHELL_RIGHT_COLLAPSED_MIN_PX } from "../../logic/shellResize";
import type { ToolId } from "../../types";

const voicePanelActiveSourceEffectMock = vi.hoisted(() => vi.fn());
const mediaLibraryPanelPropsMock = vi.hoisted(() => vi.fn());
const useAiStudioShellResizeMock = vi.hoisted(() =>
  vi.fn(() => ({
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
  }))
);
const useAiStudioStylesRuntimeMock = vi.hoisted(() =>
  vi.fn(() => ({
    handleDeleteStyle: vi.fn(),
    handleReorderStyle: vi.fn(),
    handleRestoreBuiltInStyles: vi.fn(),
    styleDetailsSaveError: null,
    stylesDeleteError: null,
    upsertStyleDetails: vi.fn(),
    visibleStylesCatalog: [],
  }))
);

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
  AiStudioShellFrame: ({
    referenceGridProps,
    showPreviewRail,
    propertiesPanelContent,
  }: {
    referenceGridProps?: { railCanvasProps?: unknown };
    showPreviewRail?: boolean;
    propertiesPanelContent?: React.ReactNode;
  }) => (
    <div
      data-testid="ai-studio-shell-frame"
      data-canvas-visible={referenceGridProps?.railCanvasProps ? "true" : "false"}
      data-show-preview-rail={showPreviewRail === false ? "false" : "true"}
    >
      {propertiesPanelContent}
    </div>
  ),
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

vi.mock("../VoicesPropertiesPanel", async () => {
  const React = await import("react");
  return {
    VoicesPropertiesPanel: ({
      onActiveVoiceChangerSourceVideoChange,
    }: {
      onActiveVoiceChangerSourceVideoChange?: (
        source: {
          referenceOutputId: string | null;
          referenceMediaId: string | null;
          aspect: string | null;
        } | null
      ) => void;
    }) => {
      React.useEffect(() => {
        if (!onActiveVoiceChangerSourceVideoChange) return;
        voicePanelActiveSourceEffectMock();
        onActiveVoiceChangerSourceVideoChange({
          referenceOutputId: "output-1",
          referenceMediaId: null,
          aspect: "16:9",
        });
      });
      return <div data-testid="voices-properties-panel" />;
    },
  };
});

vi.mock("../MediaLibraryPanel", () => ({
  MediaLibraryPanel: (props: { isStorageQuotaBlocked?: boolean }) => {
    mediaLibraryPanelPropsMock(props);
    return <div data-testid="media-library-panel" />;
  },
}));

vi.mock("../ElementsPanel", () => ({
  ElementsPanel: () => <div data-testid="elements-panel" />,
}));

vi.mock("../../hooks/useAiStudioShellResize", () => ({
  useAiStudioShellResize: useAiStudioShellResizeMock,
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
  useAiStudioStylesRuntime: useAiStudioStylesRuntimeMock,
}));

vi.mock("../../hooks/aiStudioOutputStore", () => ({
  useOutputCounts: () => ({ activeCount: 0 }),
}));

vi.mock("../../../../lib/useVisibleErrorTelemetry", () => ({
  useVisibleErrorTelemetry: () => undefined,
}));

const createProps = (
  overrides: Partial<React.ComponentProps<typeof AiStudioPageContent>> = {}
): React.ComponentProps<typeof AiStudioPageContent> => ({
  sessionId: null,
  referenceGridFileInputRef: { current: null },
  onFileBrowserSelection: vi.fn(),
  uiError: null,
  uiNotice: null,
  onDismissUiError: vi.fn(),
  onDismissUiNotice: vi.fn(),
  balanceCredits: 16860,
  creditTotalCredits: 20000,
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
    onAddCuratedReference: vi.fn(),
    onRemoveCuratedReference: vi.fn(),
    onReorderCuratedReference: vi.fn(),
    onPasteTextReference: vi.fn(),
    onPasteMediaReference: vi.fn(),
    railCanvasProps: {},
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
  onOpenProjectNameEditor: vi.fn(),
  mediaLibraryProjectNameFocusRequestKey: 0,
  modelModalState: {
    isOpen: false,
    options: [],
    onClose: vi.fn(),
    onSelect: vi.fn(),
  } as never,
  handleReferenceGridFiles: vi.fn(),
  triggerFilePicker: vi.fn(),
  ...overrides,
});

describe("AiStudioPageContent header project name", () => {
  beforeEach(() => {
    mediaLibraryPanelPropsMock.mockClear();
    useAiStudioShellResizeMock.mockClear();
    useAiStudioStylesRuntimeMock.mockClear();
  });

  it("renders the credit coin and remaining over total credit label", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          balanceCredits: 9748,
          creditTotalCredits: 10000,
        })}
      />
    );

    const coin = screen.getByTestId("credit-fill-coin");

    expect(screen.getByText("Credits")).toBeInTheDocument();
    expect(screen.getByText("9,748 / 10,000")).toBeInTheDocument();
    expect(coin).toHaveAttribute("data-fill-state", "ready");
    expect(coin.getAttribute("style")).toContain("--credit-spent-degrees: 9.07deg");
  });

  it("keeps the fraction label shape when the total is unavailable", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          balanceCredits: 9748,
          creditTotalCredits: null,
        })}
      />
    );

    expect(screen.getByText("9,748 / —")).toBeInTheDocument();
    expect(screen.getByTestId("credit-fill-coin")).toHaveAttribute("data-fill-state", "unknown");
  });

  it("clamps the credit coin fill while preserving the actual displayed balance", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          balanceCredits: 12000,
          creditTotalCredits: 10000,
        })}
      />
    );

    const coin = screen.getByTestId("credit-fill-coin");

    expect(screen.getByText("12,000 / 10,000")).toBeInTheDocument();
    expect(coin).toHaveAttribute("data-fill-state", "ready");
    expect(coin.getAttribute("style")).toContain("--credit-spent-degrees: 0deg");
  });

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
        onOpenProjectNameEditor={onOpenMediaLibrary}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit project Campaign Alpha in Media panel" })
    );

    expect(onOpenMediaLibrary).toHaveBeenCalledTimes(1);
  });

  it("omits the centered project name when no project title is available", () => {
    render(<AiStudioPageContent {...createProps()} projectName={null} />);

    expect(screen.queryByRole("status", { name: /current project:/i })).not.toBeInTheDocument();
  });

  it("toggles Canvas visibility from the header button through the page shell contract", () => {
    render(<AiStudioPageContent {...createProps()} />);

    const canvasButton = screen.getByRole("button", { name: "Canvas" });
    const shellFrame = screen.getByTestId("ai-studio-shell-frame");

    expect(canvasButton).toHaveAttribute("aria-pressed", "false");
    expect(shellFrame).toHaveAttribute("data-canvas-visible", "false");

    fireEvent.click(canvasButton);

    expect(canvasButton).toHaveAttribute("aria-pressed", "true");
    expect(shellFrame).toHaveAttribute("data-canvas-visible", "true");

    fireEvent.click(canvasButton);

    expect(canvasButton).toHaveAttribute("aria-pressed", "false");
    expect(shellFrame).toHaveAttribute("data-canvas-visible", "false");
  });

  it.each(["Canvas", "Quick Slot Inventory", "Reference Grid"] as const)(
    "does not expand %s from a double-click sequence",
    (buttonName) => {
      render(<AiStudioPageContent {...createProps()} />);

      const targetButton = screen.getByRole("button", { name: buttonName });
      const shellFrame = screen.getByTestId("ai-studio-shell-frame");

      fireEvent.click(targetButton, { detail: 1 });
      fireEvent.click(targetButton, { detail: 2 });
      fireEvent.doubleClick(targetButton, { detail: 2 });

      expect(shellFrame).toHaveAttribute("data-show-preview-rail", "true");
      expect(screen.queryByRole("button", { name: "Restore previous panel layout" })).toBeNull();
      for (const visibleButtonName of ["Canvas", "Quick Slot Inventory", "Reference Grid"]) {
        expect(screen.getByRole("button", { name: visibleButtonName })).toBeInTheDocument();
      }
    }
  );

  it("settles when the Voices panel reports the same active voice changer video source", async () => {
    voicePanelActiveSourceEffectMock.mockClear();

    render(<AiStudioPageContent {...createProps()} selectedTool="voices" />);

    expect(await screen.findByTestId("voices-properties-panel")).toBeInTheDocument();
    await waitFor(() => {
      expect(voicePanelActiveSourceEffectMock).toHaveBeenCalledTimes(2);
    });
    expect(voicePanelActiveSourceEffectMock.mock.calls.length).toBeLessThan(3);
  });

  it("keeps the styles catalog disabled while Media Library is the active tool", () => {
    render(<AiStudioPageContent {...createProps()} selectedTool="media-library" />);

    expect(useAiStudioStylesRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it("enables the styles catalog when Styles is the active tool", () => {
    render(<AiStudioPageContent {...createProps()} selectedTool="styles" />);

    expect(useAiStudioStylesRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true })
    );
  });

  it("passes the route-level media storage block state into the Media Library panel", async () => {
    render(
      <AiStudioPageContent
        {...createProps()}
        selectedTool="media-library"
        isMediaStorageFull
        onAddLibraryMediaReference={vi.fn()}
        onAddLibraryPromptReference={vi.fn()}
      />
    );

    expect(await screen.findByTestId("media-library-panel")).toBeInTheDocument();
    expect(mediaLibraryPanelPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({ isStorageQuotaBlocked: true })
    );
  });

  it.each([
    "create",
    "text",
    "edit",
    "image",
    "video",
    "kling",
    "sound",
    "voices",
    "text-to-speech",
    "voice-changer",
    "sound-effects",
    "music",
  ] satisfies ToolId[])(
    "allows %s to collapse the global right rail when the shell expands",
    (selectedTool) => {
      render(<AiStudioPageContent {...createProps()} selectedTool={selectedTool} />);

      expect(useAiStudioShellResizeMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          minRightWidthPx: AI_SHELL_RIGHT_COLLAPSED_MIN_PX,
        })
      );
    }
  );

  it.each([
    "character",
    "elements",
    "media-library",
    "styles",
    "presets",
    null,
  ] satisfies Array<ToolId | null>)(
    "preserves the default right-rail minimum for %s",
    (selectedTool) => {
      render(<AiStudioPageContent {...createProps()} selectedTool={selectedTool} />);

      expect(useAiStudioShellResizeMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          minRightWidthPx: undefined,
        })
      );
    }
  );
});
