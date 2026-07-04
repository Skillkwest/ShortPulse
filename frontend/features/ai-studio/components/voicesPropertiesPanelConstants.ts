/**
 * Static Voices panel copy, limits, and display helpers.
 */
import type { CSSProperties } from "react";

export const voicePromptPlaceholder =
  "Enter the prompt used to generate this voice: tone, age, and delivery.";
export const voiceScriptPlaceholder =
  "Paste or write the script that will be spoken with this voice.";
export const createVoiceDefaultName = "";

export const maxVoicePromptCharacters = 1000;
export const minVoicePromptCharacters = 20;
export const maxVoiceScriptCharacters = 5000;
export const voiceLoadingSkeletonCount = 12;
export const maxVoicePromptHeightPx = 264;
export const minVoiceoverTopSectionHeightPx = 72;
export const minVoiceoverBottomSectionHeightPx = 240;
export const minVoiceChangerTopSectionHeightPx = 120;
export const minVoiceChangerBottomSectionHeightPx = 600;
export const maxVoiceChangerBottomSectionHeightPx = 600;
export const fixedVoiceChangerBottomSectionHeightPx = 600;

export const cloneVoiceSourceDropzoneCopy = {
  inputAriaLabel: "Voice clone source file input",
  dropzoneAriaLabel: "Voice clone source drop zone",
  dropzoneCaptionId: "voice-clone-dropzone-caption",
  recordPanelAriaLabel: "Record voice sample",
  recordTitle: "Record",
  recordHelper: "Record a voice sample to create a cloned voice.",
  recordButtonIdleAriaLabel: "Record your voice sample",
  recordButtonRecordingAriaLabel: "Stop recording your voice sample",
  dropTitle: "Drop a voice sample",
  dropHelper: "Drag one audio file from your computer or the Reference Grid. Click to browse.",
  caption: "Accepts MP3, WAV, M4A, AAC, FLAC, OGG, and WEBM.",
  unableReferenceError: "Unable to use this reference as a voice clone sample.",
  readyTitle: "Ready to clone",
  uploadingAudioDetail: "Staging the voice sample so it is ready for cloning.",
  failedFallbackDetail: "Unable to prepare the selected voice sample.",
};

export const loadedVoiceArrowInlineStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "54px",
  flexShrink: 0,
  alignSelf: "center",
  color: "rgba(114, 243, 217, 0.98)",
  fontSize: "44px",
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: "-0.08em",
  textShadow: "0 0 18px rgba(80, 226, 205, 0.3), 0 0 32px rgba(80, 226, 205, 0.18)",
  transform: "translateY(1px)",
};

export const loadedVoiceValueInlineStyle: CSSProperties = {
  color: "rgba(239, 255, 252, 1)",
  textShadow: "0 0 16px rgba(105, 220, 203, 0.28)",
};

export const buildVoiceDesignPreviewAudioSrc = (
  audioBase64: string,
  mediaType: string | null | undefined
): string => `data:${mediaType?.trim() || "audio/mpeg"};base64,${audioBase64}`;

export const buildDesignedPreviewInstanceKey = (previewId: string): string =>
  `voices:designed-preview:${previewId}`;

export const getVoiceChipDisplayName = (voiceName: string): string => {
  const trimmedName = voiceName.trim();
  if (!trimmedName) return "";
  return trimmedName.split(/\s*(?::|[—–-])\s*/u, 1)[0] ?? trimmedName;
};
