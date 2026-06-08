type JsonObject = Record<string, unknown>;

const WORKSPACE_RUNTIME_KEY_MAX_LENGTH = 160;

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const readGenerationProjectIdFromContext = (
  context: JsonObject | null | undefined
): string | null => {
  const source = asObject(context);
  return asTrimmedString(source.project_id) ?? asTrimmedString(source.projectId);
};

export const normalizeGenerationWorkspaceRuntimeKey = (value: unknown): string | null => {
  const trimmed = asTrimmedString(value);
  if (!trimmed || trimmed.length > WORKSPACE_RUNTIME_KEY_MAX_LENGTH) return null;
  return trimmed;
};

export const readGenerationWorkspaceRuntimeKeyFromContext = ({
  context,
  projectId = null,
}: {
  context: JsonObject | null | undefined;
  projectId?: string | null;
}): string | null => {
  const source = asObject(context);
  const resolvedProjectId =
    asTrimmedString(projectId) ?? readGenerationProjectIdFromContext(source);
  if (resolvedProjectId) return null;
  return (
    normalizeGenerationWorkspaceRuntimeKey(source.workspace_runtime_key) ??
    normalizeGenerationWorkspaceRuntimeKey(source.workspaceRuntimeKey)
  );
};

export const readGenerationWorkspaceRuntimeKeyFromMetadata = (
  metadata: JsonObject | null | undefined
): string | null => {
  const source = asObject(metadata);
  const shortpulseContext = asObject(source.shortpulse_context ?? source.shortpulseContext);
  const projectId =
    asTrimmedString(source.project_id) ??
    asTrimmedString(source.projectId) ??
    readGenerationProjectIdFromContext(shortpulseContext);
  return (
    (projectId
      ? null
      : (normalizeGenerationWorkspaceRuntimeKey(source.workspace_runtime_key) ??
        normalizeGenerationWorkspaceRuntimeKey(source.workspaceRuntimeKey))) ??
    readGenerationWorkspaceRuntimeKeyFromContext({
      context: shortpulseContext,
      projectId,
    })
  );
};
