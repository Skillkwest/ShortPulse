/**
 * Shared policy for client-side audio companion-art refresh loops.
 * Bounds status-only retries while preserving refreshes for durable storage rows that need signed URLs.
 */
export const AUDIO_COMPANION_ART_STATUS_REFRESH_MAX_ATTEMPTS = 60;

type AudioCompanionArtStatus = string | null | undefined;

type AudioCompanionArtRefreshCandidate = {
  companionArtStatus?: AudioCompanionArtStatus;
  companionArtStoragePath?: string | null;
  companionArtUrl?: string | null;
};

export const isAudioCompanionArtStatusPending = (status: AudioCompanionArtStatus): boolean =>
  status === "pending" || status === "processing";

export const buildAudioCompanionArtRefreshKey = ({
  id,
  status,
  storagePath,
  url,
}: {
  id: string;
  status?: AudioCompanionArtStatus;
  storagePath?: string | null;
  url?: string | null;
}): string => [id, status ?? "", storagePath ?? "", url ?? ""].join(":");

export const shouldRefreshAudioCompanionArt = ({
  candidate,
  statusRefreshAttempts = 0,
  maxStatusRefreshAttempts = AUDIO_COMPANION_ART_STATUS_REFRESH_MAX_ATTEMPTS,
}: {
  candidate: AudioCompanionArtRefreshCandidate;
  statusRefreshAttempts?: number;
  maxStatusRefreshAttempts?: number;
}): boolean => {
  if (candidate.companionArtStatus === "failed") return false;
  if (candidate.companionArtStoragePath?.trim() && !candidate.companionArtUrl?.trim()) {
    return true;
  }
  if (!isAudioCompanionArtStatusPending(candidate.companionArtStatus)) return false;
  return statusRefreshAttempts < maxStatusRefreshAttempts;
};
