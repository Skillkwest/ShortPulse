# Bopper Run Report - 2026-05-15 - dashboard-new-project-dead-end

Purpose: Dashboard first-click project creation dead-end audit.

## Task

- Requested work: Dashboard first-click project creation dead-end audit
- Environment: local
- Base URL: http://localhost:3000
- Runtime project ref: `projectId=db95508d-82f2-4827-a60d-32f9f0c48716`
- Audit user: `codexledger20260513@gmail.com`
- Trainer directives consulted:
  - root `AGENTS.md`
  - `docs/agents/bopper/README.md`
  - `docs/agents/bopper/memory.md`
  - `docs/agents/bopper/standard-operating-procedure.md`
- Tools used:
  - local Next.js dev server via `npm run dev`
  - Computer Use with Chrome
  - targeted repo inspection with `rg` / `sed`

## Scope

- Routes covered: `/`, `/ai-studio?projectId=...&sid=...`
- Primary naive-user journey: signed-in dashboard -> `New Project` -> default title -> `Create` -> AI Studio entry
- What was intentionally skipped: auth signup/signin, deep AI Studio interaction after failure, non-obvious recovery routes
- Route success target: dashboard user should click the obvious create CTA and land in a usable AI Studio workspace without needing product inference

## Action Log

| Step | Surface | Action | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | `/` dashboard | Loaded the signed-in dashboard in Chrome | Saw `New Project` and `Open Projects`; `New Project` was the clearest primary CTA | Computer Use dashboard state |
| 2 | Dashboard project modal | Clicked `New Project` | `Name project` modal opened with `Untitled project` prefilled | Computer Use project-name modal state |
| 3 | Dashboard project modal | Clicked `Create` without changing the default title | Modal entered a disabled `Creating...` state | Computer Use project-name modal state |
| 4 | `/ai-studio?projectId=...&sid=...` | Waited for route completion | AI Studio rendered `Project unavailable` / `Project not found.` instead of a workspace | Computer Use AI Studio error state |
| 5 | Error-state recovery | Clicked `Open projects` | Recovery modal listed the newly created `Untitled project`, contradicting the error state | Computer Use recovery modal state and dev logs |

## Findings

### Blockers

- Natural dashboard -> AI Studio entry via `New Project` is broken for this run.
  - Repro:
    1. Open the signed-in dashboard.
    2. Click `New Project`.
    3. Leave `Untitled project` as-is.
    4. Click `Create`.
  - Expected:
    - land in AI Studio with a usable fresh project workspace
  - Actual:
    - route changes into `/ai-studio?projectId=...&sid=...`
    - full-page gate shows `Project unavailable`
    - message says `Project not found.`
  - Likely user impact:
    - first meaningful dashboard action looks broken
    - user trust drops immediately
    - average user may assume the studio is unstable and stop

### Functional Issues

- Contradictory recovery path.
  - The project-create call succeeded.
  - The project list still shows the new project.
  - The single-project bootstrap read still fails with `404`.
  - To a normal user, the app simultaneously says the project exists and does not exist.

### UI / UX Notes

- `Creating...` is a blank waiting room. It disables every control without telling the user what is happening or how long it should take.
- The AI Studio error page uses restore-step language that sounds like internal system plumbing rather than actionable user guidance.
- `Open projects` is a reasonable recovery button, but it appears only after the trust break has already happened.

## Average-User Lens

- first click: `New Project`
- what Bopper expected: the fastest route into the studio
- what actually happened: project create succeeded, then the open/read step failed into a full-page error gate
- what Bopper ignored: `Open Projects`, header status cards, `Profile menu`
- what Bopper misunderstood: Bopper took `Open the AI Studio` literally and expected the route to be safe; Bopper also read `Project unavailable` as proof the new project was gone
- abandonment point: before any AI Studio canvas or creative controls became available

## Code Follow-Up

- Probable code surfaces:
  - `frontend/pages/dashboard.tsx`
  - `frontend/features/projects/hooks/useProjectCreationDialog.ts`
  - `frontend/features/projects/logic/projectCreateClient.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioProjectRouteRecovery.ts`
  - `frontend/lib/server/projectApiRoutes/item.ts`
  - `frontend/lib/server/projectsService.ts`
- Supporting docs or tests inspected:
  - `README.md`
  - `docs/routes.md`
  - `docs/testing-guide.md`
  - `frontend/tests/pages/dashboard.actions.test.tsx`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioProjectIdentity.test.ts`
- What another agent should inspect first:
  - why `POST /api/projects/create` succeeds while the immediate project bootstrap read returns `404`
  - whether the single-project route and the project list route are reading the same ownership boundary in local dev
  - whether dashboard tests need an end-to-end create -> readable project assertion rather than only a route-push assertion

## Evidence Packet

- JSON packet: none; this run happened before `packet.json` scaffolding was added during later packet hardening
- Screenshots: Computer Use captures from the dashboard modal, AI Studio error gate, and recovery modal
- Console / runtime signals:
  - `POST /api/projects/create 200 in 2.6s`
  - repeated `GET /api/projects/db95508d-82f2-4827-a60d-32f9f0c48716 404`
  - `GET /api/projects?limit=all 200`
- Local code references:
  - `frontend/pages/dashboard.tsx`
  - `frontend/features/ai-studio/components/AiStudioPageShell.tsx`
  - `frontend/features/ai-studio/components/AiStudioProjectEntryState.tsx`

## Self Audit

- Score out of 10: 9.0
- Confidence tag: `medium`
- Hard gate triggered: none
- What felt strong: believable first-click behavior, clear trust-break capture, strong downstream handoff value
- What slipped: evidence is good but not fully self-contained as saved screenshot files
- Weakest category: evidence quality
- Next-run drill: save a stable screenshot artifact or verify the recovery click into the listed project after the route bug is fixed

## Training Record

- Memory / training-history update needed?: yes; this was Bopper's first real run and it established a reusable contradiction pattern for future average-user audits

## Historical Note

- This retained report predates the later `packet.json` plus `evidence/README.md` packet hardening. Future runs should preserve those structured artifacts directly in the run folder.
