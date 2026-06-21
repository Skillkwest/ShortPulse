import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFallbackWaveformPeaks,
  extractAudioWaveformPeaksFromUrl,
  normalizeStoredWaveformPeaks,
  resampleWaveformPeaks,
} from "../referenceGridAudioWaveform";

describe("referenceGridAudioWaveform", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resamples waveform peaks to the target card density", () => {
    const peaks = resampleWaveformPeaks([10, 30, 50, 70], 8);
    expect(peaks).toHaveLength(8);
    expect(peaks[0]).toBeGreaterThanOrEqual(0);
    expect(peaks[7]).toBeLessThanOrEqual(100);
  });

  it("normalizes stored waveform peaks into the render range", () => {
    const peaks = normalizeStoredWaveformPeaks([0, 25, 50, 75, 100], 10);
    expect(peaks).toHaveLength(10);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(100);
    expect(Math.min(...peaks)).toBeGreaterThanOrEqual(0);
  });

  it("scales unit-normalized stored waveform peaks into the render range", () => {
    const peaks = normalizeStoredWaveformPeaks([0.1, 0.45, 0.9, 0.35], 4);
    expect(peaks).toEqual([10, 45, 90, 35]);
  });

  it("builds a fixed-density fallback waveform for audio cards", () => {
    const shortPeaks = buildFallbackWaveformPeaks(2, 20);
    const longPeaks = buildFallbackWaveformPeaks(12, 20);
    expect(shortPeaks).toHaveLength(20);
    expect(longPeaks).toHaveLength(20);
    expect(longPeaks[10]).toBeGreaterThanOrEqual(shortPeaks[10] ?? 0);
  });

  it("keeps fallback peaks within the expected render range", () => {
    const peaks = buildFallbackWaveformPeaks(6, 56);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(100);
    expect(Math.min(...peaks)).toBeGreaterThanOrEqual(12);
  });

  it("dedupes concurrent full-audio waveform decodes for the same URL", async () => {
    const channelData = new Float32Array(256).fill(0).map((_, index) => (index % 8) / 10);
    const audioBuffer = {
      duration: 3,
      length: channelData.length,
      numberOfChannels: 1,
      getChannelData: vi.fn(() => channelData),
    } as unknown as AudioBuffer;
    const decodeAudioData = vi.fn(async () => audioBuffer);
    const close = vi.fn(async () => undefined);

    class MockAudioContext {
      decodeAudioData = decodeAudioData;
      close = close;
    }

    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.stubGlobal("fetch", fetchMock);

    const audioUrl = "https://media.test/waveform-dedupe.mp3";
    const [cardDensityPeaks, compactPeaks] = await Promise.all([
      extractAudioWaveformPeaksFromUrl(audioUrl, 56),
      extractAudioWaveformPeaksFromUrl(audioUrl, 20),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
    expect(cardDensityPeaks).toHaveLength(56);
    expect(compactPeaks).toHaveLength(20);
  });
});
