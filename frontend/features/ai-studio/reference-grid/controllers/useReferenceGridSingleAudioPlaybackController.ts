/**
 * Reference Grid single-audio playback coordinator.
 * Ensures only one inline audio player is active inside the Reference Grid at a time.
 */
import React from "react";
import {
  clearExclusiveSoundPlayback,
  markExclusiveSoundPlaying,
  requestExclusiveSoundPlayback,
  type ExclusiveSoundPlayer,
} from "../../components/shared/exclusiveSoundPlayback";
type RegisteredAudioPlayer = ExclusiveSoundPlayer;

export type ReferenceGridSingleAudioPlaybackController = {
  requestPlay: (player: RegisteredAudioPlayer) => void;
  markPlaying: (player: RegisteredAudioPlayer) => void;
  clearActivePlayer: (instanceKey: string) => void;
};

/**
 * Tracks the active inline audio player for the Reference Grid surface only.
 */
export const useReferenceGridSingleAudioPlaybackController =
  (): ReferenceGridSingleAudioPlaybackController => {
    return React.useMemo(
      () => ({
        requestPlay: requestExclusiveSoundPlayback,
        markPlaying: markExclusiveSoundPlaying,
        clearActivePlayer: clearExclusiveSoundPlayback,
      }),
      []
    );
  };
