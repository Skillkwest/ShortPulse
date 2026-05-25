/**
 * In-memory registry that keeps recently created object URLs paired with their source blobs.
 * Lets submission preflight reuse known blobs without re-fetching fragile `blob:` URLs.
 */

const objectUrlBlobRegistry = new Map<string, Blob>();

/**
 * Associates an object URL with the blob it was created from.
 */
export const rememberObjectUrlBlob = (url: string, blob: Blob): void => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("blob:")) return;
  objectUrlBlobRegistry.set(normalizedUrl, blob);
};

/**
 * Returns a remembered blob for a known object URL when available.
 */
export const readRememberedObjectUrlBlob = (url: string): Blob | null => {
  const normalizedUrl = url.trim();
  return objectUrlBlobRegistry.get(normalizedUrl) ?? null;
};

/**
 * Removes a remembered blob once its object URL is no longer valid.
 */
export const forgetObjectUrlBlob = (url: string): void => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return;
  objectUrlBlobRegistry.delete(normalizedUrl);
};
