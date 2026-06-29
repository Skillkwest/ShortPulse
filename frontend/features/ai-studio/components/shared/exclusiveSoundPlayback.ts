/**
 * Global exclusive-sound playback coordinator for AI Studio media surfaces.
 * Ensures only one audible media source owns playback at a time across inline players, modals, and voice previews.
 */
import React from "react";

export type ExclusiveSoundPlayer = {
  instanceKey: string;
  assetKey?: string | null;
  pause: () => void;
  seekTo?: (timeSeconds: number) => void;
  getCurrentTime?: () => number | null;
  getDuration?: () => number | null;
  getMediaUrl?: () => string | null;
};

export type SharedSoundPlaybackSnapshot = {
  assetKey: string | null;
  instanceKey: string | null;
  isPlaying: boolean;
  currentTimeSeconds: number;
  durationSeconds: number | null;
  progressRatio: number;
  mediaUrl: string | null;
};

let activePlayer: ExclusiveSoundPlayer | null = null;
let pendingPlayer: ExclusiveSoundPlayer | null = null;
let playbackSnapshot: SharedSoundPlaybackSnapshot = {
  assetKey: null,
  instanceKey: null,
  isPlaying: false,
  currentTimeSeconds: 0,
  durationSeconds: null,
  progressRatio: 0,
  mediaUrl: null,
};
const playbackListeners = new Set<() => void>();

const normalizeAssetKey = (player: ExclusiveSoundPlayer): string =>
  player.assetKey?.trim() || player.instanceKey;

const isSameSoundAsset = (
  left: ExclusiveSoundPlayer | null,
  right: ExclusiveSoundPlayer | null
): boolean => {
  if (!left || !right) return false;
  return normalizeAssetKey(left) === normalizeAssetKey(right);
};

const normalizeFiniteTime = (value: number | null | undefined): number | null => {
  if (!Number.isFinite(value) || value == null || value < 0) return null;
  return value;
};

const buildSnapshotForPlayer = (
  player: ExclusiveSoundPlayer,
  overrides: Partial<SharedSoundPlaybackSnapshot> = {}
): SharedSoundPlaybackSnapshot => {
  const currentTimeSeconds =
    normalizeFiniteTime(overrides.currentTimeSeconds) ??
    normalizeFiniteTime(player.getCurrentTime?.()) ??
    playbackSnapshot.currentTimeSeconds;
  const durationSeconds =
    normalizeFiniteTime(overrides.durationSeconds) ??
    normalizeFiniteTime(player.getDuration?.()) ??
    playbackSnapshot.durationSeconds;
  const progressRatio =
    durationSeconds && durationSeconds > 0
      ? Math.min(1, Math.max(0, currentTimeSeconds / durationSeconds))
      : (overrides.progressRatio ?? playbackSnapshot.progressRatio);

  return {
    assetKey: normalizeAssetKey(player),
    instanceKey: player.instanceKey,
    isPlaying: overrides.isPlaying ?? playbackSnapshot.isPlaying,
    currentTimeSeconds,
    durationSeconds,
    progressRatio,
    mediaUrl: overrides.mediaUrl ?? player.getMediaUrl?.() ?? playbackSnapshot.mediaUrl,
  };
};

const publishPlaybackSnapshot = (nextSnapshot: SharedSoundPlaybackSnapshot): void => {
  playbackSnapshot = nextSnapshot;
  playbackListeners.forEach((listener) => listener());
};

const pausePlayer = (player: ExclusiveSoundPlayer | null): void => {
  player?.pause();
};

/**
 * Subscribes to global sound playback state for UI surfaces that mirror a shared audio asset.
 */
export const subscribeSharedSoundPlayback = (listener: () => void): (() => void) => {
  playbackListeners.add(listener);
  return () => {
    playbackListeners.delete(listener);
  };
};

/**
 * Returns the current shared sound playback snapshot.
 */
export const getSharedSoundPlaybackSnapshot = (): SharedSoundPlaybackSnapshot => playbackSnapshot;

/**
 * React hook for reading the shared sound playback snapshot for one asset.
 */
export const useSharedSoundPlaybackSnapshot = (
  assetKey: string | null | undefined
): SharedSoundPlaybackSnapshot | null => {
  const snapshot = React.useSyncExternalStore(
    subscribeSharedSoundPlayback,
    getSharedSoundPlaybackSnapshot,
    getSharedSoundPlaybackSnapshot
  );
  const normalizedAssetKey = assetKey?.trim() || null;
  if (!normalizedAssetKey || snapshot.assetKey !== normalizedAssetKey) return null;
  return snapshot;
};

/**
 * Reserves exclusive playback for a pending player and pauses any different active/pending owner.
 */
export const requestExclusiveSoundPlayback = (player: ExclusiveSoundPlayer): void => {
  if (activePlayer && !isSameSoundAsset(activePlayer, player)) {
    pausePlayer(activePlayer);
  }
  if (
    pendingPlayer &&
    !isSameSoundAsset(pendingPlayer, player) &&
    pendingPlayer.instanceKey !== activePlayer?.instanceKey
  ) {
    pausePlayer(pendingPlayer);
  }
  pendingPlayer = player;
};

/**
 * Marks a player as the active global sound owner, pausing stale late starters when needed.
 */
export const markExclusiveSoundPlaying = (player: ExclusiveSoundPlayer): void => {
  if (pendingPlayer && !isSameSoundAsset(pendingPlayer, player)) {
    pausePlayer(player);
    return;
  }
  const previousActivePlayer = activePlayer;
  pendingPlayer = player;
  activePlayer = player;
  if (previousActivePlayer && previousActivePlayer.instanceKey !== player.instanceKey) {
    pausePlayer(previousActivePlayer);
  }
  publishPlaybackSnapshot(buildSnapshotForPlayer(player, { isPlaying: true }));
};

/**
 * Claims playback after a native play event without letting stale late starters steal focus.
 */
export const claimExclusiveSoundPlayback = (player: ExclusiveSoundPlayer): void => {
  if (pendingPlayer && !isSameSoundAsset(pendingPlayer, player)) {
    player.pause();
    return;
  }
  requestExclusiveSoundPlayback(player);
  markExclusiveSoundPlaying(player);
};

/**
 * Clears the active/pending owner for the given player instance key.
 */
export const clearExclusiveSoundPlayback = (instanceKey: string): void => {
  const clearingActivePlayer = activePlayer?.instanceKey === instanceKey ? activePlayer : null;
  if (activePlayer?.instanceKey === instanceKey) {
    activePlayer = null;
  }
  if (pendingPlayer?.instanceKey === instanceKey) {
    pendingPlayer = null;
  }
  if (clearingActivePlayer) {
    publishPlaybackSnapshot(buildSnapshotForPlayer(clearingActivePlayer, { isPlaying: false }));
  }
};

/**
 * Updates the shared playback playhead for the current audible asset.
 */
export const updateExclusiveSoundPlaybackProgress = (
  player: ExclusiveSoundPlayer,
  state: {
    currentTimeSeconds?: number | null;
    durationSeconds?: number | null;
    mediaUrl?: string | null;
  }
): void => {
  const assetKey = normalizeAssetKey(player);
  if (playbackSnapshot.assetKey && playbackSnapshot.assetKey !== assetKey) return;
  publishPlaybackSnapshot(
    buildSnapshotForPlayer(player, {
      currentTimeSeconds: normalizeFiniteTime(state.currentTimeSeconds) ?? undefined,
      durationSeconds: normalizeFiniteTime(state.durationSeconds) ?? undefined,
      mediaUrl: state.mediaUrl ?? undefined,
    })
  );
};

/**
 * Pauses the active owner for an asset from any mirrored UI surface.
 */
export const pauseActiveSharedSoundPlayback = (assetKey: string | null | undefined): void => {
  const normalizedAssetKey = assetKey?.trim();
  if (!normalizedAssetKey) return;
  if (!activePlayer || normalizeAssetKey(activePlayer) !== normalizedAssetKey) return;
  pausePlayer(activePlayer);
};

/**
 * Seeks the active owner for an asset from any mirrored UI surface.
 */
export const seekActiveSharedSoundPlayback = (
  assetKey: string | null | undefined,
  timeSeconds: number
): void => {
  const normalizedAssetKey = assetKey?.trim();
  if (!normalizedAssetKey || !Number.isFinite(timeSeconds) || timeSeconds < 0) return;
  if (!activePlayer || normalizeAssetKey(activePlayer) !== normalizedAssetKey) return;
  activePlayer.seekTo?.(timeSeconds);
};

/**
 * Hooks a native media element into the global exclusive-sound coordinator.
 */
export const useExclusiveSoundMediaElement = (
  instanceKey: string,
  mediaRef: React.RefObject<HTMLMediaElement | null>,
  assetKey?: string | null
) => {
  const getPlayer = React.useCallback(
    (): ExclusiveSoundPlayer => ({
      instanceKey,
      assetKey: assetKey?.trim() || instanceKey,
      pause: () => {
        mediaRef.current?.pause();
      },
      seekTo: (timeSeconds) => {
        if (!mediaRef.current) return;
        mediaRef.current.currentTime = timeSeconds;
      },
      getCurrentTime: () => mediaRef.current?.currentTime ?? null,
      getDuration: () => mediaRef.current?.duration ?? null,
      getMediaUrl: () =>
        mediaRef.current?.currentSrc || mediaRef.current?.getAttribute("src") || null,
    }),
    [assetKey, instanceKey, mediaRef]
  );

  const clearPlayback = React.useCallback(() => {
    clearExclusiveSoundPlayback(instanceKey);
  }, [instanceKey]);

  const claimAudiblePlayback = React.useCallback(() => {
    const node = mediaRef.current;
    if (!node) return;
    const isAudible = !node.muted && node.volume > 0;
    if (!isAudible) {
      clearPlayback();
      return;
    }
    const player = getPlayer();
    claimExclusiveSoundPlayback(player);
  }, [clearPlayback, getPlayer, mediaRef]);

  const handleVolumeChange = React.useCallback(() => {
    const node = mediaRef.current;
    if (!node || node.paused || node.ended || node.muted || node.volume <= 0) {
      clearPlayback();
      return;
    }
    const player = getPlayer();
    claimExclusiveSoundPlayback(player);
  }, [clearPlayback, getPlayer, mediaRef]);

  React.useEffect(
    () => () => {
      clearPlayback();
    },
    [clearPlayback]
  );

  return React.useMemo(
    () => ({
      requestPlayback: () => {
        requestExclusiveSoundPlayback(getPlayer());
      },
      handlePlay: claimAudiblePlayback,
      handlePause: clearPlayback,
      handleEnded: clearPlayback,
      handleError: clearPlayback,
      handleVolumeChange,
    }),
    [claimAudiblePlayback, clearPlayback, getPlayer, handleVolumeChange]
  );
};

/**
 * Test-only reset helper for the global singleton playback owner.
 */
export const __resetExclusiveSoundPlaybackForTests = (): void => {
  activePlayer = null;
  pendingPlayer = null;
  publishPlaybackSnapshot({
    assetKey: null,
    instanceKey: null,
    isPlaying: false,
    currentTimeSeconds: 0,
    durationSeconds: null,
    progressRatio: 0,
    mediaUrl: null,
  });
};
