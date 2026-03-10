/**
 * Resolves internal reference drags to persisted media/prompt ids for Media Library folder drops.
 * Falls back to autosave + bounded polling when dropped references do not yet have persisted ids.
 */
import type { StudioOutput } from "../types";
import type { InternalReferenceDragPayload } from "../utils/dragDrop";

type ResolvedInternalDropItem = {
  kind: "media" | "prompt";
  id: string;
} | null;

type OutputSnapshot = {
  outputOrder: string[];
  archivedOutputOrder: string[];
  outputById: Record<string, StudioOutput | undefined>;
  archivedOutputById: Record<string, StudioOutput | undefined>;
};

type ResolveMediaLibraryInternalDropArgs = {
  payload: InternalReferenceDragPayload;
  getOutputById: (outputId: string) => StudioOutput | null;
  getOutputSnapshot: () => OutputSnapshot;
  resolveSavedMediaIdFromOutput: (output: StudioOutput | null, imageIndex: number) => string | null;
  saveReferenceToLibrary: (outputId: string) => void;
  persistTimeoutMs: number;
  pollIntervalMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultNow = (): number => Date.now();
const defaultSleep = async (ms: number): Promise<void> =>
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

/**
 * Resolves a dropped internal reference to a persisted media/prompt id, autosaving on demand.
 */
export const resolveMediaLibraryInternalDropResolver = async ({
  payload,
  getOutputById,
  getOutputSnapshot,
  resolveSavedMediaIdFromOutput,
  saveReferenceToLibrary,
  persistTimeoutMs,
  pollIntervalMs,
  now = defaultNow,
  sleep = defaultSleep,
}: ResolveMediaLibraryInternalDropArgs): Promise<ResolvedInternalDropItem> => {
  const payloadMediaId = payload.mediaId?.trim() || null;
  if (payloadMediaId) {
    return { kind: "media", id: payloadMediaId };
  }

  const explicitOutputId = (payload.outputId ?? payload.referenceId ?? "").trim();
  let resolvedOutputId = explicitOutputId;
  if (!resolvedOutputId) {
    const droppedReferenceUrl = (payload.referenceUrl ?? "").trim();
    if (droppedReferenceUrl) {
      const snapshot = getOutputSnapshot();
      const candidateIds = [...snapshot.outputOrder, ...snapshot.archivedOutputOrder];
      resolvedOutputId =
        candidateIds.find((candidateId) => {
          const output =
            snapshot.outputById[candidateId] ?? snapshot.archivedOutputById[candidateId];
          if (!output) return false;
          if ((output.previewUrl ?? "").trim() === droppedReferenceUrl) return true;
          return (output.resultUrls ?? []).some(
            (url) => (url ?? "").trim() === droppedReferenceUrl
          );
        }) ?? "";
    }
  }

  if (!resolvedOutputId) return null;

  const imageIndex = Math.max(0, Math.floor(payload.imageIndex ?? 0));
  const initialOutput = getOutputById(resolvedOutputId);
  if (!initialOutput) return null;

  if (initialOutput.mode === "text") {
    const promptId = initialOutput.promptId?.trim() ?? "";
    if (promptId) return { kind: "prompt", id: promptId };
  } else {
    const existingMediaId = resolveSavedMediaIdFromOutput(initialOutput, imageIndex);
    if (existingMediaId) return { kind: "media", id: existingMediaId };
  }

  try {
    saveReferenceToLibrary(resolvedOutputId);
  } catch {
    return null;
  }

  const startedAt = now();
  while (now() - startedAt < persistTimeoutMs) {
    const nextOutput = getOutputById(resolvedOutputId);
    if (!nextOutput) return null;
    if (nextOutput.mode === "text") {
      const promptId = nextOutput.promptId?.trim() ?? "";
      if (promptId) return { kind: "prompt", id: promptId };
    } else {
      const mediaId = resolveSavedMediaIdFromOutput(nextOutput, imageIndex);
      if (mediaId) return { kind: "media", id: mediaId };
    }
    await sleep(pollIntervalMs);
  }

  return null;
};
