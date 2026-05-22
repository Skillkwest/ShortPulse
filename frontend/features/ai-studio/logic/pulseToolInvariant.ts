import type { ToolId } from "../types";

export type PulseToolInvariantCreateMode = "standard" | "pulse";

const PULSE_CREATE_AUTHORITY_SUFFIX = ":create:pulse";
const STANDARD_CREATE_AUTHORITY_SUFFIX = ":create:standard";

export const normalizeSelectedToolForExpertCreateMode = (
  expertCreateMode: PulseToolInvariantCreateMode,
  selectedTool: ToolId | null
): ToolId | null => {
  void expertCreateMode;
  return selectedTool;
};

export const isPulseCreateAuthorityKey = (authorityKey: string): boolean =>
  authorityKey.endsWith(PULSE_CREATE_AUTHORITY_SUFFIX);

export const isStandardCreateAuthorityKey = (authorityKey: string): boolean =>
  authorityKey.endsWith(STANDARD_CREATE_AUTHORITY_SUFFIX);

const getCreateAuthorityBase = (authorityKey: string): string | null => {
  if (isPulseCreateAuthorityKey(authorityKey)) {
    return authorityKey.slice(0, -PULSE_CREATE_AUTHORITY_SUFFIX.length);
  }
  if (isStandardCreateAuthorityKey(authorityKey)) {
    return authorityKey.slice(0, -STANDARD_CREATE_AUTHORITY_SUFFIX.length);
  }
  return null;
};

export const isCreateModeAuthoritySwitch = (
  previousAuthorityKey: string,
  nextAuthorityKey: string
): boolean => {
  const previousBase = getCreateAuthorityBase(previousAuthorityKey);
  if (!previousBase) return false;
  const nextBase = getCreateAuthorityBase(nextAuthorityKey);
  return nextBase != null && previousBase === nextBase && previousAuthorityKey !== nextAuthorityKey;
};

export const normalizeSelectedToolForAuthorityKey = (
  authorityKey: string,
  selectedTool: ToolId | null
): ToolId | null => {
  void authorityKey;
  return selectedTool;
};
