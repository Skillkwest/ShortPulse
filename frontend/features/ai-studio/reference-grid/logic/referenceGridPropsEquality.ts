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
): boolean => {
  if (!areOptionalOutputListsEqual(previous.outputs, next.outputs)) {
    return false;
  }
  if (!areOptionalOutputListsEqual(previous.archivedOutputs, next.archivedOutputs)) {
    return false;
  }
  if (previous.activeOutputId !== next.activeOutputId) {
    return false;
  }
  if (previous.topNotice !== next.topNotice) {
    return false;
  }
  if (!areStringArraysEqual(previous.curatedReferenceIds, next.curatedReferenceIds)) {
    return false;
  }
  if (!areStringArraysEqual(previous.removedFromAllRefsIds, next.removedFromAllRefsIds)) {
    return false;
  }
  if (previous.showHeader !== next.showHeader) {
    return false;
  }
  if (previous.onOutputMediaLoaded !== next.onOutputMediaLoaded) {
    return false;
  }
  if (!areStringArraysEqual(previous.linkedPromptReferenceIds, next.linkedPromptReferenceIds)) {
    return false;
  }
  if (previous.onSelectOutput !== next.onSelectOutput) {
    return false;
  }
  if (previous.onOpenDetails !== next.onOpenDetails) {
    return false;
  }
  if (previous.selectedTool !== next.selectedTool) {
    return false;
  }
  if (previous.onDropFiles !== next.onDropFiles) {
    return false;
  }
  if (previous.onPasteTextReference !== next.onPasteTextReference) {
    return false;
  }
  if (previous.onPasteMediaReference !== next.onPasteMediaReference) {
    return false;
  }
  if (previous.onTriggerFileSelect !== next.onTriggerFileSelect) {
    return false;
  }
  if (previous.onOpenMediaLibrary !== next.onOpenMediaLibrary) {
    return false;
  }
  if (previous.onSaveToLibrary !== next.onSaveToLibrary) {
    return false;
  }
  if (previous.onDownload !== next.onDownload) {
    return false;
  }
  if (previous.onRetryStatus !== next.onRetryStatus) {
    return false;
  }
  if (previous.onRerollOutput !== next.onRerollOutput) {
    return false;
  }
  if (previous.onDeleteOutput !== next.onDeleteOutput) {
    return false;
  }
  if (previous.onAddCuratedReference !== next.onAddCuratedReference) {
    return false;
  }
  if (previous.onRemoveCuratedReference !== next.onRemoveCuratedReference) {
    return false;
  }
  if (previous.onReorderCuratedReference !== next.onReorderCuratedReference) {
    return false;
  }
  if (
    previous.onAddLibraryMediaReferenceToQuickSlot !== next.onAddLibraryMediaReferenceToQuickSlot
  ) {
    return false;
  }
  if (
    previous.onAddLibraryPromptReferenceToQuickSlot !== next.onAddLibraryPromptReferenceToQuickSlot
  ) {
    return false;
  }
  if (previous.onRestoreArchivedOutput !== next.onRestoreArchivedOutput) {
    return false;
  }
  if (previous.onRestoreAllArchivedOutputs !== next.onRestoreAllArchivedOutputs) {
    return false;
  }
  if (!arePanelVisibilityEqual(previous.panelVisibility, next.panelVisibility)) {
    return false;
  }
  if (previous.railCanvasProps !== next.railCanvasProps) {
    return false;
  }
  if (!areStylesPanelsEqual(previous.stylesPanel, next.stylesPanel)) {
    return false;
  }
  return true;
};
