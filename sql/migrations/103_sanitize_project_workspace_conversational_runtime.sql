-- Sanitize existing project workspace rows so projects no longer retain
-- conversational runtime history or Pulse workflow progress in storage.

DO $$
BEGIN
  IF to_regclass('public.project_workspace_states') IS NULL THEN
    RAISE EXCEPTION 'public.project_workspace_states table is required before applying migration 103';
  END IF;
END;
$$;

WITH sanitized_rows AS (
  SELECT
    project_id,
    jsonb_set(
      snapshot - 'agentRuntimes' - 'meta',
      '{agent}',
      jsonb_build_object(
        'messages', '[]'::jsonb,
        'input', '',
        'latestAgentPrompt', NULL,
        'promptOrigin', 'manual',
        'chatModeEnabled', true,
        'pulseWorkflowSession', NULL
      ),
      true
    ) AS sanitized_snapshot
  FROM public.project_workspace_states
  WHERE jsonb_typeof(snapshot) = 'object'
)
UPDATE public.project_workspace_states target
SET
  snapshot = sanitized_rows.sanitized_snapshot,
  updated_at = timezone('utc', now())
FROM sanitized_rows
WHERE target.project_id = sanitized_rows.project_id
  AND target.snapshot IS DISTINCT FROM sanitized_rows.sanitized_snapshot;
