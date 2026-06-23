/**
 * Shared Project Workspace persistence byte budgets.
 *
 * The route limit is the hard request envelope. The snapshot budget leaves
 * headroom for the JSON wrapper around `{ schemaVersion, snapshot }`.
 */
export const PROJECT_WORKSPACE_ROUTE_BODY_LIMIT_BYTES = 1024 * 1024;
export const PROJECT_WORKSPACE_MAX_SNAPSHOT_BYTES = 900_000;
export const PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES = PROJECT_WORKSPACE_MAX_SNAPSHOT_BYTES;
export const PROJECT_WORKSPACE_KEEPALIVE_MAX_SNAPSHOT_BYTES = 60_000;
