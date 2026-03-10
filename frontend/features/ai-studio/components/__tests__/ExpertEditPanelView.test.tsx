import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPOSITE_REGENERATE_COHESION_PROMPT,
  ExpertEditPanelView,
} from "../edit/ExpertEditPanelView";
import {
  EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS,
  EDIT_PRESET_SURFACE_PRESET_IDS,
  EDIT_PRESET_PANEL_MAX,
  EXPERT_EDIT_PRESET_DRAG_MIME,
  resolveExpertEditPresetLabelById,
  resolveExpertEditPresetPromptById,
  serializeExpertEditPresetDragPayload,
  type ExpertEditPresetDragPayload,
  type ExpertEditPresetId,
} from "../edit/expertEditPresets";
import {
  INPAINT_FLUX_FILL_MODEL_ID,
  INPAINT_FLUX_FILL_MODEL_LABEL,
} from "../../logic/inpaintSubmission";
import * as InpaintMaskControllerModule from "../edit/useInpaintMaskController";

const {
  composePrimaryLayersToBlobMock,
  composePrimaryStageLayersToBlobMock,
  composeExpertEditLayerCropToBlobMock,
} = vi.hoisted(() => ({
  composePrimaryLayersToBlobMock: vi.fn(async () => new Blob(["flattened"], { type: "image/png" })),
  composePrimaryStageLayersToBlobMock: vi.fn(
    async () => new Blob(["flattened-stage"], { type: "image/png" })
  ),
  composeExpertEditLayerCropToBlobMock: vi.fn(
    async () => new Blob(["cropped-stage"], { type: "image/png" })
  ),
}));

vi.mock("../../logic/expertEditLayerCompose", () => ({
  composePrimaryLayersToBlob: composePrimaryLayersToBlobMock,
}));

vi.mock("../../logic/expertEditStageFlatten", () => ({
  composePrimaryStageLayersToBlob: composePrimaryStageLayersToBlobMock,
}));

vi.mock("../../logic/expertEditLayerCrop", async () => {
  const actual = await vi.importActual("../../logic/expertEditLayerCrop");
  return {
    ...(actual as Record<string, unknown>),
    composeExpertEditLayerCropToBlob: composeExpertEditLayerCropToBlobMock,
  };
});

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

const createReferenceImageDropTransfer = ({
  url,
  referenceId,
}: {
  url: string;
  referenceId: string;
}) =>
  ({
    files: [],
    types: ["text/reference-url", "text/reference-id"],
    setData: vi.fn(),
    getData: vi.fn((type: string) => {
      if (type === "text/reference-url") return url;
      if (type === "text/reference-id") return referenceId;
      return "";
    }),
  }) as unknown as DataTransfer;

const createPresetDragTransfer = (payload?: ExpertEditPresetDragPayload) => {
  const store: Record<string, string> = {};
  if (payload) {
    store[EXPERT_EDIT_PRESET_DRAG_MIME] = serializeExpertEditPresetDragPayload(payload);
    store["text/plain"] = payload.presetId;
  }
  return {
    effectAllowed: "move",
    dropEffect: "move",
    setData: vi.fn((type: string, value: string) => {
      store[type] = value;
    }),
    getData: vi.fn((type: string) => store[type] ?? ""),
  } as unknown as DataTransfer;
};

const createPresetDragTransferWithoutReadableData = () =>
  ({
    effectAllowed: "move",
    dropEffect: "move",
    setData: vi.fn(),
    getData: vi.fn(() => ""),
    setDragImage: vi.fn(),
  }) as unknown as DataTransfer;

const createPromptTokenTransfer = () => {
  const store: Record<string, string> = {};
  return {
    effectAllowed: "copy",
    dropEffect: "copy",
    setData: vi.fn((type: string, value: string) => {
      store[type] = value;
    }),
    getData: vi.fn((type: string) => store[type] ?? ""),
    types: [],
  } as unknown as DataTransfer;
};

const readFrameScale = (frame: HTMLDivElement) =>
  Number(frame.style.transform.match(/scale\(([^)]+)\)/)?.[1] ?? "0");

const readFrameTranslate = (frame: HTMLDivElement) => {
  const match = frame.style.transform.match(/translate\(([-\d.]+)%\s*,\s*([-\d.]+)%\)/);
  return {
    x: Number(match?.[1] ?? "0"),
    y: Number(match?.[2] ?? "0"),
  };
};

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
    isStylesPanelOpen: false,
    onStylesPanelToggle: vi.fn(),
    selectedStyleId: null,
  };

  beforeEach(() => {
    objectUrlCounter = 0;
    composePrimaryLayersToBlobMock.mockClear();
    composePrimaryStageLayersToBlobMock.mockClear();
    composeExpertEditLayerCropToBlobMock.mockClear();
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
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
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

  it("updates primary dropzone aspect ratio from the edit aspect selector value", () => {
    const { container, rerender } = render(<ExpertEditPanelView {...baseProps} aspect="1:1" />);
    const primaryDropzone = screen.getByLabelText("Primary edit image") as HTMLDivElement;
    const mainStage = container.querySelector(".edit-expert-main-stage") as HTMLDivElement;
    expect(mainStage).not.toBeNull();

    expect(primaryDropzone.style.aspectRatio).toBe("1 / 1");
    expect(primaryDropzone.style.width).toBe("100%");
    expect(primaryDropzone.style.height).toBe("");
    expect(mainStage.style.width).toContain("* 1");
    expect(mainStage.style.height).toBe("var(--edit-expert-primary-size)");

    rerender(<ExpertEditPanelView {...baseProps} aspect="16:9" />);
    expect(primaryDropzone.style.aspectRatio).toBe("16 / 9");
    expect(primaryDropzone.style.width).toBe("100%");
    expect(primaryDropzone.style.height).toBe("");
    expect(mainStage.style.width).toContain("* 1.777777");

    rerender(<ExpertEditPanelView {...baseProps} aspect="9:16" />);
    expect(primaryDropzone.style.aspectRatio).toBe("9 / 16");
    expect(primaryDropzone.style.width).toBe("100%");
    expect(primaryDropzone.style.height).toBe("");
    expect(mainStage.style.width).toContain("* 0.5625");
  });

  it("toggles styles panel via callback and reflects aria-expanded state", () => {
    const onStylesPanelToggle = vi.fn();
    const { rerender } = render(
      <ExpertEditPanelView
        {...baseProps}
        isStylesPanelOpen={false}
        onStylesPanelToggle={onStylesPanelToggle}
      />
    );

    const stylesButton = screen.getByRole("button", { name: "Styles" });
    expect(stylesButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(stylesButton);
    expect(onStylesPanelToggle).toHaveBeenCalledTimes(1);

    rerender(
      <ExpertEditPanelView
        {...baseProps}
        isStylesPanelOpen
        onStylesPanelToggle={onStylesPanelToggle}
      />
    );
    const openStylesButton = screen.getByRole("button", { name: "Styles" });
    expect(openStylesButton).toHaveAttribute("aria-expanded", "true");
    expect(openStylesButton).toHaveClass("is-open");
    expect(openStylesButton.closest(".edit-expert-styles-wrapper")).toHaveClass("is-open");
  });

  it("shows selected style preview filling the styles button", () => {
    render(<ExpertEditPanelView {...baseProps} selectedStyleId="cinematic" />);

    const stylesButton = screen.getByRole("button", { name: "Styles" });
    const preview = stylesButton.querySelector(
      ".edit-expert-styles-btn-preview"
    ) as HTMLSpanElement | null;
    expect(preview).toBeTruthy();
    expect(stylesButton).toHaveClass("has-selected-style");
    expect(preview?.style.backgroundImage).toContain("/Styles/Cinematic.png");
  });

  it("does not render a clear-style hover button in expert edit styles control", () => {
    render(<ExpertEditPanelView {...baseProps} selectedStyleId="cinematic" />);

    expect(screen.queryByRole("button", { name: "Clear selected style" })).not.toBeInTheDocument();
  });

  it("keeps existing expert edit interactions available with styles panel wiring", () => {
    render(<ExpertEditPanelView {...baseProps} isStylesPanelOpen />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    expect(screen.getByRole("region", { name: /more presets/i })).toBeInTheDocument();
  });

  it("enables Remove Background only when the selected layer has an image", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} referenceImageUrl={null} />);

    expect(screen.getByRole("button", { name: "Remove Background" })).toBeDisabled();

    uploadPrimaryFile(container, "selected-layer.png");
    expect(screen.getByRole("button", { name: "Remove Background" })).not.toBeDisabled();
  });

  it("disables flatten action until at least one layer image exists", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} referenceImageUrl={null} />);

    const flattenButton = screen.getByRole("button", { name: /flatten layers/i });
    expect(flattenButton).toBeDisabled();

    uploadPrimaryFile(container, "layer-1.png");
    expect(flattenButton).not.toBeDisabled();
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
    expect(screen.getByRole("button", { name: /^generate$/i })).toBeDisabled();
  });

  it("keeps inline generate disabled when prompt exists but no primary image exists", () => {
    render(
      <ExpertEditPanelView {...baseProps} referenceImageUrl={null} referenceText="prompt text" />
    );

    expect(screen.getByRole("button", { name: /^generate$/i })).toBeDisabled();
  });

  it("enables inline generate only when prompt and primary image both exist", () => {
    const { container } = render(
      <ExpertEditPanelView {...baseProps} referenceImageUrl={null} referenceText="prompt text" />
    );

    expect(screen.getByRole("button", { name: /^generate$/i })).toBeDisabled();
    uploadPrimaryFile(container, "layer-1.png");
    expect(screen.getByRole("button", { name: /^generate$/i })).not.toBeDisabled();
  });

  it("highlights valid @img tokens in the expert prompt input mirror", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Use @img1 in the background."
        extraImageUrls={["https://example.com/slot-1.png", null, null]}
      />
    );

    const tokenNode = document.querySelector(
      ".edit-expert-prompt-highlight-segment.is-valid-token"
    );
    expect(tokenNode).toBeTruthy();
    expect(tokenNode?.textContent).toBe("@img1");
  });

  it("defers invalid @img validation feedback until generate is attempted", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Use @img2 for the hair style."
        extraImageUrls={["https://example.com/slot-1.png", null, null]}
      />
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("blocks inline generate when prompt contains invalid @img references", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
    });
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Use @img2 for the hair style."
        extraImageUrls={["https://example.com/slot-1.png", null, null]}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    uploadPrimaryFile(container, "layer-1.png");
    expect(screen.queryByRole("alert")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(onRegenerateWithReferenceInputs).not.toHaveBeenCalled();
    expect(composePrimaryLayersToBlobMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("slot 2");
  });

  it("inserts @img token text at caret when dragging a populated secondary slot into prompt", () => {
    const onPromptTextChange = vi.fn();
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Blend scene"
        extraImageUrls={["https://example.com/slot-1.png", null, null]}
        onPromptTextChange={onPromptTextChange}
      />
    );

    const promptInput = screen.getByLabelText("Edit prompt") as HTMLTextAreaElement;
    promptInput.focus();
    promptInput.setSelectionRange(5, 5);
    const secondarySlot = screen.getByLabelText("Secondary edit image 1");
    const transfer = createPromptTokenTransfer();

    fireEvent.dragStart(secondarySlot, { dataTransfer: transfer });
    fireEvent.drop(promptInput, { dataTransfer: transfer });

    expect(onPromptTextChange).toHaveBeenCalledWith("Blend @img1 scene");
  });

  it("opens inline More Presets surface in the primary dropzone", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const trigger = screen.getByRole("button", { name: /apply more presets preset/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    const surface = screen.getByRole("region", { name: /more presets/i });
    expect(surface).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(surface).queryByText("Selfie")).not.toBeInTheDocument();
    expect(within(surface).queryByText("Enhance Realism")).not.toBeInTheDocument();
    expect(within(surface).getByText("Over Shoulder")).toBeInTheDocument();
    expect(within(surface).getByText("Custom 1")).toBeInTheDocument();
    expect(within(surface).getByText("Custom 3")).toBeInTheDocument();
    expect(within(surface).queryByText("Custom 4")).not.toBeInTheDocument();
    expect(within(surface).getAllByRole("listitem")).toHaveLength(
      EDIT_PRESET_SURFACE_PRESET_IDS.length - EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS.length
    );
    expect(screen.queryByRole("dialog", { name: /more presets/i })).not.toBeInTheDocument();
    expect(document.querySelector(".edit-expert-presets-backdrop")).not.toBeInTheDocument();
    expect(document.querySelector(".model-modal-backdrop")).not.toBeInTheDocument();
  });

  it("shows the updated drag-drop helper copy in the presets surface", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    expect(
      screen.getByText("← Drag & drop presets into the preset panel to customize your workflow.")
    ).toBeInTheDocument();
  });

  it("renders edit buttons for custom chips only", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    expect(screen.getByRole("button", { name: /edit custom 1 preset/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit selfie preset/i })).not.toBeInTheDocument();
  });

  it("saves custom preset edits and applies edited prompt text from panel click", () => {
    const onPromptTextChange = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onPromptTextChange={onPromptTextChange} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit custom 2 preset/i }));

    expect(screen.getByRole("dialog", { name: /edit custom preset/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/preset name/i), {
      target: { value: "Pose Study" },
    });
    fireEvent.change(screen.getByLabelText(/preset prompt/i), {
      target: { value: "Use the edited prompt from custom preset two." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(screen.queryByRole("dialog", { name: /edit custom preset/i })).not.toBeInTheDocument();

    const panelList = screen.getByLabelText("Preset panel list");
    const transfer = createPresetDragTransfer({ presetId: "custom_2", source: "surface" });
    fireEvent.dragOver(panelList, { dataTransfer: transfer });
    fireEvent.drop(panelList, { dataTransfer: transfer });

    const panelPreset = screen.getByRole("button", { name: /apply pose study preset/i });
    fireEvent.click(panelPreset);
    expect(onPromptTextChange).toHaveBeenCalledWith(
      "Use the edited prompt from custom preset two."
    );
  });

  it("closes custom editor on Escape without closing presets surface", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit custom 1 preset/i }));
    const surface = screen.getByRole("region", { name: /more presets/i });
    expect(screen.getByRole("dialog", { name: /edit custom preset/i })).toBeInTheDocument();

    fireEvent.keyDown(surface, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: /edit custom preset/i })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /more presets/i })).toBeInTheDocument();
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
      ...Array.from({ length: 3 }, (_, index) => `Custom ${index + 1}`),
    ].filter((label) => !["Selfie", "Side Profile", "Enhance Realism"].includes(label));

    expect(renderedLabels).toEqual(expectedLabels);
  });

  it("starts with seeded default presets in the panel", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.getByRole("button", { name: /apply selfie preset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply side profile preset/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /apply enhance realism preset/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Empty preset drop target")).not.toBeInTheDocument();
  });

  it("uses controlled preset ids when provided and emits canonical updates on drop", () => {
    const onSelectedPresetIdsChange = vi.fn();
    render(
      <ExpertEditPanelView
        {...baseProps}
        selectedPresetIds={["custom_1"]}
        onSelectedPresetIdsChange={onSelectedPresetIdsChange}
      />
    );

    expect(screen.getByRole("button", { name: /apply custom 1 preset/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply selfie preset/i })).not.toBeInTheDocument();

    const panelList = screen.getByLabelText("Preset panel list");
    const transfer = createPresetDragTransfer({ presetId: "selfie", source: "surface" });
    fireEvent.dragOver(panelList, { dataTransfer: transfer });
    fireEvent.drop(panelList, { dataTransfer: transfer });

    expect(onSelectedPresetIdsChange).toHaveBeenCalledWith(["selfie", "custom_1"]);
  });

  it("shows empty drop target after removing all seeded presets and opens More Presets when clicked", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    const surface = screen.getByRole("region", { name: /more presets/i });

    EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS.forEach((presetId) => {
      const transfer = createPresetDragTransfer({ presetId, source: "panel" });
      const expectedLabel = resolveExpertEditPresetLabelById(presetId);
      const panelChip = screen.getByRole("button", {
        name: new RegExp(`apply ${expectedLabel} preset`, "i"),
      });
      fireEvent.dragStart(panelChip, { dataTransfer: transfer });
      fireEvent.dragOver(surface, { dataTransfer: transfer });
      fireEvent.drop(surface, { dataTransfer: transfer });
      fireEvent.dragEnd(panelChip, { dataTransfer: transfer });
    });

    const emptyDropTarget = screen.getByLabelText("Empty preset drop target");
    fireEvent.click(screen.getByRole("button", { name: /close presets/i }));
    expect(screen.queryByRole("region", { name: /more presets/i })).not.toBeInTheDocument();

    fireEvent.click(emptyDropTarget);
    expect(screen.getByRole("region", { name: /more presets/i })).toBeInTheDocument();
  });

  it("adds a preset by dragging from More Presets into the preset panel", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    const surface = screen.getByRole("region", { name: /more presets/i });
    const customOneChip = within(surface)
      .getByText("Custom 1")
      .closest("button") as HTMLButtonElement;
    const panelList = screen.getByLabelText("Preset panel list");
    const transfer = createPresetDragTransfer();

    fireEvent.dragStart(customOneChip, { dataTransfer: transfer });
    fireEvent.dragOver(panelList, { dataTransfer: transfer });
    fireEvent.drop(panelList, { dataTransfer: transfer });
    fireEvent.dragEnd(customOneChip, { dataTransfer: transfer });

    expect(screen.getByRole("button", { name: /apply custom 1 preset/i })).toBeInTheDocument();
    expect(within(surface).queryByText("Custom 1")).not.toBeInTheDocument();
  });

  it("adds a preset when dragover transfer data is unreadable", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    const surface = screen.getByRole("region", { name: /more presets/i });
    const customOneChip = within(surface)
      .getByText("Custom 1")
      .closest("button") as HTMLButtonElement;
    const panelList = screen.getByLabelText("Preset panel list");
    const transfer = createPresetDragTransferWithoutReadableData();

    fireEvent.dragStart(customOneChip, { dataTransfer: transfer });
    fireEvent.dragOver(panelList, { dataTransfer: transfer });
    fireEvent.drop(panelList, { dataTransfer: transfer });
    fireEvent.dragEnd(customOneChip, { dataTransfer: transfer });

    expect(screen.getByRole("button", { name: /apply custom 1 preset/i })).toBeInTheDocument();
  });

  it("inserts mapped prompt text when clicking a selected panel preset", () => {
    const onPromptTextChange = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onPromptTextChange={onPromptTextChange} />);

    fireEvent.click(screen.getByRole("button", { name: /apply selfie preset/i }));

    expect(onPromptTextChange).toHaveBeenCalledWith(resolveExpertEditPresetPromptById("selfie"));
  });

  it("inserts mapped prompt text when clicking a selected custom panel preset", () => {
    const onPromptTextChange = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onPromptTextChange={onPromptTextChange} />);

    const panelList = screen.getByLabelText("Preset panel list");
    const transfer = createPresetDragTransfer({ presetId: "custom_3", source: "surface" });
    fireEvent.dragOver(panelList, { dataTransfer: transfer });
    fireEvent.drop(panelList, { dataTransfer: transfer });

    fireEvent.click(screen.getByRole("button", { name: /apply custom 3 preset/i }));

    expect(onPromptTextChange).toHaveBeenCalledWith(resolveExpertEditPresetPromptById("custom_3"));
  });

  it("hides the Composite & Generate preset button", () => {
    render(<ExpertEditPanelView {...baseProps} />);
    expect(
      screen.queryByRole("button", { name: /apply composite & generate preset/i })
    ).not.toBeInTheDocument();
  });

  it("inserts the cohesion prompt when clicking Composite & Regenerate", () => {
    const onPromptTextChange = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onPromptTextChange={onPromptTextChange} />);

    fireEvent.click(screen.getByRole("button", { name: /composite & regenerate/i }));

    expect(onPromptTextChange).toHaveBeenCalledWith(COMPOSITE_REGENERATE_COHESION_PROMPT);
  });

  it("resolves prompt copy for every canonical preset id", () => {
    EDIT_PRESET_SURFACE_PRESET_IDS.forEach((presetId) => {
      expect(resolveExpertEditPresetPromptById(presetId)).toBeTruthy();
    });
  });

  it("removes a preset by dragging from panel back into More Presets", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    const surface = screen.getByRole("region", { name: /more presets/i });
    const panelChip = screen.getByRole("button", { name: /apply selfie preset/i });
    const panelToSurfaceTransfer = createPresetDragTransfer();
    fireEvent.dragStart(panelChip, { dataTransfer: panelToSurfaceTransfer });
    fireEvent.dragOver(surface, { dataTransfer: panelToSurfaceTransfer });
    fireEvent.drop(surface, { dataTransfer: panelToSurfaceTransfer });
    fireEvent.dragEnd(panelChip, { dataTransfer: panelToSurfaceTransfer });

    expect(screen.queryByRole("button", { name: /apply selfie preset/i })).not.toBeInTheDocument();
    expect(within(surface).getByText("Selfie")).toBeInTheDocument();
  });

  it("dedupes repeated drops of the same preset label", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const panelList = screen.getByLabelText("Preset panel list");
    const transfer = createPresetDragTransfer({ presetId: "selfie", source: "surface" });
    fireEvent.dragOver(panelList, { dataTransfer: transfer });
    fireEvent.drop(panelList, { dataTransfer: transfer });
    fireEvent.dragOver(panelList, { dataTransfer: transfer });
    fireEvent.drop(panelList, { dataTransfer: transfer });

    expect(screen.getAllByRole("button", { name: /apply selfie preset/i })).toHaveLength(1);
  });

  it("keeps selected panel preset order canonical regardless of drop order", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);
    const panelList = screen.getByLabelText("Preset panel list");

    (["custom_3", "selfie", "low_angle"] as ExpertEditPresetId[]).forEach((presetId) => {
      const transfer = createPresetDragTransfer({ presetId, source: "surface" });
      fireEvent.dragOver(panelList, { dataTransfer: transfer });
      fireEvent.drop(panelList, { dataTransfer: transfer });
    });

    const selectedLabels = Array.from(
      container.querySelectorAll(".edit-expert-preset-btn--selected")
    ).map((node) => node.textContent?.trim());
    expect(selectedLabels).toEqual([
      "Selfie",
      "Side Profile",
      "Low Angle",
      "Enhance Realism",
      "Custom 3",
    ]);
  });

  it("shows a toast and blocks insertion once preset panel reaches max capacity", () => {
    vi.useFakeTimers();

    try {
      const { container } = render(<ExpertEditPanelView {...baseProps} />);
      const panelList = screen.getByLabelText("Preset panel list");
      const defaultPresetSet = new Set<ExpertEditPresetId>(EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS);
      const labelsToAddUntilMax = EDIT_PRESET_SURFACE_PRESET_IDS.filter(
        (presetId) => !defaultPresetSet.has(presetId)
      ).slice(0, EDIT_PRESET_PANEL_MAX - EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS.length);

      labelsToAddUntilMax.forEach((presetId) => {
        const transfer = createPresetDragTransfer({ presetId, source: "surface" });
        fireEvent.dragOver(panelList, { dataTransfer: transfer });
        fireEvent.drop(panelList, { dataTransfer: transfer });
      });
      expect(container.querySelectorAll(".edit-expert-preset-btn--selected")).toHaveLength(
        EDIT_PRESET_PANEL_MAX
      );

      const overflowTransfer = createPresetDragTransfer({
        presetId: "custom_3",
        source: "surface",
      });
      fireEvent.dragOver(panelList, { dataTransfer: overflowTransfer });
      fireEvent.drop(panelList, { dataTransfer: overflowTransfer });

      expect(container.querySelectorAll(".edit-expert-preset-btn--selected")).toHaveLength(
        EDIT_PRESET_PANEL_MAX
      );
      expect(screen.getByText("Preset panel is full (max 11).")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1_400);
      });
      expect(screen.queryByText("Preset panel is full (max 11).")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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

  it("keeps trigger click behavior deterministic after pointerdown while surface is open", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const trigger = screen.getByRole("button", { name: /apply more presets preset/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("region", { name: /more presets/i })).toBeInTheDocument();

    fireEvent.pointerDown(trigger);
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

  it("renders Move/Inpaint rail buttons with Move selected by default", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    const moveButton = await within(rail).findByRole("button", { name: /^move$/i });
    const inpaintButton = await within(rail).findByRole("button", { name: /^inpaint$/i });
    const railOrder = within(rail)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim()?.toLowerCase());

    expect(railOrder).toEqual(["move", "inpaint"]);
    expect(inpaintButton).toHaveAttribute("aria-pressed", "false");
    expect(moveButton).toHaveAttribute("aria-pressed", "true");
    expect(within(rail).queryByRole("button", { name: /^crop$/i })).toBeNull();
  });

  it("toggles selected tool state between Move/Inpaint rail buttons", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    const moveButton = await within(rail).findByRole("button", { name: /^move$/i });
    const inpaintButton = await within(rail).findByRole("button", { name: /^inpaint$/i });
    expect(inpaintButton).toHaveAttribute("aria-pressed", "false");
    expect(moveButton).toHaveAttribute("aria-pressed", "true");
    expect(within(rail).queryByRole("button", { name: /^crop$/i })).toBeNull();
    const moveSettingsPanel = screen.getByRole("group", { name: /move tools/i });
    expect(moveSettingsPanel).toHaveClass("is-themed-move");
    expect(within(moveSettingsPanel).getByRole("button", { name: /^move$/i })).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /^resize$/i })
    ).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /^rotate$/i })
    ).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /undo move action/i })
    ).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /redo move action/i })
    ).toBeInTheDocument();

    fireEvent.click(inpaintButton);
    expect(inpaintButton).toHaveAttribute("aria-pressed", "true");
    expect(moveButton).toHaveAttribute("aria-pressed", "false");
    const inpaintSettingsPanel = screen.getByRole("group", { name: /inpaint tools/i });
    expect(inpaintSettingsPanel).toHaveClass("is-themed-inpaint");

    fireEvent.click(moveButton);
    expect(moveButton).toHaveAttribute("aria-pressed", "true");
    expect(inpaintButton).toHaveAttribute("aria-pressed", "false");
    const moveSettingsPanelAgain = screen.getByRole("group", { name: /move tools/i });
    expect(moveSettingsPanelAgain).toHaveClass("is-themed-move");
  });

  it("locks the model picker to FLUX Pro Fill while Inpaint is selected", async () => {
    const onModelPickerOpen = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onModelPickerOpen={onModelPickerOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    const moveButton = await within(rail).findByRole("button", { name: /^move$/i });
    const inpaintButton = await within(rail).findByRole("button", { name: /^inpaint$/i });
    const modelPickerButton = screen.getByRole("button", { name: /open model picker/i });

    expect(modelPickerButton).not.toBeDisabled();
    expect(modelPickerButton).toHaveTextContent("Nano Banana");

    fireEvent.click(inpaintButton);
    expect(modelPickerButton).toBeDisabled();
    expect(modelPickerButton).toHaveTextContent(INPAINT_FLUX_FILL_MODEL_LABEL);
    fireEvent.click(modelPickerButton);
    expect(onModelPickerOpen).not.toHaveBeenCalled();

    fireEvent.click(moveButton);
    expect(modelPickerButton).not.toBeDisabled();
    expect(modelPickerButton).toHaveTextContent("Nano Banana");
  });

  it("applies active tool theme classes to the collapsed tools button", () => {
    vi.useFakeTimers();

    try {
      render(<ExpertEditPanelView {...baseProps} />);
      const collapsedButton = screen.getByRole("button", { name: /expand inpaint controls/i });
      expect(collapsedButton).toHaveClass("is-active-move");

      fireEvent.click(collapsedButton);
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));
      fireEvent.click(screen.getByRole("button", { name: /collapse inpaint controls/i }));
      act(() => {
        vi.advanceTimersByTime(180);
      });
      expect(screen.getByRole("button", { name: /expand inpaint controls/i })).toHaveClass(
        "is-active-inpaint"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not render a move zoom slider", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    expect(screen.queryByRole("slider", { name: /zoom image/i })).not.toBeInTheDocument();
  });

  it("does not render a crop guide overlay in the primary stage", async () => {
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/crop-guide-layer.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    expect(container.querySelector(".edit-expert-crop-guide-rect")).toBeNull();
  });

  it("moves the selected layer inside the primary dropzone when dragging in move mode", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/move-target.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const rect = {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(primaryDropzone, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    const frame = document.querySelector(".edit-expert-primary-layer-frame") as HTMLDivElement;
    expect(frame.style.transform).toContain("translate(0%");

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 41,
      pointerType: "mouse",
      button: 0,
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 41,
      pointerType: "mouse",
      clientX: 60,
      clientY: 70,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 41,
      pointerType: "mouse",
      clientX: 60,
      clientY: 70,
    });

    const translateMatch = frame.style.transform.match(/translate\(([-\d.]+)%\s*,\s*([-\d.]+)%\)/);
    expect(translateMatch).not.toBeNull();
    const translateX = Number(translateMatch?.[1] ?? "0");
    const translateY = Number(translateMatch?.[2] ?? "0");
    expect(translateX).toBeGreaterThan(10);
    expect(translateY).toBeGreaterThan(10);
  });

  it("does not render transform indicator overlays in move mode", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/clean-move-preview.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    expect(document.querySelector(".edit-expert-transform-gizmo")).toBeNull();
    expect(document.querySelector(".edit-expert-transform-gizmo-box")).toBeNull();
    expect(document.querySelector(".edit-expert-transform-gizmo-handle")).toBeNull();
  });

  it("undoes and redoes move transforms from the move history controls", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/move-history-target.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const rect = {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(primaryDropzone, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    const frame = document.querySelector(".edit-expert-primary-layer-frame") as HTMLDivElement;
    const undoButton = screen.getByRole("button", { name: /undo move action/i });
    const redoButton = screen.getByRole("button", { name: /redo move action/i });
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 141,
      pointerType: "mouse",
      button: 0,
      clientX: 30,
      clientY: 30,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 141,
      pointerType: "mouse",
      clientX: 80,
      clientY: 95,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 141,
      pointerType: "mouse",
      clientX: 80,
      clientY: 95,
    });

    const movedTranslate = readFrameTranslate(frame);
    expect(movedTranslate.x).toBeGreaterThan(10);
    expect(movedTranslate.y).toBeGreaterThan(10);
    expect(undoButton).not.toBeDisabled();
    expect(redoButton).toBeDisabled();

    fireEvent.click(undoButton);
    const undoneTranslate = readFrameTranslate(frame);
    expect(Math.abs(undoneTranslate.x)).toBeLessThan(0.01);
    expect(Math.abs(undoneTranslate.y)).toBeLessThan(0.01);
    expect(redoButton).not.toBeDisabled();

    fireEvent.click(redoButton);
    const redoneTranslate = readFrameTranslate(frame);
    expect(redoneTranslate.x).toBeCloseTo(movedTranslate.x, 4);
    expect(redoneTranslate.y).toBeCloseTo(movedTranslate.y, 4);
  });

  it("resizes only the selected layer when resize mode is active", async () => {
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/resize-selected-only-base.png"
        referenceText="prompt text"
      />
    );

    uploadPrimaryFile(container, "resize-selected-only-top.png");

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^resize$/i }));

    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const rect = {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(primaryDropzone, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    const framesBefore = Array.from(
      document.querySelectorAll(".edit-expert-primary-layer-frame")
    ) as HTMLDivElement[];
    expect(framesBefore).toHaveLength(2);
    const uploadedFrameBefore = framesBefore.find((frame) =>
      frame.style.backgroundImage.includes("resize-selected-only-top.png")
    );
    const foundationFrameBefore = framesBefore.find((frame) =>
      frame.style.backgroundImage.includes("resize-selected-only-base.png")
    );
    expect(uploadedFrameBefore).toBeDefined();
    expect(foundationFrameBefore).toBeDefined();
    const uploadedScaleBefore = readFrameScale(uploadedFrameBefore as HTMLDivElement);
    const foundationScaleBefore = readFrameScale(foundationFrameBefore as HTMLDivElement);

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 71,
      pointerType: "mouse",
      button: 0,
      clientX: 160,
      clientY: 40,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 71,
      pointerType: "mouse",
      clientX: 220,
      clientY: -10,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 71,
      pointerType: "mouse",
      clientX: 220,
      clientY: -10,
    });

    const framesAfter = Array.from(
      document.querySelectorAll(".edit-expert-primary-layer-frame")
    ) as HTMLDivElement[];
    const uploadedFrameAfter = framesAfter.find((frame) =>
      frame.style.backgroundImage.includes("resize-selected-only-top.png")
    );
    const foundationFrameAfter = framesAfter.find((frame) =>
      frame.style.backgroundImage.includes("resize-selected-only-base.png")
    );
    expect(uploadedFrameAfter).toBeDefined();
    expect(foundationFrameAfter).toBeDefined();
    const uploadedScaleAfter = readFrameScale(uploadedFrameAfter as HTMLDivElement);
    const foundationScaleAfter = readFrameScale(foundationFrameAfter as HTMLDivElement);

    expect(uploadedScaleAfter).toBeGreaterThan(uploadedScaleBefore);
    expect(foundationScaleAfter).toBe(foundationScaleBefore);
  });

  it("resizes the selected layer when resize mode is active", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/resize-target.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^resize$/i }));

    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const rect = {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(primaryDropzone, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    const frame = document.querySelector(".edit-expert-primary-layer-frame") as HTMLDivElement;
    const initialScale = Number(frame.style.transform.match(/scale\(([^)]+)\)/)?.[1] ?? "0");
    expect(initialScale).toBeGreaterThan(0);

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 51,
      pointerType: "mouse",
      button: 0,
      clientX: 196,
      clientY: 4,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 51,
      pointerType: "mouse",
      clientX: 236,
      clientY: -24,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 51,
      pointerType: "mouse",
      clientX: 236,
      clientY: -24,
    });

    const resizedScale = Number(frame.style.transform.match(/scale\(([^)]+)\)/)?.[1] ?? "0");
    expect(resizedScale).toBeGreaterThan(1);
  });

  it("allows resizing the selected layer smaller than the previous minimum floor", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/resize-smaller-target.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^resize$/i }));

    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const rect = {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(primaryDropzone, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    const frame = document.querySelector(".edit-expert-primary-layer-frame") as HTMLDivElement;
    const initialScale = Number(frame.style.transform.match(/scale\(([^)]+)\)/)?.[1] ?? "0");
    expect(initialScale).toBe(1);

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 451,
      pointerType: "mouse",
      button: 0,
      clientX: 196,
      clientY: 4,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 451,
      pointerType: "mouse",
      clientX: 110,
      clientY: 90,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 451,
      pointerType: "mouse",
      clientX: 110,
      clientY: 90,
    });

    const resizedScale = Number(frame.style.transform.match(/scale\(([^)]+)\)/)?.[1] ?? "0");
    expect(resizedScale).toBeLessThan(0.5);
    expect(resizedScale).toBeGreaterThanOrEqual(0.2);
  });

  it("rotates the selected layer when rotate mode is active", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/rotate-target.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^rotate$/i }));

    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const rect = {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(primaryDropzone, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    const frame = document.querySelector(".edit-expert-primary-layer-frame") as HTMLDivElement;
    expect(frame.style.transform).toContain("rotate(0deg)");

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 61,
      pointerType: "mouse",
      button: 0,
      clientX: 100,
      clientY: 16,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 61,
      pointerType: "mouse",
      clientX: 184,
      clientY: 100,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 61,
      pointerType: "mouse",
      clientX: 184,
      clientY: 100,
    });

    const rotationDeg = Number(frame.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] ?? "0");
    expect(Math.abs(rotationDeg)).toBeGreaterThan(10);
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

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^inpaint$/i }));

    uploadPrimaryFile(container, "reticle-target.png");
    const brushCursor = primaryDropzone.style.cursor;
    expect(brushCursor).toContain("data:image/svg+xml");
    expect(brushCursor).toContain("crosshair");

    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));
    expect(primaryDropzone).toHaveStyle({ cursor: "grab" });

    fireEvent.click(await within(rail).findByRole("button", { name: /^inpaint$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^lasso$/i }));
    const lassoCursor = primaryDropzone.style.cursor;
    expect(lassoCursor).toContain("data:image/svg+xml");
    expect(lassoCursor).toContain("crosshair");
    expect(lassoCursor).toContain("245%2C185%2C66");
    expect(lassoCursor).not.toEqual(brushCursor);

    fireEvent.click(screen.getByRole("button", { name: /^brush$/i }));
    expect(primaryDropzone.style.cursor).toContain("data:image/svg+xml");
    expect(primaryDropzone.style.cursor).toContain("crosshair");
  });

  it("locks brush reticle cursor globally during active brush drawing and restores on pointer up", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/brush-cursor-lock.png"
        referenceText="prompt text"
      />
    );

    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const rect = {
      left: 0,
      top: 0,
      width: 220,
      height: 220,
      right: 220,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(primaryDropzone, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));

    expect(document.body.style.cursor).toBe("");
    expect(document.documentElement.style.cursor).toBe("");

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 301,
      pointerType: "mouse",
      button: 0,
      clientX: 60,
      clientY: 60,
    });

    expect(document.body.style.cursor).toContain("data:image/svg+xml");
    expect(document.documentElement.style.cursor).toContain("data:image/svg+xml");

    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 301,
      pointerType: "mouse",
      clientX: 88,
      clientY: 88,
    });

    expect(document.body.style.cursor).toBe("");
    expect(document.documentElement.style.cursor).toBe("");
  });

  it("suppresses inpaint cursor while presets surface is open and restores it on close", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/reticle-source.png"
      />
    );
    const primaryDropzone = screen.getByLabelText("Primary edit image");

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));

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

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^inpaint$/i }));

    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const initialCursor = primaryDropzone.style.cursor;
    expect(initialCursor).toContain("data:image/svg+xml");

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
      fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));
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

  it("clones blob references from drag payload so layer flattening is not tied to output URL lifecycle", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Blob(["cloned-image"], { type: "image/png" }), {
          status: 200,
        })
    );
    const previousFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
    const onPrimaryImageChange = vi.fn();
    const resolvePreviewUrlById = vi.fn(() => "blob:reference-grid-source");

    try {
      render(
        <ExpertEditPanelView
          {...baseProps}
          onPrimaryImageChange={onPrimaryImageChange}
          resolvePreviewUrlById={resolvePreviewUrlById}
        />
      );

      const primaryDropzone = screen.getByLabelText("Primary edit image");
      const transfer = createReferenceImageDropTransfer({
        url: "blob:reference-grid-source",
        referenceId: "out-1",
      });

      await act(async () => {
        fireEvent.drop(primaryDropzone, { dataTransfer: transfer });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(resolvePreviewUrlById).toHaveBeenCalledWith("out-1");
      expect(fetchMock).toHaveBeenCalledWith("blob:reference-grid-source");
      expect(onPrimaryImageChange).toHaveBeenCalledWith(expect.stringMatching(/^blob:flatten-/));
      const layerFrame = document.querySelector(
        ".edit-expert-primary-layer-frame"
      ) as HTMLDivElement;
      expect(layerFrame.style.backgroundImage).toContain("blob:flatten-");
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: previousFetch,
      });
    }
  });

  it("keeps the add-layer button hidden while primary uploads can still create layers", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.queryByRole("button", { name: /add layer/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "layer 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();

    uploadPrimaryFile(container, "added-layer-1.png");
    expect(screen.getByRole("button", { name: "layer 1" })).toHaveClass("is-selected");
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();

    uploadPrimaryFile(container, "added-layer-2.png");
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "layer 2" })).toHaveClass("is-selected");
  });

  it("inserts a new image layer above the selected layer", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");
    fireEvent.click(screen.getByRole("button", { name: "layer 2" }));
    expect(screen.getByRole("button", { name: "layer 2" })).toHaveClass("is-selected");

    uploadPrimaryFile(container, "insert-above-selected.png");
    const labels = Array.from(
      container.querySelectorAll(".edit-expert-layer-row .edit-expert-layer-label")
    ).map((node) => node.textContent?.trim());
    expect(labels.slice(0, 3)).toEqual(["layer 3", "layer 2", "layer 1"]);
    expect(screen.getByRole("button", { name: "layer 3" })).toHaveClass("is-selected");
  });

  it("reuses the lowest available auto layer number after deletion", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "base.png");
    uploadPrimaryFile(container, "layer-2.png");
    uploadPrimaryFile(container, "layer-3.png");
    fireEvent.click(screen.getByRole("button", { name: /delete layer 2/i }));

    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "layer 3" })).toBeInTheDocument();

    uploadPrimaryFile(container, "new-after-delete.png");
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "layer 4" })).not.toBeInTheDocument();
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

    expect(labels.slice(0, 3)).toEqual(["layer 2", "layer 1", "layer 3"]);
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
    expect(Number(layerTwoFrame?.style.zIndex ?? 0)).toBeGreaterThan(
      Number(layerOneFrame?.style.zIndex ?? 0)
    );
    expect(Number(layerOneFrame?.style.zIndex ?? 0)).toBeGreaterThan(
      Number(layerThreeFrame?.style.zIndex ?? 0)
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
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(composePrimaryLayersToBlobMock).toHaveBeenCalledTimes(1);
    expect(composePrimaryStageLayersToBlobMock).not.toHaveBeenCalled();
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
    const composedImageUrls = (composedLayers ?? [])
      .map((layer) => layer.imageUrl)
      .filter((imageUrl): imageUrl is string => typeof imageUrl === "string");
    expect(composedImageUrls[0]).toContain("layer-2.png");
    expect(composedImageUrls[1]).toContain("layer-1.png");
    expect(composedImageUrls[2]).toContain("layer-3.png");
  });

  it("promotes the sole remaining populated layer to layer 1 after clearing foundation", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");

    const rowForLayerOne = screen
      .getByRole("button", { name: "layer 1" })
      .closest(".edit-expert-layer-row") as HTMLElement;
    const rowForLayerTwo = screen
      .getByRole("button", { name: "layer 2" })
      .closest(".edit-expert-layer-row") as HTMLElement;
    const transfer = createLayerDragTransfer();

    fireEvent.dragStart(rowForLayerOne, { dataTransfer: transfer });
    fireEvent.dragOver(rowForLayerTwo, { dataTransfer: transfer });
    fireEvent.drop(rowForLayerTwo, { dataTransfer: transfer });

    const framesBeforeDelete = Array.from(
      container.querySelectorAll(".edit-expert-primary-layer-frame")
    ) as HTMLElement[];
    const frameUrlsBeforeDelete = framesBeforeDelete
      .map((frame) => frame.style.backgroundImage)
      .sort();
    expect(framesBeforeDelete).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /delete layer 1/i }));

    const layerOneButton = screen.getByRole("button", { name: "layer 1" });
    expect(layerOneButton).toBeInTheDocument();
    expect(layerOneButton).toHaveClass("is-selected");
    expect(container.querySelectorAll(".edit-expert-layer-row")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();

    const framesAfterDelete = Array.from(
      container.querySelectorAll(".edit-expert-primary-layer-frame")
    ) as HTMLElement[];
    const frameUrlsAfterDelete = framesAfterDelete
      .map((frame) => frame.style.backgroundImage)
      .sort();
    expect(framesAfterDelete).toHaveLength(1);
    expect(frameUrlsAfterDelete).toEqual(
      frameUrlsBeforeDelete.filter((url) => !url.includes("layer-1.png"))
    );
  });

  it("shows a toast and blocks creation when a 9th layer is attempted by primary drop/file add", () => {
    vi.useFakeTimers();

    try {
      const { container } = render(<ExpertEditPanelView {...baseProps} />);

      for (let index = 1; index <= 8; index += 1) {
        uploadPrimaryFile(container, `layer-${index}.png`);
      }
      expect(screen.getByRole("button", { name: "layer 8" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /add layer/i })).not.toBeInTheDocument();

      uploadPrimaryFile(container, "layer-9-over-limit.png");
      expect(screen.queryByRole("button", { name: "layer 9" })).not.toBeInTheDocument();
      const layerLimitToast = screen.getByText("Layer limit reached (8).");
      expect(layerLimitToast).toBeInTheDocument();
      expect(layerLimitToast.closest(".edit-expert-layers-toolbar")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1_400);
      });
      expect(screen.queryByText("Layer limit reached (8).")).not.toBeInTheDocument();
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

  it("manual flatten collapses to layer 1 without emitting a session media reference", async () => {
    const onAddSessionMediaReference = vi.fn();
    const { container } = render(
      <ExpertEditPanelView {...baseProps} onAddSessionMediaReference={onAddSessionMediaReference} />
    );

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flatten/i }));
      await Promise.resolve();
    });

    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalled();
    expect(composePrimaryLayersToBlobMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "layer 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();
    expect(onAddSessionMediaReference).not.toHaveBeenCalled();
  });

  it("manual flatten applies selected frame ratio without exporting to reference grid", async () => {
    const originalCreateImageBitmap = window.createImageBitmap;
    const closeBitmap = vi.fn();
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      writable: true,
      value: vi.fn(async () => ({
        width: 1440,
        height: 1440,
        close: closeBitmap,
      })),
    });
    try {
      const onAddSessionMediaReference = vi.fn();
      const { container, rerender } = render(
        <ExpertEditPanelView
          {...baseProps}
          onAddSessionMediaReference={onAddSessionMediaReference}
        />
      );

      uploadPrimaryFile(container, "layer-1.png");
      uploadPrimaryFile(container, "layer-2.png");

      rerender(
        <ExpertEditPanelView
          {...baseProps}
          aspect="16:9"
          onAddSessionMediaReference={onAddSessionMediaReference}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /flatten/i }));
        await Promise.resolve();
      });

      expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledTimes(1);
      expect(composePrimaryLayersToBlobMock).not.toHaveBeenCalled();
      expect(composeExpertEditLayerCropToBlobMock).toHaveBeenCalledTimes(1);
      expect(composeExpertEditLayerCropToBlobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: expect.stringMatching(/^blob:flatten-/),
          stageWidth: 1440,
          stageHeight: 1440,
          cropRect: expect.objectContaining({
            x: 0,
            y: 315,
            width: 1440,
            height: 810,
          }),
          mimeType: "image/png",
        })
      );
      expect(closeBitmap).toHaveBeenCalledTimes(1);
      expect(onAddSessionMediaReference).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "createImageBitmap", {
        configurable: true,
        writable: true,
        value: originalCreateImageBitmap,
      });
    }
  });

  it("manual flatten forwards current layer transforms to stage flatten helper", async () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const rect = {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(primaryDropzone, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 313,
      pointerType: "mouse",
      button: 0,
      clientX: 32,
      clientY: 36,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 313,
      pointerType: "mouse",
      clientX: 92,
      clientY: 98,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 313,
      pointerType: "mouse",
      clientX: 92,
      clientY: 98,
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flatten/i }));
      await Promise.resolve();
    });

    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledTimes(1);
    expect(composePrimaryLayersToBlobMock).not.toHaveBeenCalled();
    const flattenCalls = (
      composePrimaryStageLayersToBlobMock as unknown as {
        mock: {
          calls: unknown[][];
        };
      }
    ).mock.calls;
    const flattenArgs = (flattenCalls[0]?.[0] ?? []) as Array<{
      imageUrl: string | null;
      transform?: {
        translateXRatio?: number;
        translateYRatio?: number;
      };
    }>;
    const movedLayer = flattenArgs.find((layer) => layer.imageUrl?.includes("layer-2.png"));
    expect(movedLayer).toBeDefined();
    expect(Math.abs(movedLayer?.transform?.translateXRatio ?? 0)).toBeGreaterThan(0.1);
    expect(Math.abs(movedLayer?.transform?.translateYRatio ?? 0)).toBeGreaterThan(0.1);
  });

  it("auto-flattens on generate and forwards flattened refs with primary first", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
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
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(composePrimaryLayersToBlobMock).toHaveBeenCalled();
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    const submissionCalls = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: {
          calls: Array<
            [
              string[],
              {
                inpaintOverride?: unknown;
                modelIdOverride?: string | null;
                costOverrideCredits?: number | null;
                hideOutputFromReferenceGrid?: boolean;
              }?,
            ]
          >;
        };
      }
    ).mock.calls;
    const referenceInputs = submissionCalls[0]?.[0];
    const submitOptions = submissionCalls[0]?.[1];
    if (!referenceInputs) {
      throw new Error("Expected flattened reference inputs.");
    }
    expect(referenceInputs[0]).toMatch(/^blob:flatten-/);
    expect(referenceInputs).toContain("https://example.com/extra.png");
    expect(submitOptions?.hideOutputFromReferenceGrid).toBeUndefined();
  });

  it("auto-flatten generate passes display/submission prompt overrides when @img tokens are used", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
    });
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Put @img1 in the background."
        extraImageUrls={["https://example.com/extra-token.png", null, null]}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    uploadPrimaryFile(container, "layer-1.png");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    const submissionCalls = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: {
          calls: Array<
            [
              string[],
              {
                displayPromptOverride?: string | null;
                submissionPromptOverride?: string | null;
              }?,
            ]
          >;
        };
      }
    ).mock.calls;
    const submitOptions = submissionCalls[0]?.[1];
    expect(submitOptions?.displayPromptOverride).toBe("Put @img1 in the background.");
    expect(submitOptions?.submissionPromptOverride).toContain("Put Figure 2 in the background.");
    expect(submitOptions?.submissionPromptOverride).toContain("Reference map:");
  });

  it("submits remove background for the active layer image without flattening", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
    });
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Background" }));
      await Promise.resolve();
    });

    expect(composePrimaryLayersToBlobMock).not.toHaveBeenCalled();
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    const [referenceInputs, options] = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: {
          calls: Array<
            [string[], { modelIdOverride?: string | null; costOverrideCredits?: number | null }?]
          >;
        };
      }
    ).mock.calls[0] ?? [[], undefined];
    expect(referenceInputs?.[0]).toMatch(/^blob:file-layer-2\.png-\d+$/);
    expect(referenceInputs).toHaveLength(1);
    expect(options).toEqual(
      expect.objectContaining({
        modelIdOverride: "fal-ai/bria/background/remove",
        costOverrideCredits: 0,
      })
    );
  });

  it("shows a loading layer while remove background is pending and clears it once result arrives", async () => {
    let releasePendingSubmit = () => {};
    const pendingSubmitPromise = new Promise<void>((resolve) => {
      releasePendingSubmit = () => {
        resolve();
      };
    });
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => await pendingSubmitPromise);
    const { container, rerender } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl={null}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    uploadPrimaryFile(container, "layer-1.png");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Background" }));
      await Promise.resolve();
    });

    expect(screen.getByTestId("edit-expert-remove-background-loading-overlay")).toBeInTheDocument();
    expect(screen.getByText("Removing background...")).toBeInTheDocument();
    expect(screen.getByLabelText("Primary edit image")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Remove Background" })).toBeDisabled();

    rerender(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/bria-result.png"
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("edit-expert-remove-background-loading-overlay")).toBeNull();
    expect(screen.queryByText("Removing background...")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Primary edit image")).not.toHaveAttribute("aria-busy");

    releasePendingSubmit();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("shows a generating placeholder overlay on the primary stage while inline generation is pending", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/primary-image.png"
        isPrimaryStageGenerating
      />
    );

    expect(screen.getByTestId("edit-expert-inline-generate-loading-overlay")).toBeInTheDocument();
    expect(screen.getByText("Generating...")).toBeInTheDocument();
    expect(screen.getByLabelText("Primary edit image")).toHaveAttribute("aria-busy", "true");
  });

  it("keeps the moved layer position after remove background completes", async () => {
    let releasePendingSubmit = () => {};
    const pendingSubmitPromise = new Promise<void>((resolve) => {
      releasePendingSubmit = () => {
        resolve();
      };
    });
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => await pendingSubmitPromise);
    const { container, rerender } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl={null}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    uploadPrimaryFile(container, "layer-move.png");

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    const primaryDropzone = screen.getByLabelText("Primary edit image");
    const rect = {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(primaryDropzone, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    const frame = document.querySelector(".edit-expert-primary-layer-frame") as HTMLDivElement;
    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 241,
      pointerType: "mouse",
      button: 0,
      clientX: 24,
      clientY: 24,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 241,
      pointerType: "mouse",
      clientX: 66,
      clientY: 76,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 241,
      pointerType: "mouse",
      clientX: 66,
      clientY: 76,
    });
    const movedTranslate = readFrameTranslate(frame);
    expect(movedTranslate.x).toBeGreaterThan(10);
    expect(movedTranslate.y).toBeGreaterThan(10);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Background" }));
      await Promise.resolve();
    });

    rerender(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/bria-moved-result.png"
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const frameAfter = document.querySelector(".edit-expert-primary-layer-frame") as HTMLDivElement;
    const translatedAfter = readFrameTranslate(frameAfter);
    expect(translatedAfter.x).toBeCloseTo(movedTranslate.x, 4);
    expect(translatedAfter.y).toBeCloseTo(movedTranslate.y, 4);

    releasePendingSubmit();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("applies remove-background result to the originally targeted layer when selection changes mid-run", async () => {
    let releasePendingSubmit = () => {};
    const pendingSubmitPromise = new Promise<void>((resolve) => {
      releasePendingSubmit = () => {
        resolve();
      };
    });
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => await pendingSubmitPromise);
    const { container, rerender } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl={null}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Background" }));
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "layer 1" }));
    expect(screen.getByRole("button", { name: "layer 1" })).toHaveClass("is-selected");

    rerender(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/bria-layer-2-result.png"
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const frames = Array.from(
      document.querySelectorAll(".edit-expert-primary-layer-frame")
    ) as HTMLDivElement[];
    expect(
      frames.some((frame) =>
        frame.style.backgroundImage.includes("https://example.com/bria-layer-2-result.png")
      )
    ).toBe(true);
    expect(
      frames.some((frame) => frame.style.backgroundImage.includes("blob:file-layer-1.png-"))
    ).toBe(true);

    releasePendingSubmit();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("submits FLUX Fill override with base and mask urls when Inpaint is selected and a mask is present", async () => {
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
      fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
        await Promise.resolve();
      });

      expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
      const inpaintOptions = (
        onRegenerateWithReferenceInputs as unknown as {
          mock: {
            calls: Array<
              [string[], { inpaintOverride?: unknown; hideOutputFromReferenceGrid?: boolean }?]
            >;
          };
        }
      ).mock.calls[0]?.[1];
      expect(inpaintOptions?.inpaintOverride).toEqual({
        modelId: INPAINT_FLUX_FILL_MODEL_ID,
        baseImageInput: expect.stringMatching(/^blob:flatten-/),
        maskInput: expect.stringMatching(/^blob:flatten-/),
        outputFormat: "png",
      });
      expect(inpaintOptions?.hideOutputFromReferenceGrid).toBeUndefined();
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: previousImage,
      });
    }
  });

  it("blocks generate when Inpaint is selected without an inpaint mask", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => {});
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        hasSelectedLayerMask: false,
        imageHasInteractiveMask: true,
        clearSelectedLayerMask: vi.fn(),
        invertSelectedLayerMask: vi.fn(),
        exportSelectedLayerMaskBlob: vi.fn(async () => null),
        onPointerDown: vi.fn(),
        onPointerMove: vi.fn(),
        onPointerUp: vi.fn(),
        onPointerCancel: vi.fn(),
        onPointerLeave: vi.fn(),
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
      fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
        await Promise.resolve();
      });

      expect(onRegenerateWithReferenceInputs).not.toHaveBeenCalled();
      expect(screen.getByText("Mask selection is required for inpaint.")).toBeInTheDocument();
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
    }
  });
});
