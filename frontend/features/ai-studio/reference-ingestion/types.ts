/**
 * Canonical reference ingestion contracts.
 * Defines source-tagged input variants that map all ingestion entry points to one adapter.
 */
import type { StudioMode, StudioOutput } from "../types";

export type ReferenceIngestionSource = "filePicker" | "drop" | "paste" | "mediaLibrary" | "agent";

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
        fileType: "image" | "video";
        originFolderId?: string | null;
        filename?: string | null;
        promptText?: string | null;
        source?: string | null;
        previewStoragePath?: string | null;
        fullStoragePath?: string | null;
        previewUrl?: string | null;
        fullUrl?: string | null;
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
};

export type ReferenceIngestionResult = {
  outputs: StudioOutput[];
};
