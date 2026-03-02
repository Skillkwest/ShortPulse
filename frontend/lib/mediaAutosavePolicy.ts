/**
 * Shared media autosave policy decisions for AI Studio client and server paths.
 * Keeps manual/auto persistence eligibility deterministic and testable.
 */

export type PersistenceIntent = "manual" | "auto";

export type MediaAutosaveSource = "generated" | "upload" | "clipboard" | "library" | "prompt";

export type AutoSaveDecision = {
  allowed: boolean;
  reason:
    | "manual_allowed"
    | "autosave_disabled"
    | "already_saved"
    | "already_persisted_library"
    | "no_media"
    | "prompt_only_reference"
    | "auto_allowed";
};

export type AutoSaveEligibilityInput = {
  intent: PersistenceIntent;
  source: MediaAutosaveSource;
  mediaAutosaveEnabled: boolean;
  hasMedia: boolean;
  hasPromptOnlyText?: boolean;
  saveState?: "idle" | "saving" | "saved" | "failed" | null;
  savedMediaIds?: string[] | null;
};

const hasPersistedMediaIds = (savedMediaIds: string[] | null | undefined): boolean =>
  Boolean(savedMediaIds?.some((id) => id.trim().length > 0));

/**
 * Returns a policy decision for whether a media output may be persisted.
 */
export const canAutoSaveOutput = (input: AutoSaveEligibilityInput): AutoSaveDecision => {
  if (input.intent === "manual") {
    return { allowed: true, reason: "manual_allowed" };
  }
  if (!input.mediaAutosaveEnabled) {
    return { allowed: false, reason: "autosave_disabled" };
  }
  if (input.source === "library" && hasPersistedMediaIds(input.savedMediaIds)) {
    return { allowed: false, reason: "already_persisted_library" };
  }
  if (
    hasPersistedMediaIds(input.savedMediaIds) ||
    input.saveState === "saved" ||
    input.saveState === "saving"
  ) {
    return { allowed: false, reason: "already_saved" };
  }
  if (input.hasPromptOnlyText && !input.hasMedia) {
    return { allowed: false, reason: "prompt_only_reference" };
  }
  if (!input.hasMedia) {
    return { allowed: false, reason: "no_media" };
  }
  return { allowed: true, reason: "auto_allowed" };
};

/**
 * Alias helper for recovery/media persistence call sites.
 */
export const canAutoPersistRecoveryMedia = ({
  intent,
  mediaAutosaveEnabled,
}: {
  intent: PersistenceIntent;
  mediaAutosaveEnabled: boolean;
}): AutoSaveDecision =>
  canAutoSaveOutput({
    intent,
    source: "generated",
    mediaAutosaveEnabled,
    hasMedia: true,
  });

/**
 * Predicate helper used by client autosave orchestration.
 */
export const isAutoSaveEligibleOutput = (input: AutoSaveEligibilityInput): boolean =>
  canAutoSaveOutput(input).allowed;
