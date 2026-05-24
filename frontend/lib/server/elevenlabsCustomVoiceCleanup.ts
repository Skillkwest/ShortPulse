/**
 * Best-effort rollback helpers for custom ElevenLabs voice creation when
 * ownership persistence fails after upstream voice creation already succeeded.
 */
import { deleteElevenLabsVoice } from "./elevenlabs";
import { deletePersistedElevenLabsVoiceSample } from "./elevenlabsVoiceSamples";

export type FailedCustomVoiceCleanupResult = {
  providerVoiceDeleted: boolean;
  sampleDeleted: boolean;
  cleanupErrors: Error[];
};

const toError = (error: unknown, fallbackMessage: string): Error =>
  error instanceof Error ? error : new Error(fallbackMessage);

/**
 * Rolls back provider-side custom voices and any persisted sample object after
 * a fail-closed ownership persistence error.
 */
export const cleanupFailedElevenLabsCustomVoice = async ({
  sampleStoragePath,
  userId,
  voiceId,
}: {
  sampleStoragePath: string | null;
  userId: string;
  voiceId: string;
}): Promise<FailedCustomVoiceCleanupResult> => {
  const cleanupErrors: Error[] = [];
  let providerVoiceDeleted = false;
  let sampleDeleted = false;

  try {
    await deleteElevenLabsVoice(voiceId);
    providerVoiceDeleted = true;
  } catch (error) {
    cleanupErrors.push(toError(error, "Unable to delete provider custom voice during rollback."));
  }

  if (sampleStoragePath) {
    try {
      await deletePersistedElevenLabsVoiceSample({
        userId,
        sampleStoragePath,
      });
      sampleDeleted = true;
    } catch (error) {
      cleanupErrors.push(
        toError(error, "Unable to delete persisted voice sample during rollback.")
      );
    }
  }

  return {
    providerVoiceDeleted,
    sampleDeleted,
    cleanupErrors,
  };
};
