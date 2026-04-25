/**
 * Canonical Elements prompt-token helpers.
 * Elements no longer author a separate alias field in the UI; workflow tokens derive from name.
 */

/**
 * Derives the hidden workflow token for an Element from its saved name.
 * The token contract matches the existing prompt-token shape used by Kling/Seedance helpers.
 */
export const deriveElementAliasFromName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 64);

/**
 * Resolves the canonical workflow alias exposed to downstream consumers.
 * Falls back to the legacy stored alias only when a usable name-derived token is unavailable.
 */
export const resolveElementWorkflowAlias = ({
  name,
  legacyAlias,
}: {
  name: string;
  legacyAlias?: string | null;
}): string => {
  const derivedAlias = deriveElementAliasFromName(name);
  if (derivedAlias) return derivedAlias;
  return typeof legacyAlias === "string" ? legacyAlias.trim() : "";
};
