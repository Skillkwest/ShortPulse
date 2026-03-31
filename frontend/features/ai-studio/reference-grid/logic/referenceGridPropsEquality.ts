import type { ReferenceGridProps } from "../referenceGridTypes";
import { areOutputListsEqual } from "../referenceGridConfig";
import { incrementFreezeInvestigationCounter } from "../../logic/freezeInvestigationTelemetry";

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

const recordReferenceGridPropMismatch = (reason: string) => {
  incrementFreezeInvestigationCounter(`referenceGrid.propsMismatch.${reason}`);
};

export const areReferenceGridPropsEqual = (
  previous: Readonly<ReferenceGridPropsLike>,
  next: Readonly<ReferenceGridPropsLike>
): boolean => {
  if (!areOptionalOutputListsEqual(previous.outputs, next.outputs)) {
    recordReferenceGridPropMismatch("outputs");
    return false;
  }
  if (!areOptionalOutputListsEqual(previous.archivedOutputs, next.archivedOutputs)) {
    recordReferenceGridPropMismatch("archivedOutputs");
    return false;
  }
  if (previous.activeOutputId !== next.activeOutputId) {
    recordReferenceGridPropMismatch("activeOutputId");
    return false;
  }
  if (previous.topNotice !== next.topNotice) {
    recordReferenceGridPropMismatch("topNotice");
    return false;
  }
  if (!areStringArraysEqual(previous.curatedReferenceIds, next.curatedReferenceIds)) {
    recordReferenceGridPropMismatch("curatedReferenceIds");
    return false;
  }
  if (!areStringArraysEqual(previous.removedFromAllRefsIds, next.removedFromAllRefsIds)) {
    recordReferenceGridPropMismatch("removedFromAllRefsIds");
    return false;
  }
  if (previous.showHeader !== next.showHeader) {
    recordReferenceGridPropMismatch("showHeader");
    return false;
  }
  if (previous.onOutputMediaLoaded !== next.onOutputMediaLoaded) {
    recordReferenceGridPropMismatch("onOutputMediaLoaded");
    return false;
  }
  if (!areStringArraysEqual(previous.linkedPromptReferenceIds, next.linkedPromptReferenceIds)) {
    recordReferenceGridPropMismatch("linkedPromptReferenceIds");
    return false;
  }
  if (previous.onSelectOutput !== next.onSelectOutput) {
    recordReferenceGridPropMismatch("onSelectOutput");
    return false;
  }
  if (previous.onOpenDetails !== next.onOpenDetails) {
    recordReferenceGridPropMismatch("onOpenDetails");
    return false;
  }
  if (previous.selectedTool !== next.selectedTool) {
    recordReferenceGridPropMismatch("selectedTool");
    return false;
  }
  if (previous.onDropFiles !== next.onDropFiles) {
    recordReferenceGridPropMismatch("onDropFiles");
    return false;
  }
  if (previous.onPasteTextReference !== next.onPasteTextReference) {
    recordReferenceGridPropMismatch("onPasteTextReference");
    return false;
  }
  if (previous.onPasteMediaReference !== next.onPasteMediaReference) {
    recordReferenceGridPropMismatch("onPasteMediaReference");
    return false;
  }
  if (previous.onTriggerFileSelect !== next.onTriggerFileSelect) {
    recordReferenceGridPropMismatch("onTriggerFileSelect");
    return false;
  }
  if (previous.onOpenMediaLibrary !== next.onOpenMediaLibrary) {
    recordReferenceGridPropMismatch("onOpenMediaLibrary");
    return false;
  }
  if (previous.onSaveToLibrary !== next.onSaveToLibrary) {
    recordReferenceGridPropMismatch("onSaveToLibrary");
    return false;
  }
  if (previous.onDownload !== next.onDownload) {
    recordReferenceGridPropMismatch("onDownload");
    return false;
  }
  if (previous.onRetryStatus !== next.onRetryStatus) {
    recordReferenceGridPropMismatch("onRetryStatus");
    return false;
  }
  if (previous.onRerollOutput !== next.onRerollOutput) {
    recordReferenceGridPropMismatch("onRerollOutput");
    return false;
  }
  if (previous.onDeleteOutput !== next.onDeleteOutput) {
    recordReferenceGridPropMismatch("onDeleteOutput");
    return false;
  }
  if (previous.onAddCuratedReference !== next.onAddCuratedReference) {
    recordReferenceGridPropMismatch("onAddCuratedReference");
    return false;
  }
  if (previous.onRemoveCuratedReference !== next.onRemoveCuratedReference) {
    recordReferenceGridPropMismatch("onRemoveCuratedReference");
    return false;
  }
  if (previous.onReorderCuratedReference !== next.onReorderCuratedReference) {
    recordReferenceGridPropMismatch("onReorderCuratedReference");
    return false;
  }
  if (
    previous.onAddLibraryMediaReferenceToQuickSlot !== next.onAddLibraryMediaReferenceToQuickSlot
  ) {
    recordReferenceGridPropMismatch("onAddLibraryMediaReferenceToQuickSlot");
    return false;
  }
  if (
    previous.onAddLibraryPromptReferenceToQuickSlot !== next.onAddLibraryPromptReferenceToQuickSlot
  ) {
    recordReferenceGridPropMismatch("onAddLibraryPromptReferenceToQuickSlot");
    return false;
  }
  if (previous.onRestoreArchivedOutput !== next.onRestoreArchivedOutput) {
    recordReferenceGridPropMismatch("onRestoreArchivedOutput");
    return false;
  }
  if (previous.onRestoreAllArchivedOutputs !== next.onRestoreAllArchivedOutputs) {
    recordReferenceGridPropMismatch("onRestoreAllArchivedOutputs");
    return false;
  }
  if (!arePanelVisibilityEqual(previous.panelVisibility, next.panelVisibility)) {
    recordReferenceGridPropMismatch("panelVisibility");
    return false;
  }
  if (previous.railCanvasProps !== next.railCanvasProps) {
    recordReferenceGridPropMismatch("railCanvasProps");
    return false;
  }
  if (!areStylesPanelsEqual(previous.stylesPanel, next.stylesPanel)) {
    recordReferenceGridPropMismatch("stylesPanel");
    return false;
  }
  return true;
};
