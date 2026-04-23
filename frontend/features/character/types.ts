/**
 * Shared types for the Character workflow.
 * Characters persist an identity embedding and references so generations stay consistent.
 */
export type CharacterReference = {
  id: string;
  url: string;
  name?: string;
  source: "upload" | "generated";
};

export type CharacterIdentity = {
  id: string;
  name: string;
  embedding: Float32Array | null;
  embeddingStatus: "idle" | "building" | "ready" | "error";
  identityToken: string | null;
  quality?: {
    acceptedRefs: number;
    rejectedRefs: number;
    variance?: number;
  };
  references: CharacterReference[];
  createdAt: string;
};

export type CharacterPose = {
  id: string;
  label: string;
  keypoints?: number[];
};

export type CharacterEngine = "fal-edge" | "local-webgpu";

export type CharacterModelId =
  | "fal-ai/bytedance/seedream/v4.5/text-to-image"
  | "fal-ai/bytedance/seedream/v4.5/edit";

export type CharacterGenerationMode = "portrait" | "full-body";

export type CharacterGenerationRequest = {
  prompt: string;
  aspect: string;
  modelId: CharacterModelId;
  engine: CharacterEngine;
  poseId?: string | null;
  useReferences: boolean;
};

export type CharacterGenerationResult = {
  id: string;
  imageUrl: string;
  createdAt: string;
  modelId: CharacterModelId;
  requestId?: string;
};
