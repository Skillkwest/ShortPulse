import type { StudioOutput } from "../types";
import {
  hasDurableGenerationIdentity,
  hasStorageAuthority,
  isGeneratedOutput,
} from "./referenceOutputAuthority";

export const canSaveReferenceOutput = (output: StudioOutput): boolean => {
  if (!isGeneratedOutput(output)) return true;
  return hasDurableGenerationIdentity(output);
};

export const canDownloadReferenceOutput = (output: StudioOutput): boolean => {
  if (!isGeneratedOutput(output)) return true;
  return hasDurableGenerationIdentity(output) || hasStorageAuthority(output);
};
