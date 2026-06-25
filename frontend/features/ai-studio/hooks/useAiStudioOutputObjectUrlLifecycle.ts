/**
 * Tracks and revokes output-related object URLs for active + archived output sets.
 */
import { useEffect, useRef } from "react";
import type { StudioOutput } from "../types";
import { revokeRememberedObjectUrl } from "../utils/objectUrlBlobRegistry";

const isBlobObjectUrl = (value?: string | null) =>
  typeof value === "string" && value.startsWith("blob:");

const stripVideoMarkerFromBlobUrl = (value: string): string => value.replace(/#video=1$/, "");

const resolveTrackedObjectUrl = (output: StudioOutput): string | null => {
  const explicit = output.localObjectUrl?.trim();
  if (explicit && isBlobObjectUrl(explicit)) {
    return stripVideoMarkerFromBlobUrl(explicit);
  }
  const preview = output.previewUrl?.trim();
  if (!preview || !isBlobObjectUrl(preview)) return null;
  return stripVideoMarkerFromBlobUrl(preview);
};

type UseAiStudioOutputObjectUrlLifecycleArgs = {
  outputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
};

export const useAiStudioOutputObjectUrlLifecycle = ({
  outputs,
  archivedOutputs,
}: UseAiStudioOutputObjectUrlLifecycleArgs): void => {
  const outputObjectUrlByIdRef = useRef<Record<string, string>>({});
  const lastOutputUrlsByIdRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const currentUrlMap: Record<string, string> = {};
    [...outputs, ...archivedOutputs].forEach((item) => {
      const tracked = resolveTrackedObjectUrl(item);
      if (!tracked) return;
      currentUrlMap[item.id] = tracked;
    });
    const previousUrlMap = lastOutputUrlsByIdRef.current;
    Object.entries(previousUrlMap).forEach(([outputId, objectUrl]) => {
      const stillTracked = currentUrlMap[outputId];
      if (stillTracked === objectUrl) return;
      revokeRememberedObjectUrl(objectUrl);
      delete outputObjectUrlByIdRef.current[outputId];
    });
    Object.entries(currentUrlMap).forEach(([outputId, objectUrl]) => {
      outputObjectUrlByIdRef.current[outputId] = objectUrl;
    });
    lastOutputUrlsByIdRef.current = currentUrlMap;
  }, [archivedOutputs, outputs]);

  useEffect(
    () => () => {
      Object.values(lastOutputUrlsByIdRef.current).forEach((objectUrl) => {
        revokeRememberedObjectUrl(objectUrl);
      });
      lastOutputUrlsByIdRef.current = {};
      outputObjectUrlByIdRef.current = {};
    },
    []
  );
};
