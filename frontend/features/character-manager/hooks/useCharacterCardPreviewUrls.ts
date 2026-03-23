/**
 * Character Manager card preview URL hook.
 * Owns adaptive preview resolution plus one-shot signed URL refresh retries for character card surfaces.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AdaptivePressureLevel } from "../../../lib/adaptive-media/types";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { resolveCharacterGridPreviewUrl as resolveCharacterGridPreviewUrlForSurface } from "../logic/characterGridPreviewUrl";

const MEDIA_BUCKET = "media_library";
const CHARACTER_CARD_PREVIEW_SIGN_RETRY_LIMIT = 1;

type UseCharacterCardPreviewUrlsParams = {
  selectedCharacterId: string | null;
  adaptivePreviewEnabled: boolean;
  pressureLevel: AdaptivePressureLevel;
};

/**
 * Returns preview URL resolvers and retry refresh actions for Character Manager card surfaces.
 */
export const useCharacterCardPreviewUrls = ({
  selectedCharacterId,
  adaptivePreviewEnabled,
  pressureLevel,
}: UseCharacterCardPreviewUrlsParams) => {
  const [cardPreviewUrlByStoragePath, setCardPreviewUrlByStoragePath] = useState<
    Record<string, string>
  >({});
  const cardPreviewRetryCountRef = useRef<Record<string, number>>({});

  useEffect(() => {
    setCardPreviewUrlByStoragePath({});
    cardPreviewRetryCountRef.current = {};
  }, [selectedCharacterId]);

  const refreshCardPreviewSignedUrl = useCallback(
    (storagePath: string | null | undefined, failedUrl?: string | null) => {
      const trimmedStoragePath = storagePath?.trim() ?? "";
      if (!trimmedStoragePath) return;
      const attempts = cardPreviewRetryCountRef.current[trimmedStoragePath] ?? 0;
      if (attempts >= CHARACTER_CARD_PREVIEW_SIGN_RETRY_LIMIT) return;
      cardPreviewRetryCountRef.current[trimmedStoragePath] = attempts + 1;

      void getSignedMediaUrl({
        bucket: MEDIA_BUCKET,
        storagePath: trimmedStoragePath,
        expiresInSeconds: 3600,
        forceRefresh: true,
      }).then((signedUrl) => {
        const nextUrl = signedUrl?.trim() ?? "";
        if (!nextUrl) return;
        if (failedUrl && failedUrl.trim() === nextUrl) return;
        setCardPreviewUrlByStoragePath((prev) => {
          if (prev[trimmedStoragePath] === nextUrl) return prev;
          return {
            ...prev,
            [trimmedStoragePath]: nextUrl,
          };
        });
      });
    },
    []
  );

  const resolveCharacterGridPreviewUrl = useCallback(
    (url: string | null | undefined, cardLongEdgePx: number): string | null => {
      return resolveCharacterGridPreviewUrlForSurface({
        url,
        adaptivePreviewEnabled,
        pressureLevel,
        cardLongEdgePx,
        devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      });
    },
    [adaptivePreviewEnabled, pressureLevel]
  );

  const resolveCharacterCardPreviewUrl = useCallback(
    ({
      previewUrl,
      storagePath,
      cardLongEdgePx,
    }: {
      previewUrl: string | null | undefined;
      storagePath: string | null | undefined;
      cardLongEdgePx: number;
    }): string | null => {
      const trimmedStoragePath = storagePath?.trim() ?? "";
      const signedOverride = trimmedStoragePath
        ? (cardPreviewUrlByStoragePath[trimmedStoragePath] ?? null)
        : null;
      const sourceUrl = signedOverride ?? previewUrl;
      return resolveCharacterGridPreviewUrl(sourceUrl, cardLongEdgePx) ?? sourceUrl ?? null;
    },
    [cardPreviewUrlByStoragePath, resolveCharacterGridPreviewUrl]
  );

  return {
    refreshCardPreviewSignedUrl,
    resolveCharacterGridPreviewUrl,
    resolveCharacterCardPreviewUrl,
  };
};
