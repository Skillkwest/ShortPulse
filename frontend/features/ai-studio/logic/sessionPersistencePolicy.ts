/**
 * AI Studio legacy session-persistence runtime policy.
 * This lane is retired; `sid` remains runtime identity only.
 */

/**
 * Returns the normalized client runtime policy for AI Studio session persistence.
 */
export const readAiStudioSessionPersistencePolicy = () => {
  return {
    persistenceEnabled: false,
    writeShadowEnabled: false,
    remoteShadowEnabled: false,
    restoreShadowEnabled: false,
    restoreRemoteEnabled: false,
    restoreApplyEnabled: false,
    restoreApplyAgentEnabled: false,
  };
};
