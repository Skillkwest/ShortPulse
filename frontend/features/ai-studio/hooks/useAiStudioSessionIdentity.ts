/**
 * AI Studio session-identity hook.
 * Ensures `/ai-studio` carries a stable `sid` query value, creating one when absent.
 */
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  AI_STUDIO_SESSION_QUERY_KEY,
  createAiStudioSessionId,
  parseAiStudioSessionId,
} from "../logic/sessionIdentity";

const readQueryStringValue = (value: string | string[] | undefined): string | null => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (Array.isArray(value)) {
    const firstValue = value.find((entry) => entry.trim().length > 0);
    return firstValue?.trim() ?? null;
  }
  return null;
};

const writeSessionIdToCurrentUrl = ({
  pathname,
  query,
  sessionId,
}: {
  pathname: string;
  query: Record<string, string | string[] | undefined>;
  sessionId: string;
}): void => {
  if (typeof window === "undefined") return;

  const currentUrl = new URL(window.location.href);
  const nextSearch = new URLSearchParams(currentUrl.search);
  Object.entries(query).forEach(([key, value]) => {
    if (key === AI_STUDIO_SESSION_QUERY_KEY) return;
    if (nextSearch.has(key)) return;
    const normalizedValue = readQueryStringValue(value);
    if (normalizedValue) {
      nextSearch.set(key, normalizedValue);
    }
  });
  nextSearch.set(AI_STUDIO_SESSION_QUERY_KEY, sessionId);

  const nextPathname = currentUrl.pathname || pathname;
  const nextSearchString = nextSearch.toString();
  const nextUrl = `${nextPathname}${nextSearchString ? `?${nextSearchString}` : ""}${currentUrl.hash}`;
  const currentPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  if (nextUrl === currentPath) return;

  window.history.replaceState(window.history.state, "", nextUrl);
};

/**
 * Maintains a valid AI Studio session id in the URL query and returns the active id.
 */
export const useAiStudioSessionIdentity = (): { sessionId: string | null } => {
  const router = useRouter();
  const [localSessionId] = useState(createAiStudioSessionId);

  const querySessionId = useMemo(
    () => parseAiStudioSessionId(router.query?.[AI_STUDIO_SESSION_QUERY_KEY]),
    [router.query]
  );
  const sessionId = querySessionId ?? (router.isReady ? localSessionId : null);

  useEffect(() => {
    if (!router.isReady) return;

    if (querySessionId) {
      return;
    }

    writeSessionIdToCurrentUrl({
      pathname: router.pathname,
      query: router.query,
      sessionId: localSessionId,
    });
  }, [localSessionId, querySessionId, router.isReady, router.pathname, router.query]);

  return { sessionId };
};
