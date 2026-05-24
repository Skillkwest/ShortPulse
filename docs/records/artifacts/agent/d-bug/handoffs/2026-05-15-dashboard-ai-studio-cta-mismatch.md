# D-Bug Handoff: dashboard-ai-studio-cta-mismatch

### Source

- Source agent: Beeper
- Source task: production real-user exploratory dashboard audit
- Date: 2026-05-15

### Failing surface

- Route, component, script, command, or subsystem: production `/dashboard` hero quick-action entry into project creation / AI Studio
- Environment: production
- User-visible symptom: the dashboard tells the user `Open the AI Studio`, but the click does not open AI Studio or change route
- Exact error text or signature: no thrown runtime error; user-facing semantics failure where `New Project` helper copy says `Open the AI Studio` and the click opens an inline `Name project` modal on `/dashboard`

### Why this is a D-Bug lane

- Why the source agent stopped: Beeper confirmed the live user-path mismatch, captured evidence, and narrowed the likely code surfaces, but did not patch because the next step is deciding whether this is copy drift, route wiring drift, or an intentional product model that the dashboard no longer describes correctly.
- Why this should be treated as debugging instead of feature work: the immediate problem is explaining why a production entry point promises one destination and triggers a different first step. That needs a clear diagnosis before any copy or flow change is made.

### Current evidence

- Reproduction steps:
  1. Sign into production as the Beeper audit user.
  2. Land on `/dashboard`.
  3. Click the `New Project` hero card with helper text `Open the AI Studio`.
  4. Observe that the user remains on `/dashboard` and the inline `Name project` modal opens.
- Expected behavior: either the click should open AI Studio, or the dashboard copy should clearly state that the first step is project creation on the dashboard.
- Actual behavior: the CTA language promises AI Studio, but the first click opens the project-name modal without route change.
- Logs, stack traces, screenshots, or file references:
  - Beeper retained report: `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-real-user-exploratory.md`
  - Beeper full workflow report: `docs/agents/beeper/workspace/reports/2026-05-15-production-dashboard-entry-and-settings-ux.md`
  - Packet notes: `docs/agents/beeper/workspace/runs/2026-05-15-125952-prod-real-user-exploratory/notes.md`
  - Evidence JSON: `docs/agents/beeper/workspace/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/dashboard-entry-flow-summary.json`
  - Evidence screenshot: `docs/agents/beeper/workspace/runs/2026-05-15-125952-prod-real-user-exploratory/evidence/real-user-05-dashboard-ai-studio-cta-modal.png`
- Frequency: reproduced on the first real-user production dashboard pass; deterministic in that run.

### Scope control

- Owned write surface: dashboard CTA semantics / project-entry debug lane only
- Avoid surface: unrelated settings UX, project persistence internals, Media Library issues, and broad dashboard redesign
- In scope:
  - confirm whether the product is intentionally project-first before AI Studio entry
  - explain why the dashboard helper copy still says `Open the AI Studio`
  - identify the smallest safe correction path
- Out of scope:
  - full dashboard IA redesign
  - production content-policy decisions beyond naming/copy/flow alignment
  - branch/push/commit execution

### Attempts already made

1. Ran the production dashboard flow like a real user instead of route-jumping.
2. Clicked the dashboard `New Project` card and captured the resulting modal-open state without route change.
3. Canceled and compared adjacent entry controls: `Open Projects` and `Open the project library` both route to the same in-page projects overlay.
4. Inspected the project-create dialog state and confirmed `Untitled project` is prefilled, so the modal behavior is not a blank-validation failure.
5. Read the dashboard and project-creation code surfaces to confirm the CTA wiring path.

### Current hypotheses

1. Dashboard copy drift: the helper text `Open the AI Studio` survived after the product shifted to project-first entry from the dashboard.
2. Intentional flow, misleading label: opening the project-name modal on the dashboard is deliberate, but the hero card still describes the old or broader destination rather than the real first step.
3. UX debt compounded by adjacent duplication: the same surface also uses `Open Projects` / `Open the project library` for one overlay, which suggests the whole dashboard launch model may have accumulated semantic drift.

### Required context

Read first:

- `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-real-user-exploratory.md`
- `docs/agents/beeper/workspace/reports/2026-05-15-production-dashboard-entry-and-settings-ux.md`
- `docs/routes.md`

Inspect first:

- `frontend/features/dashboard/components/AuthenticatedDashboardView.tsx` around lines `91-113`
- `frontend/pages/dashboard.tsx` around lines `607-626`
- `frontend/features/projects/hooks/useProjectCreationDialog.ts` around lines `34-45`
- `frontend/features/projects/logic/projectCreateClient.ts` around line `7`
- `frontend/features/ai-studio/components/ProjectsModal.tsx` around lines `362-386`

### Questions for D-Bug

1. What is the smallest credible failing surface: copy drift, dashboard CTA wiring drift, or an intentional flow that lacks accurate user-facing language?
2. Is there any existing route or component contract that proves the dashboard CTA is supposed to navigate into AI Studio rather than open the project-name modal?
3. What is the safest correction path: relabel the CTA, move project naming into AI Studio, or split the launch surfaces more clearly?

### Expected output

- debug plan, or
- bounded patch with validation, or
- blocked-with-evidence escalation

### Recommended downstream owner after D-Bug

- Stay with D-Bug, or
- Gear Ball for commit/push/branch-hygiene execution if D-Bug produces the patch

### Suggested validation

- Reproduce on production `/dashboard` with the same audit account
- Confirm the current code path from the hero card click into `ProjectNameModal`
- If a patch is proposed, validate that the first-click language and destination now match on the dashboard

### Suggested stop condition

- Stop when D-Bug can explain whether the mismatch is intentional product behavior with stale copy, or true wiring drift, and can name the smallest fix path with validation.
- If the correct next step turns into a broader product-design decision rather than a bug/debug lane, stop with evidence and hand it back as product/UX follow-up rather than forcing a code patch.

### Done state

- D-Bug can explain why the production dashboard CTA tells the user `Open the AI Studio` while opening the project-name modal on `/dashboard`, and can point to the smallest fix path another engineer can execute without guesswork.

### Closeout artifact

- Preferred retained path:
  - `docs/records/artifacts/agent/d-bug/reports/`
- Suggested filename:
  - `2026-05-15-dashboard-ai-studio-cta-mismatch.md`
