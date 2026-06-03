/**
 * Shared media detail action builders.
 * Centralizes save/download/delete action-state resolution so all media detail surfaces
 * can present the same customer-facing action contract.
 */
import React, { type ReactNode } from "react";
import { DownloadSimple } from "phosphor-react";
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

  if (canDelete && typeof onDelete === "function") {
    items.push({
      id: "delete-media",
      label: "",
      onClick: onDelete,
      ariaLabel: "Delete",
      title: "Delete",
      intent: "danger",
      icon: deleteIcon,
      className: "is-icon-only",
    });
  }

  if (saveState !== "hidden" && saveState !== "saved") {
    const label = isStorageFull
      ? "Storage Full"
      : saveState === "saving"
        ? "Saving..."
        : saveState === "blocked_storage" || saveState === "failed"
          ? "Retry Save"
          : "Save";
    const disabled =
      isStorageFull || saveState === "saving" || typeof onSaveToLibrary !== "function";

    items.push({
      id: "save-media",
      label,
      onClick: onSaveToLibrary ?? (() => {}),
      ariaLabel: undefined,
      disabled,
      title: "Save to media library",
      intent: "save",
      state: "default",
    });
  }

  if (canDownload && typeof onDownload === "function") {
    items.push({
      id: "download-media",
      label: "",
      onClick: onDownload,
      ariaLabel: "Download",
      title: "Download",
      icon: React.createElement(DownloadSimple, { size: 16, weight: "bold", "aria-hidden": true }),
      className: "is-icon-only",
    });
  }

  return items;
};
