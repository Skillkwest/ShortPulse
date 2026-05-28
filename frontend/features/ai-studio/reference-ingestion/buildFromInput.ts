/**
 * Reference ingestion adapter.
 * Converts all supported ingestion inputs (file picker, drop, paste, media-library, agent)
 * into canonical StudioOutput records while preserving existing behavior.
 */
import type { StudioOutput } from "../types";
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { isAudioUrl, isVideoUrl, mapUploadsFromFiles } from "../logic/stateParsers";
import type {
  ReferenceIngestionContext,
  ReferenceIngestionInput,
  ReferenceIngestionResult,
} from "./types";

const resolveNowIso = (context: ReferenceIngestionContext): string =>
  typeof context.nowIso === "function" ? context.nowIso() : new Date().toISOString();

const buildPromptReferenceOutput = ({
  id,
  promptText,
  createdAt,
  timestamp,
  context,
  status,
  promptId,
}: {
  id: string;
  promptText: string;
  createdAt?: string | null;
  timestamp: string;
  context: ReferenceIngestionContext;
  status?: StudioOutput["status"];
  promptId?: string;
}): StudioOutput => {
  const placeholderModelLabel = context.model
    ? context.resolveModelLabel(context.model)
    : "Model pending selection";

  return {
    id,
    prompt: promptText,
    mode: "text",
    aspect: context.aspect,
    model: placeholderModelLabel,
    createdAt: createdAt ?? resolveNowIso(context),
    modelId: context.model ?? undefined,
    status: status ?? "ready",
    timestamp,
    previewText: promptText,
    mediaSource: "prompt",
    previewTier: "full",
    archivedAt: null,
    archiveReason: null,
    saveState: "idle",
    saveError: null,
    promptId,
  };
};

const buildPastedMediaOutput = ({
  id,
  url,
  mimeType,
  context,
}: {
  id: string;
  url: string;
  mimeType?: string | null;
  context: ReferenceIngestionContext;
}): StudioOutput => {
  const isAudio = mimeType?.startsWith("audio/") || (!mimeType && isAudioUrl(url));
  const isVideo = !isAudio && (mimeType?.startsWith("video/") || (!mimeType && isVideoUrl(url)));
  const placeholderModelLabel = context.model
    ? context.resolveModelLabel(context.model)
    : "Model pending selection";
  const parsedFilename = (() => {
    if (/^data:/i.test(url)) return null;
    try {
      const path = new URL(url).pathname;
      const segment = path.split("/").pop();
      return segment ? decodeURIComponent(segment) : null;
    } catch {
      return null;
    }
  })();

  return {
    id,
    prompt:
      parsedFilename ?? (isAudio ? "Pasted audio" : isVideo ? "Pasted video" : "Pasted image"),
    mode: isAudio ? "audio" : isVideo ? "video" : "image",
    aspect: context.aspect,
    model: placeholderModelLabel,
    createdAt: resolveNowIso(context),
    modelId: context.model ?? undefined,
    status: "ready",
    timestamp: "Clipboard",
    previewUrl: url,
    mediaSource: "clipboard",
    previewTier: isVideo ? "preview_loop" : "full",
    fullStoragePath: null,
    previewStoragePath: null,
    archivedAt: null,
    archiveReason: null,
    saveState: "idle",
    saveError: null,
    mimeType: mimeType ?? null,
  };
};

const buildLibraryMediaOutput = ({
  payload,
  context,
}: {
  payload: Extract<ReferenceIngestionInput, { kind: "libraryMedia" }>["payload"];
  context: ReferenceIngestionContext;
}): StudioOutput | null => {
  const cleanedUrl = payload.url?.trim();
  if (!cleanedUrl) return null;

  const id = `library-${context.randomId()}`;
  const filenameLabel = payload.filename?.trim() || "";
  const fallbackModelLabel = context.model
    ? context.resolveModelLabel(context.model)
    : "Library media";
  const displayModelLabel = filenameLabel || fallbackModelLabel;
  const resolvedPromptText =
    payload.promptText?.trim() || payload.filename?.trim() || "Media reference";
  const previewUrl = payload.previewUrl?.trim() || cleanedUrl;
  const fullUrl = payload.fullUrl?.trim() || cleanedUrl;
  const previewStoragePath = asCanonicalStoragePath(payload.previewStoragePath);
  const previewPosterStoragePath =
    payload.fileType === "video" ? asCanonicalStoragePath(payload.previewPosterStoragePath) : null;
  const fullStoragePath = asCanonicalStoragePath(payload.fullStoragePath) ?? previewStoragePath;
  const previewPosterUrl =
    payload.fileType === "video" ? payload.previewPosterUrl?.trim() || null : null;
  const companionArtUrl =
    payload.fileType === "audio" ? payload.companionArtUrl?.trim() || null : null;
  const companionArtStoragePath =
    payload.fileType === "audio" ? asCanonicalStoragePath(payload.companionArtStoragePath) : null;
  const resultUrls = fullUrl ? [fullUrl] : undefined;
  const referenceGridCreatedAt = resolveNowIso(context);

  return {
    id,
    prompt: resolvedPromptText,
    transcriptText: payload.transcriptText?.trim() || null,
    mode: payload.fileType === "audio" ? "audio" : payload.fileType === "video" ? "video" : "image",
    aspect: context.aspect,
    model: displayModelLabel,
    // Reference Grid ordering is based on when an item enters the grid, not when
    // the backing Media Library row or generation was originally created.
    createdAt: referenceGridCreatedAt,
    status: "ready",
    timestamp: payload.source === "ai_studio" ? "Generation" : "Library",
    previewUrl,
    resultUrls,
    previewStoragePath,
    previewPosterStoragePath,
    fullStoragePath,
    previewPosterUrl,
    companionArtUrl,
    companionArtStoragePath,
    audioSourceMode: payload.fileType === "audio" ? (payload.audioSourceMode ?? null) : null,
    durationMs: payload.durationMs ?? null,
    waveformPeaks: Array.isArray(payload.waveformPeaks) ? payload.waveformPeaks : null,
    mediaSource: payload.source === "ai_studio" ? "generated" : "library",
    previewTier:
      payload.fileType === "video"
        ? "preview_loop"
        : payload.fileType === "audio"
          ? "full"
          : "thumb",
    archivedAt: null,
    archiveReason: null,
    saveState: payload.id ? "saved" : "idle",
    saveError: null,
    savedMediaIds: payload.id ? [payload.id] : undefined,
  };
};

/**
 * Canonical synchronous ingestion adapter for non-file inputs.
 * File inputs are intentionally unsupported in this sync path.
 */
export const buildStudioOutputsFromReferenceInputSync = (
  input: ReferenceIngestionInput,
  context: ReferenceIngestionContext
): ReferenceIngestionResult => {
  switch (input.kind) {
    case "files":
      throw new Error("buildStudioOutputsFromReferenceInputSync does not support file inputs.");

    case "prompt": {
      const cleanedPrompt = input.promptText?.trim();
      if (!cleanedPrompt) return { outputs: [] };
      if (input.source === "agent") {
        return {
          outputs: [
            buildPromptReferenceOutput({
              id: `prompt-${context.randomId()}`,
              promptText: cleanedPrompt,
              createdAt: resolveNowIso(context),
              timestamp: "Agent",
              context,
            }),
          ],
        };
      }
      return {
        outputs: [
          buildPromptReferenceOutput({
            id: `prompt-paste-${context.randomId()}`,
            promptText: cleanedPrompt,
            createdAt: resolveNowIso(context),
            timestamp: "Clipboard",
            context,
          }),
        ],
      };
    }

    case "mediaUrl": {
      const cleanedUrl = input.url?.trim();
      if (!cleanedUrl) return { outputs: [] };
      return {
        outputs: [
          buildPastedMediaOutput({
            id: `media-paste-${context.randomId()}`,
            url: cleanedUrl,
            mimeType: input.mimeType,
            context,
          }),
        ],
      };
    }

    case "libraryMedia": {
      const output = buildLibraryMediaOutput({
        payload: input.payload,
        context,
      });
      return { outputs: output ? [output] : [] };
    }

    case "libraryPrompt": {
      const cleanedPrompt = input.payload.promptText?.trim();
      if (!cleanedPrompt) return { outputs: [] };
      return {
        outputs: [
          buildPromptReferenceOutput({
            id: `prompt-library-${context.randomId()}`,
            promptText: cleanedPrompt,
            // Prompt references follow the same right-rail ordering contract as media:
            // newest grid additions appear first regardless of original library save time.
            createdAt: resolveNowIso(context),
            timestamp: "Library",
            context,
            status: "saved",
            promptId: input.payload.id,
          }),
        ],
      };
    }

    default:
      return { outputs: [] };
  }
};

/**
 * Canonical ingestion adapter that maps one ingestion input to one or more outputs.
 */
export const buildStudioOutputsFromReferenceInput = async (
  input: ReferenceIngestionInput,
  context: ReferenceIngestionContext
): Promise<ReferenceIngestionResult> => {
  if (input.kind === "files") {
    const result =
      typeof context.nowIso === "function"
        ? await mapUploadsFromFiles(
            input.files,
            context.mode,
            context.aspect,
            context.model,
            context.resolveModelLabel,
            context.randomId,
            context.nowIso,
            input.source
          )
        : await mapUploadsFromFiles(
            input.files,
            context.mode,
            context.aspect,
            context.model,
            context.resolveModelLabel,
            context.randomId,
            input.source
          );
    return result;
  }
  return buildStudioOutputsFromReferenceInputSync(input, context);
};
