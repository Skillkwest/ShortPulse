import {
  resolveCharacterSheetLookReferenceUrls,
  resolveCharacterSheetReferenceUrls,
} from "./characterModePayload";
import {
  type AiStudioKlingElement,
  type AiStudioKlingSavedEntitySourceKind,
} from "./klingElements";
import { loadCharacterManagerDraftByCharacterId } from "../../character-manager/logic/characterManagerPersistence";
import type { CharacterManagerListItem } from "../../character-manager/logic/characterManagerPersistence";
import { resolveElementWorkflowAlias } from "../../elements-manager/logic/elementAlias";
import { loadElementManagerDraftByElementId } from "../../elements-manager/logic/elementsManagerPersistence";
import type { ElementsManagerListItem } from "../../elements-manager/logic/elementsManagerPersistence";

export type AiStudioKlingPickerOption = {
  sourceKind: AiStudioKlingSavedEntitySourceKind;
  sourceId: string;
  name: string;
  token: string;
  profileImageUrl: string | null;
  profileImageTransform: AiStudioKlingElement["profileImageTransform"];
  status: string;
  updatedAt: string;
};

export const toKlingPickerCharacterOption = (
  character: CharacterManagerListItem
): AiStudioKlingPickerOption => ({
  sourceKind: "character",
  sourceId: character.characterId,
  name: character.characterName,
  token: "",
  profileImageUrl: character.profileImageUrl,
  profileImageTransform: character.profileImageTransform ?? null,
  status: character.characterStatus,
  updatedAt: character.updatedAt,
});

export const toKlingPickerElementOption = (
  element: ElementsManagerListItem
): AiStudioKlingPickerOption => ({
  sourceKind: "element",
  sourceId: element.elementId,
  name: element.elementName,
  token: resolveElementWorkflowAlias({
    name: element.elementName,
    legacyAlias: element.elementAlias,
  }),
  profileImageUrl: element.profileImageUrl,
  profileImageTransform: element.profileImageTransform ?? null,
  status: element.elementStatus,
  updatedAt: element.updatedAt,
});

export const loadSavedKlingEntityBySource = async ({
  sourceKind,
  sourceId,
}: {
  sourceKind: AiStudioKlingSavedEntitySourceKind;
  sourceId: string;
}): Promise<AiStudioKlingElement> => {
  if (sourceKind === "character") {
    const snapshot = await loadCharacterManagerDraftByCharacterId(sourceId);
    const lookImageUrls = resolveCharacterSheetLookReferenceUrls(
      snapshot.characterSheetPresetAssignments
    );
    const imageUrls =
      lookImageUrls.length > 0
        ? lookImageUrls
        : resolveCharacterSheetReferenceUrls(snapshot.characterSheetAssignments, snapshot.slots);
    return {
      id: snapshot.characterId,
      slotIndex: undefined,
      sourceKind: "character",
      sourceElementId: null,
      sourceCharacterId: snapshot.characterId,
      name: snapshot.characterName,
      alias: "",
      description:
        snapshot.characterDescription.trim() || snapshot.legacyCharacterDescription.trim(),
      profileImageUrl: snapshot.profileImageUrl,
      profileImageTransform: snapshot.profileImageTransform,
      frontalImageUrl: imageUrls[0] ?? "",
      referenceImageUrls: imageUrls.slice(1).join(", "),
      videoUrl: "",
    };
  }

  const snapshot = await loadElementManagerDraftByElementId(sourceId);
  const imageUrls = snapshot.imageReferenceUrls
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, collection) => collection.indexOf(value) === index);
  return {
    id: snapshot.elementId,
    slotIndex: undefined,
    sourceKind: "element",
    sourceElementId: snapshot.elementId,
    sourceCharacterId: null,
    name: snapshot.name,
    alias: snapshot.alias.trim() || resolveElementWorkflowAlias({ name: snapshot.name }),
    description: snapshot.description,
    profileImageUrl: snapshot.profileImageUrl,
    profileImageTransform: snapshot.profileImageTransform,
    frontalImageUrl: imageUrls[0] ?? "",
    referenceImageUrls: imageUrls.slice(1).join(", "),
    videoUrl: snapshot.videoReferenceUrl?.trim() ?? "",
  };
};
