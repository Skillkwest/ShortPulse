/**
 * Global exclusive-sound playback coordinator for AI Studio media surfaces.
 * Ensures only one audible media source owns playback at a time across inline players, modals, and voice previews.
 */
import React from "react";

export type ExclusiveSoundPlayer = {
  instanceKey: string;
  pause: () => void;
};

let activePlayer: ExclusiveSoundPlayer | null = null;
let pendingPlayer: ExclusiveSoundPlayer | null = null;

/**
 * Reserves exclusive playback for a pending player and pauses any different active/pending owner.
 */
export const requestExclusiveSoundPlayback = (player: ExclusiveSoundPlayer): void => {
  if (activePlayer && activePlayer.instanceKey !== player.instanceKey) {
    activePlayer.pause();
  }
  if (
    pendingPlayer &&
    pendingPlayer.instanceKey !== player.instanceKey &&
    pendingPlayer.instanceKey !== activePlayer?.instanceKey
  ) {
    pendingPlayer.pause();
  }
  pendingPlayer = player;
};

/**
 * Marks a player as the active global sound owner, pausing stale late starters when needed.
 */
export const markExclusiveSoundPlaying = (player: ExclusiveSoundPlayer): void => {
  if (pendingPlayer && pendingPlayer.instanceKey !== player.instanceKey) {
    player.pause();
    return;
  }
  pendingPlayer = player;
  activePlayer = player;
};

/**
 * Clears the active/pending owner for the given player instance key.
 */
export const clearExclusiveSoundPlayback = (instanceKey: string): void => {
  if (activePlayer?.instanceKey === instanceKey) {
    activePlayer = null;
  }
  if (pendingPlayer?.instanceKey === instanceKey) {
    pendingPlayer = null;
  }
};

/**
 * Hooks a native media element into the global exclusive-sound coordinator.
 */
export const useExclusiveSoundMediaElement = (
  instanceKey: string,
  mediaRef: React.RefObject<HTMLMediaElement | null>
) => {
  const getPlayer = React.useCallback(
    (): ExclusiveSoundPlayer => ({
      instanceKey,
      pause: () => {
        mediaRef.current?.pause();
      },
    }),
    [instanceKey, mediaRef]
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
    requestExclusiveSoundPlayback(player);
    markExclusiveSoundPlaying(player);
  }, [clearPlayback, getPlayer, mediaRef]);

  const handleVolumeChange = React.useCallback(() => {
    const node = mediaRef.current;
    if (!node || node.paused || node.ended || node.muted || node.volume <= 0) {
      clearPlayback();
      return;
    }
    const player = getPlayer();
    requestExclusiveSoundPlayback(player);
    markExclusiveSoundPlaying(player);
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
};
