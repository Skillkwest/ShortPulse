/**
 * Voice Changer remux recovery projection and deterministic restore tests.
 */
import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import {
  expandVoiceChangerRemuxRecoveryOutputList,
  expandVoiceChangerRemuxRecoveryOutputs,
  resolveProjectedVoiceChangerRemuxRecovery,
  VOICE_CHANGER_REMUX_STALE_PENDING_MS,
} from "../generatedMediaAuthority";

const createAudioOutput = (remuxRecovery: StudioOutput["remuxRecovery"]): StudioOutput => ({
  id: "generated:audio-1",
  prompt: "clip.mp4 -> Narrator",
  title: "Converted clip",
  mode: "audio",
  aspect: "16:9",
  model: "Voice Changer",
  modelId: "eleven_multilingual_sts_v2",
  provider: "elevenlabs",
  generationId: "audio-1",
  status: "ready",
  timestamp: "Just now",
  taskState: "success",
  previewUrl: "https://signed.example/audio.mp3",
  previewStoragePath: "user-1/generations/audio/audio-1/audio.mp3",
  fullStoragePath: "user-1/generations/audio/audio-1/audio.mp3",
  mediaSource: "generated",
  remuxRecovery,
});

describe("Voice Changer remux recovery projection", () => {
  it("normalizes only pending or failed projected recovery state", () => {
    expect(
      resolveProjectedVoiceChangerRemuxRecovery({
        sourceAudioGenerationId: "audio-1",
        remuxRequestId: "voice-changer-remux:audio-1",
        status: "failed",
        code: "VOICE_CHANGER_REMUX_ASSEMBLY_FAILED",
        stage: "assembly",
        retryable: true,
      })
    ).toEqual({
      sourceAudioGenerationId: "audio-1",
      remuxRequestId: "voice-changer-remux:audio-1",
      status: "failed",
      code: "VOICE_CHANGER_REMUX_ASSEMBLY_FAILED",
      stage: "assembly",
      retryable: true,
    });
    expect(resolveProjectedVoiceChangerRemuxRecovery({ status: "succeeded" })).toBeUndefined();
  });

  it("turns an interrupted stale pending remux into one retryable failed state", () => {
    const nowMs = Date.parse("2026-07-10T20:00:00.000Z");
    const recovery = resolveProjectedVoiceChangerRemuxRecovery(
      {
        sourceAudioGenerationId: "audio-1",
        remuxRequestId: "voice-changer-remux:audio-1",
        status: "pending",
        retryable: false,
      },
      {
        projectionRecencyMs: nowMs - VOICE_CHANGER_REMUX_STALE_PENDING_MS,
        nowMs,
      }
    );

    expect(recovery).toEqual({
      sourceAudioGenerationId: "audio-1",
      remuxRequestId: "voice-changer-remux:audio-1",
      status: "failed",
      code: "VOICE_CHANGER_REMUX_STALE_PENDING",
      stage: null,
      retryable: true,
    });
    expect(expandVoiceChangerRemuxRecoveryOutputs(createAudioOutput(recovery))[0]).toMatchObject({
      taskState: "fail",
      remuxRecovery: expect.objectContaining({ retryable: true }),
    });
  });

  it("keeps a fresh pending remux non-retryable while the synchronous request can still finish", () => {
    const nowMs = Date.parse("2026-07-10T20:00:00.000Z");
    expect(
      resolveProjectedVoiceChangerRemuxRecovery(
        {
          sourceAudioGenerationId: "audio-1",
          remuxRequestId: "voice-changer-remux:audio-1",
          status: "pending",
          retryable: false,
        },
        {
          projectionRecencyMs: nowMs - VOICE_CHANGER_REMUX_STALE_PENDING_MS + 1,
          nowMs,
        }
      )
    ).toMatchObject({ status: "pending", retryable: false });
  });

  it("reconstructs one deterministic failed video card beside the successful audio", () => {
    const recovery = resolveProjectedVoiceChangerRemuxRecovery({
      sourceAudioGenerationId: "audio-1",
      remuxRequestId: "voice-changer-remux:audio-1",
      status: "failed",
      code: "VOICE_CHANGER_REMUX_PERSISTENCE_FAILED",
      stage: "persistence",
      retryable: true,
    });
    const outputs = expandVoiceChangerRemuxRecoveryOutputs(createAudioOutput(recovery));

    expect(outputs).toHaveLength(2);
    expect(outputs[0]).toMatchObject({
      id: "voice-changer-remux:audio-1",
      mode: "video",
      aspect: "16:9",
      taskState: "fail",
      remuxRecovery: recovery,
    });
    expect(outputs[1]).toMatchObject({
      id: "generated:audio-1",
      mode: "audio",
      taskState: "success",
      remuxRecovery: undefined,
    });
    expect(outputs.filter((output) => output.remuxRecovery?.retryable)).toHaveLength(1);
  });

  it("lets a persisted deterministic sibling suppress stale projected retry state", () => {
    const recovery = resolveProjectedVoiceChangerRemuxRecovery({
      sourceAudioGenerationId: "audio-1",
      remuxRequestId: "voice-changer-remux:audio-1",
      status: "failed",
      retryable: true,
    });
    const audio = createAudioOutput(recovery);
    const video: StudioOutput = {
      ...audio,
      id: "generated:video-1",
      generationId: "video-1",
      mode: "video",
      taskId: "voice-changer-remux:audio-1",
      previewUrl: "https://signed.example/video.mp4",
      remuxRecovery: undefined,
    };

    const outputs = expandVoiceChangerRemuxRecoveryOutputList([video, audio]);

    expect(outputs).toHaveLength(2);
    expect(outputs.map((output) => output.id)).toEqual(["generated:video-1", "generated:audio-1"]);
    expect(outputs[1].remuxRecovery).toBeUndefined();
  });
});
