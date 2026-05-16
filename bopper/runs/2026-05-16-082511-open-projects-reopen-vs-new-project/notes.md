# Bopper Run Notes

Purpose: chronological scratch log for one supervised Bopper run.

## Run Metadata

- Date: 2026-05-16
- Task: Bopper compare Open Projects as the first deliberate entry path against New Project trust and reopening clarity
- Environment: local
- Base URL: http://localhost:3000
- Interaction fidelity: mixed
- Audit user: reused Chrome browser state with stale local/project tabs; no clean paid `Studio` identity visible on the production dashboard
- Persona lens: returning paid-user ICP who wants saved work to reopen fast and safely without admin help

## Chronological Log

1. Startup context loaded:
   - Loaded the Bopper contract, memory, SOP, route map, retest debt, queue, and dashboard/project route docs before touching the browser.
2. Visible route entered:
   - Reached local and production dashboard surfaces through browser-visible paths, then fell back to Chrome reuse because the extension session was broken and the in-app browser only showed a public dashboard.
3. First click:
   - Reused the existing local AI Studio work tab first because that most closely matched a believable "come back and keep working" user state.
4. Next obvious action:
   - Corrected stale tab drift back toward dashboard/public dashboard, then used Chrome's real reopen shortcut to restore recently closed local work tabs and recover a signed-in local AI Studio project.
5. Confusion noticed:
   - Production `/dashboard` in this Chrome window was public and showed `Log in`, not a signed-in workspace.
   - Local dashboard recovery triggered runtime overlay failures instead of a usable dashboard or projects overlay.
   - Reopened local AI Studio project advanced through visible restore steps, then crashed into a rendering error.
6. Abandonment point:
   - Bopper reached `SOMETHING WENT WRONG` with `We hit a rendering error` on the reopened local AI Studio project and had no believable next move besides retrying or asking for help.
7. Evidence captured:
   - Computer Use screenshots/states for public production dashboard, stale local network error, local project restore progress, and local AI Studio runtime failure.
   - Dev server/browser runtime logs capturing `Module not found`, `ReferenceError`, and `TypeError` signatures.
8. Code/doc surface inspected:
   - `README.md` dashboard/projects route contract.
   - `frontend/features/ai-studio/hooks/generationCharacterPreparation.ts`
   - `frontend/features/ai-studio/components/edit/expertEditPresets.ts`
   - `frontend/features/ai-studio/hooks/useExpertEditSystemPresetCatalog.ts`

## Raw Findings

- Blockers:
  - Local signed-in reopen flow is not currently testable end-to-end because AI Studio crashes during restore.
- Functional issues:
  - Production dashboard available in this Chrome window is public, not signed in, so the intended `Open Projects` overlay lane is unavailable there.
  - Local recovery into AI Studio shows `EDIT_PRESET_BASE_DEFINITIONS is not defined` on dashboard recovery and `{imported module ./features/ai-studio/components/edit/expertEditPresets.ts}.SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS is not iterable` on reopened project restore.
  - Dev server/browser runtime also surfaced `Module not found: Can't resolve './generationCharacterModeDecision'` from `generationCharacterPreparation.ts`.
- UI / UX notes:
  - The visible restore progress UI is readable and reassuring right until the runtime crash, which makes the eventual failure feel harsher.
  - For this ICP, a saved-project reopen crash reads as "my work is not safe here," not just "the page had an error."

## End Of Run

- Run brief path: `bopper/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/run-brief.md`
- Detailed report path: `bopper/reports/2026-05-16-local-open-projects-reopen-vs-new-project.md`
- Checkpoint summary path: `bopper/checkpoint-summaries/2026-05-16-local-open-projects-reopen-vs-new-project-summary.md`
- Retained report path: `docs/records/artifacts/agent/bopper/reports/2026-05-16-local-open-projects-reopen-vs-new-project.md`
- D-Bug handoff path: `docs/records/artifacts/agent/d-bug/handoffs/2026-05-16-local-ai-studio-project-reopen-runtime-regression.md`
- Training-history update needed: yes
