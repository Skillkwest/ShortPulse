/**
 * Display-only preview lifecycle for secondary reference image slots.
 * Keeps generated thumbnail object URLs out of the main reference interaction facade.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ImageDisplayPreviewEntry = {
  sourceUrl: string;
  displayUrl: string;
  ownsObjectUrl: boolean;
};

type UseReferencePropertiesImageDisplayPreviewsArgs = {
  extraImageUrls: readonly (string | null)[];
  slotCount: number;
};

export const useReferencePropertiesImageDisplayPreviews = ({
  extraImageUrls,
  slotCount,
}: UseReferencePropertiesImageDisplayPreviewsArgs) => {
  const extraImageDisplayPreviewEntriesRef = useRef<Array<ImageDisplayPreviewEntry | null>>([]);
  const [extraImageDisplayPreviewEntries, setExtraImageDisplayPreviewEntries] = useState<
    Array<ImageDisplayPreviewEntry | null>
  >([]);

  const releaseDisplayPreviewEntry = useCallback((entry: ImageDisplayPreviewEntry | null) => {
    if (!entry?.ownsObjectUrl || !entry.displayUrl.startsWith("blob:")) return;
    URL.revokeObjectURL(entry.displayUrl);
  }, []);

  const setExtraImageDisplayPreviewAt = useCallback(
    (index: number, sourceUrl: string | null, displayUrl: string | null, ownsObjectUrl = false) => {
      const previous = extraImageDisplayPreviewEntriesRef.current[index] ?? null;
      releaseDisplayPreviewEntry(previous);
      const nextEntries = [...extraImageDisplayPreviewEntriesRef.current];
      nextEntries[index] =
        sourceUrl && displayUrl
          ? {
              sourceUrl,
              displayUrl,
              ownsObjectUrl,
            }
          : null;
      extraImageDisplayPreviewEntriesRef.current = nextEntries;
      setExtraImageDisplayPreviewEntries(nextEntries);
    },
    [releaseDisplayPreviewEntry]
  );

  const extraImageDisplayUrls = useMemo(() => {
    return Array.from({ length: slotCount }, (_, index) => {
      const sourceUrl = extraImageUrls[index] ?? null;
      const entry = extraImageDisplayPreviewEntries[index] ?? null;
      if (!sourceUrl || !entry || entry.sourceUrl !== sourceUrl) return null;
      return entry.displayUrl;
    });
  }, [extraImageDisplayPreviewEntries, extraImageUrls, slotCount]);

  useEffect(() => {
    let didChange = false;
    const nextEntries = extraImageDisplayPreviewEntriesRef.current.map((entry, index) => {
      const sourceUrl = extraImageUrls[index] ?? null;
      if (!entry || entry.sourceUrl === sourceUrl) return entry ?? null;
      releaseDisplayPreviewEntry(entry);
      didChange = true;
      return null;
    });
    if (didChange) {
      extraImageDisplayPreviewEntriesRef.current = nextEntries;
      setExtraImageDisplayPreviewEntries(nextEntries);
    }
  }, [extraImageUrls, releaseDisplayPreviewEntry]);

  useEffect(
    () => () => {
      extraImageDisplayPreviewEntriesRef.current.forEach(releaseDisplayPreviewEntry);
      extraImageDisplayPreviewEntriesRef.current = [];
    },
    [releaseDisplayPreviewEntry]
  );

  return {
    extraImageDisplayUrls,
    setExtraImageDisplayPreviewAt,
  };
};
