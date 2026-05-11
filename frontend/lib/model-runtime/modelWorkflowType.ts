import type { ModelConfig } from "./modelRegistry";

export type AdminModelWorkflowType =
  | "Text to image"
  | "Text + image edit"
  | "Image to image"
  | "Text to video"
  | "Image to video"
  | "Video to video"
  | "Music"
  | "Sound effect"
  | "Voiceover"
  | "Voice changer"
  | "Voice design"
  | "Text to sound"
  | "Sound to sound"
  | "Text to text"
  | "Text"
  | "Multi";

export const getAdminModelWorkflowType = (
  model: Pick<
    ModelConfig,
    "id" | "mediaType" | "supportsTextToImage" | "supportsImageToImage" | "generationLanes"
  >
): AdminModelWorkflowType => {
  const generationLanes = model.generationLanes ?? [];
  const supportsTextToVideo = generationLanes.includes("text-to-video");
  const supportsImageToVideo = generationLanes.includes("image-to-video");
  const supportsMusic = generationLanes.includes("music");
  const supportsSoundEffects = generationLanes.includes("sfx");
  const supportsTextToSpeech = generationLanes.includes("text-to-speech");
  const supportsSpeechToSpeech = generationLanes.includes("speech-to-speech");
  const supportsVoiceDesign = generationLanes.includes("voice-design");

  if (supportsVoiceDesign) {
    return "Voice design";
  }

  if (supportsSpeechToSpeech) {
    return "Voice changer";
  }

  if (supportsTextToSpeech) {
    return "Voiceover";
  }

  if (supportsSoundEffects) {
    return "Sound effect";
  }

  if (supportsMusic) {
    return "Music";
  }

  if (model.supportsTextToImage && model.supportsImageToImage) {
    return "Text + image edit";
  }

  if (model.supportsImageToImage) {
    return "Image to image";
  }

  if (supportsTextToVideo) {
    return "Text to video";
  }

  if (supportsImageToVideo) {
    return "Image to video";
  }

  if (model.supportsTextToImage) {
    return "Text to image";
  }

  switch (model.mediaType) {
    case "image":
      return "Text to image";
    case "video":
      return "Text to video";
    case "image-to-video":
      return "Image to video";
    case "text":
      return "Text to text";
    case "multi":
      return "Multi";
    case "audio":
      return "Text to sound";
    default:
      return "Text";
  }
};
