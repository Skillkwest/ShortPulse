/**
 * Shared submission adapter key metadata for catalog/runtime validation.
 * Keeps handler-family keys centralized without pulling feature runtime code into governance scripts.
 */
export const defaultSubmissionAdapterKeys = [
  "openai-gpt-image-2",
  "seedream-text",
  "seedream-v5-lite-text",
  "nano-banana-pro-text",
  "nano-banana-2-text",
] as const;

export type DefaultSubmissionAdapterKey = (typeof defaultSubmissionAdapterKeys)[number];

export const imageSubmissionAdapterKeys = [
  "bria-background-remove",
  "nano-banana-pro-edit",
  "nano-banana-2-edit",
  "seedream-edit",
  "seedream-v5-lite-edit",
  "flux-2-klein",
] as const;

export type ImageSubmissionAdapterKey = (typeof imageSubmissionAdapterKeys)[number];

export const videoSubmissionAdapterKeys = [
  "kie-veo-31-fast-i2v",
  "kie-seedance-2",
  "kie-kling-3",
] as const;

export type VideoSubmissionAdapterKey = (typeof videoSubmissionAdapterKeys)[number];

export type ModelSubmissionAdapterKey =
  | DefaultSubmissionAdapterKey
  | ImageSubmissionAdapterKey
  | VideoSubmissionAdapterKey;

export const submissionAdapterKeysByHandler = {
  default: defaultSubmissionAdapterKeys,
  image: imageSubmissionAdapterKeys,
  video: videoSubmissionAdapterKeys,
} as const;
