/**
 * Character Mode controller for AI Studio generation injection.
 * Encapsulates bundle mapping/refresh, submission override resolution, and fallback telemetry.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { loadCharacterManagerDraftByCharacterId } from "../../character-manager/logic/characterManagerPersistence";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import {
  composeCharacterModePrompt,
  mergeCharacterAndUserReferences,
  resolveCharacterSheetReferenceStoragePaths,
  resolveCharacterSheetReferenceUrls,
} from "../logic/characterModePayload";
import type { StudioOutput, ToolId } from "../types";

const MEDIA_BUCKET = "media_library";

export type CharacterModeInjectionBundle = {
  characterId: string;
  characterDescription: string;
  sheetReferenceStoragePaths: string[];
  sheetReferenceUrls: string[];
  loadedAtMs: number;
};

export type CharacterModeFallbackCode =
  | "no_character_selected"
  | "bundle_loading"
  | "bundle_unavailable"
  | "no_description_or_references"
  | "no_description"
  | "no_references";

type CharacterOptionSummary = {
  id: string;
  name: string;
  profileImageUrl: string | null;
};

type CharacterModeSubmissionOverrides = {
  submissionPromptOverride: string;
  displayPromptOverride: string;
  referenceInputsOverride: string[];
  characterContextOverride?: StudioOutput["characterContext"];
  notice: string | null;
  fallbackCode: CharacterModeFallbackCode | null;
  characterReferenceCount: number;
  hasCharacterDescription: boolean;
} | null;

type UseAiStudioCharacterModeControllerParams = {
  isCharacterModeEnabled: boolean;
  selectedCharacterId: string;
  characterModeInjectionBundle: CharacterModeInjectionBundle | null;
  isCharacterBundleLoading: boolean;
  characterOptions: CharacterOptionSummary[];
  setCharacterModeInjectionBundle: Dispatch<SetStateAction<CharacterModeInjectionBundle | null>>;
  setIsCharacterBundleLoading: Dispatch<SetStateAction<boolean>>;
  trackCharacterModeEvent: (message: string, data?: Record<string, unknown>) => void;
  bundleStaleAfterMs: number;
};

/**
 * Returns Character Mode helpers for bundle lifecycle, submission overrides, and fallback telemetry.
 */
export const useAiStudioCharacterModeController = ({
  isCharacterModeEnabled,
  selectedCharacterId,
  characterModeInjectionBundle,
  isCharacterBundleLoading,
  characterOptions,
  setCharacterModeInjectionBundle,
  setIsCharacterBundleLoading,
  trackCharacterModeEvent,
  bundleStaleAfterMs,
}: UseAiStudioCharacterModeControllerParams) => {
  const toCharacterModeInjectionBundle = useCallback(
    (
      snapshot: Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>
    ): CharacterModeInjectionBundle => ({
      characterId: snapshot.characterId,
      characterDescription: snapshot.characterDescription,
      sheetReferenceStoragePaths: resolveCharacterSheetReferenceStoragePaths(
        snapshot.characterSheetAssignments,
        snapshot.slots
      ),
      sheetReferenceUrls: resolveCharacterSheetReferenceUrls(
        snapshot.characterSheetAssignments,
        snapshot.slots
      ),
      loadedAtMs: Date.now(),
    }),
    []
  );

  const refreshBundleReferenceUrlsForSubmission = useCallback(
    async (bundle: CharacterModeInjectionBundle): Promise<CharacterModeInjectionBundle | null> => {
      if (!bundle.sheetReferenceStoragePaths.length) {
        return {
          ...bundle,
          loadedAtMs: Date.now(),
        };
      }
      const signedByPath = await getSignedMediaUrlsBatch({
        bucket: MEDIA_BUCKET,
        storagePaths: bundle.sheetReferenceStoragePaths,
        forceRefresh: true,
      });
      const refreshedUrls = bundle.sheetReferenceStoragePaths
        .map((path) => signedByPath.get(path) ?? null)
        .filter((value): value is string => Boolean(value));
      if (refreshedUrls.length === 0) {
        trackCharacterModeEvent("character_mode_reference_refresh_empty", {
          selected_character_id: bundle.characterId,
          storage_path_count: bundle.sheetReferenceStoragePaths.length,
        });
        return null;
      }
      return {
        ...bundle,
        sheetReferenceUrls: Array.from(new Set(refreshedUrls)),
        loadedAtMs: Date.now(),
      };
    },
    [trackCharacterModeEvent]
  );

  const refreshCharacterModeInjectionBundleForSubmission = useCallback(
    async (tool: ToolId | null): Promise<CharacterModeInjectionBundle | null> => {
      const isCreateWorkflowTool = tool === "create" || tool === "text";
      if (!isCharacterModeEnabled || !isCreateWorkflowTool) return characterModeInjectionBundle;
      if (!selectedCharacterId) return null;

      const currentBundle = characterModeInjectionBundle;
      const isMissingBundleForSelectedCharacter =
        !currentBundle || currentBundle.characterId !== selectedCharacterId;
      const bundleAgeMs = currentBundle ? Date.now() - currentBundle.loadedAtMs : 0;
      const isBundleStale = currentBundle ? bundleAgeMs >= bundleStaleAfterMs : true;
      const needsSnapshotReload = isMissingBundleForSelectedCharacter || isBundleStale;

      setIsCharacterBundleLoading(true);
      trackCharacterModeEvent("character_mode_bundle_refresh_before_submit", {
        reason: isMissingBundleForSelectedCharacter
          ? "missing_bundle"
          : isBundleStale
            ? "stale_signed_urls"
            : "submit_refresh",
        selected_character_id: selectedCharacterId,
        bundle_age_ms: currentBundle ? bundleAgeMs : null,
      });
      try {
        const baseBundle = needsSnapshotReload
          ? toCharacterModeInjectionBundle(
              await loadCharacterManagerDraftByCharacterId(selectedCharacterId)
            )
          : currentBundle;
        if (!baseBundle || baseBundle.characterId !== selectedCharacterId) {
          return null;
        }
        const refreshedBundle = await refreshBundleReferenceUrlsForSubmission(baseBundle);
        if (!refreshedBundle) {
          return null;
        }
        setCharacterModeInjectionBundle(refreshedBundle);
        return refreshedBundle;
      } catch (error) {
        trackCharacterModeEvent("character_mode_bundle_refresh_failed", {
          selected_character_id: selectedCharacterId,
          error:
            error instanceof Error && error.message.trim().length ? error.message : "unknown_error",
        });
        return null;
      } finally {
        setIsCharacterBundleLoading(false);
      }
    },
    [
      bundleStaleAfterMs,
      characterModeInjectionBundle,
      isCharacterModeEnabled,
      refreshBundleReferenceUrlsForSubmission,
      selectedCharacterId,
      setCharacterModeInjectionBundle,
      setIsCharacterBundleLoading,
      toCharacterModeInjectionBundle,
      trackCharacterModeEvent,
    ]
  );

  const resolveCharacterModeSubmissionOverrides = useCallback(
    (
      userPrompt: string,
      tool: ToolId | null,
      bundleOverride?: CharacterModeInjectionBundle | null
    ): CharacterModeSubmissionOverrides => {
      const isCreateWorkflowTool = tool === "create" || tool === "text";
      if (!isCharacterModeEnabled || !isCreateWorkflowTool) return null;

      const bundle = bundleOverride === undefined ? characterModeInjectionBundle : bundleOverride;
      const characterDescription = bundle?.characterDescription ?? "";
      const characterReferences = bundle?.sheetReferenceUrls ?? [];
      const submissionPrompt = composeCharacterModePrompt({
        characterDescription,
        userPrompt,
      });
      const referenceInputs = mergeCharacterAndUserReferences(characterReferences, []);
      const hasCharacterDescription = Boolean(characterDescription.trim());
      const selectedCharacterOption =
        characterOptions.find((option) => option.id === selectedCharacterId) ?? null;
      const hasCharacterInjection = hasCharacterDescription || referenceInputs.length > 0;
      const characterContextOverride = hasCharacterInjection
        ? {
            applied: true,
            characterId: bundle?.characterId ?? selectedCharacterId,
            characterName: selectedCharacterOption?.name ?? null,
            characterProfileImageUrl: selectedCharacterOption?.profileImageUrl ?? null,
          }
        : undefined;

      let notice: string | null = null;
      let fallbackCode: CharacterModeFallbackCode | null = null;
      if (!selectedCharacterId) {
        notice =
          "Character Mode is enabled with no character selected. Generated without character injection.";
        fallbackCode = "no_character_selected";
      } else if (isCharacterBundleLoading) {
        notice = "Character Mode context is still loading. Generated without character injection.";
        fallbackCode = "bundle_loading";
      } else if (!bundle) {
        notice =
          "Selected character context could not be loaded. Generated without character injection.";
        fallbackCode = "bundle_unavailable";
      } else if (!hasCharacterDescription && referenceInputs.length === 0) {
        notice =
          "Selected character has no description or Character Sheet references. Generated without character injection.";
        fallbackCode = "no_description_or_references";
      } else if (!hasCharacterDescription) {
        notice =
          "Selected character has no description. Generated using Character Sheet references only.";
        fallbackCode = "no_description";
      } else if (referenceInputs.length === 0) {
        notice =
          "Selected character has no Character Sheet references. Generated using description only.";
        fallbackCode = "no_references";
      }

      return {
        submissionPromptOverride: submissionPrompt || userPrompt,
        displayPromptOverride: userPrompt,
        referenceInputsOverride: referenceInputs,
        characterContextOverride,
        notice,
        fallbackCode,
        characterReferenceCount: referenceInputs.length,
        hasCharacterDescription,
      };
    },
    [
      characterModeInjectionBundle,
      characterOptions,
      isCharacterBundleLoading,
      isCharacterModeEnabled,
      selectedCharacterId,
    ]
  );

  const trackCharacterModeFallback = useCallback(
    (
      overrides: {
        fallbackCode: CharacterModeFallbackCode | null;
        characterReferenceCount: number;
        hasCharacterDescription: boolean;
      } | null,
      tool: ToolId | null
    ) => {
      if (!overrides?.fallbackCode) return;
      trackCharacterModeEvent("character_mode_injection_fallback", {
        fallback_code: overrides.fallbackCode,
        selected_character_id: selectedCharacterId || null,
        tool: tool ?? null,
        has_character_description: overrides.hasCharacterDescription,
        character_reference_count: overrides.characterReferenceCount,
      });
    },
    [selectedCharacterId, trackCharacterModeEvent]
  );

  return {
    toCharacterModeInjectionBundle,
    refreshCharacterModeInjectionBundleForSubmission,
    resolveCharacterModeSubmissionOverrides,
    trackCharacterModeFallback,
  };
};
