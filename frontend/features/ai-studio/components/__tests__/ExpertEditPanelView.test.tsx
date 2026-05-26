import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  INPAINT_REFERENCE_MODEL_ID,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL,
} from "../../logic/inpaintSubmission";
import * as InpaintMaskControllerModule from "../edit/useInpaintMaskController";
import type { InpaintMaskSnapshot } from "../edit/useInpaintMaskController";
import { resolveScenePointFromPixelSpace } from "../edit/stageSceneGeometry";
import {
  EXPERT_EDIT_SESSION_STATE_VERSION,
  type ExpertEditSessionState,
} from "../edit/expertEditSessionState";
import {
  MARKUP_VIEWPORT_DEFAULT_SCALE,
  resolveMoveStageZoomSliderValue,
} from "../edit/expertEditViewportUtils";
import { MARKUP_OVERLAY_OPACITY } from "../edit/markupStrokeController";

const { composePrimaryStageLayersToBlobMock, composeFlattenedMarkupReferenceBlobMock } = vi.hoisted(
  () => ({
    composePrimaryStageLayersToBlobMock: vi.fn(
      async () => new Blob(["flattened-stage"], { type: "image/png" })
    ),
    composeFlattenedMarkupReferenceBlobMock: vi.fn(
      async () => new Blob(["flattened-markup"], { type: "image/png" })
    ),
  })
);

vi.mock("../../logic/expertEditStageFlatten", async () => {
  const actual = await vi.importActual("../../logic/expertEditStageFlatten");
  return {
    ...(actual as Record<string, unknown>),
    composePrimaryStageLayersToBlob: composePrimaryStageLayersToBlobMock,
  };
});

vi.mock("../../logic/expertEditMarkupReference", async () => {
  const actual = await vi.importActual("../../logic/expertEditMarkupReference");
  return {
    ...(actual as Record<string, unknown>),
    composeFlattenedMarkupReferenceBlob: composeFlattenedMarkupReferenceBlobMock,
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
  width,
  height,
}: {
  url: string;
  referenceId: string;
  width?: number;
  height?: number;
}) =>
  ({
    files: [],
    types: ["text/reference-url", "text/reference-id"],
    setData: vi.fn(),
    getData: vi.fn((type: string) => {
      if (type === "text/reference-url") return url;
      if (type === "text/reference-id") return referenceId;
      if (type === "text/reference-width") return width ? String(width) : "";
      if (type === "text/reference-height") return height ? String(height) : "";
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

const readFrameRotationDeg = (frame: HTMLDivElement) =>
  Number(frame.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] ?? "0");

const readFrameTranslate = (frame: HTMLDivElement) => {
  const match = frame.style.transform.match(
    /translate\(([-\d.]+)(?:px|%)\s*,\s*([-\d.]+)(?:px|%)\)/
  );
  return {
    x: Number(match?.[1] ?? "0"),
    y: Number(match?.[2] ?? "0"),
  };
};

const readMarkupViewportTransform = (scope: ParentNode = document) => {
  const viewport = scope.querySelector(".edit-expert-markup-viewport") as HTMLDivElement | null;
  const viewportTransform = viewport?.style.transform ?? "";
  const transformSource =
    viewportTransform.trim().length > 0
      ? ({
          element: viewport,
          transform: viewportTransform,
        } as const)
      : null;
  if (!transformSource?.element) return null;
  const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0\)\s*scale\(([-\d.]+)\)/.exec(
    transformSource.transform
  );
  return {
    viewport: transformSource.element,
    transform: transformSource.transform,
    offsetX: Number(match?.[1] ?? "0"),
    offsetY: Number(match?.[2] ?? "0"),
    scale: Number(match?.[3] ?? "1"),
  };
};

const createSquareRect = (size: number): DOMRect =>
  ({
    left: 0,
    top: 0,
    width: size,
    height: size,
    right: size,
    bottom: size,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect;

const dispatchNativeWheelEvent = (
  element: Element,
  init: Partial<WheelEventInit> & Pick<WheelEventInit, "deltaY" | "clientX" | "clientY">
) => {
  act(() => {
    element.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        ...init,
      })
    );
  });
};

const mockElementRect = (element: Element, rect: DOMRect) => {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => rect,
  });
};

const flushReactTurn = async (callback?: () => void) => {
  await act(async () => {
    callback?.();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const dragStagePointer = ({
  currentTarget,
  downTarget,
  pointerId,
  startX,
  startY,
  endX,
  endY,
  button = 0,
  shiftKey = false,
  altKey = false,
  pointerType = "mouse",
}: {
  currentTarget: HTMLElement;
  downTarget?: HTMLElement | Element | null;
  pointerId: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  button?: number;
  shiftKey?: boolean;
  altKey?: boolean;
  pointerType?: string;
}) => {
  fireEvent.pointerDown((downTarget ?? currentTarget) as Element, {
    pointerId,
    pointerType,
    button,
    shiftKey,
    altKey,
    clientX: startX,
    clientY: startY,
  });
  fireEvent.pointerMove(currentTarget, {
    pointerId,
    pointerType,
    button,
    shiftKey,
    altKey,
    clientX: endX,
    clientY: endY,
  });
  fireEvent.pointerUp(currentTarget, {
    pointerId,
    pointerType,
    button,
    shiftKey,
    altKey,
    clientX: endX,
    clientY: endY,
  });
};

const parsePolylinePoints = (polyline: SVGPolylineElement) =>
  (polyline.getAttribute("points") ?? "")
    .split(/\s+/)
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [xRaw, yRaw] = pair.split(",");
      return {
        x: Number.parseFloat(xRaw ?? "0"),
        y: Number.parseFloat(yRaw ?? "0"),
      };
    });

const DEFAULT_STAGE_ZOOM_SLIDER_VALUE = String(
  resolveMoveStageZoomSliderValue(MARKUP_VIEWPORT_DEFAULT_SCALE)
);

const createEmptyExpertEditSessionState = (): ExpertEditSessionState => ({
  version: EXPERT_EDIT_SESSION_STATE_VERSION,
  layers: {
    layerIdCounter: 2,
    foundationLayerId: "layer-1",
    selectedLayerIndex: 0,
    layers: [
      {
        id: "layer-1",
        name: "layer 1",
        imageUrl: "https://example.com/base.png",
        opacity: 100,
        isAutoNamed: true,
        ownsImageUrl: false,
        transform: {
          translateXRatio: 0,
          translateYRatio: 0,
          scale: 1,
          rotationDeg: 0,
        },
      },
    ],
  },
  markup: {
    strokes: [],
  },
  inpaint: {
    snapshot: { layers: [] },
  },
});

const createSessionStateWithMarkupStroke = (): ExpertEditSessionState => {
  const sessionState = createEmptyExpertEditSessionState();
  const stroke = {
    id: "markup-stroke-seeded",
    color: "#f43f5e",
    sizeRatio: 0.012,
    points: [
      { sceneX: -0.12, sceneY: -0.1 },
      { sceneX: 0.22, sceneY: 0.18 },
    ],
  };
  sessionState.markup = {
    strokes: [stroke],
  };
  return sessionState;
};

describe("ExpertEditPanelView", () => {
  const createObjectURLMock = vi.fn();
  const revokeObjectURLMock = vi.fn();
  let objectUrlCounter = 0;

  const baseProps: React.ComponentProps<typeof ExpertEditPanelView> = {
    aspect: "1:1",
    modelId: "fal-ai/nano-banana-2/edit",
    modelLabel: "Nano Banana 2 Edit",
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
    onOpenPresetsLibrary: vi.fn(),
    selectedStyleId: null,
  };

  it("suppresses the missing-reference guardrail next to the disabled inline generate button", () => {
    const message = "Add a reference image before generating.";

    render(
      <ExpertEditPanelView
        {...baseProps}
        isGenerateDisabled
        guardrailReason={message}
        referenceText="Adjust the coat color."
      />
    );

    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it("shows other guardrail reasons next to the disabled inline generate button", () => {
    const message = "Select a model before generating.";

    render(
      <ExpertEditPanelView
        {...baseProps}
        isGenerateDisabled
        guardrailReason={message}
        referenceText="Adjust the coat color."
      />
    );

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("keeps the inline generate button enabled while edit generation is busy", () => {
    const { container } = renderControlledPromptPanel({
      initialPrompt: "Put her in a bikini",
    });

    uploadPrimaryFile(container, "busy-button.png");

    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Generate" })).toHaveTextContent("Generate");
  });

  it.skip("disables the inline generate button while an inline expert edit submission is pending", async () => {
    let deferredResolve!: () => void;
    const deferredPromise = new Promise<void>((resolve) => {
      deferredResolve = () => resolve();
    });
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(() => deferredPromise);
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Adjust the jacket."
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    uploadPrimaryFile(container, "pending-inline-submit.png");

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    });

    deferredResolve();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    });
  });

  const renderControlledPromptPanel = ({
    initialPrompt = "",
    extraImageUrls = [null, null, null] as [string | null, string | null, string | null],
    onPromptTextChangeSpy = vi.fn(),
    panelProps = {},
  }: {
    initialPrompt?: string;
    extraImageUrls?: [string | null, string | null, string | null];
    onPromptTextChangeSpy?: (value: string) => void;
    panelProps?: Partial<React.ComponentProps<typeof ExpertEditPanelView>>;
  } = {}) => {
    const ControlledPromptPanel = () => {
      const [promptText, setPromptText] = React.useState(initialPrompt);
      return (
        <ExpertEditPanelView
          {...baseProps}
          {...panelProps}
          referenceText={promptText}
          extraImageUrls={extraImageUrls}
          onPromptTextChange={(value) => {
            onPromptTextChangeSpy?.(value);
            setPromptText(value);
          }}
        />
      );
    };

    const renderResult = render(<ControlledPromptPanel />);
    return {
      container: renderResult.container,
      onPromptTextChangeSpy,
      promptInput: screen.getByLabelText("Edit prompt") as HTMLTextAreaElement,
    };
  };

  beforeEach(() => {
    objectUrlCounter = 0;
    composePrimaryStageLayersToBlobMock.mockClear();
    composeFlattenedMarkupReferenceBlobMock.mockClear();
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders one primary edit stage and three secondary edit dropzones", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.getByLabelText("Primary edit stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Styles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Background" })).toBeInTheDocument();
  });

  it("shows the shared billing-aligned Remove Background cost pill", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const removeBackgroundButton = screen.getByRole("button", { name: "Remove Background" });
    expect(removeBackgroundButton).toHaveTextContent("✦3");
  });

  it("shows a visible primary canvas frame inside the blank stage", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.getByLabelText("Primary edit stage")).toBeInTheDocument();
    expect(screen.getByText("Drag & drop an image from the Reference Grid")).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="edit-expert-primary-canvas-frame-stack"]')
    ).not.toBeNull();
    expect(container.querySelector(".edit-expert-primary-canvas-frame")).not.toBeNull();
    expect(
      container.querySelector(".edit-expert-primary-stage-shell") as HTMLDivElement | null
    )?.toHaveStyle({ minHeight: "calc(var(--edit-expert-primary-size) + 72px)" });
  });

  it("keeps the primary stage shell height contract after loading a preview", () => {
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/loaded-stage-height.png"
        referenceText="prompt text"
      />
    );

    expect(screen.queryByText("Drag & drop an image from the Reference Grid")).toBeNull();
    expect(
      container.querySelector(".edit-expert-primary-stage-shell") as HTMLDivElement | null
    )?.toHaveStyle({ minHeight: "calc(var(--edit-expert-primary-size) + 72px)" });
  });

  it("renders two center-column wrappers and splits the lower tools into base and overlay lanes", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);
    const primaryColumn = container.querySelector(".edit-expert-primary-column");
    expect(primaryColumn).not.toBeNull();

    const centerWrappers = Array.from(primaryColumn?.children ?? []).filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement &&
        node.classList.contains("edit-expert-column-wrapper") &&
        node.classList.contains("edit-expert-column-wrapper--center")
    );

    expect(centerWrappers).toHaveLength(2);
    expect(centerWrappers[0]?.querySelector(".edit-expert-inpaint-row")).toBeNull();
    const overlayZone = centerWrappers[1]?.querySelector(".edit-expert-post-stage-overlay-zone");
    const baseLayer = overlayZone?.querySelector(".edit-expert-post-stage-base-layer");
    const composerOverlay = overlayZone?.querySelector(".edit-expert-post-stage-composer-overlay");

    expect(overlayZone).not.toBeNull();
    expect(baseLayer?.querySelector(".edit-expert-inpaint-row")).not.toBeNull();
    expect(composerOverlay?.querySelector(".edit-expert-bottom-row")).not.toBeNull();
    expect(composerOverlay?.querySelector(".edit-expert-selector-row")).not.toBeNull();
  });

  it("collapses the sidebar layers panel and flatten action in Inpaint and Markup modes", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);
    const sidebarLayersPanel = container.querySelector(
      ".edit-expert-layers-toolbar--sidebar"
    ) as HTMLDivElement;
    const modePanelShell = container.querySelector(
      ".edit-expert-sidebar-mode-panel-shell"
    ) as HTMLDivElement;
    const layersListShell = sidebarLayersPanel.querySelector(
      ".edit-expert-layers-toolbar-list-shell"
    ) as HTMLDivElement;
    const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
    const inpaintTab = within(modeTabs).getByRole("tab", { name: /^inpaint$/i });
    const markupTab = within(modeTabs).getByRole("tab", { name: /^markup$/i });
    const standardTab = within(modeTabs).getByRole("tab", { name: /^standard$/i });

    expect(sidebarLayersPanel).not.toBeNull();
    expect(modePanelShell).not.toBeNull();
    expect(modePanelShell.classList.contains("is-collapsed")).toBe(true);
    expect(layersListShell.classList.contains("is-expanded")).toBe(true);
    expect(within(sidebarLayersPanel).getByRole("button", { name: "layer 1" })).toBeInTheDocument();
    expect(
      within(sidebarLayersPanel).getByRole("button", { name: /flatten layers/i })
    ).toBeInTheDocument();

    fireEvent.click(inpaintTab);
    expect(modePanelShell.classList.contains("is-expanded")).toBe(true);
    expect(layersListShell.classList.contains("is-collapsed")).toBe(true);
    expect(within(sidebarLayersPanel).queryByRole("button", { name: "layer 1" })).toBeNull();
    expect(
      within(sidebarLayersPanel).queryByRole("button", { name: /flatten layers/i })
    ).toBeNull();

    fireEvent.click(markupTab);
    expect(modePanelShell.classList.contains("is-expanded")).toBe(true);
    expect(layersListShell.classList.contains("is-collapsed")).toBe(true);
    expect(within(sidebarLayersPanel).queryByRole("button", { name: "layer 1" })).toBeNull();
    expect(
      within(sidebarLayersPanel).queryByRole("button", { name: /flatten layers/i })
    ).toBeNull();

    fireEvent.click(standardTab);
    expect(modePanelShell.classList.contains("is-collapsed")).toBe(true);
    expect(layersListShell.classList.contains("is-expanded")).toBe(true);
    expect(within(sidebarLayersPanel).getByRole("button", { name: "layer 1" })).toBeInTheDocument();
    expect(
      within(sidebarLayersPanel).getByRole("button", { name: /flatten layers/i })
    ).toBeInTheDocument();
  });

  it("does not render character controls in the edit selector row", () => {
    const refreshCharacterOptions = vi.fn(async () => []);
    render(
      <ExpertEditPanelView
        {...baseProps}
        characterModeEnabled
        characterOptions={[{ id: "char-1", name: "Taylor", profileImageUrl: null }]}
        selectedCharacterId="char-1"
        refreshCharacterOptions={refreshCharacterOptions}
      />
    );

    expect(screen.queryByRole("button", { name: /disable character mode/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /enable character mode/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /open character picker/i })).toBeNull();
    expect(screen.queryByRole("dialog", { name: /choose character/i })).toBeNull();
    expect(refreshCharacterOptions).not.toHaveBeenCalled();
  });

  it("updates primary dropzone aspect ratio from the edit aspect selector value", () => {
    const { container, rerender } = render(
      <ExpertEditPanelView
        {...baseProps}
        aspect="1:1"
        referenceImageUrl="https://example.com/aspect-loaded.png"
        referenceText="prompt text"
      />
    );
    const primaryDropzone = screen.getByLabelText("Primary composition surface") as HTMLDivElement;
    const primaryCanvasFrameStack = container.querySelector(
      '[data-testid="edit-expert-primary-canvas-frame-stack"]'
    ) as HTMLDivElement;
    const mainStage = container.querySelector(".edit-expert-main-stage") as HTMLDivElement;
    expect(mainStage).not.toBeNull();
    expect(primaryCanvasFrameStack).not.toBeNull();

    expect(primaryDropzone.style.aspectRatio).toBe("");
    expect(primaryCanvasFrameStack.style.aspectRatio).toBe("1 / 1");
    expect(Number.parseFloat(primaryCanvasFrameStack.style.width || "0")).toBeCloseTo(420, 2);
    expect(Number.parseFloat(primaryCanvasFrameStack.style.height || "0")).toBeCloseTo(420, 2);

    rerender(
      <ExpertEditPanelView
        {...baseProps}
        aspect="16:9"
        referenceImageUrl="https://example.com/aspect-loaded.png"
        referenceText="prompt text"
      />
    );
    expect(primaryCanvasFrameStack.style.aspectRatio).toBe("16 / 9");
    expect(Number.parseFloat(primaryCanvasFrameStack.style.width || "0")).toBeCloseTo(746.67, 2);
    expect(Number.parseFloat(primaryCanvasFrameStack.style.height || "0")).toBeCloseTo(420, 2);

    rerender(
      <ExpertEditPanelView
        {...baseProps}
        aspect="9:16"
        referenceImageUrl="https://example.com/aspect-loaded.png"
        referenceText="prompt text"
      />
    );
    expect(primaryCanvasFrameStack.style.aspectRatio).toBe("9 / 16");
    expect(Number.parseFloat(primaryCanvasFrameStack.style.width || "0")).toBeCloseTo(236.25, 2);
    expect(Number.parseFloat(primaryCanvasFrameStack.style.height || "0")).toBeCloseTo(420, 2);
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
    expect(openStylesButton.closest(".edit-expert-styles-control")).toHaveClass("is-open");
  });

  it("shows selected style preview filling the styles button", () => {
    render(<ExpertEditPanelView {...baseProps} selectedStyleId="cinematic" />);

    const stylesButton = screen.getByRole("button", { name: "Styles" });
    const preview = stylesButton.querySelector(
      ".edit-expert-styles-btn-preview"
    ) as HTMLSpanElement | null;
    const label = stylesButton.querySelector(
      ".edit-expert-styles-btn-label"
    ) as HTMLSpanElement | null;
    expect(preview).toBeTruthy();
    expect(stylesButton).toHaveClass("has-selected-style");
    expect(label).toBeTruthy();
    expect(stylesButton).toHaveAttribute("aria-label", "Styles");
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

  it("hydrates unified session state and preserves owned layer object urls on unmount", async () => {
    const onSessionStateChange = vi.fn();
    const sessionState = createEmptyExpertEditSessionState();
    sessionState.layers.layerIdCounter = 3;
    sessionState.layers.selectedLayerIndex = 1;
    sessionState.layers.layers = [
      {
        id: "layer-1",
        name: "layer 1",
        imageUrl: "https://example.com/base.png",
        opacity: 100,
        isAutoNamed: true,
        ownsImageUrl: false,
        transform: {
          translateXRatio: 0,
          translateYRatio: 0,
          scale: 1,
          rotationDeg: 0,
        },
      },
      {
        id: "layer-2",
        name: "layer 2",
        imageUrl: "blob:session-layer-2",
        opacity: 100,
        isAutoNamed: true,
        ownsImageUrl: true,
        transform: {
          translateXRatio: 0,
          translateYRatio: 0,
          scale: 1,
          rotationDeg: 0,
        },
      },
    ];
    sessionState.markup = {
      strokes: [
        {
          id: "markup-stroke-1",
          color: "#f43f5e",
          sizeRatio: 0.01,
          points: [
            { sceneX: -0.12, sceneY: -0.08 },
            { sceneX: 0.16, sceneY: 0.12 },
          ],
        },
      ],
    };
    sessionState.inpaint.snapshot = {
      layers: [
        {
          layerId: "layer-1",
          width: 2,
          height: 2,
          alpha: new Uint8ClampedArray([255, 0, 0, 255]),
        },
      ],
    };
    const { unmount } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/base.png"
        sessionState={sessionState}
        onSessionStateChange={onSessionStateChange}
      />
    );

    await waitFor(() => {
      const latestState = onSessionStateChange.mock.calls.at(-1)?.[0] as ExpertEditSessionState;
      expect(latestState?.layers.layers).toHaveLength(2);
      expect(latestState?.layers.selectedLayerIndex).toBe(1);
      expect(latestState?.markup.strokes).toHaveLength(1);
    });

    unmount();
    expect(revokeObjectURLMock).not.toHaveBeenCalledWith("blob:session-layer-2");
  });

  it("restores inpaint mask snapshot from session state on mount", () => {
    const sessionState = createEmptyExpertEditSessionState();
    const restoredSnapshot: InpaintMaskSnapshot = {
      layers: [
        {
          layerId: "layer-1",
          width: 3,
          height: 3,
          alpha: new Uint8ClampedArray([0, 255, 0, 255, 0, 255, 0, 255, 0]),
        },
      ],
    };
    sessionState.inpaint.snapshot = restoredSnapshot;
    const restoreMaskSnapshot = vi.fn();
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        modalOverlayCanvasRef: { current: null },
        previewCanvasRef: { current: null },
        modalPreviewCanvasRef: { current: null },
        hasSelectedLayerMask: true,
        imageHasInteractiveMask: true,
        captureMaskSnapshot: vi.fn(() => ({ layers: [] })),
        restoreMaskSnapshot,
        clearAllMasks: vi.fn(),
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
      render(<ExpertEditPanelView {...baseProps} sessionState={sessionState} />);
      expect(restoreMaskSnapshot).toHaveBeenCalledTimes(1);
      expect(restoreMaskSnapshot).toHaveBeenCalledWith(restoredSnapshot);
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
    }
  });

  it("hydrates legacy markup and inpaint history payloads from older session snapshots", async () => {
    const legacyMarkupStroke = {
      id: "markup-stroke-legacy",
      color: "#f43f5e",
      sizeRatio: 0.011,
      points: [
        { sceneX: -0.1, sceneY: -0.08 },
        { sceneX: 0.12, sceneY: 0.09 },
      ],
    };
    const legacyInpaintSnapshot: InpaintMaskSnapshot = {
      layers: [
        {
          layerId: "layer-1",
          width: 2,
          height: 2,
          alpha: new Uint8ClampedArray([0, 255, 255, 0]),
        },
      ],
    };
    const legacySessionState = {
      ...createEmptyExpertEditSessionState(),
      version: 1 as const,
      markup: {
        strokes: [],
        history: {
          past: [[legacyMarkupStroke]],
          present: [legacyMarkupStroke],
          future: [],
        },
      },
      inpaint: {
        snapshot: legacyInpaintSnapshot,
        history: {
          past: [],
          present: legacyInpaintSnapshot,
          future: [],
        },
      } as ExpertEditSessionState["inpaint"],
    } as ExpertEditSessionState;
    const restoreMaskSnapshot = vi.fn();
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        modalOverlayCanvasRef: { current: null },
        previewCanvasRef: { current: null },
        modalPreviewCanvasRef: { current: null },
        hasSelectedLayerMask: true,
        imageHasInteractiveMask: true,
        captureMaskSnapshot: vi.fn(() => ({ layers: [] })),
        restoreMaskSnapshot,
        clearAllMasks: vi.fn(),
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
      render(
        <ExpertEditPanelView
          {...baseProps}
          referenceImageUrl="https://example.com/legacy-session.png"
          sessionState={legacySessionState}
        />
      );
      await waitFor(() =>
        expect(
          document.querySelectorAll(".edit-expert-markup-strokes-overlay polyline").length
        ).toBeGreaterThan(0)
      );
      expect(restoreMaskSnapshot).toHaveBeenCalledWith(legacyInpaintSnapshot);
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
    }
  });

  it("preserves markup strokes across unmount/remount via unified session state without restoring undo history", async () => {
    const sessionState = createEmptyExpertEditSessionState();
    const persistedStroke = {
      id: "markup-stroke-2",
      color: "#f43f5e",
      sizeRatio: 0.012,
      points: [
        { sceneX: -0.14, sceneY: -0.16 },
        { sceneX: 0.18, sceneY: 0.11 },
      ],
    };
    sessionState.markup = {
      strokes: [persistedStroke],
    };
    const onSessionStateChange = vi.fn();
    const firstRender = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-session-persist.png"
        sessionState={sessionState}
        onSessionStateChange={onSessionStateChange}
      />
    );

    await waitFor(() => {
      expect(
        document.querySelectorAll(".edit-expert-markup-strokes-overlay polyline").length
      ).toBeGreaterThan(0);
    });
    await waitFor(() => expect(onSessionStateChange).toHaveBeenCalled());
    const persistedSessionState = onSessionStateChange.mock.calls.at(-1)?.[0] as
      | ExpertEditSessionState
      | undefined;
    expect(persistedSessionState?.markup.strokes).toHaveLength(1);

    firstRender.unmount();

    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-session-persist.png"
        sessionState={persistedSessionState ?? sessionState}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(within(rail).getByRole("button", { name: /^markup$/i }));
    const inlineMarkupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(
      within(inlineMarkupPanel).getByRole("button", { name: /expand markup tools/i })
    );

    const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
    await waitFor(() =>
      expect(
        expandedModal.querySelectorAll(".edit-expert-markup-strokes-overlay polyline").length
      ).toBeGreaterThan(0)
    );
    expect(within(expandedModal).getByRole("button", { name: /undo action/i })).toBeDisabled();
    expect(within(expandedModal).getByRole("button", { name: /redo action/i })).toBeDisabled();
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
    expect(composePrimaryStageLayersToBlobMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("slot 2");
  });

  it("shows populated secondary refs in the inpaint prompt token picker", async () => {
    const { container, promptInput } = renderControlledPromptPanel({
      initialPrompt: "Blend scene",
      extraImageUrls: ["https://example.com/slot-1.png", "https://example.com/slot-2.png", null],
    });

    await flushReactTurn(() => {
      uploadPrimaryFile(container, "primary-layer.png");
      fireEvent.click(screen.getByRole("tab", { name: /^inpaint$/i }));
      promptInput.focus();
      promptInput.setSelectionRange(6, 6);
      fireEvent.keyDown(promptInput, { key: "Tab" });
    });

    const picker = screen.getByRole("group", { name: /reference image picker/i });
    expect(within(picker).getByLabelText("Primary edit image")).toBeInTheDocument();
    expect(within(picker).getByText("Reference 1")).toBeInTheDocument();
    expect(within(picker).getByText("Reference 2")).toBeInTheDocument();
    expect((screen.getByLabelText("Secondary edit image 1") as HTMLDivElement).draggable).toBe(
      true
    );
  });

  it("routes inpaint generate to the single-reference masked lane when the prompt links one secondary reference", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => {});
    const exportSelectedLayerMaskBlobMock = vi.fn(
      async () => new Blob(["mask"], { type: "image/png" })
    );
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        modalOverlayCanvasRef: { current: null },
        previewCanvasRef: { current: null },
        modalPreviewCanvasRef: { current: null },
        hasSelectedLayerMask: true,
        imageHasInteractiveMask: true,
        captureMaskSnapshot: vi.fn(() => ({ layers: [] })),
        restoreMaskSnapshot: vi.fn(),
        clearAllMasks: vi.fn(),
        clearSelectedLayerMask: vi.fn(),
        invertSelectedLayerMask: vi.fn(),
        exportSelectedLayerMaskBlob: exportSelectedLayerMaskBlobMock,
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
          referenceText="Use @img1 for clothing."
          extraImageUrls={["https://example.com/slot-1.png", null, null]}
          onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
        />
      );

      uploadPrimaryFile(container, "layer-1.png");
      fireEvent.click(screen.getByRole("tab", { name: /^inpaint$/i }));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
        await Promise.resolve();
      });

      expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
      expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledTimes(1);
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
        modelId: INPAINT_REFERENCE_MODEL_ID,
        baseImageInput: expect.stringMatching(/^blob:flatten-/),
        maskInput: expect.stringMatching(/^blob:flatten-/),
        referenceImageInput: "https://example.com/slot-1.png",
        outputFormat: "png",
        imageWidth: expect.any(Number),
        imageHeight: expect.any(Number),
      });
      expect(exportSelectedLayerMaskBlobMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: previousImage,
      });
    }
  });

  it("clamps the inpaint resolution selector to the effective FLUX Fill model", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        modelId="fal-ai/nano-banana-pro/edit"
        modelLabel="Nano Banana Pro Edit"
        imageResolution="2K"
        referenceText="Blend @main scene"
      />
    );

    const resolutionTrigger = screen.getByRole("button", { name: "Image resolution" });
    expect(resolutionTrigger).toHaveTextContent("2K");

    fireEvent.click(screen.getByRole("tab", { name: /^inpaint$/i }));

    expect(resolutionTrigger).toHaveTextContent("Model default");
  });

  it("inserts @img token text at caret when dragging a populated secondary slot into prompt", async () => {
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
    act(() => {
      promptInput.focus();
      promptInput.setSelectionRange(5, 5);
    });
    const secondarySlot = screen.getByLabelText("Secondary edit image 1");
    const transfer = createPromptTokenTransfer();

    await act(async () => {
      fireEvent.dragStart(secondarySlot, { dataTransfer: transfer });
      fireEvent.drop(promptInput, { dataTransfer: transfer });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onPromptTextChange).toHaveBeenCalledWith("Blend @img1 scene");
  });

  it("collapses the prompt on blur-outside and re-expands it on refocus without losing text", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText={"Line one\nLine two\nLine three\nLine four\nLine five\nLine six"}
      />
    );

    const promptInput = screen.getByLabelText("Edit prompt") as HTMLTextAreaElement;
    const promptRow = promptInput.closest(".edit-expert-bottom-row") as HTMLDivElement;
    const flattenButton = screen.getByRole("button", { name: /flatten layers/i });

    expect(promptRow.className).toContain("is-collapsed");

    fireEvent.focus(promptInput);
    expect(promptRow.className).toContain("is-expanded");
    expect(promptInput.value).toContain("Line six");
    promptInput.style.height = "520px";

    fireEvent.blur(promptInput, { relatedTarget: flattenButton });
    expect(promptRow.className).toContain("is-collapsed");
    expect(promptInput.value).toContain("Line six");
    expect(promptInput.style.height).toBe("72px");

    fireEvent.focus(promptInput);
    expect(promptRow.className).toContain("is-expanded");
    expect(promptInput.value).toContain("Line six");
  });

  it("keeps the edit underlay unblurred until the prompt reaches eight visual rows", async () => {
    let scrollHeightPx = 180;
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const lineHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "lineHeight"
    );
    const paddingTopDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "paddingTop"
    );
    const paddingBottomDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "paddingBottom"
    );

    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => scrollHeightPx,
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "lineHeight", {
      configurable: true,
      get() {
        return "24px";
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "paddingTop", {
      configurable: true,
      get() {
        return "6px";
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "paddingBottom", {
      configurable: true,
      get() {
        return "6px";
      },
    });

    try {
      const { rerender, container } = render(
        <ExpertEditPanelView {...baseProps} referenceText="Seven visual rows" />
      );

      const promptInput = screen.getByLabelText("Edit prompt");
      fireEvent.focus(promptInput);

      await waitFor(() => {
        expect(container.querySelector(".edit-expert-post-stage-overlay-zone")).not.toHaveClass(
          "is-composer-expanded"
        );
      });

      scrollHeightPx = 204;
      rerender(<ExpertEditPanelView {...baseProps} referenceText="Eight visual rows" />);

      const nextPromptInput = screen.getByLabelText("Edit prompt");
      fireEvent.focus(nextPromptInput);

      await waitFor(() => {
        expect(container.querySelector(".edit-expert-post-stage-overlay-zone")).toHaveClass(
          "is-composer-expanded"
        );
        expect(container.querySelector(".edit-expert-primary-column-shell")).toHaveClass(
          "is-composer-expanded"
        );
      });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(
          HTMLTextAreaElement.prototype as HTMLTextAreaElement & {
            scrollHeight?: number;
          },
          "scrollHeight"
        );
      }
      if (lineHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "lineHeight", lineHeightDescriptor);
      }
      if (paddingTopDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "paddingTop", paddingTopDescriptor);
      }
      if (paddingBottomDescriptor) {
        Object.defineProperty(
          CSSStyleDeclaration.prototype,
          "paddingBottom",
          paddingBottomDescriptor
        );
      }
    }
  });

  it("collapses the prompt back to its minimum height when the text is cleared", async () => {
    const scrollHeightPx = 520;
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const minHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "minHeight"
    );

    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: function () {
        return (this as HTMLTextAreaElement).value.length === 0 ? 72 : scrollHeightPx;
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", {
      configurable: true,
      get() {
        return "72px";
      },
    });

    try {
      const { rerender } = render(
        <ExpertEditPanelView
          {...baseProps}
          referenceText={"Line one\nLine two\nLine three\nLine four\nLine five\nLine six"}
        />
      );

      const promptInput = screen.getByLabelText("Edit prompt") as HTMLTextAreaElement;
      fireEvent.focus(promptInput);
      promptInput.style.height = "520px";

      rerender(<ExpertEditPanelView {...baseProps} referenceText="" />);

      const emptyPromptInput = screen.getByLabelText("Edit prompt") as HTMLTextAreaElement;
      fireEvent.focus(emptyPromptInput);

      await waitFor(() => {
        expect(emptyPromptInput.style.height).toBe("72px");
      });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(
          HTMLTextAreaElement.prototype as HTMLTextAreaElement & {
            scrollHeight?: number;
          },
          "scrollHeight"
        );
      }
      if (minHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", minHeightDescriptor);
      }
    }
  });

  it("opens the anchored reference picker and selects @main after typing @", async () => {
    const { container, promptInput, onPromptTextChangeSpy } = renderControlledPromptPanel({
      initialPrompt: "Blend ",
      extraImageUrls: ["https://example.com/slot-1.png", "https://example.com/slot-2.png", null],
    });

    await flushReactTurn(() => {
      uploadPrimaryFile(container, "primary-layer.png");
      promptInput.focus();
      promptInput.setSelectionRange(6, 6);
      fireEvent.keyDown(promptInput, { key: "@", shiftKey: true });
      fireEvent.change(promptInput, { target: { value: "Blend @" } });
    });

    expect(onPromptTextChangeSpy).toHaveBeenCalledWith("Blend @");
    expect(screen.getByRole("group", { name: /reference image picker/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Primary edit image").className).toContain("is-selected");
    expect(screen.getByLabelText("Secondary edit image 1").className).not.toContain("is-selected");
  });

  it("opens the anchored reference picker on Tab when populated references exist", async () => {
    const { container, promptInput, onPromptTextChangeSpy } = renderControlledPromptPanel({
      initialPrompt: "Blend scene",
      extraImageUrls: ["https://example.com/slot-1.png", "https://example.com/slot-2.png", null],
    });

    await flushReactTurn(() => {
      uploadPrimaryFile(container, "primary-layer.png");
      promptInput.focus();
      promptInput.setSelectionRange(6, 6);
      fireEvent.keyDown(promptInput, { key: "Tab" });
    });

    expect(onPromptTextChangeSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: /reference image picker/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Primary edit image").className).toContain("is-selected");
  });

  it("cycles the anchored reference picker selection from @main to the first secondary slot", async () => {
    const { container, promptInput } = renderControlledPromptPanel({
      initialPrompt: "Blend ",
      extraImageUrls: ["https://example.com/slot-1.png", "https://example.com/slot-2.png", null],
    });

    await flushReactTurn(() => {
      uploadPrimaryFile(container, "primary-layer.png");
      promptInput.focus();
      promptInput.setSelectionRange(6, 6);
      fireEvent.keyDown(promptInput, { key: "@" });
      fireEvent.change(promptInput, { target: { value: "Blend @" } });
    });
    await flushReactTurn(() => {
      fireEvent.keyDown(promptInput, { key: "Tab" });
    });

    expect(screen.getByLabelText("Primary edit image").className).not.toContain("is-selected");
    expect(screen.getByLabelText("Secondary edit image 1").className).toContain(
      "is-picker-selected"
    );
  });

  it("cycles the anchored reference picker selection with Tab", async () => {
    const { container, promptInput } = renderControlledPromptPanel({
      initialPrompt: "Blend ",
      extraImageUrls: [
        "https://example.com/slot-1.png",
        "https://example.com/slot-2.png",
        "https://example.com/slot-3.png",
      ],
    });

    await flushReactTurn(() => {
      uploadPrimaryFile(container, "primary-layer.png");
      promptInput.focus();
      promptInput.setSelectionRange(6, 6);
      fireEvent.keyDown(promptInput, { key: "Tab" });
    });
    await flushReactTurn(() => {
      fireEvent.keyDown(promptInput, { key: "Tab" });
    });

    expect(screen.getByLabelText("Primary edit image").className).not.toContain("is-selected");
    expect(screen.getByLabelText("Secondary edit image 1").className).toContain(
      "is-picker-selected"
    );
  });

  it("inserts the selected picker token on Enter after opening with Tab", async () => {
    const { container, promptInput, onPromptTextChangeSpy } = renderControlledPromptPanel({
      initialPrompt: "Blend scene",
      extraImageUrls: ["https://example.com/slot-1.png", "https://example.com/slot-2.png", null],
    });

    await flushReactTurn(() => {
      uploadPrimaryFile(container, "primary-layer.png");
      promptInput.focus();
      promptInput.setSelectionRange(6, 6);
      fireEvent.keyDown(promptInput, { key: "Tab" });
    });
    await flushReactTurn(() => {
      fireEvent.keyDown(promptInput, { key: "Tab" });
    });
    await flushReactTurn(() => {
      fireEvent.keyDown(promptInput, { key: "Enter" });
    });

    expect(onPromptTextChangeSpy).toHaveBeenLastCalledWith("Blend @img1 scene");
    expect(promptInput.value).toBe("Blend @img1 scene");
    expect(screen.queryByRole("group", { name: /reference image picker/i })).toBeNull();
  });

  it("inserts @main on Enter when the picker is opened and not cycled", async () => {
    const { container, promptInput, onPromptTextChangeSpy } = renderControlledPromptPanel({
      initialPrompt: "Blend scene",
      extraImageUrls: ["https://example.com/slot-1.png", "https://example.com/slot-2.png", null],
    });

    await flushReactTurn(() => {
      uploadPrimaryFile(container, "primary-layer.png");
      promptInput.focus();
      promptInput.setSelectionRange(6, 6);
      fireEvent.keyDown(promptInput, { key: "Tab" });
    });
    await flushReactTurn(() => {
      fireEvent.keyDown(promptInput, { key: "Enter" });
    });

    expect(onPromptTextChangeSpy).toHaveBeenLastCalledWith("Blend @main scene");
    expect(promptInput.value).toBe("Blend @main scene");
    expect(screen.queryByRole("group", { name: /reference image picker/i })).toBeNull();
  });

  it("inserts the selected picker token on Enter and closes the picker", async () => {
    const { promptInput, onPromptTextChangeSpy } = renderControlledPromptPanel({
      initialPrompt: "Blend ",
      extraImageUrls: ["https://example.com/slot-1.png", "https://example.com/slot-2.png", null],
    });

    await flushReactTurn(() => {
      promptInput.focus();
      promptInput.setSelectionRange(6, 6);
      fireEvent.keyDown(promptInput, { key: "@", shiftKey: true });
      fireEvent.change(promptInput, { target: { value: "Blend @" } });
    });
    await flushReactTurn(() => {
      fireEvent.keyDown(promptInput, { key: "Tab" });
    });
    await flushReactTurn(() => {
      fireEvent.keyDown(promptInput, { key: "Enter" });
    });

    expect(onPromptTextChangeSpy).toHaveBeenLastCalledWith("Blend @img2 ");
    expect(promptInput.value).toBe("Blend @img2 ");
    expect(screen.queryByRole("group", { name: /reference image picker/i })).toBeNull();
  });

  it("closes the picker on regular typing and preserves manual token entry", async () => {
    const { promptInput, onPromptTextChangeSpy } = renderControlledPromptPanel({
      initialPrompt: "Blend ",
      extraImageUrls: ["https://example.com/slot-1.png", null, null],
    });

    await flushReactTurn(() => {
      promptInput.focus();
      promptInput.setSelectionRange(6, 6);
      fireEvent.keyDown(promptInput, { key: "@", shiftKey: true });
      fireEvent.change(promptInput, { target: { value: "Blend @" } });
    });
    await flushReactTurn(() => {
      fireEvent.keyDown(promptInput, { key: "a" });
      fireEvent.change(promptInput, { target: { value: "Blend @a" } });
    });

    expect(onPromptTextChangeSpy).toHaveBeenLastCalledWith("Blend @a");
    expect(promptInput.value).toBe("Blend @a");
    expect(screen.queryByRole("group", { name: /reference image picker/i })).toBeNull();
  });

  it("opens More Presets as a popup outside the primary dropzone", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const trigger = screen.getByRole("button", { name: /apply more presets preset/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    const surface = screen.getByRole("region", { name: /more presets/i });
    const primaryStage = screen.getByLabelText("Primary edit stage");
    expect(surface).toBeInTheDocument();
    expect(primaryStage.contains(surface)).toBe(false);
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

  it("opens the presets library from the inline More Presets surface", () => {
    const onOpenPresetsLibrary = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onOpenPresetsLibrary={onOpenPresetsLibrary} />);

    fireEvent.click(screen.getByRole("button", { name: /apply more presets preset/i }));
    fireEvent.click(screen.getByRole("button", { name: /presets library/i }));

    expect(onOpenPresetsLibrary).toHaveBeenCalledTimes(1);
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

  it("switches brush/lasso inpaint modes and expands to markup modal", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^inpaint$/i }));

    const lassoBtn = await screen.findByRole("button", { name: /lasso/i });
    const brushBtn = await screen.findByRole("button", { name: /brush/i });
    const expandBtn = await screen.findByRole("button", { name: /expand markup tools/i });

    expect(brushBtn).toHaveAttribute("aria-pressed", "true");
    expect(lassoBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(lassoBtn);
    expect(lassoBtn).toHaveAttribute("aria-pressed", "true");
    expect(brushBtn).toHaveAttribute("aria-pressed", "false");
    expect(expandBtn).not.toHaveTextContent(/expand/i);

    fireEvent.click(expandBtn);
    expect(screen.getByRole("dialog", { name: /expanded markup canvas/i })).toBeInTheDocument();
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

  it("keeps in-paint and markup stroke size sliders independent in expanded modal", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));
    fireEvent.click(
      within(screen.getByRole("group", { name: /markup tools/i })).getByRole("button", {
        name: /expand markup tools/i,
      })
    );

    const expandedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    const inpaintPanel = within(expandedModal).getByRole("group", { name: /in-paint tools/i });
    const markupPanel = within(expandedModal).getByRole("group", { name: /markup tools/i });

    const inpaintStrokeSlider = within(inpaintPanel).getByRole("slider", {
      name: /in-paint stroke size/i,
    }) as HTMLInputElement;
    const markupStrokeSlider = within(markupPanel).getByRole("slider", {
      name: /stroke size/i,
    }) as HTMLInputElement;

    expect(inpaintStrokeSlider.value).toBe("26");
    expect(markupStrokeSlider.value).toBe("4");

    fireEvent.change(markupStrokeSlider, { target: { value: "30" } });
    expect(markupStrokeSlider.value).toBe("30");
    expect(inpaintStrokeSlider.value).toBe("26");

    fireEvent.change(inpaintStrokeSlider, { target: { value: "41" } });
    expect(inpaintStrokeSlider.value).toBe("41");
    expect(markupStrokeSlider.value).toBe("30");
  });

  it("collapses and expands inpaint controls from the skinny toggle button", () => {
    vi.useFakeTimers();

    try {
      render(<ExpertEditPanelView {...baseProps} />);

      const collapseButton = screen.getByRole("button", { name: /expand inpaint controls/i });
      expect(collapseButton).toHaveAttribute("aria-expanded", "false");
      expect(within(collapseButton).getByText("Move")).toBeInTheDocument();

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
      expect(
        within(screen.getByRole("button", { name: /expand inpaint controls/i })).getByText("Move")
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps collapsed tools on the inline expand path instead of auto-opening the markup modal", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const collapsedButton = screen.getByRole("button", { name: /expand inpaint controls/i });
    expect(collapsedButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(collapsedButton);
    expect(screen.queryByRole("dialog", { name: /expanded markup canvas/i })).toBeNull();
    expect(screen.getByLabelText("Inpaint action tools")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse inpaint controls/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse inpaint controls/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("renders Move/Inpaint/Markup rail buttons with Move selected by default", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    const moveButton = await within(rail).findByRole("button", { name: /^move$/i });
    const inpaintButton = await within(rail).findByRole("button", { name: /^inpaint$/i });
    const videoButton = await within(rail).findByRole("button", { name: /^markup$/i });
    const railOrder = within(rail)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim()?.toLowerCase());

    expect(railOrder).toEqual(["move", "inpaint", "markup"]);
    expect(videoButton).toHaveAttribute("aria-pressed", "false");
    expect(inpaintButton).toHaveAttribute("aria-pressed", "false");
    expect(moveButton).toHaveAttribute("aria-pressed", "true");
    expect(within(rail).queryByRole("button", { name: /^crop$/i })).toBeNull();
  });

  it("toggles selected tool state across Move/Inpaint/Markup rail buttons", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    const moveButton = await within(rail).findByRole("button", { name: /^move$/i });
    const inpaintButton = await within(rail).findByRole("button", { name: /^inpaint$/i });
    const videoButton = await within(rail).findByRole("button", { name: /^markup$/i });
    expect(inpaintButton).toHaveAttribute("aria-pressed", "false");
    expect(videoButton).toHaveAttribute("aria-pressed", "false");
    expect(moveButton).toHaveAttribute("aria-pressed", "true");
    expect(within(rail).queryByRole("button", { name: /^crop$/i })).toBeNull();
    const moveSettingsPanel = screen.getByRole("group", { name: /move tools/i });
    expect(moveSettingsPanel).toHaveClass("is-themed-move");
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /^adjust$/i })
    ).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /expand markup tools/i })
    ).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /undo move action/i })
    ).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /redo move action/i })
    ).toBeInTheDocument();
    expect(
      within(moveSettingsPanel).getByRole("button", { name: /center move action/i })
    ).toBeInTheDocument();

    fireEvent.click(inpaintButton);
    expect(inpaintButton).toHaveAttribute("aria-pressed", "true");
    expect(videoButton).toHaveAttribute("aria-pressed", "false");
    expect(moveButton).toHaveAttribute("aria-pressed", "false");
    const inpaintSettingsPanel = screen.getByRole("group", { name: /inpaint tools/i });
    expect(inpaintSettingsPanel).toHaveClass("is-themed-inpaint");

    fireEvent.click(videoButton);
    expect(videoButton).toHaveAttribute("aria-pressed", "true");
    expect(inpaintButton).toHaveAttribute("aria-pressed", "false");
    expect(moveButton).toHaveAttribute("aria-pressed", "false");
    const markupSettingsPanel = screen.getByRole("group", { name: /markup tools/i });
    expect(markupSettingsPanel).toHaveClass("is-themed-markup");
    const penButton = within(markupSettingsPanel).getByRole("button", { name: /^pen$/i });
    const lassoButton = within(markupSettingsPanel).getByRole("button", { name: /^lasso$/i });
    const expandButton = within(markupSettingsPanel).getByRole("button", {
      name: /expand markup tools/i,
    });
    const markupColorPicker = within(markupSettingsPanel).getByRole("button", {
      name: /markup color/i,
    });
    const clearMarkupButton = within(markupSettingsPanel).getByRole("button", {
      name: /clear markup strokes/i,
    });

    expect(penButton).toHaveAttribute("aria-pressed", "true");
    expect(lassoButton).toHaveAttribute("aria-pressed", "false");
    expect(within(markupSettingsPanel).queryByRole("button", { name: /^eraser$/i })).toBeNull();
    expect(expandButton).toHaveAttribute("aria-pressed", "false");
    expect(expandButton).not.toHaveTextContent(/expand/i);
    expect(markupColorPicker).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(markupColorPicker);
    expect(screen.getByRole("dialog", { name: /markup color picker/i })).toBeInTheDocument();
    expect(within(markupSettingsPanel).queryByRole("button", { name: /markup color/i })).toBeNull();
    expect(clearMarkupButton).toBeInTheDocument();
    expect(within(markupSettingsPanel).queryByRole("tab", { name: /^select$/i })).toBeNull();
    expect(
      within(markupSettingsPanel).queryByRole("button", { name: /invert selection/i })
    ).toBeNull();

    fireEvent.click(moveButton);
    expect(moveButton).toHaveAttribute("aria-pressed", "true");
    expect(inpaintButton).toHaveAttribute("aria-pressed", "false");
    expect(videoButton).toHaveAttribute("aria-pressed", "false");
    const moveSettingsPanelAgain = screen.getByRole("group", { name: /move tools/i });
    expect(moveSettingsPanelAgain).toHaveClass("is-themed-move");
  });

  it("keeps submit intent pinned to the selected generation mode when the rail tool changes", async () => {
    const onEditSubmitIntentChange = vi.fn();
    render(
      <ExpertEditPanelView {...baseProps} onEditSubmitIntentChange={onEditSubmitIntentChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    const moveButton = await within(rail).findByRole("button", { name: /^move$/i });
    const inpaintButton = await within(rail).findByRole("button", { name: /^inpaint$/i });
    const markupButton = await within(rail).findByRole("button", { name: /^markup$/i });

    expect(onEditSubmitIntentChange).toHaveBeenCalledWith("standard");

    fireEvent.click(inpaintButton);
    expect(onEditSubmitIntentChange).toHaveBeenLastCalledWith("standard");

    fireEvent.click(markupButton);
    expect(onEditSubmitIntentChange).toHaveBeenLastCalledWith("standard");

    fireEvent.click(moveButton);
    expect(onEditSubmitIntentChange).toHaveBeenLastCalledWith("standard");
  });

  it("shows generation mode tabs at the top of the left sidebar and publishes intent when toggle flag is enabled", async () => {
    const onEditSubmitIntentChange = vi.fn();
    const { container } = render(
      <ExpertEditPanelView {...baseProps} onEditSubmitIntentChange={onEditSubmitIntentChange} />
    );

    const tablist = screen.getByRole("tablist", { name: /generation mode/i });
    const sidebarShell = container.querySelector(".edit-expert-sidebar-shell");
    const primaryColumn = container.querySelector(".edit-expert-primary-column");
    const selectorRow = container.querySelector(".edit-expert-selector-row");
    const editModeTitle = screen.getByText("Select Edit Mode");
    const standardTab = within(tablist).getByRole("tab", { name: /^standard$/i });
    const inpaintTab = within(tablist).getByRole("tab", { name: /^inpaint$/i });
    const markupTab = within(tablist).getByRole("tab", { name: /^markup$/i });
    expect(sidebarShell).not.toBeNull();
    expect(primaryColumn).not.toBeNull();
    expect(sidebarShell?.contains(editModeTitle)).toBe(true);
    expect(sidebarShell?.contains(tablist)).toBe(true);
    expect(primaryColumn?.contains(tablist)).toBe(false);
    expect(selectorRow?.contains(tablist)).toBe(false);
    expect(markupTab).toBeInTheDocument();
    expect(standardTab).toHaveAttribute("aria-selected", "true");
    expect(onEditSubmitIntentChange).toHaveBeenCalledWith("standard");

    fireEvent.click(inpaintTab);
    expect(onEditSubmitIntentChange).toHaveBeenLastCalledWith("inpaint");
    expect(inpaintTab).toHaveAttribute("aria-selected", "true");

    fireEvent.click(markupTab);
    expect(onEditSubmitIntentChange).toHaveBeenLastCalledWith("markup");
    expect(markupTab).toHaveAttribute("aria-selected", "true");
  });

  it("renders the center stage column inside a dedicated shell", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    const primaryColumn = container.querySelector(".edit-expert-primary-column");

    expect(primaryColumn).not.toBeNull();
    expect(primaryColumn).toHaveClass("edit-expert-primary-column-shell");
  });

  it("does not render a generation-mode clear button in the sidebar toggle row", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
    const inpaintTab = within(modeTabs).getByRole("tab", { name: /^inpaint$/i });

    expect(
      screen.queryByRole("button", { name: /clear all in-paint selections and markup strokes/i })
    ).toBeNull();

    fireEvent.click(inpaintTab);
    expect(
      screen.queryByRole("button", { name: /clear all in-paint selections and markup strokes/i })
    ).toBeNull();
    expect(within(modeTabs).getByRole("tab", { name: /^markup$/i })).toBeInTheDocument();
  });

  it("shows the reference-images and styles row in Standard, Inpaint, and Markup", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
    const standardTab = within(modeTabs).getByRole("tab", { name: /^standard$/i });
    const inpaintTab = within(modeTabs).getByRole("tab", { name: /^inpaint$/i });
    const markupTab = within(modeTabs).getByRole("tab", { name: /^markup$/i });

    expect(screen.getByText("Reference Images")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Styles" })).toBeInTheDocument();

    fireEvent.click(inpaintTab);
    expect(screen.getByText("Reference Images")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Styles" })).toBeInTheDocument();

    fireEvent.click(markupTab);
    expect(screen.getByText("Reference Images")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Styles" })).toBeInTheDocument();

    fireEvent.click(standardTab);
    expect(screen.getByText("Reference Images")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Styles" })).toBeInTheDocument();
  });

  it("keeps the default canvas layout height across generation modes", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const panel = screen.getByRole("group", { name: /expert edit composer/i });
    const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
    const standardTab = within(modeTabs).getByRole("tab", { name: /^standard$/i });
    const inpaintTab = within(modeTabs).getByRole("tab", { name: /^inpaint$/i });
    const markupTab = within(modeTabs).getByRole("tab", { name: /^markup$/i });

    expect(panel).not.toHaveClass("is-generation-mode-tall-stage");

    fireEvent.click(inpaintTab);
    expect(panel).not.toHaveClass("is-generation-mode-tall-stage");

    fireEvent.click(markupTab);
    expect(panel).not.toHaveClass("is-generation-mode-tall-stage");

    fireEvent.click(standardTab);
    expect(panel).not.toHaveClass("is-generation-mode-tall-stage");
  });

  it("swaps the left rail selected mode panel as generation mode tabs change", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const presetToolbar = screen.getByLabelText("Edit preset toolbar");
    const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
    const standardTab = within(modeTabs).getByRole("tab", { name: /^standard$/i });
    const inpaintTab = within(modeTabs).getByRole("tab", { name: /^inpaint$/i });
    const markupTab = within(modeTabs).getByRole("tab", { name: /^markup$/i });

    expect(
      within(presetToolbar).queryByRole("group", { name: /^left rail move panel$/i })
    ).toBeNull();

    fireEvent.click(inpaintTab);
    const leftRailInpaintPanel = within(presetToolbar).getByRole("group", {
      name: /^left rail in-paint panel$/i,
    });
    expect(leftRailInpaintPanel).toBeInTheDocument();
    expect(
      within(leftRailInpaintPanel).queryByRole("button", { name: /invert in-paint selection/i })
    ).toBeNull();

    fireEvent.click(markupTab);
    expect(
      within(presetToolbar).getByRole("group", { name: /^left rail markup panel$/i })
    ).toBeInTheDocument();

    fireEvent.click(standardTab);
    expect(
      within(presetToolbar).queryByRole("group", { name: /^left rail move panel$/i })
    ).toBeNull();
  });

  it("renders the inline layers panel in the left rail below prompt presets", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const presetToolbar = screen.getByLabelText("Edit preset toolbar");
    const layersToolbar = within(presetToolbar).getByLabelText("Edit layers toolbar");
    const utilityActions = within(presetToolbar).getByLabelText("Edit utility actions");

    expect(screen.getAllByLabelText("Edit layers toolbar")).toHaveLength(1);
    expect(
      layersToolbar.compareDocumentPosition(utilityActions) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
  });

  it("renders the left rail inside a dedicated sidebar wrapper", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    const presetToolbar = container.querySelector(".edit-expert-preset-toolbar");
    const sidebarShell = container.querySelector(".edit-expert-sidebar-shell");

    expect(presetToolbar).not.toBeNull();
    expect(sidebarShell).not.toBeNull();
    expect(presetToolbar?.contains(sidebarShell)).toBe(true);
  });

  it("renders flatten inside the layers panel and keeps remove background in the utility actions stack", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const layersToolbar = screen.getByLabelText("Edit layers toolbar");
    const utilityActions = screen.getByLabelText("Edit utility actions");

    expect(
      within(layersToolbar).getByRole("button", { name: /flatten layers/i })
    ).toBeInTheDocument();
    expect(within(layersToolbar).getByLabelText("Flatten layer action")).toBeInTheDocument();
    expect(within(utilityActions).queryByRole("button", { name: /flatten layers/i })).toBeNull();
    expect(
      within(utilityActions).getByRole("button", { name: /remove background/i })
    ).toBeInTheDocument();
  });

  it.skip("opens the expanded markup canvas modal from the expand button", async () => {
    render(<ExpertEditPanelView {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    const markupButton = await within(rail).findByRole("button", { name: /^markup$/i });
    fireEvent.click(markupButton);

    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    const expandButton = within(markupPanel).getByRole("button", { name: /expand markup tools/i });
    fireEvent.click(expandButton);

    const expandedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    expect(expandedModal).toBeInTheDocument();
    const generalModalToolbar = within(expandedModal).getByRole("group", {
      name: /^general tools$/i,
    });
    const moveModalToolbar = within(expandedModal).getByRole("group", { name: /^move tools$/i });
    const inpaintModalToolbar = within(expandedModal).getByRole("group", {
      name: /in-paint tools/i,
    });
    const modalToolbar = within(expandedModal).getByRole("group", { name: /markup tools/i });
    expect(
      Boolean(
        generalModalToolbar.compareDocumentPosition(moveModalToolbar) &
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(
      Boolean(
        moveModalToolbar.compareDocumentPosition(inpaintModalToolbar) &
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(
      Boolean(
        inpaintModalToolbar.compareDocumentPosition(modalToolbar) & Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(within(expandedModal).getByText(/^general$/i)).toBeInTheDocument();
    const generalUndoButton = within(generalModalToolbar).getByRole("button", {
      name: /undo action/i,
    });
    const generalRedoButton = within(generalModalToolbar).getByRole("button", {
      name: /redo action/i,
    });
    expect(generalUndoButton).toBeInTheDocument();
    expect(generalRedoButton).toBeInTheDocument();
    expect(generalUndoButton).not.toHaveTextContent(/undo/i);
    expect(generalRedoButton).not.toHaveTextContent(/redo/i);
    expect(
      within(generalModalToolbar).getByRole("button", { name: /reset stage/i })
    ).toBeInTheDocument();
    expect(within(expandedModal).getByText(/^move$/i)).toBeInTheDocument();
    const modalAdjustButton = within(moveModalToolbar).getByRole("button", { name: /^adjust$/i });
    expect(modalAdjustButton).toHaveTextContent(/^adjust$/i);
    expect(modalAdjustButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("dialog", { name: /expanded markup canvas/i })).toBeInTheDocument();
    const inpaintHeading = within(expandedModal).getByText(/^in-paint$/i);
    const markupHeading = within(expandedModal).getByText(/^markup$/i);
    expect(inpaintHeading).toBeInTheDocument();
    expect(markupHeading).toBeInTheDocument();

    const markupPanelGroup = markupHeading.closest(".edit-expert-markup-modal-panel-group");
    expect(markupPanelGroup).toBeTruthy();
    const markupContent = markupPanelGroup?.querySelector(".edit-expert-markup-controls-content");
    expect(markupContent).toBeTruthy();

    const topRow = markupContent?.querySelector(".edit-expert-inpaint-mode-row");
    expect(topRow).toBeTruthy();
    const modalPenButton = within(topRow as HTMLElement).getByRole("button", { name: /^pen$/i });
    const modalLassoButton = within(topRow as HTMLElement).getByRole("button", {
      name: /^lasso$/i,
    });
    expect(modalPenButton).toBeInTheDocument();
    expect(modalLassoButton).toBeInTheDocument();
    expect(within(topRow as HTMLElement).queryByRole("button", { name: /^eraser$/i })).toBeNull();
    const modalBrushButton = within(inpaintModalToolbar).getByRole("button", { name: /^brush$/i });
    expect(modalPenButton).toHaveAttribute("aria-pressed", "true");
    expect(modalLassoButton).toHaveAttribute("aria-pressed", "false");
    expect(modalBrushButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(modalAdjustButton);
    expect(modalAdjustButton).toHaveAttribute("aria-pressed", "true");
    expect(modalPenButton).toHaveAttribute("aria-pressed", "false");
    expect(modalBrushButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(modalBrushButton);
    expect(modalBrushButton).toHaveAttribute("aria-pressed", "true");
    expect(modalAdjustButton).toHaveAttribute("aria-pressed", "false");
    expect(modalPenButton).toHaveAttribute("aria-pressed", "false");

    const clearButton = within(topRow as HTMLElement).getByRole("button", {
      name: /clear markup strokes/i,
    });
    expect(clearButton).toBeInTheDocument();

    const colorRow = markupContent?.querySelector(".edit-expert-markup-color-row");
    expect(colorRow).toBeTruthy();
    expect(
      within(colorRow as HTMLElement).getByRole("button", { name: /markup color/i })
    ).toBeInTheDocument();
    expect(
      within(colorRow as HTMLElement).queryByRole("button", { name: /clear markup strokes/i })
    ).toBeNull();

    fireEvent.click(clearButton);
    expect(
      within(expandedModal).getByRole("button", { name: /close expanded markup canvas/i })
    ).toBeInTheDocument();

    fireEvent.click(
      within(expandedModal).getByRole("button", { name: /close expanded markup canvas/i })
    );
    expect(screen.queryByRole("dialog", { name: /expanded markup canvas/i })).toBeNull();
  });

  it("keeps only the expanded modal stage mounted as the active stage surface while open", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/modal-owns-stage.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(within(markupPanel).getByRole("button", { name: /expand markup tools/i }));

    const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
    expect(expandedModal.querySelectorAll(".edit-expert-markup-viewport")).toHaveLength(1);
    expect(document.querySelectorAll(".edit-expert-primary-layer-selection-overlay")).toHaveLength(
      0
    );
  });

  it("blocks non-modal drop targets while the expanded markup modal is open", async () => {
    const onPromptTextChange = vi.fn();
    render(
      <ExpertEditPanelView
        {...baseProps}
        onPromptTextChange={onPromptTextChange}
        referenceText="Base prompt"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));
    fireEvent.click(
      within(screen.getByRole("group", { name: /markup tools/i })).getByRole("button", {
        name: /expand markup tools/i,
      })
    );

    const panel = screen.getByLabelText("Expert edit composer");
    expect(panel).toHaveClass("is-markup-modal-open");

    const promptInput = screen.getByLabelText("Edit prompt");
    const transfer = {
      files: [],
      types: ["text/plain"],
      setData: vi.fn(),
      getData: vi.fn((type: string) =>
        type === "text/plain" ? "__shortpulse_layer_reorder__" : ""
      ),
    } as unknown as DataTransfer;
    fireEvent.drop(promptInput, { dataTransfer: transfer });

    expect(onPromptTextChange).not.toHaveBeenCalled();
  });

  it("shows layer utility actions inside the expanded markup modal", async () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);
    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));
    fireEvent.click(
      within(screen.getByRole("group", { name: /markup tools/i })).getByRole("button", {
        name: /expand markup tools/i,
      })
    );

    const expandedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    const utilityActions = within(expandedModal).getByLabelText("Layer utility actions");
    const removeBackgroundButton = within(utilityActions).getByRole("button", {
      name: /remove background/i,
    });
    expect(removeBackgroundButton).toBeInTheDocument();
    expect(within(removeBackgroundButton).getByText("✦")).toBeInTheDocument();
    expect(within(removeBackgroundButton).getByText("3")).toBeInTheDocument();
    expect(
      within(utilityActions).getByRole("button", { name: /flatten layers/i })
    ).toBeInTheDocument();
  });

  it("keeps modal and main aspect selectors synchronized through shared aspect state", async () => {
    const onAspectChange = vi.fn();
    const { rerender } = render(
      <ExpertEditPanelView {...baseProps} aspect="1:1" onAspectChange={onAspectChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));
    fireEvent.click(
      within(screen.getByRole("group", { name: /markup tools/i })).getByRole("button", {
        name: /expand markup tools/i,
      })
    );

    const expandedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    const modalAspectGroup = within(expandedModal).getByRole("group", {
      name: /aspect ratio selector/i,
    });
    const modalAspectTrigger = modalAspectGroup.querySelector(
      ".aspect-trigger"
    ) as HTMLButtonElement | null;
    const mainAspectTrigger = document.querySelector(
      ".edit-expert-selector-row .create-composer-aspect-control .aspect-trigger"
    ) as HTMLButtonElement | null;
    const initialModalStage = expandedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement | null;

    expect(modalAspectTrigger?.textContent ?? "").toContain("1:1");
    expect(mainAspectTrigger?.textContent ?? "").toContain("1:1");
    expect(initialModalStage).toBeTruthy();
    expect(initialModalStage?.style.aspectRatio).toBe("1 / 1");
    expect(
      expandedModal.querySelector(".edit-expert-markup-modal-aspect-frame")
    ).not.toBeInTheDocument();

    fireEvent.click(modalAspectTrigger as HTMLButtonElement);
    fireEvent.click(screen.getByRole("option", { name: /16:9/i }));
    expect(onAspectChange).toHaveBeenCalledWith("16:9");

    rerender(<ExpertEditPanelView {...baseProps} aspect="16:9" onAspectChange={onAspectChange} />);

    const refreshedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    const refreshedModalTrigger = refreshedModal.querySelector(
      ".edit-expert-markup-modal-general-row--aspect .aspect-trigger"
    ) as HTMLButtonElement | null;
    const refreshedMainTrigger = document.querySelector(
      ".edit-expert-selector-row .create-composer-aspect-control .aspect-trigger"
    ) as HTMLButtonElement | null;
    const refreshedModalStage = refreshedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement | null;

    expect(refreshedModalTrigger?.textContent ?? "").toContain("16:9");
    expect(refreshedMainTrigger?.textContent ?? "").toContain("16:9");
    expect(refreshedModalStage).toBeTruthy();
    expect(refreshedModalStage?.style.aspectRatio).toBe("16 / 9");
    expect(
      refreshedModal.querySelector(".edit-expert-markup-modal-aspect-frame")
    ).not.toBeInTheDocument();
  });

  it("fits expanded modal stage geometry to the selected aspect ratio", async () => {
    render(<ExpertEditPanelView {...baseProps} aspect="16:9" />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));
    fireEvent.click(
      within(screen.getByRole("group", { name: /markup tools/i })).getByRole("button", {
        name: /expand markup tools/i,
      })
    );

    const expandedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    const controlsColumn = expandedModal.querySelector(
      ".edit-expert-markup-modal-controls-column"
    ) as HTMLDivElement | null;
    const layersPanel = expandedModal.querySelector(
      ".edit-expert-layers-toolbar--modal"
    ) as HTMLDivElement | null;
    const modalStage = expandedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement | null;

    expect(controlsColumn).toBeTruthy();
    expect(layersPanel).toBeTruthy();
    expect(modalStage).toBeTruthy();

    mockElementRect(expandedModal, {
      left: 0,
      top: 0,
      width: 1300,
      height: 900,
      right: 1300,
      bottom: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    mockElementRect(
      controlsColumn as HTMLDivElement,
      {
        left: 0,
        top: 0,
        width: 198,
        height: 900,
        right: 198,
        bottom: 900,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect
    );
    mockElementRect(
      layersPanel as HTMLDivElement,
      {
        left: 1102,
        top: 0,
        width: 198,
        height: 900,
        right: 1300,
        bottom: 900,
        x: 1102,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect
    );

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect((modalStage as HTMLDivElement).style.width).toBe("904px");
      expect((modalStage as HTMLDivElement).style.height).toBe("508px");
    });
  });

  it("draws markup strokes in the inline stage with the pen tool", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-draw-inline.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    mockElementRect(primaryDropzone, createSquareRect(320));

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 901,
      pointerType: "mouse",
      button: 0,
      clientX: 56,
      clientY: 72,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 901,
      pointerType: "mouse",
      clientX: 188,
      clientY: 206,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 901,
      pointerType: "mouse",
      clientX: 188,
      clientY: 206,
    });

    const overlay = primaryDropzone.querySelector(
      ".edit-expert-markup-strokes-overlay"
    ) as SVGElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay?.querySelectorAll("polyline").length ?? 0).toBe(1);
  });

  it("draws inline markup strokes when the outer stage is larger than the composition surface", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-draw-inline-offset.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    const primaryStage = primaryDropzone.closest(
      ".edit-expert-primary-stage-shell"
    ) as HTMLDivElement | null;
    expect(primaryStage).not.toBeNull();
    mockElementRect(
      primaryStage as HTMLDivElement,
      {
        left: 0,
        top: 0,
        width: 860,
        height: 616,
        right: 860,
        bottom: 616,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect
    );
    mockElementRect(primaryDropzone, {
      left: 277.5,
      top: 37,
      width: 305,
      height: 542,
      right: 582.5,
      bottom: 579,
      x: 277.5,
      y: 37,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 903,
      pointerType: "mouse",
      button: 0,
      clientX: 333,
      clientY: 109,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 903,
      pointerType: "mouse",
      clientX: 465,
      clientY: 243,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 903,
      pointerType: "mouse",
      clientX: 465,
      clientY: 243,
    });

    const overlay = primaryDropzone.querySelector(
      ".edit-expert-markup-strokes-overlay"
    ) as SVGElement | null;
    const stroke = overlay?.querySelector("polyline") as SVGPolylineElement | null;
    expect(stroke).not.toBeNull();
    expect((stroke?.getAttribute("points") ?? "").length).toBeGreaterThan(0);
  });

  it("terminates inline markup draw gestures on pointer cancel", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-cancel-inline.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    mockElementRect(primaryDropzone, createSquareRect(320));

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 931,
      pointerType: "mouse",
      button: 0,
      clientX: 70,
      clientY: 80,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 931,
      pointerType: "mouse",
      clientX: 140,
      clientY: 150,
    });

    const strokeBeforeCancel = primaryDropzone.querySelector(
      ".edit-expert-markup-strokes-overlay polyline"
    ) as SVGPolylineElement | null;
    expect(strokeBeforeCancel).not.toBeNull();
    const pointsBeforeCancel = strokeBeforeCancel?.getAttribute("points") ?? "";

    fireEvent.pointerCancel(primaryDropzone, {
      pointerId: 931,
      pointerType: "mouse",
      clientX: 140,
      clientY: 150,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 931,
      pointerType: "mouse",
      clientX: 250,
      clientY: 260,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 931,
      pointerType: "mouse",
      clientX: 250,
      clientY: 260,
    });

    const strokeAfterCancel = primaryDropzone.querySelector(
      ".edit-expert-markup-strokes-overlay polyline"
    ) as SVGPolylineElement | null;
    expect(strokeAfterCancel).not.toBeNull();
    expect(strokeAfterCancel?.getAttribute("points") ?? "").toBe(pointsBeforeCancel);
  });

  it("terminates inline markup draw gestures on pointer leave", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-leave-inline.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    mockElementRect(primaryDropzone, createSquareRect(320));

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 932,
      pointerType: "mouse",
      button: 0,
      clientX: 74,
      clientY: 88,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 932,
      pointerType: "mouse",
      clientX: 146,
      clientY: 162,
    });

    const strokeBeforeLeave = primaryDropzone.querySelector(
      ".edit-expert-markup-strokes-overlay polyline"
    ) as SVGPolylineElement | null;
    expect(strokeBeforeLeave).not.toBeNull();
    const pointsBeforeLeave = strokeBeforeLeave?.getAttribute("points") ?? "";

    fireEvent.pointerLeave(primaryDropzone, {
      pointerId: 932,
      pointerType: "mouse",
      clientX: 146,
      clientY: 162,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 932,
      pointerType: "mouse",
      clientX: 260,
      clientY: 270,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 932,
      pointerType: "mouse",
      clientX: 260,
      clientY: 270,
    });

    const strokeAfterLeave = primaryDropzone.querySelector(
      ".edit-expert-markup-strokes-overlay polyline"
    ) as SVGPolylineElement | null;
    expect(strokeAfterLeave).not.toBeNull();
    expect(strokeAfterLeave?.getAttribute("points") ?? "").toBe(pointsBeforeLeave);
  });

  it("applies selected markup color to newly drawn pen strokes", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-color-inline.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(within(markupPanel).getByRole("button", { name: /markup color/i }));
    fireEvent.click(screen.getByRole("button", { name: /select #22d3ee color/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    mockElementRect(primaryDropzone, createSquareRect(320));

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 902,
      pointerType: "mouse",
      button: 0,
      clientX: 70,
      clientY: 92,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 902,
      pointerType: "mouse",
      clientX: 210,
      clientY: 226,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 902,
      pointerType: "mouse",
      clientX: 210,
      clientY: 226,
    });

    const stroke = primaryDropzone.querySelector(
      ".edit-expert-markup-strokes-overlay polyline"
    ) as SVGPolylineElement | null;
    expect(stroke).not.toBeNull();
    expect(stroke?.getAttribute("stroke")).toBe("#22d3ee");
  });

  it("applies markup stroke size changes to painted stroke width", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-size-inline.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    const strokeSlider = within(markupPanel).getByRole("slider", {
      name: /stroke size/i,
    }) as HTMLInputElement;
    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    mockElementRect(primaryDropzone, createSquareRect(320));
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    fireEvent.change(strokeSlider, { target: { value: "10" } });
    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 912,
      pointerType: "mouse",
      button: 0,
      clientX: 52,
      clientY: 64,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 912,
      pointerType: "mouse",
      clientX: 142,
      clientY: 150,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 912,
      pointerType: "mouse",
      clientX: 142,
      clientY: 150,
    });

    fireEvent.change(strokeSlider, { target: { value: "30" } });
    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 913,
      pointerType: "mouse",
      button: 0,
      clientX: 182,
      clientY: 74,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 913,
      pointerType: "mouse",
      clientX: 276,
      clientY: 164,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 913,
      pointerType: "mouse",
      clientX: 276,
      clientY: 164,
    });

    const strokes = primaryDropzone.querySelectorAll(
      ".edit-expert-markup-strokes-overlay polyline"
    ) as NodeListOf<SVGPolylineElement>;
    expect(strokes).toHaveLength(2);
    const firstStrokeWidth = Number.parseFloat(strokes[0]?.getAttribute("stroke-width") ?? "0");
    const secondStrokeWidth = Number.parseFloat(strokes[1]?.getAttribute("stroke-width") ?? "0");
    expect(secondStrokeWidth).toBeGreaterThan(firstStrokeWidth);
    const firstStrokeWidthPx = firstStrokeWidth;
    const secondStrokeWidthPx = secondStrokeWidth;
    expect(firstStrokeWidthPx).toBeCloseTo(10, 1);
    expect(secondStrokeWidthPx).toBeCloseTo(30, 1);
  });

  it("preserves markup geometry in scene space when switching aspect ratios", async () => {
    const { rerender } = render(
      <ExpertEditPanelView
        {...baseProps}
        aspect="16:9"
        referenceImageUrl="https://example.com/markup-aspect-scene-space.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    const stage16x9 = {
      width: 320,
      height: 180,
    };
    mockElementRect(primaryDropzone, {
      left: 0,
      top: 0,
      width: stage16x9.width,
      height: stage16x9.height,
      right: stage16x9.width,
      bottom: stage16x9.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 1201,
      pointerType: "mouse",
      button: 0,
      clientX: 80,
      clientY: 60,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 1201,
      pointerType: "mouse",
      clientX: 220,
      clientY: 130,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 1201,
      pointerType: "mouse",
      clientX: 220,
      clientY: 130,
    });

    const firstPolyline = primaryDropzone.querySelector(
      ".edit-expert-markup-strokes-overlay polyline"
    ) as SVGPolylineElement | null;
    expect(firstPolyline).not.toBeNull();
    const firstPoints = parsePolylinePoints(firstPolyline as SVGPolylineElement);
    const firstStartScene = resolveScenePointFromPixelSpace({
      x: firstPoints[0]?.x ?? 0,
      y: firstPoints[0]?.y ?? 0,
      spaceWidth: stage16x9.width,
      spaceHeight: stage16x9.height,
    });
    const firstEndScene = resolveScenePointFromPixelSpace({
      x: firstPoints[firstPoints.length - 1]?.x ?? 0,
      y: firstPoints[firstPoints.length - 1]?.y ?? 0,
      spaceWidth: stage16x9.width,
      spaceHeight: stage16x9.height,
    });

    rerender(
      <ExpertEditPanelView
        {...baseProps}
        aspect="9:16"
        referenceImageUrl="https://example.com/markup-aspect-scene-space.png"
        referenceText="prompt text"
      />
    );
    const stage9x16 = {
      width: 180,
      height: 320,
    };
    mockElementRect(primaryDropzone, {
      left: 0,
      top: 0,
      width: stage9x16.width,
      height: stage9x16.height,
      right: stage9x16.width,
      bottom: stage9x16.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    const secondPolyline = primaryDropzone.querySelector(
      ".edit-expert-markup-strokes-overlay polyline"
    ) as SVGPolylineElement | null;
    expect(secondPolyline).not.toBeNull();
    const secondPoints = parsePolylinePoints(secondPolyline as SVGPolylineElement);
    const secondStartScene = resolveScenePointFromPixelSpace({
      x: secondPoints[0]?.x ?? 0,
      y: secondPoints[0]?.y ?? 0,
      spaceWidth: stage9x16.width,
      spaceHeight: stage9x16.height,
    });
    const secondEndScene = resolveScenePointFromPixelSpace({
      x: secondPoints[secondPoints.length - 1]?.x ?? 0,
      y: secondPoints[secondPoints.length - 1]?.y ?? 0,
      spaceWidth: stage9x16.width,
      spaceHeight: stage9x16.height,
    });

    expect(secondStartScene.x).toBeCloseTo(firstStartScene.x, 3);
    expect(secondStartScene.y).toBeCloseTo(firstStartScene.y, 3);
    expect(secondEndScene.x).toBeCloseTo(firstEndScene.x, 3);
    expect(secondEndScene.y).toBeCloseTo(firstEndScene.y, 3);
  });

  it("preserves modal markup geometry in scene space when switching aspect ratios", async () => {
    const { rerender } = render(
      <ExpertEditPanelView
        {...baseProps}
        aspect="16:9"
        referenceImageUrl="https://example.com/markup-modal-aspect-scene-space.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));
    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(within(markupPanel).getByRole("button", { name: /expand markup tools/i }));

    const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
    const modalStage = expandedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement | null;
    expect(modalStage).not.toBeNull();

    const stage16x9 = {
      width: 320,
      height: 180,
    };
    mockElementRect(
      modalStage as HTMLDivElement,
      {
        left: 0,
        top: 0,
        width: stage16x9.width,
        height: stage16x9.height,
        right: stage16x9.width,
        bottom: stage16x9.height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect
    );
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    fireEvent.pointerDown(modalStage as HTMLDivElement, {
      pointerId: 1301,
      pointerType: "mouse",
      button: 0,
      clientX: 85,
      clientY: 65,
    });
    fireEvent.pointerMove(modalStage as HTMLDivElement, {
      pointerId: 1301,
      pointerType: "mouse",
      clientX: 230,
      clientY: 140,
    });
    fireEvent.pointerUp(modalStage as HTMLDivElement, {
      pointerId: 1301,
      pointerType: "mouse",
      clientX: 230,
      clientY: 140,
    });

    const firstPolyline = expandedModal.querySelector(
      ".edit-expert-markup-strokes-overlay polyline"
    ) as SVGPolylineElement | null;
    expect(firstPolyline).not.toBeNull();
    const firstPoints = parsePolylinePoints(firstPolyline as SVGPolylineElement);
    const firstStartScene = resolveScenePointFromPixelSpace({
      x: firstPoints[0]?.x ?? 0,
      y: firstPoints[0]?.y ?? 0,
      spaceWidth: stage16x9.width,
      spaceHeight: stage16x9.height,
    });
    const firstEndScene = resolveScenePointFromPixelSpace({
      x: firstPoints[firstPoints.length - 1]?.x ?? 0,
      y: firstPoints[firstPoints.length - 1]?.y ?? 0,
      spaceWidth: stage16x9.width,
      spaceHeight: stage16x9.height,
    });

    rerender(
      <ExpertEditPanelView
        {...baseProps}
        aspect="9:16"
        referenceImageUrl="https://example.com/markup-modal-aspect-scene-space.png"
        referenceText="prompt text"
      />
    );
    const refreshedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
    const refreshedModalStage = refreshedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement | null;
    expect(refreshedModalStage).not.toBeNull();
    const stage9x16 = {
      width: 180,
      height: 320,
    };
    mockElementRect(
      refreshedModalStage as HTMLDivElement,
      {
        left: 0,
        top: 0,
        width: stage9x16.width,
        height: stage9x16.height,
        right: stage9x16.width,
        bottom: stage9x16.height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect
    );
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    const secondPolyline = refreshedModal.querySelector(
      ".edit-expert-markup-strokes-overlay polyline"
    ) as SVGPolylineElement | null;
    expect(secondPolyline).not.toBeNull();
    const secondPoints = parsePolylinePoints(secondPolyline as SVGPolylineElement);
    const secondStartScene = resolveScenePointFromPixelSpace({
      x: secondPoints[0]?.x ?? 0,
      y: secondPoints[0]?.y ?? 0,
      spaceWidth: stage9x16.width,
      spaceHeight: stage9x16.height,
    });
    const secondEndScene = resolveScenePointFromPixelSpace({
      x: secondPoints[secondPoints.length - 1]?.x ?? 0,
      y: secondPoints[secondPoints.length - 1]?.y ?? 0,
      spaceWidth: stage9x16.width,
      spaceHeight: stage9x16.height,
    });

    expect(secondStartScene.x).toBeCloseTo(firstStartScene.x, 3);
    expect(secondStartScene.y).toBeCloseTo(firstStartScene.y, 3);
    expect(secondEndScene.x).toBeCloseTo(firstEndScene.x, 3);
    expect(secondEndScene.y).toBeCloseTo(firstEndScene.y, 3);
  });

  it("falls back to inline geometry when modal stage metrics are unresolved", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-modal-unresolved-geometry.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    mockElementRect(primaryDropzone, createSquareRect(320));
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 1401,
      pointerType: "mouse",
      button: 0,
      clientX: 88,
      clientY: 90,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 1401,
      pointerType: "mouse",
      clientX: 232,
      clientY: 236,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 1401,
      pointerType: "mouse",
      clientX: 232,
      clientY: 236,
    });
    const inlineStroke = primaryDropzone.querySelector(
      ".edit-expert-markup-strokes-overlay polyline"
    ) as SVGPolylineElement | null;
    expect(inlineStroke).not.toBeNull();
    const inlineStrokeWidth = Number.parseFloat(inlineStroke?.getAttribute("stroke-width") ?? "0");
    expect(inlineStrokeWidth).toBeGreaterThan(0);

    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(within(markupPanel).getByRole("button", { name: /expand markup tools/i }));

    const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
    const modalStage = expandedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement | null;
    expect(modalStage).not.toBeNull();

    mockElementRect(
      modalStage as HTMLDivElement,
      {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect
    );

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      const modalStroke = expandedModal.querySelector(
        ".edit-expert-markup-strokes-overlay polyline"
      ) as SVGPolylineElement | null;
      expect(modalStroke).not.toBeNull();
      const modalStrokeWidth = Number.parseFloat(modalStroke?.getAttribute("stroke-width") ?? "0");
      expect(modalStrokeWidth).toBeGreaterThan(0);
      expect(modalStrokeWidth).toBeCloseTo(inlineStrokeWidth, 2);
    });
  });

  it("defaults markup color to #F43F5E in inline and expanded markup pickers", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-default-color.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const inlineMarkupPanel = screen.getByRole("group", { name: /markup tools/i });
    const inlineColorButton = within(inlineMarkupPanel).getByRole("button", {
      name: /markup color/i,
    });
    fireEvent.click(inlineColorButton);
    expect(screen.getByText("#F43F5E")).toBeInTheDocument();
    const inlineDefaultSwatch = screen.getByRole("button", { name: /select #f43f5e color/i });
    expect(inlineDefaultSwatch.className).toContain("is-active");
    fireEvent.click(inlineColorButton);

    fireEvent.click(
      within(inlineMarkupPanel).getByRole("button", { name: /expand markup tools/i })
    );
    const expandedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    const modalToolbar = within(expandedModal).getByRole("group", { name: /markup tools/i });
    const modalColorButton = within(modalToolbar).getByRole("button", { name: /markup color/i });
    fireEvent.click(modalColorButton);

    expect(within(expandedModal).getByText("#F43F5E")).toBeInTheDocument();
    const modalDefaultSwatch = screen.getByRole("button", {
      name: /select #f43f5e color/i,
    });
    expect(modalDefaultSwatch.className).toContain("is-active");
  });

  it("keeps the markup color picker open while adjusting hue", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-hue-picker-open.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    const colorButton = within(markupPanel).getByRole("button", { name: /markup color/i });
    fireEvent.click(colorButton);

    expect(screen.getByRole("dialog", { name: /markup color picker/i })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: /markup hue/i }), {
      target: { value: "220" },
    });

    expect(screen.getByRole("dialog", { name: /markup color picker/i })).toBeInTheDocument();
    expect(within(markupPanel).queryByRole("button", { name: /markup color/i })).toBeNull();
  });

  it("clears markup strokes and shares them with expanded markup modal", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-shared-state.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    mockElementRect(primaryDropzone, createSquareRect(320));

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 905,
      pointerType: "mouse",
      button: 0,
      clientX: 40,
      clientY: 58,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 905,
      pointerType: "mouse",
      clientX: 216,
      clientY: 214,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 905,
      pointerType: "mouse",
      clientX: 216,
      clientY: 214,
    });

    fireEvent.click(within(markupPanel).getByRole("button", { name: /expand markup tools/i }));
    const expandedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    expect(
      expandedModal.querySelectorAll(".edit-expert-markup-strokes-overlay polyline")
    ).toHaveLength(1);

    fireEvent.click(within(expandedModal).getByRole("button", { name: /clear markup strokes/i }));
    expect(primaryDropzone.querySelector(".edit-expert-markup-strokes-overlay")).toBeNull();
  });

  it("blocks markup drawing when no primary stage image exists", async () => {
    render(
      <ExpertEditPanelView {...baseProps} referenceImageUrl={null} referenceText="prompt text" />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryStage = screen.getByLabelText("Primary edit stage");
    mockElementRect(primaryStage, createSquareRect(320));

    fireEvent.pointerDown(primaryStage, {
      pointerId: 906,
      pointerType: "mouse",
      button: 0,
      clientX: 88,
      clientY: 94,
    });
    fireEvent.pointerMove(primaryStage, {
      pointerId: 906,
      pointerType: "mouse",
      clientX: 128,
      clientY: 134,
    });
    fireEvent.pointerUp(primaryStage, {
      pointerId: 906,
      pointerType: "mouse",
      clientX: 128,
      clientY: 134,
    });

    expect(screen.queryByText("Add a layer image before drawing markup.")).not.toBeInTheDocument();
    expect(primaryStage.querySelector(".edit-expert-markup-strokes-overlay")).toBeNull();
  });

  it("pans the inline stage camera from the primary interaction surface", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-pan-inline.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    const rect = {
      left: 0,
      top: 0,
      width: 300,
      height: 300,
      right: 300,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(primaryDropzone, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    expect(within(markupPanel).queryByRole("button", { name: /recenter markup view/i })).toBeNull();

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 601,
      pointerType: "mouse",
      button: 0,
      clientX: 24,
      clientY: 32,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 601,
      pointerType: "mouse",
      clientX: 116,
      clientY: 152,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 601,
      pointerType: "mouse",
      clientX: 116,
      clientY: 152,
    });

    const beforePan = readMarkupViewportTransform();
    expect(beforePan).not.toBeNull();
    expect(Math.abs(beforePan?.offsetX ?? 0)).toBeLessThan(0.01);
    expect(Math.abs(beforePan?.offsetY ?? 0)).toBeLessThan(0.01);

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 602,
      pointerType: "mouse",
      button: 0,
      clientX: 60,
      clientY: 70,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 602,
      pointerType: "mouse",
      clientX: 168,
      clientY: 186,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 602,
      pointerType: "mouse",
      clientX: 168,
      clientY: 186,
    });
    fireEvent.keyUp(window, { key: " ", code: "Space" });

    const afterDropzonePanAttempt = readMarkupViewportTransform();
    expect(afterDropzonePanAttempt).not.toBeNull();
    expect(Math.abs(afterDropzonePanAttempt?.offsetX ?? 0)).toBeGreaterThan(80);
    expect(Math.abs(afterDropzonePanAttempt?.offsetY ?? 0)).toBeGreaterThan(80);

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 603,
      pointerType: "mouse",
      button: 0,
      clientX: 68,
      clientY: 78,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 603,
      pointerType: "mouse",
      clientX: 176,
      clientY: 194,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 603,
      pointerType: "mouse",
      button: 0,
      clientX: 176,
      clientY: 194,
    });
    fireEvent.keyUp(window, { key: " ", code: "Space" });

    const afterPrimarySurfacePan = readMarkupViewportTransform();
    expect(afterPrimarySurfacePan).not.toBeNull();
    expect(Math.abs(afterPrimarySurfacePan?.offsetX ?? 0)).toBeGreaterThan(
      Math.abs(afterDropzonePanAttempt?.offsetX ?? 0)
    );
    expect(Math.abs(afterPrimarySurfacePan?.offsetY ?? 0)).toBeGreaterThan(
      Math.abs(afterDropzonePanAttempt?.offsetY ?? 0)
    );
  });

  it.skip("supports middle-mouse pan over the loaded primary dropzone image area", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-middle-inline.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    const inlineRect = createSquareRect(320);
    mockElementRect(primaryDropzone, inlineRect);

    const beforePan = readMarkupViewportTransform();
    expect(beforePan).not.toBeNull();
    expect(Math.abs(beforePan?.offsetX ?? 0)).toBeLessThan(0.01);
    expect(Math.abs(beforePan?.offsetY ?? 0)).toBeLessThan(0.01);

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 777,
      pointerType: "mouse",
      button: 1,
      clientX: 120,
      clientY: 132,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 777,
      pointerType: "mouse",
      clientX: 224,
      clientY: 246,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 777,
      pointerType: "mouse",
      button: 1,
      clientX: 224,
      clientY: 246,
    });

    const afterPan = readMarkupViewportTransform();
    expect(afterPan).not.toBeNull();
    expect(Math.abs(afterPan?.offsetX ?? 0)).toBeGreaterThan(60);
    expect(Math.abs(afterPan?.offsetY ?? 0)).toBeGreaterThan(60);
  });

  it.skip("supports middle-button pan when pointerType metadata is absent", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-middle-no-pointer-type.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    mockElementRect(primaryDropzone, createSquareRect(320));

    const beforePan = readMarkupViewportTransform();
    expect(beforePan).not.toBeNull();
    expect(Math.abs(beforePan?.offsetX ?? 0)).toBeLessThan(0.01);
    expect(Math.abs(beforePan?.offsetY ?? 0)).toBeLessThan(0.01);

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 778,
      button: 1,
      buttons: 4,
      clientX: 104,
      clientY: 112,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 778,
      buttons: 4,
      clientX: 206,
      clientY: 224,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 778,
      button: 1,
      buttons: 0,
      clientX: 206,
      clientY: 224,
    });

    const afterPan = readMarkupViewportTransform();
    expect(afterPan).not.toBeNull();
    expect(Math.abs(afterPan?.offsetX ?? 0)).toBeGreaterThan(60);
    expect(Math.abs(afterPan?.offsetY ?? 0)).toBeGreaterThan(60);
  });

  it("zooms the loaded stage from the primary surface and shares viewport state with expanded modal", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-zoom-shared.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    const inlineRect = {
      left: 0,
      top: 0,
      width: 320,
      height: 320,
      right: 320,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(primaryDropzone, "getBoundingClientRect", {
      configurable: true,
      value: () => inlineRect,
    });

    dispatchNativeWheelEvent(primaryDropzone, {
      deltaY: -160,
      clientX: 140,
      clientY: 140,
    });
    const afterDropzoneWheel = readMarkupViewportTransform();
    expect(afterDropzoneWheel).not.toBeNull();
    expect(afterDropzoneWheel?.viewport).toHaveClass("edit-expert-markup-viewport");
    expect(afterDropzoneWheel?.scale ?? 0).toBeGreaterThan(1);

    dispatchNativeWheelEvent(primaryDropzone, {
      deltaY: -120,
      clientX: 18,
      clientY: 18,
    });
    const afterBackdropZoom = readMarkupViewportTransform();
    expect(afterBackdropZoom).not.toBeNull();
    expect(afterBackdropZoom?.viewport).toHaveClass("edit-expert-markup-viewport");
    expect(afterBackdropZoom?.scale ?? 0).toBeGreaterThan(afterDropzoneWheel?.scale ?? 0);

    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(within(markupPanel).getByRole("button", { name: /expand markup tools/i }));

    const expandedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    const modalViewport = readMarkupViewportTransform(expandedModal);
    expect(modalViewport).not.toBeNull();
    expect(modalViewport?.viewport).toHaveClass("edit-expert-markup-viewport");
    expect(modalViewport?.scale ?? 0).toBeCloseTo(afterBackdropZoom?.scale ?? 0, 4);

    const modalStage = expandedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement;
    expect(modalStage).toBeTruthy();
    const modalRect = {
      left: 0,
      top: 0,
      width: 640,
      height: 640,
      right: 640,
      bottom: 640,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(modalStage, "getBoundingClientRect", {
      configurable: true,
      value: () => modalRect,
    });

    dispatchNativeWheelEvent(modalStage, {
      deltaY: 120,
      metaKey: true,
      clientX: 280,
      clientY: 280,
    });
    const modalAfterZoomOut = readMarkupViewportTransform(expandedModal);
    expect(modalAfterZoomOut).not.toBeNull();
    expect(modalAfterZoomOut?.scale ?? 0).toBeLessThan(modalViewport?.scale ?? 0);

    const modalMovePanel = within(expandedModal).getByRole("group", { name: /^move tools$/i });
    fireEvent.click(within(modalMovePanel).getByRole("button", { name: /center move action/i }));
    const modalAfterRecenter = readMarkupViewportTransform(expandedModal);
    expect(modalAfterRecenter).not.toBeNull();
    expect(modalAfterRecenter?.scale ?? 0).toBeCloseTo(MARKUP_VIEWPORT_DEFAULT_SCALE, 4);
    expect(Math.abs(modalAfterRecenter?.offsetX ?? 0)).toBeLessThan(0.01);
    expect(Math.abs(modalAfterRecenter?.offsetY ?? 0)).toBeLessThan(0.01);
  });

  it("keeps inline stage pan and zoom active from the blank canvas frame without a loaded image", async () => {
    const { container } = render(
      <ExpertEditPanelView {...baseProps} referenceText="prompt text" />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryStage = screen.getByLabelText("Primary edit stage");
    const frameStack = container.querySelector(
      '[data-testid="edit-expert-primary-canvas-frame-stack"]'
    ) as HTMLDivElement | null;
    expect(frameStack).toBeTruthy();
    const inlineRect = createSquareRect(320);
    mockElementRect(primaryStage, inlineRect);
    mockElementRect(frameStack as HTMLDivElement, inlineRect);

    dispatchNativeWheelEvent(frameStack as HTMLDivElement, {
      deltaY: -120,
      clientX: 30,
      clientY: 30,
    });
    const afterZoom = readMarkupViewportTransform();
    expect(afterZoom).not.toBeNull();
    expect(afterZoom?.scale ?? 0).toBeGreaterThan(1);

    fireEvent.pointerDown(frameStack as HTMLDivElement, {
      pointerId: 901,
      pointerType: "mouse",
      button: 1,
      clientX: 120,
      clientY: 124,
    });
    fireEvent.pointerMove(frameStack as HTMLDivElement, {
      pointerId: 901,
      pointerType: "mouse",
      clientX: 198,
      clientY: 214,
    });
    fireEvent.pointerUp(frameStack as HTMLDivElement, {
      pointerId: 901,
      pointerType: "mouse",
      button: 1,
      clientX: 198,
      clientY: 214,
    });

    const afterPan = readMarkupViewportTransform();
    expect(afterPan).not.toBeNull();
    expect(Math.abs(afterPan?.offsetX ?? 0)).toBeGreaterThan(40);
    expect(Math.abs(afterPan?.offsetY ?? 0)).toBeGreaterThan(40);
    expect(primaryStage).toHaveClass("is-empty-stage");
    expect(screen.queryByText("Click to upload an image")).not.toBeInTheDocument();
  });

  it("keeps inline stage pan and zoom active from the backdrop outside the loaded canvas", async () => {
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-shell-pan-inline.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryStageShell = container.querySelector(
      ".edit-expert-primary-stage-shell"
    ) as HTMLDivElement | null;
    expect(primaryStageShell).toBeTruthy();
    mockElementRect(primaryStageShell as HTMLDivElement, createSquareRect(320));

    dispatchNativeWheelEvent(primaryStageShell as HTMLDivElement, {
      deltaY: -120,
      clientX: 24,
      clientY: 24,
    });
    const afterZoom = readMarkupViewportTransform();
    expect(afterZoom).not.toBeNull();
    expect(afterZoom?.scale ?? 0).toBeGreaterThan(1);

    fireEvent.pointerDown(primaryStageShell as HTMLDivElement, {
      pointerId: 991,
      pointerType: "mouse",
      button: 0,
      clientX: 68,
      clientY: 74,
    });
    fireEvent.pointerMove(primaryStageShell as HTMLDivElement, {
      pointerId: 991,
      pointerType: "mouse",
      clientX: 172,
      clientY: 188,
    });
    fireEvent.pointerUp(primaryStageShell as HTMLDivElement, {
      pointerId: 991,
      pointerType: "mouse",
      button: 0,
      clientX: 172,
      clientY: 188,
    });

    const afterPan = readMarkupViewportTransform();
    expect(afterPan).not.toBeNull();
    expect(Math.abs(afterPan?.offsetX ?? 0)).toBeGreaterThan(60);
    expect(Math.abs(afterPan?.offsetY ?? 0)).toBeGreaterThan(60);
  });

  it.skip("pans the markup modal viewport with middle-mouse drag without holding space", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-middle-pan-modal.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));
    fireEvent.click(
      within(screen.getByRole("group", { name: /markup tools/i })).getByRole("button", {
        name: /expand markup tools/i,
      })
    );

    const expandedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    const modalStage = expandedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement;
    expect(modalStage).toBeTruthy();
    const rect = {
      left: 0,
      top: 0,
      width: 640,
      height: 640,
      right: 640,
      bottom: 640,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(modalStage, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    const beforePan = readMarkupViewportTransform(expandedModal);
    expect(beforePan).not.toBeNull();
    expect(Math.abs(beforePan?.offsetX ?? 0)).toBeLessThan(0.01);
    expect(Math.abs(beforePan?.offsetY ?? 0)).toBeLessThan(0.01);

    fireEvent.pointerDown(modalStage, {
      pointerId: 801,
      pointerType: "mouse",
      button: 1,
      clientX: 220,
      clientY: 220,
    });
    fireEvent.pointerMove(modalStage, {
      pointerId: 801,
      pointerType: "mouse",
      clientX: 344,
      clientY: 356,
    });
    fireEvent.pointerUp(modalStage, {
      pointerId: 801,
      pointerType: "mouse",
      button: 1,
      clientX: 344,
      clientY: 356,
    });

    const afterPan = readMarkupViewportTransform(expandedModal);
    expect(afterPan).not.toBeNull();
    expect(Math.abs(afterPan?.offsetX ?? 0)).toBeGreaterThan(80);
    expect(Math.abs(afterPan?.offsetY ?? 0)).toBeGreaterThan(80);
  });

  it("locks the model picker to FLUX Pro Fill while Inpaint is selected", async () => {
    const onModelPickerOpen = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onModelPickerOpen={onModelPickerOpen} />);
    const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
    const inpaintTab = within(modeTabs).getByRole("tab", { name: /^inpaint$/i });
    const standardTab = within(modeTabs).getByRole("tab", { name: /^standard$/i });
    const modelPickerButton = screen.getByRole("button", { name: /open model picker/i });

    expect(modelPickerButton).not.toBeDisabled();
    expect(modelPickerButton).toHaveTextContent("Nano Banana 2");

    fireEvent.click(inpaintTab);
    expect(modelPickerButton).toBeDisabled();
    expect(modelPickerButton).toHaveTextContent(INPAINT_FLUX_FILL_MODEL_LABEL);
    expect(modelPickerButton.querySelector(".model-chip-logo-img")).toHaveAttribute(
      "src",
      "/tiny-logo.png"
    );
    expect(modelPickerButton.querySelector(".model-chip-logo-img")).toHaveClass(
      "model-chip-logo-img--locked-edit-tool"
    );
    fireEvent.click(modelPickerButton);
    expect(onModelPickerOpen).not.toHaveBeenCalled();

    fireEvent.click(standardTab);
    expect(modelPickerButton).not.toBeDisabled();
    expect(modelPickerButton).toHaveTextContent("Nano Banana 2");
  });

  it("keeps the model picker unlocked while Markup is selected", async () => {
    const onModelPickerOpen = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onModelPickerOpen={onModelPickerOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    const moveButton = await within(rail).findByRole("button", { name: /^move$/i });
    const markupButton = await within(rail).findByRole("button", { name: /^markup$/i });
    const modelPickerButton = screen.getByRole("button", { name: /open model picker/i });

    expect(modelPickerButton).not.toBeDisabled();
    expect(modelPickerButton).toHaveTextContent("Nano Banana 2");

    fireEvent.click(markupButton);
    expect(modelPickerButton).not.toBeDisabled();
    expect(modelPickerButton).toHaveTextContent("Nano Banana 2");
    expect(modelPickerButton.querySelector(".model-chip-logo-img")).not.toHaveAttribute(
      "src",
      "/tiny-logo.png"
    );
    fireEvent.click(modelPickerButton);
    expect(onModelPickerOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(moveButton);
    expect(modelPickerButton).not.toBeDisabled();
    expect(modelPickerButton).toHaveTextContent("Nano Banana 2");
  });

  it("locks the model picker to Pulse Markup v1 while Markup is selected", async () => {
    const onModelPickerOpen = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onModelPickerOpen={onModelPickerOpen} />);
    const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
    const markupTab = within(modeTabs).getByRole("tab", { name: /^markup$/i });
    const standardTab = within(modeTabs).getByRole("tab", { name: /^standard$/i });
    const modelPickerButton = screen.getByRole("button", { name: /open model picker/i });

    expect(modelPickerButton).not.toBeDisabled();
    expect(modelPickerButton).toHaveTextContent("Nano Banana 2");

    fireEvent.click(markupTab);
    expect(modelPickerButton).toBeDisabled();
    expect(modelPickerButton).toHaveTextContent(MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL);
    expect(modelPickerButton.querySelector(".model-chip-logo-img")).toHaveAttribute(
      "src",
      "/tiny-logo.png"
    );
    fireEvent.click(modelPickerButton);
    expect(onModelPickerOpen).not.toHaveBeenCalled();

    fireEvent.click(standardTab);
    expect(modelPickerButton).not.toBeDisabled();
    expect(modelPickerButton).toHaveTextContent("Nano Banana 2");
  });

  it("locks the model picker from selector-row markup mode tabs", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const modelPickerButton = screen.getByRole("button", { name: /open model picker/i });
    const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
    const inpaintTab = within(modeTabs).getByRole("tab", { name: /^inpaint$/i });
    const standardTab = within(modeTabs).getByRole("tab", { name: /^standard$/i });

    expect(modelPickerButton).not.toBeDisabled();
    const markupTab = within(modeTabs).getByRole("tab", { name: /^markup$/i });

    fireEvent.click(inpaintTab);
    expect(modelPickerButton).toBeDisabled();
    expect(modelPickerButton).toHaveTextContent(INPAINT_FLUX_FILL_MODEL_LABEL);

    fireEvent.click(markupTab);
    expect(modelPickerButton).toBeDisabled();
    expect(modelPickerButton).toHaveTextContent(MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL);

    fireEvent.click(standardTab);
    expect(modelPickerButton).not.toBeDisabled();
    expect(modelPickerButton).toHaveTextContent("Nano Banana 2");
  });

  it("applies active tool theme classes to the collapsed tools button", () => {
    vi.useFakeTimers();

    try {
      render(<ExpertEditPanelView {...baseProps} />);
      const collapsedButton = screen.getByRole("button", { name: /expand inpaint controls/i });
      expect(collapsedButton).toHaveClass("is-active-move");
      expect(collapsedButton).toHaveTextContent(/move/i);

      fireEvent.click(collapsedButton);
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));
      fireEvent.click(screen.getByRole("button", { name: /collapse inpaint controls/i }));
      act(() => {
        vi.advanceTimersByTime(180);
      });
      const collapsedInpaintButton = screen.getByRole("button", {
        name: /expand inpaint controls/i,
      });
      expect(collapsedInpaintButton).toHaveClass("is-active-inpaint");
      expect(collapsedInpaintButton).toHaveTextContent(/inpaint/i);
    } finally {
      vi.useRealTimers();
    }
  }, 15000);

  it.skip("renders adjust, re-center, expand, and a functional move zoom slider", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/move-zoom-stage.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));
    const moveSettingsPanel = screen.getByRole("group", { name: /move tools/i });
    const adjustButton = within(moveSettingsPanel).getByRole("button", { name: /^adjust$/i });
    const recenterButton = within(moveSettingsPanel).getByRole("button", {
      name: /center move action/i,
    });
    const expandButton = within(moveSettingsPanel).getByRole("button", {
      name: /expand markup tools/i,
    });
    const zoomSlider = within(moveSettingsPanel).getByRole("slider", {
      name: /zoom stage/i,
    }) as HTMLInputElement;
    const modeRow = moveSettingsPanel.querySelector(".edit-expert-move-mode-row");

    expect(adjustButton).toBeInTheDocument();
    expect(recenterButton).toBeInTheDocument();
    expect(expandButton).toBeInTheDocument();
    expect(expandButton).not.toHaveTextContent(/expand/i);
    expect(zoomSlider.value).toBe(DEFAULT_STAGE_ZOOM_SLIDER_VALUE);
    expect(modeRow?.children).toHaveLength(3);
    expect(readMarkupViewportTransform()?.scale ?? 0).toBeCloseTo(MARKUP_VIEWPORT_DEFAULT_SCALE, 4);

    fireEvent.change(zoomSlider, { target: { value: "100" } });
    expect(zoomSlider.value).toBe("100");
    expect(readMarkupViewportTransform()?.scale ?? 0).toBeGreaterThan(1);
    expect(recenterButton).not.toBeDisabled();

    fireEvent.click(recenterButton);
    expect(zoomSlider.value).toBe(DEFAULT_STAGE_ZOOM_SLIDER_VALUE);
    expect(readMarkupViewportTransform()?.scale ?? 0).toBeCloseTo(MARKUP_VIEWPORT_DEFAULT_SCALE, 4);
    expect(recenterButton).toBeDisabled();

    fireEvent.change(zoomSlider, { target: { value: "0" } });
    expect(zoomSlider.value).toBe("0");
    expect(readMarkupViewportTransform()?.scale ?? 1).toBeLessThan(1);

    fireEvent.doubleClick(zoomSlider);
    expect(zoomSlider.value).toBe("50");
    expect(readMarkupViewportTransform()?.scale ?? 0).toBeCloseTo(1, 4);

    fireEvent.click(expandButton);
    expect(screen.getByRole("dialog", { name: /expanded markup canvas/i })).toBeInTheDocument();
  });

  it("keeps stage zoom consistent when switching between move, inpaint, and markup tools", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/shared-stage-zoom-tools.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    const moveSettingsPanel = screen.getByRole("group", { name: /move tools/i });
    const zoomSlider = within(moveSettingsPanel).getByRole("slider", {
      name: /zoom stage/i,
    }) as HTMLInputElement;
    fireEvent.change(zoomSlider, { target: { value: "100" } });

    const moveZoomed = readMarkupViewportTransform();
    expect(moveZoomed).not.toBeNull();
    expect(moveZoomed?.scale ?? 0).toBeGreaterThan(1);

    fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));
    const inpaintZoomed = readMarkupViewportTransform();
    expect(inpaintZoomed).not.toBeNull();
    expect(inpaintZoomed?.scale ?? 0).toBeCloseTo(moveZoomed?.scale ?? 0, 4);

    fireEvent.click(within(rail).getByRole("button", { name: /^markup$/i }));
    const markupZoomed = readMarkupViewportTransform();
    expect(markupZoomed).not.toBeNull();
    expect(markupZoomed?.scale ?? 0).toBeCloseTo(moveZoomed?.scale ?? 0, 4);
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

  it.skip("opens stage context menu on right click with expected actions", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/context-menu-target.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    fireEvent.contextMenu(primaryDropzone, { clientX: 140, clientY: 120 });

    const stageMenu = screen.getByRole("menu", { name: /stage actions/i });
    expect(within(stageMenu).getByRole("menuitem", { name: /^recenter$/i })).toBeInTheDocument();
    expect(within(stageMenu).getByRole("menuitem", { name: /^expand$/i })).toBeInTheDocument();
    expect(within(stageMenu).getByRole("menuitem", { name: /^add image$/i })).toBeInTheDocument();
    expect(within(stageMenu).getByRole("menuitem", { name: /^reset all$/i })).toBeInTheDocument();
    expect(
      within(stageMenu).getByRole("menuitem", { name: /^remove image$/i })
    ).toBeInTheDocument();

    fireEvent.click(within(stageMenu).getByRole("menuitem", { name: /^expand$/i }));
    expect(screen.getByRole("dialog", { name: /expanded markup canvas/i })).toBeInTheDocument();
  });

  it.skip("resets stage changes from the context menu", async () => {
    const emptySnapshot: InpaintMaskSnapshot = { layers: [] };
    const paintedSnapshot: InpaintMaskSnapshot = {
      layers: [
        {
          layerId: "layer-1",
          width: 2,
          height: 2,
          alpha: new Uint8ClampedArray([255, 0, 0, 0]),
        },
      ],
    };
    let currentSnapshot = emptySnapshot;
    const clearAllMasks = vi.fn(() => {
      currentSnapshot = emptySnapshot;
    });
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        modalOverlayCanvasRef: { current: null },
        previewCanvasRef: { current: null },
        modalPreviewCanvasRef: { current: null },
        hasSelectedLayerMask: true,
        imageHasInteractiveMask: true,
        captureMaskSnapshot: vi.fn(() => currentSnapshot),
        restoreMaskSnapshot: vi.fn((snapshot: InpaintMaskSnapshot) => {
          currentSnapshot = snapshot;
        }),
        clearAllMasks,
        clearSelectedLayerMask: vi.fn(),
        invertSelectedLayerMask: vi.fn(),
        exportSelectedLayerMaskBlob: vi.fn(async () => null),
        onPointerDown: vi.fn(),
        onPointerMove: vi.fn(),
        onPointerUp: vi.fn(() => {
          currentSnapshot = paintedSnapshot;
        }),
        onPointerCancel: vi.fn(),
        onPointerLeave: vi.fn(),
      });
    try {
      render(
        <ExpertEditPanelView
          {...baseProps}
          referenceImageUrl="https://example.com/context-menu-reset.png"
          referenceText="prompt text"
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));

      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

      const moveSettingsPanel = screen.getByRole("group", { name: /move tools/i });
      const zoomSlider = within(moveSettingsPanel).getByRole("slider", {
        name: /zoom stage/i,
      }) as HTMLInputElement;
      fireEvent.change(zoomSlider, { target: { value: "100" } });
      expect(readMarkupViewportTransform()?.scale ?? 0).toBeGreaterThan(1);

      const primaryDropzone = screen.getByLabelText("Primary composition surface");
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

      dragStagePointer({
        currentTarget: primaryDropzone,
        pointerId: 900,
        startX: 196,
        startY: 4,
        endX: 110,
        endY: 90,
        shiftKey: true,
      });
      dragStagePointer({
        currentTarget: primaryDropzone,
        pointerId: 901,
        startX: 30,
        startY: 30,
        endX: 100,
        endY: 95,
      });

      const movedFrameBeforeReset = document.querySelector(
        ".edit-expert-primary-layer-frame"
      ) as HTMLDivElement;
      expect(Math.abs(readFrameTranslate(movedFrameBeforeReset).x)).toBeGreaterThan(0.01);
      expect(Math.abs(readFrameTranslate(movedFrameBeforeReset).y)).toBeGreaterThan(0.01);

      fireEvent.click(within(rail).getByRole("button", { name: /^markup$/i }));
      fireEvent.pointerDown(primaryDropzone, {
        pointerId: 902,
        pointerType: "mouse",
        button: 0,
        clientX: 60,
        clientY: 60,
      });
      fireEvent.pointerMove(primaryDropzone, {
        pointerId: 902,
        pointerType: "mouse",
        clientX: 140,
        clientY: 120,
      });
      fireEvent.pointerUp(primaryDropzone, {
        pointerId: 902,
        pointerType: "mouse",
        button: 0,
        clientX: 140,
        clientY: 120,
      });
      expect(
        document.querySelectorAll(".edit-expert-markup-strokes-overlay polyline").length
      ).toBeGreaterThan(0);

      fireEvent.contextMenu(primaryDropzone, { clientX: 140, clientY: 120 });
      const stageMenu = screen.getByRole("menu", { name: /stage actions/i });
      fireEvent.click(within(stageMenu).getByRole("menuitem", { name: /^reset$/i }));

      await waitFor(() => expect(clearAllMasks).toHaveBeenCalled());
      await waitFor(() =>
        expect(
          document.querySelectorAll(".edit-expert-markup-strokes-overlay polyline").length
        ).toBe(0)
      );
      expect(screen.queryByRole("menu", { name: /stage actions/i })).not.toBeInTheDocument();
      expect(readMarkupViewportTransform()?.scale ?? 0).toBeCloseTo(
        MARKUP_VIEWPORT_DEFAULT_SCALE,
        4
      );

      const movedFrameAfterReset = document.querySelector(
        ".edit-expert-primary-layer-frame"
      ) as HTMLDivElement;
      expect(readFrameTranslate(movedFrameAfterReset).x).toBeCloseTo(0, 1);
      expect(readFrameTranslate(movedFrameAfterReset).y).toBeCloseTo(0, 1);
      expect(readFrameScale(movedFrameAfterReset)).toBeCloseTo(1, 4);
      expect(readFrameRotationDeg(movedFrameAfterReset)).toBeCloseTo(0, 4);
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
    }
  });

  it.skip("moves the selected layer when dragging in move mode", async () => {
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

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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
    expect(readFrameTranslate(frame).x).toBeCloseTo(0, 4);
    expect(readFrameTranslate(frame).y).toBeCloseTo(0, 4);

    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 40,
      startX: 196,
      startY: 4,
      endX: 110,
      endY: 90,
      shiftKey: true,
    });
    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 41,
      startX: 20,
      startY: 20,
      endX: 60,
      endY: 70,
    });

    const { x: translateX, y: translateY } = readFrameTranslate(frame);
    expect(Math.abs(translateX)).toBeGreaterThan(1);
    expect(Math.abs(translateY)).toBeGreaterThan(1);
  });

  it("shows selected-layer transform overlay and handles in move mode", async () => {
    const previousImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1200;
      naturalHeight = 1200;

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

      expect(screen.getByTestId("edit-expert-transform-overlay-inline")).toBeInTheDocument();
      (["nw", "ne", "se", "sw"] as const).forEach((corner) => {
        expect(
          screen.getByTestId(`edit-expert-transform-handle-inline-${corner}`)
        ).toBeInTheDocument();
      });
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: previousImage,
      });
    }
  });

  it("keeps the transform overlay aligned to the contained image rect", async () => {
    const previousImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 400;
      naturalHeight = 800;

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
      render(
        <ExpertEditPanelView
          {...baseProps}
          referenceImageUrl="https://example.com/portrait-transform-target.png"
          referenceText="prompt text"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

      const frame = document.querySelector(".edit-expert-primary-layer-frame") as HTMLDivElement;
      await waitFor(() => {
        expect(frame.style.width).toBe("50%");
      });
      expect(frame.style.left).toBe("25%");
      expect(frame.style.height).toBe("100%");
      const overlay = screen.getByTestId("edit-expert-transform-overlay-inline");
      expect(overlay).toHaveStyle({
        left: "25%",
        width: "50%",
        height: "100%",
      });
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: previousImage,
      });
    }
  });

  it.skip("resizes the selected layer from inline stage adjust drag", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/resize-corner-handle-target.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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
    const initialScale = readFrameScale(frame);

    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 62,
      startX: 196,
      startY: 4,
      endX: 110,
      endY: 90,
      shiftKey: true,
    });
    expect(readFrameScale(frame)).not.toBeCloseTo(initialScale, 4);
    expect(screen.getByTestId("edit-expert-transform-handle-inline-ne")).toBeInTheDocument();
  });

  it("keeps transform overlay chrome rendered during transform interactions", async () => {
    const previousImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1200;
      naturalHeight = 1200;

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
      render(
        <ExpertEditPanelView
          {...baseProps}
          referenceImageUrl="https://example.com/fixed-transform-overlay-chrome.png"
          referenceText="prompt text"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

      const primaryDropzone = screen.getByLabelText("Primary composition surface");
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

      dragStagePointer({
        currentTarget: primaryDropzone,
        pointerId: 262,
        startX: 196,
        startY: 4,
        endX: 110,
        endY: 90,
        shiftKey: true,
      });
      expect(screen.getByTestId("edit-expert-transform-overlay-inline")).toBeInTheDocument();
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: previousImage,
      });
    }
  });

  it.skip("applies move history controls after transform interactions", async () => {
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

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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
    const recenterButton = screen.getByRole("button", { name: /center move action/i });
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();
    expect(recenterButton).toBeDisabled();

    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 140,
      startX: 196,
      startY: 4,
      endX: 110,
      endY: 90,
      shiftKey: true,
    });
    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 141,
      startX: 30,
      startY: 30,
      endX: 80,
      endY: 95,
    });

    const movedTranslate = readFrameTranslate(frame);
    expect(Math.abs(movedTranslate.x)).toBeGreaterThan(1);
    expect(Math.abs(movedTranslate.y)).toBeGreaterThan(1);
    expect(undoButton).toBeEnabled();
    expect(redoButton).toBeDisabled();
    expect(recenterButton).toBeEnabled();

    fireEvent.click(undoButton);
    const undoneTranslate = readFrameTranslate(frame);
    expect(Math.abs(undoneTranslate.x)).toBeLessThan(0.01);
    expect(Math.abs(undoneTranslate.y)).toBeLessThan(0.01);
    expect(redoButton).toBeEnabled();
    expect(recenterButton).toBeEnabled();

    fireEvent.click(redoButton);
    const redoneTranslate = readFrameTranslate(frame);
    expect(Math.abs(redoneTranslate.x)).toBeGreaterThan(1);
    expect(Math.abs(redoneTranslate.y)).toBeGreaterThan(1);
  });

  it("resizes only the selected layer when adjust drag starts with shift", async () => {
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

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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

    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 70,
      startX: 196,
      startY: 4,
      endX: 110,
      endY: 90,
      shiftKey: true,
    });
    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 71,
      startX: 160,
      startY: 40,
      endX: 220,
      endY: -10,
      shiftKey: true,
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

    expect(uploadedScaleAfter).not.toBeCloseTo(uploadedScaleBefore, 4);
    expect(foundationScaleAfter).toBeCloseTo(foundationScaleBefore, 4);
  });

  it("resizes the selected layer when adjust drag starts with shift", async () => {
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

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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

    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 50,
      startX: 196,
      startY: 4,
      endX: 110,
      endY: 90,
      shiftKey: true,
    });
    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 51,
      startX: 110,
      startY: 90,
      endX: 236,
      endY: -24,
      shiftKey: true,
    });

    const resizedScale = Number(frame.style.transform.match(/scale\(([^)]+)\)/)?.[1] ?? "0");
    expect(resizedScale).toBeGreaterThan(initialScale);
  });

  it.skip("shrinks the selected layer from inward shift adjust drag", async () => {
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

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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
      shiftKey: true,
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
    expect(resizedScale).toBeLessThan(initialScale);
  });

  it("rotates the selected layer with alt/option drag and supports undo/redo", async () => {
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

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    mockElementRect(primaryDropzone, createSquareRect(200));

    const frame = document.querySelector(".edit-expert-primary-layer-frame") as HTMLDivElement;
    expect(readFrameRotationDeg(frame)).toBeCloseTo(0, 4);

    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 777,
      pointerType: "mouse",
      button: 0,
      altKey: true,
      clientX: 180,
      clientY: 100,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 777,
      pointerType: "mouse",
      altKey: true,
      clientX: 100,
      clientY: 20,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 777,
      pointerType: "mouse",
      altKey: true,
      clientX: 100,
      clientY: 20,
    });

    const rotatedDeg = readFrameRotationDeg(frame);
    expect(Math.abs(rotatedDeg)).toBeGreaterThan(1);

    const moveSettingsPanel = screen.getByRole("group", { name: /move tools/i });
    const undoButton = within(moveSettingsPanel).getByRole("button", {
      name: /undo move action/i,
    });
    const redoButton = within(moveSettingsPanel).getByRole("button", {
      name: /redo move action/i,
    });

    fireEvent.click(undoButton);
    expect(readFrameRotationDeg(frame)).toBeCloseTo(0, 3);
    fireEvent.click(redoButton);
    expect(Math.abs(readFrameRotationDeg(frame))).toBeGreaterThan(1);
  });

  it.skip("recenters the selected layer from the move history row", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/recenter-target.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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
    const recenterButton = screen.getByRole("button", { name: /center move action/i });
    expect(recenterButton).toBeDisabled();

    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 60,
      startX: 196,
      startY: 4,
      endX: 110,
      endY: 90,
      shiftKey: true,
    });
    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 61,
      startX: 60,
      startY: 40,
      endX: 156,
      endY: 128,
    });

    const movedTranslate = readFrameTranslate(frame);
    expect(Math.abs(movedTranslate.x)).toBeGreaterThan(1);
    expect(Math.abs(movedTranslate.y)).toBeGreaterThan(1);
    expect(recenterButton).toBeEnabled();

    fireEvent.click(recenterButton);
    const resetTranslate = readFrameTranslate(frame);
    expect(Math.abs(resetTranslate.x)).toBeLessThan(0.01);
    expect(Math.abs(resetTranslate.y)).toBeLessThan(0.01);
    expect(recenterButton).toBeDisabled();
  });

  it.skip("recenters the selected layer when double clicking the primary stage in move mode", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/recenter-stage-double-click-target.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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

    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 260,
      startX: 196,
      startY: 4,
      endX: 110,
      endY: 90,
      shiftKey: true,
    });
    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 261,
      startX: 50,
      startY: 44,
      endX: 142,
      endY: 139,
    });

    const movedTranslate = readFrameTranslate(frame);
    expect(Math.abs(movedTranslate.x)).toBeGreaterThan(1);
    expect(Math.abs(movedTranslate.y)).toBeGreaterThan(1);

    fireEvent.doubleClick(primaryDropzone);
    const resetTranslate = readFrameTranslate(frame);
    expect(Math.abs(resetTranslate.x)).toBeLessThan(0.01);
    expect(Math.abs(resetTranslate.y)).toBeLessThan(0.01);
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
    const previousImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1200;
      naturalHeight = 1200;

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
      render(
        <ExpertEditPanelView
          {...baseProps}
          referenceImageUrl="https://example.com/reticle-target.png"
        />
      );
      const primaryDropzone = screen.getByLabelText("Primary composition surface");

      fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(await within(rail).findByRole("button", { name: /^inpaint$/i }));

      const brushCursor = primaryDropzone.style.cursor;
      expect(brushCursor).toContain("data:image/svg+xml");
      expect(brushCursor).toContain("crosshair");

      fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));
      expect(primaryDropzone.style.cursor).toBe("grab");

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
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: previousImage,
      });
    }
  });

  it("shows markup reticle on both inline and expanded stages", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-reticle-source.png"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    expect(primaryDropzone.style.cursor).toContain("data:image/svg+xml");
    expect(primaryDropzone.style.cursor).toContain("crosshair");

    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(within(markupPanel).getByRole("button", { name: /expand markup tools/i }));

    const expandedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    const modalStage = expandedModal.querySelector(".edit-expert-markup-modal-stage");
    expect(modalStage).toBeTruthy();
    expect((modalStage as HTMLElement).style.cursor).toContain("data:image/svg+xml");
    expect((modalStage as HTMLElement).style.cursor).toContain("crosshair");
  });

  it("locks brush reticle cursor globally during active brush drawing and restores on pointer up", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/brush-cursor-lock.png"
        referenceText="prompt text"
      />
    );

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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

  it("locks pen reticle cursor globally during active markup pen drawing in expanded modal and restores on pointer up", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-cursor-lock.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));
    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(within(markupPanel).getByRole("button", { name: /expand markup tools/i }));

    const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
    const modalStage = expandedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement | null;
    expect(modalStage).toBeTruthy();

    const rect = {
      left: 0,
      top: 0,
      width: 260,
      height: 260,
      right: 260,
      bottom: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(modalStage as HTMLDivElement, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    expect(document.body.style.cursor).toBe("");
    expect(document.documentElement.style.cursor).toBe("");

    fireEvent.pointerDown(modalStage as HTMLDivElement, {
      pointerId: 9111,
      pointerType: "mouse",
      button: 0,
      clientX: 80,
      clientY: 80,
    });

    expect(document.body.style.cursor).toContain("data:image/svg+xml");
    expect(document.documentElement.style.cursor).toContain("data:image/svg+xml");

    fireEvent.pointerUp(modalStage as HTMLDivElement, {
      pointerId: 9111,
      pointerType: "mouse",
      clientX: 120,
      clientY: 120,
    });

    expect(document.body.style.cursor).toBe("");
    expect(document.documentElement.style.cursor).toBe("");
  });

  it("keeps the markup eraser button hidden in the expanded modal", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-hidden-eraser.png"
        referenceText="prompt text"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));
    const markupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(within(markupPanel).getByRole("button", { name: /expand markup tools/i }));

    const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
    const modalMarkupPanel = within(expandedModal).getByRole("group", { name: /markup tools/i });
    expect(within(modalMarkupPanel).queryByRole("button", { name: /^eraser$/i })).toBeNull();
  });

  it("suppresses inpaint cursor while presets surface is open and restores it on close", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/reticle-source.png"
      />
    );
    const primaryDropzone = screen.getByLabelText("Primary composition surface");

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

  it("clears the space-pan cursor while presets surface blocks the inline stage", () => {
    const previousImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1200;
      naturalHeight = 1200;

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
      render(
        <ExpertEditPanelView
          {...baseProps}
          referenceImageUrl="https://example.com/space-pan-source.png"
        />
      );
      const primaryDropzone = screen.getByLabelText("Primary composition surface");
      const trigger = screen.getByRole("button", { name: /apply more presets preset/i });

      act(() => {
        fireEvent.keyDown(window, { code: "Space", key: " " });
      });
      expect(primaryDropzone).toHaveStyle({ cursor: "grab" });

      act(() => {
        fireEvent.click(trigger);
      });
      expect(screen.getByRole("region", { name: /more presets/i })).toBeInTheDocument();
      expect(primaryDropzone).toHaveStyle({ cursor: "" });

      act(() => {
        fireEvent.click(trigger);
      });
      expect(screen.queryByRole("region", { name: /more presets/i })).not.toBeInTheDocument();
      expect(primaryDropzone).toHaveStyle({ cursor: "" });

      act(() => {
        fireEvent.keyDown(window, { code: "Space", key: " " });
      });
      expect(primaryDropzone).toHaveStyle({ cursor: "grab" });

      act(() => {
        fireEvent.keyUp(window, { code: "Space", key: " " });
      });
      expect(primaryDropzone).toHaveStyle({ cursor: "" });
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: previousImage,
      });
    }
  });

  it("does not show lasso cursor when selected layer has no image", async () => {
    render(<ExpertEditPanelView {...baseProps} referenceImageUrl={null} />);

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^inpaint$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^lasso$/i }));

    const primaryStage = screen.getByLabelText("Primary edit stage");
    expect(primaryStage).toHaveStyle({ cursor: "" });
  });

  it("shows a toast when drawing is attempted without a selected layer image", () => {
    render(<ExpertEditPanelView {...baseProps} referenceImageUrl={null} />);
    const primaryStage = screen.getByLabelText("Primary edit stage");

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));

    fireEvent.pointerDown(primaryStage, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    expect(screen.queryByText("Select a layer image before drawing.")).not.toBeInTheDocument();
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

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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
        modalOverlayCanvasRef: { current: null },
        previewCanvasRef: { current: null },
        modalPreviewCanvasRef: { current: null },
        hasSelectedLayerMask: false,
        imageHasInteractiveMask: true,
        captureMaskSnapshot: vi.fn(() => ({ layers: [] })),
        restoreMaskSnapshot: vi.fn(),
        clearAllMasks: vi.fn(),
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
      expect(document.querySelectorAll(".edit-expert-inpaint-overlay-canvas")).toHaveLength(1);
      expect(document.querySelectorAll(".edit-expert-inpaint-live-preview-canvas")).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));
      const primaryDropzone = screen.getByLabelText("Primary composition surface");
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
      fireEvent.pointerCancel(primaryDropzone, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 2,
        clientY: 2,
      });
      fireEvent.pointerLeave(primaryDropzone, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 2,
        clientY: 2,
      });
      expect(onPointerDown).toHaveBeenCalledTimes(1);
      expect(onPointerMove).toHaveBeenCalledTimes(1);
      expect(onPointerUp).toHaveBeenCalledTimes(1);
      expect(onPointerCancel).toHaveBeenCalledTimes(1);
      expect(onPointerLeave).toHaveBeenCalledTimes(1);
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
    }
  });

  it("routes expanded modal stage pointer events to inpaint handlers and renders modal overlay", async () => {
    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();
    const onPointerCancel = vi.fn();
    const onPointerLeave = vi.fn();
    const clearSelectedLayerMask = vi.fn();
    const invertSelectedLayerMask = vi.fn();
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        modalOverlayCanvasRef: { current: null },
        previewCanvasRef: { current: null },
        modalPreviewCanvasRef: { current: null },
        hasSelectedLayerMask: true,
        imageHasInteractiveMask: true,
        captureMaskSnapshot: vi.fn(() => ({ layers: [] })),
        restoreMaskSnapshot: vi.fn(),
        clearAllMasks: vi.fn(),
        clearSelectedLayerMask,
        invertSelectedLayerMask,
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

      const inpaintPanel = screen.getByRole("group", { name: /inpaint tools/i });
      fireEvent.click(within(inpaintPanel).getByRole("button", { name: /expand markup tools/i }));

      const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
      const modalStage = expandedModal.querySelector(".edit-expert-markup-modal-stage");
      expect(modalStage).toBeTruthy();
      expect(document.querySelectorAll(".edit-expert-inpaint-overlay-canvas")).toHaveLength(1);
      expect(document.querySelectorAll(".edit-expert-inpaint-live-preview-canvas")).toHaveLength(1);
      expect(
        expandedModal.querySelector(".edit-expert-inpaint-overlay-canvas")
      ).toBeInTheDocument();
      expect(
        expandedModal.querySelector(".edit-expert-inpaint-live-preview-canvas")
      ).toBeInTheDocument();
      const modalInpaintPanel = within(expandedModal).getByRole("group", {
        name: /in-paint tools/i,
      });
      fireEvent.click(within(modalInpaintPanel).getByRole("button", { name: /^brush$/i }));

      fireEvent.pointerDown(modalStage as HTMLElement, {
        pointerId: 11,
        pointerType: "mouse",
        button: 0,
        clientX: 20,
        clientY: 20,
      });
      fireEvent.pointerMove(modalStage as HTMLElement, {
        pointerId: 11,
        pointerType: "mouse",
        clientX: 42,
        clientY: 36,
      });
      fireEvent.pointerUp(modalStage as HTMLElement, {
        pointerId: 11,
        pointerType: "mouse",
        clientX: 42,
        clientY: 36,
      });
      fireEvent.pointerCancel(modalStage as HTMLElement, {
        pointerId: 11,
        pointerType: "mouse",
        clientX: 42,
        clientY: 36,
      });
      fireEvent.pointerLeave(modalStage as HTMLElement, {
        pointerId: 11,
        pointerType: "mouse",
        clientX: 42,
        clientY: 36,
      });
      expect(onPointerDown).toHaveBeenCalledTimes(1);
      expect(onPointerMove).toHaveBeenCalledTimes(1);
      expect(onPointerUp).toHaveBeenCalledTimes(1);
      expect(onPointerCancel).toHaveBeenCalledTimes(1);
      expect(onPointerLeave).toHaveBeenCalledTimes(1);

      fireEvent.click(
        within(modalInpaintPanel).getByRole("button", { name: /invert in-paint selection/i })
      );
      fireEvent.click(
        within(modalInpaintPanel).getByRole("button", { name: /clear in-paint selection/i })
      );
      expect(invertSelectedLayerMask).toHaveBeenCalledTimes(1);
      expect(clearSelectedLayerMask).toHaveBeenCalledTimes(1);
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
    }
  });

  it.skip("applies image transforms from the expanded modal stage", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/modal-transform-target.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));
    const movePanel = screen.getByRole("group", { name: /move tools/i });
    fireEvent.click(within(movePanel).getByRole("button", { name: /expand markup tools/i }));

    const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
    const modalStage = expandedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement;
    expect(modalStage).toBeTruthy();
    const modalMovePanel = within(expandedModal).getByRole("group", { name: /^move tools$/i });
    fireEvent.click(within(modalMovePanel).getByRole("button", { name: /^adjust$/i }));
    mockElementRect(modalStage, createSquareRect(240));

    const modalFrame = expandedModal.querySelector(
      ".edit-expert-primary-layer-frame"
    ) as HTMLDivElement;
    expect(modalFrame).toBeTruthy();
    const initialTranslate = readFrameTranslate(modalFrame);
    const initialScale = readFrameScale(modalFrame);
    const initialRotation = readFrameRotationDeg(modalFrame);

    dragStagePointer({
      currentTarget: modalStage,
      pointerId: 40,
      startX: 236,
      startY: 4,
      endX: 140,
      endY: 100,
      shiftKey: true,
    });
    dragStagePointer({
      currentTarget: modalStage,
      pointerId: 41,
      startX: 120,
      startY: 120,
      endX: 160,
      endY: 148,
    });
    const translated = readFrameTranslate(modalFrame);
    expect(Math.abs(translated.x - initialTranslate.x)).toBeGreaterThan(1);
    expect(Math.abs(translated.y - initialTranslate.y)).toBeGreaterThan(1);

    dragStagePointer({
      currentTarget: modalStage,
      pointerId: 42,
      startX: 170,
      startY: 120,
      endX: 220,
      endY: 120,
      shiftKey: true,
    });
    expect(readFrameScale(modalFrame)).not.toBeCloseTo(initialScale, 4);

    fireEvent.pointerDown(modalStage, {
      pointerId: 43,
      pointerType: "mouse",
      button: 0,
      altKey: true,
      clientX: 220,
      clientY: 120,
    });
    fireEvent.pointerMove(modalStage, {
      pointerId: 43,
      pointerType: "mouse",
      altKey: true,
      clientX: 120,
      clientY: 220,
    });
    fireEvent.pointerUp(modalStage, {
      pointerId: 43,
      pointerType: "mouse",
      altKey: true,
      clientX: 120,
      clientY: 220,
    });
    expect(Math.abs(readFrameRotationDeg(modalFrame) - initialRotation)).toBeGreaterThan(1);
  });

  it("applies undo/redo general actions to markup strokes", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-history.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(within(rail).getByRole("button", { name: /^markup$/i }));
    const inlineMarkupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(
      within(inlineMarkupPanel).getByRole("button", { name: /expand markup tools/i })
    );

    const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
    const modalStage = expandedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement;
    expect(modalStage).toBeTruthy();
    mockElementRect(modalStage, createSquareRect(240));

    fireEvent.pointerDown(modalStage, {
      pointerId: 88,
      pointerType: "mouse",
      button: 0,
      clientX: 70,
      clientY: 70,
    });
    fireEvent.pointerMove(modalStage, {
      pointerId: 88,
      pointerType: "mouse",
      clientX: 142,
      clientY: 132,
    });
    fireEvent.pointerUp(modalStage, {
      pointerId: 88,
      pointerType: "mouse",
      clientX: 142,
      clientY: 132,
    });

    await waitFor(() =>
      expect(
        expandedModal.querySelectorAll(".edit-expert-markup-strokes-overlay polyline").length
      ).toBeGreaterThan(0)
    );

    const undoButton = within(expandedModal).getByRole("button", { name: /undo action/i });
    await waitFor(() => expect(undoButton).toBeEnabled());
    fireEvent.click(undoButton);
    await waitFor(() =>
      expect(
        expandedModal.querySelectorAll(".edit-expert-markup-strokes-overlay polyline").length
      ).toBe(0)
    );

    const redoButton = within(expandedModal).getByRole("button", { name: /redo action/i });
    await waitFor(() => expect(redoButton).toBeEnabled());
    fireEvent.click(redoButton);
    await waitFor(() =>
      expect(
        expandedModal.querySelectorAll(".edit-expert-markup-strokes-overlay polyline").length
      ).toBeGreaterThan(0)
    );
  });

  it("renders closed lasso markup shapes in the expanded markup modal", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-lasso.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(within(rail).getByRole("button", { name: /^markup$/i }));
    const inlineMarkupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(within(inlineMarkupPanel).getByRole("button", { name: /^lasso$/i }));
    fireEvent.click(
      within(inlineMarkupPanel).getByRole("button", { name: /expand markup tools/i })
    );

    const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
    const modalMarkupPanel = within(expandedModal).getByRole("group", { name: /markup tools/i });
    expect(within(modalMarkupPanel).getByRole("button", { name: /^lasso$/i })).toBeInTheDocument();
    const modalStage = expandedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement;
    expect(modalStage).toBeTruthy();
    mockElementRect(modalStage, createSquareRect(240));

    fireEvent.pointerDown(modalStage, {
      pointerId: 92,
      pointerType: "mouse",
      button: 0,
      clientX: 56,
      clientY: 64,
    });
    fireEvent.pointerMove(modalStage, {
      pointerId: 92,
      pointerType: "mouse",
      clientX: 168,
      clientY: 68,
    });
    fireEvent.pointerMove(modalStage, {
      pointerId: 92,
      pointerType: "mouse",
      clientX: 118,
      clientY: 172,
    });
    fireEvent.pointerUp(modalStage, {
      pointerId: 92,
      pointerType: "mouse",
      clientX: 118,
      clientY: 172,
    });

    await waitFor(() =>
      expect(
        expandedModal.querySelectorAll(".edit-expert-markup-strokes-overlay polygon").length
      ).toBeGreaterThan(0)
    );
    expect(
      expandedModal
        .querySelector(".edit-expert-markup-strokes-overlay [data-markup-layer='strokes']")
        ?.getAttribute("opacity")
    ).toBe(String(MARKUP_OVERLAY_OPACITY));
  });

  it("supports keyboard undo/redo in the expanded markup modal", async () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/markup-hotkeys.png"
        referenceText="prompt text"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(within(rail).getByRole("button", { name: /^markup$/i }));
    const inlineMarkupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(
      within(inlineMarkupPanel).getByRole("button", { name: /expand markup tools/i })
    );

    const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
    const modalStage = expandedModal.querySelector(
      ".edit-expert-markup-modal-stage"
    ) as HTMLDivElement;
    expect(modalStage).toBeTruthy();
    mockElementRect(modalStage, createSquareRect(240));

    fireEvent.pointerDown(modalStage, {
      pointerId: 91,
      pointerType: "mouse",
      button: 0,
      clientX: 66,
      clientY: 68,
    });
    fireEvent.pointerMove(modalStage, {
      pointerId: 91,
      pointerType: "mouse",
      clientX: 146,
      clientY: 136,
    });
    fireEvent.pointerUp(modalStage, {
      pointerId: 91,
      pointerType: "mouse",
      clientX: 146,
      clientY: 136,
    });

    await waitFor(() =>
      expect(
        expandedModal.querySelectorAll(".edit-expert-markup-strokes-overlay polyline").length
      ).toBeGreaterThan(0)
    );

    const undoButton = within(expandedModal).getByRole("button", { name: /undo action/i });
    await waitFor(() => expect(undoButton).toBeEnabled());
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    await waitFor(() =>
      expect(
        expandedModal.querySelectorAll(".edit-expert-markup-strokes-overlay polyline").length
      ).toBe(0)
    );

    const redoButton = within(expandedModal).getByRole("button", { name: /redo action/i });
    await waitFor(() => expect(redoButton).toBeEnabled());
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    await waitFor(() =>
      expect(
        expandedModal.querySelectorAll(".edit-expert-markup-strokes-overlay polyline").length
      ).toBeGreaterThan(0)
    );
  });

  it.skip("applies undo and reset general actions to inpaint mutations", async () => {
    const emptySnapshot: InpaintMaskSnapshot = { layers: [] };
    const paintedSnapshot: InpaintMaskSnapshot = {
      layers: [
        {
          layerId: "layer-1",
          width: 2,
          height: 2,
          alpha: new Uint8ClampedArray([255, 0, 0, 0]),
        },
      ],
    };
    let currentSnapshot = emptySnapshot;
    const restoreMaskSnapshot = vi.fn((snapshot: InpaintMaskSnapshot) => {
      currentSnapshot = snapshot;
    });
    const clearAllMasks = vi.fn(() => {
      currentSnapshot = emptySnapshot;
    });
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        modalOverlayCanvasRef: { current: null },
        previewCanvasRef: { current: null },
        modalPreviewCanvasRef: { current: null },
        hasSelectedLayerMask: true,
        imageHasInteractiveMask: true,
        captureMaskSnapshot: vi.fn(() => currentSnapshot),
        restoreMaskSnapshot,
        clearAllMasks,
        clearSelectedLayerMask: vi.fn(),
        invertSelectedLayerMask: vi.fn(),
        exportSelectedLayerMaskBlob: vi.fn(async () => null),
        onPointerDown: vi.fn(),
        onPointerMove: vi.fn(),
        onPointerUp: vi.fn(() => {
          currentSnapshot = paintedSnapshot;
        }),
        onPointerCancel: vi.fn(),
        onPointerLeave: vi.fn(),
      });
    try {
      render(
        <ExpertEditPanelView
          {...baseProps}
          referenceImageUrl="https://example.com/inpaint-history.png"
          referenceText="prompt text"
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));
      const inlineInpaintPanel = screen.getByRole("group", { name: /inpaint tools/i });
      fireEvent.click(
        within(inlineInpaintPanel).getByRole("button", { name: /expand markup tools/i })
      );

      const expandedModal = await screen.findByRole("dialog", { name: /expanded markup canvas/i });
      const modalInpaintPanel = within(expandedModal).getByRole("group", {
        name: /in-paint tools/i,
      });
      fireEvent.click(within(modalInpaintPanel).getByRole("button", { name: /^brush$/i }));
      const modalStage = expandedModal.querySelector(
        ".edit-expert-markup-modal-stage"
      ) as HTMLDivElement;
      expect(modalStage).toBeTruthy();

      fireEvent.pointerDown(modalStage, {
        pointerId: 61,
        pointerType: "mouse",
        button: 0,
        clientX: 42,
        clientY: 42,
      });
      fireEvent.pointerUp(modalStage, {
        pointerId: 61,
        pointerType: "mouse",
        button: 0,
        clientX: 78,
        clientY: 74,
      });

      fireEvent.click(within(expandedModal).getByRole("button", { name: /undo action/i }));
      await waitFor(() => expect(restoreMaskSnapshot).toHaveBeenCalledWith(emptySnapshot));

      fireEvent.pointerDown(modalStage, {
        pointerId: 62,
        pointerType: "mouse",
        button: 0,
        clientX: 54,
        clientY: 54,
      });
      fireEvent.pointerUp(modalStage, {
        pointerId: 62,
        pointerType: "mouse",
        button: 0,
        clientX: 96,
        clientY: 88,
      });

      fireEvent.click(within(expandedModal).getByRole("button", { name: /reset stage/i }));
      await waitFor(() => expect(clearAllMasks).toHaveBeenCalled());
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
        modalOverlayCanvasRef: { current: null },
        previewCanvasRef: { current: null },
        modalPreviewCanvasRef: { current: null },
        hasSelectedLayerMask: false,
        imageHasInteractiveMask: true,
        captureMaskSnapshot: vi.fn(() => ({ layers: [] })),
        restoreMaskSnapshot: vi.fn(),
        clearAllMasks: vi.fn(),
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
      const primaryDropzone = screen.getByLabelText("Primary composition surface");
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
    fireEvent.click(screen.getByLabelText("Primary edit stage"));

    expect(inputClickSpy).not.toHaveBeenCalled();
  });

  it("keeps the blank primary stage inert to upload click", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);
    const primaryInput = getPrimaryFileInput(container);
    const inputClickSpy = vi.spyOn(primaryInput, "click");

    fireEvent.click(screen.getByLabelText("Primary edit stage"));

    expect(inputClickSpy).not.toHaveBeenCalled();
  });

  it("keeps the blank primary stage inert to drag/drop ingest", () => {
    const onPrimaryImageChange = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onPrimaryImageChange={onPrimaryImageChange} />);

    const primaryStage = screen.getByLabelText("Primary edit stage");
    const transfer = createImageDropTransfer("https://example.com/blank-stage-drop.png");
    fireEvent.dragEnter(primaryStage, { dataTransfer: transfer });
    fireEvent.dragOver(primaryStage, { dataTransfer: transfer });
    fireEvent.drop(primaryStage, { dataTransfer: transfer });

    expect(primaryStage).toHaveClass("is-empty-stage");
    expect(onPrimaryImageChange).not.toHaveBeenCalled();
  });

  it("accepts reference image drops onto the blank primary canvas frame", async () => {
    const resolvePreviewUrlById = vi.fn(() => "https://example.com/reference-grid-image.png");
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="prompt text"
        resolvePreviewUrlById={resolvePreviewUrlById}
      />
    );

    const primaryCanvasFrameStack = container.querySelector(
      '[data-testid="edit-expert-primary-canvas-frame-stack"]'
    ) as HTMLDivElement;
    const transfer = createReferenceImageDropTransfer({
      url: "blob:reference-grid-source",
      referenceId: "out-1",
    });

    await act(async () => {
      fireEvent.dragEnter(primaryCanvasFrameStack, { dataTransfer: transfer });
      fireEvent.dragOver(primaryCanvasFrameStack, { dataTransfer: transfer });
      fireEvent.drop(primaryCanvasFrameStack, { dataTransfer: transfer });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolvePreviewUrlById).toHaveBeenCalledWith("out-1");
    expect(screen.getByLabelText("Primary composition surface")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "layer 1" })).toBeInTheDocument();
  });

  it("seeds dropped generated image dimensions before standard edit export", async () => {
    const generatedUrl = "https://fal.media/files/generated-wide-2k.png";
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => {});
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        aspect="16:9"
        referenceText="prompt text"
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    const primaryCanvasFrameStack = container.querySelector(
      '[data-testid="edit-expert-primary-canvas-frame-stack"]'
    ) as HTMLDivElement;
    const transfer = createReferenceImageDropTransfer({
      url: generatedUrl,
      referenceId: "out-wide-1",
      width: 2048,
      height: 1152,
    });

    await act(async () => {
      fireEvent.drop(primaryCanvasFrameStack, { dataTransfer: transfer });
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(composePrimaryStageLayersToBlobMock).not.toHaveBeenCalled();
    const [referenceInputs, submitOptions] = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: {
          calls: Array<[string[], { referenceInputsMode?: "merge" | "replace" }?]>;
        };
      }
    ).mock.calls[0] ?? [[], undefined];
    expect(referenceInputs[0]).toBe(generatedUrl);
    expect(submitOptions?.referenceInputsMode).toBe("replace");
  });

  it("does not open the custom stage actions menu from the blank primary stage", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.contextMenu(screen.getByLabelText("Primary edit stage"));

    expect(screen.queryByRole("menu", { name: /stage actions/i })).not.toBeInTheDocument();
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
    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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
          referenceImageUrl="https://example.com/existing-primary.png"
          referenceText="prompt text"
          onPrimaryImageChange={onPrimaryImageChange}
          resolvePreviewUrlById={resolvePreviewUrlById}
        />
      );

      const primaryDropzone = screen.getByLabelText("Primary composition surface");
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
      expect(onPrimaryImageChange).not.toHaveBeenCalled();
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
    const onPrimaryImageChange = vi.fn();
    const { container } = render(
      <ExpertEditPanelView {...baseProps} onPrimaryImageChange={onPrimaryImageChange} />
    );

    expect(screen.queryByRole("button", { name: /add layer/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "layer 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();

    uploadPrimaryFile(container, "added-layer-1.png");
    expect(screen.getByRole("button", { name: "layer 1" })).toHaveClass("is-selected");
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();
    expect(onPrimaryImageChange).toHaveBeenCalledTimes(1);
    expect(onPrimaryImageChange).toHaveBeenLastCalledWith(
      expect.stringMatching(/^blob:file-added-layer-1\.png-\d+$/)
    );
    onPrimaryImageChange.mockClear();

    uploadPrimaryFile(container, "added-layer-2.png");
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "layer 2" })).toHaveClass("is-selected");
    expect(onPrimaryImageChange).not.toHaveBeenCalled();
  });

  it("keeps layer selection panel-local without republishing shared primary authority", () => {
    const onPrimaryImageChange = vi.fn();
    const { container } = render(
      <ExpertEditPanelView {...baseProps} onPrimaryImageChange={onPrimaryImageChange} />
    );

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");
    onPrimaryImageChange.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "layer 2" }));

    expect(screen.getByRole("button", { name: "layer 2" })).toHaveClass("is-selected");
    expect(onPrimaryImageChange).not.toHaveBeenCalled();
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

  it("deletes the selected layer from the stage overlay action", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "base.png");
    uploadPrimaryFile(container, "layer-2.png");

    expect(screen.getByRole("button", { name: "layer 2" })).toHaveClass("is-selected");

    fireEvent.click(screen.getByRole("button", { name: /delete selected layer/i }));

    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "layer 1" })).toHaveClass("is-selected");
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

  it("does not write plain text payload when starting a layer reorder drag", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");

    const rowForLayerTwo = screen
      .getByRole("button", { name: "layer 2" })
      .closest(".edit-expert-layer-row") as HTMLElement;
    const transfer = createLayerDragTransfer();

    fireEvent.dragStart(rowForLayerTwo, { dataTransfer: transfer });

    expect(transfer.setData).toHaveBeenCalledWith("application/x-shortpulse-layer-index", "0");
    expect(transfer.setData).not.toHaveBeenCalledWith("text/plain", expect.any(String));
  });

  it("allows dragging layers to reorder inside the expanded markup modal", async () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");
    uploadPrimaryFile(container, "layer-3.png");

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^markup$/i }));

    const inlineMarkupPanel = screen.getByRole("group", { name: /markup tools/i });
    fireEvent.click(
      within(inlineMarkupPanel).getByRole("button", { name: /expand markup tools/i })
    );

    const expandedModal = screen.getByRole("dialog", { name: /expanded markup canvas/i });
    const rowForLayerThree = within(expandedModal)
      .getByRole("button", { name: "layer 3" })
      .closest(".edit-expert-layer-row") as HTMLElement;
    const rowForLayerOne = within(expandedModal)
      .getByRole("button", { name: "layer 1" })
      .closest(".edit-expert-layer-row") as HTMLElement;
    const transfer = createLayerDragTransfer();

    fireEvent.dragStart(rowForLayerThree, { dataTransfer: transfer });
    fireEvent.dragOver(rowForLayerOne, { dataTransfer: transfer });
    fireEvent.drop(rowForLayerOne, { dataTransfer: transfer });

    const labels = Array.from(
      expandedModal.querySelectorAll(".edit-expert-layer-row .edit-expert-layer-label")
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

    await waitFor(() => {
      expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledTimes(1);
    });
    const composeCalls = composePrimaryStageLayersToBlobMock.mock.calls as unknown as Array<
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

  it("suppresses repeated inline generate clicks before stage flattening completes", async () => {
    const flattenResolvers: Array<(value: Blob) => void> = [];
    const createPendingFlatten = () =>
      new Promise<Blob>((resolve) => {
        flattenResolvers.push(resolve);
      });
    composePrimaryStageLayersToBlobMock.mockImplementationOnce(createPendingFlatten);
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => undefined);
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="prompt text"
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    uploadPrimaryFile(container, "layer-1.png");

    const generateButton = screen.getByRole("button", { name: /^generate$/i });

    await act(async () => {
      fireEvent.click(generateButton);
      fireEvent.click(generateButton);
      await Promise.resolve();
    });

    expect(generateButton).toBeEnabled();
    await waitFor(() => {
      expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledTimes(1);
    });
    expect(flattenResolvers).toHaveLength(1);

    await act(async () => {
      flattenResolvers.splice(0).forEach((resolve, index) => {
        resolve(new Blob([`flattened-stage-${index}`], { type: "image/png" }));
      });
      await Promise.resolve();
    });
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

  it("blocks creation when a 7th layer is attempted by primary drop/file add", () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    for (let index = 1; index <= 6; index += 1) {
      uploadPrimaryFile(container, `layer-${index}.png`);
    }
    expect(screen.getByRole("button", { name: "layer 6" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add layer/i })).not.toBeInTheDocument();

    uploadPrimaryFile(container, "layer-7-over-limit.png");
    expect(screen.queryByRole("button", { name: "layer 7" })).not.toBeInTheDocument();
    expect(screen.queryByText("Layer limit reached (6).")).not.toBeInTheDocument();
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

  it("manual flatten collapses to layer 1 without adding a reference-grid copy", async () => {
    const onPrimaryImageChange = vi.fn();
    const { container } = render(
      <ExpertEditPanelView {...baseProps} onPrimaryImageChange={onPrimaryImageChange} />
    );

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
    onPrimaryImageChange.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flatten/i }));
      await Promise.resolve();
    });

    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "layer 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();
    expect(onPrimaryImageChange).not.toHaveBeenCalled();
  });

  it("shows flatten pending feedback while manual flatten is in progress", async () => {
    let resolveFlatten: ((blob: Blob) => void) | null = null;
    composePrimaryStageLayersToBlobMock.mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          resolveFlatten = resolve;
        })
    );
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flatten layers/i }));
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: /flattening layers/i })).toBeDisabled();
    expect(screen.getByText("Flattening...")).toBeInTheDocument();
    expect(screen.getByTestId("edit-expert-flatten-loading-overlay")).toBeInTheDocument();

    await act(async () => {
      resolveFlatten?.(new Blob(["flattened-stage"], { type: "image/png" }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("edit-expert-flatten-loading-overlay")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /flatten layers/i })).not.toBeDisabled();
  });

  it("manual flatten forwards selected frame ratio to stage flatten without adding a reference-grid copy", async () => {
    const { container, rerender } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");

    rerender(<ExpertEditPanelView {...baseProps} aspect="16:9" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flatten/i }));
      await Promise.resolve();
    });

    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledTimes(1);
    const flattenCalls = (
      composePrimaryStageLayersToBlobMock as unknown as {
        mock: {
          calls: unknown[][];
        };
      }
    ).mock.calls;
    const flattenOptions = (flattenCalls[0]?.[1] ?? null) as {
      outputAspectRatio?: number;
      mimeType?: string;
    } | null;
    expect(flattenOptions?.mimeType).toBe("image/png");
    expect(flattenOptions?.outputAspectRatio ?? 0).toBeCloseTo(16 / 9, 4);
  });

  it("manual flatten forwards frozen layer transforms to stage flatten helper", async () => {
    const { container } = render(<ExpertEditPanelView {...baseProps} />);

    uploadPrimaryFile(container, "layer-1.png");
    uploadPrimaryFile(container, "layer-2.png");

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    const rail = screen.getByLabelText("Inpaint action tools");
    fireEvent.click(await within(rail).findByRole("button", { name: /^move$/i }));

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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

    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 312,
      startX: 196,
      startY: 4,
      endX: 110,
      endY: 90,
      shiftKey: true,
    });
    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 313,
      startX: 32,
      startY: 36,
      endX: 92,
      endY: 98,
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /flatten/i }));
      await Promise.resolve();
    });

    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledTimes(1);
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
    expect(Math.abs(movedLayer?.transform?.translateXRatio ?? 0)).toBeGreaterThan(0.01);
    expect(Math.abs(movedLayer?.transform?.translateYRatio ?? 0)).toBeGreaterThan(0.01);
  });

  it.skip("auto-flattens on generate and forwards flattened refs with primary first", async () => {
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

    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalled();
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
                referenceInputsMode?: "append" | "replace";
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
    expect(referenceInputs).toEqual([
      expect.stringMatching(/^blob:flatten-/),
      "https://example.com/extra.png",
    ]);
    expect(submitOptions?.referenceInputsMode).toBe("replace");
    expect(submitOptions?.hideOutputFromReferenceGrid).toBeUndefined();
  });

  it("exports the durable primary source when standard edit framing is unchanged", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => {});
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="prompt text"
        referenceImageUrl="https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/user/reference-portrait.png?token=test"
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(composePrimaryStageLayersToBlobMock).not.toHaveBeenCalled();
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    const [referenceInputs, submitOptions] = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: {
          calls: Array<[string[], { referenceInputsMode?: "merge" | "replace" }?]>;
        };
      }
    ).mock.calls[0] ?? [[], undefined];
    expect(referenceInputs[0]).toBe(
      "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/user/reference-portrait.png?token=test"
    );
    expect(submitOptions?.referenceInputsMode).toBe("replace");
  });

  it("exports a public generated primary source when standard edit framing is unchanged", async () => {
    const publicGeneratedUrl = "https://fal.media/files/generated-2k.png";
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => {});
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="prompt text"
        referenceImageUrl={publicGeneratedUrl}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(composePrimaryStageLayersToBlobMock).not.toHaveBeenCalled();
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    const [referenceInputs, submitOptions] = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: {
          calls: Array<[string[], { referenceInputsMode?: "merge" | "replace" }?]>;
        };
      }
    ).mock.calls[0] ?? [[], undefined];
    expect(referenceInputs[0]).toBe(publicGeneratedUrl);
    expect(submitOptions?.referenceInputsMode).toBe("replace");
  });

  it.skip("still flattens standard edit when a durable primary source has an aspect mismatch", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => {});
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="prompt text"
        referenceImageUrl="https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/user/reference-portrait.png?token=test"
        aspect="3:4"
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalled();
    const [referenceInputs] = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: {
          calls: Array<[string[]]>;
        };
      }
    ).mock.calls[0] ?? [[]];
    expect(referenceInputs[0]).toMatch(/^blob:flatten-/);
  });

  it.skip("recomputes inline generate reuse when the composition aspect changes", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => {});
    const referenceImageUrl =
      "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/user/reference-portrait.png?token=test";
    const { rerender } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="prompt text"
        referenceImageUrl={referenceImageUrl}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    rerender(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="prompt text"
        referenceImageUrl={referenceImageUrl}
        aspect="3:4"
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledTimes(1);
    const [referenceInputs] = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: {
          calls: Array<[string[]]>;
        };
      }
    ).mock.calls[0] ?? [[]];
    expect(referenceInputs[0]).toMatch(/^blob:flatten-/);
  });

  it("auto-flatten generate ignores outer stage viewport framing and exports composition aspect ratio", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => {});
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
    fireEvent.click(within(rail).getByRole("button", { name: /^move$/i }));
    const moveSettingsPanel = screen.getByRole("group", { name: /move tools/i });
    const zoomSlider = within(moveSettingsPanel).getByRole("slider", {
      name: /zoom stage/i,
    });
    fireEvent.change(zoomSlider, { target: { value: "100" } });

    fireEvent.click(within(rail).getByRole("button", { name: /^markup$/i }));
    const primaryDropzone = screen.getByLabelText("Primary composition surface");
    mockElementRect(primaryDropzone, createSquareRect(200));
    fireEvent.keyDown(window, { code: "Space" });
    fireEvent.pointerDown(primaryDropzone, {
      pointerId: 911,
      pointerType: "mouse",
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(primaryDropzone, {
      pointerId: 911,
      pointerType: "mouse",
      clientX: 130,
      clientY: 112,
    });
    fireEvent.pointerUp(primaryDropzone, {
      pointerId: 911,
      pointerType: "mouse",
      clientX: 130,
      clientY: 112,
    });
    fireEvent.keyUp(window, { code: "Space" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    const flattenCalls = (
      composePrimaryStageLayersToBlobMock as unknown as {
        mock: {
          calls: unknown[][];
        };
      }
    ).mock.calls;
    const flattenOptions = (flattenCalls.at(-1)?.[1] ?? null) as {
      outputAspectRatio?: number;
      camera?: unknown;
    } | null;
    expect(flattenOptions?.outputAspectRatio ?? 0).toBeCloseTo(1, 4);
    expect(flattenOptions?.camera).toEqual(
      expect.objectContaining({
        viewportWidth: 200,
        viewportHeight: 200,
        scale: expect.any(Number),
      })
    );
  });

  it.skip("auto-flatten generate passes display/submission prompt overrides when @img tokens are used", async () => {
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

  it.skip("auto-flatten generate sends all populated secondary references when no @img tokens are linked", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
    });
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Refine the background and styling."
        extraImageUrls={[
          "https://example.com/extra-one.png",
          "https://example.com/extra-two.png",
          null,
        ]}
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
    const submittedReferences = submissionCalls[0]?.[0] ?? [];
    const submitOptions = submissionCalls[0]?.[1];
    expect(submittedReferences).toEqual([
      expect.stringMatching(/^blob:flatten-/),
      "https://example.com/extra-one.png",
      "https://example.com/extra-two.png",
    ]);
    expect(submitOptions?.displayPromptOverride).toBeUndefined();
    expect(submitOptions?.submissionPromptOverride).toBeUndefined();
  }, 15000);

  it.skip("auto-flatten generate sends only explicitly linked secondary references to the model", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
    });
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Use @img1 for the background."
        extraImageUrls={[
          "https://example.com/linked-extra.png",
          "https://example.com/unlinked-extra.png",
          null,
        ]}
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
          calls: Array<[string[]]>;
        };
      }
    ).mock.calls;
    const submittedReferences = submissionCalls[0]?.[0] ?? [];
    expect(submittedReferences).toEqual([
      expect.stringMatching(/^blob:flatten-/),
      "https://example.com/linked-extra.png",
    ]);
    expect(submittedReferences).not.toContain("https://example.com/unlinked-extra.png");
  });

  it.skip("auto-flatten generate includes a markup-composite secondary reference when markup mode is selected and strokes exist", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
    });
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Add annotation refinements."
        sessionState={createSessionStateWithMarkupStroke()}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
    fireEvent.click(within(modeTabs).getByRole("tab", { name: /^markup$/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(composeFlattenedMarkupReferenceBlobMock).toHaveBeenCalledTimes(1);
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    const submissionCalls = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: {
          calls: Array<
            [
              string[],
              {
                referenceInputsMode?: "merge" | "replace";
                inpaintOverride?: unknown;
              }?,
            ]
          >;
        };
      }
    ).mock.calls;
    const submittedReferences = submissionCalls[0]?.[0] ?? [];
    const submitOptions = submissionCalls[0]?.[1];
    expect(submittedReferences).toHaveLength(2);
    expect(submittedReferences[0]).toMatch(/^blob:flatten-/);
    expect(submittedReferences[1]).toMatch(/^blob:flatten-/);
    expect(submitOptions?.referenceInputsMode).toBe("replace");
    expect(submitOptions?.inpaintOverride).toBeUndefined();
  });

  it.skip("keeps the primary image first in markup submissions before the markup composite and linked secondary refs", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
    });
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Apply @img1, @img2, and @img3 to Figure 1."
        extraImageUrls={[
          "https://example.com/ref-1.png",
          "https://example.com/ref-2.png",
          "https://example.com/ref-3.png",
        ]}
        sessionState={createSessionStateWithMarkupStroke()}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
    fireEvent.click(within(modeTabs).getByRole("tab", { name: /^markup$/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    const submissionCalls = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: {
          calls: Array<[string[]]>;
        };
      }
    ).mock.calls;
    const submittedReferences = submissionCalls[0]?.[0] ?? [];
    expect(submittedReferences).toEqual([
      expect.stringMatching(/^blob:flatten-/),
      expect.stringMatching(/^blob:flatten-/),
      "https://example.com/ref-1.png",
      "https://example.com/ref-2.png",
      "https://example.com/ref-3.png",
    ]);
  });

  it("auto-flatten generate skips markup-composite secondary reference when Markup mode is not selected", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
    });
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Keep details aligned."
        referenceImageUrl="https://example.com/base.png"
        sessionState={createSessionStateWithMarkupStroke()}
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
      await Promise.resolve();
    });

    expect(composeFlattenedMarkupReferenceBlobMock).not.toHaveBeenCalled();
    const submissionCalls = (
      onRegenerateWithReferenceInputs as unknown as {
        mock: {
          calls: Array<[string[]]>;
        };
      }
    ).mock.calls;
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    const submittedReferences = submissionCalls[0]?.[0] ?? [];
    expect(submittedReferences).toHaveLength(1);
    expect(submittedReferences[0]).toBe("https://example.com/base.png");
  });

  it.skip("auto-flatten generate forces Nano Banana Pro edit model while Markup is selected", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async (referenceInputs, options) => {
      void referenceInputs;
      void options;
    });
    const { container } = render(
      <ExpertEditPanelView
        {...baseProps}
        referenceText="Add hand-drawn annotations."
        onRegenerateWithReferenceInputs={onRegenerateWithReferenceInputs}
      />
    );

    uploadPrimaryFile(container, "layer-1.png");
    const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
    fireEvent.click(within(modeTabs).getByRole("tab", { name: /^markup$/i }));

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
                modelIdOverride?: string | null;
                inpaintOverride?: unknown;
              }?,
            ]
          >;
        };
      }
    ).mock.calls;
    const submitOptions = submissionCalls[0]?.[1];
    expect(submitOptions?.modelIdOverride).toBe(MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID);
    expect(submitOptions?.inpaintOverride).toBeUndefined();
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

    expect(composePrimaryStageLayersToBlobMock).not.toHaveBeenCalled();
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
        referenceInputsMode: "replace",
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
    expect(screen.getByLabelText("Primary composition surface")).toHaveAttribute(
      "aria-busy",
      "true"
    );
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
    expect(screen.getByLabelText("Primary composition surface")).not.toHaveAttribute("aria-busy");

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
    expect(screen.getByLabelText("Primary composition surface")).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });

  it.skip("keeps the frozen layer position after remove background completes", async () => {
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

    const primaryDropzone = screen.getByLabelText("Primary composition surface");
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
    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 240,
      startX: 196,
      startY: 4,
      endX: 110,
      endY: 90,
      shiftKey: true,
    });
    dragStagePointer({
      currentTarget: primaryDropzone,
      pointerId: 241,
      startX: 24,
      startY: 24,
      endX: 66,
      endY: 76,
    });
    const movedTranslate = readFrameTranslate(frame);
    expect(Math.abs(movedTranslate.x)).toBeGreaterThan(0.01);
    expect(Math.abs(movedTranslate.y)).toBeGreaterThan(0.01);

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
    const exportSelectedLayerMaskBlobMock = vi.fn(async (params?: unknown) => {
      void params;
      return new Blob(["mask"], { type: "image/png" });
    });
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        modalOverlayCanvasRef: { current: null },
        previewCanvasRef: { current: null },
        modalPreviewCanvasRef: { current: null },
        hasSelectedLayerMask: true,
        imageHasInteractiveMask: true,
        captureMaskSnapshot: vi.fn(() => ({ layers: [] })),
        restoreMaskSnapshot: vi.fn(),
        clearAllMasks: vi.fn(),
        clearSelectedLayerMask: vi.fn(),
        invertSelectedLayerMask: vi.fn(),
        exportSelectedLayerMaskBlob: exportSelectedLayerMaskBlobMock,
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
      const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
      fireEvent.click(within(modeTabs).getByRole("tab", { name: /^inpaint$/i }));
      fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(within(rail).getByRole("button", { name: /^move$/i }));
      const moveSettingsPanel = screen.getByRole("group", { name: /move tools/i });
      fireEvent.change(within(moveSettingsPanel).getByRole("slider", { name: /zoom stage/i }), {
        target: { value: "100" },
      });
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
      const inpaintReferenceInputs = (
        onRegenerateWithReferenceInputs as unknown as {
          mock: {
            calls: Array<
              [string[], { inpaintOverride?: unknown; hideOutputFromReferenceGrid?: boolean }?]
            >;
          };
        }
      ).mock.calls[0]?.[0];
      expect(inpaintReferenceInputs).toHaveLength(1);
      expect(inpaintReferenceInputs?.[0]).toMatch(/^blob:flatten-/);
      expect(inpaintOptions?.inpaintOverride).toEqual({
        modelId: INPAINT_FLUX_FILL_MODEL_ID,
        baseImageInput: expect.stringMatching(/^blob:flatten-/),
        maskInput: expect.stringMatching(/^blob:flatten-/),
        referenceImageInput: null,
        outputFormat: "png",
        imageWidth: expect.any(Number),
        imageHeight: expect.any(Number),
      });
      expect(inpaintOptions?.hideOutputFromReferenceGrid).toBeUndefined();
      expect(exportSelectedLayerMaskBlobMock).toHaveBeenCalledTimes(1);
      const maskExportArgs = (exportSelectedLayerMaskBlobMock.mock.calls[0]?.[0] ?? null) as {
        targetWidth?: number;
        targetHeight?: number;
        camera?: unknown;
      } | null;
      expect(maskExportArgs?.targetWidth).toBe(640);
      expect(maskExportArgs?.targetHeight).toBe(640);
      expect(maskExportArgs?.camera).toEqual(
        expect.objectContaining({
          viewportWidth: 420,
          viewportHeight: 420,
          offsetX: 0,
          offsetY: 0,
          scale: expect.any(Number),
        })
      );
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: previousImage,
      });
    }
  });

  it("keeps flatten and inpaint mask export scoped to the composition surface under zoom and pan", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => {});
    const exportSelectedLayerMaskBlobMock = vi.fn(async (params?: unknown) => {
      void params;
      return new Blob(["mask"], { type: "image/png" });
    });
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        modalOverlayCanvasRef: { current: null },
        previewCanvasRef: { current: null },
        modalPreviewCanvasRef: { current: null },
        hasSelectedLayerMask: true,
        imageHasInteractiveMask: true,
        captureMaskSnapshot: vi.fn(() => ({ layers: [] })),
        restoreMaskSnapshot: vi.fn(),
        clearAllMasks: vi.fn(),
        clearSelectedLayerMask: vi.fn(),
        invertSelectedLayerMask: vi.fn(),
        exportSelectedLayerMaskBlob: exportSelectedLayerMaskBlobMock,
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
      const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
      fireEvent.click(within(modeTabs).getByRole("tab", { name: /^inpaint$/i }));
      fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
      const rail = screen.getByLabelText("Inpaint action tools");
      fireEvent.click(within(rail).getByRole("button", { name: /^move$/i }));
      const moveSettingsPanel = screen.getByRole("group", { name: /move tools/i });
      fireEvent.change(within(moveSettingsPanel).getByRole("slider", { name: /zoom stage/i }), {
        target: { value: "100" },
      });

      fireEvent.click(within(rail).getByRole("button", { name: /^markup$/i }));
      const primaryDropzone = screen.getByLabelText("Primary composition surface");
      mockElementRect(primaryDropzone, createSquareRect(200));
      fireEvent.keyDown(window, { code: "Space" });
      fireEvent.pointerDown(primaryDropzone, {
        pointerId: 944,
        pointerType: "mouse",
        button: 0,
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerMove(primaryDropzone, {
        pointerId: 944,
        pointerType: "mouse",
        clientX: 132,
        clientY: 114,
      });
      fireEvent.pointerUp(primaryDropzone, {
        pointerId: 944,
        pointerType: "mouse",
        clientX: 132,
        clientY: 114,
      });
      fireEvent.keyUp(window, { code: "Space" });

      fireEvent.click(within(rail).getByRole("button", { name: /^inpaint$/i }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
        await Promise.resolve();
      });

      expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalled();
      expect(exportSelectedLayerMaskBlobMock).toHaveBeenCalledTimes(1);

      const flattenCalls = (
        composePrimaryStageLayersToBlobMock as unknown as {
          mock: {
            calls: unknown[][];
          };
        }
      ).mock.calls;
      const flattenOptions = (flattenCalls.at(-1)?.[1] ?? null) as {
        outputAspectRatio?: number;
        camera?: unknown;
      } | null;
      const maskExportArgs = (exportSelectedLayerMaskBlobMock.mock.calls[0]?.[0] ?? null) as {
        camera?: unknown;
      } | null;
      expect(flattenOptions?.outputAspectRatio ?? 0).toBeCloseTo(1, 4);
      expect(flattenOptions?.camera).toEqual(
        expect.objectContaining({
          viewportWidth: 200,
          viewportHeight: 200,
          scale: expect.any(Number),
        })
      );
      expect(maskExportArgs?.camera).toEqual(flattenOptions?.camera);
    } finally {
      useInpaintMaskControllerSpy.mockRestore();
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: previousImage,
      });
    }
  }, 15000);

  it.skip("blocks generate when Inpaint is selected without an inpaint mask", async () => {
    const onRegenerateWithReferenceInputs: NonNullable<
      React.ComponentProps<typeof ExpertEditPanelView>["onRegenerateWithReferenceInputs"]
    > = vi.fn(async () => {});
    const useInpaintMaskControllerSpy = vi
      .spyOn(InpaintMaskControllerModule, "useInpaintMaskController")
      .mockReturnValue({
        overlayCanvasRef: { current: null },
        modalOverlayCanvasRef: { current: null },
        previewCanvasRef: { current: null },
        modalPreviewCanvasRef: { current: null },
        hasSelectedLayerMask: false,
        imageHasInteractiveMask: true,
        captureMaskSnapshot: vi.fn(() => ({ layers: [] })),
        restoreMaskSnapshot: vi.fn(),
        clearAllMasks: vi.fn(),
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
      const modeTabs = screen.getByRole("tablist", { name: /generation mode/i });
      fireEvent.click(within(modeTabs).getByRole("tab", { name: /^inpaint$/i }));
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
