/**
 * In-memory registry that keeps recently created object URLs paired with their source blobs.
 * Lets submission preflight reuse known blobs without re-fetching fragile `blob:` URLs.
 */

export const REMEMBERED_OBJECT_URL_BLOB_ENTRY_LIMIT = 128;
export const REMEMBERED_OBJECT_URL_BLOB_BYTE_LIMIT = 192 * 1024 * 1024;

type ObjectUrlBlobRegistryEntry = {
  blob: Blob;
  size: number;
};

const objectUrlBlobRegistry = new Map<string, ObjectUrlBlobRegistryEntry>();
let rememberedObjectUrlBlobBytes = 0;

const deleteRememberedObjectUrlBlob = (url: string): void => {
  const existing = objectUrlBlobRegistry.get(url);
  if (!existing) return;
  rememberedObjectUrlBlobBytes = Math.max(0, rememberedObjectUrlBlobBytes - existing.size);
  objectUrlBlobRegistry.delete(url);
};

const pruneRememberedObjectUrlBlobs = (): void => {
  while (
    objectUrlBlobRegistry.size > REMEMBERED_OBJECT_URL_BLOB_ENTRY_LIMIT ||
    rememberedObjectUrlBlobBytes > REMEMBERED_OBJECT_URL_BLOB_BYTE_LIMIT
  ) {
    const oldestUrl = objectUrlBlobRegistry.keys().next().value;
    if (!oldestUrl) return;
    deleteRememberedObjectUrlBlob(oldestUrl);
  }
};

/**
 * Associates an object URL with the blob it was created from.
 */
export const rememberObjectUrlBlob = (url: string, blob: Blob): void => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("blob:")) return;
  deleteRememberedObjectUrlBlob(normalizedUrl);
  const size = Number.isFinite(blob.size) ? Math.max(0, blob.size) : 0;
  objectUrlBlobRegistry.set(normalizedUrl, {
    blob,
    size,
  });
  rememberedObjectUrlBlobBytes += size;
  pruneRememberedObjectUrlBlobs();
};

/**
 * Returns a remembered blob for a known object URL when available.
 */
export const readRememberedObjectUrlBlob = (url: string): Blob | null => {
  const normalizedUrl = url.trim();
  const entry = objectUrlBlobRegistry.get(normalizedUrl);
  if (!entry) return null;
  objectUrlBlobRegistry.delete(normalizedUrl);
  objectUrlBlobRegistry.set(normalizedUrl, entry);
  return entry.blob;
};

/**
 * Removes a remembered blob once its object URL is no longer valid.
 */
export const forgetObjectUrlBlob = (url: string): void => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return;
  deleteRememberedObjectUrlBlob(normalizedUrl);
};

/**
 * Revokes an object URL and clears any remembered blob retained for that URL.
 */
export const revokeRememberedObjectUrl = (url: string): void => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return;
  forgetObjectUrlBlob(normalizedUrl);
  if (
    normalizedUrl.startsWith("blob:") &&
    typeof URL !== "undefined" &&
    typeof URL.revokeObjectURL === "function"
  ) {
    URL.revokeObjectURL(normalizedUrl);
  }
};
