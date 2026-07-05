export type PersistedMediaDelivery = {
  previewStoragePath: string | null;
  previewPosterStoragePath?: string | null;
  fullStoragePath: string | null;
  previewUrl: string | null;
  previewPosterUrl?: string | null;
  fullUrl: string | null;
};

export type PersistOutputSaveResult = {
  ok: boolean;
  mediaFileIds: string[];
  promptId?: string | null;
  delivery: PersistedMediaDelivery | null;
  error: string | null;
};

export type PersistMediaUrlFailureDetail = {
  message: string;
  index: number;
  stage: "save_media_url_to_library";
  source: "upload" | "ai_studio";
  urlKind: "blob" | "data" | "http" | "https" | "relative" | "unknown";
  urlHost: string | null;
  urlProtocol: string | null;
  fileTypeHint: "image" | "video" | "audio" | null;
};

export type PersistOutputSaveOptions = {
  imageIndex?: number | null;
  intent?: "manual" | "auto";
};
