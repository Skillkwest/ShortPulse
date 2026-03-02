/**
 * AI Studio session-identity hook.
 * Ensures `/ai-studio` carries a stable `sid` query value, creating one when absent.
 */
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef } from "react";
import {
  AI_STUDIO_SESSION_QUERY_KEY,
  createAiStudioSessionId,
  parseAiStudioSessionId,
} from "../logic/sessionIdentity";

/**
 * Maintains a valid AI Studio session id in the URL query and returns the active id.
 */
export const useAiStudioSessionIdentity = (): { sessionId: string | null } => {
  const router = useRouter();
  const replacingSessionIdRef = useRef(false);

  const querySessionId = useMemo(
    () => parseAiStudioSessionId(router.query?.[AI_STUDIO_SESSION_QUERY_KEY]),
    [router.query]
  );

  useEffect(() => {
    if (!router.isReady) return;

    if (querySessionId) {
      replacingSessionIdRef.current = false;
      return;
    }

    if (replacingSessionIdRef.current) return;

    const nextSessionId = createAiStudioSessionId();
    replacingSessionIdRef.current = true;

    void router
      .replace(
        {
          pathname: router.pathname,
          query: {
            ...router.query,
            [AI_STUDIO_SESSION_QUERY_KEY]: nextSessionId,
          },
        },
        undefined,
        { shallow: true, scroll: false }
      )
      .finally(() => {
        replacingSessionIdRef.current = false;
      });
  }, [querySessionId, router]);

  return { sessionId: querySessionId };
};
