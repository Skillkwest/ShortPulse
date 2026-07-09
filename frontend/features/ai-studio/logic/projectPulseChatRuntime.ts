/**
 * Project Pulse chat runtime guards.
 * Keeps the Pulse `Chats` rail visible for project-backed sessions and prevents autosave from
 * treating an unhydrated empty in-memory state as an intentional saved-chat deletion.
 */

/**
 * Returns whether the Pulse left rail should show the project-owned `Chats` card.
 */
export const shouldShowProjectPulseChatHistory = ({
  projectRouteRequested,
  projectId,
  threadCount,
}: {
  projectRouteRequested: boolean;
  projectId: string | null | undefined;
  threadCount: number;
}): boolean => projectRouteRequested || Boolean(projectId) || threadCount > 0;

/**
 * Returns whether a project workspace save may write the `pulseChats` field.
 */
export const shouldPatchProjectPulseChats = ({
  projectAuthorityKey,
  hydratedProjectAuthorityKey,
  threadCount,
}: {
  projectAuthorityKey: string | null;
  hydratedProjectAuthorityKey: string | null;
  threadCount: number;
}): boolean =>
  threadCount > 0 ||
  (projectAuthorityKey != null && hydratedProjectAuthorityKey === projectAuthorityKey);
