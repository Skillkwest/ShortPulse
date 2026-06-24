import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ELEVENLABS_DEFAULT_VOICES } from "../../../../lib/model-runtime/elevenLabsDefaultVoices";
import type { StudioOutput } from "../../types";
import { buildWorkflowReloadConfigV1 } from "../../logic/workflowReload";
import { resetSharedVoicesGridStore } from "../useSharedVoicesGrid";
import { useAiStudioAudioRerollController } from "../useAiStudioAudioRerollController";

const findOutputById = vi.fn<(id: string) => StudioOutput | null>(() => null);
const handleVoicesGenerate = vi.fn();
const handleMusicGenerate = vi.fn();
const handleSoundEffectsGenerate = vi.fn();
const setUiNotice = vi.fn();

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "audio-out-1",
  prompt: "Audio prompt",
  mode: "audio",
  aspect: "1:1",
  model: "ElevenLabs",
  status: "ready",
  timestamp: "Now",
  mediaSource: "generated",
  ...overrides,
});

describe("useAiStudioAudioRerollController", () => {
  beforeEach(() => {
    findOutputById.mockReset();
    handleVoicesGenerate.mockReset();
    handleMusicGenerate.mockReset();
    handleSoundEffectsGenerate.mockReset();
    setUiNotice.mockReset();
    resetSharedVoicesGridStore();
  });

  it("rerolls generated music using workflow metadata", () => {
    const workflowReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-23T00:00:00.000Z",
      originTool: "music",
      panelKind: "music",
      outputMode: "audio",
      prompt: { display: "Music prompt" },
      model: { id: "elevenlabs/music" },
      payload: {
        kind: "music",
        text: "Song style\n\nLyrics:\nGolden light",
        prompt: "Song style",
        lyrics: "Golden light",
        durationSeconds: 45,
        bpm: 96,
        mode: "vocal",
        structure: "full-track",
        energyPercent: 72,
        outputFormat: "mp3_44100_128",
        composerMode: "custom",
        instrumentalEnabled: false,
        singerEnabled: true,
        songBatchCount: 2,
      },
    });
    findOutputById.mockReturnValue(createOutput({ workflowReload: workflowReload ?? undefined }));

    const { result } = renderHook(() =>
      useAiStudioAudioRerollController({
        findOutputById,
        handleVoicesGenerate,
        handleMusicGenerate,
        handleSoundEffectsGenerate,
        setUiNotice,
      })
    );

    act(() => {
      expect(result.current.rerollAudioOutputFromWorkflow("audio-out-1")).toBe(true);
    });

    expect(handleMusicGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Song style\n\nLyrics:\nGolden light",
        rawPrompt: "Song style",
        lyrics: "Golden light",
        durationSeconds: 45,
        bpm: 96,
        mode: "vocal",
        structure: "full-track",
        energyPercent: 72,
        composerMode: "custom",
        singerEnabled: true,
        instrumentalEnabled: false,
        songBatchCount: 2,
      })
    );
  });

  it("rerolls generated sound effects using workflow metadata", () => {
    const workflowReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-23T00:00:00.000Z",
      originTool: "sound-effects",
      panelKind: "sound-effects",
      outputMode: "audio",
      prompt: { display: "Impact sound" },
      model: { id: "elevenlabs/sound-effects" },
      payload: {
        kind: "sound-effects",
        text: "Impact sound",
        durationSeconds: 3,
        loop: true,
        outputFormat: "mp3_44100_128",
      },
    });
    findOutputById.mockReturnValue(createOutput({ workflowReload: workflowReload ?? undefined }));

    const { result } = renderHook(() =>
      useAiStudioAudioRerollController({
        findOutputById,
        handleVoicesGenerate,
        handleMusicGenerate,
        handleSoundEffectsGenerate,
        setUiNotice,
      })
    );

    act(() => {
      expect(result.current.rerollAudioOutputFromWorkflow("audio-out-1")).toBe(true);
    });

    expect(handleSoundEffectsGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Impact sound",
        durationSeconds: 3,
        loop: true,
      })
    );
  });

  it("falls back to a default voice when a saved voice was deleted", () => {
    const workflowReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-23T00:00:00.000Z",
      originTool: "text-to-speech",
      panelKind: "voices",
      outputMode: "audio",
      prompt: { display: "Read this" },
      model: { id: "elevenlabs/text-to-speech" },
      payload: {
        kind: "voiceover",
        script: "Read this",
        voiceId: "deleted-saved-voice",
        voiceName: "Deleted Voice",
        outputFormat: "mp3_44100_128",
      },
    });
    findOutputById.mockReturnValue(createOutput({ workflowReload: workflowReload ?? undefined }));

    const { result } = renderHook(() =>
      useAiStudioAudioRerollController({
        findOutputById,
        handleVoicesGenerate,
        handleMusicGenerate,
        handleSoundEffectsGenerate,
        setUiNotice,
      })
    );

    act(() => {
      expect(result.current.rerollAudioOutputFromWorkflow("audio-out-1")).toBe(true);
    });

    expect(handleVoicesGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "voiceover",
        script: "Read this",
        voice: expect.objectContaining({
          id: ELEVENLABS_DEFAULT_VOICES[0]?.fallbackVoiceId,
          isFallback: true,
        }),
      })
    );
  });

  it("rerolls voice changer audio with durable source metadata", () => {
    const workflowReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-23T00:00:00.000Z",
      originTool: "voice-changer",
      panelKind: "voices",
      outputMode: "audio",
      prompt: { display: "source.wav -> Darian" },
      model: { id: "elevenlabs/voice-changer" },
      payload: {
        kind: "voice-changer",
        source: {
          name: "source.wav",
          origin: "reference-grid",
          sourceUrl: "https://cdn.test/source.wav",
          storagePath: "user-1/voice-changer/source.wav",
          referenceOutputId: "source-output-1",
          mimeType: "audio/wav",
        },
        voiceId: ELEVENLABS_DEFAULT_VOICES[0]?.fallbackVoiceId ?? "",
        voiceName: ELEVENLABS_DEFAULT_VOICES[0]?.name ?? "Darian",
        outputFormat: "mp3_44100_128",
        modelId: "elevenlabs/voice-changer",
        inputFormat: "wav",
        removeBackgroundNoise: true,
      },
    });
    findOutputById.mockReturnValue(createOutput({ workflowReload: workflowReload ?? undefined }));

    const { result } = renderHook(() =>
      useAiStudioAudioRerollController({
        findOutputById,
        handleVoicesGenerate,
        handleMusicGenerate,
        handleSoundEffectsGenerate,
        setUiNotice,
      })
    );

    act(() => {
      expect(result.current.rerollAudioOutputFromWorkflow("audio-out-1")).toBe(true);
    });

    expect(handleVoicesGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "voice-changer",
        removeBackgroundNoise: true,
        source: expect.objectContaining({
          origin: "reference-grid",
          sourceUrl: "https://cdn.test/source.wav",
          storagePath: "user-1/voice-changer/source.wav",
          referenceOutputId: "source-output-1",
        }),
      })
    );
  });
});
