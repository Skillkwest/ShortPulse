import { ELEVENLABS_DEFAULT_VOICES } from "../model-runtime/elevenLabsDefaultVoices";
import { sanitizeCustomerFacingProviderText } from "../customerFacingProviderText";
import type { SavedAiStudioVoice, SavedAiStudioVoiceOriginKind } from "./api/userSavedVoices";
import type { ElevenLabsVoice } from "./elevenlabs";
import { isExcludedElevenLabsVoiceId } from "./elevenlabsVoiceExclusions";

export type VoiceOriginKind =
  | "fallback-default"
  | "provider-default"
  | "provider-saved"
  | "provider-user-created"
  | "legacy-saved";

export type VoiceDestructiveAction = "none" | "remove" | "delete";

export type ResolvedVoiceLibraryEntry = {
  voiceId: string;
  name: string;
  previewUrl: string | null;
  description: string | null;
  isFallback: boolean;
  librarySection: "default" | "my";
  provider: "elevenlabs";
  providerCategory: string | null;
  providerVoiceType: string | null;
  originKind: VoiceOriginKind;
  canRemoveFromLibrary: boolean;
  canDeleteFromProvider: boolean;
  destructiveAction: VoiceDestructiveAction;
  destructiveActionLabel: "Remove" | "Delete" | null;
  destructiveActionDescription: string | null;
  destructiveActionDisabledReason: string | null;
};

export type ResolvedVoiceAccess = {
  accessKind: "saved" | "provider-shared";
  providerVoice: ElevenLabsVoice | null;
  savedVoice: SavedAiStudioVoice | null;
  resolvedVoice: ResolvedVoiceLibraryEntry;
};

const normalizeLookupKey = (voiceId: string): string => voiceId.trim().toLowerCase();

const sanitizeOptionalVoiceText = (value: string | null | undefined): string | null => {
  const sanitized = sanitizeCustomerFacingProviderText(value, "");
  return sanitized || null;
};

const shouldExcludeResolvedVoiceEntry = (entry: ResolvedVoiceLibraryEntry): boolean =>
  isExcludedElevenLabsVoiceId(entry.voiceId);

const providerCategoryImpliesUserCreated = (category: string | null): boolean =>
  category === "cloned" || category === "generated";

const isSharedProviderCatalogVoice = (providerVoice: ElevenLabsVoice): boolean =>
  providerVoice.isFallback ||
  providerVoice.providerCategory === "premade" ||
  providerVoice.providerVoiceType === "default";

const shouldHideUnownedProviderVoice = ({
  providerVoice,
  savedVoice,
}: {
  providerVoice: ElevenLabsVoice | null;
  savedVoice: SavedAiStudioVoice | null;
}): boolean =>
  Boolean(providerVoice && !savedVoice && !isSharedProviderCatalogVoice(providerVoice));

const resolveOriginKind = ({
  providerVoice,
  savedVoice,
}: {
  providerVoice: ElevenLabsVoice | null;
  savedVoice: SavedAiStudioVoice | null;
}): VoiceOriginKind => {
  if (providerVoice?.isFallback) {
    return "fallback-default";
  }

  const savedOrigin = savedVoice?.originKind ?? null;
  if (savedOrigin === "provider-user-created") {
    return "provider-user-created";
  }
  if (savedOrigin === "provider-saved") {
    return "provider-saved";
  }
  if (savedOrigin === "provider-default") {
    return "provider-default";
  }

  if (savedVoice && providerVoice) {
    return "provider-saved";
  }

  if (savedVoice) {
    return "legacy-saved";
  }

  return "provider-default";
};

const resolveProviderDeleteEligibility = ({
  savedVoice,
}: {
  savedVoice: SavedAiStudioVoice | null;
}): boolean => {
  if (savedVoice?.providerDeleteEligible === true) return true;
  return false;
};

const buildDestructiveActionState = ({
  isFallback,
  providerCategory,
  canRemoveFromLibrary,
  canDeleteFromProvider,
}: {
  isFallback: boolean;
  providerCategory: string | null;
  canRemoveFromLibrary: boolean;
  canDeleteFromProvider: boolean;
}): Pick<
  ResolvedVoiceLibraryEntry,
  | "destructiveAction"
  | "destructiveActionLabel"
  | "destructiveActionDescription"
  | "destructiveActionDisabledReason"
> => {
  if (canDeleteFromProvider) {
    return {
      destructiveAction: "delete",
      destructiveActionLabel: "Delete",
      destructiveActionDescription:
        "Delete this voice from your ShortPulse voice library and remove it from saved voices.",
      destructiveActionDisabledReason: null,
    };
  }
  if (canRemoveFromLibrary) {
    return {
      destructiveAction: "remove",
      destructiveActionLabel: "Remove",
      destructiveActionDescription: "Remove this voice from your ShortPulse saved voices.",
      destructiveActionDisabledReason: null,
    };
  }
  if (isFallback) {
    return {
      destructiveAction: "none",
      destructiveActionLabel: null,
      destructiveActionDescription: null,
      destructiveActionDisabledReason: "Built-in voices can't be deleted here.",
    };
  }
  if (providerCategory === "premade") {
    return {
      destructiveAction: "none",
      destructiveActionLabel: null,
      destructiveActionDescription: null,
      destructiveActionDisabledReason: "Built-in catalog voices can't be deleted here.",
    };
  }
  return {
    destructiveAction: "none",
    destructiveActionLabel: null,
    destructiveActionDescription: null,
    destructiveActionDisabledReason: "This voice can't be deleted here.",
  };
};

export const resolveVoiceLibraryEntry = ({
  providerVoice,
  savedVoice,
}: {
  providerVoice: ElevenLabsVoice | null;
  savedVoice: SavedAiStudioVoice | null;
}): ResolvedVoiceLibraryEntry | null => {
  const baseVoice = providerVoice ?? savedVoice;
  if (!baseVoice) return null;
  if (shouldHideUnownedProviderVoice({ providerVoice, savedVoice })) {
    return null;
  }

  const originKind = resolveOriginKind({ providerVoice, savedVoice });
  const librarySection: "default" | "my" = savedVoice ? "my" : "default";
  const canRemoveFromLibrary = Boolean(savedVoice);
  const canDeleteFromProvider = resolveProviderDeleteEligibility({
    savedVoice,
  });
  const previewUrl = providerVoice?.previewUrl ?? savedVoice?.previewUrl ?? null;
  const description = providerVoice?.description ?? savedVoice?.description ?? null;

  return {
    voiceId: baseVoice.voiceId,
    name: sanitizeCustomerFacingProviderText(baseVoice.name, "Voice"),
    previewUrl,
    description: sanitizeOptionalVoiceText(description),
    isFallback: Boolean(providerVoice?.isFallback ?? baseVoice.isFallback),
    librarySection,
    provider: "elevenlabs",
    providerCategory: providerVoice?.providerCategory ?? null,
    providerVoiceType: providerVoice?.providerVoiceType ?? null,
    originKind,
    canRemoveFromLibrary,
    canDeleteFromProvider,
    ...buildDestructiveActionState({
      isFallback: Boolean(providerVoice?.isFallback ?? baseVoice.isFallback),
      providerCategory: providerVoice?.providerCategory ?? null,
      canRemoveFromLibrary,
      canDeleteFromProvider,
    }),
  };
};

export const buildResolvedVoiceLibraryEntries = ({
  providerVoices,
  savedVoices,
}: {
  providerVoices: ElevenLabsVoice[];
  savedVoices: SavedAiStudioVoice[];
}): ResolvedVoiceLibraryEntry[] => {
  const providerVoiceMap = new Map(
    providerVoices.map((voice) => [normalizeLookupKey(voice.voiceId), voice] as const)
  );
  const savedVoiceMap = new Map(
    savedVoices.map((voice) => [normalizeLookupKey(voice.voiceId), voice] as const)
  );
  const orderedIds = Array.from(
    new Set([
      ...providerVoices.map((voice) => normalizeLookupKey(voice.voiceId)),
      ...savedVoices.map((voice) => normalizeLookupKey(voice.voiceId)),
    ])
  );

  return orderedIds.flatMap((voiceId) => {
    const resolved = resolveVoiceLibraryEntry({
      providerVoice: providerVoiceMap.get(voiceId) ?? null,
      savedVoice: savedVoiceMap.get(voiceId) ?? null,
    });
    if (!resolved || shouldExcludeResolvedVoiceEntry(resolved)) return [];
    return [resolved];
  });
};

export const resolveVoiceAccessForUser = ({
  voiceId,
  providerVoices,
  savedVoices,
}: {
  voiceId: string;
  providerVoices: ElevenLabsVoice[];
  savedVoices: SavedAiStudioVoice[];
}): ResolvedVoiceAccess | null => {
  const normalizedVoiceId = normalizeLookupKey(voiceId);
  if (!normalizedVoiceId) {
    return null;
  }

  const providerVoice =
    providerVoices.find((voice) => normalizeLookupKey(voice.voiceId) === normalizedVoiceId) ?? null;
  const savedVoice =
    savedVoices.find((voice) => normalizeLookupKey(voice.voiceId) === normalizedVoiceId) ?? null;
  const resolvedVoice = resolveVoiceLibraryEntry({
    providerVoice,
    savedVoice,
  });

  if (!resolvedVoice || resolvedVoice.isFallback) {
    return null;
  }

  return {
    accessKind: savedVoice ? "saved" : "provider-shared",
    providerVoice,
    savedVoice,
    resolvedVoice,
  };
};

export const buildFallbackVoiceLibraryEntries = (): ResolvedVoiceLibraryEntry[] =>
  ELEVENLABS_DEFAULT_VOICES.filter(
    (voice) => !isExcludedElevenLabsVoiceId(voice.fallbackVoiceId)
  ).map((voice) => ({
    voiceId: voice.fallbackVoiceId,
    name: sanitizeCustomerFacingProviderText(voice.name, "Voice"),
    previewUrl: null,
    description: sanitizeOptionalVoiceText(voice.description),
    isFallback: true,
    librarySection: "default",
    provider: "elevenlabs",
    providerCategory: "premade",
    providerVoiceType: "default",
    originKind: "fallback-default",
    canRemoveFromLibrary: false,
    canDeleteFromProvider: false,
    destructiveAction: "none",
    destructiveActionLabel: null,
    destructiveActionDescription: null,
    destructiveActionDisabledReason: "Built-in voices can't be deleted here.",
  }));

export const resolveSavedVoiceOriginKindFromProvider = (
  providerVoice: ElevenLabsVoice | null
): SavedAiStudioVoiceOriginKind => {
  if (providerCategoryImpliesUserCreated(providerVoice?.providerCategory ?? null)) {
    return "provider-user-created";
  }
  if (providerVoice?.providerCategory === "premade") {
    return "provider-default";
  }
  return "provider-saved";
};
