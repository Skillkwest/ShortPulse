/**
 * Submit-readiness checks for Voice Changer source inputs.
 */
import { isRemoteFetchableUrlProtocol } from "../logic/voiceChangerSourceUrl";
import type { VoiceChangerSource } from "./VoiceChangerSourceDropzone";

const canSubmitVoiceChangerSourceUrl = (source: VoiceChangerSource): boolean => {
  const sourceUrl = source.sourceUrl?.trim();
  if (!sourceUrl || /^(?:blob:|data:)/i.test(sourceUrl)) return false;
  try {
    const parsed = new URL(
      sourceUrl,
      typeof window === "undefined" ? "https://shortpulse.local" : window.location.href
    );
    return isRemoteFetchableUrlProtocol(parsed.protocol);
  } catch {
    return false;
  }
};

export const canSubmitVoiceChangerSource = (
  source: VoiceChangerSource | null | undefined
): boolean =>
  Boolean(
    source?.status === "ready" &&
    (source.storagePath?.trim() || canSubmitVoiceChangerSourceUrl(source))
  );
