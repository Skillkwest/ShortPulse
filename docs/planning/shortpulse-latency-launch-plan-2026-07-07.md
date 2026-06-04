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

Make only high ROI canonical fixes that directly reduce measured or strongly evidenced latency. Before each lane ask: will this move ShortPulse closer to a lower latency performance floor and July 7 launch without changing UI, UX, behavior, styling, layout, or design. If yes, continue. If no, stop that lane and choose the next highest ROI in scope latency issue.

No UI changes. No UX changes. No visual redesign. No major behavior changes. Do not break or reshape app functionality. Allowed changes are preserve behavior performance fixes such as deferring nonrequired work, reducing payload, throttling background churn, batching safe work, or making heavy paths visible first. If a fix needs visible UI or UX change, major behavior change, or risky product semantics, stop and report instead of implementing.

Before opening a new latency lane, audit the current latency diff for regression risk. Separate what changed, what is proven, what is unproven, and what could break. If existing changes still lack enough safety proof, run the narrowest regression proof first instead of adding more changes.

For every candidate change answer: what latency problem does this directly reduce, what could this break, what proof exists before editing, and what validation proves no regression. If any answer is weak, stop and report instead of editing.

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

## Safe Execution Plan

Purpose: convert the latency goal into an execution-ready plan that can be implemented without UI, UX, behavior, styling, layout, or other visible product changes.

This section is the planning stop line. Once the lane cards below are understood, ranked, and accepted, planning should stop and implementation should begin from the first recommended packet rather than continuing to brainstorm.

Focused subordinate lane plans:

- Verified AI Studio divider-drag lag with dense `Reference Grid` projects is governed by [docs/planning/ai-studio-divider-drag-latency-execution-plan-2026-06-04.md](./ai-studio-divider-drag-latency-execution-plan-2026-06-04.md). Use that plan for this seam instead of broadening into generic right-rail or CSS work.

### Planning Lane Done Criteria

Planning is complete only when all of the following are true:

1. The top latency lanes are ranked by ROI, owner-path clarity, and regression risk.
2. Each recommended lane names the exact owner files to inspect before editing.
3. Each lane includes a preserve-behavior execution shape, proof requirements, validation commands, and lane-specific stop conditions.
4. High-risk surfaces that should not be touched first are explicitly called out.
5. The first implementation packet is narrow enough to begin without improvising structure, safety rules, or scope in the moment.

If all five conditions are true, stop planning and begin implementation from `Packet 1`.

### Preserve-Behavior Contract

Non-negotiable invariants for every latency packet:

- No UI changes.
- No UX changes.
- No behavior changes.
- No visual redesign.
- No styling changes.
- No layout changes.
- No auth/compliance/billing/generation semantics changes unless the same user-visible behavior is preserved and the latency win is directly evidenced.
- No Supabase image transformation usage on any path.
- No broad cleanup, naming cleanup, architecture polish, or adjacency work.

Before any packet starts, ask:

`Will this directly reduce app-wide latency or launch risk without changing visuals or behavior?`

If the answer is not clearly yes, do not start that packet.

### Current Evidence Snapshot

Use this as the current planning baseline, not as proof that a fix is already chosen.

- `npm -C frontend run latency:ai-studio-inventory` currently reports `35` AI Studio routes, `33` protected.
- Current startup-labeled routes from that inventory:
  - `/api/account/media-compliance`
  - `/api/pricing/model-policy`
  - `/api/projects`
- Current background-refresh / churn-labeled routes from that inventory include:
  - `/api/credits/snapshot`
  - `/api/elevenlabs/*`
- Current workspace lane routes include:
  - `/api/projects/:param`
  - `/api/projects/:param/workspace`
- Raw CSS source-size suspects currently include:
  - `styles/ai-studio-edit-expert.css` ~160947 bytes
  - `styles/ai-studio-voices-properties.css` ~94205 bytes
  - `styles/ai-studio-layout.css` ~74169 bytes
  - `styles/ai-studio-video-theme.css` ~60811 bytes
  - `styles/character-manager.css` ~50793 bytes
  - `styles/workspace-media.css` ~39516 bytes

These are ranking inputs only. A large file is not automatically a safe first move.

### Safety Classification Rule

When inspecting shared payload and CSS lanes, classify each file or selector group into one of three buckets before editing:

1. `true global`
   - Tokens, resets, shared page shells, body state, shared panel chrome, cross-route utilities.
2. `shell bridge`
   - Small global selectors that adapt a feature panel to shared shell authority such as `.ai-studio-page[data-selected-tool="..."] .panel.ai-panel.ai-properties`.
3. `feature island`
   - Namespaced selectors owned by one route, tool, or lazily mounted subtree.

Only `feature island` rules should fully leave the shared global path early in the program. `shell bridge` rules may need to stay global longer by design.

## ROI-Ranked Packet Order

### Packet 1: Shared Payload Pilot

Status: first implementation packet recommended

Problem statement:
The app-wide CSS path still runs through `frontend/pages/_app.tsx` importing `frontend/styles/globals.css`, so unrelated tool styling can inflate shared payload on routes that do not need it.

Primary owner files:

- `frontend/pages/_app.tsx`
- `frontend/styles/globals.css`
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/styles/ai-studio-voices-properties.css`
- `frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx`
- `frontend/features/ai-studio/components/CreateVoiceModal.tsx`
- `frontend/features/ai-studio/components/VoicesLibraryModal.tsx`
- `frontend/features/ai-studio/components/VoiceLibraryContent.tsx`
- `frontend/features/ai-studio/components/VoiceChangerSourceDropzone.tsx`
- `frontend/features/ai-studio/components/VoiceChangerAudioSourcePreview.tsx`
- `frontend/features/ai-studio/components/AiStudioRecordPanelPrefab.tsx`

Why this packet is first:

- Shared payload is app-wide, so a safe reduction improves many routes at once.
- `Voices` is already a lazily mounted AI Studio panel subtree.
- `styles/ai-studio-voices-properties.css` is large enough to matter and has a tight class namespace.
- The shell-coupled rules in that sheet are few and explicit, which makes it suitable for a pilot extraction.

What to do:

1. Re-measure the current `globals.css` import set and the current built CSS if a fresh build is available.
2. Map `styles/ai-studio-voices-properties.css` into:
   - `true global`
   - `shell bridge`
   - `feature island`
3. Keep `true global` and `shell bridge` rules in the global path for now.
4. Move only `feature island` rules into a component-owned stylesheet imported by the voices subtree.
5. Remove only the migrated import from `globals.css`.
6. Stop after the pilot. Do not continue into a second CSS island in the same packet unless the proof is unusually strong and risk stays low.

What not to do:

- Do not start with `styles/ai-studio-layout.css`.
- Do not start with `styles/ai-studio-edit-expert.css`.
- Do not start with `styles/workspace-media.css`.
- Do not start with `styles/character-manager.css`.
- Do not chase generic dedupe or rename work.

Why those are deferred:

- `ai-studio-layout.css` owns route shell and body-state authority.
- `ai-studio-edit-expert.css` spans a much broader edit subsystem.
- `workspace-media.css` mixes generic reusable selectors with route-body styling.
- `character-manager.css` mixes embedded panel styling with page/global authority.

Pre-edit proof requirements:

- Confirm `Voices` still resolves through the lazy panel path in `AiStudioPageContent.tsx`.
- Confirm the real non-test `voices` UI consumers are still bounded to the same subtree.
- Confirm which `voices` selectors reach outside the subtree into shell authority.
- Confirm no required visual contract depends on selector order from unrelated imports.

Validation:

- `npm -C frontend run build`
- `npm -C frontend run type-check:touched`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/VoicesPropertiesPanel.test.tsx`
- Smoke-check AI Studio entry and `Voices` panel behavior.

Packet stop conditions:

- Stop when the `voices` island is either:
  - cleanly extracted with no visual regression evidence, or
  - proven too shell-coupled for a low-risk pilot.
- If it is too coupled, do not keep splitting by momentum. Re-rank the next safest island.

### Packet 2: Protected Startup And First Usable Shell

Status: second implementation packet recommended

Problem statement:
Protected AI Studio startup should block only on required auth/compliance/project-identity work. Non-visible or non-required reads should not delay first usable shell.

Primary owner files:

- `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx`
- `frontend/pages/ai-studio.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioPageBaseRuntime.ts`
- `frontend/features/compliance/hooks/useMediaComplianceGate.ts`
- `frontend/features/ai-studio/hooks/useActiveModelPricingPolicy.ts`
- `frontend/features/ai-studio/hooks/useCredits.ts`
- `frontend/features/ai-studio/hooks/useMediaAutosavePreference.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`

Current evidence:

- Model pricing policy is already deferred through idle/fallback timing inside `useAiStudioPageBaseRuntime`.
- Credits still maintain their own snapshot/fallback runtime.
- Media autosave preference and project identity still represent startup-time authenticated reads.
- AI Studio route gating is intentionally split so auth and media compliance resolve before the heavy runtime loads.

What to do:

1. Trace which startup hooks are truly required before first interaction.
2. Preserve blocking authority for:
   - auth
   - media compliance
   - required project identity
   - required project bootstrap gate
3. Defer or gate any startup work that is not required for first interaction, such as:
   - pricing policy reads when only cost display depends on them
   - balance refresh when a stale value is acceptable briefly
   - autosave preference reads when a local fallback can render safely first
4. Prefer visibility-, idle-, or post-shell gating over semantic rewrites.

What not to do:

- Do not weaken compliance or project bootstrap gates.
- Do not change pricing, credit, or autosave behavior contracts.
- Do not hide required errors just to make startup feel faster.

Pre-edit proof requirements:

- Distinguish first-usable shell requirements from post-shell enrichments.
- Confirm whether any current startup read mutates visible layout or control enabled state immediately.
- Confirm whether `useCredits` and `useMediaAutosavePreference` can safely show locally cached or previously known values first.

Validation:

- `npm -C frontend run build`
- `npm -C frontend run type-check:touched`
- `npm -C frontend run test:e2e:ai-studio-loading-gate`
- `npm -C frontend run latency:ai-studio-trace -- --project-id PROJECT_ID --storage-state STORAGE_STATE`

Packet stop conditions:

- Stop when first usable shell is measurably improved or when all remaining startup reads are proven required for correctness.
- If a candidate deferral changes visible control state or protected-route semantics, stop and report instead of implementing it.

### Packet 3: Runtime Churn Reduction

Status: third implementation packet recommended

Problem statement:
Idle or hidden surfaces should not keep AI Studio busy enough to make interaction feel slower than it should.

Primary owner files:

- `frontend/features/ai-studio/hooks/useAiStudioGeneratedOutputMaintenance.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`
- `frontend/features/ai-studio/hooks/useCredits.ts`
- `frontend/features/media-library/hooks/useMediaAdaptivePressure.ts`

Current evidence:

- Generated-output maintenance uses repeated sync intervals and poster repair loops.
- Task orchestration runs a visible-generation watchdog with repeated scans.
- Credits maintain a long-lived refresh model.
- Media adaptive pressure samples runtime pressure continuously while visible.

What to do:

1. Identify work that can be disabled, slowed, or paused when:
   - the document is hidden
   - the surface is offscreen
   - the workflow has settled
   - no visible output depends on the loop
2. Preserve correctness for active generations, visible media, and explicit user operations.
3. Prefer gating or interval reduction over redesigning the underlying feature contract.

What not to do:

- Do not degrade active generation lifecycle accuracy.
- Do not stale-out user-visible outputs or credit state during active operations.
- Do not touch adaptive-media policy semantics unless churn is clearly rooted there.

Pre-edit proof requirements:

- Trace which loops still run while idle and visible.
- Confirm whether each loop is global, route-scoped, or tool-scoped.
- Confirm whether visibility checks already exist and whether they are enough.

Validation:

- `npm -C frontend run build`
- `npm -C frontend run type-check:touched`
- `npm -C frontend run test:perf:ai-studio`
- Compare idle network/request churn before and after in the targeted surface.

Packet stop conditions:

- Stop when the dominant idle loop is reduced or gated.
- If further churn candidates are already visibility-gated or active-surface-only, stop and re-rank rather than chasing marginal wins.

### Packet 4: Heavy Project And Media Paths

Status: fourth implementation packet recommended

Problem statement:
Large project restores and media-heavy surfaces should become usable before all snapshot, hydration, preview, and signing work completes.

Primary owner files:

- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`
- `frontend/features/ai-studio/logic/projectWorkspaceApiClient.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`
- `frontend/lib/mediaSignedUrlCache.ts`
- `frontend/pages/api/media/list.ts`
- `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- `frontend/features/media-library/logic/mediaPreviewRuntimeShared.ts`

Current evidence:

- Project persistence performs snapshot building, serialization, byte accounting, fallback selection, restore hydration, and autosave.
- Media list is already server-authoritative and includes tiny first-page signing seeds for panel surfaces.
- Signed URL caching and batch signing are already present, so any changes here should be incremental and evidence-driven.

What to do:

1. Measure heavy project open and switch cost before editing.
2. Treat visible-first restore as the goal:
   - shell first
   - visible state next
   - heavy enrichment after
3. Reduce expensive snapshot selection or apply work only where profiling shows it dominates.
4. In media, prefer batch size, visibility signing, and cache hit improvements over contract rewrites.

What not to do:

- Do not alter restore authority or autosave durability semantics.
- Do not introduce preview security regressions.
- Do not re-open media architecture unless evidence points to a narrow hot path.

Pre-edit proof requirements:

- Confirm whether project restore cost is build/serialize, network, hydrate/apply, or follow-up enrichment dominated.
- Confirm whether media slowness is list, sign-batch, resolve-previews, render density, or preview delivery dominated.

Validation:

- `npm -C frontend run build`
- `npm -C frontend run type-check:touched`
- `npm -C frontend run test:e2e:project-persistence`
- `npm -C frontend run test:e2e:media-library-runtime`
- Use the media performance SOP telemetry checks when touching Media Library lanes.

Packet stop conditions:

- Stop when the dominant project or media bottleneck improves measurably.
- If the remaining work becomes broad architectural reshaping, stop and report instead of drifting.

### Packet 5: Instrumentation Only If Needed

Status: optional, use only when evidence is too weak to choose safely

Problem statement:
If the next packet cannot be chosen from current evidence, add only enough instrumentation to prove the owner seam.

Allowed timing points:

- auth bootstrap
- protected route gate release
- project identity fetch
- project workspace fetch
- snapshot apply
- sign-batch
- first usable shell

What not to do:

- Do not add broad telemetry scaffolding.
- Do not leave noisy instrumentation behind without intent.
- Do not instrument because it feels safer than making a decision; instrument only when selection is genuinely blocked.

Validation:

- `npm -C frontend run build`
- `npm -C frontend run type-check:touched`

Packet stop conditions:

- Stop once the instrumentation proves the next highest-ROI packet.
- If instrumentation does not change packet selection, remove or disable it unless it has durable operational value.

## Do Not Touch First

These are explicitly not first packets:

- `frontend/styles/ai-studio-layout.css`
- `frontend/styles/ai-studio-edit-expert.css`
- `frontend/styles/workspace-media.css`
- `frontend/styles/character-manager.css`
- broad project-persistence rewrites
- broad media architecture rewrites

Reason:

Each of these carries higher cross-surface regression risk than the currently recommended first packets.

## Validation Ladder

Use the narrowest proof that still matches packet scope:

- Shared payload / CSS:
  - `npm -C frontend run build`
  - `npm -C frontend run type-check:touched`
  - targeted component tests
  - route smoke checks
- Protected startup:
  - `npm -C frontend run build`
  - `npm -C frontend run test:e2e:ai-studio-loading-gate`
  - production trace where possible
- Runtime churn:
  - `npm -C frontend run build`
  - `npm -C frontend run test:perf:ai-studio`
  - idle request comparison
- Project / media:
  - `npm -C frontend run build`
  - `npm -C frontend run test:e2e:project-persistence`
  - `npm -C frontend run test:e2e:media-library-runtime`
  - SOP media telemetry review

If a validation gap remains, report it plainly. Do not fill it with confidence language.

## Recommended Start

Start with `Packet 1`.

If `Packet 1` proves too coupled for a safe pilot, move to `Packet 2` rather than forcing a risky CSS migration by momentum.

## Planning Stop Condition

Planning should stop and implementation should begin when:

- `Packet 1` through `Packet 4` are understood,
- the preserve-behavior contract is accepted,
- the `Do Not Touch First` list is accepted,
- and the next step is obviously `implement Packet 1` rather than gather more generic planning context.

At that point, more planning is not reducing risk. Begin execution from the first packet.
