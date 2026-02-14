/**
 * AI Studio character panel prop composition hook.
 * Keeps Character tool prop wiring out of the page orchestrator.
 */
import type { AiStudioPageContentProps } from "../components/AiStudioPageContent";
import type { CharacterEngine, CharacterIdentity, CharacterModelId } from "../../character/types";

type UseAiStudioCharacterPanelPropsParams = {
  identity: CharacterIdentity;
  characterAspect: string;
  characterModelId: CharacterModelId;
  characterEngine: CharacterEngine;
  characterPrompt: string;
  characterPoseId: string | null;
  isBuildingIdentity: boolean;
  isCharacterGenerating: boolean;
  characterHasWebGpu: boolean;
  characterModelsAvailable: boolean;
  characterCapabilityMessage?: string;
  setCharacterPrompt: (value: string) => void;
  setCharacterAspect: (value: string) => void;
  setCharacterModelId: (value: CharacterModelId) => void;
  setCharacterEngine: (value: CharacterEngine) => void;
  setCharacterPoseId: (value: string | null) => void;
  addCharacterReferences: (files: FileList | File[]) => void;
  removeCharacterReference: (id: string) => void;
  buildCharacterIdentity: () => Promise<void>;
  generateCharacter: () => Promise<void>;
  triggerFilePicker: () => void;
};

export const useAiStudioCharacterPanelProps = ({
  identity,
  characterAspect,
  characterModelId,
  characterEngine,
  characterPrompt,
  characterPoseId,
  isBuildingIdentity,
  isCharacterGenerating,
  characterHasWebGpu,
  characterModelsAvailable,
  characterCapabilityMessage,
  setCharacterPrompt,
  setCharacterAspect,
  setCharacterModelId,
  setCharacterEngine,
  setCharacterPoseId,
  addCharacterReferences,
  removeCharacterReference,
  buildCharacterIdentity,
  generateCharacter,
  triggerFilePicker,
}: UseAiStudioCharacterPanelPropsParams): AiStudioPageContentProps["propertiesCharacter"] => ({
  identity,
  aspect: characterAspect,
  modelId: characterModelId,
  engine: characterEngine,
  prompt: characterPrompt,
  poseId: characterPoseId,
  isBuildingIdentity,
  isGenerating: isCharacterGenerating,
  identityToken: identity.identityToken,
  quality: identity.quality,
  hasWebGpu: characterHasWebGpu,
  modelsAvailable: characterModelsAvailable,
  capabilityMessage: characterCapabilityMessage,
  canBuildIdentity: identity.references.length > 0,
  onPromptChange: setCharacterPrompt,
  onAspectChange: setCharacterAspect,
  onModelChange: (value) => setCharacterModelId(value as CharacterModelId),
  onEngineChange: setCharacterEngine,
  onPoseChange: setCharacterPoseId,
  onUploadClick: triggerFilePicker,
  onDropFiles: (files) => addCharacterReferences(files),
  onRemoveReference: removeCharacterReference,
  onBuildIdentity: () => {
    void buildCharacterIdentity();
  },
  onGenerate: () => {
    void generateCharacter();
  },
});
