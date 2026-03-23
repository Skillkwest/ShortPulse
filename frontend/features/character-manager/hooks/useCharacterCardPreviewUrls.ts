/**
 * Character Manager card preview URL hook.
 * Owns adaptive preview resolution plus one-shot signed URL refresh retries for character card surfaces.
 */
import { useCallback, useRef, useState } from "react";
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
  const [cardPreviewState, setCardPreviewState] = useState<{
    characterId: string | null;
    urlByStoragePath: Record<string, string>;
  }>({
    characterId: selectedCharacterId,
    urlByStoragePath: {},
  });
  const cardPreviewRetryStateRef = useRef<{
    characterId: string | null;
    countByStoragePath: Record<string, number>;
  }>({
    characterId: selectedCharacterId,
    countByStoragePath: {},
  });

  const refreshCardPreviewSignedUrl = useCallback(
    (storagePath: string | null | undefined, failedUrl?: string | null) => {
      const trimmedStoragePath = storagePath?.trim() ?? "";
      if (!trimmedStoragePath) return;
      const activeCharacterId = selectedCharacterId ?? null;
      if (cardPreviewRetryStateRef.current.characterId !== activeCharacterId) {
        cardPreviewRetryStateRef.current = {
          characterId: activeCharacterId,
          countByStoragePath: {},
        };
      }
      const attempts = cardPreviewRetryStateRef.current.countByStoragePath[trimmedStoragePath] ?? 0;
      if (attempts >= CHARACTER_CARD_PREVIEW_SIGN_RETRY_LIMIT) return;
      cardPreviewRetryStateRef.current.countByStoragePath[trimmedStoragePath] = attempts + 1;

      void getSignedMediaUrl({
        bucket: MEDIA_BUCKET,
        storagePath: trimmedStoragePath,
        expiresInSeconds: 3600,
        forceRefresh: true,
      }).then((signedUrl) => {
        const nextUrl = signedUrl?.trim() ?? "";
        if (!nextUrl) return;
        if (failedUrl && failedUrl.trim() === nextUrl) return;
        setCardPreviewState((prev) => {
          const prevUrls = prev.characterId === activeCharacterId ? prev.urlByStoragePath : {};
          if (prev.characterId === activeCharacterId && prevUrls[trimmedStoragePath] === nextUrl) {
            return prev;
          }
          return {
            characterId: activeCharacterId,
            urlByStoragePath: {
              ...prevUrls,
              [trimmedStoragePath]: nextUrl,
            },
          };
        });
      });
    },
    [selectedCharacterId]
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
      const activeCharacterId = selectedCharacterId ?? null;
      const activePreviewUrls =
        cardPreviewState.characterId === activeCharacterId ? cardPreviewState.urlByStoragePath : {};
      const signedOverride = trimmedStoragePath
        ? (activePreviewUrls[trimmedStoragePath] ?? null)
        : null;
      const sourceUrl = signedOverride ?? previewUrl;
      return resolveCharacterGridPreviewUrl(sourceUrl, cardLongEdgePx) ?? sourceUrl ?? null;
    },
    [cardPreviewState, resolveCharacterGridPreviewUrl, selectedCharacterId]
  );

  return {
    refreshCardPreviewSignedUrl,
    resolveCharacterGridPreviewUrl,
    resolveCharacterCardPreviewUrl,
  };
};
