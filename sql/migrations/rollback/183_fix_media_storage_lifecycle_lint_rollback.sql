-- Roll back the lint-only rewrite by restoring the prior migration's function body.
-- This intentionally replays 182, which preserves the staged-audio constraint and
-- restores the previous temp-table implementation of get_media_storage_lifecycle_summary.

\ir ../182_add_voice_changer_staged_audio_lifecycle.sql
