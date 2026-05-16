/**
 * Shared fetch-transition rules for Media Library modal/panel pagination.
 * Encodes when a fetch should reset rows, preserve rows, and block visible loading UI.
 */

export type MediaFetchReason = "initial" | "tab_or_query_reset" | "stale_refresh" | "load_more";

type ResolveFetchTransitionArgs = {
  reason?: MediaFetchReason;
  explicitReset: boolean;
  queryChanged: boolean;
  cacheLoaded: boolean;
  hasRows: boolean;
};

export type MediaFetchTransition = {
  shouldReset: boolean;
  preserveRowsDuringFetch: boolean;
  shouldShowBlockingLoading: boolean;
};

const reasonImpliesReset = (reason?: MediaFetchReason): boolean =>
  reason === "initial" || reason === "tab_or_query_reset" || reason === "stale_refresh";

/**
 * Resolves fetch transition behavior for a media-tab request.
 * Inputs: request reason plus current cache/query state.
 * Output: reset/preserve/loading decisions used by modal and panel controllers.
 * Side effects: none.
 */
export const resolveMediaFetchTransition = ({
  reason,
  explicitReset,
  queryChanged,
  cacheLoaded,
  hasRows,
}: ResolveFetchTransitionArgs): MediaFetchTransition => {
  const shouldReset = explicitReset || queryChanged || reasonImpliesReset(reason);
  const preserveRowsDuringFetch =
    reason === "stale_refresh" && cacheLoaded && hasRows && !queryChanged;
  const shouldShowBlockingLoading = !preserveRowsDuringFetch && (shouldReset || !cacheLoaded);
  return {
    shouldReset,
    preserveRowsDuringFetch,
    shouldShowBlockingLoading,
  };
};
