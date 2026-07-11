/**
 * Voice Changer source-controller async ownership tests.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VoiceChangerSource } from "../../components/VoiceChangerSourceDropzone";
import { useVoiceChangerSourceController } from "../useVoiceChangerSourceController";

const { stageVideoMock, extractVideoMock, resolveDurationMock } = vi.hoisted(() => ({
  stageVideoMock: vi.fn(),
  extractVideoMock: vi.fn(),
  resolveDurationMock: vi.fn(),
}));

vi.mock("../../components/VoiceChangerSourceDropzone", () => ({
  releaseVoiceChangerSource: vi.fn(),
}));

vi.mock("../../logic/videoPreviewMetadata", () => ({
  loadVideoPreviewMetadata: vi.fn(async () => ({ durationMs: null, posterUrl: null })),
}));

vi.mock("../../utils/voiceChangerSourceAsset", () => ({
  extractVoiceChangerVideoSource: (...args: unknown[]) => extractVideoMock(...args),
  resolveVoiceChangerMediaDurationMs: (...args: unknown[]) => resolveDurationMock(...args),
  resolveVoiceChangerSourceStoragePath: vi.fn(() => null),
  resolveVoiceChangerVideoAspect: vi.fn(async () => "16:9"),
  signVoiceChangerStoragePath: vi.fn(),
  stageVoiceChangerVideoReferenceSource: (...args: unknown[]) => stageVideoMock(...args),
  uploadVoiceChangerSourceFile: vi.fn(),
}));

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const buildVideoSource = (id: string): VoiceChangerSource => ({
  id,
  kind: "video",
  displayKind: "video",
  origin: "reference-grid",
  status: "ready",
  aspect: "16:9",
  durationMs: null,
  name: `${id}.mp4`,
  mimeType: "video/mp4",
  file: null,
  previewUrl: `https://signed.example/${id}.mp4`,
  posterUrl: null,
  sourceUrl: `https://signed.example/${id}.mp4`,
  objectUrl: null,
  storagePath: null,
  referenceOutputId: id,
  referenceMediaId: null,
  errorMessage: null,
  extractedFrom: null,
});

describe("useVoiceChangerSourceController", () => {
  it("does not let video A's delayed duration overwrite video B", async () => {
    const videoADuration = createDeferred<number | null>();
    stageVideoMock.mockImplementation(async ({ sourceName }: { sourceName: string }) => ({
      storagePath: `user-1/voice-changer/source-video/${sourceName}`,
      signedUrl: `https://signed.example/canonical-${sourceName}`,
      mimeType: "video/mp4",
      name: sourceName,
      size: 100,
    }));
    extractVideoMock.mockImplementation(async ({ sourceName }: { sourceName: string }) => ({
      storagePath: `user-1/voice-changer/staged-audio/${sourceName}.wav`,
      signedUrl: `https://signed.example/${sourceName}.wav`,
      mimeType: "audio/wav",
      name: `${sourceName}.wav`,
      size: 50,
    }));
    resolveDurationMock.mockImplementation((url: string) =>
      url.includes("video-a") ? videoADuration.promise : Promise.resolve(2_000)
    );

    const { result } = renderHook(() => useVoiceChangerSourceController());
    act(() => result.current.handleVoiceChangerSourceChange(buildVideoSource("video-a")));
    await waitFor(() => expect(extractVideoMock).toHaveBeenCalledTimes(1));

    act(() => result.current.handleVoiceChangerSourceChange(buildVideoSource("video-b")));
    await waitFor(() => expect(result.current.voiceChangerSource?.id).toBe("video-b"));
    await waitFor(() => expect(result.current.voiceChangerSource?.status).toBe("ready"));

    await act(async () => videoADuration.resolve(9_000));

    expect(result.current.voiceChangerSource).toMatchObject({
      id: "video-b",
      status: "ready",
      durationMs: 2_000,
    });
  });
});
