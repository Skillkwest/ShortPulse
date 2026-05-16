import { describe, expect, it, vi } from "vitest";
import type { ReferenceGridProps } from "../../referenceGridTypes";
import type { StudioOutput } from "../../../types";
import { areReferenceGridPropsEqual } from "../referenceGridPropsEquality";

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "text",
  aspect: "9:16",
  model: "Seedream 4.5",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  previewText: `Prompt card ${id}`,
  mediaSource: "prompt",
  ...overrides,
});

const createProps = (overrides: Partial<ReferenceGridProps> = {}): ReferenceGridProps => ({
  activeOutputId: "output-1",
  topNotice: "notice",
  curatedReferenceIds: ["output-1"],
  removedFromAllRefsIds: ["removed-1"],
  showHeader: true,
  linkedPromptReferenceIds: ["output-2"],
  onOutputMediaLoaded: vi.fn(),
  onSelectOutput: vi.fn(),
  onOpenDetails: vi.fn(),
  selectedTool: "create",
  onDropFiles: vi.fn(),
  onPasteTextReference: vi.fn(),
  onPasteMediaReference: vi.fn(),
  onTriggerFileSelect: vi.fn(),
  onOpenMediaLibrary: vi.fn(),
  onSaveToLibrary: vi.fn(),
  onDownload: vi.fn(),
  onRetryStatus: vi.fn(),
  onRerollOutput: vi.fn(),
  onDeleteOutput: vi.fn(),
  onAddCuratedReference: vi.fn(),
  onRemoveCuratedReference: vi.fn(),
  onReorderCuratedReference: vi.fn(),
  onAddLibraryMediaReferenceToQuickSlot: vi.fn(),
  onAddLibraryPromptReferenceToQuickSlot: vi.fn(),
  onRestoreArchivedOutput: vi.fn(),
  onRestoreAllArchivedOutputs: vi.fn(),
  panelVisibility: {
    quickSlot: true,
    referenceGrid: true,
    styles: false,
  },
  stylesPanel: {
    isOpen: false,
    selectedStyleId: null,
    styles: [],
    onSelectStyle: vi.fn(),
  },
  outputs: [makeOutput("output-1")],
  archivedOutputs: [makeOutput("archived-1")],
  ...overrides,
});

describe("areReferenceGridPropsEqual", () => {
  it("treats semantically identical prop objects as equal", () => {
    const base = createProps();
    const next = {
      ...base,
      curatedReferenceIds: [...(base.curatedReferenceIds ?? [])],
      removedFromAllRefsIds: [...(base.removedFromAllRefsIds ?? [])],
      linkedPromptReferenceIds: [...(base.linkedPromptReferenceIds ?? [])],
      panelVisibility: base.panelVisibility ? { ...base.panelVisibility } : base.panelVisibility,
      stylesPanel: base.stylesPanel ? { ...base.stylesPanel } : base.stylesPanel,
    };

    expect(areReferenceGridPropsEqual(base, next)).toBe(true);
  });

  it("detects real prop changes that should rerender the grid", () => {
    const base = createProps();
    const next = createProps({
      activeOutputId: "output-2",
      panelVisibility: {
        quickSlot: false,
        referenceGrid: true,
        styles: false,
      },
    });

    expect(areReferenceGridPropsEqual(base, next)).toBe(false);
  });

  it("detects media storage full state changes", () => {
    const base = createProps({
      isMediaStorageFull: false,
    });
    const next = createProps({
      isMediaStorageFull: true,
    });

    expect(areReferenceGridPropsEqual(base, next)).toBe(false);
  });
});
