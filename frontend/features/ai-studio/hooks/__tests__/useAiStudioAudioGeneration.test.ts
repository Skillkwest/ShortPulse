import { act, renderHook } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { hardcodedMusicModelId } from "../../components/MusicPropertiesPanel";
import { hardcodedSoundEffectsModelId } from "../../components/SoundEffectsPropertiesPanel";
import { useAiStudioAudioGeneration } from "../useAiStudioAudioGeneration";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const asDispatch = <T>(fn: (value: SetStateAction<T>) => void): Dispatch<SetStateAction<T>> =>
  fn as Dispatch<SetStateAction<T>>;

const createPlaceholderOutput = (id: string, prompt: string): StudioOutput =>
  ({
    id,
    prompt,
    mode: "audio",
    aspect: "1:1",
    model: "Placeholder",
    status: "ready",
    taskState: "pending",
    timestamp: "Submitting...",
    mediaSource: "generated",
    previewTier: "full",
    saveState: "idle",
    saveError: null,
    errorMessage: null,
    errorMessageShort: null,
    errorDetail: null,
  }) as StudioOutput;

describe("useAiStudioAudioGeneration", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
  });

  it("updates the optimistic placeholder when music generation succeeds", async () => {
    let outputs: StudioOutput[] = [];
    let uiError: string | null = "stale";

    const setUiError = asDispatch<string | null>((value) => {
      uiError = typeof value === "function" ? value(uiError) : value;
    });
    const setOutputs = asDispatch<StudioOutput[]>((value) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const insertOptimisticGenerationPlaceholder = vi.fn(({ prompt }: { prompt: string }) => {
      outputs = [createPlaceholderOutput("out-music", prompt), ...outputs];
      return "out-music";
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const notifyGenerationFailure = vi.fn();

    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        output: {
          provider: "elevenlabs",
          mode: "audio",
          generationId: "gen-music",
          mediaFileId: "media-music",
          requestId: "req-music",
          previewUrl: "https://example.com/music.mp3",
          resultUrls: ["https://example.com/music.mp3"],
          previewStoragePath: "preview/music.mp3",
          fullStoragePath: "full/music.mp3",
          mimeType: "audio/mpeg",
          durationMs: 30_000,
          waveformPeaks: [0.1, 0.5, 0.2],
          modelId: hardcodedMusicModelId,
        },
      }),
    });

    const { result } = renderHook(() =>
      useAiStudioAudioGeneration({
        projectId: "project-1",
        setUiError,
        insertOptimisticGenerationPlaceholder,
        notifyGenerationFailure,
        updateOutputById,
        setOutputs,
      })
    );

    let accepted: boolean | void;
    await act(async () => {
      accepted = await result.current.handleMusicGenerate({
        text: "  cinematic synth pulse  ",
        durationSeconds: 30,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        modelId: hardcodedMusicModelId,
      });
    });

    expect(accepted).toBe(true);

    expect(insertOptimisticGenerationPlaceholder).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionModeOverride: "direct-request",
      })
    );
    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/elevenlabs/music", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "  cinematic synth pulse  ",
        durationSeconds: 30,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        modelId: hardcodedMusicModelId,
        shortpulse_context: {
          mode: "audio",
          selected_tool: "music",
          pricing_display_source: "shared_adapter",
          pricing_policy_ready: true,
          displayed_billed_credits: null,
        },
        project_id: "project-1",
      }),
      shortpulseLogScope: "generation",
    });
    expect(uiError).toBeNull();
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      id: "out-music",
      prompt: "cinematic synth pulse",
      taskState: "success",
      generationId: "gen-music",
      savedMediaIds: ["media-music"],
      previewUrl: "https://example.com/music.mp3",
      fullStoragePath: "full/music.mp3",
    });
  });

  it("surfaces provider failures for sound effects generation", async () => {
    let outputs: StudioOutput[] = [];
    let uiError: string | null = null;

    const setUiError = asDispatch<string | null>((value) => {
      uiError = typeof value === "function" ? value(uiError) : value;
    });
    const setOutputs = asDispatch<StudioOutput[]>((value) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const insertOptimisticGenerationPlaceholder = vi.fn(({ prompt }: { prompt: string }) => {
      outputs = [createPlaceholderOutput("out-sfx", prompt), ...outputs];
      return "out-sfx";
    });
    const updateOutputById = vi.fn();
    const notifyGenerationFailure = vi.fn();

    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Provider unavailable",
        details: "Please retry later.",
      }),
    });

    const { result } = renderHook(() =>
      useAiStudioAudioGeneration({
        projectId: "project-1",
        setUiError,
        insertOptimisticGenerationPlaceholder,
        notifyGenerationFailure,
        updateOutputById,
        setOutputs,
      })
    );

    await act(async () => {
      await result.current.handleSoundEffectsGenerate({
        text: "heavy metal gate slam",
        durationSeconds: null,
        loop: false,
        outputFormat: "mp3_44100_128",
        modelId: hardcodedSoundEffectsModelId,
      });
    });

    expect(insertOptimisticGenerationPlaceholder).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionModeOverride: "direct-request",
      })
    );
    expect(uiError).toBe("Please retry later.");
    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-sfx",
      "Please retry later.",
      "Please retry later."
    );
  });

  it("returns false when music generation is rejected by the provider", async () => {
    let outputs: StudioOutput[] = [];
    let uiError: string | null = null;

    const setUiError = asDispatch<string | null>((value) => {
      uiError = typeof value === "function" ? value(uiError) : value;
    });
    const setOutputs = asDispatch<StudioOutput[]>((value) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const insertOptimisticGenerationPlaceholder = vi.fn(({ prompt }: { prompt: string }) => {
      outputs = [createPlaceholderOutput("out-music-fail", prompt), ...outputs];
      return "out-music-fail";
    });
    const updateOutputById = vi.fn();
    const notifyGenerationFailure = vi.fn();

    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Invalid request",
        details: "text must be 800 characters or fewer.",
      }),
    });

    const { result } = renderHook(() =>
      useAiStudioAudioGeneration({
        projectId: "project-1",
        setUiError,
        insertOptimisticGenerationPlaceholder,
        notifyGenerationFailure,
        updateOutputById,
        setOutputs,
      })
    );

    let accepted: boolean | void;
    await act(async () => {
      accepted = await result.current.handleMusicGenerate({
        text: "too long",
        durationSeconds: null,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        modelId: hardcodedMusicModelId,
      });
    });

    expect(accepted).toBe(false);
    expect(uiError).toBe("text must be 800 characters or fewer.");
    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-music-fail",
      "text must be 800 characters or fewer.",
      "text must be 800 characters or fewer."
    );
  });

  it("prepends a remuxed video output for voice changer generations", async () => {
    let outputs: StudioOutput[] = [];
    let uiError: string | null = null;

    const setUiError = asDispatch<string | null>((value) => {
      uiError = typeof value === "function" ? value(uiError) : value;
    });
    const setOutputs = asDispatch<StudioOutput[]>((value) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const insertOptimisticGenerationPlaceholder = vi.fn(({ prompt }: { prompt: string }) => {
      outputs = [createPlaceholderOutput("out-voice", prompt), ...outputs];
      return "out-voice";
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const notifyGenerationFailure = vi.fn();

    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        output: {
          provider: "elevenlabs",
          mode: "audio",
          generationId: "gen-voice",
          mediaFileId: "media-voice",
          requestId: "req-voice",
          previewUrl: "https://example.com/voice.mp3",
          resultUrls: ["https://example.com/voice.mp3"],
          previewStoragePath: "preview/voice.mp3",
          fullStoragePath: "full/voice.mp3",
          mimeType: "audio/mpeg",
          durationMs: 12_000,
          waveformPeaks: [0.2, 0.4, 0.1],
          modelId: "eleven_multilingual_sts_v2",
          voiceId: "voice-1",
          voiceName: "Narrator",
        },
        remuxedVideo: {
          provider: "elevenlabs",
          mode: "video",
          generationId: "gen-voice-video",
          mediaFileId: "media-voice-video",
          requestId: "req-voice-video",
          previewUrl: "https://example.com/voice.mp4",
          resultUrls: ["https://example.com/voice.mp4"],
          previewStoragePath: "preview/voice.mp4",
          fullStoragePath: "full/voice.mp4",
          mimeType: "video/mp4",
          modelId: "eleven_multilingual_sts_v2",
        },
      }),
    });

    const { result } = renderHook(() =>
      useAiStudioAudioGeneration({
        projectId: "project-1",
        setUiError,
        insertOptimisticGenerationPlaceholder,
        notifyGenerationFailure,
        updateOutputById,
        setOutputs,
      })
    );

    await act(async () => {
      await result.current.handleVoicesGenerate({
        mode: "voice-changer",
        voice: {
          id: "voice-1",
          name: "Narrator",
          provider: "elevenlabs",
        },
        source: {
          id: "src-1",
          kind: "audio",
          origin: "local",
          status: "ready",
          aspect: null,
          durationMs: 12_000,
          name: "take.wav",
          mimeType: "audio/wav",
          file: null,
          previewUrl: null,
          sourceUrl: "https://example.com/take.wav",
          objectUrl: null,
          storagePath: "users/demo/take.wav",
          referenceOutputId: null,
          referenceMediaId: null,
          errorMessage: null,
          extractedFrom: {
            kind: "video",
            name: "clip.mp4",
            mimeType: "video/mp4",
            previewUrl: "https://example.com/clip.mp4",
            sourceUrl: "https://example.com/clip.mp4",
            storagePath: "users/demo/clip.mp4",
            aspect: "16:9",
            referenceOutputId: null,
            referenceMediaId: null,
          },
        },
        outputFormat: "mp3_44100_128",
        removeBackgroundNoise: true,
        modelId: "eleven_multilingual_sts_v2",
        voiceSettings: {
          stability: 1,
          similarity_boost: 1,
          speed: 1,
          use_speaker_boost: true,
        },
        inputFormat: "other",
      });
    });

    expect(insertOptimisticGenerationPlaceholder).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionModeOverride: "direct-request",
      })
    );
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/elevenlabs/speech-to-speech",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
        shortpulseLogScope: "generation",
      })
    );
    const formData = fetchWithAuthMock.mock.calls[0]?.[1]?.body as FormData;
    expect(formData.get("project_id")).toBe("project-1");
    expect(uiError).toBeNull();
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(outputs).toHaveLength(2);
    expect(outputs[0]).toMatchObject({
      id: "generated:gen-voice-video",
      mode: "video",
      prompt: "clip.mp4 -> Narrator video",
      savedMediaIds: ["media-voice-video"],
      previewUrl: "https://example.com/voice.mp4",
      aspect: "16:9",
    });
    expect(outputs[1]).toMatchObject({
      id: "out-voice",
      mode: "audio",
      prompt: "clip.mp4 -> Narrator",
      savedMediaIds: ["media-voice"],
      taskState: "success",
    });
  });
});
