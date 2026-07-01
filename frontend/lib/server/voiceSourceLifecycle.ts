/**
 * Records server-side lifecycle proof for staged Voice Changer and Voice Clone source media.
 * These rows are operator cleanup evidence only; customer quota and runtime access stay elsewhere.
 */
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { getSupabaseAdmin } from "./api/supabaseAdmin";

export type VoiceSourceWorkflowKind = "voice_changer" | "voice_clone";
export type VoiceSourceKind = "audio" | "video";
export type VoiceSourceLifecycleState =
  | "staged"
  | "submitted"
  | "terminal_success"
  | "terminal_failure"
  | "retained_for_custom_voice";

type VoiceSourcePathClass =
  | "voice_changer_source_audio"
  | "voice_changer_source_video"
  | "voice_clone_source_audio";

type RecordVoiceSourceLifecycleInput = {
  userId: string;
  storagePath: string | null | undefined;
  workflowKind: VoiceSourceWorkflowKind;
  sourceKind?: VoiceSourceKind | null;
  state: VoiceSourceLifecycleState;
  lifecycleKey?: string | null;
  sourceRef?: string | null;
  generationId?: string | null;
  providerRequestId?: string | null;
  providerVoiceId?: string | null;
  retentionDays?: number | null;
  metadata?: Record<string, unknown> | null;
};

type VoiceSourcePathInfo = {
  storagePath: string;
  sourcePathClass: VoiceSourcePathClass;
  sourceKind: VoiceSourceKind;
};

export const VOICE_CHANGER_SOURCE_RETENTION_DAYS = 14;
export const VOICE_CLONE_SOURCE_RETENTION_DAYS = 90;

const clampRetentionDays = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(Math.max(Math.trunc(value), 1), 365);
};

const addRetentionDays = (days: number | null): string | null => {
  if (!days) return null;
  const retentionUntil = new Date();
  retentionUntil.setUTCDate(retentionUntil.getUTCDate() + days);
  return retentionUntil.toISOString();
};

const asTrimmedString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const resolveVoiceSourcePathInfo = ({
  userId,
  storagePath,
}: {
  userId: string;
  storagePath: string | null | undefined;
}): VoiceSourcePathInfo | null => {
  const rawStoragePath = asTrimmedString(storagePath);
  if (!rawStoragePath) return null;
  const safeStoragePath = assertUserScopedMediaStoragePath({
    path: rawStoragePath,
    userId,
    label: "Voice source storage path",
  });

  if (safeStoragePath.startsWith(`${userId}/voice-changer/source-audio/`)) {
    return {
      storagePath: safeStoragePath,
      sourcePathClass: "voice_changer_source_audio",
      sourceKind: "audio",
    };
  }
  if (safeStoragePath.startsWith(`${userId}/voice-changer/source-video/`)) {
    return {
      storagePath: safeStoragePath,
      sourcePathClass: "voice_changer_source_video",
      sourceKind: "video",
    };
  }
  if (safeStoragePath.startsWith(`${userId}/voice-clone/source-audio/`)) {
    return {
      storagePath: safeStoragePath,
      sourcePathClass: "voice_clone_source_audio",
      sourceKind: "audio",
    };
  }

  return null;
};

const resolveLifecycleKey = ({
  lifecycleKey,
  sourceRef,
  generationId,
  providerRequestId,
  providerVoiceId,
  state,
}: Pick<
  RecordVoiceSourceLifecycleInput,
  "lifecycleKey" | "sourceRef" | "generationId" | "providerRequestId" | "providerVoiceId" | "state"
>): string => {
  return (
    asTrimmedString(lifecycleKey) ??
    asTrimmedString(sourceRef) ??
    asTrimmedString(generationId) ??
    asTrimmedString(providerRequestId) ??
    asTrimmedString(providerVoiceId) ??
    state
  );
};

export const recordVoiceSourceLifecycleState = async ({
  userId,
  storagePath,
  workflowKind,
  sourceKind,
  state,
  lifecycleKey,
  sourceRef,
  generationId,
  providerRequestId,
  providerVoiceId,
  retentionDays,
  metadata = null,
}: RecordVoiceSourceLifecycleInput): Promise<{ recorded: boolean }> => {
  const pathInfo = resolveVoiceSourcePathInfo({ userId, storagePath });
  if (!pathInfo) return { recorded: false };

  const effectiveSourceKind = sourceKind ?? pathInfo.sourceKind;
  const effectiveLifecycleKey = resolveLifecycleKey({
    lifecycleKey,
    sourceRef,
    generationId,
    providerRequestId,
    providerVoiceId,
    state,
  });
  const retentionUntil = addRetentionDays(clampRetentionDays(retentionDays));

  const { error } = await getSupabaseAdmin()
    .from("voice_source_lifecycle")
    .upsert(
      {
        user_id: userId,
        storage_path: pathInfo.storagePath,
        source_path_class: pathInfo.sourcePathClass,
        workflow_kind: workflowKind,
        source_kind: effectiveSourceKind,
        lifecycle_key: effectiveLifecycleKey,
        lifecycle_state: state,
        source_ref: asTrimmedString(sourceRef),
        generation_id: asTrimmedString(generationId),
        provider_request_id: asTrimmedString(providerRequestId),
        provider_voice_id: asTrimmedString(providerVoiceId),
        retention_until: retentionUntil,
        updated_at: new Date().toISOString(),
        metadata: metadata ?? {},
      },
      {
        onConflict: "user_id,storage_path,workflow_kind,lifecycle_key",
      }
    );
  if (error) throw error;

  return { recorded: true };
};
