import { describe, expect, it } from "vitest";
import {
  buildFallbackWaveformPeaks,
  normalizeStoredWaveformPeaks,
  resampleWaveformPeaks,
} from "../referenceGridAudioWaveform";

describe("referenceGridAudioWaveform", () => {
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
});
