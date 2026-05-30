/**
 * Character workflow state hook.
 * Handles reference ingestion, identity build (stubbed), and generation calls to Fal endpoints.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { maybePreprocessLocalImageFileForUpload } from "../../../lib/adaptive-media/localTranscode";
import {
  fetchQueuedGenerationStatusByModelId,
  submitQueuedGenerationByModelId,
  type FalSeedreamEditSubmitRequest,
  type FalSeedreamSubmitRequest,
} from "../../../lib/falClient";
import { falSizeForAspect } from "../../ai-studio/logic/pricing";
import { prepareImageUrl } from "../../ai-studio/logic/imageDescription";
import {
  createIdentity,
  buildEmbeddingFromReferences,
  computeReferenceQuality,
  checkIdentityCapabilities,
} from "../logic/identity";
import { characterStorage } from "../logic/storage";
import {
  CharacterEngine,
  CharacterGenerationRequest,
  CharacterGenerationResult,
  CharacterIdentity,
  CharacterModelId,
  CharacterReference,
} from "../types";
import {
  defaultCharacterAspect,
  defaultCharacterEngine,
  defaultCharacterEditModel,
  defaultCharacterModel,
  defaultCharacterTextModel,
  MAX_REFERENCE_FILES,
} from "../constants";

type UseCharacterWorkflowResult = {
  identity: CharacterIdentity;
  aspect: string;
  modelId: CharacterModelId;
  engine: CharacterEngine;
  prompt: string;
  poseId: string | null;
  results: CharacterGenerationResult[];
  isBuildingIdentity: boolean;
  isGenerating: boolean;
  error: string | null;
  canBuildIdentity: boolean;
  hasWebGpu: boolean;
  modelsAvailable: boolean;
  capabilityMessage?: string;
  setPrompt: (value: string) => void;
  setAspect: (value: string) => void;
  setModelId: (value: CharacterModelId) => void;
  setEngine: (value: CharacterEngine) => void;
  setPoseId: (value: string | null) => void;
  addReferences: (files: FileList | File[]) => void;
  removeReference: (id: string) => void;
  buildIdentity: () => Promise<void>;
  generate: (requestOverrides?: Partial<CharacterGenerationRequest>) => Promise<void>;
  clearError: () => void;
};

const STORAGE_KEY = "current-character";

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const extractUrlArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = toRecord(item);
      return typeof record.url === "string" ? record.url : null;
    })
    .filter((url): url is string => Boolean(url));
};

const extractUrls = (status: unknown): string[] => {
  const root = toRecord(status);
  const images = extractUrlArray(toRecord(root.data).images);
  if (images.length) return images;
  const nested = extractUrlArray(root.images);
  if (nested.length) return nested;
  const output = extractUrlArray(toRecord(root.output).images);
  if (output.length) return output;
  return [];
};

export const useCharacterWorkflow = (): UseCharacterWorkflowResult => {
  const [identity, setIdentity] = useState<CharacterIdentity>(() => createIdentity());
  const [aspect, setAspect] = useState(defaultCharacterAspect);
  const [modelId, setModelId] = useState<CharacterModelId>(defaultCharacterModel);
  const [engine, setEngine] = useState<CharacterEngine>(defaultCharacterEngine);
  const [prompt, setPrompt] = useState("");
  const [poseId, setPoseId] = useState<string | null>(null);
  const [results, setResults] = useState<CharacterGenerationResult[]>([]);
  const [isBuildingIdentity, setIsBuildingIdentity] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasWebGpu, setHasWebGpu] = useState<boolean>(
    () => typeof navigator !== "undefined" && "gpu" in navigator
  );
  const [modelsAvailable, setModelsAvailable] = useState<boolean>(false);
  const [capabilityMessage, setCapabilityMessage] = useState<string | undefined>(undefined);
  const objectUrlsRef = useRef<string[]>([]);
  const isGenerating = generatingCount > 0;

  const addReferences = useCallback(
    (files: FileList | File[]) => {
      const currentCount = identity.references.length;
      const remainingSlots = Math.max(0, MAX_REFERENCE_FILES - currentCount);
      if (remainingSlots <= 0) return;
      const slice = Array.from(files).slice(0, remainingSlots);
      const imageFiles = slice.filter((file) => file.type.toLowerCase().startsWith("image/"));
      if (!imageFiles.length) {
        setError("Only image files are supported for character references.");
        return;
      }
      if (imageFiles.length < slice.length) {
        setError("Only image files are supported for character references.");
      } else {
        setError(null);
      }
      void (async () => {
        const preparedResults = await Promise.allSettled(
          imageFiles.map(async (file) => await maybePreprocessLocalImageFileForUpload(file))
        );
        const nextRefs: CharacterReference[] = [];
        let hasPreprocessFailure = false;
        preparedResults.forEach((result) => {
          if (result.status !== "fulfilled") {
            hasPreprocessFailure = true;
            return;
          }
          const preparedFile = result.value;
          const url = URL.createObjectURL(preparedFile);
          objectUrlsRef.current.push(url);
          nextRefs.push({
            id: crypto.randomUUID(),
            url,
            name: preparedFile.name,
            source: "upload",
          });
        });
        if (!nextRefs.length) {
          if (hasPreprocessFailure) {
            setError("Unable to process the selected reference image. Try a different image.");
          }
          return;
        }
        if (hasPreprocessFailure) {
          setError("One or more reference images could not be processed.");
        }
        setIdentity((prev) => ({
          ...prev,
          references: [...nextRefs, ...prev.references].slice(0, MAX_REFERENCE_FILES),
        }));
      })();
    },
    [identity.references.length]
  );

  const removeReference = useCallback((id: string) => {
    setIdentity((prev) => ({
      ...prev,
      references: prev.references.filter((ref) => ref.id !== id),
    }));
  }, []);

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    },
    []
  );

  // Load persisted identity (single-character scope).
  useEffect(() => {
    void characterStorage.loadCharacter<CharacterIdentity>(STORAGE_KEY).then((record) => {
      if (record) {
        setIdentity(record);
      }
    });
    void checkIdentityCapabilities().then((capability) => {
      setHasWebGpu(capability.hasWebGpu);
      setModelsAvailable(capability.modelsAvailable);
      setCapabilityMessage(capability.message);
    });
  }, []);

  const buildIdentity = useCallback(async () => {
    if (!identity.references.length) {
      setError("Add at least one reference image first.");
      return;
    }
    setError(null);
    setIsBuildingIdentity(true);
    setIdentity((prev) => ({ ...prev, embeddingStatus: "building" }));
    try {
      const embedding = await buildEmbeddingFromReferences(identity.references);
      const identityToken = identity.identityToken ?? crypto.randomUUID();
      const quality = computeReferenceQuality(identity.references);
      const next: CharacterIdentity = {
        ...identity,
        embedding,
        embeddingStatus: "ready",
        identityToken,
        quality,
      };
      setIdentity(next);
      void characterStorage.saveCharacter<CharacterIdentity>(STORAGE_KEY, next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to build identity.";
      setIdentity((prev) => ({ ...prev, embeddingStatus: "error" }));
      setError(message);
    } finally {
      setIsBuildingIdentity(false);
    }
  }, [identity]);

  const generate = useCallback(
    async (requestOverrides: Partial<CharacterGenerationRequest> = {}) => {
      const activePrompt = (requestOverrides.prompt ?? prompt).trim();
      if (!activePrompt) {
        setError("Add a prompt to generate.");
        return;
      }

      const useReferences = requestOverrides.useReferences ?? true;
      const activeAspect = requestOverrides.aspect ?? aspect;
      const activeModel = requestOverrides.modelId ?? modelId;

      setError(null);
      setGeneratingCount((count) => count + 1);

      if (!identity.identityToken || identity.embeddingStatus !== "ready") {
        setError("Build the character identity before generating.");
        setGeneratingCount((count) => Math.max(0, count - 1));
        return;
      }

      const preparedImages = useReferences
        ? (
            await Promise.all(
              identity.references.map(async (ref) => {
                const normalized = await prepareImageUrl(ref.url);
                return normalized ?? null;
              })
            )
          ).filter((url): url is string => Boolean(url))
        : [];

      try {
        const basePayload = {
          prompt: activePrompt,
          image_size: falSizeForAspect(activeAspect),
          num_images: 1,
          enable_safety_checker: true,
          // Future: backend can accept identity_token and pose payloads
          identity_token: identity.identityToken,
        };

        const shouldUseEdit =
          preparedImages.length > 0 && activeModel !== defaultCharacterTextModel;
        const generationModelId = shouldUseEdit
          ? defaultCharacterEditModel
          : defaultCharacterTextModel;
        const submitResponse = shouldUseEdit
          ? await submitQueuedGenerationByModelId(generationModelId, {
              ...basePayload,
              image_urls: preparedImages.slice(0, 4),
            } satisfies FalSeedreamEditSubmitRequest & { identity_token?: string | null })
          : await submitQueuedGenerationByModelId(
              generationModelId,
              basePayload satisfies FalSeedreamSubmitRequest & {
                identity_token?: string | null;
              }
            );

        const request_id =
          typeof submitResponse.request_id === "string" ? submitResponse.request_id : null;
        if (!request_id) {
          throw new Error("Provider did not return a request id.");
        }

        const pollStatus = async (attempt = 0): Promise<string[]> => {
          const status = await fetchQueuedGenerationStatusByModelId(generationModelId, request_id);
          const statusRecord = toRecord(status);
          const stateRaw =
            statusRecord.status?.toString().toLowerCase() ??
            statusRecord.state?.toString().toLowerCase() ??
            "pending";
          const state = stateRaw === "succeeded" ? "success" : stateRaw;
          if (state === "success" || state === "completed") {
            const urls = extractUrls(status);
            if (urls.length) return urls;
            if (attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, 800 + attempt * 400));
              return pollStatus(attempt + 1);
            }
            return [];
          }
          if (state === "fail" || state === "error") {
            const message =
              (typeof statusRecord.failMsg === "string" && statusRecord.failMsg) ||
              (typeof statusRecord.failCode === "string" && statusRecord.failCode) ||
              (typeof statusRecord.error === "string" && statusRecord.error) ||
              "Generation failed.";
            throw new Error(message);
          }
          await new Promise((resolve) => setTimeout(resolve, Math.min(1200 + attempt * 400, 4000)));
          return pollStatus(attempt + 1);
        };

        const urls = await pollStatus();
        if (!urls.length) {
          throw new Error("Generation finished but no media URLs were returned.");
        }
        const firstUrl = urls[0];
        const result: CharacterGenerationResult = {
          id: crypto.randomUUID(),
          imageUrl: firstUrl,
          createdAt: new Date().toISOString(),
          modelId: activeModel,
          requestId: request_id,
        };
        setResults((prev) => [result, ...prev].slice(0, 30));
        setIdentity((prev) => ({
          ...prev,
          references: useReferences
            ? prev.references
            : [
                {
                  id: crypto.randomUUID(),
                  url: firstUrl,
                  source: "generated",
                  name: "Auto-reference",
                },
                ...prev.references,
              ],
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Character generation failed.";
        setError(message);
      } finally {
        setGeneratingCount((count) => Math.max(0, count - 1));
      }
    },
    [aspect, identity.embeddingStatus, identity.identityToken, identity.references, modelId, prompt]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    identity,
    aspect,
    modelId,
    engine,
    prompt,
    poseId,
    results,
    isBuildingIdentity,
    isGenerating,
    error,
    canBuildIdentity: identity.references.length > 0,
    hasWebGpu,
    modelsAvailable,
    capabilityMessage,
    setPrompt,
    setAspect,
    setModelId,
    setEngine,
    setPoseId,
    addReferences,
    removeReference,
    buildIdentity,
    generate,
    clearError,
  };
};
