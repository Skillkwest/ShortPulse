import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordVoiceSourceLifecycleState,
  VOICE_CHANGER_SOURCE_RETENTION_DAYS,
} from "../voiceSourceLifecycle";

const upsertMock = vi.fn();

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "voice_source_lifecycle") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        upsert: (...args: unknown[]) => upsertMock(...args),
      };
    },
  }),
}));

describe("voiceSourceLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertMock.mockResolvedValue({ error: null });
  });

  it("records lifecycle proof for staged voice changer source audio", async () => {
    const result = await recordVoiceSourceLifecycleState({
      userId: "user-1",
      storagePath: "user-1/voice-changer/source-audio/source.wav",
      workflowKind: "voice_changer",
      sourceKind: "audio",
      state: "terminal_success",
      sourceRef: "source-ref-1",
      generationId: "00000000-0000-4000-8000-000000000001",
      providerRequestId: "provider-request-1",
      retentionDays: VOICE_CHANGER_SOURCE_RETENTION_DAYS,
      metadata: {
        source_duration_seconds: 12,
      },
    });

    expect(result).toEqual({ recorded: true });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        storage_path: "user-1/voice-changer/source-audio/source.wav",
        source_path_class: "voice_changer_source_audio",
        workflow_kind: "voice_changer",
        source_kind: "audio",
        lifecycle_key: "source-ref-1",
        lifecycle_state: "terminal_success",
        source_ref: "source-ref-1",
        generation_id: "00000000-0000-4000-8000-000000000001",
        provider_request_id: "provider-request-1",
        retention_until: expect.any(String),
        metadata: {
          source_duration_seconds: 12,
        },
      }),
      {
        onConflict: "user_id,storage_path,workflow_kind,lifecycle_key",
      }
    );
  });

  it("records lifecycle proof for video-derived voice changer staged audio", async () => {
    const result = await recordVoiceSourceLifecycleState({
      userId: "user-1",
      storagePath: "user-1/voice-changer/staged-audio/extracted.wav",
      workflowKind: "voice_changer",
      state: "staged",
      lifecycleKey: "staged",
      retentionDays: VOICE_CHANGER_SOURCE_RETENTION_DAYS,
    });

    expect(result).toEqual({ recorded: true });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        storage_path: "user-1/voice-changer/staged-audio/extracted.wav",
        source_path_class: "voice_changer_staged_audio",
        workflow_kind: "voice_changer",
        source_kind: "audio",
        lifecycle_key: "staged",
        lifecycle_state: "staged",
        retention_until: expect.any(String),
      }),
      {
        onConflict: "user_id,storage_path,workflow_kind,lifecycle_key",
      }
    );
  });

  it("leaves non-voice-source storage paths unregistered for manual review", async () => {
    const result = await recordVoiceSourceLifecycleState({
      userId: "user-1",
      storagePath: "user-1/uploads/audio/source.wav",
      workflowKind: "voice_changer",
      sourceKind: "audio",
      state: "terminal_success",
      retentionDays: VOICE_CHANGER_SOURCE_RETENTION_DAYS,
    });

    expect(result).toEqual({ recorded: false });
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
