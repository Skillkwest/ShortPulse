import { useCallback, useEffect, useState } from "react";
import { primeSupabaseSession } from "../../lib/supabaseClient";
import { useResolvedProtectedSessionState } from "../../lib/protectedRouteSessionContext";
import { getDefaultPlanStorageLimitBytes, type MediaStorageQuotaSummary } from "./storage";
import { fetchBillingAccountSummary } from "./accountSummary";

const MEDIA_STORAGE_QUOTA_REFRESH_EVENT = "shortpulse:media-storage-quota-refresh";

const createFallbackSummary = (
  fallbackPlanId: string | undefined | null,
  usedBytes: number
): MediaStorageQuotaSummary => {
  const totalLimitBytes = getDefaultPlanStorageLimitBytes(fallbackPlanId);
  return {
    usedBytes: Math.max(0, usedBytes),
    baseLimitBytes: totalLimitBytes,
    addonLimitBytes: 0,
    totalLimitBytes,
    remainingBytes: Math.max(totalLimitBytes - usedBytes, 0),
    isOverLimit: usedBytes > totalLimitBytes,
  };
};

export const useMediaStorageQuotaSummary = ({
  enabled = true,
  fallbackPlanId,
}: {
  enabled?: boolean;
  fallbackPlanId?: string | null;
}) => {
  const { session, user } = useResolvedProtectedSessionState({
    enabled,
  });
  const [quotaSummary, setQuotaSummary] = useState<MediaStorageQuotaSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshQuotaSummary = useCallback(
    async (options?: { force?: boolean }) => {
      if (!enabled || !user) {
        setQuotaSummary(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (session) {
          primeSupabaseSession(session);
        }
        const summary = await fetchBillingAccountSummary({ force: options?.force === true });
        if (!summary?.quotaSummary || summary.userId !== user.id) {
          setQuotaSummary(createFallbackSummary(fallbackPlanId, 0));
          return;
        }
        setQuotaSummary(summary.quotaSummary);
      } catch {
        setQuotaSummary(createFallbackSummary(fallbackPlanId, 0));
      } finally {
        setLoading(false);
      }
    },
    [enabled, fallbackPlanId, session, user]
  );

  useEffect(() => {
    void refreshQuotaSummary();
  }, [refreshQuotaSummary]);

  useEffect(() => {
    if (!enabled || !user || typeof window === "undefined") return;

    const handleWindowFocus = () => {
      void refreshQuotaSummary();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void refreshQuotaSummary();
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, refreshQuotaSummary, user]);

  useEffect(() => {
    if (!enabled || !user || typeof window === "undefined") return;

    const handleRequestedRefresh = () => {
      void refreshQuotaSummary({ force: true });
    };

    window.addEventListener(MEDIA_STORAGE_QUOTA_REFRESH_EVENT, handleRequestedRefresh);
    return () => {
      window.removeEventListener(MEDIA_STORAGE_QUOTA_REFRESH_EVENT, handleRequestedRefresh);
    };
  }, [enabled, refreshQuotaSummary, user]);

  return {
    quotaSummary,
    loading,
    refreshQuotaSummary,
  };
};

export const requestMediaStorageQuotaSummaryRefresh = (): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MEDIA_STORAGE_QUOTA_REFRESH_EVENT));
};
