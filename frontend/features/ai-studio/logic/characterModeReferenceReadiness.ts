/**
 * Character Mode reference readiness helpers for Create generation.
 * Keeps UI guardrails aligned with the submit invariant that Character Mode
 * requires real character-sheet references rather than description-only input.
 */

export const CHARACTER_MODE_EMPTY_LOOK_GUARDRAIL =
  "This look has no character reference images. Add a reference image or choose another look before generating.";

type CharacterModeReferenceBundle = {
  sheetReferenceStoragePaths?: readonly (string | null | undefined)[] | null;
  sheetReferenceUrls?: readonly (string | null | undefined)[] | null;
};

export type CharacterModeReferenceReadiness = {
  characterReferenceCount: number;
  hasCharacterReferences: boolean;
  shouldBlockGenerate: boolean;
  guardrailMessage: string | null;
};

const countNormalizedReferences = (
  values: readonly (string | null | undefined)[] | null | undefined
): number =>
  new Set(
    (values ?? [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  ).size;

/**
 * Resolves whether Create Character Mode has usable character-sheet references.
 */
export const resolveCharacterModeReferenceReadiness = ({
  isCharacterModeEnabled,
  selectedCharacterId,
  isBundleLoading = false,
  bundle,
}: {
  isCharacterModeEnabled: boolean;
  selectedCharacterId?: string | null;
  isBundleLoading?: boolean;
  bundle?: CharacterModeReferenceBundle | null;
}): CharacterModeReferenceReadiness => {
  const characterReferenceCount = Math.max(
    countNormalizedReferences(bundle?.sheetReferenceStoragePaths),
    countNormalizedReferences(bundle?.sheetReferenceUrls)
  );
  const hasCharacterReferences = characterReferenceCount > 0;
  const hasSelectedCharacter =
    typeof selectedCharacterId === "string" && selectedCharacterId.trim().length > 0;
  const shouldBlockGenerate =
    isCharacterModeEnabled &&
    hasSelectedCharacter &&
    !isBundleLoading &&
    Boolean(bundle) &&
    !hasCharacterReferences;

  return {
    characterReferenceCount,
    hasCharacterReferences,
    shouldBlockGenerate,
    guardrailMessage: shouldBlockGenerate ? CHARACTER_MODE_EMPTY_LOOK_GUARDRAIL : null,
  };
};
