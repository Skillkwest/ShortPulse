import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiStudioPageContent, type AiStudioPageContentProps } from "../AiStudioPageContent";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
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
  CreatePropertiesPanel: () => <div data-testid="text-properties" />,
  ComposeSendCard: () => <div data-testid="compose-send-card" />,
}));

vi.mock("../DetailModal", () => ({
  DetailModal: () => null,
}));

vi.mock("../ModelModal", () => ({
  ModelModal: () => null,
}));

vi.mock("../ReferenceGrid", () => ({
  ReferenceGrid: () => (
    <div
      data-testid="reference-grid"
      onDrop={(event: React.DragEvent<HTMLDivElement>) => event.preventDefault()}
    />
  ),
}));

vi.mock("../EditPropertiesPanel", () => ({
  EditPropertiesPanel: () => <div data-testid="edit-properties" />,
}));

vi.mock("../StudioPreview", () => ({
  StudioPreview: () => <div data-testid="studio-preview" />,
}));

vi.mock("../CharacterPanel", () => ({
  CharacterPanel: () => <div data-testid="character-panel" />,
}));

vi.mock("../VideoPropertiesPanel", () => ({
  VideoPropertiesPanel: () => <div data-testid="video-properties" />,
}));

vi.mock("../../../prefabs/agent", () => ({
  AgentChatPanel: () => <div data-testid="agent-chat-panel" />,
}));

vi.mock("../hooks/useAiStudioShellResize", () => ({
  useAiStudioShellResize: () => ({
    shellRef: { current: null },
    leftColumnRef: { current: null },
    showDivider: false,
    isResizing: false,
    shellStyle: {},
    collapseToMin: vi.fn(),
    dividerProps: {},
  }),
}));

const makeEmptyFileList = (): FileList =>
  ({
    length: 0,
    item: () => null,
  }) as unknown as FileList;

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
  propertiesImage: {} as AiStudioPageContentProps["propertiesImage"],
  propertiesVideo: {} as AiStudioPageContentProps["propertiesVideo"],
  isTemplateView: false,
  referenceGridProps: {
    outputs: [],
    activeOutputId: null,
    onSelectOutput: vi.fn(),
    onOpenDetails: vi.fn(),
    selectedTool: null,
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
  modelModalState: {
    isOpen: false,
    position: null,
    options: [],
    onClose: vi.fn(),
    onSelect: vi.fn(),
    anchorId: null,
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
    onAgentSelectVariation: vi.fn(),
    onAgentDescribeTargets: vi.fn(),
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

  it("routes primary workflows and aliases to the expected panel surfaces", () => {
    const { rerender } = render(
      <AiStudioPageContent {...createProps({ selectedTool: "create" })} />
    );
    expect(screen.getByTestId("text-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "text" })} />);
    expect(screen.getByTestId("text-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "edit" })} />);
    expect(screen.getByTestId("edit-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "image" })} />);
    expect(screen.getByTestId("edit-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "video" })} />);
    expect(screen.getByTestId("video-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "kling" })} />);
    expect(screen.getByTestId("video-properties")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "character" })} />);
    expect(screen.getByTestId("character-panel")).toBeInTheDocument();

    rerender(<AiStudioPageContent {...createProps({ selectedTool: "canvas" })} />);
    expect(screen.getByTestId("character-panel")).toBeInTheDocument();
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
