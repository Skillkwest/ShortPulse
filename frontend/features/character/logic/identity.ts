/**
 * Identity helpers for the character workflow.
 * ArcFace/BlazeFace dependencies removed; acts as a stub while the workflow is rebuilt.
 */
import type { CharacterIdentity, CharacterReference } from "../types";

const EMBEDDING_DIM = 512;

const makeId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(16).slice(2)}-${Date.now()}`;
};

const randomEmbedding = (): Float32Array => {
  const arr = new Float32Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i += 1) {
    arr[i] = Math.random();
  }
  return arr;
};

export const createIdentity = (name = "New Character"): CharacterIdentity => ({
  id: makeId(),
  name,
  embedding: null,
  embeddingStatus: "idle",
  identityToken: null,
  quality: undefined,
  references: [],
  createdAt: new Date().toISOString(),
});

/**
 * Placeholder embedding builder — replace with ArcFace ONNX/WebGPU.
 * Simulates latency so the UI can show progress.
 */
/**
 * Build embeddings using ArcFace ONNX. If models are missing, throw an informative error
 * so the UI can tell the user to place weights in /public/models/character.
 */
export const buildEmbeddingFromReferences = async (references: CharacterReference[]): Promise<Float32Array> => {
  if (!references.length) {
    throw new Error("Add at least one reference image to build identity.");
  }
  // Placeholder until the new character pipeline is implemented.
  await new Promise((resolve) => setTimeout(resolve, 100));
  return randomEmbedding();
};

export type IdentityCapability = {
  hasWebGpu: boolean;
  modelsAvailable: boolean;
  message?: string;
};

/**
 * Check whether WebGPU is available and model weights are present.
 */
export const checkIdentityCapabilities = async (): Promise<IdentityCapability> => {
  const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  if (!hasWebGpu) return { hasWebGpu, modelsAvailable: false, message: "WebGPU not available" };
  return { hasWebGpu, modelsAvailable: true };
};

/**
 * Placeholder quality calculator. Replace with real scoring (faces, blur, variance) once ArcFace lands.
 */
export const computeReferenceQuality = (references: CharacterReference[]) => {
  return {
    acceptedRefs: references.length,
    rejectedRefs: 0,
    variance: 0,
  };
};
