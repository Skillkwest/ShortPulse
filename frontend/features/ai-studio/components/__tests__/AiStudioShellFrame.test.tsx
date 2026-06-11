import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiStudioShellFrame } from "../AiStudioShellFrame";

vi.mock("../AiStudioReferenceRail", () => ({
  AiStudioReferenceRail: () => <div data-testid="reference-rail" />,
}));

vi.mock("../AiStudioPreviewRail", () => ({
  AiStudioPreviewRail: () => <div data-testid="preview-rail" />,
}));

vi.mock("../AiStudioPropertiesRail", () => ({
  AiStudioPropertiesRail: ({ panelContent }: { panelContent: React.ReactNode }) => (
    <aside data-testid="properties-rail">{panelContent}</aside>
  ),
}));

vi.mock("../hooks/aiStudioOutputStore", () => ({
  useOutputCounts: () => ({ activeCount: 0 }),
}));

const createProps = (): React.ComponentProps<typeof AiStudioShellFrame> => ({
  shellRef: { current: null },
  leftColumnRef: { current: null },
  rightColumnRef: { current: null },
  shellClassName: "ai-shell",
  shellLayoutMode: "split",
  shellStyle: {},
  selectedTool: "create",
  showDivider: false,
  dividerProps: {},
  propertiesPanelKey: "create",
  propertiesPanelContent: <div data-testid="properties-panel-content" />,
  rightColumnDropMode: "none",
  onRightColumnDropCapture: vi.fn(),
  onRightColumnDragOverCapture: vi.fn(),
  onRightColumnDragEnterCapture: vi.fn(),
  onRightColumnDragLeaveCapture: vi.fn(),
  onShellDragOverCapture: vi.fn(),
  onShellDropCapture: vi.fn(),
  referenceGridProps: {
    outputs: [],
    activeOutputId: null,
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
  handleReferenceGridFiles: vi.fn(),
  triggerFilePicker: vi.fn(),
});

describe("AiStudioShellFrame", () => {
  it("keeps the right-column shell mounted but unmounts heavy rail content when hidden", () => {
    const { container } = render(<AiStudioShellFrame {...createProps()} rightColumnHidden />);

    expect(container.querySelector(".ai-shell-right")).toBeTruthy();
    expect(screen.queryByTestId("reference-rail")).not.toBeInTheDocument();
    expect(screen.queryByTestId("preview-rail")).not.toBeInTheDocument();
  });

  it("renders rail content when the right column is visible", () => {
    render(<AiStudioShellFrame {...createProps()} rightColumnHidden={false} />);

    expect(screen.getByTestId("reference-rail")).toBeInTheDocument();
    expect(screen.getByTestId("preview-rail")).toBeInTheDocument();
  });

  it("exposes the adaptive shell layout mode on the shell boundary", () => {
    const { container } = render(
      <AiStudioShellFrame {...createProps()} shellLayoutMode="compact-split" />
    );

    expect(container.querySelector(".ai-shell")).toHaveAttribute(
      "data-shell-layout-mode",
      "compact-split"
    );
  });

  it("hides the preview rail when the shell is in expanded right-rail mode", () => {
    render(
      <AiStudioShellFrame {...createProps()} rightColumnHidden={false} showPreviewRail={false} />
    );

    expect(screen.getByTestId("reference-rail")).toBeInTheDocument();
    expect(screen.queryByTestId("preview-rail")).not.toBeInTheDocument();
  });
});
