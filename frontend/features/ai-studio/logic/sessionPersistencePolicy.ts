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

const SESSION_PERSISTENCE_ENABLED = isEnabled(
  process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED,
  true
);

const SESSION_WRITE_SHADOW_ENABLED =
  SESSION_PERSISTENCE_ENABLED &&
  isEnabled(process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED, true);

const SESSION_REMOTE_SHADOW_ENABLED =
  SESSION_WRITE_SHADOW_ENABLED &&
  isEnabled(process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED, true);

const SESSION_RESTORE_SHADOW_ENABLED =
  SESSION_PERSISTENCE_ENABLED &&
  isEnabled(process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED, true);

const SESSION_RESTORE_REMOTE_ENABLED =
  SESSION_RESTORE_SHADOW_ENABLED && SESSION_REMOTE_SHADOW_ENABLED;

const SESSION_RESTORE_APPLY_ENABLED =
  SESSION_RESTORE_SHADOW_ENABLED &&
  isEnabled(process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED, true);

const SESSION_RESTORE_APPLY_AGENT_ENABLED =
  SESSION_RESTORE_APPLY_ENABLED &&
  isEnabled(process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED, true);

/**
 * Returns the normalized client runtime policy for AI Studio session persistence.
 */
export const readAiStudioSessionPersistencePolicy = () => ({
  persistenceEnabled: SESSION_PERSISTENCE_ENABLED,
  writeShadowEnabled: SESSION_WRITE_SHADOW_ENABLED,
  remoteShadowEnabled: SESSION_REMOTE_SHADOW_ENABLED,
  restoreShadowEnabled: SESSION_RESTORE_SHADOW_ENABLED,
  restoreRemoteEnabled: SESSION_RESTORE_REMOTE_ENABLED,
  restoreApplyEnabled: SESSION_RESTORE_APPLY_ENABLED,
  restoreApplyAgentEnabled: SESSION_RESTORE_APPLY_AGENT_ENABLED,
});
