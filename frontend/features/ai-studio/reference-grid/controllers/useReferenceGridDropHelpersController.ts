/**
 * Drop helper controller for Reference Grid.
 * Encapsulates media normalization and drop-type detection helpers.
 */
import { useCallback } from "react";
import { normalizeMediaFile } from "./referenceGridClipboard";
import type { ReferenceGridDropMode } from "./useReferenceGridDropController";
import { hasInternalReferenceDragTypeHints } from "../../utils/dragDrop";
import { hasMediaLibraryDragTypeHints } from "../../logic/mediaLibraryDragPayload";

type UseReferenceGridDropHelpersControllerResult = {
  normalizeMediaFiles: (files: File[]) => File[];
  resolveCanvasDropMode: (transfer: DataTransfer | null | undefined) => ReferenceGridDropMode;
  canAcceptCanvasDrag: (transfer: DataTransfer | null | undefined) => boolean;
  buildFileList: (files: File[]) => FileList | null;
};

/**
 * Returns stable drop helper callbacks with unchanged normalization and transfer-type semantics.
 */
export const useReferenceGridDropHelpersController =
  (): UseReferenceGridDropHelpersControllerResult => {
    const normalizeMediaFiles = useCallback((files: File[]): File[] => {
      return files
        .map((file, index) => normalizeMediaFile(file, null, index))
        .filter((file): file is File => Boolean(file));
    }, []);

    const resolveCanvasDropMode = useCallback(
      (transfer: DataTransfer | null | undefined): ReferenceGridDropMode => {
        if (!transfer) return "none";
        if (hasInternalReferenceDragTypeHints(transfer)) return "none";
        const normalizedTypes = Array.from(transfer.types || []).map((type) => type.toLowerCase());
        if (hasMediaLibraryDragTypeHints(transfer)) return "files";
        if (transfer.files && transfer.files.length > 0) return "files";
        if (normalizedTypes.includes("files")) return "files";
        if (
          normalizedTypes.includes("text/reference-url") ||
          normalizedTypes.includes("text/uri-list") ||
          normalizedTypes.includes("text/html") ||
          normalizedTypes.includes("image/url") ||
          normalizedTypes.includes("application/x-moz-file")
        ) {
          return "files";
        }
        if (
          normalizedTypes.some(
            (type) =>
              type.includes("text") ||
              type.includes("plain") ||
              type.includes("prompt") ||
              type.includes("utf8")
          )
        ) {
          return "text";
        }
        return "none";
      },
      []
    );

    const canAcceptCanvasDrag = useCallback(
      (transfer: DataTransfer | null | undefined) => {
        return resolveCanvasDropMode(transfer) !== "none";
      },
      [resolveCanvasDropMode]
    );

    const buildFileList = useCallback((files: File[]): FileList | null => {
      if (files.length === 0) return null;
      if (typeof DataTransfer !== "undefined") {
        const transfer = new DataTransfer();
        files.forEach((file) => transfer.items.add(file));
        return transfer.files;
      }
      const fallback = files.reduce<Record<number, File>>((acc, file, index) => {
        acc[index] = file;
        return acc;
      }, {});
      return {
        ...fallback,
        length: files.length,
        item: (index: number) => files[index] ?? null,
      } as unknown as FileList;
    }, []);

    return {
      normalizeMediaFiles,
      resolveCanvasDropMode,
      canAcceptCanvasDrag,
      buildFileList,
    };
  };
