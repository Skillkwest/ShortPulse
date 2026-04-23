/**
 * Audio waveform helpers for reference-grid audio cards.
 * Produces compact normalized peak arrays for mirrored peak-envelope rendering.
 */

const DEFAULT_AUDIO_WAVEFORM_DURATION_SECONDS = 6;
const DEFAULT_AUDIO_WAVEFORM_BAR_COUNT = 56;
const MIN_FALLBACK_WAVEFORM_PEAK = 12;
const MAX_AUDIO_WAVEFORM_PEAK = 100;
const AUDIO_WAVEFORM_NOISE_FLOOR = 0.008;

const audioWaveformCache = new Map<string, number[]>();

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
  const normalized = peaks
    .map((peak) => (Number.isFinite(peak) ? Number(peak) : null))
    .filter((peak): peak is number => peak != null)
    .map((peak) => Math.round(clamp(peak, 0, MAX_AUDIO_WAVEFORM_PEAK)));
  return resampleWaveformPeaks(normalized, targetCount);
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
  const midpoint = (targetCount - 1) / 2;
  const durationBias = clamp(normalizedDuration / 18, 0.35, 1.1);

  return Array.from({ length: targetCount }, (_, index) => {
    const distanceFromCenter = Math.abs(index - midpoint);
    const centerFalloff = midpoint === 0 ? 1 : 1 - distanceFromCenter / midpoint;
    const eased = Math.pow(Math.max(centerFalloff, 0), 0.82);
    const peak =
      MIN_FALLBACK_WAVEFORM_PEAK +
      (MAX_AUDIO_WAVEFORM_PEAK - MIN_FALLBACK_WAVEFORM_PEAK) * eased * durationBias;
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

  const AudioContextConstructor = resolveAudioContextConstructor();
  if (!AudioContextConstructor) return null;

  let audioContext: AudioContext | null = null;
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) return null;
    const audioBytes = await response.arrayBuffer();
    audioContext = new AudioContextConstructor();
    const decodedBuffer = await audioContext.decodeAudioData(audioBytes.slice(0));
    const peaks = buildDecodedWaveformPeaks(decodedBuffer, targetCount);
    audioWaveformCache.set(audioUrl, peaks);
    return peaks;
  } catch {
    return null;
  } finally {
    if (audioContext) {
      void audioContext.close().catch(() => undefined);
    }
  }
};
