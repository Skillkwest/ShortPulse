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

/**
 * Returns true when the currently loaded bundle matches the selected character.
 */
export const hasUsableCharacterModeInjectionBundle = ({
  selectedCharacterId,
  bundle,
}: {
  selectedCharacterId: string;
  bundle: CharacterModeInjectionBundle | null | undefined;
}): boolean => {
  const normalizedSelectedCharacterId = selectedCharacterId.trim();
  if (!normalizedSelectedCharacterId) return false;
  return bundle?.characterId === normalizedSelectedCharacterId;
};

/**
 * Returns true when a bundle is still fresh enough to reuse without a submit-time refresh.
 */
export const isCharacterModeInjectionBundleFresh = ({
  bundle,
  staleAfterMs,
  nowMs = Date.now(),
}: {
  bundle: CharacterModeInjectionBundle | null | undefined;
  staleAfterMs: number;
  nowMs?: number;
}): boolean => {
  if (!bundle) return false;
  if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0) return false;
  return nowMs - bundle.loadedAtMs <= staleAfterMs;
};

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
  editCharacterModeEnabled?: boolean;
  editSelectedCharacterId?: string;
  editCharacterModeInjectionBundle?: CharacterModeInjectionBundle | null;
  isEditCharacterBundleLoading?: boolean;
  characterOptions: CharacterOptionSummary[];
  setCharacterModeInjectionBundle: Dispatch<SetStateAction<CharacterModeInjectionBundle | null>>;
  setIsCharacterBundleLoading: Dispatch<SetStateAction<boolean>>;
  setEditCharacterModeInjectionBundle?: Dispatch<
    SetStateAction<CharacterModeInjectionBundle | null>
  >;
  setIsEditCharacterBundleLoading?: Dispatch<SetStateAction<boolean>>;
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
  editCharacterModeEnabled,
  editSelectedCharacterId,
  editCharacterModeInjectionBundle,
  isEditCharacterBundleLoading,
  characterOptions,
  setCharacterModeInjectionBundle,
  setIsCharacterBundleLoading,
  setEditCharacterModeInjectionBundle,
  setIsEditCharacterBundleLoading,
  trackCharacterModeEvent,
  bundleStaleAfterMs,
}: UseAiStudioCharacterModeControllerParams) => {
  const noopSetBundle: Dispatch<SetStateAction<CharacterModeInjectionBundle | null>> = () => {};
  const noopSetLoading: Dispatch<SetStateAction<boolean>> = () => {};
  const resolveCharacterScope = useCallback((tool: ToolId | null): "create" | "edit" | null => {
    if (tool === "create" || tool === "text") return "create";
    if (tool === "edit" || tool === "image") return "edit";
    return null;
  }, []);
  const resolveCharacterScopeState = useCallback(
    (tool: ToolId | null) => {
      const scope = resolveCharacterScope(tool);
      if (scope === "edit") {
        return {
          scope,
          isEnabled: editCharacterModeEnabled ?? isCharacterModeEnabled,
          selectedId: editSelectedCharacterId ?? selectedCharacterId,
          bundle: editCharacterModeInjectionBundle ?? characterModeInjectionBundle,
          isBundleLoading: isEditCharacterBundleLoading ?? isCharacterBundleLoading,
          setBundle: setEditCharacterModeInjectionBundle ?? noopSetBundle,
          setBundleLoading: setIsEditCharacterBundleLoading ?? noopSetLoading,
        };
      }
      if (scope === "create") {
        return {
          scope,
          isEnabled: isCharacterModeEnabled,
          selectedId: selectedCharacterId,
          bundle: characterModeInjectionBundle,
          isBundleLoading: isCharacterBundleLoading,
          setBundle: setCharacterModeInjectionBundle,
          setBundleLoading: setIsCharacterBundleLoading,
        };
      }
      return {
        scope,
        isEnabled: false,
        selectedId: "",
        bundle: null as CharacterModeInjectionBundle | null,
        isBundleLoading: false,
        setBundle: noopSetBundle,
        setBundleLoading: noopSetLoading,
      };
    },
    [
      characterModeInjectionBundle,
      editCharacterModeEnabled,
      editCharacterModeInjectionBundle,
      editSelectedCharacterId,
      isCharacterBundleLoading,
      isCharacterModeEnabled,
      isEditCharacterBundleLoading,
      selectedCharacterId,
      setCharacterModeInjectionBundle,
      setEditCharacterModeInjectionBundle,
      setIsCharacterBundleLoading,
      setIsEditCharacterBundleLoading,
      resolveCharacterScope,
    ]
  );
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
      const {
        scope,
        isEnabled,
        selectedId,
        bundle: currentBundle,
        setBundle,
        setBundleLoading,
      } = resolveCharacterScopeState(tool);
      if (!scope) return null;
      if (!isEnabled) return currentBundle;
      if (!selectedId) return null;

      const bundleAgeMs = currentBundle ? Date.now() - currentBundle.loadedAtMs : 0;
      const hasUsableCurrentBundle = hasUsableCharacterModeInjectionBundle({
        selectedCharacterId: selectedId,
        bundle: currentBundle,
      });
      const shouldReuseCurrentBundle =
        hasUsableCurrentBundle &&
        isCharacterModeInjectionBundleFresh({
          bundle: currentBundle,
          staleAfterMs: bundleStaleAfterMs,
        });

      if (shouldReuseCurrentBundle) {
        trackCharacterModeEvent("character_mode_bundle_refresh_skipped", {
          reason: "fresh_bundle_reuse",
          character_scope: scope,
          selected_character_id: selectedId,
          bundle_age_ms: bundleAgeMs,
        });
        return currentBundle;
      }

      setBundleLoading(true);
      trackCharacterModeEvent("character_mode_bundle_refresh_before_submit", {
        reason: "submit_refresh",
        character_scope: scope,
        selected_character_id: selectedId,
        bundle_age_ms: currentBundle ? bundleAgeMs : null,
      });
      try {
        const baseBundle = toCharacterModeInjectionBundle(
          await loadCharacterManagerDraftByCharacterId(selectedId)
        );
        if (!baseBundle || baseBundle.characterId !== selectedId) {
          setBundle(null);
          return null;
        }
        const refreshedBundle = await refreshBundleReferenceUrlsForSubmission(baseBundle);
        if (!refreshedBundle) {
          setBundle(null);
          return null;
        }
        setBundle(refreshedBundle);
        return refreshedBundle;
      } catch (error) {
        trackCharacterModeEvent("character_mode_bundle_refresh_failed", {
          character_scope: scope,
          selected_character_id: selectedId,
          error:
            error instanceof Error && error.message.trim().length ? error.message : "unknown_error",
        });
        if (isCharacterUnavailableError(error)) {
          setBundle(null);
          return null;
        }
        if (currentBundle?.characterId === selectedId) {
          return currentBundle;
        }
        return null;
      } finally {
        setBundleLoading(false);
      }
    },
    [
      bundleStaleAfterMs,
      refreshBundleReferenceUrlsForSubmission,
      resolveCharacterScopeState,
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
      const { scope, isEnabled, selectedId, bundle, isBundleLoading } =
        resolveCharacterScopeState(tool);
      if (!scope || !isEnabled) return null;

      const effectiveBundle = bundleOverride === undefined ? bundle : bundleOverride;
      const characterDescription = effectiveBundle?.characterDescription ?? "";
      const characterReferences = effectiveBundle?.sheetReferenceUrls ?? [];
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
        characterOptions.find((option) => option.id === selectedId) ?? null;
      const hasCharacterInjection = hasCharacterDescription || referenceInputs.length > 0;
      const characterContextOverride = hasCharacterInjection
        ? {
            applied: true,
            characterId: effectiveBundle?.characterId ?? selectedId,
            characterName: selectedCharacterOption?.name ?? null,
            characterProfileImageUrl: selectedCharacterOption?.profileImageUrl ?? null,
          }
        : undefined;

      let notice: string | null = null;
      let fallbackCode: CharacterModeFallbackCode | null = null;
      if (!selectedId) {
        notice =
          "Character Mode is enabled with no character selected. Generated without character injection.";
        fallbackCode = "no_character_selected";
      } else if (isBundleLoading) {
        notice = "Character Mode context is still loading. Generated without character injection.";
        fallbackCode = "bundle_loading";
      } else if (!effectiveBundle) {
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
    [characterOptions, resolveCharacterScopeState]
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
      const { scope, selectedId } = resolveCharacterScopeState(tool);
      trackCharacterModeEvent("character_mode_injection_fallback", {
        fallback_code: overrides.fallbackCode,
        character_scope: scope,
        selected_character_id: selectedId || null,
        tool: tool ?? null,
        has_character_description: overrides.hasCharacterDescription,
        character_reference_count: overrides.characterReferenceCount,
      });
      if (TELEMETRY_FALLBACK_CODES.includes(overrides.fallbackCode)) {
        logCharacterModeTelemetry(`character_mode_injection_fallback.${overrides.fallbackCode}`, {
          fallback_code: overrides.fallbackCode,
          character_scope: scope,
          selected_character_id: selectedId || null,
          tool: tool ?? null,
          has_character_description: overrides.hasCharacterDescription,
          character_reference_count: overrides.characterReferenceCount,
        });
      }
    },
    [logCharacterModeTelemetry, resolveCharacterScopeState, trackCharacterModeEvent]
  );

  return {
    toCharacterModeInjectionBundle,
    refreshCharacterModeInjectionBundleForSubmission,
    resolveCharacterModeSubmissionOverrides,
    trackCharacterModeFallback,
  };
};
