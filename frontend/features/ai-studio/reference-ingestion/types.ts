/**
 * Canonical reference ingestion contracts.
 * Defines source-tagged input variants that map all ingestion entry points to one adapter.
 */
import type { StudioMode, StudioOutput } from "../types";

export type ReferenceIngestionSource = "filePicker" | "drop" | "paste" | "mediaLibrary" | "agent";
export type LibraryMediaFileType = "image" | "video" | "audio";

export type ReferenceIngestionInput =
  | {
      kind: "files";
      source: "filePicker" | "drop";
      files: FileList;
    }
  | {
      kind: "prompt";
      source: "paste" | "agent";
      promptText: string;
      title?: string | null;
    }
  | {
      kind: "mediaUrl";
      source: "paste";
      url: string;
      mimeType?: string | null;
    }
  | {
      kind: "libraryMedia";
      source: "mediaLibrary";
      payload: {
        id: string;
        url: string;
        fileType: LibraryMediaFileType;
        createdAt?: string | null;
        originFolderId?: string | null;
        filename?: string | null;
        promptText?: string | null;
        transcriptText?: string | null;
        source?: string | null;
        previewStoragePath?: string | null;
        fullStoragePath?: string | null;
        previewUrl?: string | null;
        previewPosterUrl?: string | null;
        previewPosterStoragePath?: string | null;
        fullUrl?: string | null;
        companionArtUrl?: string | null;
        companionArtStoragePath?: string | null;
        width?: number;
        height?: number;
      };
    }
  | {
      kind: "libraryPrompt";
      source: "mediaLibrary";
      payload: {
        id: string;
        promptText: string;
        createdAt?: string | null;
        originFolderId?: string | null;
        title?: string | null;
      };
    };

export type ReferenceIngestionContext = {
  mode: StudioMode;
  aspect: string;
  model: string | null;
  resolveModelLabel: (value?: string) => string;
  randomId: () => string;
  nowIso?: () => string;
};

export type ReferenceIngestionResult = {
  outputs: StudioOutput[];
  rejectedFileCount?: number;
};
