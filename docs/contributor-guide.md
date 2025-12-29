# Contributor Guide

Purpose: shared expectations for collaborating on ShortPulse.

## Branching/PRs
- Use short feature branches (`feature/<topic>` or `fix/<topic>`).
- Keep PRs focused; avoid mixing refactors with feature work when possible.
- Include a brief summary and testing notes in PR descriptions.

## Reviews
- Check for file-size guardrails (<500 lines) and single responsibility per file.
- Ensure public functions/files have doc comments per `docs/conventions.md`.
- Verify new logic is covered by tests (or note gaps).

## Migrations / DB changes
- Add Alembic migrations under `backend/alembic/versions/`.
- Document schema changes in the Data Dictionary.
- Avoid destructive changes without clear rollback notes.

## Coding standards
- Follow `docs/conventions.md` for structure/comments/style.
- Prefer pure logic in `logic/` or `utils/`; pages orchestrate.
- Keep CSS in the correct domain file and update `globals.css` imports if new files are added.

## Communication
- Log notable progress in `docs/progress_log.md` when appropriate.
- Add new docs to `docs/documentation_overview.md` so discovery stays easy.
