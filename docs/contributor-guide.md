# Contributor Guide

Purpose: shared expectations for collaborating on ShortPulse.

## Branching/PRs
- Use short feature branches (`feature/<topic>` or `fix/<topic>`).
- Keep PRs focused; avoid mixing refactors with feature work when possible.
- Include a brief summary and testing notes in PR descriptions.

## Reviews
- Check file-size guidance (~500 lines, advisory) and single responsibility per file.
- Ensure public functions/files have doc comments per `docs/conventions.md`.
- Verify new logic is covered by tests (or note gaps).

## Coding standards
- Follow `docs/conventions.md` for structure/comments/style.
- Prefer pure logic in `logic/` or `utils/`; pages orchestrate.
- Keep CSS in the correct domain file and update `globals.css` imports if new files are added.

## Supabase changes
- If you add or modify tables, mirror the schema in `docs/supabase_full_schema.sql` and update `docs/data-dictionary.md`.
- Keep RLS expectations explicit (per-user policies) and avoid service-role usage on the client.

## Communication
- Log notable updates in `docs/change_log.md` when appropriate.
- Add new docs to `docs/documentation_overview.md` so discovery stays easy.
