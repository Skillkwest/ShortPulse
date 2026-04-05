import type { StudioOutput } from "../types";
import {
  hasDurableGenerationIdentity,
  hasStorageAuthority,
  isGeneratedOutput,
} from "./referenceOutputAuthority";

type ReferenceActionOutput = Pick<
  StudioOutput,
  "mediaSource" | "generationId" | "previewStoragePath" | "fullStoragePath" | "savedMediaIds"
>;

export const canSaveReferenceOutput = (output: ReferenceActionOutput): boolean => {
  if (!isGeneratedOutput(output)) return true;
  return hasDurableGenerationIdentity(output);
};

export const canDownloadReferenceOutput = (output: ReferenceActionOutput): boolean => {
  if (!isGeneratedOutput(output)) return true;
  return hasDurableGenerationIdentity(output) || hasStorageAuthority(output);
};
