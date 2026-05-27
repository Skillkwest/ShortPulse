/**
 * Voice changer source drop zone.
 * Provides the UI-only intake surface for one audio/video source clip in the Voices workflow.
 */
import React from "react";
import { CircleNotch, UploadSimple, X } from "phosphor-react";
import {
  extractInternalReferenceDragPayload,
  getNormalizedTransferTypes,
  hasInternalReferenceDragTypeHints,
  normalizeReferenceTransferUrlCandidate,
  type InternalReferenceDragPayload,
} from "../utils/dragDrop";
import { isAudioUrl, isVideoUrl } from "../logic/stateParsers";
import { VoiceChangerAudioSourcePreview } from "./VoiceChangerAudioSourcePreview";
import { AiStudioRecordPanelPrefab } from "./AiStudioRecordPanelPrefab";
import {
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
} from "../../../lib/internalReferenceDragSession";

const AUDIO_EXTENSION_PATTERN = /\.(?:mp3|wav|m4a|aac|flac|ogg|oga)(?:$|[?#])/i;
const VIDEO_EXTENSION_PATTERN = /\.(?:mp4|mov|m4v|webm)(?:$|[?#])/i;
const AUDIO_FILE_PICKER_ACCEPT = "audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.webm";
const AUDIO_VIDEO_FILE_PICKER_ACCEPT =
  "audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.mp4,.mov,.m4v,.webm";
const REMOTE_FETCHABLE_URL_PROTOCOL_PATTERN = /^https?:$/i;

export type VoiceChangerSourceKind = "audio" | "video";
export type VoiceChangerSourceOrigin = "local" | "reference-grid" | "url";
export type VoiceChangerSourceStatus = "uploading" | "extracting" | "ready" | "failed";
type AcceptedVoiceSourceKind = VoiceChangerSourceKind;

export type VoiceChangerSource = {
  id: string;
  kind: VoiceChangerSourceKind;
  origin: VoiceChangerSourceOrigin;
  status: VoiceChangerSourceStatus;
  aspect: string | null;
  durationMs: number | null;
  name: string;
  mimeType: string | null;
  file: File | null;
  previewUrl: string | null;
  sourceUrl: string | null;
  objectUrl: string | null;
  storagePath: string | null;
  referenceOutputId: string | null;
  referenceMediaId: string | null;
  errorMessage: string | null;
  extractedFrom: {
    kind: "video";
    name: string;
    mimeType: string | null;
    previewUrl: string | null;
    sourceUrl: string | null;
    storagePath: string | null;
    aspect: string | null;
    referenceOutputId: string | null;
    referenceMediaId: string | null;
  } | null;
};

export type ResolveVoiceChangerInternalReferenceSource = (
  payload: InternalReferenceDragPayload
) => Promise<VoiceChangerSource | null> | VoiceChangerSource | null;

type VoiceChangerSourceDropzoneProps = {
  source: VoiceChangerSource | null;
  onSourceChange: (nextSource: VoiceChangerSource | null) => void;
  resolveInternalReferenceSource?: ResolveVoiceChangerInternalReferenceSource;
  acceptedKinds?: AcceptedVoiceSourceKind[];
  copy?: Partial<VoiceSourceDropzoneCopy>;
};

type VoiceSourceDropzoneCopy = {
  inputAriaLabel: string;
  dropzoneAriaLabel: string;
  dropzoneCaptionId: string;
  recordPanelAriaLabel: string;
  recordTitle: string;
  recordHelper: string;
  recordButtonIdleAriaLabel: string;
  recordButtonRecordingAriaLabel: string;
  recordIdleCue: string;
  dropTitle: string;
  dropHelper: string;
  caption: string;
  unableReferenceError: string;
  readyTitle: string;
  uploadingAudioTitle: string;
  uploadingVideoTitle: string;
  uploadingAudioDetail: string;
  uploadingVideoDetail: string;
  extractingTitle: string;
  extractingDetail: string;
  failedTitle: string;
  failedFallbackDetail: string;
  extractedFromDetail: (sourceName: string) => string;
};

const defaultVoiceChangerDropzoneCopy: VoiceSourceDropzoneCopy = {
  inputAriaLabel: "Voice changer source file input",
  dropzoneAriaLabel: "Voice changer source drop zone",
  dropzoneCaptionId: "voice-changer-dropzone-caption",
  recordPanelAriaLabel: "Record sample",
  recordTitle: "Record",
  recordHelper: "Record your voice to use as the source for the voice changer.",
  recordButtonIdleAriaLabel: "Record your voice sample",
  recordButtonRecordingAriaLabel: "Stop recording your voice sample",
  recordIdleCue: "Click to record",
  dropTitle: "Drop a source clip",
  dropHelper:
    "Drag one audio or video file from your computer or the Reference Grid. Click to browse.",
  caption: "Accepts MP3, WAV, M4A, AAC, FLAC, OGG, MP4, MOV, M4V, and WEBM.",
  unableReferenceError: "Unable to use this reference as source audio.",
  readyTitle: "Ready for conversion",
  uploadingAudioTitle: "Preparing voice sample",
  uploadingVideoTitle: "Preparing voice sample from video",
  uploadingAudioDetail: "Staging the source audio so it is ready for voice conversion.",
  uploadingVideoDetail: "Staging the video so we can extract a voice sample.",
  extractingTitle: "Extracting voice sample",
  extractingDetail: "Pulling the voice audio out of the staged video.",
  failedTitle: "Source processing failed",
  failedFallbackDetail: "Unable to prepare the selected source.",
  extractedFromDetail: (sourceName) => `Using extracted audio from ${sourceName}.`,
};

type BrowserMediaRecorder = typeof MediaRecorder;
type RecordingFeedback = {
  message: string;
  recoveryHint: string | null;
};
type MicrophonePermissionState = "granted" | "prompt" | "denied" | "unsupported";
type VoiceSourceDropSnapshot = {
  transferTypes: string[];
  files: File[];
  internalReferenceDragToken: string;
  referenceOrigin: string;
  referenceId: string;
  referenceOutputId: string;
  referenceMediaId: string;
  referenceMediaKind: string;
  referencePreviewStoragePath: string;
  referenceFullStoragePath: string;
  referenceSourceSurface: string;
  referenceUrl: string;
  referenceRenderUrl: string;
  imageUrl: string;
  plainText: string;
  uriList: string;
};

const buildSourceId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getUrlFilename = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const parsed = new URL(
      value,
      typeof window === "undefined" ? "https://shortpulse.local" : window.location.href
    );
    const filename = parsed.pathname.split("/").filter(Boolean).pop()?.trim() ?? "";
    return filename || null;
  } catch {
    const segments = value.split("/").filter(Boolean);
    return segments.length ? segments[segments.length - 1] : null;
  }
};

const inferSourceKindFromUrl = (
  value: string | null | undefined
): VoiceChangerSourceKind | null => {
  const normalized = normalizeReferenceTransferUrlCandidate(value, { unwrapNextImage: false });
  if (!normalized) return null;
  if (isAudioUrl(normalized)) return "audio";
  if (isVideoUrl(normalized)) return "video";
  return null;
};

const resolveMimeTypeHintFromUrl = (value: string | null | undefined): string | null => {
  const normalized = normalizeReferenceTransferUrlCandidate(value, { unwrapNextImage: false });
  if (!normalized) return null;
  try {
    const parsed = new URL(
      normalized,
      typeof window === "undefined" ? "https://shortpulse.local" : window.location.href
    );
    const hint =
      parsed.searchParams.get("mimeType") ??
      parsed.searchParams.get("mime") ??
      parsed.searchParams.get("contentType") ??
      parsed.searchParams.get("type") ??
      "";
    const trimmed = hint.trim().toLowerCase();
    return trimmed || null;
  } catch {
    return null;
  }
};

const inferMimeTypeFromUrl = (value: string | null | undefined): string | null => {
  const normalized = normalizeReferenceTransferUrlCandidate(value, { unwrapNextImage: false });
  if (!normalized) return null;
  const mimeTypeHint = resolveMimeTypeHintFromUrl(normalized);
  if (mimeTypeHint?.startsWith("audio/") || mimeTypeHint?.startsWith("video/")) {
    return mimeTypeHint;
  }
  if (/\.mp3(?:$|[?#])/i.test(normalized)) return "audio/mpeg";
  if (/\.wav(?:$|[?#])/i.test(normalized)) return "audio/wav";
  if (/\.m4a(?:$|[?#])/i.test(normalized)) return "audio/mp4";
  if (/\.aac(?:$|[?#])/i.test(normalized)) return "audio/aac";
  if (/\.flac(?:$|[?#])/i.test(normalized)) return "audio/flac";
  if (/\.(?:ogg|oga)(?:$|[?#])/i.test(normalized)) return "audio/ogg";
  if (/\.mp4(?:$|[?#])/i.test(normalized)) return "video/mp4";
  if (/\.mov(?:$|[?#])/i.test(normalized)) return "video/quicktime";
  if (/\.m4v(?:$|[?#])/i.test(normalized)) return "video/x-m4v";
  if (/\.webm(?:$|[?#])/i.test(normalized)) return "video/webm";
  return null;
};

const inferSourceKindFromFile = (file: File): VoiceChangerSourceKind | null => {
  const normalizedType = file.type.trim().toLowerCase();
  if (normalizedType.startsWith("audio/")) return "audio";
  if (normalizedType.startsWith("video/")) return "video";
  if (AUDIO_EXTENSION_PATTERN.test(file.name)) return "audio";
  if (VIDEO_EXTENSION_PATTERN.test(file.name)) return "video";
  return null;
};

export const createVoiceChangerSourceFromFile = (
  file: File,
  options?: {
    origin?: VoiceChangerSourceOrigin;
    referenceOutputId?: string | null;
    referenceMediaId?: string | null;
    durationMs?: number | null;
  }
): VoiceChangerSource | null => {
  const kind = inferSourceKindFromFile(file);
  if (!kind) return null;
  const objectUrl = URL.createObjectURL(file);
  return {
    id: buildSourceId("voice-changer-file"),
    kind,
    origin: options?.origin ?? "local",
    status: "ready",
    aspect: null,
    durationMs: options?.durationMs ?? null,
    name: file.name.trim() || `uploaded-${kind}`,
    mimeType: file.type.trim() || null,
    file,
    previewUrl: kind === "video" ? objectUrl : null,
    sourceUrl: objectUrl,
    objectUrl,
    storagePath: null,
    referenceOutputId: options?.referenceOutputId ?? null,
    referenceMediaId: options?.referenceMediaId ?? null,
    errorMessage: null,
    extractedFrom: null,
  };
};

const resolveRecordingMimeType = (MediaRecorderCtor: BrowserMediaRecorder): string => {
  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of preferredTypes) {
    if (
      typeof MediaRecorderCtor.isTypeSupported === "function" &&
      MediaRecorderCtor.isTypeSupported(type)
    ) {
      return type;
    }
  }
  return "";
};

const resolveRecordingExtension = (mimeType: string): string => {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("mp4")) return "m4a";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("wav")) return "wav";
  return "webm";
};

const resolveRecordingUnavailableFeedback = (): RecordingFeedback => {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return {
      message: "Microphone recording requires HTTPS or localhost.",
      recoveryHint:
        "Open ShortPulse in a secure browser tab, then try recording again. If this still fails, check your browser and system microphone settings.",
    };
  }
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      message: "Recording is not supported in this browser.",
      recoveryHint:
        "Upload an audio file instead, or switch to a browser that supports microphone recording.",
    };
  }
  return {
    message: "This browser cannot record audio here.",
    recoveryHint:
      "Upload an audio file instead, or switch to a browser that supports microphone recording.",
  };
};

const resolveRecordingStartErrorFeedback = (error: unknown): RecordingFeedback => {
  const name =
    typeof (error as { name?: unknown } | null)?.name === "string"
      ? ((error as { name: string }).name || "").trim()
      : "";
  const normalizedName = name.toLowerCase();
  const message =
    typeof (error as { message?: unknown } | null)?.message === "string"
      ? ((error as { message: string }).message || "").trim()
      : "";
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedName === "notallowederror" ||
    normalizedName === "permissiondeniederror" ||
    normalizedName === "securityerror" ||
    /permission|denied|not allowed|disallow/.test(normalizedMessage)
  ) {
    return {
      message: "Microphone access is blocked.",
      recoveryHint:
        "Allow microphone access in your browser's site settings. If it is still blocked, enable ShortPulse in your computer's system microphone settings, then try again.",
    };
  }
  if (
    normalizedName === "notfounderror" ||
    normalizedName === "devicesnotfounderror" ||
    normalizedName === "overconstrainederror" ||
    /no microphone|no audio input|not found|no device/.test(normalizedMessage)
  ) {
    return {
      message: "No microphone was found on this device.",
      recoveryHint: "Connect or enable a microphone, then try recording again.",
    };
  }
  if (
    normalizedName === "notreadableerror" ||
    normalizedName === "trackstarterror" ||
    /not readable|could not start audio source|device in use|hardware error|concurrent mic process limit/.test(
      normalizedMessage
    )
  ) {
    return {
      message: "Your microphone is unavailable or already in use by another app.",
      recoveryHint: "Close other apps that may be using the microphone, then try again.",
    };
  }
  if (normalizedName === "aborterror") {
    return {
      message: "Microphone access was interrupted.",
      recoveryHint:
        "Try recording again. If it keeps happening, refresh the page and recheck your microphone permissions.",
    };
  }
  return {
    message: "Unable to start recording.",
    recoveryHint: "Check your browser and system microphone settings, then try again.",
  };
};

const resolvePermissionPreflightFeedback = (
  permissionState: MicrophonePermissionState,
  idleCue: string
): RecordingFeedback | null => {
  if (permissionState === "denied") {
    return {
      message: "Microphone access is blocked.",
      recoveryHint:
        "Allow microphone access in your browser's site settings. If it is still blocked, enable ShortPulse in your computer's system microphone settings before recording.",
    };
  }
  if (permissionState === "prompt") {
    return {
      message: idleCue,
      recoveryHint: "Your browser will ask for microphone access when you record.",
    };
  }
  return null;
};

const formatRecordingDuration = (valueMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const isAcceptedSourceKind = (
  kind: VoiceChangerSourceKind | null,
  acceptedKinds: AcceptedVoiceSourceKind[]
): kind is VoiceChangerSourceKind => Boolean(kind && acceptedKinds.includes(kind));

const findFirstSupportedFile = (
  files: FileList | File[] | null | undefined,
  acceptedKinds: AcceptedVoiceSourceKind[] = ["audio", "video"]
): File | null => {
  if (!files) return null;
  return (
    Array.from(files).find((file) =>
      isAcceptedSourceKind(inferSourceKindFromFile(file), acceptedKinds)
    ) ?? null
  );
};

const captureVoiceSourceDropSnapshot = (transfer: DataTransfer): VoiceSourceDropSnapshot => ({
  transferTypes: getNormalizedTransferTypes(transfer),
  files: Array.from(transfer.files ?? []),
  internalReferenceDragToken:
    transfer.getData(INTERNAL_REFERENCE_DRAG_SESSION_TYPE) ||
    transfer.getData(INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE),
  referenceOrigin: transfer.getData("text/reference-origin"),
  referenceId: transfer.getData("text/reference-id"),
  referenceOutputId: transfer.getData("text/reference-output-id"),
  referenceMediaId: transfer.getData("text/reference-media-id"),
  referenceMediaKind: transfer.getData("text/reference-media-kind"),
  referencePreviewStoragePath: transfer.getData("text/reference-preview-storage-path"),
  referenceFullStoragePath: transfer.getData("text/reference-full-storage-path"),
  referenceSourceSurface: transfer.getData("text/reference-source-surface"),
  referenceUrl: transfer.getData("text/reference-url"),
  referenceRenderUrl: transfer.getData("text/reference-render-url"),
  imageUrl: transfer.getData("image/url"),
  plainText: transfer.getData("text/plain"),
  uriList: transfer.getData("text/uri-list"),
});

const buildVoiceSourceDropSnapshotTransfer = (snapshot: VoiceSourceDropSnapshot): DataTransfer =>
  ({
    types: snapshot.transferTypes,
    files: snapshot.files,
    getData: (type: string) => {
      switch (type) {
        case INTERNAL_REFERENCE_DRAG_SESSION_TYPE:
        case INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE:
          return snapshot.internalReferenceDragToken;
        case "text/reference-origin":
          return snapshot.referenceOrigin;
        case "text/reference-id":
          return snapshot.referenceId;
        case "text/reference-output-id":
          return snapshot.referenceOutputId;
        case "text/reference-media-id":
          return snapshot.referenceMediaId;
        case "text/reference-media-kind":
          return snapshot.referenceMediaKind;
        case "text/reference-preview-storage-path":
          return snapshot.referencePreviewStoragePath;
        case "text/reference-full-storage-path":
          return snapshot.referenceFullStoragePath;
        case "text/reference-source-surface":
          return snapshot.referenceSourceSurface;
        case "text/reference-url":
          return snapshot.referenceUrl;
        case "text/reference-render-url":
          return snapshot.referenceRenderUrl;
        case "image/url":
          return snapshot.imageUrl;
        case "text/plain":
          return snapshot.plainText;
        case "text/uri-list":
          return snapshot.uriList;
        default:
          return "";
      }
    },
  }) as unknown as DataTransfer;

const hasVoiceSourceDropSnapshotInternalReferenceHints = (
  snapshot: VoiceSourceDropSnapshot
): boolean => {
  const normalizedReferenceUrl = normalizeReferenceTransferUrlCandidate(snapshot.referenceUrl, {
    unwrapNextImage: false,
  });
  const normalizedRenderUrl = normalizeReferenceTransferUrlCandidate(snapshot.referenceRenderUrl, {
    unwrapNextImage: false,
  });

  return Boolean(
    snapshot.internalReferenceDragToken ||
    snapshot.transferTypes.some(
      (type) =>
        type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE.toLowerCase() ||
        type === INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE.toLowerCase() ||
        type === "text/reference-origin" ||
        type === "text/reference-id" ||
        type === "text/reference-output-id" ||
        type === "text/reference-media-id" ||
        type === "text/reference-source-surface" ||
        type === "text/reference-url" ||
        type === "text/reference-render-url"
    ) ||
    snapshot.referenceOrigin.trim() ||
    snapshot.referenceId.trim() ||
    snapshot.referenceOutputId.trim() ||
    snapshot.referenceMediaId.trim() ||
    snapshot.referenceSourceSurface.trim() ||
    normalizedReferenceUrl ||
    normalizedRenderUrl
  );
};

const isLikelyNativeFileTransfer = (
  transfer: DataTransfer,
  acceptedKinds: AcceptedVoiceSourceKind[] = ["audio", "video"]
): boolean => {
  if (findFirstSupportedFile(transfer.files, acceptedKinds)) return true;

  const transferItems = Array.from(transfer.items ?? []);
  if (
    transferItems.some((item) => {
      if (item.kind !== "file") return false;
      const normalizedType = item.type.trim().toLowerCase();
      return (
        !normalizedType ||
        (acceptedKinds.includes("audio") && normalizedType.startsWith("audio/")) ||
        (acceptedKinds.includes("video") && normalizedType.startsWith("video/"))
      );
    })
  ) {
    return true;
  }

  return Array.from(transfer.types ?? []).some(
    (type) => type === "Files" || type === "application/x-moz-file"
  );
};

export const createVoiceChangerSourceFromReference = ({
  kind,
  origin,
  name,
  mimeType,
  sourceUrl,
  previewUrl = null,
  storagePath = null,
  durationMs = null,
  aspect = null,
  referenceOutputId = null,
  referenceMediaId = null,
}: {
  kind: VoiceChangerSourceKind;
  origin: VoiceChangerSourceOrigin;
  name: string;
  mimeType?: string | null;
  sourceUrl?: string | null;
  previewUrl?: string | null;
  storagePath?: string | null;
  durationMs?: number | null;
  aspect?: string | null;
  referenceOutputId?: string | null;
  referenceMediaId?: string | null;
}): VoiceChangerSource | null => {
  const normalizedUrl = normalizeReferenceTransferUrlCandidate(sourceUrl, {
    unwrapNextImage: false,
  });
  if (normalizedUrl && /^(?:blob:|data:)/i.test(normalizedUrl)) return null;
  if (normalizedUrl) {
    try {
      const parsed = new URL(
        normalizedUrl,
        typeof window === "undefined" ? "https://shortpulse.local" : window.location.href
      );
      if (!REMOTE_FETCHABLE_URL_PROTOCOL_PATTERN.test(parsed.protocol)) {
        return null;
      }
    } catch {
      return null;
    }
  }
  const normalizedStoragePath = storagePath?.trim() || null;
  if (!normalizedUrl && !normalizedStoragePath) return null;
  const normalizedPreviewUrl =
    kind === "video"
      ? normalizeReferenceTransferUrlCandidate(previewUrl ?? normalizedUrl, {
          unwrapNextImage: false,
        })
      : null;
  return {
    id: buildSourceId("voice-changer-reference"),
    kind,
    origin,
    status: "ready",
    aspect,
    durationMs,
    name: name.trim() || `Reference Grid ${kind}`,
    mimeType: mimeType?.trim() || (normalizedUrl ? inferMimeTypeFromUrl(normalizedUrl) : null),
    file: null,
    previewUrl: normalizedPreviewUrl,
    sourceUrl: normalizedUrl,
    objectUrl: null,
    storagePath: normalizedStoragePath,
    referenceOutputId,
    referenceMediaId,
    errorMessage: null,
    extractedFrom: null,
  };
};

const createSourceFromUrl = ({
  url,
  origin,
  fallbackName,
  referenceOutputId = null,
  referenceMediaId = null,
  acceptedKinds = ["audio", "video"],
}: {
  url: string;
  origin: VoiceChangerSourceOrigin;
  fallbackName: string;
  referenceOutputId?: string | null;
  referenceMediaId?: string | null;
  acceptedKinds?: AcceptedVoiceSourceKind[];
}): VoiceChangerSource | null => {
  const normalizedUrl = normalizeReferenceTransferUrlCandidate(url, { unwrapNextImage: false });
  if (!normalizedUrl || /^(?:blob:|data:)/i.test(normalizedUrl)) return null;
  const kind = inferSourceKindFromUrl(normalizedUrl);
  if (!isAcceptedSourceKind(kind, acceptedKinds)) return null;
  const filename = getUrlFilename(normalizedUrl);
  const source = createVoiceChangerSourceFromReference({
    kind,
    origin,
    name: filename ?? fallbackName,
    sourceUrl: normalizedUrl,
    referenceOutputId,
    referenceMediaId,
  });
  return source ? { ...source, id: buildSourceId("voice-changer-url") } : null;
};

const createSourceFromInternalPayload = (
  payload: InternalReferenceDragPayload,
  acceptedKinds: AcceptedVoiceSourceKind[] = ["audio", "video"]
): VoiceChangerSource | null => {
  const storagePath = payload.fullStoragePath?.trim() || payload.previewStoragePath?.trim() || null;
  const referenceUrl = normalizeReferenceTransferUrlCandidate(payload.referenceUrl, {
    unwrapNextImage: false,
  });
  const renderUrl = normalizeReferenceTransferUrlCandidate(payload.referenceRenderUrl, {
    unwrapNextImage: false,
  });
  const kind =
    payload.mediaKind === "audio" || payload.mediaKind === "video"
      ? payload.mediaKind
      : inferSourceKindFromUrl(referenceUrl ?? renderUrl);
  if (!isAcceptedSourceKind(kind, acceptedKinds)) return null;

  const remoteSourceUrl = [referenceUrl, renderUrl].find(
    (candidate): candidate is string =>
      typeof candidate === "string" &&
      !/^(?:blob:|data:)/i.test(candidate) &&
      inferSourceKindFromUrl(candidate) === kind
  );
  const previewUrl =
    kind === "video"
      ? normalizeReferenceTransferUrlCandidate(renderUrl ?? referenceUrl, {
          unwrapNextImage: false,
        })
      : null;
  const fallbackName =
    getUrlFilename(remoteSourceUrl ?? previewUrl) ?? `Reference Grid ${kind} source`;

  return createVoiceChangerSourceFromReference({
    kind,
    origin: "reference-grid",
    name: fallbackName,
    sourceUrl: remoteSourceUrl ?? null,
    previewUrl,
    storagePath,
    referenceOutputId: payload.outputId,
    referenceMediaId: payload.mediaId,
  });
};

const createSourceFromTransfer = (
  transfer: DataTransfer,
  acceptedKinds: AcceptedVoiceSourceKind[] = ["audio", "video"],
  options?: {
    skipFiles?: boolean;
  }
): VoiceChangerSource | null => {
  const internalPayload = extractInternalReferenceDragPayload(transfer);
  if (internalPayload) {
    const internalSource = createSourceFromInternalPayload(internalPayload, acceptedKinds);
    if (internalSource) return internalSource;
  }

  if (!options?.skipFiles) {
    const supportedFile = findFirstSupportedFile(transfer.files, acceptedKinds);
    if (supportedFile) {
      return createVoiceChangerSourceFromFile(supportedFile);
    }
  }

  const urlCandidates = [
    transfer.getData("text/reference-render-url"),
    transfer.getData("text/reference-url"),
    transfer
      .getData("text/uri-list")
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value && !value.startsWith("#")) ?? "",
    transfer.getData("text/plain"),
  ];
  for (const candidate of urlCandidates) {
    const source = createSourceFromUrl({
      url: candidate,
      origin: "url",
      fallbackName: "Linked media source",
      acceptedKinds,
    });
    if (source) return source;
  }

  return null;
};

const canAcceptTransfer = (
  transfer: DataTransfer | null | undefined,
  canResolveInternalReference = false,
  acceptedKinds: AcceptedVoiceSourceKind[] = ["audio", "video"]
): boolean => {
  if (!transfer) return false;
  const snapshot = captureVoiceSourceDropSnapshot(transfer);
  const transferSnapshot = buildVoiceSourceDropSnapshotTransfer(snapshot);
  const hasInternalReferenceHints = hasVoiceSourceDropSnapshotInternalReferenceHints(snapshot);
  if (hasInternalReferenceHints) {
    if (canResolveInternalReference && hasInternalReferenceDragTypeHints(transferSnapshot))
      return true;
    return Boolean(
      createSourceFromTransfer(transferSnapshot, acceptedKinds, {
        skipFiles: true,
      })
    );
  }
  if (isLikelyNativeFileTransfer(transfer, acceptedKinds)) return true;
  if (canResolveInternalReference && hasInternalReferenceDragTypeHints(transferSnapshot))
    return true;
  return Boolean(createSourceFromTransfer(transferSnapshot, acceptedKinds));
};

/**
 * Revokes any owned local object URL for a selected voice changer source.
 */
export const releaseVoiceChangerSource = (source: VoiceChangerSource | null): void => {
  if (!source?.objectUrl) return;
  URL.revokeObjectURL(source.objectUrl);
};

const resolveSourceStatusTitle = (
  source: VoiceChangerSource,
  copy: VoiceSourceDropzoneCopy
): string => {
  if (source.status === "uploading") {
    return source.kind === "video" ? copy.uploadingVideoTitle : copy.uploadingAudioTitle;
  }
  if (source.status === "extracting") return copy.extractingTitle;
  if (source.status === "failed") return copy.failedTitle;
  return copy.readyTitle;
};

const resolveSourceStatusDetail = (
  source: VoiceChangerSource,
  copy: VoiceSourceDropzoneCopy
): string | null => {
  if (source.status === "uploading") {
    return source.kind === "video" ? copy.uploadingVideoDetail : copy.uploadingAudioDetail;
  }
  if (source.status === "extracting") {
    return copy.extractingDetail;
  }
  if (source.status === "failed") {
    return source.errorMessage ?? copy.failedFallbackDetail;
  }
  if (source.extractedFrom) {
    return copy.extractedFromDetail(source.extractedFrom.name);
  }
  return null;
};

const shouldShowSourceStatusSpinner = (source: VoiceChangerSource): boolean =>
  source.status === "uploading" || source.status === "extracting";

const shouldShowSourceLoadingPreview = (source: VoiceChangerSource): boolean =>
  source.status === "uploading" || source.status === "extracting";

/**
 * Renders the voice changer source intake surface for one audio/video file.
 */
export function VoiceChangerSourceDropzone({
  source,
  onSourceChange,
  resolveInternalReferenceSource,
  acceptedKinds = ["audio", "video"],
  copy: copyOverrides,
}: VoiceChangerSourceDropzoneProps) {
  const copy = React.useMemo(
    () => ({ ...defaultVoiceChangerDropzoneCopy, ...copyOverrides }),
    [copyOverrides]
  );
  const acceptsAudioOnly = acceptedKinds.length === 1 && acceptedKinds[0] === "audio";
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const dragDepthRef = React.useRef(0);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recorderStreamRef = React.useRef<MediaStream | null>(null);
  const recordingChunksRef = React.useRef<BlobPart[]>([]);
  const recordingStartedAtRef = React.useRef<number | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = React.useState(false);
  const [microphonePermissionState, setMicrophonePermissionState] =
    React.useState<MicrophonePermissionState>("unsupported");
  const [recordingElapsedMs, setRecordingElapsedMs] = React.useState(0);
  const [recordingError, setRecordingError] = React.useState<string | null>(null);
  const [recordingRecoveryHint, setRecordingRecoveryHint] = React.useState<string | null>(null);

  const openFilePicker = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSourceSelection = React.useCallback(
    (nextSource: VoiceChangerSource | null) => {
      if (!nextSource) return;
      if (!acceptedKinds.includes(nextSource.kind)) {
        setRecordingError(copy.unableReferenceError);
        setRecordingRecoveryHint(null);
        return;
      }
      setRecordingError(null);
      setRecordingRecoveryHint(null);
      onSourceChange(nextSource);
    },
    [acceptedKinds, copy.unableReferenceError, onSourceChange]
  );

  const stopRecorderStream = React.useCallback(() => {
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    recorderStreamRef.current = null;
  }, []);

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const supportedFile = findFirstSupportedFile(event.target.files, acceptedKinds);
      if (supportedFile) {
        handleSourceSelection(createVoiceChangerSourceFromFile(supportedFile));
      }
      event.target.value = "";
    },
    [acceptedKinds, handleSourceSelection]
  );

  const canResolveInternalReference = Boolean(resolveInternalReferenceSource);

  const handleDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference, acceptedKinds)) {
        return;
      }
      dragDepthRef.current += 1;
      setIsDragActive(true);
    },
    [acceptedKinds, canResolveInternalReference]
  );

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference, acceptedKinds)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setIsDragActive(true);
    },
    [acceptedKinds, canResolveInternalReference]
  );

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference, acceptedKinds)) {
        return;
      }
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragActive(false);
      }
    },
    [acceptedKinds, canResolveInternalReference]
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference, acceptedKinds)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragActive(false);

      const dropSnapshot = captureVoiceSourceDropSnapshot(event.dataTransfer);
      const transferSnapshot = buildVoiceSourceDropSnapshotTransfer(dropSnapshot);
      const internalPayload = extractInternalReferenceDragPayload(transferSnapshot);
      const hasInternalReferenceHints =
        hasVoiceSourceDropSnapshotInternalReferenceHints(dropSnapshot);
      const directSource = createSourceFromTransfer(transferSnapshot, acceptedKinds, {
        skipFiles: hasInternalReferenceHints,
      });

      if (!internalPayload || !resolveInternalReferenceSource) {
        if (directSource) {
          handleSourceSelection(directSource);
          return;
        }
        setRecordingError(copy.unableReferenceError);
        return;
      }

      void (async () => {
        try {
          const resolvedSource = await resolveInternalReferenceSource(internalPayload);
          if (resolvedSource && acceptedKinds.includes(resolvedSource.kind)) {
            handleSourceSelection(resolvedSource);
            return;
          }
          if (directSource) {
            handleSourceSelection(directSource);
            return;
          }
          setRecordingError(copy.unableReferenceError);
        } catch {
          if (directSource) {
            handleSourceSelection(directSource);
            return;
          }
          setRecordingError(copy.unableReferenceError);
        }
      })();
    },
    [
      acceptedKinds,
      canResolveInternalReference,
      copy.unableReferenceError,
      handleSourceSelection,
      resolveInternalReferenceSource,
    ]
  );

  const handleEmptyZoneKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (source) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openFilePicker();
    },
    [openFilePicker, source]
  );

  React.useEffect(() => {
    if (!isRecording) {
      setRecordingElapsedMs(0);
      return;
    }
    const timer = window.setInterval(() => {
      if (recordingStartedAtRef.current == null) return;
      setRecordingElapsedMs(Date.now() - recordingStartedAtRef.current);
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [isRecording]);

  React.useEffect(() => {
    return () => {
      recorderRef.current?.stop?.();
      recorderRef.current = null;
      stopRecorderStream();
    };
  }, [stopRecorderStream]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }
    if (!navigator.permissions?.query) {
      setMicrophonePermissionState("unsupported");
      return;
    }

    let isActive = true;
    let permissionStatus: PermissionStatus | null = null;
    const applyPermissionState = (value: string) => {
      if (!isActive) return;
      if (value === "granted" || value === "prompt" || value === "denied") {
        setMicrophonePermissionState(value);
        return;
      }
      setMicrophonePermissionState("unsupported");
    };

    void navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        permissionStatus = status;
        applyPermissionState(status.state);
        status.onchange = () => applyPermissionState(status.state);
      })
      .catch(() => {
        if (isActive) {
          setMicrophonePermissionState("unsupported");
        }
      });

    return () => {
      isActive = false;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  const permissionPreflightFeedback = React.useMemo(
    () => resolvePermissionPreflightFeedback(microphonePermissionState, copy.recordIdleCue),
    [copy.recordIdleCue, microphonePermissionState]
  );

  const handleRecordSampleClick = React.useCallback(async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setIsRequestingPermission(false);
      const feedback = resolveRecordingUnavailableFeedback();
      setRecordingError(feedback.message);
      setRecordingRecoveryHint(feedback.recoveryHint);
      return;
    }

    setRecordingError(null);
    setRecordingRecoveryHint(null);
    setIsRequestingPermission(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRequestingPermission(false);
      recorderStreamRef.current = stream;
      const mimeType = resolveRecordingMimeType(MediaRecorder);
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecordingError("Unable to record audio right now.");
        setRecordingRecoveryHint(
          "Check your browser and system microphone settings, then try again."
        );
        setIsRequestingPermission(false);
        setIsRecording(false);
        recorderRef.current = null;
        recordingChunksRef.current = [];
        stopRecorderStream();
      };

      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || mimeType || "audio/webm";
        const recordedBlob = new Blob(recordingChunksRef.current, { type: recordedMimeType });
        recordingChunksRef.current = [];
        recorderRef.current = null;
        setIsRecording(false);
        stopRecorderStream();

        if (!recordedBlob.size) {
          setRecordingError("No audio was captured.");
          setRecordingRecoveryHint("Try again and speak after the recording indicator turns on.");
          return;
        }

        const extension = resolveRecordingExtension(recordedMimeType);
        const file = new File([recordedBlob], `voice-sample-${Date.now()}.${extension}`, {
          type: recordedMimeType,
        });
        handleSourceSelection(createVoiceChangerSourceFromFile(file));
      };

      recordingStartedAtRef.current = Date.now();
      setRecordingElapsedMs(0);
      setIsRecording(true);
      recorder.start();
    } catch (error) {
      stopRecorderStream();
      setIsRequestingPermission(false);
      setIsRecording(false);
      setRecordingElapsedMs(0);
      const feedback = resolveRecordingStartErrorFeedback(error);
      setRecordingError(feedback.message);
      setRecordingRecoveryHint(feedback.recoveryHint);
    }
  }, [handleSourceSelection, isRecording, stopRecorderStream]);

  return (
    <div className="voices-properties-voice-changer-dropzone-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptsAudioOnly ? AUDIO_FILE_PICKER_ACCEPT : AUDIO_VIDEO_FILE_PICKER_ACCEPT}
        className="voices-properties-voice-changer-file-input"
        onChange={handleInputChange}
        aria-label={copy.inputAriaLabel}
        aria-hidden="true"
        tabIndex={-1}
      />

      {source ? (
        <div
          className={`voices-properties-voice-changer-dropzone has-source ${
            isDragActive ? "is-drag-active" : ""
          }`.trim()}
          role="group"
          aria-label={copy.dropzoneAriaLabel}
          aria-describedby={copy.dropzoneCaptionId}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="voices-properties-voice-changer-dropzone-preview">
            {shouldShowSourceLoadingPreview(source) ? (
              <div
                className="voices-properties-voice-changer-dropzone-loading-preview"
                role="status"
                aria-live="polite"
                aria-label={resolveSourceStatusTitle(source, copy)}
              >
                <span
                  className="voices-properties-voice-changer-dropzone-loading-spinner"
                  aria-hidden="true"
                >
                  <CircleNotch size={34} weight="bold" />
                </span>
              </div>
            ) : source.kind === "video" && source.previewUrl ? (
              <video
                className="voices-properties-voice-changer-dropzone-video"
                src={source.previewUrl}
                playsInline
                muted
                preload="metadata"
              />
            ) : source.kind === "audio" && source.sourceUrl ? (
              <div className="voices-properties-voice-changer-dropzone-audio-preview">
                <VoiceChangerAudioSourcePreview key={source.id} audioUrl={source.sourceUrl} />
              </div>
            ) : (
              <div className="voices-properties-voice-changer-dropzone-audio-preview" />
            )}
          </div>

          <div className="voices-properties-voice-changer-dropzone-meta">
            <div className="voices-properties-voice-changer-dropzone-copy">
              <div className="voices-properties-voice-changer-dropzone-title-row">
                {shouldShowSourceStatusSpinner(source) ? (
                  <span
                    className="voices-properties-voice-changer-dropzone-spinner"
                    aria-hidden="true"
                  >
                    <CircleNotch size={16} weight="bold" />
                  </span>
                ) : null}
                <p className="voices-properties-voice-changer-dropzone-title">
                  {resolveSourceStatusTitle(source, copy)}
                </p>
              </div>
              {resolveSourceStatusDetail(source, copy) ? (
                <p
                  className={`voices-properties-voice-changer-dropzone-helper${
                    source.status === "failed" ? " is-error" : ""
                  }`}
                >
                  {resolveSourceStatusDetail(source, copy)}
                </p>
              ) : null}
            </div>

            <div className="voices-properties-voice-changer-dropzone-actions">
              <button
                type="button"
                className="voices-properties-voice-changer-dropzone-action"
                onClick={openFilePicker}
                disabled={source.status === "uploading" || source.status === "extracting"}
              >
                Replace
              </button>
              <button
                type="button"
                className="voices-properties-voice-changer-dropzone-action is-secondary"
                onClick={() => onSourceChange(null)}
              >
                <X size={14} weight="bold" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="voices-properties-voice-changer-intake-grid">
          <AiStudioRecordPanelPrefab
            panelAriaLabel={copy.recordPanelAriaLabel}
            title={copy.recordTitle}
            helper={copy.recordHelper}
            buttonIdleAriaLabel={copy.recordButtonIdleAriaLabel}
            buttonRecordingAriaLabel={copy.recordButtonRecordingAriaLabel}
            idleCue={copy.recordIdleCue}
            isRecording={isRecording}
            isBusy={isRequestingPermission}
            statusMessage={
              recordingError ||
              (isRequestingPermission
                ? "Waiting for microphone permission..."
                : isRecording
                  ? `Recording ${formatRecordingDuration(recordingElapsedMs)}`
                  : (permissionPreflightFeedback?.message ?? null))
            }
            recoveryHint={
              recordingError
                ? recordingRecoveryHint
                : !isRecording && !isRequestingPermission
                  ? (permissionPreflightFeedback?.recoveryHint ?? null)
                  : null
            }
            isError={Boolean(recordingError) || microphonePermissionState === "denied"}
            onClick={handleRecordSampleClick}
          />

          <div className="voices-properties-voice-changer-intake-divider" aria-hidden="true">
            OR
          </div>

          <div
            className={`voices-properties-voice-changer-dropzone is-empty ${
              isDragActive ? "is-drag-active" : ""
            }`.trim()}
            role="button"
            aria-label={copy.dropzoneAriaLabel}
            aria-describedby={copy.dropzoneCaptionId}
            tabIndex={0}
            onClick={openFilePicker}
            onKeyDown={handleEmptyZoneKeyDown}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="voices-properties-voice-changer-dropzone-empty-state">
              <div className="voices-properties-voice-changer-dropzone-empty-icon">
                <UploadSimple size={30} weight="bold" />
              </div>
              <div className="voices-properties-voice-changer-dropzone-empty-copy">
                <p className="voices-properties-voice-changer-dropzone-title">{copy.dropTitle}</p>
                <p className="voices-properties-voice-changer-dropzone-helper">{copy.dropHelper}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <p id={copy.dropzoneCaptionId} className="voices-properties-voice-changer-dropzone-caption">
        {copy.caption}
      </p>
    </div>
  );
}
