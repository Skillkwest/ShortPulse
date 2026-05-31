# Datserok Memory

Purpose: keep concise, durable project-persistence truths and working rules for Datserok.

## Current Contract Truths

- `projectId` is the top-level durable project identity for Projects. `sid` still exists, but durable AI Studio save/restore authority no longer lives on the legacy session lane.
- Current durable project workspace save/restore authority is `GET|PUT /api/projects/:projectId/workspace`.
- Project workspace persistence is intentionally sanitized. It restores durable project content, not full session replay.
- Server-side project workspace canonicalization is the true restore safety boundary. The client restore candidate hook parses the returned payload but does not re-sanitize it.
- Project routes do not durably restore unsent Create/Edit/Video/Sound drafts, Standard visible chat continuity, active output focus, Character Mode shell state, or Expert Edit document state.
- Project-visible conversation resets on project open or switch. Hidden Pulse parking can persist only under the narrow authority rules in ADR 0070.
- `saved_with_repair_pending` means the sanitized workspace write succeeded but project asset/generation backfill still needs a later successful repair pass.
- Project asset association is additive: media, prompts, and generated outputs attach to a project without duplicating the user-global inventory.
- `project_generation_items` is not display authority by itself. Visible restored/generated success rows still require durable media authority such as canonical storage, saved media ids, or canonical publication/canonical media delivery.
- Project reopen is hybrid: sanitized snapshot first, then project-scoped generated-output refresh asynchronously from association rows and project-scoped projection rows.
- Media Library folders and folder-canvas state are global across projects. ADR 0085 is the active authority; ADR 0066 and ADR 0067 are superseded history only.
- Project card previews prefer Quick Slot Inventory images first and fall back to visible Reference Grid images only when quick slots have no image previews.
- Project delete removes the owned project row, owned workspace row, and project-only associations by cascade, but it does not delete the global Media Library folder tree.

## Working Rules

- Use `docs/sops/sop_ai_studio_projects_foundation.md` as the shipped contract summary, then confirm the owning code paths.
- Treat retired session persistence docs as historical context only; do not use them as current behavior authority.
- Give one operational answer per decision point. If the real posture is "keep working under the current checklist" rather than "pause for a new formal plan," say that exact distinction once and hold it unless the facts change.
- Collapse nuance when it does not change the next action. Datserok should reduce reconciliation burden on the user, not export internal framing differences.
- When explaining a save/reopen outcome, separate what is:
  - project-owned durable state,
  - user-global state,
  - runtime-only state,
  - and inferred behavior not yet directly validated.
- When expressing confidence, use one stable frame that distinguishes repo-backed, test-backed, and production-backed certainty without making the recommendation itself sound unstable.
- For launch-relevant persistence claims, production URL evidence outranks local inspection. Local code and tests are still valid implementation evidence.
- Datserok ownership boundaries live in `docs/agents/datserok/ownership-manifest.md`; use it before crossing into media display, media ingestion, Create/Pulse runtime, environment, release, security, or readiness-scoring lanes.
- Durable learning belongs here or in `docs/records/artifacts/agent/datserok/`, not in chat alone.
- When a project route is entered or switched, the UI intentionally fails closed to an empty project shell before async restore finishes. If visible project state leaks before bootstrap, treat it as a canonical persistence regression.

## Common Drift To Reject

- "Projects save everything from the last AI Studio session." False under the current sanitized workspace contract.
- "Media folders are project-specific." False under ADR 0085.
- "A repair-pending save failed completely." False; the workspace save succeeded and follow-up association repair is the degraded part.
- "Legacy `sid` restore is the project reopen source of truth." False for project routes.
- "Two differently framed answers are acceptable if they imply the same next action." False; Datserok should synthesize them into one operational answer.
