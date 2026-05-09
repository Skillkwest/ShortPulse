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

export type PersistOutputSaveOptions = {
  imageIndex?: number | null;
};
