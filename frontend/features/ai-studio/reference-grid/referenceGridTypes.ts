/**
 * Reference Grid public contracts.
 * Keeps component prop/type declarations out of the main render surface so the file can stay orchestration-focused.
 */
import type { CanvasPropertiesPanelProps } from "../components/canvas/useAiStudioCanvasWorkspaceState";
import type { ExpertEditStyleTile } from "../components/edit/expertEditStyles";
import type { PastedMediaReference } from "./controllers/referenceGridClipboard";
import type { ReferenceGridPanelVisibility } from "./referenceGridConfig";
import type { StudioOutput, ToolId } from "../types";

export type ReferenceGridProps = {
  outputs?: StudioOutput[];
  archivedOutputs?: StudioOutput[];
  activeOutputId: string | null;
  curatedReferenceIds?: string[];
  removedFromAllRefsIds?: string[];
  showHeader?: boolean;
  onOutputMediaLoaded?: (id: string) => void;
  linkedPromptReferenceIds?: string[];
  onSelectOutput: (id: string) => void;
  onOpenDetails: (id: string) => void;
  selectedTool: ToolId | null;
  onDropFiles?: (files: FileList) => void;
  onPasteTextReference?: (text: string) => void;
  onPasteMediaReference?: (reference: PastedMediaReference) => void;
  onTriggerFileSelect?: () => void;
  onOpenMediaLibrary?: () => void;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
  onRetryStatus?: (output: StudioOutput) => void;
  onRerollOutput?: (output: StudioOutput) => void;
  onDeleteOutput?: (id: string) => void;
  onAddCuratedReference?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  onReorderCuratedReference?: (
    id: string,
    targetId: string | null,
    placement: "before" | "after" | "end"
  ) => void;
  onRestoreArchivedOutput?: (id: string) => void;
  onRestoreAllArchivedOutputs?: () => void;
  panelVisibility?: ReferenceGridPanelVisibility;
  railCanvasProps?: CanvasPropertiesPanelProps;
  stylesPanel?: {
    isOpen: boolean;
    selectedStyleId: string | null;
    styles: readonly ExpertEditStyleTile[];
    onSelectStyle?: (styleId: string | null) => void;
  };
};
