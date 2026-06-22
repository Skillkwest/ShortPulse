/**
 * Voice library preview playback.
 * Owns chip preview audio lifecycle, exclusive playback registration, and preview-only notices.
 */
import React from "react";
import {
  clearExclusiveSoundPlayback,
  markExclusiveSoundPlaying,
  requestExclusiveSoundPlayback,
} from "../components/shared/exclusiveSoundPlayback";

const voicePreviewUnavailableNotice = "This voice does not have a preview sample yet.";
const voicePreviewBrowserUnavailableNotice = "Audio previews are not available in this browser.";
const voicePreviewPlaybackErrorNotice = "Unable to play this voice sample right now.";

export const isTransientVoicePreviewNotice = (value: string | null): boolean =>
  value === voicePreviewUnavailableNotice ||
  value === voicePreviewBrowserUnavailableNotice ||
  value === voicePreviewPlaybackErrorNotice;

const buildVoicePreviewInstanceKey = (voiceId: string): string => `voices:voice-preview:${voiceId}`;

type UseVoicePreviewPlaybackParams = {
  setVoicesLoadError: React.Dispatch<React.SetStateAction<string | null>>;
  setVoicesLoadNotice: React.Dispatch<React.SetStateAction<string | null>>;
};

export const useVoicePreviewPlayback = ({
  setVoicesLoadError,
  setVoicesLoadNotice,
}: UseVoicePreviewPlaybackParams) => {
  const [activePreviewVoiceId, setActivePreviewVoiceId] = React.useState<string | null>(null);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const previewAudioVoiceIdRef = React.useRef<string | null>(null);

  const stopActiveVoicePreview = React.useCallback(() => {
    const activeAudio = previewAudioRef.current;
    const activeInstanceKey = previewAudioVoiceIdRef.current
      ? buildVoicePreviewInstanceKey(previewAudioVoiceIdRef.current)
      : null;
    if (!activeAudio) {
      if (activeInstanceKey) {
        clearExclusiveSoundPlayback(activeInstanceKey);
      }
      setActivePreviewVoiceId(null);
      previewAudioVoiceIdRef.current = null;
      return;
    }
    activeAudio.onplay = null;
    activeAudio.onpause = null;
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio.src = "";
    if (activeInstanceKey) {
      clearExclusiveSoundPlayback(activeInstanceKey);
    }
    previewAudioRef.current = null;
    previewAudioVoiceIdRef.current = null;
    setActivePreviewVoiceId(null);
  }, []);

  const handleVoicePreviewPlay = React.useCallback(
    (voiceId: string, previewUrl: string | null | undefined) => {
      const nextUrl = previewUrl?.trim() ?? "";
      if (!nextUrl) {
        setVoicesLoadError(null);
        setVoicesLoadNotice(voicePreviewUnavailableNotice);
        return;
      }
      if (typeof Audio === "undefined") {
        setVoicesLoadError(null);
        setVoicesLoadNotice(voicePreviewBrowserUnavailableNotice);
        return;
      }
      setVoicesLoadError(null);
      setVoicesLoadNotice(null);
      const activeAudio = previewAudioRef.current;
      const isSameVoice = previewAudioVoiceIdRef.current === voiceId;
      if (activeAudio && isSameVoice) {
        stopActiveVoicePreview();
        return;
      }

      if (activeAudio) {
        stopActiveVoicePreview();
      }

      const nextAudio = new Audio(nextUrl);
      const nextInstanceKey = buildVoicePreviewInstanceKey(voiceId);
      nextAudio.preload = "none";
      nextAudio.onplay = () => {
        if (previewAudioRef.current !== nextAudio) return;
        markExclusiveSoundPlaying({
          instanceKey: nextInstanceKey,
          pause: () => {
            nextAudio.pause();
          },
        });
        setActivePreviewVoiceId(voiceId);
      };
      nextAudio.onpause = () => {
        if (previewAudioRef.current !== nextAudio) return;
        if (nextAudio.ended || nextAudio.currentTime <= 0) {
          stopActiveVoicePreview();
        }
      };
      nextAudio.onended = () => {
        if (previewAudioRef.current !== nextAudio) return;
        stopActiveVoicePreview();
      };
      nextAudio.onerror = () => {
        if (previewAudioRef.current !== nextAudio) return;
        setVoicesLoadError(null);
        setVoicesLoadNotice(voicePreviewPlaybackErrorNotice);
        stopActiveVoicePreview();
      };
      previewAudioRef.current = nextAudio;
      previewAudioVoiceIdRef.current = voiceId;
      requestExclusiveSoundPlayback({
        instanceKey: nextInstanceKey,
        pause: () => {
          nextAudio.pause();
        },
      });
      const playResult = nextAudio.play();
      if (playResult && typeof playResult.catch === "function") {
        void playResult.catch(() => {
          if (previewAudioRef.current === nextAudio) {
            setVoicesLoadError(null);
            setVoicesLoadNotice(voicePreviewPlaybackErrorNotice);
            stopActiveVoicePreview();
          }
        });
      }
    },
    [setVoicesLoadError, setVoicesLoadNotice, stopActiveVoicePreview]
  );

  React.useEffect(() => stopActiveVoicePreview, [stopActiveVoicePreview]);

  return {
    activePreviewVoiceId,
    stopActiveVoicePreview,
    handleVoicePreviewPlay,
  };
};
