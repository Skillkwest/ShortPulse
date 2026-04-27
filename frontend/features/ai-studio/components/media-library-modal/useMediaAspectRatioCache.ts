import React from "react";

type MediaAspectRatioRow = {
  id: string;
};

type UseMediaAspectRatioCacheResult = {
  aspectRatioById: Record<string, number>;
  cacheAspectRatio: (id: string, ratio: number) => void;
};

export const useMediaAspectRatioCache = <TRow extends MediaAspectRatioRow>(
  rows: TRow[]
): UseMediaAspectRatioCacheResult => {
  const [aspectRatioById, setAspectRatioById] = React.useState<Record<string, number>>({});

  const cacheAspectRatio = React.useCallback((id: string, ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    setAspectRatioById((prev) => {
      if (prev[id] === ratio) return prev;
      return { ...prev, [id]: ratio };
    });
  }, []);

  React.useEffect(() => {
    const activeIdSet = new Set(rows.map((item) => item.id));
    setAspectRatioById((prev) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [id, ratio] of Object.entries(prev)) {
        if (!activeIdSet.has(id)) {
          changed = true;
          continue;
        }
        next[id] = ratio;
      }
      return changed ? next : prev;
    });
  }, [rows]);

  return {
    aspectRatioById,
    cacheAspectRatio,
  };
};
