/**
 * Character Mode controller for AI Studio generation injection.
 * Encapsulates bundle mapping/refresh, submission override resolution, and fallback telemetry.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { loadCharacterManagerDraftByCharacterId } from "../../character-manager/logic/characterManagerPersistence";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import { reportAppError } from "../../../lib/appErrorReporter";
import {
  composeCharacterModePrompt,
  mergeCharacterAndUserReferences,
  resolveCharacterSheetPresetReferenceStoragePaths,
  resolveCharacterSheetPresetReferenceUrls,
  resolveCharacterSheetReferenceStoragePaths,
  resolveCharacterSheetReferenceUrls,
} from "../logic/characterModePayload";
import type { StudioOutput, ToolId } from "../types";

const MEDIA_BUCKET = "media_library";
const CHARACTER_MODE_TELEMETRY_SOURCE = "telemetry.character_mode";
const TELEMETRY_FALLBACK_CODES: CharacterModeFallbackCode[] = ["bundle_unavailable"];

const isCharacterUnavailableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const normalized = error.message.trim().toLowerCase();
  return (
    normalized.includes("character is no longer available") ||
    normalized.includes("character not found")
  );
};

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
  void bundleStaleAfterMs;
  const logCharacterModeTelemetry = useCallback(
    (message: string, data?: Record<string, unknown>) => {
      void reportAppError({
        source: CHARACTER_MODE_TELEMETRY_SOURCE,
        scope: "app",
        severity: "low",
        message,
        metadata: {
          telemetry_family: "character_mode",
          ...(data ?? {}),
        },
      });
    },
    []
  );

  const toCharacterModeInjectionBundle = useCallback(
    (
      snapshot: Awaited<ReturnType<typeof loadCharacterManagerDraftByCharacterId>>
    ): CharacterModeInjectionBundle => {
      const presetReferenceStoragePaths = resolveCharacterSheetPresetReferenceStoragePaths(
        snapshot.characterSheetPresetAssignments
      );
      const presetReferenceUrls = resolveCharacterSheetPresetReferenceUrls(
        snapshot.characterSheetPresetAssignments
      );
      const fallbackStoragePaths = resolveCharacterSheetReferenceStoragePaths(
        snapshot.characterSheetAssignments,
        snapshot.slots
      );
      const fallbackUrls = resolveCharacterSheetReferenceUrls(
        snapshot.characterSheetAssignments,
        snapshot.slots
      );
      const effectiveCharacterDescription =
        snapshot.characterDescription.trim().length > 0
          ? snapshot.characterDescription
          : snapshot.legacyCharacterDescription;
      return {
        characterId: snapshot.characterId,
        characterDescription: effectiveCharacterDescription,
        sheetReferenceStoragePaths:
          presetReferenceStoragePaths.length > 0
            ? presetReferenceStoragePaths
            : fallbackStoragePaths,
        sheetReferenceUrls: presetReferenceUrls.length > 0 ? presetReferenceUrls : fallbackUrls,
        loadedAtMs: Date.now(),
      };
    },
    []
  );

  const refreshBundleReferenceUrlsForSubmission = useCallback(
    async (bundle: CharacterModeInjectionBundle): Promise<CharacterModeInjectionBundle | null> => {
      const fallbackUrls = Array.from(
        new Set(
          bundle.sheetReferenceUrls.map((value) => value.trim()).filter((value) => value.length > 0)
        )
      );
      if (!bundle.sheetReferenceStoragePaths.length) {
        return {
          ...bundle,
          sheetReferenceUrls: fallbackUrls,
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
        const refreshEmptyData = {
          selected_character_id: bundle.characterId,
          storage_path_count: bundle.sheetReferenceStoragePaths.length,
          fallback_url_count: fallbackUrls.length,
        };
        trackCharacterModeEvent("character_mode_reference_refresh_empty", refreshEmptyData);
        logCharacterModeTelemetry("character_mode_reference_refresh_empty", refreshEmptyData);
        return {
          ...bundle,
          sheetReferenceUrls: fallbackUrls,
          loadedAtMs: Date.now(),
        };
      }
      return {
        ...bundle,
        sheetReferenceUrls: Array.from(new Set(refreshedUrls)),
        loadedAtMs: Date.now(),
      };
    },
    [logCharacterModeTelemetry, trackCharacterModeEvent]
  );

  const refreshCharacterModeInjectionBundleForSubmission = useCallback(
    async (tool: ToolId | null): Promise<CharacterModeInjectionBundle | null> => {
      const isCharacterModeEligibleTool =
        tool === "create" || tool === "text" || tool === "edit" || tool === "image";
      if (!isCharacterModeEnabled || !isCharacterModeEligibleTool) {
        return characterModeInjectionBundle;
      }
      if (!selectedCharacterId) return null;

      const currentBundle = characterModeInjectionBundle;
      const bundleAgeMs = currentBundle ? Date.now() - currentBundle.loadedAtMs : 0;

      setIsCharacterBundleLoading(true);
      trackCharacterModeEvent("character_mode_bundle_refresh_before_submit", {
        reason: "submit_refresh",
        selected_character_id: selectedCharacterId,
        bundle_age_ms: currentBundle ? bundleAgeMs : null,
      });
      try {
        const baseBundle = toCharacterModeInjectionBundle(
          await loadCharacterManagerDraftByCharacterId(selectedCharacterId)
        );
        if (!baseBundle || baseBundle.characterId !== selectedCharacterId) {
          setCharacterModeInjectionBundle(null);
          return null;
        }
        const refreshedBundle = await refreshBundleReferenceUrlsForSubmission(baseBundle);
        if (!refreshedBundle) {
          setCharacterModeInjectionBundle(null);
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
        if (isCharacterUnavailableError(error)) {
          setCharacterModeInjectionBundle(null);
          return null;
        }
        if (currentBundle?.characterId === selectedCharacterId) {
          return currentBundle;
        }
        return null;
      } finally {
        setIsCharacterBundleLoading(false);
      }
    },
    [
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
      bundleOverride?: CharacterModeInjectionBundle | null,
      userReferenceInputs: string[] = []
    ): CharacterModeSubmissionOverrides => {
      const isCharacterModeEligibleTool =
        tool === "create" || tool === "text" || tool === "edit" || tool === "image";
      if (!isCharacterModeEnabled || !isCharacterModeEligibleTool) return null;

      const bundle = bundleOverride === undefined ? characterModeInjectionBundle : bundleOverride;
      const characterDescription = bundle?.characterDescription ?? "";
      const characterReferences = bundle?.sheetReferenceUrls ?? [];
      const submissionPrompt = composeCharacterModePrompt({
        characterDescription,
        userPrompt,
      });
      const referenceInputs = mergeCharacterAndUserReferences(
        userReferenceInputs,
        characterReferences
      );
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
      if (TELEMETRY_FALLBACK_CODES.includes(overrides.fallbackCode)) {
        logCharacterModeTelemetry(`character_mode_injection_fallback.${overrides.fallbackCode}`, {
          fallback_code: overrides.fallbackCode,
          selected_character_id: selectedCharacterId || null,
          tool: tool ?? null,
          has_character_description: overrides.hasCharacterDescription,
          character_reference_count: overrides.characterReferenceCount,
        });
      }
    },
    [logCharacterModeTelemetry, selectedCharacterId, trackCharacterModeEvent]
  );

  return {
    toCharacterModeInjectionBundle,
    refreshCharacterModeInjectionBundleForSubmission,
    resolveCharacterModeSubmissionOverrides,
    trackCharacterModeFallback,
  };
};
