/**
 * Avatar resilience utilities for AI Studio UI surfaces.
 * Provides one-shot recovery with deterministic fallback state per surface/avatar id.
 */
import { useCallback, useRef, useState } from "react";

export type AvatarRecoveryCallback = () => Promise<string | null | undefined>;

type UseAvatarResilienceParams = {
  surfaceId: string;
};

type HandleAvatarErrorParams = {
  avatarId: string | null | undefined;
  recoverAvatarUrl?: AvatarRecoveryCallback | null;
};

/**
 * Normalizes avatar ids used for fallback/recovery tracking.
 */
export const normalizeAvatarIdentifier = (avatarId: string | null | undefined): string | null => {
  const normalized = avatarId?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

/**
 * Builds a per-surface key so failures are isolated by UI context.
 */
export const buildAvatarSurfaceFailureKey = (
  surfaceId: string,
  avatarId: string | null | undefined
): string | null => {
  const normalizedAvatarId = normalizeAvatarIdentifier(avatarId);
  if (!normalizedAvatarId) return null;
  return `${surfaceId}:${normalizedAvatarId}`;
};

/**
 * Tracks avatar failures and applies a bounded single recovery attempt per avatar id.
 */
export const useAvatarResilience = ({ surfaceId }: UseAvatarResilienceParams) => {
  const [failedAvatarKeys, setFailedAvatarKeys] = useState<Record<string, true>>({});
  const attemptedRecoveryKeysRef = useRef<Set<string>>(new Set());

  const isAvatarFailed = useCallback(
    (avatarId: string | null | undefined): boolean => {
      const failureKey = buildAvatarSurfaceFailureKey(surfaceId, avatarId);
      if (!failureKey) return false;
      return Boolean(failedAvatarKeys[failureKey]);
    },
    [failedAvatarKeys, surfaceId]
  );

  const resolveAvatarUrl = useCallback(
    (avatarId: string | null | undefined, avatarUrl: string | null | undefined): string | null => {
      const normalizedUrl = avatarUrl?.trim() ?? "";
      if (!normalizedUrl) return null;
      return isAvatarFailed(avatarId) ? null : normalizedUrl;
    },
    [isAvatarFailed]
  );

  const clearAvatarFailure = useCallback(
    (avatarId: string | null | undefined) => {
      const failureKey = buildAvatarSurfaceFailureKey(surfaceId, avatarId);
      if (!failureKey) return;
      setFailedAvatarKeys((current) => {
        if (!current[failureKey]) return current;
        const next = { ...current };
        delete next[failureKey];
        return next;
      });
    },
    [surfaceId]
  );

  const handleAvatarError = useCallback(
    async ({ avatarId, recoverAvatarUrl = null }: HandleAvatarErrorParams) => {
      const failureKey = buildAvatarSurfaceFailureKey(surfaceId, avatarId);
      if (!failureKey) return;

      setFailedAvatarKeys((current) => {
        if (current[failureKey]) return current;
        return { ...current, [failureKey]: true };
      });

      if (attemptedRecoveryKeysRef.current.has(failureKey)) return;
      attemptedRecoveryKeysRef.current.add(failureKey);

      if (!recoverAvatarUrl) return;
      try {
        const refreshedAvatarUrl = await recoverAvatarUrl();
        if (!refreshedAvatarUrl?.trim()) return;
        clearAvatarFailure(avatarId);
      } catch {
        // Recovery is best-effort and should never block the UI fallback.
      }
    },
    [clearAvatarFailure, surfaceId]
  );

  return {
    isAvatarFailed,
    resolveAvatarUrl,
    clearAvatarFailure,
    handleAvatarError,
  };
};
