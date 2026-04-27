import React, { type CSSProperties, type DragEventHandler, type ReactNode, type Ref } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EXPLICIT_CONTENT_FAILURE_DETAIL } from "../../../../lib/explicitContentFailure";
import { AiStudioPageContent, type AiStudioPageContentProps } from "../AiStudioPageContent";
import { EDIT_PRESET_SURFACE_PRESET_IDS } from "../edit/expertEditPresets";
import type { ReferenceGridProps } from "../../reference-grid/referenceGridTypes";
import type { StudioOutput } from "../../types";

const createPropertiesPanelRenderSpy = vi.fn();
type StudioPreviewMockProps = {
  activeOutput: StudioOutput | null;
  referenceImageUrl: string | null;
  referenceText: string | null;
  onReferenceImageChange: (url: string | null) => void;
  onReferenceTextChange: (text: string) => void;
  onRegenerate: () => void;
};

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../AiStudioToolbar", () => ({
  AiStudioToolbar: () => <div data-testid="ai-toolbar" />,
}));

vi.mock("../CreatePropertiesPanel", () => ({
  CreatePropertiesPanel: (props: {
    isStylesPanelOpen?: boolean;
    selectedStyleId?: string | null;
    onStylesPanelToggle?: () => void;
    chatModeEnabled?: boolean;
    expertCreateMode?: "standard" | "pulse";
    onExpertCreateModeChange?: (value: "standard" | "pulse") => void;
    onOpenPresetsLibrary?: () => void;
  }) => {
    createPropertiesPanelRenderSpy();
    return (
      <div data-testid="text-properties">
        <button type="button" aria-label="Styles" onClick={() => props.onStylesPanelToggle?.()}>
          Styles
        </button>
        <button type="button" onClick={() => props.onExpertCreateModeChange?.("standard")}>
          Standard
        </button>
        <button type="button" onClick={() => props.onExpertCreateModeChange?.("pulse")}>
          Pulse
        </button>
        <button type="button" onClick={() => props.onOpenPresetsLibrary?.()}>
          Open create presets library
        </button>
        <div data-testid="create-styles-open">{props.isStylesPanelOpen ? "open" : "closed"}</div>
        <div data-testid="create-selected-style">{props.selectedStyleId ?? ""}</div>
        <div data-testid="create-chat-mode">{props.chatModeEnabled ? "on" : "off"}</div>
        <div data-testid="create-expert-mode">{props.expertCreateMode ?? "standard"}</div>
      </div>
    );
  },
  ComposeSendCard: () => <div data-testid="compose-send-card" />,
}));

vi.mock("../DetailModal", () => ({
  DetailModal: () => null,
}));

vi.mock("../ModelModal", () => ({
  ModelModal: () => null,
}));

vi.mock("../ReferenceGrid", () => ({
  ReferenceGrid: (props: {
    railCanvasProps?: unknown;
    stylesPanel?: {
      isOpen: boolean;
      selectedStyleId: string | null;
      onSelectStyle?: (styleId: string | null) => void;
    };
    panelVisibility?: {
      quickSlot: boolean;
      referenceGrid: boolean;
      styles: boolean;
    };
  }) => (
    <div
      data-testid="reference-grid"
      data-panel-canvas={props.railCanvasProps ? "visible" : "hidden"}
      data-panel-quick-slot={props.panelVisibility?.quickSlot ? "visible" : "hidden"}
      data-panel-reference-grid={props.panelVisibility?.referenceGrid ? "visible" : "hidden"}
      data-panel-styles={props.panelVisibility?.styles ? "visible" : "hidden"}
      onDrop={(event: React.DragEvent<HTMLDivElement>) => event.preventDefault()}
    >
      {props.stylesPanel?.isOpen ? (
        <div data-testid="reference-grid-styles-panel">
          <div data-testid="reference-grid-selected-style">{props.stylesPanel.selectedStyleId}</div>
          <button
            type="button"
            onClick={() => {
              props.stylesPanel?.onSelectStyle?.("cinematic");
            }}
          >
            Select cinematic style
          </button>
        </div>
      ) : null}
      <div
        data-testid="reference-grid-quick-slot"
        className="reference-curated-section"
        onDragOver={(event: React.DragEvent<HTMLDivElement>) => event.preventDefault()}
        onDrop={(event: React.DragEvent<HTMLDivElement>) => event.preventDefault()}
      />
    </div>
  ),
}));

vi.mock("../edit/ExpertEditPanelView", () => ({
  ExpertEditPanelView: (props: {
    isStylesPanelOpen?: boolean;
    selectedStyleId?: string | null;
    onStylesPanelToggle?: () => void;
    onOpenPresetsLibrary?: () => void;
  }) => (
    <div data-testid="expert-edit-properties">
      <button type="button" aria-label="Styles" onClick={() => props.onStylesPanelToggle?.()}>
        Styles
      </button>
      <button type="button" onClick={() => props.onOpenPresetsLibrary?.()}>
        Open presets library
      </button>
      <div data-testid="expert-edit-styles-open">{props.isStylesPanelOpen ? "open" : "closed"}</div>
      <div data-testid="expert-edit-selected-style">{props.selectedStyleId ?? ""}</div>
    </div>
  ),
}));

vi.mock("../StudioPreview", () => ({
  StudioPreview: () => <div data-testid="studio-preview" />,
}));

vi.mock("../AiStudioShellFrame", async () => {
  const { ReferenceGrid } = await import("../ReferenceGrid");
  const { StudioPreview } = await import("../StudioPreview");

  return {
    AiStudioShellFrame: (props: {
      shellRef?: Ref<HTMLElement>;
      shellClassName?: string;
      shellStyle?: CSSProperties;
      propertiesPanelContent?: ReactNode;
      rightColumnRef?: Ref<HTMLDivElement>;
      rightColumnHidden?: boolean;
      showPreviewRail?: boolean;
      rightColumnDropMode?: string;
      onRightColumnDropCapture?: DragEventHandler<HTMLDivElement>;
      onRightColumnDragOverCapture?: DragEventHandler<HTMLDivElement>;
      onRightColumnDragEnterCapture?: DragEventHandler<HTMLDivElement>;
      onRightColumnDragLeaveCapture?: DragEventHandler<HTMLDivElement>;
      onShellDragOverCapture?: DragEventHandler<HTMLElement>;
      onShellDropCapture?: DragEventHandler<HTMLElement>;
      referenceGridProps?: Partial<ReferenceGridProps>;
      studioPreviewProps?: Partial<StudioPreviewMockProps>;
    }) => (
      <section
        ref={props.shellRef}
        className={props.shellClassName}
        style={props.shellStyle}
        data-dense-shell="false"
        onDragOverCapture={props.onShellDragOverCapture}
        onDropCapture={props.onShellDropCapture}
      >
        <aside className="panel ai-panel ai-properties">{props.propertiesPanelContent}</aside>
        <div
          ref={props.rightColumnRef}
          className={`ai-shell-right${props.rightColumnDropMode && props.rightColumnDropMode !== "none" ? " is-drop-overlay-active" : ""}`}
          data-right-column-hidden={props.rightColumnHidden ? "true" : "false"}
          onDropCapture={props.onRightColumnDropCapture}
          onDragOverCapture={props.onRightColumnDragOverCapture}
          onDragEnterCapture={props.onRightColumnDragEnterCapture}
          onDragLeaveCapture={props.onRightColumnDragLeaveCapture}
        >
          <ReferenceGrid
            {...({
              activeOutputId: null,
              ...(props.referenceGridProps ?? {}),
            } as ReferenceGridProps)}
          />
          {props.showPreviewRail !== false ? (
            <StudioPreview
              activeOutput={null}
              referenceImageUrl={null}
              referenceText={null}
              onReferenceImageChange={() => undefined}
              onReferenceTextChange={() => undefined}
              onRegenerate={() => undefined}
              {...(props.studioPreviewProps ?? {})}
            />
          ) : null}
        </div>
      </section>
    ),
  };
});

vi.mock("../CharacterPanel", () => ({
  CharacterPanel: () => <div data-testid="character-panel" />,
}));

vi.mock("../StylesLibraryPanel", () => ({
  StylesLibraryPanel: (props: {
    selectedStyleId: string | null;
    onSelectStyle?: (styleId: string | null) => void;
  }) => (
    <div data-testid="styles-library-panel">
      <div data-testid="styles-library-selected-style">{props.selectedStyleId ?? ""}</div>
      <button type="button" onClick={() => props.onSelectStyle?.("anime")}>
        Select anime style in library
      </button>
    </div>
  ),
}));

vi.mock("../UnifiedPresetsLibraryPanel", () => ({
  UnifiedPresetsLibraryPanel: (props: {
    promptPresets: Array<{ presetId: string; label: string }>;
    selectedPromptPresetId: string | null;
    onSelectPromptPreset?: (presetId: string | null) => void;
    savedPulsePresets?: Array<{ presetId: string }>;
  }) => (
    <div data-testid="presets-library-panel">
      <div data-testid="presets-library-count">{props.promptPresets.length}</div>
      <div data-testid="presets-library-pulse-count">{props.savedPulsePresets?.length ?? 0}</div>
      <div data-testid="presets-library-selected-preset">{props.selectedPromptPresetId ?? ""}</div>
      {props.promptPresets.map((preset) => (
        <button
          key={preset.presetId}
          type="button"
          onClick={() => props.onSelectPromptPreset?.(preset.presetId)}
        >
          Select {preset.label} preset
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../MediaLibraryPanel", () => ({
  MediaLibraryPanel: (props: { onExpandMediaLibraryPanel?: () => void }) => (
    <div data-testid="media-library-panel">
      <button
        type="button"
        onClick={() => {
          props.onExpandMediaLibraryPanel?.();
        }}
      >
        Expand media library panel
      </button>
    </div>
  ),
}));

vi.mock("../VideoPropertiesPanel", () => ({
  VideoPropertiesPanel: () => <div data-testid="video-properties" />,
}));

vi.mock("../../../../prefabs/agent", () => ({
  AgentChatPanel: () => <div data-testid="agent-chat-panel" />,
}));

const collapseToMinMock = vi.fn();
const expandToMaxMock = vi.fn();
const resetToDefaultWidthMock = vi.fn();
vi.mock("../hooks/useAiStudioShellResize", () => ({
  useAiStudioShellResize: () => ({
    shellRef: { current: null },
    leftColumnRef: { current: null },
    leftWidthPx: 420,
    showDivider: false,
    isResizing: false,
    shellStyle: {},
    collapseToMin: collapseToMinMock,
    resetToDefaultWidth: resetToDefaultWidthMock,
    restoreWidth: vi.fn(),
    expandToMax: expandToMaxMock,
    dividerProps: {},
    rightColumnHidden: false,
  }),
}));

const makeEmptyFileList = (): FileList =>
  ({
    length: 0,
    item: () => null,
  }) as unknown as FileList;

const createDataTransfer = (data: Record<string, string> = {}): DataTransfer =>
  ({
    files: makeEmptyFileList(),
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? "",
  }) as unknown as DataTransfer;

const createProps = (
  overrides: Partial<AiStudioPageContentProps> = {}
): AiStudioPageContentProps => ({
  referenceGridFileInputRef: { current: null },
  onFileBrowserSelection: vi.fn(),
  uiError: null,
  uiNotice: null,
  characterError: null,
  onDismissUiError: vi.fn(),
  onDismissUiNotice: vi.fn(),
  onDismissCharacterError: vi.fn(),
  beginnerMode: false,
  onBeginnerModeChange: vi.fn(),
  balanceCredits: null,
  pendingHoldCredits: null,
  balanceLoading: false,
  visibleFailures: [],
  onDismissFailure: vi.fn(),
  onInspectFailure: vi.fn(),
  selectedTool: null,
  showCreateTools: false,
  onSelectTool: vi.fn(),
  onToggleCreateTools: vi.fn(),
  propertiesCreate: {} as AiStudioPageContentProps["propertiesCreate"],
  propertiesEditExpert: {
    expertEditEligible: false,
  } as AiStudioPageContentProps["propertiesEditExpert"],
  propertiesVideo: {} as AiStudioPageContentProps["propertiesVideo"],
  isTemplateView: false,
  referenceGridProps: {
    outputs: [],
    activeOutputId: null,
    railCanvasProps: {} as ReferenceGridProps["railCanvasProps"],
    onSelectOutput: vi.fn(),
    onOpenDetails: vi.fn(),
    onPasteTextReference: vi.fn(),
    onPasteMediaReference: vi.fn(),
  },
  studioPreviewProps: {
    activeOutput: null,
    referenceImageUrl: null,
    referenceText: null,
    onReferenceImageChange: vi.fn(),
    onReferenceTextChange: vi.fn(),
    onRegenerate: vi.fn(),
  },
  detailModalOutput: null,
  onDetailClose: vi.fn(),
  onUpdateOutputPrompt: vi.fn(),
  onDeleteOutput: vi.fn(),
  onAddLibraryMediaReference: vi.fn(),
  onAddLibraryPromptReference: vi.fn(),
  modelModalState: {
    isOpen: false,
    options: [],
    onClose: vi.fn(),
    onSelect: vi.fn(),
    context: null,
  },
  agentChat: {
    isOpen: false,
    agentMessages: [],
    agentActions: undefined,
    agentInput: "",
    agentIsSending: false,
    latestAgentPrompt: null,
    agentPrimarySource: "manual",
    stagedAttachments: [],
    agentDropActive: false,
    onInputChange: vi.fn(),
    onSend: vi.fn(),
    onAddToGrid: vi.fn(),
    onClose: vi.fn(),
    onAttachmentDrop: vi.fn(),
    onAttachmentDragOver: vi.fn(),
    onAttachmentDragEnter: vi.fn(),
    onAttachmentDragLeave: vi.fn(),
    onRemoveAttachment: vi.fn(),
    onClearAttachments: vi.fn(),
    onAgentApplyPrompt: vi.fn(),
    onGenerateFromOutputPrompt: vi.fn(),
    outputGenerateCostCredits: null,
    disableOutputGenerate: false,
  },
  handleReferenceGridFiles: vi.fn(),
  triggerFilePicker: vi.fn(),
  ...overrides,
  showBeginnerModeToggle: overrides.showBeginnerModeToggle ?? true,
});

describe("AiStudioPageContent right column drop router", () => {
  it("keeps the active create properties panel stable when inactive panel props change", () => {
    createPropertiesPanelRenderSpy.mockClear();
    const stableCreateProps = {} as AiStudioPageContentProps["propertiesCreate"];
    const baseProps = createProps({
      selectedTool: "create",
      propertiesCreate: stableCreateProps,
      propertiesEditExpert: {
        inactivePanelVersion: 1,
      } as unknown as AiStudioPageContentProps["propertiesEditExpert"],
    });

    const { rerender } = render(<AiStudioPageContent {...baseProps} />);
    const renderCountAfterInitialMount = createPropertiesPanelRenderSpy.mock.calls.length;

    rerender(
      <AiStudioPageContent
        {...createProps({
          ...baseProps,
          propertiesCreate: stableCreateProps,
          propertiesEditExpert: {
            inactivePanelVersion: 2,
          } as unknown as AiStudioPageContentProps["propertiesEditExpert"],
        })}
      />
    );

    expect(createPropertiesPanelRenderSpy.mock.calls.length).toBe(renderCountAfterInitialMount);
  });

  it("renders header shortcut buttons in the top AI Studio header row", () => {
    render(<AiStudioPageContent {...createProps()} />);

    expect(screen.getByRole("button", { name: "Canvas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reference Grid" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quick Slot Inventory" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Styles" })).not.toBeInTheDocument();
  });

  it.each([
    ["create", "create"],
    ["edit", "edit"],
    ["video", "video"],
    ["sound", "sound"],
  ] as const)("shows the canvas toggle for the %s workflow", (_label, selectedTool) => {
    render(<AiStudioPageContent {...createProps({ selectedTool })} />);

    expect(screen.getByRole("button", { name: "Canvas" })).toBeInTheDocument();
  });

  it("keeps header shortcuts limited to quick slot and reference grid in character workflow", () => {
    render(<AiStudioPageContent {...createProps({ selectedTool: "character" })} />);

    const shortcutButtons = within(screen.getByLabelText("AI Studio header shortcuts"));
    expect(shortcutButtons.getByRole("button", { name: "Canvas" })).toBeInTheDocument();
    expect(
      shortcutButtons.getByRole("button", { name: "Quick Slot Inventory" })
    ).toBeInTheDocument();
    expect(shortcutButtons.getByRole("button", { name: "Reference Grid" })).toBeInTheDocument();
  });

  it("disables the quick-slot toggle when curated split is unavailable", () => {
    render(<AiStudioPageContent {...createProps({ selectedTool: "create" })} />);
    const shortcutButtons = within(screen.getByLabelText("AI Studio header shortcuts"));
    expect(shortcutButtons.getByRole("button", { name: "Quick Slot Inventory" })).toBeDisabled();
  });

  it("toggles right-rail panel visibility from header shortcuts", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "create",
          referenceGridProps: {
            ...createProps().referenceGridProps,
            onAddCuratedReference: vi.fn(),
            onRemoveCuratedReference: vi.fn(),
            onReorderCuratedReference: vi.fn(),
          },
        })}
      />
    );

    const shortcutButtons = within(screen.getByLabelText("AI Studio header shortcuts"));
    const referenceGrid = screen.getByTestId("reference-grid");
    const quickSlotButton = shortcutButtons.getByRole("button", { name: "Quick Slot Inventory" });
    const referenceGridButton = shortcutButtons.getByRole("button", { name: "Reference Grid" });

    expect(quickSlotButton).toHaveAttribute("aria-pressed", "true");
    expect(referenceGridButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(quickSlotButton);
    fireEvent.click(referenceGridButton);

    expect(referenceGrid).toHaveAttribute("data-panel-quick-slot", "hidden");
    expect(referenceGrid).toHaveAttribute("data-panel-reference-grid", "hidden");
    expect(quickSlotButton).toHaveAttribute("aria-pressed", "false");
    expect(referenceGridButton).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles canvas visibility from the header icon button", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "create",
          referenceGridProps: {
            ...createProps().referenceGridProps,
            railCanvasProps: {} as never,
          },
        })}
      />
    );

    const canvasToggle = screen.getByRole("button", { name: "Canvas" });
    const referenceGrid = screen.getByTestId("reference-grid");

    expect(canvasToggle).toHaveAttribute("aria-pressed", "false");
    expect(referenceGrid).toHaveAttribute("data-panel-canvas", "hidden");

    fireEvent.click(canvasToggle);

    expect(canvasToggle).toHaveAttribute("aria-pressed", "true");
    expect(referenceGrid).toHaveAttribute("data-panel-canvas", "visible");

    fireEvent.click(canvasToggle);

    expect(canvasToggle).toHaveAttribute("aria-pressed", "false");
    expect(referenceGrid).toHaveAttribute("data-panel-canvas", "hidden");
  });

  it("restores the previous workflow and rail layout from the eye button after expanding a right-rail panel", () => {
    const referenceGridProps = {
      ...createProps().referenceGridProps,
      railCanvasProps: {} as never,
      onAddCuratedReference: vi.fn(),
      onRemoveCuratedReference: vi.fn(),
      onReorderCuratedReference: vi.fn(),
    };

    const Harness = () => {
      const [selectedTool, setSelectedTool] =
        React.useState<AiStudioPageContentProps["selectedTool"]>("create");

      return (
        <AiStudioPageContent
          {...createProps({
            selectedTool,
            onSelectTool: setSelectedTool,
            referenceGridProps,
          })}
        />
      );
    };

    render(<Harness />);

    const canvasToggle = screen.getByRole("button", { name: "Canvas" });
    const referenceGrid = screen.getByTestId("reference-grid");

    expect(screen.getByTestId("studio-preview")).toBeInTheDocument();
    expect(screen.getByTestId("text-properties")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restore previous panel layout" })
    ).not.toBeInTheDocument();

    fireEvent.doubleClick(canvasToggle);

    expect(referenceGrid).toHaveAttribute("data-panel-canvas", "visible");
    expect(referenceGrid).toHaveAttribute("data-panel-quick-slot", "hidden");
    expect(referenceGrid).toHaveAttribute("data-panel-reference-grid", "hidden");
    expect(screen.queryByRole("button", { name: "Quick Slot Inventory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reference Grid" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("studio-preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("text-properties")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restore previous panel layout" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore previous panel layout" }));

    expect(screen.getByTestId("studio-preview")).toBeInTheDocument();
    expect(screen.getByTestId("text-properties")).toBeInTheDocument();
    expect(referenceGrid).toHaveAttribute("data-panel-canvas", "hidden");
    expect(referenceGrid).toHaveAttribute("data-panel-quick-slot", "visible");
    expect(referenceGrid).toHaveAttribute("data-panel-reference-grid", "visible");
    expect(
      screen.queryByRole("button", { name: "Restore previous panel layout" })
    ).not.toBeInTheDocument();
  });

  it("restores the previous workflow and rail layout when the expanded canvas toggle is clicked", () => {
    const referenceGridProps = {
      ...createProps().referenceGridProps,
      railCanvasProps: {} as never,
      onAddCuratedReference: vi.fn(),
      onRemoveCuratedReference: vi.fn(),
      onReorderCuratedReference: vi.fn(),
    };

    const Harness = () => {
      const [selectedTool, setSelectedTool] =
        React.useState<AiStudioPageContentProps["selectedTool"]>("create");

      return (
        <AiStudioPageContent
          {...createProps({
            selectedTool,
            onSelectTool: setSelectedTool,
            referenceGridProps,
          })}
        />
      );
    };

    render(<Harness />);

    const canvasToggle = screen.getByRole("button", { name: "Canvas" });
    const referenceGrid = screen.getByTestId("reference-grid");

    fireEvent.doubleClick(canvasToggle);

    expect(screen.queryByTestId("text-properties")).not.toBeInTheDocument();
    expect(screen.queryByTestId("studio-preview")).not.toBeInTheDocument();
    expect(referenceGrid).toHaveAttribute("data-panel-canvas", "visible");
    expect(referenceGrid).toHaveAttribute("data-panel-quick-slot", "hidden");
    expect(referenceGrid).toHaveAttribute("data-panel-reference-grid", "hidden");
    expect(screen.queryByRole("button", { name: "Quick Slot Inventory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reference Grid" })).not.toBeInTheDocument();

    fireEvent.click(canvasToggle);

    expect(screen.getByTestId("text-properties")).toBeInTheDocument();
    expect(screen.getByTestId("studio-preview")).toBeInTheDocument();
    expect(referenceGrid).toHaveAttribute("data-panel-canvas", "hidden");
    expect(referenceGrid).toHaveAttribute("data-panel-quick-slot", "visible");
    expect(referenceGrid).toHaveAttribute("data-panel-reference-grid", "visible");
  });

  it("restores the previous rail layout when the expanded quick slot toggle is clicked", () => {
    const referenceGridProps = {
      ...createProps().referenceGridProps,
      railCanvasProps: {} as never,
      onAddCuratedReference: vi.fn(),
      onRemoveCuratedReference: vi.fn(),
      onReorderCuratedReference: vi.fn(),
    };

    render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "create",
          referenceGridProps,
        })}
      />
    );

    const quickSlotToggle = screen.getByRole("button", { name: "Quick Slot Inventory" });
    const referenceGrid = screen.getByTestId("reference-grid");

    fireEvent.doubleClick(quickSlotToggle);

    expect(screen.queryByRole("button", { name: "Canvas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reference Grid" })).not.toBeInTheDocument();
    expect(referenceGrid).toHaveAttribute("data-panel-canvas", "hidden");
    expect(referenceGrid).toHaveAttribute("data-panel-quick-slot", "visible");
    expect(referenceGrid).toHaveAttribute("data-panel-reference-grid", "hidden");

    fireEvent.click(quickSlotToggle);

    expect(referenceGrid).toHaveAttribute("data-panel-canvas", "hidden");
    expect(referenceGrid).toHaveAttribute("data-panel-quick-slot", "visible");
    expect(referenceGrid).toHaveAttribute("data-panel-reference-grid", "visible");
  });

  it("persists panel visibility toggles globally across workflows", () => {
    const baseProps = createProps({
      selectedTool: "create",
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onAddCuratedReference: vi.fn(),
        onRemoveCuratedReference: vi.fn(),
        onReorderCuratedReference: vi.fn(),
      },
    });
    const { rerender } = render(<AiStudioPageContent {...baseProps} />);
    const getShortcutButtons = () => within(screen.getByLabelText("AI Studio header shortcuts"));

    fireEvent.click(getShortcutButtons().getByRole("button", { name: "Quick Slot Inventory" }));
    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-quick-slot", "hidden");

    rerender(<AiStudioPageContent {...createProps({ ...baseProps, selectedTool: "edit" })} />);
    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-quick-slot", "hidden");
    fireEvent.click(getShortcutButtons().getByRole("button", { name: "Reference Grid" }));
    expect(screen.getByTestId("reference-grid")).toHaveAttribute(
      "data-panel-reference-grid",
      "hidden"
    );

    rerender(<AiStudioPageContent {...createProps({ ...baseProps, selectedTool: "create" })} />);
    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-quick-slot", "hidden");
    expect(screen.getByTestId("reference-grid")).toHaveAttribute(
      "data-panel-reference-grid",
      "hidden"
    );
  });

  it("keeps the standard header toggles available in character workflow", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "character",
          referenceGridProps: {
            ...createProps().referenceGridProps,
            onAddCuratedReference: vi.fn(),
            onRemoveCuratedReference: vi.fn(),
            onReorderCuratedReference: vi.fn(),
          },
        })}
      />
    );

    const shortcutButtons = within(screen.getByLabelText("AI Studio header shortcuts"));
    expect(shortcutButtons.getByRole("button", { name: "Canvas" })).toBeInTheDocument();
    expect(
      shortcutButtons.getByRole("button", { name: "Quick Slot Inventory" })
    ).toBeInTheDocument();
    expect(shortcutButtons.getByRole("button", { name: "Reference Grid" })).toBeInTheDocument();
  });

  it("uses the shared right-rail visibility state in character workflow", () => {
    const baseProps = createProps({
      selectedTool: "create",
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onAddCuratedReference: vi.fn(),
        onRemoveCuratedReference: vi.fn(),
        onReorderCuratedReference: vi.fn(),
      },
    });
    const { rerender } = render(<AiStudioPageContent {...baseProps} />);
    const getShortcutButtons = () => within(screen.getByLabelText("AI Studio header shortcuts"));

    fireEvent.click(getShortcutButtons().getByRole("button", { name: "Quick Slot Inventory" }));
    fireEvent.click(getShortcutButtons().getByRole("button", { name: "Reference Grid" }));

    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-quick-slot", "hidden");
    expect(screen.getByTestId("reference-grid")).toHaveAttribute(
      "data-panel-reference-grid",
      "hidden"
    );

    rerender(<AiStudioPageContent {...createProps({ ...baseProps, selectedTool: "character" })} />);

    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-quick-slot", "hidden");
    expect(screen.getByTestId("reference-grid")).toHaveAttribute(
      "data-panel-reference-grid",
      "hidden"
    );
    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-styles", "hidden");
  });

  it("relies on parent-owned Pulse chat mode transitions instead of forcing them in the shell", () => {
    const referenceGridProps = {
      ...createProps().referenceGridProps,
      onAddCuratedReference: vi.fn(),
      onRemoveCuratedReference: vi.fn(),
      onReorderCuratedReference: vi.fn(),
    };

    const PulseCreateHarness = () => {
      const [chatModeEnabled, setChatModeEnabled] = React.useState(false);

      return (
        <AiStudioPageContent
          {...createProps({
            selectedTool: "create",
            referenceGridProps,
            propertiesCreate: {
              expertCreateUiEligible: true,
              beginnerMode: false,
              chatModeEnabled,
              onChatModeEnabledChange: setChatModeEnabled,
            } as AiStudioPageContentProps["propertiesCreate"],
          })}
        />
      );
    };

    render(<PulseCreateHarness />);

    expect(screen.getByTestId("create-chat-mode")).toHaveTextContent("off");
    expect(screen.getByTestId("create-expert-mode")).toHaveTextContent("standard");
    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-styles", "hidden");

    fireEvent.click(screen.getByRole("button", { name: "Styles" }));
    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-styles", "visible");

    fireEvent.click(screen.getByRole("button", { name: "Pulse" }));
    expect(screen.getByTestId("create-chat-mode")).toHaveTextContent("off");
    expect(screen.getByTestId("create-expert-mode")).toHaveTextContent("pulse");
    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-styles", "hidden");

    fireEvent.click(screen.getByRole("button", { name: "Standard" }));
    expect(screen.getByTestId("create-chat-mode")).toHaveTextContent("off");
    expect(screen.getByTestId("create-expert-mode")).toHaveTextContent("standard");
    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-styles", "visible");
  });

  it("treats token-only internal drags as internal so the shell does not intercept them", () => {
    const onPasteMediaReference = vi.fn();
    const onPasteTextReference = vi.fn();

    render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "character",
          referenceGridProps: {
            ...createProps().referenceGridProps,
            onAddCuratedReference: vi.fn(),
            onRemoveCuratedReference: vi.fn(),
            onReorderCuratedReference: vi.fn(),
            onPasteMediaReference,
            onPasteTextReference,
          },
        })}
      />
    );

    const shellRightColumn = document.querySelector(".ai-shell-right");
    if (!(shellRightColumn instanceof HTMLElement)) {
      throw new Error("Unable to resolve AI Studio right column.");
    }

    const transfer = createDataTransfer({
      "text/reference-drag-token": "",
      "text/reference-output-id": "",
    });

    fireEvent.dragEnter(shellRightColumn, { dataTransfer: transfer });
    fireEvent.dragOver(shellRightColumn, { dataTransfer: transfer });
    fireEvent.drop(shellRightColumn, { dataTransfer: transfer });

    expect(onPasteMediaReference).not.toHaveBeenCalled();
    expect(onPasteTextReference).not.toHaveBeenCalled();
  });

  it("renders high-contrast alert banner variants for error and warning notices", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          uiError: "Top-level error",
          uiNotice: "Top-level notice",
          characterError: "Character loading error",
        })}
      />
    );

    const errorBanner = screen.getByText("Top-level error").closest(".ai-alert-banner");
    const noticeBanner = screen.getByText("Top-level notice").closest(".ai-alert-banner");
    const characterBanner = screen.getByText("Character loading error").closest(".ai-alert-banner");

    expect(errorBanner).toHaveClass("ai-alert-banner--error");
    expect(noticeBanner).toHaveClass("ai-alert-banner--warning");
    expect(characterBanner).toHaveClass("ai-alert-banner--error");
  });

  it("suppresses duplicate top-level generation ui error when failure stack shows the same issue", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          uiError:
            "Nano Banana Pro failed: Preparation timed out before generation started. Please retry.",
          visibleFailures: [
            {
              id: "failure-1",
              model: "Nano Banana Pro",
              modelId: "fal-ai/nano-banana-pro",
              prompt: "keep this hidden",
              errorMessage: "Preparation timed out before generation started. Please retry.",
              errorDetail: "Preparation timed out before generation started. Please retry.",
            },
          ],
        })}
      />
    );

    expect(
      screen.queryByText(
        "Nano Banana Pro failed: Preparation timed out before generation started. Please retry."
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Generation issues")).not.toBeInTheDocument();
    expect(
      screen.getByText("Preparation timed out before generation started. Please retry.")
    ).toBeInTheDocument();
  });

  it("keeps top-level ui error when it does not match generation failure details", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          uiError: "Unable to save media to the library.",
          visibleFailures: [
            {
              id: "failure-3",
              model: "Nano Banana Pro",
              modelId: "fal-ai/nano-banana-pro",
              prompt: "hidden prompt",
              errorMessage: "Preparation timed out before generation started. Please retry.",
              errorDetail: "Preparation timed out before generation started. Please retry.",
            },
          ],
        })}
      />
    );

    expect(screen.getByText("Unable to save media to the library.")).toBeInTheDocument();
    expect(screen.queryByText("Generation issues")).not.toBeInTheDocument();
  });

  it("renders generation issues without nested cards or prompt rows", () => {
    const { container } = render(
      <AiStudioPageContent
        {...createProps({
          visibleFailures: [
            {
              id: "failure-2",
              model: "Nano Banana Pro",
              modelId: "fal-ai/nano-banana-pro",
              prompt: "remove this prompt display",
              errorMessage: "Preparation timed out before generation started. Please retry.",
              errorDetail: "Preparation timed out before generation started. Please retry.",
            },
          ],
        })}
      />
    );

    expect(container.querySelector(".ai-error-card")).toBeNull();
    expect(screen.queryByText("Prompt:")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("renders explicit-content failure rows with the shared moderation copy", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          visibleFailures: [
            {
              id: "failure-explicit",
              model: "Nano Banana Pro",
              modelId: "fal-ai/nano-banana-pro",
              prompt: "hidden prompt",
              errorMessage: "This request was blocked for explicit or unsafe content.",
              errorMessageShort: "Content not allowed",
              errorDetail: "Blocked by moderation.",
            },
          ],
        })}
      />
    );

    expect(screen.getByText(EXPLICIT_CONTENT_FAILURE_DETAIL)).toBeInTheDocument();
  });

  it("routes live workflows to their canonical panel surfaces", () => {
    const { rerender } = render(
      <AiStudioPageContent {...createProps({ selectedTool: "create" })} />
    );
    expect(screen.getByTestId("text-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "text" })} />);
    expect(screen.getByTestId("text-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "edit" })} />);
    expect(screen.getByTestId("expert-edit-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "image" })} />);
    expect(screen.getByTestId("expert-edit-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "video" })} />);
    expect(screen.getByTestId("video-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "kling" })} />);
    expect(screen.getByTestId("video-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "sound" })} />);
    expect(screen.getByRole("heading", { name: "Sound Properties" })).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "voices" })} />);
    expect(screen.getByRole("heading", { name: "Voices" })).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "voice-changer" })} />);
    expect(screen.getByRole("heading", { name: "Voices" })).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "text-to-speech" })} />);
    expect(screen.getByRole("heading", { name: "Voices" })).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "sound-effects" })} />);
    expect(screen.getByRole("heading", { name: "Sound Effects" })).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "music" })} />);
    expect(screen.getByRole("heading", { name: "Music" })).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "character" })} />);
    expect(screen.getByTestId("character-panel")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "styles" })} />);
    expect(screen.getByTestId("styles-library-panel")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "presets" })} />);
    expect(screen.getByTestId("presets-library-panel")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "media-library" })} />);
    expect(screen.getByTestId("media-library-panel")).toBeInTheDocument();
  });

  it("renders the primary styles panel for styles tool without coming-soon card", () => {
    render(<AiStudioPageContent {...createProps({ selectedTool: "styles" })} />);

    expect(screen.getByTestId("styles-library-panel")).toBeInTheDocument();
    expect(screen.getByTestId("reference-grid")).toHaveAttribute(
      "data-panel-reference-grid",
      "visible"
    );
    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-quick-slot", "hidden");
    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-styles", "hidden");
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    expect(
      screen.queryByText("A curated style library for consistent creative direction.")
    ).not.toBeInTheDocument();
  });

  it("renders the primary presets panel without coming-soon card and keeps right rail visible", () => {
    render(<AiStudioPageContent {...createProps({ selectedTool: "presets" })} />);

    expect(screen.getByTestId("presets-library-panel")).toBeInTheDocument();
    expect(screen.getByTestId("presets-library-count")).toHaveTextContent(
      String(EDIT_PRESET_SURFACE_PRESET_IDS.length)
    );
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    expect(screen.getByTestId("reference-grid")).toBeInTheDocument();
    expect(screen.getByTestId("studio-preview")).toBeInTheDocument();
  });

  it("opens the presets library from the expert edit properties panel callback", () => {
    const onSelectTool = vi.fn();
    render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "edit",
          onSelectTool,
          propertiesEditExpert: {
            expertEditEligible: true,
          } as AiStudioPageContentProps["propertiesEditExpert"],
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /open presets library/i }));

    expect(onSelectTool).toHaveBeenCalledWith("presets");
  });

  it("opens the presets library from the create properties panel callback", () => {
    const onSelectTool = vi.fn();
    render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "create",
          onSelectTool,
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /open create presets library/i }));

    expect(onSelectTool).toHaveBeenCalledWith("presets");
  });

  it("hydrates the presets library from expert edit custom overrides without mutating prompt on card click", () => {
    const onPromptTextChange = vi.fn();
    render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "presets",
          propertiesEditExpert: {
            expertEditEligible: true,
            onPromptTextChange,
            customPresetOverrides: {
              custom_1: {
                label: "Library Custom",
                prompt: "Custom panel prompt",
              },
            },
          } as unknown as AiStudioPageContentProps["propertiesEditExpert"],
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Library Custom preset" }));
    expect(screen.getByTestId("presets-library-selected-preset")).toHaveTextContent("custom_1");
    expect(onPromptTextChange).not.toHaveBeenCalled();
  });

  it("routes edit workflow to expert edit panel when eligible", () => {
    const { container } = render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "edit",
          propertiesEditExpert: {
            expertEditEligible: true,
          } as AiStudioPageContentProps["propertiesEditExpert"],
        })}
      />
    );

    expect(screen.getByTestId("expert-edit-properties")).toBeInTheDocument();
    expect(container.querySelector(".ai-shell")?.className).toContain("ai-shell-expert-edit");
  });

  it("wires styles toggle and style selection between expert edit and reference rail", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "edit",
          propertiesEditExpert: {
            expertEditEligible: true,
          } as AiStudioPageContentProps["propertiesEditExpert"],
        })}
      />
    );

    expect(screen.getByTestId("expert-edit-styles-open")).toHaveTextContent("closed");
    expect(screen.queryByTestId("reference-grid-styles-panel")).not.toBeInTheDocument();

    const expertPanel = screen.getByTestId("expert-edit-properties");
    fireEvent.click(within(expertPanel).getByRole("button", { name: "Styles" }));

    expect(screen.getByTestId("expert-edit-styles-open")).toHaveTextContent("open");
    expect(screen.getByTestId("reference-grid-styles-panel")).toBeInTheDocument();
    expect(screen.getByTestId("expert-edit-selected-style")).toHaveTextContent("");

    fireEvent.click(screen.getByRole("button", { name: "Select cinematic style" }));
    expect(screen.getByTestId("expert-edit-selected-style")).toHaveTextContent("cinematic");
    expect(screen.getByTestId("expert-edit-styles-open")).toHaveTextContent("closed");
    expect(screen.queryByTestId("reference-grid-styles-panel")).not.toBeInTheDocument();

    fireEvent.click(within(expertPanel).getByRole("button", { name: "Styles" }));
    expect(screen.getByTestId("expert-edit-styles-open")).toHaveTextContent("open");
    expect(screen.getByTestId("reference-grid-selected-style")).toHaveTextContent("cinematic");
  });

  it("keeps header shortcut states stable while expert edit styles panel toggles", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "edit",
          referenceGridProps: {
            ...createProps().referenceGridProps,
            onAddCuratedReference: vi.fn(),
            onRemoveCuratedReference: vi.fn(),
            onReorderCuratedReference: vi.fn(),
          },
          propertiesEditExpert: {
            expertEditEligible: true,
          } as AiStudioPageContentProps["propertiesEditExpert"],
        })}
      />
    );

    const shortcutButtons = within(screen.getByLabelText("AI Studio header shortcuts"));
    const quickSlotButton = shortcutButtons.getByRole("button", { name: "Quick Slot Inventory" });
    const expertPanelStylesButton = within(screen.getByTestId("expert-edit-properties")).getByRole(
      "button",
      { name: "Styles" }
    );

    expect(screen.getByTestId("expert-edit-styles-open")).toHaveTextContent("closed");
    fireEvent.click(expertPanelStylesButton);

    expect(screen.getByTestId("expert-edit-styles-open")).toHaveTextContent("open");
    expect(quickSlotButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("reference-grid")).toHaveAttribute("data-panel-styles", "visible");
    expect(screen.getByTestId("reference-grid")).toHaveAttribute(
      "data-panel-quick-slot",
      "visible"
    );

    fireEvent.click(expertPanelStylesButton);
    expect(screen.getByTestId("expert-edit-styles-open")).toHaveTextContent("closed");
    expect(quickSlotButton).toHaveAttribute("aria-pressed", "true");
  });

  it("wires styles toggle and style selection between expert create and reference rail", () => {
    render(
      <AiStudioPageContent
        {...createProps({
          selectedTool: "create",
          propertiesCreate: {
            ...(createProps().propertiesCreate as object),
            expertCreateUiEligible: true,
            beginnerMode: false,
          } as AiStudioPageContentProps["propertiesCreate"],
        })}
      />
    );

    expect(screen.getByTestId("create-styles-open")).toHaveTextContent("closed");
    expect(screen.queryByTestId("reference-grid-styles-panel")).not.toBeInTheDocument();

    const createPanel = screen.getByTestId("text-properties");
    fireEvent.click(within(createPanel).getByRole("button", { name: "Styles" }));

    expect(screen.getByTestId("create-styles-open")).toHaveTextContent("open");
    expect(screen.getByTestId("reference-grid-styles-panel")).toBeInTheDocument();
    expect(screen.getByTestId("create-selected-style")).toHaveTextContent("");

    fireEvent.click(screen.getByRole("button", { name: "Select cinematic style" }));
    expect(screen.getByTestId("create-selected-style")).toHaveTextContent("cinematic");
    expect(screen.getByTestId("create-styles-open")).toHaveTextContent("closed");
    expect(screen.queryByTestId("reference-grid-styles-panel")).not.toBeInTheDocument();
  });

  it("keeps selected style synchronized between styles tool and expert create/edit surfaces", () => {
    const baseProps = createProps({
      selectedTool: "edit",
      propertiesEditExpert: {
        expertEditEligible: true,
      } as AiStudioPageContentProps["propertiesEditExpert"],
    });
    const { rerender } = render(<AiStudioPageContent {...baseProps} />);

    fireEvent.click(
      within(screen.getByTestId("expert-edit-properties")).getByRole("button", { name: "Styles" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Select cinematic style" }));
    expect(screen.getByTestId("expert-edit-selected-style")).toHaveTextContent("cinematic");

    rerender(<AiStudioPageContent {...createProps({ ...baseProps, selectedTool: "styles" })} />);
    expect(screen.getByTestId("styles-library-selected-style")).toHaveTextContent("cinematic");

    rerender(
      <AiStudioPageContent
        {...createProps({
          ...baseProps,
          selectedTool: "create",
          propertiesCreate: {
            ...(createProps().propertiesCreate as object),
            expertCreateUiEligible: true,
            beginnerMode: false,
          } as AiStudioPageContentProps["propertiesCreate"],
        })}
      />
    );
    expect(screen.getByTestId("create-selected-style")).toHaveTextContent("cinematic");
  });

  it("does not let styles-library clicks change workflow style selection", () => {
    const baseProps = createProps({
      selectedTool: "edit",
      propertiesEditExpert: {
        expertEditEligible: true,
      } as AiStudioPageContentProps["propertiesEditExpert"],
    });
    const { rerender } = render(<AiStudioPageContent {...baseProps} />);

    fireEvent.click(
      within(screen.getByTestId("expert-edit-properties")).getByRole("button", { name: "Styles" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Select cinematic style" }));
    expect(screen.getByTestId("expert-edit-selected-style")).toHaveTextContent("cinematic");

    rerender(<AiStudioPageContent {...createProps({ ...baseProps, selectedTool: "styles" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Select anime style in library" }));
    expect(screen.getByTestId("styles-library-selected-style")).toHaveTextContent("cinematic");
  });

  it("creates a text card when text is dropped on the right column shell", () => {
    const onPasteTextReference = vi.fn();
    const props = createProps({
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onPasteTextReference,
      },
    });

    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: ["text/prompt", "text/plain"],
      files: makeEmptyFileList(),
      getData: (type: string) => (type === "text/prompt" ? "  dropped prompt text  " : ""),
    } as unknown as DataTransfer;

    fireEvent.drop(rightColumn as HTMLElement, { dataTransfer });

    expect(onPasteTextReference).toHaveBeenCalledWith("dropped prompt text");
  });

  it("keeps right-column text drop routing intact for live tool selections", () => {
    const onPasteTextReference = vi.fn();
    const baseProps = createProps();
    const props = createProps({
      selectedTool: "create",
      referenceGridProps: {
        ...baseProps.referenceGridProps,
        onPasteTextReference,
      },
    });

    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: ["text/plain"],
      files: makeEmptyFileList(),
      getData: (type: string) => (type === "text/plain" ? "Dropped note" : ""),
    } as unknown as DataTransfer;

    fireEvent.drop(rightColumn as HTMLElement, { dataTransfer });

    expect(onPasteTextReference).toHaveBeenCalledWith("Dropped note");
  });

  it("lets quick-slot targets bypass shell library-media routing", () => {
    const onAddLibraryMediaReference = vi.fn();
    const props = createProps({
      onAddLibraryMediaReference,
    });

    const { getByTestId } = render(<AiStudioPageContent {...props} />);
    const quickSlotTarget = getByTestId("reference-grid-quick-slot");
    const dataTransfer = {
      types: [
        "text/shortpulse-media-library-marker",
        "text/shortpulse-media-library-kind",
        "text/shortpulse-media-library-id",
        "text/reference-url",
      ],
      files: makeEmptyFileList(),
      getData: (type: string) => {
        if (type === "text/shortpulse-media-library-marker") return "shortpulse-media-library-v1";
        if (type === "text/shortpulse-media-library-kind") return "libraryMedia";
        if (type === "text/shortpulse-media-library-id") return "media-quick-slot-1";
        if (type === "text/reference-url") return "https://cdn.example.com/quick-slot-image.png";
        return "";
      },
    } as unknown as DataTransfer;

    fireEvent.dragOver(quickSlotTarget, { dataTransfer });
    fireEvent.drop(quickSlotTarget, { dataTransfer });

    expect(onAddLibraryMediaReference).not.toHaveBeenCalled();
  });

  it("routes file drops through the reference-grid file handler", () => {
    const onPasteTextReference = vi.fn();
    const handleReferenceGridFiles = vi.fn();
    const props = createProps({
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onPasteTextReference,
      },
      handleReferenceGridFiles,
    });
    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const file = new File(["image"], "image.png", { type: "image/png" });
    const dataTransfer = {
      types: ["Files"],
      files: {
        0: file,
        length: 1,
        item: (index: number) => (index === 0 ? file : null),
      } as unknown as FileList,
      getData: () => "",
    } as unknown as DataTransfer;

    fireEvent.drop(rightColumn as HTMLElement, { dataTransfer });

    expect(onPasteTextReference).not.toHaveBeenCalled();
    expect(handleReferenceGridFiles).toHaveBeenCalledTimes(1);
    expect(handleReferenceGridFiles).toHaveBeenCalledWith(dataTransfer.files);
  });

  it("accepts text drops when browser uses non-standard text MIME identifiers", () => {
    const onPasteTextReference = vi.fn();
    const props = createProps({
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onPasteTextReference,
      },
    });

    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: ["public.utf8-plain-text"],
      files: makeEmptyFileList(),
      getData: (type: string) => (type === "text/plain" ? "  drop this text  " : ""),
    } as unknown as DataTransfer;

    fireEvent.drop(rightColumn as HTMLElement, { dataTransfer });

    expect(onPasteTextReference).toHaveBeenCalledWith("drop this text");
  });

  it("creates a text card when drop payload includes Files plus text payload", () => {
    const onPasteTextReference = vi.fn();
    const props = createProps({
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onPasteTextReference,
      },
    });

    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: ["Files", "text/plain"],
      files: makeEmptyFileList(),
      getData: (type: string) => (type === "text/plain" ? "mixed payload text" : ""),
    } as unknown as DataTransfer;

    fireEvent.drop(rightColumn as HTMLElement, { dataTransfer });

    expect(onPasteTextReference).toHaveBeenCalledWith("mixed payload text");
  });

  it("creates a text card when dropping on nested right-column children", () => {
    const onPasteTextReference = vi.fn();
    const props = createProps({
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onPasteTextReference,
      },
    });

    const { getByTestId } = render(<AiStudioPageContent {...props} />);
    const nestedCanvasChild = getByTestId("reference-grid");
    const dataTransfer = {
      types: ["text/prompt", "text/plain"],
      files: makeEmptyFileList(),
      getData: (type: string) => (type === "text/prompt" ? "nested child drop" : ""),
    } as unknown as DataTransfer;

    fireEvent.drop(nestedCanvasChild, { dataTransfer });

    expect(onPasteTextReference).toHaveBeenCalledWith("nested child drop");
  });

  it("routes dropped media URLs through onPasteMediaReference", () => {
    const onPasteMediaReference = vi.fn();
    const onPasteTextReference = vi.fn();
    const props = createProps({
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onPasteMediaReference,
        onPasteTextReference,
      },
    });
    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: ["text/plain"],
      files: makeEmptyFileList(),
      getData: (type: string) =>
        type === "text/plain" ? "https://cdn.example.com/reference-video.mp4" : "",
    } as unknown as DataTransfer;

    fireEvent.drop(rightColumn as HTMLElement, { dataTransfer });

    expect(onPasteMediaReference).toHaveBeenCalledWith({
      url: "https://cdn.example.com/reference-video.mp4",
      mimeType: "video/*",
    });
    expect(onPasteTextReference).not.toHaveBeenCalled();
  });

  it("prefers prompt text over media URL hints for mixed drop payloads", () => {
    const onPasteMediaReference = vi.fn();
    const onPasteTextReference = vi.fn();
    const props = createProps({
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onPasteMediaReference,
        onPasteTextReference,
      },
    });
    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: ["text/prompt", "text/plain", "text/reference-url", "text/uri-list"],
      files: makeEmptyFileList(),
      getData: (type: string) => {
        if (type === "text/prompt") return "  Use this prompt text  ";
        if (type === "text/plain") return "https://cdn.example.com/reference-image.png";
        if (type === "text/reference-url") return "https://cdn.example.com/reference-image.png";
        if (type === "text/uri-list") return "https://cdn.example.com/reference-image.png";
        return "";
      },
    } as unknown as DataTransfer;

    fireEvent.drop(rightColumn as HTMLElement, { dataTransfer });

    expect(onPasteTextReference).toHaveBeenCalledWith("Use this prompt text");
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("routes media-library marker drops to libraryMedia even when custom MIME payload is missing", () => {
    const onAddLibraryMediaReference = vi.fn();
    const onPasteTextReference = vi.fn();
    const props = createProps({
      onAddLibraryMediaReference,
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onPasteTextReference,
      },
    });
    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: [
        "text/shortpulse-media-library-marker",
        "text/shortpulse-media-library-kind",
        "text/shortpulse-media-library-id",
        "text/reference-url",
        "text/plain",
        "text/prompt",
      ],
      files: makeEmptyFileList(),
      getData: (type: string) => {
        if (type === "application/x-shortpulse-media-library-item") return "";
        if (type === "text/x-shortpulse-media-library-item") return "";
        if (type === "text/shortpulse-media-library-marker") return "shortpulse-media-library-v1";
        if (type === "text/shortpulse-media-library-kind") return "libraryMedia";
        if (type === "text/shortpulse-media-library-id") return "media-1";
        if (type === "text/shortpulse-media-library-file-type") return "image";
        if (type === "text/reference-url") return "https://cdn.example.com/library-image.png";
        if (type === "text/prompt") return "Library prompt text";
        if (type === "text/plain") return "Library prompt text";
        return "";
      },
    } as unknown as DataTransfer;

    fireEvent.drop(rightColumn as HTMLElement, { dataTransfer });

    expect(onAddLibraryMediaReference).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "media-1",
        url: "https://cdn.example.com/library-image.png",
        fileType: "image",
      })
    );
    expect(onPasteTextReference).not.toHaveBeenCalled();
  });

  it("routes marker-based URL-only media-library drops to libraryMedia", () => {
    const onAddLibraryMediaReference = vi.fn();
    const onPasteTextReference = vi.fn();
    const props = createProps({
      onAddLibraryMediaReference,
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onPasteTextReference,
      },
    });
    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: [
        "text/shortpulse-media-library-marker",
        "text/shortpulse-media-library-kind",
        "text/shortpulse-media-library-id",
        "text/reference-url",
      ],
      files: makeEmptyFileList(),
      getData: (type: string) => {
        if (type === "application/x-shortpulse-media-library-item") return "";
        if (type === "text/x-shortpulse-media-library-item") return "";
        if (type === "text/shortpulse-media-library-marker") return "shortpulse-media-library-v1";
        if (type === "text/shortpulse-media-library-kind") return "libraryMedia";
        if (type === "text/shortpulse-media-library-id") return "media-2";
        if (type === "text/reference-url") return "https://cdn.example.com/library-video.mp4";
        if (type === "text/plain") return "https://cdn.example.com/library-video.mp4";
        return "";
      },
    } as unknown as DataTransfer;

    fireEvent.drop(rightColumn as HTMLElement, { dataTransfer });

    expect(onAddLibraryMediaReference).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "media-2",
        url: "https://cdn.example.com/library-video.mp4",
        fileType: "video",
      })
    );
    expect(onPasteTextReference).not.toHaveBeenCalled();
  });

  it("routes marker-based audio media-library drops to libraryMedia with audio type", () => {
    const onAddLibraryMediaReference = vi.fn();
    const onPasteTextReference = vi.fn();
    const props = createProps({
      onAddLibraryMediaReference,
      referenceGridProps: {
        ...createProps().referenceGridProps,
        onPasteTextReference,
      },
    });
    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: [
        "text/shortpulse-media-library-marker",
        "text/shortpulse-media-library-kind",
        "text/shortpulse-media-library-id",
        "text/reference-url",
      ],
      files: makeEmptyFileList(),
      getData: (type: string) => {
        if (type === "application/x-shortpulse-media-library-item") return "";
        if (type === "text/x-shortpulse-media-library-item") return "";
        if (type === "text/shortpulse-media-library-marker") return "shortpulse-media-library-v1";
        if (type === "text/shortpulse-media-library-kind") return "libraryMedia";
        if (type === "text/shortpulse-media-library-id") return "media-audio-1";
        if (type === "text/reference-url") return "https://cdn.example.com/library-audio.mp3";
        if (type === "text/plain") return "https://cdn.example.com/library-audio.mp3";
        return "";
      },
    } as unknown as DataTransfer;

    fireEvent.drop(rightColumn as HTMLElement, { dataTransfer });

    expect(onAddLibraryMediaReference).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "media-audio-1",
        url: "https://cdn.example.com/library-audio.mp3",
        fileType: "audio",
      })
    );
    expect(onPasteTextReference).not.toHaveBeenCalled();
  });

  it("pre-warms right-column dragover for text drags when browser omits drag types", () => {
    const props = createProps();
    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: [],
      files: makeEmptyFileList(),
      getData: () => "",
      dropEffect: "none",
    } as unknown as DataTransfer;

    const accepted = fireEvent.dragOver(rightColumn as HTMLElement, { dataTransfer });

    expect(accepted).toBe(false);
  });

  it("pre-warms right-column dragover when browser reports Files without attached files", () => {
    const props = createProps();
    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: ["Files"],
      files: makeEmptyFileList(),
      getData: () => "",
      dropEffect: "none",
    } as unknown as DataTransfer;

    const accepted = fireEvent.dragOver(rightColumn as HTMLElement, { dataTransfer });

    expect(accepted).toBe(false);
  });

  it("pre-warms right-column dragover when types include Files and text", () => {
    const props = createProps();
    const { container } = render(<AiStudioPageContent {...props} />);
    const rightColumn = container.querySelector(".ai-shell-right");
    expect(rightColumn).toBeTruthy();
    const dataTransfer = {
      types: ["Files", "text/plain"],
      files: makeEmptyFileList(),
      getData: () => "",
      dropEffect: "none",
    } as unknown as DataTransfer;

    const accepted = fireEvent.dragOver(rightColumn as HTMLElement, { dataTransfer });

    expect(accepted).toBe(false);
  });
});
