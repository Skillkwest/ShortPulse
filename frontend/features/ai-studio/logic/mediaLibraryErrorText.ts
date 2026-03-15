/**
 * Normalizes Media Library runtime errors into deterministic user-facing copy.
 * Keeps transient browser/network fetch failures from surfacing raw exception text.
 */
import { normalizeErrorText } from "../../../lib/errorText";

const TRANSIENT_NETWORK_ERROR_PATTERN =
  /\b(failed to fetch|network request failed|networkerror|network error|load failed|fetch failed|econnreset|etimedout|eai_again|timeout)\b/i;

const TRANSIENT_NETWORK_FALLBACK_MESSAGE =
  "Network issue while contacting the Media Library. Please retry.";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return typeof error.message === "string" ? error.message : "";
  }
  return String(error ?? "");
};

/**
 * Returns true when an error matches transient network-fetch failure signatures.
 */
export const isTransientMediaLibraryNetworkError = (error: unknown): boolean => {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    if (error.name === "AbortError") return true;
  }
  const message = toErrorMessage(error);
  if (!message) return false;
  return TRANSIENT_NETWORK_ERROR_PATTERN.test(message);
};

/**
 * Converts unknown Media Library errors to safe, stable UI text.
 */
export const toMediaLibraryErrorText = (error: unknown, fallback: string): string => {
  if (isTransientMediaLibraryNetworkError(error)) {
    return TRANSIENT_NETWORK_FALLBACK_MESSAGE;
  }
  return normalizeErrorText(error instanceof Error ? error.message : error, { fallback });
};
