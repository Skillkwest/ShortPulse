import {
  resolveCharacterSheetPresetReferenceUrls,
  resolveCharacterSheetReferenceUrls,
} from "./characterModePayload";
import { type AiStudioKlingElement, type AiStudioKlingEntitySourceKind } from "./klingElements";
import { loadCharacterManagerDraftByCharacterId } from "../../character-manager/logic/characterManagerPersistence";
import type { CharacterManagerListItem } from "../../character-manager/logic/characterManagerPersistence";
import { loadElementManagerDraftByElementId } from "../../elements-manager/logic/elementsManagerPersistence";
import type { ElementsManagerListItem } from "../../elements-manager/logic/elementsManagerPersistence";

export type AiStudioKlingPickerOption = {
  sourceKind: AiStudioKlingEntitySourceKind;
  sourceId: string;
  name: string;
  alias: string;
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
  alias: "",
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
  alias: element.elementAlias,
  profileImageUrl: element.profileImageUrl,
  profileImageTransform: element.profileImageTransform ?? null,
  status: element.elementStatus,
  updatedAt: element.updatedAt,
});

export const loadSavedKlingEntityBySource = async ({
  sourceKind,
  sourceId,
}: {
  sourceKind: AiStudioKlingEntitySourceKind;
  sourceId: string;
}): Promise<AiStudioKlingElement> => {
  if (sourceKind === "character") {
    const snapshot = await loadCharacterManagerDraftByCharacterId(sourceId);
    const presetImageUrls = resolveCharacterSheetPresetReferenceUrls(
      snapshot.characterSheetPresetAssignments
    );
    const imageUrls =
      presetImageUrls.length > 0
        ? presetImageUrls
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
    alias: snapshot.alias,
    description: snapshot.description,
    profileImageUrl: snapshot.profileImageUrl,
    profileImageTransform: snapshot.profileImageTransform,
    frontalImageUrl: imageUrls[0] ?? "",
    referenceImageUrls: imageUrls.slice(1).join(", "),
    videoUrl: snapshot.videoReferenceUrl?.trim() ?? "",
  };
};
