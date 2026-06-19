import { act, renderHook, waitFor } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { hardcodedMusicModelId } from "../../components/MusicPropertiesPanel";
import { hardcodedSoundEffectsModelId } from "../../components/SoundEffectsPropertiesPanel";
import { hardcodedVoiceoverModelId } from "../../utils/voiceAudioModelConfig";
import { REFERENCE_GRID_MAX_VISIBLE_ITEMS } from "../../reference-grid/logic/referenceGridLimits";
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
          lyricsText: "Keep the signal burning bright",
          title: "Signal Burning Bright",
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

    let accepted: boolean | void = false;
    await act(async () => {
      accepted = await result.current.handleMusicGenerate({
        text: "  cinematic synth pulse  ",
        durationSeconds: 30,
        bpm: 112,
        mode: "instrumental",
        instrumentalEnabled: true,
        lyrics: "Keep the signal burning bright",
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
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/elevenlabs/music",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        shortpulseLogScope: "generation",
        shortpulseSkipErrorLogging: true,
      })
    );
    const [, fetchOptions] = fetchWithAuthMock.mock.calls[0] ?? [];
    const requestBody = JSON.parse(String((fetchOptions as { body?: unknown }).body ?? "{}"));
    expect(requestBody).toMatchObject({
      text: "  cinematic synth pulse  ",
      lyrics: "Keep the signal burning bright",
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
        pricing_display_source: "pricing_grid",
        pricing_policy_ready: true,
        displayed_billed_credits: null,
      },
      workflow_reload: expect.objectContaining({
        version: 1,
        source: "ai_studio_generation",
        originTool: "music",
        panelKind: "music",
        outputMode: "audio",
        restoreBehavior: "navigate_and_hydrate",
        projectId: "project-1",
        prompt: {
          display: "  cinematic synth pulse  ",
          submission: "  cinematic synth pulse  ",
        },
        model: {
          id: hardcodedMusicModelId,
        },
        payload: expect.objectContaining({
          kind: "music",
          text: "  cinematic synth pulse  ",
          lyrics: "Keep the signal burning bright",
          durationSeconds: 30,
          outputFormat: "mp3_44100_128",
          instrumentalEnabled: true,
        }),
      }),
      project_id: "project-1",
    });
    expect(uiError).toBeNull();
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      id: "out-music",
      prompt: "cinematic synth pulse",
      taskState: "success",
      generationId: "gen-music",
      workflowReload: expect.objectContaining({
        originTool: "music",
        panelKind: "music",
      }),
      savedMediaIds: ["media-music"],
      previewUrl: "https://example.com/music.mp3",
      fullStoragePath: "full/music.mp3",
      lyricsText: "Keep the signal burning bright",
      title: "Signal Burning Bright",
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
      "Please retry later.",
      {
        errorPayload: {
          error: "Provider unavailable",
          details: "Please retry later.",
        },
      }
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
        details: "text must be 2000 characters or fewer.",
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

    let accepted: boolean | void = false;
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
    expect(uiError).toBe("text must be 2000 characters or fewer.");
    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-music-fail",
      "text must be 2000 characters or fewer.",
      "text must be 2000 characters or fewer.",
      {
        errorPayload: {
          error: "Invalid request",
          details: "text must be 2000 characters or fewer.",
        },
      }
    );
  });

  it("preserves structured retry guidance for admission-limited music responses", async () => {
    let outputs: StudioOutput[] = [];
    let uiError: string | null = null;

    const setUiError = asDispatch<string | null>((value) => {
      uiError = typeof value === "function" ? value(uiError) : value;
    });
    const setOutputs = asDispatch<StudioOutput[]>((value) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const insertOptimisticGenerationPlaceholder = vi.fn(({ prompt }: { prompt: string }) => {
      outputs = [createPlaceholderOutput("out-music-limit", prompt), ...outputs];
      return "out-music-limit";
    });
    const updateOutputById = vi.fn();
    const notifyGenerationFailure = vi.fn();

    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      status: 429,
      headers: {
        get: vi.fn((name: string) => (name === "Retry-After" ? "13" : null)),
      },
      json: async () => ({
        error: "Too many active generations. Please retry shortly.",
        code: "GENERATION_ADMISSION_LIMIT",
        admissionScope: "shared_provider",
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

    let accepted: boolean | void = true;
    await act(async () => {
      accepted = await result.current.handleMusicGenerate({
        text: "busy shared lane",
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
    expect(uiError).toBe(
      "Shared generation capacity is busy right now. Please retry in 13 seconds."
    );
    expect(notifyGenerationFailure).toHaveBeenCalledWith(
      "out-music-limit",
      "Shared generation capacity is busy right now. Please retry in 13 seconds.",
      "Shared generation capacity is busy right now. Please retry in 13 seconds.",
      {
        errorPayload: {
          error: "Too many active generations. Please retry shortly.",
          code: "GENERATION_ADMISSION_LIMIT",
          admissionScope: "shared_provider",
        },
      }
    );
  });

  it("updates voiceover placeholders with generated titles", async () => {
    let outputs: StudioOutput[] = [];
    let uiError: string | null = null;

    const setUiError = asDispatch<string | null>((value) => {
      uiError = typeof value === "function" ? value(uiError) : value;
    });
    const setOutputs = asDispatch<StudioOutput[]>((value) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const insertOptimisticGenerationPlaceholder = vi.fn(({ prompt }: { prompt: string }) => {
      outputs = [createPlaceholderOutput("out-voiceover", prompt), ...outputs];
      return "out-voiceover";
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
          generationId: "gen-voiceover",
          mediaFileId: "media-voiceover",
          requestId: "req-voiceover",
          previewUrl: "https://example.com/voiceover.mp3",
          resultUrls: ["https://example.com/voiceover.mp3"],
          previewStoragePath: "preview/voiceover.mp3",
          fullStoragePath: "full/voiceover.mp3",
          mimeType: "audio/mpeg",
          durationMs: null,
          waveformPeaks: null,
          title: "Launch Walkthrough A1B2",
          modelId: hardcodedVoiceoverModelId,
          voiceId: "voice-1",
          voiceName: "Narrator",
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
        mode: "voiceover",
        voice: {
          id: "voice-1",
          name: "Narrator",
          librarySection: "my",
          provider: "elevenlabs",
        },
        script: "Welcome to the launch walkthrough for creators.",
        outputFormat: "mp3_44100_128",
        config: {
          model_id: hardcodedVoiceoverModelId,
          language_code: null,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1,
            style: 0,
          },
        },
      });
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/elevenlabs/text-to-speech",
      expect.objectContaining({
        method: "POST",
        shortpulseLogScope: "generation",
      })
    );
    expect(uiError).toBeNull();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      id: "out-voiceover",
      mode: "audio",
      title: "Launch Walkthrough A1B2",
      savedMediaIds: ["media-voiceover"],
      taskState: "success",
    });
  });

  it("keeps generated audio playable when autosave is blocked by storage limits", async () => {
    let outputs: StudioOutput[] = [];
    let uiError: string | null = null;

    const setUiError = asDispatch<string | null>((value) => {
      uiError = typeof value === "function" ? value(uiError) : value;
    });
    const setOutputs = asDispatch<StudioOutput[]>((value) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const insertOptimisticGenerationPlaceholder = vi.fn(({ prompt }: { prompt: string }) => {
      outputs = [createPlaceholderOutput("out-voiceover-storage", prompt), ...outputs];
      return "out-voiceover-storage";
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
          generationId: "gen-voiceover-storage",
          mediaFileId: null,
          requestId: "req-voiceover-storage",
          previewUrl: "https://example.com/voiceover-storage.mp3",
          resultUrls: ["https://example.com/voiceover-storage.mp3"],
          previewStoragePath: "preview/voiceover-storage.mp3",
          fullStoragePath: "full/voiceover-storage.mp3",
          mimeType: "audio/mpeg",
          durationMs: null,
          waveformPeaks: null,
          title: "Storage Limit Voiceover A1B2",
          modelId: hardcodedVoiceoverModelId,
          voiceId: "voice-1",
          voiceName: "Narrator",
          saveState: "blocked_storage",
          saveError: "Storage is full. Delete media or upgrade storage to save this output.",
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
        mode: "voiceover",
        voice: {
          id: "voice-1",
          name: "Narrator",
          librarySection: "my",
          provider: "elevenlabs",
        },
        script: "This audio should stay playable even when autosave is blocked.",
        outputFormat: "mp3_44100_128",
        config: {
          model_id: hardcodedVoiceoverModelId,
          language_code: null,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1,
            style: 0,
          },
        },
      });
    });

    expect(uiError).toBeNull();
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      id: "out-voiceover-storage",
      mode: "audio",
      title: "Storage Limit Voiceover A1B2",
      savedMediaIds: [],
      taskState: "success",
      previewUrl: "https://example.com/voiceover-storage.mp3",
      saveState: "blocked_storage",
      saveError: "Storage is full. Delete media or upgrade storage to save this output.",
    });
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
          title: "City Take A1B2",
          modelId: "eleven_multilingual_sts_v2",
          voiceId: "voice-1",
          voiceName: "Narrator",
          transcriptText: "I can hear the city waking up below us.",
          saveState: "blocked_storage",
          saveError: "Storage is full. Delete media or upgrade storage to save this output.",
        },
        remuxedVideo: {
          provider: "elevenlabs",
          mode: "video",
          generationId: "gen-voice-video",
          mediaFileId: "media-voice-video",
          requestId: "req-voice-video",
          previewUrl: "https://example.com/voice.mp4",
          previewPosterUrl: "https://example.com/voice-poster.jpg",
          resultUrls: ["https://example.com/voice.mp4"],
          previewPosterStoragePath: "preview/posters/voice.jpg",
          previewStoragePath: "preview/voice.mp4",
          fullStoragePath: "full/voice.mp4",
          mimeType: "video/mp4",
          modelId: "eleven_multilingual_sts_v2",
          transcriptText: "I can hear the city waking up below us.",
          saveState: "blocked_storage",
          saveError: "Storage is full. Delete media or upgrade storage to save this video.",
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
          librarySection: "my",
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
      transcriptText: "I can hear the city waking up below us.",
      savedMediaIds: ["media-voice-video"],
      previewUrl: "https://example.com/voice.mp4",
      previewPosterUrl: "https://example.com/voice-poster.jpg",
      previewPosterStoragePath: "preview/posters/voice.jpg",
      aspect: "16:9",
      saveState: "blocked_storage",
      saveError: "Storage is full. Delete media or upgrade storage to save this video.",
    });
    expect(outputs[1]).toMatchObject({
      id: "out-voice",
      mode: "audio",
      prompt: "clip.mp4 -> Narrator",
      transcriptText: "I can hear the city waking up below us.",
      savedMediaIds: ["media-voice"],
      taskState: "success",
      title: "City Take A1B2",
      saveState: "blocked_storage",
      saveError: "Storage is full. Delete media or upgrade storage to save this output.",
    });
  });

  it("blocks voice changer remux submissions unless two visible grid slots are available", async () => {
    let uiError: string | null = null;
    const existingOutputs = Array.from(
      { length: REFERENCE_GRID_MAX_VISIBLE_ITEMS - 1 },
      (_, index) => createPlaceholderOutput(`existing-${index + 1}`, `Existing ${index + 1}`)
    );
    const setUiError = asDispatch<string | null>((value) => {
      uiError = typeof value === "function" ? value(uiError) : value;
    });
    const insertOptimisticGenerationPlaceholder = vi.fn(() => "out-voice");

    const { result } = renderHook(() =>
      useAiStudioAudioGeneration({
        projectId: "project-1",
        outputs: existingOutputs,
        setUiError,
        insertOptimisticGenerationPlaceholder,
        notifyGenerationFailure: vi.fn(),
        updateOutputById: vi.fn(),
        setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
      })
    );

    await act(async () => {
      await result.current.handleVoicesGenerate({
        mode: "voice-changer",
        voice: {
          id: "voice-1",
          name: "Narrator",
          librarySection: "my",
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

    expect(insertOptimisticGenerationPlaceholder).not.toHaveBeenCalled();
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(uiError).toContain(`${REFERENCE_GRID_MAX_VISIBLE_ITEMS} items`);
  });

  it("keeps music busy state active until parallel generations settle", async () => {
    let outputs: StudioOutput[] = [];
    let uiError: string | null = null;
    let optimisticIndex = 0;
    let firstPending: Promise<boolean | void> | null = null;
    let secondPending: Promise<boolean | void> | null = null;
    const responseResolvers: Array<
      (value: {
        ok: boolean;
        json: () => Promise<{
          output: {
            provider: "elevenlabs";
            mode: "audio";
            generationId: string;
            mediaFileId: string | null;
            requestId: string;
            previewUrl: string;
            resultUrls: string[];
            previewStoragePath: string;
            fullStoragePath: string;
            companionArtUrl?: string | null;
            companionArtStoragePath?: string | null;
            companionArtStatus?: "pending" | "processing" | "ready" | "failed" | null;
            mimeType: string;
            durationMs: number | null;
            waveformPeaks: number[] | null;
            modelId: string;
          };
        }>;
      }) => void
    > = [];

    const setUiError = asDispatch<string | null>((value) => {
      uiError = typeof value === "function" ? value(uiError) : value;
    });
    const setOutputs = asDispatch<StudioOutput[]>((value) => {
      outputs = typeof value === "function" ? value(outputs) : value;
    });
    const insertOptimisticGenerationPlaceholder = vi.fn(({ prompt }: { prompt: string }) => {
      optimisticIndex += 1;
      const outputId = `out-music-${optimisticIndex}`;
      outputs = [createPlaceholderOutput(outputId, prompt), ...outputs];
      return outputId;
    });
    const updateOutputById = vi.fn((id: string, updater: (item: StudioOutput) => StudioOutput) => {
      outputs = outputs.map((item) => (item.id === id ? updater(item) : item));
    });
    const notifyGenerationFailure = vi.fn();

    fetchWithAuthMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          responseResolvers.push(resolve);
        })
    );

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
      firstPending = result.current.handleMusicGenerate({
        text: "parallel synth cue",
        durationSeconds: null,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        modelId: hardcodedMusicModelId,
      });
      secondPending = result.current.handleMusicGenerate({
        text: "parallel synth cue",
        durationSeconds: null,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        modelId: hardcodedMusicModelId,
      });
      await Promise.resolve();
    });

    expect(result.current.musicIsGenerating).toBe(true);

    await act(async () => {
      responseResolvers[0]?.({
        ok: true,
        json: async () => ({
          output: {
            provider: "elevenlabs",
            mode: "audio",
            generationId: "gen-music-1",
            mediaFileId: "media-music-1",
            requestId: "req-music-1",
            previewUrl: "https://example.com/music-1.mp3",
            resultUrls: ["https://example.com/music-1.mp3"],
            previewStoragePath: "preview/music-1.mp3",
            fullStoragePath: "full/music-1.mp3",
            mimeType: "audio/mpeg",
            durationMs: 30_000,
            waveformPeaks: [0.1, 0.5, 0.2],
            modelId: hardcodedMusicModelId,
          },
        }),
      });
      await firstPending;
    });

    expect(result.current.musicIsGenerating).toBe(true);

    await act(async () => {
      responseResolvers[1]?.({
        ok: true,
        json: async () => ({
          output: {
            provider: "elevenlabs",
            mode: "audio",
            generationId: "gen-music-2",
            mediaFileId: "media-music-2",
            requestId: "req-music-2",
            previewUrl: "https://example.com/music-2.mp3",
            resultUrls: ["https://example.com/music-2.mp3"],
            previewStoragePath: "preview/music-2.mp3",
            fullStoragePath: "full/music-2.mp3",
            mimeType: "audio/mpeg",
            durationMs: 30_000,
            waveformPeaks: [0.2, 0.4, 0.3],
            modelId: hardcodedMusicModelId,
          },
        }),
      });
      await secondPending;
    });

    await waitFor(() => {
      expect(result.current.musicIsGenerating).toBe(false);
    });
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
  });
});
