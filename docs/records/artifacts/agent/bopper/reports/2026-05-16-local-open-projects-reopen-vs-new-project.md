## Purpose

Retain the full operator view of the attempted `Open Projects` trust lane after local runtime failures blocked the user-path comparison.

## Task

- Environment: local
- Base URL: `http://localhost:3000`
- Runtime project ref: local reopened AI Studio project `db95508d-82f2-4827-a60d-32f9f0c48716`
- Audit user: mixed browser state only; production dashboard was unauthenticated and local continuity came from reopened recent tabs
- Trainer directives consulted: Bopper contract, memory, SOP, route-success map, retest debt, next-run queue, ADHD-summary rule, and segregation rule
- Tools used: `start-average-run.mjs`, Chrome via Computer Use, local dev server session, repo docs, and targeted code inspection
- Persona lens: male paying-`Studio` ICP who wants low-effort AI-influencer workflow and strongly values saved-work reliability
- Business intent: decide whether reopening saved work feels safer and more trustworthy than starting a new project

## Scope

- Routes covered: public production `/dashboard`, local reopened `/ai-studio?projectId=...`, local recovery attempts back toward `/dashboard`, and browser-level reopen recovery
- Interaction fidelity: `mixed`
- Primary naive-user journey: reopen existing work through the most believable saved-state path and judge whether saved-project continuity feels safer than `New Project`
- What was intentionally skipped: forced login, hidden route-jumps into internal modal state, generation attempts, destructive actions, and admin-style debugging actions inside the browser
- Route success target: reach a believable signed-in projects-open/reopen path and compare its trust/readability against the already-tested `New Project` path
- Retest-debt item: none before the run; this run opened new retest debt
- Lane choice rationale: this was the top queued dashboard lane after the signed-in `New Project` fix retest
- ICP pressure points in scope: saved-work trust, support dependence, time waste, route clarity, and whether the app feels safe enough to rely on for paid work

## Action Log

| Step | Surface | Action | Why Bopper clicked it | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | stale local AI Studio tab | reused the existing local work tab, then clicked browser `Reload` once | A returning user naturally starts from the tab that already looks like his work | reconnect to active local AI Studio | stale local route stayed broken with `This site can't be reached` | Computer Use state, `notes.md` |
| 2 | same local browser state | entered `http://localhost:3000/dashboard` in the address bar | Dashboard is the obvious safe recovery surface before using `Open Projects` | signed-in dashboard with the project entry controls | local dashboard hit a runtime overlay with `EDIT_PRESET_BASE_DEFINITIONS is not defined` | Computer Use state, dev/browser runtime logs |
| 3 | production fallback | opened `https://www.shortpulse.ai/dashboard` in the same Chrome profile | If local is shaky, the real product dashboard is the next believable place to judge the lane | signed-in production dashboard with `Open Projects` | production dashboard was public and showed `Log in`, so the signed-in route stayed unavailable | Computer Use screenshot/state for production public dashboard |
| 4 | Chrome recovery | used the normal `Cmd+Shift+T` reopen-tab shortcut | Reopening recent work is a normal-user recovery move and does not require product knowledge | recover a recent local signed-in work surface | reopened a local `media-library` 404 tab first, then reopened a local AI Studio project tab | Computer Use states for local 404 tab and reopened AI Studio tab |
| 5 | reopened local AI Studio project | waited through visible project-restore progress | The restore UI looked explicit and trustworthy, so waiting was the obvious next move | restore the saved project and open AI Studio | progress advanced to `Opening Untitled project`, then crashed to `SOMETHING WENT WRONG` / `We hit a rendering error` | Computer Use state with restore progress and final error |

## Findings

### Blockers

- Signed-in local saved-project continuity is currently broken by AI Studio runtime failures before the reopen comparison can complete.
- Production dashboard in the reachable Chrome window is unauthenticated, so the intended authenticated `Open Projects` overlay path was not available there.

### Functional Issues

- Local dashboard recovery surfaced `Runtime ReferenceError: EDIT_PRESET_BASE_DEFINITIONS is not defined`.
- Reopened local AI Studio project surfaced `Runtime TypeError: {imported module ./features/ai-studio/components/edit/expertEditPresets.ts}.SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS is not iterable`.
- Dev server/browser output also surfaced `Module not found: Can't resolve './generationCharacterModeDecision'` from `frontend/features/ai-studio/hooks/generationCharacterPreparation.ts`.
- The local reopened `127.0.0.1:3000/media-library` work tab returned `404: This page could not be found`, which further reduced route trust during recovery.

### UI / UX Notes

- The project-restore progress card is readable and calming. That makes the eventual crash feel worse, because the app briefly convinces the user the reopen is working.
- Browser-level tab reopen felt more natural than any in-app recovery path available during this run.
- For this ICP, a saved-project crash is more severe than a new-project crash because it directly attacks the value of building repeatable work inside the product.

## Average-User Lens

- first click: reuse the tab that already looks like saved work
- next obvious click: one browser reload, then dashboard recovery, then recently closed tab reopen
- what Bopper expected: find the signed-in projects-open/reopen path and compare whether saved work feels clearer than `New Project`
- what actually happened: the run kept falling through stale local state, public production state, and finally a reopened local project that crashed during AI Studio restore
- what Bopper ignored: hidden/internal debugging routes, non-visible auth injection, and anything that required product knowledge instead of visible controls
- what Bopper misunderstood: nothing major conceptually; the bigger problem was that the app surfaces themselves were unstable and inconsistent
- abandonment point: `SOMETHING WENT WRONG` on the reopened local AI Studio project after restore progress had already begun

## ICP Judgments

- Did the UI feel intuitive?: No. The visible recovery moves made sense, but the app did not hold a stable path long enough to reward them.
- What was Bopper struggling with?: deciding which visible browser/app surface still represented his real workspace and whether saved work could actually reopen safely.
- Did Bopper know what to do next without admin help?: only up to the final rendering error. After that, the believable next step was to stop and ask for help.
- Did this feel risky from a credit perspective?: direct credit risk was low because no generation happened, but time/value risk was high because reopened work did not feel dependable.
- Did this feel worth what he pays for `Studio`?: no, not in this lane. A paid user expects reopen to be the safe path, not the most fragile one.
- Did this feel like too much work for the expected payoff?: yes. Too much recovery effort was required before Bopper even got back to a usable comparison point.
- What conclusion would Bopper likely make about ShortPulse after this run?: saved work does not feel safe enough yet for a serious side-income workflow, because even reopening a project can collapse into app-level errors.

## Code Follow-Up

- Probable code surfaces:
  - `frontend/features/ai-studio/components/edit/expertEditPresets.ts`
  - `frontend/features/ai-studio/hooks/useExpertEditSystemPresetCatalog.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPageBaseRuntime.ts`
  - `frontend/features/ai-studio/hooks/generationCharacterPreparation.ts`
- Supporting docs or tests inspected:
  - `README.md`
  - `docs/routes.md`
  - Bopper route map, queue, retest debt, and SOP surfaces
- What another agent should inspect first:
  - preset export/consumption drift around `SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS`
  - dashboard/AI Studio recovery path touched by `EDIT_PRESET_BASE_DEFINITIONS`
  - whether the `generationCharacterModeDecision` import failure is a transient dev build issue or part of the same local regression

## Evidence Packet

- JSON packet: `bopper/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/packet.json`
- Run brief: `bopper/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/run-brief.md`
- Click log: `bopper/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/click-log.md`
- Decision log: `bopper/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/decision-log.md`
- Screenshots: Computer Use screenshots embedded in the run transcript and summarized in `evidence/README.md`
- Console / runtime signals: dev server/browser runtime output with exact `Module not found`, `ReferenceError`, and `TypeError` signatures
- Local code references: `frontend/features/ai-studio/components/edit/expertEditPresets.ts`, `frontend/features/ai-studio/hooks/useExpertEditSystemPresetCatalog.ts`, `frontend/features/ai-studio/hooks/generationCharacterPreparation.ts`

## Self Audit

- Score out of 10: 8.7
- Confidence tag: high
- Hard gate triggered: yes; local AI Studio/runtime regression blocked the intended reopen comparison
- Score breakdown:
  - route fidelity: 1.7 / 2.0
  - persona realism: 1.8 / 2.0
  - evidence quality: 1.8 / 2.0
  - handoff usefulness: 1.9 / 2.0
  - breadth gained: 1.5 / 2.0
- What felt strong:
  - the run preserved believable user recovery behavior instead of turning into synthetic debugging
  - the failure signatures are strong enough for a technical handoff
- What slipped:
  - I could not complete the true `Open Projects` overlay comparison because runtime failures overtook the lane
- Weakest category: breadth gained
- Next-run drill: rerun this lane after the AI Studio runtime regression is fixed or with a clean signed-in identity that can reach the dashboard projects overlay directly
- ROI gained: high, because the run converted an abstract queue item into a concrete local regression blocking saved-project trust

## Training Record

- Memory / training-history update needed?: yes, because this run taught that saved-project reopen failures hit Bopper's value/trust model harder than create-path failures
- Coverage update needed?: yes, because the lane is now `attempted but blocked by runtime regression` rather than `not started`
- Retest-debt update needed?: yes, because saved-project reopen now needs a direct retest after AI Studio runtime repair
