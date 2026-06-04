# ShortPulse Latency Launch Plan 2026-07-07

Purpose: provide the autonomous execution plan for reducing app-wide ShortPulse latency before the July 7 2026 launch target.

## Goal

Reduce user-visible latency across ShortPulse, with priority on the signed-in app, AI Studio, heavy project restore, Media Library, shared frontend payload, and idle/background request churn.

This plan is the source of truth for the latency goal prompt. Agents continuing the goal should read this file first, then execute only the highest ROI latency work that fits this scope.

## Continuation Goal Prompt

Use this prompt to continue the latency goal in Codex:

```text
Reduce ShortPulse latency for the July 7 2026 launch. Source of truth is docs/planning/shortpulse-latency-launch-plan-2026-07-07.md. Read that document first and follow it exactly. Stay scoped to latency and launch risk in that document only.

Work only on production and keep shortpulse.allowedBranch set to production. Use https://www.shortpulse.ai for production proof. Local tests can validate code but localhost is not production proof.

Make only high ROI canonical fixes that directly reduce measured or strongly evidenced latency. Before each lane ask: will this move ShortPulse closer to a lower latency performance floor and July 7 launch. If yes, continue. If no, stop that lane and choose the next highest ROI in scope latency issue.

No UI changes. No UX changes. No visual redesign. No major behavior changes. Do not break or reshape app functionality. Allowed changes are preserve behavior performance fixes such as deferring nonrequired work, reducing payload, throttling background churn, batching safe work, or making heavy paths visible first. If a fix needs visible UI or UX change, major behavior change, or risky product semantics, stop and report instead of implementing.

Do not do broad refactor cleanup architecture polish Mini Ecosystem feature work pricing billing provider generation semantics or unrelated launch work. Preserve auth compliance billing generation submit project restore autosave media privacy preview security and Supabase image transformation prohibition.

Use narrow validation that proves the touched lane. Do not add test scaffolding unless it is clearly worth the latency risk reduction. If validation fails, fix the validation issue before starting another lane. Stop when the plan completion conditions are met or when the plan stop conditions require reporting.
```

## Operating Rules

- Work only on the local `production` branch and keep `shortpulse.allowedBranch` set to `production`.
- Use production proof from `https://www.shortpulse.ai` for deployed behavior claims.
- Use local commands for implementation validation, but do not treat localhost as production proof.
- Fix canonical owner paths. Do not add parallel fallbacks, duplicate implementations, backup paths, or speculative rewrites.
- Exclude `mini-ecosystem/` unless the user explicitly expands scope.
- Preserve auth, compliance, project restore, autosave, generation lifecycle, media visibility, preview security, and Supabase image transformation prohibition.
- Before every new task ask: will this directly reduce latency or launch risk for July 7 2026. If no, stop that lane and move to the next highest ROI latency issue.

## Scope

In scope:

- Shared route payload and universal CSS.
- Protected route startup fanout.
- AI Studio eager startup work before first usable shell.
- Background polling, watchdog, refresh, and maintenance churn.
- Heavy project open, project switch, snapshot apply, and autosave cost.
- Media Library list, preview, and signed URL cost.
- Minimal instrumentation only when needed to prove or rank a latency source.

Out of scope:

- Visual redesign.
- Broad refactors that do not remove proven latency.
- General cleanup, naming cleanup, docs cleanup, or architecture polish.
- Pricing, billing, provider, or generation behavior changes unless a measured latency path requires a tiny preserve-behavior adjustment.
- New feature work.
- Main branch, feature branches, preview URLs, or localhost as the production validation surface.

## Required Proof Lanes

Capture before and after evidence where feasible for the lanes touched:

- Signed-in app entry.
- AI Studio with no project loaded.
- AI Studio with a heavy project loaded.
- Heavy project switch.
- Large Media Library open.

Useful commands:

```bash
npm -C frontend run latency:ai-studio-inventory
npm -C frontend run latency:protected-route -- --path ROUTE
npm -C frontend run latency:ai-studio-trace -- --project-id PROJECT_ID --storage-state STORAGE_STATE
npm -C frontend run build
npm -C frontend run lint
```

Use `npm -C frontend run type-check:touched` when repo-wide TypeScript diagnostics are noisy and the lane only touches a small TypeScript set.

## Success Targets

Treat these as direction targets, not permission to make risky changes:

- Public initial assets reduced by 30 percent where shared payload is the bottleneck.
- Global or unrelated route CSS reduced by 50 percent where CSS is the bottleneck.
- AI Studio startup fanout reduced by 25 percent or first usable time reduced by 30 percent.
- Heavy project open or project switch reduced by 30 percent when dominant.
- Idle background requests reduced by 50 percent when churn is dominant.

Completion requires:

- The top two proven latency sources are fixed at their canonical owner paths.
- Shared payload is lower if it remains one of the top two sources.
- AI Studio startup fanout or first usable time is measurably better.
- Heavy project or media lanes improve if they are dominant in the baseline.
- No blocking regressions remain in auth, compliance, restore, autosave, generation lifecycle, media visibility, or preview security.
- Before and after evidence, validations, remaining risks, and deferred items are reported.

## Starting Audit Hypotheses

Verify these against the current worktree and production state before relying on them:

- `frontend/styles/globals.css` may be importing broad CSS for unrelated app surfaces into every route.
- `frontend/pages/_app.tsx` and global providers may be loading more route weight than needed before first interaction.
- AI Studio startup may be paying for pricing, preferences, catalogs, hidden panels, or non visible setup before first usable shell.
- Candidate startup files include `frontend/features/ai-studio/hooks/useAiStudioPageBaseRuntime.ts`, `frontend/features/compliance/hooks/useMediaComplianceGate.ts`, `frontend/features/ai-studio/hooks/useActiveModelPricingPolicy.ts`, `frontend/features/ai-studio/hooks/useMediaAutosavePreference.ts`, and `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`.
- Candidate churn files include `frontend/features/ai-studio/hooks/useAiStudioGeneratedOutputMaintenance.ts`, `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`, `frontend/features/ai-studio/hooks/useCredits.ts`, `frontend/features/media-library/hooks/useMediaAdaptivePressure.ts`, and `frontend/features/ai-studio/hooks/useReferenceGridPerfWatchdog.ts`.
- Candidate heavy project and media files include `frontend/features/ai-studio/logic/projectWorkspaceApiClient.ts`, `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`, `frontend/pages/api/media/list.ts`, and `frontend/lib/mediaSignedUrlCache.ts`.

## Execution Phases

### Phase 0 Baseline

1. Load startup docs and confirm implementation mode.
2. Confirm branch is `production` and allowed branch is `production`.
3. Run `npm -C frontend run latency:ai-studio-inventory`.
4. Capture production route and asset evidence for the required proof lanes that are currently feasible.
5. Rank bottlenecks by user impact, measured weight, measured request fanout, and launch risk.
6. Pick only the highest ROI lane.

Exit condition: one or two top latency sources are proven and mapped to owner files.

### Phase 1 Shared Payload

Problem statement: app-wide slowness is likely if unrelated CSS or global route code loads everywhere.

Actions:

1. Measure global CSS and route bundle weight before editing.
2. Inspect `frontend/styles/globals.css` and `frontend/pages/_app.tsx`.
3. Remove or defer unrelated global imports only through canonical route or feature ownership.
4. Keep `globals.css` as an import-only aggregator.
5. Validate home, auth, dashboard, and AI Studio entry.

Exit condition: shared payload is measurably lower with no route styling regression in touched smoke lanes.

### Phase 2 Protected Startup And AI Studio First Usable Shell

Problem statement: protected surfaces should not block first usability on non visible or non required work.

Actions:

1. Identify startup requests and synchronous hooks that run before first usable shell.
2. Keep auth, required project identity, required compliance gate, and required restore authority blocking.
3. Defer pricing, preferences, catalogs, hidden panels, and non visible setup when they are not required for first interaction.
4. Avoid changing business behavior, billing authority, or generation submit semantics.

Exit condition: AI Studio startup fanout or first usable time improves, and protected route access still works.

### Phase 3 Runtime Churn

Problem statement: idle or hidden surfaces should not keep the app busy enough to make interaction feel slow.

Actions:

1. Identify polling, watchdog, credit refresh, pressure sampling, generated output maintenance, and orchestration loops.
2. Disable, throttle, batch, or gate work for idle, hidden, unopened, offscreen, or settled surfaces.
3. Preserve active generation, billing, project restore, and user-visible status correctness.

Exit condition: idle background requests drop without stale visible state or generation lifecycle regression.

### Phase 4 Heavy Project And Media

Problem statement: large projects and media libraries should become usable before all restore, preview, signing, or autosave work finishes.

Actions:

1. Measure heavy project open and switch cost.
2. Make restore and preview visible-first.
3. Reduce snapshot apply cost, autosave selection cost, media list cost, and signed URL batching cost.
4. Preserve restore correctness, autosave safety, media visibility, private storage boundaries, and preview security.
5. Do not use Supabase image transformations.

Exit condition: dominant heavy project or media path improves with security and restore behavior preserved.

### Phase 5 Minimal Instrumentation

Use this only when evidence is too weak to choose or prove a fix.

Allowed timing points:

- Auth bootstrap.
- Workspace fetch.
- Snapshot apply.
- Signed URL batch.
- First usable shell.

Exit condition: instrumentation proves the next highest ROI owner path or proves a completed improvement. Remove or keep instrumentation only if it is intentionally useful and low noise.

## Validation Matrix

Run the narrowest validation that proves the touched lane:

- CSS or route payload changes: build plus route smoke checks for affected routes.
- Startup hook changes: relevant unit tests if present, build, and production trace after deploy when available.
- Polling or churn changes: tests for gating logic if present, build, and idle request comparison.
- Project restore changes: project restore, project switch, autosave, and media visibility checks.
- Media signing changes: media list, preview load, private access, and no Supabase transform regression.

Always report validation gaps plainly.

## Stop Conditions

Stop and report instead of continuing when:

- The next available work is cleanup, redesign, or architectural neatness rather than proven latency reduction.
- Evidence shows another in-scope latency source has higher ROI.
- Production proof is blocked by auth or environment state and only local proof is available.
- A fix would risk auth, compliance, billing, generation submit, project restore, autosave, media privacy, or preview security without a measured latency payoff.
- The same external blocker repeats for three consecutive goal turns.

## Required Closeout

Each goal continuation should report:

- Current phase and selected bottleneck.
- Files changed.
- Before and after evidence.
- Validations run.
- Regressions checked.
- Remaining risks.
- Deferred items that were intentionally not pursued because they were lower ROI or out of scope.
