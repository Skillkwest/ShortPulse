/**
 * ElevenLabs audio duration contracts shared by AI Studio audio panels and server routes.
 * Keeps provider-backed range validation and user-facing preset labels aligned in one place.
 */

export type ElevenLabsDurationOption = {
  value: number | null;
  label: string;
  title: string;
};

export const ELEVENLABS_MUSIC_DURATION_MIN_SECONDS = 3;
export const ELEVENLABS_MUSIC_DURATION_MAX_SECONDS = 600;
export const ELEVENLABS_SOUND_EFFECT_DURATION_MIN_SECONDS = 0.5;
export const ELEVENLABS_SOUND_EFFECT_DURATION_MAX_SECONDS = 30;

// The API accepts any value inside the min/max window; the UI exposes curated presets for dropdown use.

const formatDurationLabel = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 1) return `${seconds}s`;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
};

const formatDurationTitle = (seconds: number): string => {
  if (seconds < 1) return `${seconds} second duration`;
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? "" : "s"} duration`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} duration`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"} ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"} duration`;
};

const buildDurationOption = (seconds: number): ElevenLabsDurationOption => ({
  value: seconds,
  label: formatDurationLabel(seconds),
  title: formatDurationTitle(seconds),
});

export const ELEVENLABS_MUSIC_DURATION_OPTIONS: readonly ElevenLabsDurationOption[] = [
  {
    value: null,
    label: "Auto",
    title: "Let the music model choose the track length.",
  },
  ...[15, 30, 45, 60, 90, 120, 180, 240, 300, 600].map(buildDurationOption),
];

export const ELEVENLABS_SOUND_EFFECT_DURATION_OPTIONS: readonly ElevenLabsDurationOption[] = [
  {
    value: null,
    label: "Auto",
    title: "Let the sound-effects model choose the clip length.",
  },
  ...[0.5, 1, 2, 3, 5, 10, 15, 20, 30].map(buildDurationOption),
];
