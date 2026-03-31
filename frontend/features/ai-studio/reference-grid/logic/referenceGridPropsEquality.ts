import type { ReferenceGridProps } from "../referenceGridTypes";
import { areOutputListsEqual } from "../referenceGridConfig";

type ReferenceGridPropsLike = Omit<ReferenceGridProps, "selectedTool"> & {
  selectedTool?: ReferenceGridProps["selectedTool"];
};

const areOptionalOutputListsEqual = (
  left?: ReferenceGridProps["outputs"],
  right?: ReferenceGridProps["outputs"]
): boolean => {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  return areOutputListsEqual(left, right);
};

const areStringArraysEqual = (left?: readonly string[], right?: readonly string[]): boolean => {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const arePanelVisibilityEqual = (
  left?: ReferenceGridProps["panelVisibility"],
  right?: ReferenceGridProps["panelVisibility"]
): boolean =>
  left?.canvas === right?.canvas &&
  left?.quickSlot === right?.quickSlot &&
  left?.referenceGrid === right?.referenceGrid &&
  left?.styles === right?.styles;

const areStylesPanelsEqual = (
  left?: ReferenceGridProps["stylesPanel"],
  right?: ReferenceGridProps["stylesPanel"]
): boolean =>
  left?.isOpen === right?.isOpen &&
  left?.selectedStyleId === right?.selectedStyleId &&
  left?.styles === right?.styles &&
  left?.onSelectStyle === right?.onSelectStyle;

export const areReferenceGridPropsEqual = (
  previous: Readonly<ReferenceGridPropsLike>,
  next: Readonly<ReferenceGridPropsLike>
): boolean =>
  areOptionalOutputListsEqual(previous.outputs, next.outputs) &&
  areOptionalOutputListsEqual(previous.archivedOutputs, next.archivedOutputs) &&
  previous.activeOutputId === next.activeOutputId &&
  previous.topNotice === next.topNotice &&
  areStringArraysEqual(previous.curatedReferenceIds, next.curatedReferenceIds) &&
  areStringArraysEqual(previous.removedFromAllRefsIds, next.removedFromAllRefsIds) &&
  previous.showHeader === next.showHeader &&
  previous.onOutputMediaLoaded === next.onOutputMediaLoaded &&
  areStringArraysEqual(previous.linkedPromptReferenceIds, next.linkedPromptReferenceIds) &&
  previous.onSelectOutput === next.onSelectOutput &&
  previous.onOpenDetails === next.onOpenDetails &&
  previous.selectedTool === next.selectedTool &&
  previous.onDropFiles === next.onDropFiles &&
  previous.onPasteTextReference === next.onPasteTextReference &&
  previous.onPasteMediaReference === next.onPasteMediaReference &&
  previous.onTriggerFileSelect === next.onTriggerFileSelect &&
  previous.onOpenMediaLibrary === next.onOpenMediaLibrary &&
  previous.onSaveToLibrary === next.onSaveToLibrary &&
  previous.onDownload === next.onDownload &&
  previous.onRetryStatus === next.onRetryStatus &&
  previous.onRerollOutput === next.onRerollOutput &&
  previous.onDeleteOutput === next.onDeleteOutput &&
  previous.onAddCuratedReference === next.onAddCuratedReference &&
  previous.onRemoveCuratedReference === next.onRemoveCuratedReference &&
  previous.onReorderCuratedReference === next.onReorderCuratedReference &&
  previous.onAddLibraryMediaReferenceToQuickSlot === next.onAddLibraryMediaReferenceToQuickSlot &&
  previous.onAddLibraryPromptReferenceToQuickSlot === next.onAddLibraryPromptReferenceToQuickSlot &&
  previous.onRestoreArchivedOutput === next.onRestoreArchivedOutput &&
  previous.onRestoreAllArchivedOutputs === next.onRestoreAllArchivedOutputs &&
  arePanelVisibilityEqual(previous.panelVisibility, next.panelVisibility) &&
  previous.railCanvasProps === next.railCanvasProps &&
  areStylesPanelsEqual(previous.stylesPanel, next.stylesPanel);
