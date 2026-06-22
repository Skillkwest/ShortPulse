import { useCallback, useEffect, useMemo, useState } from "react";
import {
  asCanonicalStoragePath,
  logAdaptiveDetailFullQualityUsed,
} from "../../../../lib/adaptive-media";
import { isAudioUrl, isVideoUrl } from "../../logic/stateParsers";
import { resolveStudioOutputMediaDisplayAuthority } from "../../logic/referenceGridMedia";
import type { StudioOutput } from "../../types";
import {
  buildUniquePreviewCandidates,
  createPreviewSelectionState,
  type DetailPreviewSelectionState,
  isFullQualityDetailImageUrl,
  resolveCanonicalDetailAuthorityUrl,
  resolveDetailPreviewCandidates,
  resolveNextPreviewCandidateUrl,
  shouldResolveCanonicalDetailAuthority,
} from "./detailModalPreviewAuthority";

type ResolvedCanonicalPreviewState = {
  outputId: string;
  authorityKey: string;
  url: string | null;
};

const serializeDetailAuthorityList = (values: readonly string[] | null | undefined): string =>
  Array.isArray(values)
    ? values.map((value) => (typeof value === "string" ? value.trim() : "")).join("\u001f")
    : "";

const deserializeDetailAuthorityList = (signature: string): string[] =>
  signature
    .split("\u001f")
    .map((value) => value.trim())
    .filter(Boolean);

const buildDetailCanonicalAuthorityKey = ({
  savedMediaIdsSignature,
  resultUrlsSignature,
  generationId,
  taskId,
  mediaSource,
  previewStoragePath,
  fullStoragePath,
  previewUrl,
  projectId,
}: {
  savedMediaIdsSignature: string;
  resultUrlsSignature: string;
  generationId?: string | null;
  taskId?: string | null;
  mediaSource?: StudioOutput["mediaSource"];
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewUrl?: string | null;
  projectId: string | null;
}): string =>
  [
    projectId?.trim() ?? "",
    savedMediaIdsSignature,
    generationId?.trim() ?? "",
    taskId?.trim() ?? "",
    mediaSource ?? "",
    previewStoragePath?.trim() ?? "",
    fullStoragePath?.trim() ?? "",
    previewUrl?.trim() ?? "",
    resultUrlsSignature,
  ].join("\u001e");

export const useStudioOutputDetailMediaPreview = ({
  output,
  projectId,
}: {
  output: StudioOutput;
  projectId: string | null;
}) => {
  const outputId = output.id;
  const savedMediaIdsSignature = serializeDetailAuthorityList(output.savedMediaIds);
  const resultUrlsSignature = serializeDetailAuthorityList(output.resultUrls);
  const stableSavedMediaIds = useMemo(
    () => deserializeDetailAuthorityList(savedMediaIdsSignature),
    [savedMediaIdsSignature]
  );
  const stableResultUrls = useMemo(
    () => deserializeDetailAuthorityList(resultUrlsSignature),
    [resultUrlsSignature]
  );
  const canonicalAuthorityKey = useMemo(
    () =>
      buildDetailCanonicalAuthorityKey({
        savedMediaIdsSignature,
        resultUrlsSignature,
        generationId: output.generationId,
        taskId: output.taskId,
        mediaSource: output.mediaSource,
        previewStoragePath: output.previewStoragePath,
        fullStoragePath: output.fullStoragePath,
        previewUrl: output.previewUrl,
        projectId,
      }),
    [
      output.fullStoragePath,
      output.generationId,
      output.mediaSource,
      output.previewStoragePath,
      output.previewUrl,
      output.taskId,
      projectId,
      resultUrlsSignature,
      savedMediaIdsSignature,
    ]
  );
  const [previewSelectionByOutput, setPreviewSelectionByOutput] =
    useState<DetailPreviewSelectionState>(() =>
      createPreviewSelectionState(output.id, resolveDetailPreviewCandidates(output))
    );
  const [resolvedCanonicalPreviewByOutput, setResolvedCanonicalPreviewByOutput] =
    useState<ResolvedCanonicalPreviewState | null>(null);
  const [canonicalPreviewResolvingOutputId, setCanonicalPreviewResolvingOutputId] = useState<
    string | null
  >(null);
  const resolvedCanonicalPreviewUrl =
    resolvedCanonicalPreviewByOutput &&
    resolvedCanonicalPreviewByOutput.outputId === outputId &&
    resolvedCanonicalPreviewByOutput.authorityKey === canonicalAuthorityKey
      ? resolvedCanonicalPreviewByOutput.url
      : null;
  const detailMediaAuthority = useMemo(
    () =>
      resolveStudioOutputMediaDisplayAuthority(
        {
          id: output.id,
          previewStoragePath: output.previewStoragePath,
          previewPosterStoragePath: output.previewPosterStoragePath,
          fullStoragePath: resolvedCanonicalPreviewUrl ?? output.fullStoragePath,
          mediaSource: output.mediaSource,
          generationId: output.generationId,
          taskId: output.taskId,
          taskState: output.taskState,
          savedMediaIds: stableSavedMediaIds,
          mode: output.mode,
          previewUrl: output.previewUrl,
          previewPosterUrl: output.previewPosterUrl,
          resultUrls: stableResultUrls,
        },
        {
          strictPreviewLadder: true,
          adaptivePreviewQuality: false,
          surface: "detail-modal",
        }
      ),
    [output, resolvedCanonicalPreviewUrl, stableResultUrls, stableSavedMediaIds]
  );
  const preferredDetailMediaUrl =
    output.mode === "video" || output.mode === "audio"
      ? detailMediaAuthority.playableMediaUrl
      : (detailMediaAuthority.fullMediaUrl ?? detailMediaAuthority.cardDisplayUrl);
  const detailVideoPosterUrl =
    output.mode === "video" ? (detailMediaAuthority.posterPreviewUrl ?? null) : null;
  const canonicalAuthorityInput = useMemo(
    () => ({
      savedMediaIds: stableSavedMediaIds,
      generationId: output.generationId,
      taskId: output.taskId,
      mediaSource: output.mediaSource,
      previewStoragePath: output.previewStoragePath,
      fullStoragePath: output.fullStoragePath,
      previewUrl: output.previewUrl,
      resultUrls: stableResultUrls,
    }),
    [
      output.fullStoragePath,
      output.generationId,
      output.mediaSource,
      output.previewStoragePath,
      output.previewUrl,
      output.taskId,
      stableResultUrls,
      stableSavedMediaIds,
    ]
  );

  useEffect(() => {
    if (!preferredDetailMediaUrl) return;
    logAdaptiveDetailFullQualityUsed({
      surface: "detail-modal",
      mediaKind: output.mode === "video" ? "video" : output.mode === "audio" ? "audio" : "image",
    });
  }, [output.mode, preferredDetailMediaUrl]);

  const previewCandidates = useMemo(
    () =>
      buildUniquePreviewCandidates([
        resolvedCanonicalPreviewUrl,
        preferredDetailMediaUrl,
        output.mode === "video" || output.mode === "audio"
          ? null
          : (detailMediaAuthority.thumbnailPreviewUrl ?? null),
        output.mode === "video" || output.mode === "audio" ? null : output.previewUrl,
        ...stableResultUrls,
      ]),
    [
      detailMediaAuthority.thumbnailPreviewUrl,
      output.mode,
      output.previewUrl,
      preferredDetailMediaUrl,
      resolvedCanonicalPreviewUrl,
      stableResultUrls,
    ]
  );
  const fullQualityPromotionUrl = useMemo(() => {
    const hasExplicitFullStoragePath = Boolean(output.fullStoragePath?.trim());
    return (
      [
        resolvedCanonicalPreviewUrl,
        hasExplicitFullStoragePath ? (detailMediaAuthority.fullMediaUrl ?? null) : null,
      ].find((candidateUrl) => isFullQualityDetailImageUrl(candidateUrl)) ?? null
    );
  }, [detailMediaAuthority.fullMediaUrl, output.fullStoragePath, resolvedCanonicalPreviewUrl]);
  const previewSelection =
    previewSelectionByOutput.outputId === outputId ? previewSelectionByOutput : null;
  const selectedPreviewUrl = previewSelection?.currentUrl ?? null;
  const selectedPreviewUrlIsCandidate = Boolean(
    selectedPreviewUrl && previewCandidates.includes(selectedPreviewUrl)
  );
  const displayPreviewUrl = useMemo(() => {
    if (selectedPreviewUrl && selectedPreviewUrlIsCandidate) {
      return selectedPreviewUrl;
    }
    return (
      resolveNextPreviewCandidateUrl({
        currentUrl: null,
        previewCandidates,
        rejectedUrls: previewSelection?.rejectedUrls ?? [],
      }) ?? null
    );
  }, [
    previewCandidates,
    previewSelection?.rejectedUrls,
    selectedPreviewUrl,
    selectedPreviewUrlIsCandidate,
  ]);
  const hasCanonicalStorageAuthority = Boolean(
    asCanonicalStoragePath(output.previewStoragePath) ||
    asCanonicalStoragePath(output.fullStoragePath)
  );
  const hasSavedMediaAuthority = Boolean(
    Array.isArray(stableSavedMediaIds) && stableSavedMediaIds.some((value) => value.trim())
  );
  const hasExplicitDisplayAuthorityUrl = Boolean(
    displayPreviewUrl &&
    [output.previewStoragePath, output.fullStoragePath].some(
      (candidate) => candidate?.trim() === displayPreviewUrl
    )
  );
  const hasRecoverableGeneratedImageAuthority = Boolean(
    output.mode === "image" &&
    output.mediaSource === "generated" &&
    (output.generationId?.trim() || output.taskId?.trim()) &&
    !hasExplicitDisplayAuthorityUrl
  );
  const shouldResolveCanonicalPreview = Boolean(
    shouldResolveCanonicalDetailAuthority(canonicalAuthorityInput) &&
    (hasCanonicalStorageAuthority ||
      hasSavedMediaAuthority ||
      hasRecoverableGeneratedImageAuthority ||
      !displayPreviewUrl)
  );
  const hasResolvedCanonicalPreviewAttempt = Boolean(
    resolvedCanonicalPreviewByOutput?.outputId === outputId &&
    resolvedCanonicalPreviewByOutput.authorityKey === canonicalAuthorityKey
  );

  useEffect(() => {
    // Detail modal media should follow the highest-authority available candidate for the
    // selected output so restored/saved sessions can promote from compact previews to full media.
    const rejectedUrls =
      previewSelectionByOutput.outputId === outputId ? previewSelectionByOutput.rejectedUrls : [];
    const nextUrl = resolveNextPreviewCandidateUrl({
      currentUrl: null,
      previewCandidates,
      rejectedUrls,
    });
    if (previewSelectionByOutput.outputId !== outputId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewSelectionByOutput({
        outputId,
        currentUrl: nextUrl,
        rejectedUrls,
      });
      return;
    }
    if (nextUrl === previewSelectionByOutput.currentUrl) return;
    const shouldPromoteToFullQuality =
      Boolean(nextUrl) &&
      nextUrl === fullQualityPromotionUrl &&
      previewSelectionByOutput.currentUrl !== nextUrl;
    const rejectedUrlSet = new Set(rejectedUrls);
    const currentUrlWasRejected = Boolean(
      previewSelectionByOutput.currentUrl && rejectedUrlSet.has(previewSelectionByOutput.currentUrl)
    );
    const currentUrlIsStillCandidate = Boolean(
      previewSelectionByOutput.currentUrl &&
      previewCandidates.includes(previewSelectionByOutput.currentUrl)
    );
    const shouldPreserveCurrentUrl =
      Boolean(previewSelectionByOutput.currentUrl) &&
      currentUrlIsStillCandidate &&
      !currentUrlWasRejected &&
      !shouldPromoteToFullQuality;
    if (shouldPreserveCurrentUrl) return;
    setPreviewSelectionByOutput({
      ...previewSelectionByOutput,
      currentUrl: nextUrl,
    });
  }, [fullQualityPromotionUrl, outputId, previewCandidates, previewSelectionByOutput]);

  useEffect(() => {
    if (!shouldResolveCanonicalPreview) {
      if (canonicalPreviewResolvingOutputId === outputId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCanonicalPreviewResolvingOutputId(null);
      }
      if (resolvedCanonicalPreviewByOutput?.outputId === outputId) {
        setResolvedCanonicalPreviewByOutput(null);
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      const nextUrl = await resolveCanonicalDetailAuthorityUrl(canonicalAuthorityInput, {
        projectId,
      });
      if (cancelled) return;
      setResolvedCanonicalPreviewByOutput((current) => {
        if (nextUrl) {
          return {
            outputId,
            authorityKey: canonicalAuthorityKey,
            url: nextUrl,
          };
        }
        if (current?.outputId === outputId && current.authorityKey === canonicalAuthorityKey) {
          return current;
        }
        return {
          outputId,
          authorityKey: canonicalAuthorityKey,
          url: null,
        };
      });
      setCanonicalPreviewResolvingOutputId((current) => (current === outputId ? null : current));
    })();
    return () => {
      cancelled = true;
    };
  }, [
    canonicalAuthorityInput,
    canonicalAuthorityKey,
    canonicalPreviewResolvingOutputId,
    outputId,
    projectId,
    resolvedCanonicalPreviewByOutput?.outputId,
    shouldResolveCanonicalPreview,
  ]);

  useEffect(() => {
    if (!resolvedCanonicalPreviewUrl) return;
    const hasRawStorageAuthority = Boolean(
      asCanonicalStoragePath(output.previewStoragePath) ||
      asCanonicalStoragePath(output.fullStoragePath)
    );
    if (!hasRawStorageAuthority) return;
    const legacyUrlCandidates = buildUniquePreviewCandidates([
      output.previewUrl,
      ...stableResultUrls,
    ]);
    // The detail modal intentionally promotes canonical storage authority after it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewSelectionByOutput((current) => {
      if (current.outputId !== outputId) return current;
      if (current.currentUrl === resolvedCanonicalPreviewUrl) return current;
      if (current.currentUrl && !legacyUrlCandidates.includes(current.currentUrl)) {
        return current;
      }
      return {
        ...current,
        currentUrl: resolvedCanonicalPreviewUrl,
        rejectedUrls: current.rejectedUrls.filter((value) => value !== resolvedCanonicalPreviewUrl),
      };
    });
  }, [
    output.fullStoragePath,
    output.previewStoragePath,
    output.previewUrl,
    outputId,
    resolvedCanonicalPreviewUrl,
    stableResultUrls,
  ]);

  const isAudioOutput = Boolean(
    output.mode === "audio" || (displayPreviewUrl && isAudioUrl(displayPreviewUrl))
  );
  const isVideoOutput = Boolean(
    !isAudioOutput &&
    output.mode !== "image" &&
    (output.mode === "video" || (displayPreviewUrl && isVideoUrl(displayPreviewUrl)))
  );
  const isImageOutput = Boolean(displayPreviewUrl) && !isVideoOutput && !isAudioOutput;
  const detailPreviewKind: "video" | "audio" | "image" | null = displayPreviewUrl
    ? isVideoOutput
      ? "video"
      : isAudioOutput
        ? "audio"
        : "image"
    : null;
  const mediaType: "Audio" | "Video" | "Image" | "Text" = displayPreviewUrl
    ? isAudioOutput
      ? "Audio"
      : isVideoOutput
        ? "Video"
        : "Image"
    : "Text";
  const isPromptOnly = output.mode === "text" && !displayPreviewUrl;
  const isAwaitingPlayableMedia = Boolean(
    !displayPreviewUrl &&
    (output.mode === "video" || output.mode === "audio") &&
    (output.previewUrl?.trim() || output.previewPosterUrl?.trim())
  );
  const isAwaitingCanonicalMedia = Boolean(
    !displayPreviewUrl && shouldResolveCanonicalPreview && !hasResolvedCanonicalPreviewAttempt
  );
  const isDetailPreviewLoading =
    canonicalPreviewResolvingOutputId === outputId ||
    isAwaitingPlayableMedia ||
    isAwaitingCanonicalMedia;

  const tryAdvancePreviewCandidate = useCallback(() => {
    const currentUrl = previewSelection?.currentUrl ?? displayPreviewUrl;
    const rejectedUrls = previewSelection?.rejectedUrls ?? [];
    const nextUrl = resolveNextPreviewCandidateUrl({
      currentUrl,
      previewCandidates,
      rejectedUrls,
    });
    if (!nextUrl) {
      setPreviewSelectionByOutput((current) => {
        if (current.outputId !== outputId) {
          return createPreviewSelectionState(
            outputId,
            previewCandidates,
            currentUrl ? [currentUrl] : []
          );
        }
        const nextRejectedUrls =
          currentUrl && !current.rejectedUrls.includes(currentUrl)
            ? [...current.rejectedUrls, currentUrl]
            : current.rejectedUrls;
        return {
          ...current,
          currentUrl: null,
          rejectedUrls: nextRejectedUrls,
        };
      });
      return false;
    }
    setPreviewSelectionByOutput({
      outputId,
      currentUrl: nextUrl,
      rejectedUrls: currentUrl ? [...rejectedUrls, currentUrl] : rejectedUrls,
    });
    return true;
  }, [displayPreviewUrl, outputId, previewCandidates, previewSelection]);

  const refreshCanonicalPreviewCandidate = useCallback(async () => {
    setCanonicalPreviewResolvingOutputId(outputId);
    const refreshedUrl = await resolveCanonicalDetailAuthorityUrl(canonicalAuthorityInput, {
      forceRefresh: true,
      projectId,
    });
    setCanonicalPreviewResolvingOutputId((current) => (current === outputId ? null : current));
    if (!refreshedUrl) return null;
    setResolvedCanonicalPreviewByOutput({
      outputId,
      authorityKey: canonicalAuthorityKey,
      url: refreshedUrl,
    });
    setPreviewSelectionByOutput((current) => {
      const rejectedUrls = current.outputId === outputId ? current.rejectedUrls : [];
      return {
        outputId,
        currentUrl: refreshedUrl,
        rejectedUrls: rejectedUrls.filter((value) => value !== refreshedUrl),
      };
    });
    return refreshedUrl;
  }, [canonicalAuthorityInput, canonicalAuthorityKey, outputId, projectId]);

  const resetDetailMediaPreviewState = useCallback(() => {
    setResolvedCanonicalPreviewByOutput(null);
    setCanonicalPreviewResolvingOutputId(null);
    setPreviewSelectionByOutput(
      createPreviewSelectionState(output.id, resolveDetailPreviewCandidates(output))
    );
  }, [output]);

  return {
    outputId,
    detailVideoPosterUrl,
    displayPreviewUrl,
    isDetailPreviewLoading,
    isAudioOutput,
    isVideoOutput,
    isImageOutput,
    detailPreviewKind,
    mediaType,
    isPromptOnly,
    tryAdvancePreviewCandidate,
    refreshCanonicalPreviewCandidate,
    resetDetailMediaPreviewState,
  };
};
