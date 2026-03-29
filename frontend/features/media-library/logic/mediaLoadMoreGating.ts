type CommonLoadMoreGateArgs = {
  hasMore: boolean;
  inFlight?: boolean;
  loading: boolean;
};

type ObserverLoadMoreGateArgs = CommonLoadMoreGateArgs & {
  awaitExit: boolean;
  cooldownMs: number;
  fetchEnabled: boolean;
  lastAutoLoadAtMs: number;
  loaded: boolean;
  now: number;
  scrollIntentArmed: boolean;
};

type PanelNearBottomLoadMoreGateArgs = CommonLoadMoreGateArgs & {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  surfaceBlocked: boolean;
  thresholdPx: number;
};

export const canRequestLoadMore = ({
  hasMore,
  inFlight = false,
  loading,
}: CommonLoadMoreGateArgs): boolean => hasMore && !loading && !inFlight;

export const shouldEnableObserverLoadMore = ({
  fetchEnabled,
  hasMore,
  loaded,
  loading,
}: Pick<ObserverLoadMoreGateArgs, "fetchEnabled" | "hasMore" | "loaded" | "loading">): boolean =>
  fetchEnabled && loaded && canRequestLoadMore({ hasMore, loading });

export const shouldAutoLoadFromObserver = ({
  awaitExit,
  cooldownMs,
  fetchEnabled,
  hasMore,
  inFlight = false,
  lastAutoLoadAtMs,
  loaded,
  loading,
  now,
  scrollIntentArmed,
}: ObserverLoadMoreGateArgs): boolean => {
  if (
    !shouldEnableObserverLoadMore({
      fetchEnabled,
      hasMore,
      loaded,
      loading,
    })
  ) {
    return false;
  }
  if (awaitExit || !scrollIntentArmed || inFlight) return false;
  return now - lastAutoLoadAtMs >= cooldownMs;
};

export const shouldAutoLoadNearBottom = ({
  clientHeight,
  hasMore,
  inFlight = false,
  loading,
  scrollHeight,
  scrollTop,
  surfaceBlocked,
  thresholdPx,
}: PanelNearBottomLoadMoreGateArgs): boolean => {
  if (surfaceBlocked || !canRequestLoadMore({ hasMore, inFlight, loading })) {
    return false;
  }
  if (clientHeight <= 0 || scrollHeight <= 0) return false;
  const remaining = scrollHeight - (scrollTop + clientHeight);
  if (!Number.isFinite(remaining)) return false;
  return remaining <= thresholdPx;
};
