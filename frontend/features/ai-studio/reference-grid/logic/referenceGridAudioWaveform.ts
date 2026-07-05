/**
 * Audio waveform helpers for reference-grid audio cards.
 * Produces compact normalized peak arrays for mirrored peak-envelope rendering.
 */
import { readRememberedObjectUrlBlob } from "../../utils/objectUrlBlobRegistry";

const DEFAULT_AUDIO_WAVEFORM_DURATION_SECONDS = 6;
const DEFAULT_AUDIO_WAVEFORM_BAR_COUNT = 56;
const MIN_FALLBACK_WAVEFORM_PEAK = 12;
const MAX_AUDIO_WAVEFORM_PEAK = 100;
const AUDIO_WAVEFORM_NOISE_FLOOR = 0.008;
const AUDIO_WAVEFORM_CACHE_MAX_ENTRIES = 128;

const audioWaveformCache = new Map<string, number[]>();
const audioWaveformInFlightByUrl = new Map<string, Promise<number[] | null>>();

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const getPercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * percentile))
  );
  return sorted[index] ?? 0;
};

/**
 * Maps arbitrary waveform peak arrays to the card's fixed visual density.
 */
export const resampleWaveformPeaks = (
  peaks: number[],
  targetCount = DEFAULT_AUDIO_WAVEFORM_BAR_COUNT
): number[] => {
  if (!Array.isArray(peaks) || peaks.length === 0) return [];
  if (peaks.length === targetCount) {
    return peaks.map((peak) => Math.round(clamp(peak, 0, MAX_AUDIO_WAVEFORM_PEAK)));
  }

  return Array.from({ length: targetCount }, (_, index) => {
    const start = Math.floor((index * peaks.length) / targetCount);
    const end = Math.max(start + 1, Math.floor(((index + 1) * peaks.length) / targetCount));
    let maxPeak = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      const value = peaks[cursor];
      if (!Number.isFinite(value)) continue;
      maxPeak = Math.max(maxPeak, clamp(Number(value), 0, MAX_AUDIO_WAVEFORM_PEAK));
    }
    return Math.round(clamp(maxPeak, 0, MAX_AUDIO_WAVEFORM_PEAK));
  });
};

/**
 * Normalizes stored waveform peaks into the card render range.
 */
export const normalizeStoredWaveformPeaks = (
  peaks: number[] | null | undefined,
  targetCount = DEFAULT_AUDIO_WAVEFORM_BAR_COUNT
): number[] => {
  if (!Array.isArray(peaks) || peaks.length === 0) return [];
  const finitePeaks = peaks
    .map((peak) => (Number.isFinite(peak) ? Number(peak) : null))
    .filter((peak): peak is number => peak != null);
  const appearsUnitNormalized =
    finitePeaks.length > 0 && finitePeaks.every((peak) => peak >= 0 && peak <= 1);
  const normalized = finitePeaks.map((peak) => {
    const scaledPeak = appearsUnitNormalized ? peak * MAX_AUDIO_WAVEFORM_PEAK : peak;
    return Math.round(clamp(scaledPeak, 0, MAX_AUDIO_WAVEFORM_PEAK));
  });
  return resampleWaveformPeaks(normalized, targetCount);
};

export const sanitizeStoredWaveformPeaks = (
  peaks: unknown,
  targetCount = DEFAULT_AUDIO_WAVEFORM_BAR_COUNT
): number[] | null => {
  if (!Array.isArray(peaks) || peaks.length === 0) return null;
  const numericPeaks = peaks.filter(
    (peak): peak is number => typeof peak === "number" && Number.isFinite(peak)
  );
  if (numericPeaks.length === 0) return null;
  if (numericPeaks.length <= targetCount) return numericPeaks;
  const normalizedPeaks = normalizeStoredWaveformPeaks(numericPeaks, targetCount);
  return normalizedPeaks.length > 0 ? normalizedPeaks : null;
};

/**
 * Builds a neutral mirrored fallback waveform when real peaks are unavailable.
 */
export const buildFallbackWaveformPeaks = (
  durationSeconds: number | null,
  targetCount = DEFAULT_AUDIO_WAVEFORM_BAR_COUNT
): number[] => {
  const normalizedDuration =
    Number.isFinite(durationSeconds) && durationSeconds != null && durationSeconds > 0
      ? durationSeconds
      : DEFAULT_AUDIO_WAVEFORM_DURATION_SECONDS;
  const durationBias = clamp(normalizedDuration / 10, 0.72, 1.08);

  return Array.from({ length: targetCount }, (_, index) => {
    const position = targetCount <= 1 ? 0 : index / (targetCount - 1);
    const fadeIn = clamp(position / 0.09, 0, 1);
    const fadeOut = clamp((1 - position) / 0.1, 0, 1);
    const phraseEnvelope =
      0.54 +
      0.28 * Math.sin(position * Math.PI * 2.2 - 0.5) +
      0.18 * Math.sin(position * Math.PI * 7.1 + 0.85);
    const consonantTexture =
      0.16 * Math.sin(index * 1.77) + 0.1 * Math.sin(index * 3.31 + normalizedDuration);
    const breathBreak =
      (position > 0.28 && position < 0.34) || (position > 0.68 && position < 0.74) ? 0.58 : 1;
    const envelope = clamp(phraseEnvelope + consonantTexture, 0.18, 1) * fadeIn * fadeOut;
    const peak =
      MIN_FALLBACK_WAVEFORM_PEAK +
      (MAX_AUDIO_WAVEFORM_PEAK - MIN_FALLBACK_WAVEFORM_PEAK) *
        envelope *
        durationBias *
        breathBreak;
    return Math.round(clamp(peak, MIN_FALLBACK_WAVEFORM_PEAK, MAX_AUDIO_WAVEFORM_PEAK));
  });
};

const buildDecodedWaveformPeaks = (
  audioBuffer: AudioBuffer,
  targetCount = DEFAULT_AUDIO_WAVEFORM_BAR_COUNT
): number[] => {
  if (audioBuffer.length === 0) {
    return buildFallbackWaveformPeaks(audioBuffer.duration, targetCount);
  }

  const channelCount = Math.max(1, audioBuffer.numberOfChannels);
  const channelData = Array.from({ length: channelCount }, (_, index) =>
    audioBuffer.getChannelData(index)
  );
  const samplesPerBar = Math.max(1, Math.floor(audioBuffer.length / targetCount));
  const rawPeaks = Array.from({ length: targetCount }, (_, index) => {
    const start = index * samplesPerBar;
    const end =
      index === targetCount - 1
        ? audioBuffer.length
        : Math.min(audioBuffer.length, start + samplesPerBar);
    let peak = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        const sample = Math.abs(channelData[channelIndex]?.[cursor] ?? 0);
        if (sample > peak) peak = sample;
      }
    }
    return peak;
  });

  const significantPeaks = rawPeaks.filter((peak) => peak > AUDIO_WAVEFORM_NOISE_FLOOR);
  if (significantPeaks.length === 0) {
    return buildFallbackWaveformPeaks(audioBuffer.duration, targetCount);
  }

  const normalizationPeak = Math.max(
    getPercentile(significantPeaks, 0.96),
    AUDIO_WAVEFORM_NOISE_FLOOR * 1.5
  );
  const peaks = rawPeaks.map((rawPeak) => {
    if (rawPeak <= AUDIO_WAVEFORM_NOISE_FLOOR) return 0;
    const gatedPeak =
      (rawPeak - AUDIO_WAVEFORM_NOISE_FLOOR) /
      Math.max(0.0001, normalizationPeak - AUDIO_WAVEFORM_NOISE_FLOOR);
    const emphasizedPeak = Math.pow(clamp(gatedPeak, 0, 1), 0.78);
    return Math.round(clamp(emphasizedPeak * MAX_AUDIO_WAVEFORM_PEAK, 0, MAX_AUDIO_WAVEFORM_PEAK));
  });

  const hasSignal = peaks.some((peak) => peak > 2);
  return hasSignal ? peaks : buildFallbackWaveformPeaks(audioBuffer.duration, targetCount);
};

const resolveAudioContextConstructor = (): typeof AudioContext | null => {
  if (typeof window === "undefined") return null;
  const audioWindow = window as AudioContextWindow;
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
};

const rememberAudioWaveformPeaks = (audioUrl: string, peaks: number[]) => {
  if (!audioWaveformCache.has(audioUrl)) {
    while (audioWaveformCache.size >= AUDIO_WAVEFORM_CACHE_MAX_ENTRIES) {
      const oldestAudioUrl = audioWaveformCache.keys().next().value;
      if (typeof oldestAudioUrl !== "string") break;
      audioWaveformCache.delete(oldestAudioUrl);
    }
  }
  audioWaveformCache.set(audioUrl, peaks);
};

const resolveAudioBytesFromUrl = async (audioUrl: string): Promise<ArrayBuffer | null> => {
  if (/^blob:/i.test(audioUrl)) {
    const rememberedBlob = readRememberedObjectUrlBlob(audioUrl);
    return rememberedBlob ? await rememberedBlob.arrayBuffer() : null;
  }

  const response = await fetch(audioUrl);
  if (!response.ok) return null;
  return await response.arrayBuffer();
};

const decodeAudioWaveformPeaksFromUrl = async (audioUrl: string): Promise<number[] | null> => {
  const AudioContextConstructor = resolveAudioContextConstructor();
  if (!AudioContextConstructor) return null;

  let audioContext: AudioContext | null = null;
  try {
    const audioBytes = await resolveAudioBytesFromUrl(audioUrl);
    if (!audioBytes) return null;
    audioContext = new AudioContextConstructor();
    const decodedBuffer = await audioContext.decodeAudioData(audioBytes.slice(0));
    const peaks = buildDecodedWaveformPeaks(decodedBuffer);
    rememberAudioWaveformPeaks(audioUrl, peaks);
    return peaks;
  } catch {
    return null;
  } finally {
    if (audioContext) {
      void audioContext.close().catch(() => undefined);
    }
  }
};

/**
 * Fetches and decodes an audio URL into compact waveform peaks.
 */
export const extractAudioWaveformPeaksFromUrl = async (
  audioUrl: string,
  targetCount = DEFAULT_AUDIO_WAVEFORM_BAR_COUNT
): Promise<number[] | null> => {
  if (!audioUrl) return null;
  const cachedPeaks = audioWaveformCache.get(audioUrl);
  if (cachedPeaks) return resampleWaveformPeaks(cachedPeaks, targetCount);

  const existingDecode = audioWaveformInFlightByUrl.get(audioUrl);
  const decodePromise = existingDecode ?? decodeAudioWaveformPeaksFromUrl(audioUrl);
  if (!existingDecode) {
    audioWaveformInFlightByUrl.set(audioUrl, decodePromise);
  }

  try {
    const peaks = await decodePromise;
    return peaks ? resampleWaveformPeaks(peaks, targetCount) : null;
  } finally {
    if (audioWaveformInFlightByUrl.get(audioUrl) === decodePromise) {
      audioWaveformInFlightByUrl.delete(audioUrl);
    }
  }
};
