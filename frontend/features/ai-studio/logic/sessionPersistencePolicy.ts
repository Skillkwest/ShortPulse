/**
 * AI Studio session-persistence runtime policy.
 * Centralizes client-side feature flags so write/restore/session-list paths stay in sync.
 */

const isEnabled = (value: string | undefined, fallback = true): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

/**
 * Returns the normalized client runtime policy for AI Studio session persistence.
 */
export const readAiStudioSessionPersistencePolicy = () => {
  const persistenceEnabled = isEnabled(
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED,
    false
  );
  const writeShadowEnabled =
    persistenceEnabled &&
    isEnabled(process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED, true);
  const remoteShadowEnabled =
    writeShadowEnabled &&
    isEnabled(process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED, true);
  const restoreShadowEnabled =
    persistenceEnabled &&
    isEnabled(process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED, true);
  const restoreRemoteEnabled = restoreShadowEnabled && remoteShadowEnabled;
  const restoreApplyEnabled =
    restoreShadowEnabled &&
    isEnabled(process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED, true);
  const restoreApplyAgentEnabled =
    restoreApplyEnabled &&
    isEnabled(process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED, true);

  return {
    persistenceEnabled,
    writeShadowEnabled,
    remoteShadowEnabled,
    restoreShadowEnabled,
    restoreRemoteEnabled,
    restoreApplyEnabled,
    restoreApplyAgentEnabled,
  };
};
