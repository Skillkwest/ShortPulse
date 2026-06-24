/**
 * Workflow reroll helpers for generated AI Studio references.
 * Resolves output-scoped metadata for immediate submit without hydrating panels.
 */
import type { InternalMediaRef } from "../../../lib/media/internalMediaRefs";
import {
  resolveWorkflowReloadConfigForOutput,
  type ResolveWorkflowReloadConfigOptions,
} from "./workflowReload";
import { registerInternalMediaRefsForUrls } from "./referenceInputInternalMediaRegistry";
import type { StudioOutput, WorkflowReloadConfigV1, WorkflowReloadVideoReferences } from "../types";

const isLocalOnlyUrl = (value: string): boolean => /^blob:|^data:/i.test(value);

export const resolveWorkflowRerollConfigForOutput = (
  output: StudioOutput,
  options: ResolveWorkflowReloadConfigOptions = {}
): WorkflowReloadConfigV1 | null => {
  if (output.mediaSource !== "generated") return null;
  return resolveWorkflowReloadConfigForOutput(output, options);
};

export const canRerollOutput = (
  output: StudioOutput,
  options: ResolveWorkflowReloadConfigOptions = {}
): boolean => resolveWorkflowRerollConfigForOutput(output, options) != null;

export const hasUnavailableWorkflowRerollReference = (config: WorkflowReloadConfigV1): boolean => {
  const payload = config.payload;
  if (payload.kind !== "image" && payload.kind !== "video") return false;
  const internalRefs = payload.internalMediaRefs ?? [];
  return payload.referenceInputs.some((input, index) => {
    if (!isLocalOnlyUrl(input)) return false;
    return !internalRefs[index];
  });
};

const collectVideoReferenceInternalMedia = (
  videoReferences: WorkflowReloadVideoReferences | null | undefined
): { urls: Array<string | null>; refs: Array<InternalMediaRef | null> } => {
  const urls: Array<string | null> = [];
  const refs: Array<InternalMediaRef | null> = [];
  const push = (url: string | null | undefined, ref: InternalMediaRef | null | undefined) => {
    const normalizedUrl = typeof url === "string" ? url.trim() : "";
    if (!normalizedUrl) return;
    urls.push(normalizedUrl);
    refs.push(ref ?? null);
  };

  push(videoReferences?.firstFrame?.sourceUrl, videoReferences?.firstFrame?.internalMediaRef);
  push(videoReferences?.lastFrame?.sourceUrl, videoReferences?.lastFrame?.internalMediaRef);
  videoReferences?.seedance2ReferenceImages?.forEach((slot) =>
    push(slot.sourceUrl, slot.internalMediaRef)
  );
  videoReferences?.seedance2ReferenceVideos?.forEach((slot) =>
    push(slot.sourceUrl, slot.internalMediaRef)
  );
  videoReferences?.seedance2ReferenceAudio?.forEach((slot) =>
    push(slot.sourceUrl, slot.internalMediaRef)
  );
  videoReferences?.klingElementSlots?.forEach((slot) => {
    const element = slot.element;
    push(element.profileImageUrl as string | null | undefined, slot.profileImageInternalMediaRef);
    push(element.frontalImageUrl as string | null | undefined, slot.frontalImageInternalMediaRef);
    if (typeof element.referenceImageUrls === "string") {
      element.referenceImageUrls
        .split(/[,\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((url, index) => push(url, slot.referenceImageInternalMediaRefs?.[index] ?? null));
    }
    push(element.videoUrl as string | null | undefined, slot.videoInternalMediaRef);
  });

  return { urls, refs };
};

export const registerWorkflowRerollInternalMediaRefs = (config: WorkflowReloadConfigV1): void => {
  const payload = config.payload;
  if (payload.kind === "image" || payload.kind === "video") {
    registerInternalMediaRefsForUrls(payload.referenceInputs, payload.internalMediaRefs ?? []);
  }
  if (payload.kind === "video") {
    const { urls, refs } = collectVideoReferenceInternalMedia(payload.videoReferences);
    registerInternalMediaRefsForUrls(urls, refs);
  }
};
