/**
 * Character Mode reference readiness helpers for Create generation.
 * Keeps UI guardrails aligned with the submit invariant that Character Mode
 * requires real character-sheet references rather than description-only input.
 */

export const CHARACTER_MODE_EMPTY_LOOK_GUARDRAIL =
  "This look has no character reference images. Add a reference image or choose another look before generating.";

type CharacterModeReferenceBundle = {
  directLookReferenceCount?: number | null;
  sheetReferenceStoragePaths?: readonly (string | null | undefined)[] | null;
  sheetReferenceUrls?: readonly (string | null | undefined)[] | null;
};

export type CharacterModeReferenceReadiness = {
  characterReferenceCount: number;
  effectiveReferenceCount: number;
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
  const effectiveReferenceCount = Math.max(
    countNormalizedReferences(bundle?.sheetReferenceStoragePaths),
    countNormalizedReferences(bundle?.sheetReferenceUrls)
  );
  const directLookReferenceCount =
    typeof bundle?.directLookReferenceCount === "number" &&
    Number.isFinite(bundle.directLookReferenceCount)
      ? Math.max(0, Math.floor(bundle.directLookReferenceCount))
      : null;
  const characterReferenceCount = directLookReferenceCount ?? effectiveReferenceCount;
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
    effectiveReferenceCount,
    hasCharacterReferences,
    shouldBlockGenerate,
    guardrailMessage: shouldBlockGenerate ? CHARACTER_MODE_EMPTY_LOOK_GUARDRAIL : null,
  };
};
