/**
 * Normalizes Media Library runtime errors into deterministic user-facing copy.
 * Keeps transient browser/network fetch failures from surfacing raw exception text.
 */
import { normalizeErrorText } from "../../../lib/errorText";
import {
  isMediaListRequestErrorCode,
  MEDIA_LIST_AUTH_REQUIRED_CODE,
  MEDIA_LIST_AUTH_SESSION_TIMEOUT_CODE,
  MEDIA_LIST_FORBIDDEN_CODE,
  MEDIA_LIST_SERVER_ERROR_CODE,
} from "../../media-library/logic/mediaListApi";

const TRANSIENT_NETWORK_ERROR_PATTERN =
  /\b(failed to fetch|network request failed|networkerror|network error|load failed|fetch failed|econnreset|etimedout|eai_again|timeout)\b/i;

const TRANSIENT_NETWORK_FALLBACK_MESSAGE =
  "Network issue while contacting the Media Library. Please retry.";
const AUTH_REQUIRED_FALLBACK_MESSAGE = "Sign in again to load the Media Library.";
const AUTH_SESSION_TIMEOUT_FALLBACK_MESSAGE =
  "Media Library session timed out while checking your sign-in. Please refresh and try again.";
const FORBIDDEN_FALLBACK_MESSAGE = "You no longer have access to this Media Library view.";
const SERVER_FALLBACK_MESSAGE = "Media Library server error. Please retry.";
const BAD_REQUEST_FALLBACK_MESSAGE =
  "Media Library request is out of date. Please refresh and try again.";
const NOT_FOUND_FALLBACK_MESSAGE =
  "This Media Library folder or project no longer exists. Please refresh and try again.";
const SERVICE_UNAVAILABLE_FALLBACK_MESSAGE =
  "Media Library authentication is temporarily unavailable. Please retry.";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return typeof error.message === "string" ? error.message : "";
  }
  return String(error ?? "");
};

const toErrorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown }).status;
  if (typeof status !== "number" || !Number.isFinite(status)) return null;
  return Math.trunc(status);
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
  if (isMediaListRequestErrorCode(error, MEDIA_LIST_AUTH_REQUIRED_CODE)) {
    return AUTH_REQUIRED_FALLBACK_MESSAGE;
  }
  if (isMediaListRequestErrorCode(error, MEDIA_LIST_AUTH_SESSION_TIMEOUT_CODE)) {
    return AUTH_SESSION_TIMEOUT_FALLBACK_MESSAGE;
  }
  if (isMediaListRequestErrorCode(error, MEDIA_LIST_FORBIDDEN_CODE)) {
    return FORBIDDEN_FALLBACK_MESSAGE;
  }
  const status = toErrorStatus(error);
  if (status === 400) {
    return BAD_REQUEST_FALLBACK_MESSAGE;
  }
  if (status === 404) {
    return NOT_FOUND_FALLBACK_MESSAGE;
  }
  if (status === 503) {
    return SERVICE_UNAVAILABLE_FALLBACK_MESSAGE;
  }
  if (isMediaListRequestErrorCode(error, MEDIA_LIST_SERVER_ERROR_CODE)) {
    return SERVER_FALLBACK_MESSAGE;
  }
  if (isTransientMediaLibraryNetworkError(error)) {
    return TRANSIENT_NETWORK_FALLBACK_MESSAGE;
  }
  return normalizeErrorText(error instanceof Error ? error.message : error, { fallback });
};
