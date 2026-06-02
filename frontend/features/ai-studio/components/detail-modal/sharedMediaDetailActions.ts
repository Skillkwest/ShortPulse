/**
 * Shared media detail action builders.
 * Centralizes save/download/delete action-state resolution so all media detail surfaces
 * can present the same customer-facing action contract.
 */
import type { ReactNode } from "react";
import type {
  SharedMediaDetailActionItem,
  SharedMediaDetailSaveActionState,
} from "./detailModalPlatformTypes";

type ResolveSharedMediaDetailMediaActionsOptions = {
  saveState?: SharedMediaDetailSaveActionState;
  isStorageFull?: boolean;
  onSaveToLibrary?: (() => void) | null;
  canDownload?: boolean;
  onDownload?: (() => void) | null;
  canDelete?: boolean;
  onDelete?: (() => void) | null;
  deleteIcon?: ReactNode;
};

/**
 * Resolves canonical media-detail actions for cross-surface media modals.
 * Inputs: the current save-state contract plus optional save/download/delete handlers.
 * Output: ordered shared action items for the modal action bar.
 * Side effects: none.
 */
export const resolveSharedMediaDetailMediaActionItems = ({
  saveState = "hidden",
  isStorageFull = false,
  onSaveToLibrary = null,
  canDownload = false,
  onDownload = null,
  canDelete = false,
  onDelete = null,
  deleteIcon,
}: ResolveSharedMediaDetailMediaActionsOptions): SharedMediaDetailActionItem[] => {
  const items: SharedMediaDetailActionItem[] = [];

  if (saveState !== "hidden") {
    const label = isStorageFull
      ? "Storage Full"
      : saveState === "saving"
        ? "Saving..."
        : saveState === "saved"
          ? "Saved"
          : saveState === "blocked_storage" || saveState === "failed"
            ? "Retry Save"
            : "Save";
    const disabled =
      isStorageFull ||
      saveState === "saving" ||
      saveState === "saved" ||
      typeof onSaveToLibrary !== "function";

    items.push({
      id: "save-media",
      label,
      onClick: onSaveToLibrary ?? (() => {}),
      disabled,
      title: saveState === "saved" ? "Already saved to media library" : "Save to media library",
      intent: "save",
      state: saveState === "saved" ? "saved" : "default",
    });
  }

  if (canDownload && typeof onDownload === "function") {
    items.push({
      id: "download-media",
      label: "Download",
      onClick: onDownload,
      title: "Download",
    });
  }

  if (canDelete && typeof onDelete === "function") {
    items.push({
      id: "delete-media",
      label: "Delete",
      onClick: onDelete,
      intent: "danger",
      icon: deleteIcon,
    });
  }

  return items;
};
