import { useCallback, useEffect, useState } from "react";
import { ensureSupabaseQueryClient } from "../../lib/supabaseClient";
import { useResolvedProtectedSessionState } from "../../lib/protectedRouteSessionContext";
import { getDefaultPlanStorageLimitBytes, type MediaStorageQuotaSummary } from "./storage";

const MEDIA_STORAGE_QUOTA_REFRESH_EVENT = "shortpulse:media-storage-quota-refresh";

type QuotaRpcRow = {
  used_bytes: number | string | null;
  base_limit_bytes: number | string | null;
  addon_limit_bytes: number | string | null;
  total_limit_bytes: number | string | null;
  remaining_bytes: number | string | null;
  is_over_limit: boolean | null;
};

const isSchemaCompatibilityError = (message: string) => {
  const text = message.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("could not find the function") ||
    text.includes("schema cache") ||
    text.includes("failed to parse")
  );
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

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
  const { user } = useResolvedProtectedSessionState({
    enabled,
  });
  const [quotaSummary, setQuotaSummary] = useState<MediaStorageQuotaSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshQuotaSummary = useCallback(async () => {
    if (!enabled || !user) {
      setQuotaSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const supabase = ensureSupabaseQueryClient();
      const { data, error } = await supabase.rpc("get_media_storage_quota_summary");
      if (error) {
        if (!isSchemaCompatibilityError(error.message)) {
          throw error;
        }
        const usageResult = await supabase.rpc("get_media_library_usage_bytes");
        if (usageResult.error && !isSchemaCompatibilityError(usageResult.error.message)) {
          throw usageResult.error;
        }
        setQuotaSummary(createFallbackSummary(fallbackPlanId, toNumber(usageResult.data)));
        return;
      }

      const row = Array.isArray(data) ? ((data[0] ?? null) as QuotaRpcRow | null) : null;
      if (!row) {
        setQuotaSummary(createFallbackSummary(fallbackPlanId, 0));
        return;
      }

      setQuotaSummary({
        usedBytes: Math.max(0, toNumber(row.used_bytes)),
        baseLimitBytes: Math.max(0, toNumber(row.base_limit_bytes)),
        addonLimitBytes: Math.max(0, toNumber(row.addon_limit_bytes)),
        totalLimitBytes: Math.max(
          0,
          toNumber(row.total_limit_bytes) || getDefaultPlanStorageLimitBytes(fallbackPlanId)
        ),
        remainingBytes: Math.max(0, toNumber(row.remaining_bytes)),
        isOverLimit: row.is_over_limit === true,
      });
    } catch {
      setQuotaSummary(createFallbackSummary(fallbackPlanId, 0));
    } finally {
      setLoading(false);
    }
  }, [enabled, fallbackPlanId, user]);

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
      void refreshQuotaSummary();
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
