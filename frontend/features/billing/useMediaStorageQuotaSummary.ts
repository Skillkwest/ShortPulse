import { useCallback, useEffect, useState } from "react";
import { primeSupabaseSession } from "../../lib/supabaseClient";
import { useResolvedProtectedSessionState } from "../../lib/protectedRouteSessionContext";
import type { MediaStorageQuotaSummary } from "./storage";
import { fetchBillingAccountSummary } from "./accountSummary";

const MEDIA_STORAGE_QUOTA_REFRESH_EVENT = "shortpulse:media-storage-quota-refresh";

export const useMediaStorageQuotaSummary = ({
  enabled = true,
  shouldDeferAutomaticRefresh,
}: {
  enabled?: boolean;
  fallbackPlanId?: string | null;
  shouldDeferAutomaticRefresh?: () => boolean;
}) => {
  const { session, user } = useResolvedProtectedSessionState({
    enabled,
  });
  const [quotaSummary, setQuotaSummary] = useState<MediaStorageQuotaSummary | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<"idle" | "available" | "unavailable">("idle");
  const [loading, setLoading] = useState(false);

  const refreshQuotaSummary = useCallback(
    async (options?: { force?: boolean }) => {
      if (!enabled || !user) {
        setQuotaSummary(null);
        setQuotaStatus("idle");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (session) {
          primeSupabaseSession(session);
        }
        const summary = await fetchBillingAccountSummary({
          force: options?.force === true,
          expectedUserId: user.id,
        });
        if (!summary || summary.userId !== user.id || summary.quotaStatus !== "available") {
          setQuotaSummary(null);
          setQuotaStatus("unavailable");
          return;
        }
        setQuotaSummary(summary.quotaSummary);
        setQuotaStatus(summary.quotaSummary ? "available" : "unavailable");
      } catch {
        setQuotaSummary(null);
        setQuotaStatus("unavailable");
      } finally {
        setLoading(false);
      }
    },
    [enabled, session, user]
  );

  useEffect(() => {
    void refreshQuotaSummary();
  }, [refreshQuotaSummary]);

  useEffect(() => {
    if (!enabled || !user || typeof window === "undefined") return;

    const handleWindowFocus = () => {
      if (shouldDeferAutomaticRefresh?.()) return;
      void refreshQuotaSummary();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (shouldDeferAutomaticRefresh?.()) return;
      void refreshQuotaSummary();
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, refreshQuotaSummary, shouldDeferAutomaticRefresh, user]);

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
    quotaStatus,
    loading,
    refreshQuotaSummary,
  };
};

export const requestMediaStorageQuotaSummaryRefresh = (): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MEDIA_STORAGE_QUOTA_REFRESH_EVENT));
};
