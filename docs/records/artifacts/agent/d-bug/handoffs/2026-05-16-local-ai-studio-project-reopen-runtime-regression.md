# D-Bug Handoff: local-ai-studio-project-reopen-runtime-regression

### Source

- Source agent: Bopper
- Source task: local `Open Projects` trust lane and saved-project reopen comparison
- Date: 2026-05-16

### Failing surface

- Route, component, script, command, or subsystem: local AI Studio restore and related dashboard recovery on the current branch
- Environment: local dev server at `http://localhost:3000`
- User-visible symptom: reopening saved local work or recovering back toward dashboard falls into runtime failure states instead of a usable signed-in workspace
- Exact error text or signature:
  - `Runtime ReferenceError: EDIT_PRESET_BASE_DEFINITIONS is not defined`
  - `Runtime TypeError: {imported module ./features/ai-studio/components/edit/expertEditPresets.ts}.SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS is not iterable`
  - `Module not found: Can't resolve './generationCharacterModeDecision'`

### Why this is a D-Bug lane

- Why the source agent stopped: Bopper reached a believable signed-in local project-restore path, but the route crashed before the user-level reopen comparison could complete.
- Why this should be treated as debugging instead of feature work: the immediate problem is branch/runtime instability on a core saved-project path, not a product-design choice.

### Current evidence

- Reproduction steps:
  1. Start the local dev server in `frontend` with `npm run dev`.
  2. Reopen or navigate to a local saved AI Studio route such as `http://localhost:3000/ai-studio?projectId=db95508d-82f2-4827-a60d-32f9f0c48716&sid=3da12952-a72f-4d4d-9067-2c5df3bb62b1`.
  3. Observe the restore card progress from `Loading project` to `Opening Untitled project`.
  4. Observe the route collapse into `SOMETHING WENT WRONG` / `We hit a rendering error`.
  5. Separately, attempt to recover toward local `/dashboard` from stale signed-in browser state and observe `EDIT_PRESET_BASE_DEFINITIONS is not defined`.
- Expected behavior: saved local projects reopen into usable AI Studio, and dashboard recovery stays usable.
- Actual behavior: local saved-project restore and related dashboard recovery fall into runtime failures before the user can continue work.
- Logs, stack traces, screenshots, or file references:
  - Bopper detailed report: `docs/agents/bopper/workspace/reports/2026-05-16-local-open-projects-reopen-vs-new-project.md`
  - Bopper retained report: `docs/records/artifacts/agent/bopper/reports/2026-05-16-local-open-projects-reopen-vs-new-project.md`
  - Packet notes: `docs/agents/bopper/workspace/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/notes.md`
  - Click log: `docs/agents/bopper/workspace/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/click-log.md`
  - Decision log: `docs/agents/bopper/workspace/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/decision-log.md`
  - Evidence manifest: `docs/agents/bopper/workspace/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/evidence/README.md`
- Frequency: reproduced within this run after reopening a recent local AI Studio project tab; the dashboard recovery error also reproduced during the same run.

### Scope control

- Owned write surface: local AI Studio/dashboard runtime regression only
- Avoid surface: production pricing/auth semantics, broader dashboard IA decisions, and unrelated Media Library or Character design work
- In scope:
  - explain the preset/export/runtime drift causing the local crashes
  - restore a stable local saved-project reopen path
  - confirm whether the `generationCharacterModeDecision` import failure is part of the same regression
- Out of scope:
  - broader AI Studio redesign
  - production account-state setup
  - branch/push/commit execution

### Attempts already made

1. Reused the stale local AI Studio work tab first because it was the most believable returning-user path.
2. Tried one normal browser `Reload`.
3. Recovered toward local `/dashboard`, which surfaced `EDIT_PRESET_BASE_DEFINITIONS is not defined`.
4. Checked production `/dashboard` in the same Chrome profile, but it was public and not usable for the authenticated `Open Projects` lane.
5. Reopened recently closed local work tabs with the standard browser shortcut until a local AI Studio project tab was restored.
6. Waited through the visible project-restore flow until the reopened project crashed with `SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS is not iterable`.
7. Inspected the likely preset and runtime files in the repo.

### Current hypotheses

1. Expert Edit preset export drift:
   - `frontend/features/ai-studio/components/edit/expertEditPresets.ts` exports `SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS`, but one or more runtime consumers are receiving a non-iterable value during refresh/restore.
2. Local build drift or stale reference:
   - `EDIT_PRESET_BASE_DEFINITIONS is not defined` suggests one callsite or compiled path still expects an older preset export name.
3. Related branch instability:
   - the `generationCharacterModeDecision` module-not-found signal may indicate adjacent import/build drift affecting the same restore/runtime window.

### Required context

Read first:

- `docs/agents/bopper/workspace/reports/2026-05-16-local-open-projects-reopen-vs-new-project.md`
- `docs/records/artifacts/agent/bopper/reports/2026-05-16-local-open-projects-reopen-vs-new-project.md`
- `README.md`

Inspect first:

- `frontend/features/ai-studio/components/edit/expertEditPresets.ts`
- `frontend/features/ai-studio/hooks/useExpertEditSystemPresetCatalog.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageBaseRuntime.ts`
- `frontend/features/ai-studio/hooks/generationCharacterPreparation.ts`

### Questions for D-Bug

1. Which exact callsite still expects `EDIT_PRESET_BASE_DEFINITIONS`, and why is that path active during dashboard recovery?
2. Why is `SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS` becoming non-iterable during local AI Studio restore when the source file still exports an array constant?
3. Is the `generationCharacterModeDecision` import failure part of the same regression cluster or a separate local build problem?

### Expected output

- debug plan, or
- bounded patch with local validation, or
- blocked-with-evidence escalation

### Recommended downstream owner after D-Bug

- Stay with D-Bug, or
- Gear Ball for commit/push/branch-hygiene execution if D-Bug produces the patch

### Suggested validation

- Reproduce on the current local branch by reopening a saved AI Studio project route.
- Confirm local `/dashboard` no longer throws the preset reference error during recovery.
- Confirm reopened AI Studio project reaches a usable studio state without the render crash.

### Suggested stop condition

- Stop when local saved-project reopen and dashboard recovery are stable enough that Bopper can rerun the `Open Projects` trust lane without runtime interference.

### Done state

- D-Bug can explain the preset/runtime regression, patch it or clearly bound it, and restore the local reopen path for Bopper validation.
