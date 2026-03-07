import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpertEditPanelView } from "../edit/ExpertEditPanelView";
import * as InpaintMaskControllerModule from "../edit/useInpaintMaskController";

const { composePrimaryLayersToBlobMock } = vi.hoisted(() => ({
  composePrimaryLayersToBlobMock: vi.fn(async () => new Blob(["flattened"], { type: "image/png" })),
}));

vi.mock("../../logic/expertEditLayerCompose", () => ({
  composePrimaryLayersToBlob: composePrimaryLayersToBlobMock,
}));

vi.mock("next/image", () => ({
  default: (props: { alt?: string; [key: string]: unknown }) => {
    const forwarded = { ...props };
    delete forwarded.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt ?? ""} {...forwarded} />;
  },
}));

const getPrimaryFileInput = (container: HTMLElement) =>
  container.querySelectorAll('input[type="file"][accept="image/*"]')[0] as HTMLInputElement;

const uploadPrimaryFile = (container: HTMLElement, fileName: string) => {
  const file = new File(["image"], fileName, { type: "image/png" });
  fireEvent.change(getPrimaryFileInput(container), { target: { files: [file] } });
};

const createLayerDragTransfer = () =>
  ({
    effectAllowed: "move",
    dropEffect: "move",
    setData: vi.fn(),
    getData: vi.fn(() => ""),
  }) as unknown as DataTransfer;

const createImageDropTransfer = (url: string) =>
  ({
    files: [],
    types: ["text/plain"],
    setData: vi.fn(),
    getData: vi.fn((type: string) => (type === "text/plain" ? url : "")),
  }) as unknown as DataTransfer;

describe("ExpertEditPanelView", () => {
  const createObjectURLMock = vi.fn();
  const revokeObjectURLMock = vi.fn();
  let objectUrlCounter = 0;

  const baseProps: React.ComponentProps<typeof ExpertEditPanelView> = {
    expertEditEligible: true,
    aspect: "1:1",
    modelId: "fal-ai/nano-banana/edit",
    modelLabel: "Nano Banana Edit",
    referenceImageUrl: null,
    extraImageUrls: [null, null, null],
    referenceText: "",
    imageResolution: "model_default",
    aspectOptions: [
      { value: "1:1", ratioLabel: "1:1", name: "Square", orientation: "square" },
      { value: "16:9", ratioLabel: "16:9", name: "Landscape", orientation: "horizontal" },
    ],
    isModelModalOpen: false,
    modelModalAnchor: null,
    onAspectChange: vi.fn(),
    onModelPickerOpen: vi.fn(),
    onPrimaryImageChange: vi.fn(),
    onExtraImageChange: vi.fn(),
    onPromptTextChange: vi.fn(),
    onRegenerate: vi.fn(),
    onRegenerateWithReferenceInputs: vi.fn(async (referenceInputs: string[]) => {
      void referenceInputs;
    }),
    onAddSessionMediaReference: vi.fn(),
    resolvePreviewUrlById: vi.fn(() => null),
    costCredits: 5,
    isGenerateDisabled: false,
    referenceImageWarning: null,
    onImageResolutionChange: vi.fn(),
    characterOptions: [],
    selectedCharacterId: "",
    onSelectedCharacterIdChange: vi.fn(),
    isCharacterOptionsLoading: false,
    characterModeEnabled: false,
    onCharacterModeEnabledChange: vi.fn(),
  };

  beforeEach(() => {
    objectUrlCounter = 0;
    composePrimaryLayersToBlobMock.mockClear();
    createObjectURLMock.mockReset();
    revokeObjectURLMock.mockReset();
    createObjectURLMock.mockImplementation((value: unknown) => {
      if (value instanceof File) {
        objectUrlCounter += 1;
        return `blob:file-${value.name}-${objectUrlCounter}`;
      }
      objectUrlCounter += 1;
      return `blob:flatten-${objectUrlCounter}`;
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });
  });

  it("renders one primary and three secondary edit dropzones", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.getByLabelText("Primary edit image")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Styles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Background" })).toBeInTheDocument();
  });

  it("enables Remove Background only when the selected layer has an image", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} referenceImageUrl={null} />);

    expect(screen.getByRole("button", { name: "Remove Background" })).toBeDisabled();

    uploadPrimaryFile(container, "selected-layer.png");
    expect(screen.getByRole("button", { name: "Remove Background" })).not.toBeDisabled();
  });

  it("keeps Remove Background disabled when generate is globally disabled", () => {
    const { container } = render(
      <ExpertEditPanelView {...baseProps} referenceImageUrl={null} isGenerateDisabled />
    );

    uploadPrimaryFile(container, "selected-layer.png");
    expect(screen.getByRole("button", { name: "Remove Background" })).toBeDisabled();
  });

  it("keeps inline generate disabled when an image exists but prompt is empty", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} referenceImageUrl={null} />);

    uploadPrimaryFile(container, "layer-1.png");
    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it("keeps inline generate disabled when prompt exists but no primary image exists", () => {
    render(
      <ExpertEditPanelView {...baseProps} referenceImageUrl={null} referenceText="prompt text" />
    );

    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it("enables inline generate only when prompt and primary image both exist", () => {
    const { container } = render(
      <ExpertEditPanelView {...baseProps} referenceImageUrl={null} referenceText="prompt text" />
    );

    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
    uploadPrimaryFile(container, "layer-1.png");
    expect(screen.getByRole("button", { name: /generate/i })).not.toBeDisabled();
  });

  it("opens inline More Presets surface in the primary dropzone", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const trigger = screen.getByRole("button", { name: /apply more presets preset/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    const surface = screen.getByRole("region", { name: /more presets/i });
    expect(surface).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(surface).getByText("Selfie")).toBeInTheDocument();
    expect(within(surface).getByText("Enhance Realism")).toBeInTheDocument();
    expect(within(surface).getByText("Custom 1")).toBeInTheDocument();
    expect(within(surface).getByText("Custom 18")).toBeInTheDocument();
    expect(within(surface).getAllByRole("listitem")).toHaveLength(27);
    expect(screen.queryByRole("dialog", { name: /more presets/i })).not.toBeInTheDocument();
    expect(document.querySelector(".edit-expert-presets-backdrop")).not.toBeInTheDocument();
    expect(document.querySelector(".model-modal-backdrop")).not.toBeInTheDocument();
  });

  it("renders More Presets chips in a deterministic locked order", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    const surface = screen.getByRole("region", { name: /more presets/i });
    const renderedLabels = within(surface)
      .getAllByRole("listitem")
      .map((node) => node.textContent?.trim());
    const expectedLabels = [
      "Selfie",
      "Side Profile",
      "Over Shoulder",
      "From Behind",
      "Low Angle",
      "Drone View",
      "Zoom In",
      "Zoom Out",
      "Enhance Realism",
      ...Array.from({ length: 18 }, (_, index) => `Custom ${index + 1}`),
    ];

    expect(renderedLabels).toEqual(expectedLabels);
  });

  it("closes inline More Presets surface via the close button", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    fireEvent.click(screen.getByRole("button", { name: /close presets/i }));
    expect(screen.queryByRole("region", { name: /more presets/i })).not.toBeInTheDocument();
  });

  it("closes inline More Presets surface when trigger is clicked again", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const trigger = screen.getByRole("button", { name: /apply more presets preset/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("region", { name: /more presets/i })).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole("region", { name: /more presets/i })).not.toBeInTheDocument();
  });

  it("closes inline More Presets surface with Escape", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    const surface = screen.getByRole("region", { name: /more presets/i });
    fireEvent.keyDown(surface, { key: "Escape" });
    expect(screen.queryByRole("region", { name: /more presets/i })).not.toBeInTheDocument();
  });

  it("closes inline More Presets surface when clicking outside", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    expect(screen.getByRole("region", { name: /more presets/i })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("region", { name: /more presets/i })).not.toBeInTheDocument();
  });

  it("does not render chat mode toggle in expert edit", () => {
    render(<ExpertEditPanelView {...baseProps} />);
    expect(screen.queryByText("Chat Mode")).not.toBeInTheDocument();
  });

  it("switches selected inpaint mode button when clicked", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^inpaint$/i }));

    const lassoBtn = await screen.findByRole("button", { name: /lasso/i });
    const brushBtn = await screen.findByRole("button", { name: /brush/i });
    const autoBtn = await screen.findByRole("button", { name: /auto/i });

    expect(brushBtn).toHaveAttribute("aria-pressed", "true");
    expect(lassoBtn).toHaveAttribute("aria-pressed", "false");
    expect(autoBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(lassoBtn);
    expect(lassoBtn).toHaveAttribute("aria-pressed", "true");
    expect(brushBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(autoBtn);
    expect(autoBtn).toHaveAttribute("aria-pressed", "true");
    expect(lassoBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("switches selection tabs between Select and Unselect", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^inpaint$/i }));

    const selectTab = await screen.findByRole("tab", { name: /^select$/i });
    const unselectTab = await screen.findByRole("tab", { name: /^unselect$/i });

    expect(selectTab).toHaveAttribute("aria-selected", "true");
    expect(unselectTab).toHaveAttribute("aria-selected", "false");

    fireEvent.click(unselectTab);
    expect(unselectTab).toHaveAttribute("aria-selected", "true");
    expect(selectTab).toHaveAttribute("aria-selected", "false");

    fireEvent.click(selectTab);
    expect(selectTab).toHaveAttribute("aria-selected", "true");
    expect(unselectTab).toHaveAttribute("aria-selected", "false");
  });

  it("collapses and expands inpaint controls from the skinny toggle button", () => {
    vi.useFakeTimers();

    try {
      render(<ExpertEditPanelView {...baseProps} />);

      const collapseButton = screen.getByRole("button", { name: /expand inpaint controls/i });
      expect(collapseButton).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByTestId("inpaint-collapse-icon-left")).toBeInTheDocument();

      fireEvent.click(collapseButton);
      expect(screen.getByRole("button", { name: /collapse inpaint controls/i })).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      expect(screen.getByTestId("inpaint-collapse-icon-dots")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /collapse inpaint controls/i }));
      act(() => {
        vi.advanceTimersByTime(180);
      });
      expect(screen.getByRole("button", { name: /expand inpaint controls/i })).toHaveAttribute(
        "aria-expanded",
        "false"
      );
      expect(screen.getByTestId("inpaint-collapse-icon-left")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders Inpaint/Move/Crop rail buttons with Inpaint selected by default", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    const moveButton = await within(rail).findByRole("button", { name: /^move$/i });
    const inpaintButton = await within(rail).findByRole("button", { name: /^inpaint$/i });
    const cropButton = await within(rail).findByRole("button", { name: /^crop$/i });
    const railOrder = within(rail)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim()?.toLowerCase());

    expect(railOrder).toEqual(["inpaint", "move", "crop"]);
    expect(inpaintButton).toHaveAttribute("aria-pressed", "true");
    expect(moveButton).toHaveAttribute("aria-pressed", "false");
    expect(cropButton).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles selected tool state between Move/Inpaint/Crop rail buttons", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    const moveButton = await within(rail).findByRole("button", { name: /^move$/i });
    const inpaintButton = await within(rail).findByRole("button", { name: /^inpaint$/i });
    const cropButton = await within(rail).findByRole("button", { name: /^crop$/i });
    expect(inpaintButton).toHaveAttribute("aria-pressed", "true");
    expect(moveButton).toHaveAttribute("aria-pressed", "false");
    expect(cropButton).toHaveAttribute("aria-pressed", "false");
    const inpaintSettingsPanel = screen.getByRole("group", { name: /inpaint tools/i });
    expect(inpaintSettingsPanel).toHaveClass("is-themed-inpaint");

    fireEvent.click(moveButton);
    expect(moveButton).toHaveAttribute("aria-pressed", "true");
    expect(inpaintButton).toHaveAttribute("aria-pressed", "false");
    expect(cropButton).toHaveAttribute("aria-pressed", "false");
    const moveSettingsPanel = screen.getByRole("group", { name: /move tools/i });
    expect(moveSettingsPanel).toHaveClass("is-themed-move");
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /^resize$/i })
    ).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /^rotate$/i })
    ).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("slider", { name: /zoom image/i })
    ).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /undo move action/i })
    ).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /redo move action/i })
    ).toBeInTheDocument();

    fireEvent.click(cropButton);
    expect(cropButton).toHaveAttribute("aria-pressed", "true");
    expect(moveButton).toHaveAttribute("aria-pressed", "false");
    expect(inpaintButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: /^brush$/i })).not.toBeInTheDocument();

    const cropSettingsPanel = screen.getByRole("group", { name: /crop tools/i });
    const cropPanelButtons = within(cropSettingsPanel).getAllByRole("button");
    const landscapeChip = within(cropSettingsPanel).getByRole("button", {
      name: /16:9\s*landscape/i,
    });

    expect(cropSettingsPanel).toHaveClass("is-themed-crop");
    expect(cropPanelButtons).toHaveLength(6);
    expect(within(cropSettingsPanel).getByText("9:16")).toBeInTheDocument();
    expect(within(cropSettingsPanel).getByText("5:4")).toBeInTheDocument();
    expect(
      within(cropSettingsPanel).getByRole("button", { name: /apply crop/i })
    ).toBeInTheDocument();

    fireEvent.click(landscapeChip);
    expect(landscapeChip).toHaveAttribute("aria-pressed", "true");
  });

  it("resets move zoom slider to default on double click", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    const slider = screen.getByRole("slider", { name: /zoom image/i });
    fireEvent.change(slider, { target: { value: "170" } });
    expect(slider).toHaveValue("170");

    fireEvent.doubleClick(slider);
    expect(slider).toHaveValue("125");
  });

  it("resets inpaint stroke slider to default on double click", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^inpaint$/i }));

    const slider = screen.getByRole("slider", { name: /stroke size/i });
    fireEvent.change(slider, { target: { value: "78" } });
    expect(slider).toHaveValue("78");

    fireEvent.doubleClick(slider);
    expect(slider).toHaveValue("26");
  });

  it("shows brush and lasso cursors only for active inpaint modes when selected layer has an image", async () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} referenceImageUrl={null} />);
    const primaryDropzone = screen.getByLabelText("Primary edit image");

    expect(primaryDropzone).toHaveStyle({ cursor: "" });

    uploadPrimaryFile(container, "reticle-target.png");
    const brushCursor = primaryDropzone.style.cursor;
    expect(brushCursor).toContain("data:image/svg+xml");
    expect(brushCursor).toContain("crosshair");

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));
    expect(primaryDropzone).toHaveStyle({ cursor: "" });

    fireEvent.click(await within(rail).findByRole("button", { name: /^inpaint$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^lasso$/i }));
    const lassoCursor = primaryDropzone.style.cursor;
    expect(lassoCursor).toContain("data:image/svg+xml");
    expect(lassoCursor).toContain("crosshair");
    expect(lassoCursor).not.toEqual(brushCursor);

    fireEvent.click(screen.getByRole("button", { name: /^brush$/i }));
    expect(primaryDropzone.style.cursor).toContain("data:image/svg+xml");
    expect(primaryDropzone.style.cursor).toContain("crosshair");
  });

  it("suppresses inpaint cursor while presets surface is open and restores it on close", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/reticle-source.png"
      />
    );
    const primaryDropzone = screen.getByLabelText("Primary edit image");
    expect(primaryDropzone.style.cursor).toContain("data:image/svg+xml");
    expect(primaryDropzone.style.cursor).toContain("crosshair");

    const trigger = screen.getByRole("button", { name: /apply more presets preset/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("region", { name: /more presets/i })).toBeInTheDocument();
    expect(primaryDropzone).toHaveStyle({ cursor: "" });

    fireEvent.click(trigger);
    expect(screen.queryByRole("region", { name: /more presets/i })).not.toBeInTheDocument();
    expect(primaryDropzone.style.cursor).toContain("data:image/svg+xml");
    expect(primaryDropzone.style.cursor).toContain("crosshair");
  });

  it("does not show lasso cursor when selected layer has no image", async () => {
    render(<ExpertEditPanelView {...baseProps} referenceImageUrl={null} />);

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^inpaint$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^lasso$/i }));

    const primaryDropzone = screen.getByLabelText("Primary edit image");
    expect(primaryDropzone).toHaveStyle({ cursor: "" });
  });

  it("shows a toast when drawing is attempted without a selected layer image", () => {
    render(<ExpertEditPanelView {...baseProps} referenceImageUrl={null} />);
    const primaryDropzone = screen.getByLabelText("Primary edit image");
    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    expect(screen.getByText("Select a layer image before drawing.")).toBeInTheDocument();
  });

  it("updates inpaint brush reticle size as stroke slider changes", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/reticle-source.png"
      />
    );
    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const initialCursor = primaryDropzone.style.cursor;
    expect(initialCursor).toContain("data:image/svg+xml");

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^inpaint$/i }));
    const slider = screen.getByRole("slider", { name: /stroke size/i });

    fireEvent.change(slider, { target: { value: "90" } });
    const largerCursor = primaryDropzone.style.cursor;
    expect(largerCursor).toContain("data:image/svg+xml");
    expect(largerCursor).not.toEqual(initialCursor);
  });

  it("routes edge-of-dropzone pointer events to inpaint handlers", () => {
    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();
    const onPointerCancel = vi.fn();
    const onPointerLeave = vi.fn();
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        hasSelectedLayerMask: false,
        imageHasInteractiveMask: true,
        clearSelectedLayerMask: vi.fn(),
        invertSelectedLayerMask: vi.fn(),
        exportSelectedLayerMaskBlob: vi.fn(async () => null),
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onPointerLeave,
      });
    try {
      render(
        <ExpertEditPanelView
          {...baseProps}
          referenceImageUrl="https://example.com/primary-image.png"
          referenceText="prompt text"
        />
      );
      const primaryDropzone = screen.getByLabelText("Primary edit image");
      fireEvent.pointerDown(primaryDropzone, {
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        clientX: 1,
        clientY: 1,
      });
      fireEvent.pointerMove(primaryDropzone, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 2,
        clientY: 2,
      });
      fireEvent.pointerUp(primaryDropzone, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 2,
        clientY: 2,
      });
      expect(onPointerDown).toHaveBeenCalledTimes(1);
      expect(onPointerMove).toHaveBeenCalledTimes(1);
      expect(onPointerUp).toHaveBeenCalledTimes(1);
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
    }
  });

  it("suppresses inpaint pointer handlers while presets surface is open", () => {
    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();
    const onPointerCancel = vi.fn();
    const onPointerLeave = vi.fn();
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        hasSelectedLayerMask: false,
        imageHasInteractiveMask: true,
        clearSelectedLayerMask: vi.fn(),
        invertSelectedLayerMask: vi.fn(),
        exportSelectedLayerMaskBlob: vi.fn(async () => null),
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onPointerLeave,
      });
    try {
      render(
        <ExpertEditPanelView
          {...baseProps}
          referenceImageUrl="https://example.com/primary-image.png"
          referenceText="prompt text"
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
      const primaryDropzone = screen.getByLabelText("Primary edit image");
      fireEvent.pointerDown(primaryDropzone, {
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        clientX: 1,
        clientY: 1,
      });
      expect(onPointerDown).not.toHaveBeenCalled();
      expect(onPointerCancel).not.toHaveBeenCalled();
      expect(onPointerLeave).not.toHaveBeenCalled();
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
    }
  });

  it("suppresses dropzone upload click while presets surface is open", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);
    const primaryInput = getPrimaryFileInput(container);
    const inputClickSpy = vi.spyOn(primaryInput, "click");

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    fireEvent.click(screen.getByLabelText("Primary edit image"));

    expect(inputClickSpy).not.toHaveBeenCalled();
  });

  it("suppresses primary drag/drop ingest while presets surface is open", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/existing-primary.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const transfer = createImageDropTransfer("https://example.com/new-drop-image.png");
    fireEvent.dragEnter(primaryDropzone, { dataTransfer: transfer });
    fireEvent.dragOver(primaryDropzone, { dataTransfer: transfer });
    fireEvent.drop(primaryDropzone, { dataTransfer: transfer });

    expect(primaryDropzone).not.toHaveClass("is-dragging");
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();
  });

  it("adds new layers in sequential order when add layer is clicked", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.getByRole("button", { name: "layer 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add layer/i }));
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add layer/i }));
    expect(screen.getByRole("button", { name: "layer 3" })).toBeInTheDocument();
  });

  it("fills the selected empty layer when an image is added", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /add layer/i }));
    const layerTwoButton = screen.getByRole("button", { name: "layer 2" });
    expect(layerTwoButton).toHaveClass("is-selected");

    uploadPrimaryFile(container, "fill-layer-2.png");
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "layer 3" })).not.toBeInTheDocument();
  });

  it("allows dragging layers to reorder the vertical stack", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");
    uploadPrimaryFile(container, "layer-3.png");

    const rowForLayerThree = screen
      .getByRole("button", { name: "layer 3" })
      .closest(".edit-expert-layer-row") as HTMLElement;
    const rowForLayerOne = screen
      .getByRole("button", { name: "layer 1" })
      .closest(".edit-expert-layer-row") as HTMLElement;
    const transfer = createLayerDragTransfer();

    fireEvent.dragStart(rowForLayerThree, { dataTransfer: transfer });
    fireEvent.dragOver(rowForLayerOne, { dataTransfer: transfer });
    fireEvent.drop(rowForLayerOne, { dataTransfer: transfer });

    const labels = Array.from(
      container.querySelectorAll(".edit-expert-layer-row .edit-expert-layer-label")
    ).map((node) => node.textContent?.trim());

    expect(labels.slice(0, 3)).toEqual(["layer 3", "layer 1", "layer 2"]);
  });

  it("maps reordered layer stack to primary canvas z-order", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");
    uploadPrimaryFile(container, "layer-3.png");

    const rowForLayerThree = screen
      .getByRole("button", { name: "layer 3" })
      .closest(".edit-expert-layer-row") as HTMLElement;
    const rowForLayerOne = screen
      .getByRole("button", { name: "layer 1" })
      .closest(".edit-expert-layer-row") as HTMLElement;
    const transfer = createLayerDragTransfer();

    fireEvent.dragStart(rowForLayerThree, { dataTransfer: transfer });
    fireEvent.dragOver(rowForLayerOne, { dataTransfer: transfer });
    fireEvent.drop(rowForLayerOne, { dataTransfer: transfer });

    const frames = Array.from(
      container.querySelectorAll(".edit-expert-primary-layer-frame")
    ) as HTMLElement[];
    const layerThreeFrame = frames.find((frame) =>
      frame.style.backgroundImage.includes("layer-3.png")
    );
    const layerOneFrame = frames.find((frame) =>
      frame.style.backgroundImage.includes("layer-1.png")
    );
    const layerTwoFrame = frames.find((frame) =>
      frame.style.backgroundImage.includes("layer-2.png")
    );

    expect(layerThreeFrame).toBeDefined();
    expect(layerOneFrame).toBeDefined();
    expect(layerTwoFrame).toBeDefined();
    expect(Number(layerThreeFrame?.style.zIndex ?? 0)).toBeGreaterThan(
      Number(layerOneFrame?.style.zIndex ?? 0)
    );
    expect(Number(layerOneFrame?.style.zIndex ?? 0)).toBeGreaterThan(
      Number(layerTwoFrame?.style.zIndex ?? 0)
    );
  });

  it("uses reordered layer order when flattening for generate", async () => {
    const { container } = render(
      <ExpertEditPanelView {...baseProps} referenceText="prompt text" />
    );

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");
    uploadPrimaryFile(container, "layer-3.png");

    const rowForLayerThree = screen
      .getByRole("button", { name: "layer 3" })
      .closest(".edit-expert-layer-row") as HTMLElement;
    const rowForLayerOne = screen
      .getByRole("button", { name: "layer 1" })
      .closest(".edit-expert-layer-row") as HTMLElement;
    const transfer = createLayerDragTransfer();

    fireEvent.dragStart(rowForLayerThree, { dataTransfer: transfer });
    fireEvent.dragOver(rowForLayerOne, { dataTransfer: transfer });
    fireEvent.drop(rowForLayerOne, { dataTransfer: transfer });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /generate/i }));
      await Promise.resolve();
    });

    expect(composePrimaryLayersToBlobMock).toHaveBeenCalled();
    const composeCalls = composePrimaryLayersToBlobMock.mock.calls as unknown as Array<
      [
        Array<{
          imageUrl: string | null;
        }>,
      ]
    >;
    const composedLayers = composeCalls.at(-1)?.[0];
    expect(composedLayers).toBeDefined();
    expect(composedLayers?.length).toBeGreaterThanOrEqual(3);
    expect(composedLayers?.[0]?.imageUrl).toContain("layer-3.png");
    expect(composedLayers?.[1]?.imageUrl).toContain("layer-1.png");
    expect(composedLayers?.[2]?.imageUrl).toContain("layer-2.png");
  });

  it("appends a new layer when selected layer already has an image", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "layer-1.png");
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();

    uploadPrimaryFile(container, "layer-2.png");
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "layer 2" })).toHaveClass("is-selected");
  });

  it("shows a toast and blocks creation when an 11th layer is attempted by primary drop/file add", () => {
    vi.useFakeTimers();

    try {
      const { container } = render(<ExpertEditPanelView {...baseProps} />);

      for (let index = 1; index <= 10; index += 1) {
        uploadPrimaryFile(container, `layer-${index}.png`);
      }
      expect(screen.getByRole("button", { name: "layer 10" })).toBeInTheDocument();

      uploadPrimaryFile(container, "layer-11.png");
      expect(screen.queryByRole("button", { name: "layer 11" })).not.toBeInTheDocument();
      expect(screen.getByText("Layer limit reached (10).")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1_400);
      });
      expect(screen.queryByText("Layer limit reached (10).")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not render the primary dropzone clear button", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/already-loaded-primary.png"
      />
    );

    expect(screen.queryByRole("button", { name: /remove primary image/i })).not.toBeInTheDocument();
  });

  it("manual flatten collapses to layer 1 and emits a session media reference", async () => {
    const onAddSessionMediaReference = vi.fn();
    const { container } = render(
      <ExpertEditPanelView {...baseProps} onAddSessionMediaReference={onAddSessionMediaReference} />
    );

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Flatten Image" }));
      await Promise.resolve();
    });

    expect(composePrimaryLayersToBlobMock).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "layer 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();
    expect(onAddSessionMediaReference).toHaveBeenCalledWith({
      url: expect.stringMatching(/^blob:flatten-/),
      mimeType: "image/png",
    });
  });

  it("auto-flattens on generate and forwards flattened refs with primary first", async () => {
    const onRegenerateWithReferenceInputs = vi.fn(async (referenceInputs: string[]) => {
      void referenceInputs;
    });
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="prompt text"
        extraImageUrls={["https://example.com/extra.png", null, null]}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /generate/i }));
      await Promise.resolve();
    });

    expect(composePrimaryLayersToBlobMock).toHaveBeenCalled();
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    const referenceInputs = onRegenerateWithReferenceInputs.mock.calls[0]?.[0];
    if (!referenceInputs) {
      throw new Error("Expected flattened reference inputs.");
    }
    expect(referenceInputs[0]).toMatch(/^blob:flatten-/);
    expect(referenceInputs).toContain("https://example.com/extra.png");
  });

  it("auto-flattens on remove background and submits Bria model override", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
    });
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        extraImageUrls={["https://example.com/extra.png", null, null]}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Background" }));
      await Promise.resolve();
    });

    expect(composePrimaryLayersToBlobMock).toHaveBeenCalled();
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    const [referenceInputs, options] = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: { calls: Array<[string[], { modelIdOverride?: string | null }?]> };
      }
    ).mock.calls[0] ?? [[], undefined];
    expect(referenceInputs?.[0]).toMatch(/^blob:flatten-/);
    expect(referenceInputs).toContain("https://example.com/extra.png");
    expect(options).toEqual(
      expect.objectContaining({ modelIdOverride: "fal-ai/bria/background/remove" })
    );
  });

  it("submits FLUX Fill override with base and mask urls when a mask is present", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
    });
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        hasSelectedLayerMask: true,
        imageHasInteractiveMask: true,
        clearSelectedLayerMask: vi.fn(),
        invertSelectedLayerMask: vi.fn(),
        exportSelectedLayerMaskBlob: vi.fn(async () => new Blob(["mask"], { type: "image/png" })),
        onPointerDown: vi.fn(),
        onPointerMove: vi.fn(),
        onPointerUp: vi.fn(),
        onPointerCancel: vi.fn(),
        onPointerLeave: vi.fn(),
      });
    const previousImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 640;
      naturalHeight = 640;

      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    try {
      const { container } = render(
        <ExpertEditPanelView
          {...baseProps}
          referenceText="prompt text"
          onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
        />
      );
      uploadPrimaryFile(container, "layer-1.png");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /generate/i }));
        await Promise.resolve();
      });

      expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
      const inpaintOptions = (
        onRegenerateWithReferenceInputs as unknown as {
          mock: { calls: Array<[string[], { inpaintOverride?: unknown }?]> };
        }
      ).mock.calls[0]?.[1];
      expect(inpaintOptions?.inpaintOverride).toEqual({
        modelId: "fal-ai/flux-pro/v1/fill",
        baseImageInput: expect.stringMatching(/^blob:flatten-/),
        maskInput: expect.stringMatching(/^blob:flatten-/),
        outputFormat: "png",
      });
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: previousImage,
      });
    }
  });
});
