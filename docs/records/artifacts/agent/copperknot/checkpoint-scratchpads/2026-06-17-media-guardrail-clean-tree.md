# Copperknot checkpoint scratchpad: media guardrail clean-tree pass

Time: 2026-06-17 06:42 MST

Touched:
- `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`

Did:
- Confirmed `production` branch and `shortpulse.allowedBranch=production`.
- Re-read the Copperknot worktree-boundary rule before patching.
- Cleared the enforced Media Rendering size-budget failure with a no-behavior import-format cleanup in a clean file.
- Left later-appearing unrelated worktree files untouched.

Validation:
- `npm -C frontend run validate:media-rendering-guardrails` passed; remaining size-budget items are warn-mode only.
- `npm -C frontend run test -- --run features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts` passed with `23` tests.
- `npm -C frontend run type-check:touched` passed for touched frontend TS paths; repo-wide type-check still has unrelated diagnostics.
- `git diff --check` passed.

Follow-up boundary:
- On a later continuation, `npm -C frontend run type-check:touched` initially failed in dirty active file `frontend/features/ai-studio/reference-ingestion/prepareLibraryMediaIngestionPayload.ts`; Copperknot did not patch it because the file belonged to the active media/reference-ingestion worktree.
- Current continuation rerun: `npm -C frontend run type-check:touched` now passes for `17` touched frontend TS paths, so that active-lane type boundary appears resolved by the owning lane.
- Current production-safe refresh: `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` passed against deployment `shortpulse-nftngu8vh-kirk-artmans-projects.vercel.app` created `2026-06-17T13:22:33.696Z`.
- Current internal route runtime refresh passed for `generation_recovery`, `user_health_fleet`, and `media_derivatives`; protected routes fail closed unauthenticated and succeed with operator auth.
- `node scripts/check_secret_exposure.js` passed.
- Updated `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md` freshness note from stale `2026-06-11` route evidence to the current `2026-06-17` production-safe route/fail-closed evidence.
- Updated `docs/systems/launch-fitness-scorecard-2026-06-16.md` to anchor the current `2bc2faa02` baseline and current `2026-06-17` media guardrail/route freshness without lifting readiness scores.
- Updated `docs/agents/copperknot/july-7-launch-board.md` with a concise `2026-06-17` production-safe freshness note while preserving the existing queue order and below-floor proof boundaries.
- Later clean-tree continuation: reduced `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts` from `1001` lines to `998` lines with a formatting-only import cleanup, clearing the AI Studio task-submission runtime guardrail warning without UI, UX, behavior, routing, provider, pricing, or state changes.
- Validation for that continuation: `npm -C frontend run test -- --run features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts` passed with `55` tests; `npm -C frontend run validate:media-rendering-guardrails` passed with only the known larger `useAiStudioState.ts` warn-mode size item; `npm -C frontend run type-check:touched` passed for `2` touched frontend TS paths; `git diff --check` passed.
- Behavior correction checkpoint: updated `docs/agents/copperknot/goal-prompt.md` and `docs/agents/copperknot/AGENTS.md` so delegated launch authority means deciding and acting inside guardrails instead of pushing routine option-selection back to the user. Embedded goal prompt now measures `3930` characters.
- Validation for instruction update: `npm -C frontend run docs:check` passed; `git diff --check` passed.
- Single-route contract checkpoint: renamed active generated Fal submit/status modules from misleading `compatibility wrapper` wording to `canonical route wrapper` wording in the generator, generated route headers, README route summary, and route inventory regression test. No route names, handlers, provider config, payload validation, UI, UX, pricing, or behavior changed.
- Validation for single-route contract checkpoint: `npm -C frontend run fal:routes:sync` updated `34` generated route files; `npm -C frontend run fal:routes:check` passed for `17` route families; `npm -C frontend run test -- --run tests/api/fal-route-inventory-regression.test.ts` passed with `4` tests; `node scripts/check_generation_pipeline_legacy_paths.mjs` passed across `213` files; `npm -C frontend run type-check:touched` passed for `37` touched frontend TS paths; `npm -C frontend run docs:check` passed; `git diff --check` passed.
- Supabase transform invariant checkpoint: strengthened `frontend/lib/__tests__/supabaseTransformGuard.test.ts` so any source file that calls `createSignedUrl` or `createSignedUrls` now fails if it also contains a `transform:` option key. This keeps the July 7 no-transform rule guarded beyond the existing inline-call regex without changing runtime behavior.
- Validation for transform invariant checkpoint: `npm -C frontend run test -- --run lib/__tests__/supabaseTransformGuard.test.ts` passed with `3` tests; `npm -C frontend run type-check:touched` passed for `38` touched frontend TS paths; `git diff --check` passed.
- Media guardrail wiring checkpoint: added `test:supabase-transform-guard` to `frontend/package.json` and wired it into `validate:media-rendering-guardrails` so the no-Supabase-transform invariant runs in the routine media/storage guardrail bar, not only as an isolated remembered test.
- Validation for guardrail wiring: `npm -C frontend run validate:media-rendering-guardrails` passed and now runs `test:supabase-transform-guard`; `npm -C frontend run check:test-script-paths` passed; `git diff --check` passed.
- Launch-control truth update: updated the July 7 queue, launch board, and launch-fitness scorecard so the current `2026-06-17` local guardrail evidence explicitly says `validate:media-rendering-guardrails` now runs the Supabase transform guard. No launch score, state, queue order, or production-readiness claim was raised.
- Validation for launch-control truth update: `npm -C frontend run docs:check` passed; `npm -C frontend run validate:media-rendering-guardrails` passed with the known warn-mode `useAiStudioState.ts` size-budget warning only; `git diff --check` passed.
- Fal route validation wiring checkpoint: added `npm run fal:routes:check` to the main `validate` script so generated Fal/Kie route-wrapper drift is caught in routine validation, not only in focused provider lanes. This supports the single true route contract without changing runtime behavior.
- Validation for Fal route wiring: `npm -C frontend run fal:routes:check` passed for `17` route families; `npm -C frontend run check:test-script-paths` passed; `npm -C frontend run check:generation-pipeline-legacy` passed across `213` files; `git diff --check` passed.
- Provider-lane route validation wiring checkpoint: added `npm run fal:routes:check` to the start of `validate:phase11:fal-regression` so the provider-specific Fal/Kie regression bar also catches generated-wrapper drift before tests, typecheck, lint, docs, or build.
- Validation for provider-lane wiring: `npm -C frontend run fal:routes:check` passed for `17` route families; `npm -C frontend run check:test-script-paths` passed; `npm -C frontend run test -- --run tests/api/fal-route-inventory-regression.test.ts` passed with `4` tests; `git diff --check` passed.
- Handoff refresh checkpoint: refreshed `docs/agents/copperknot/handoffs/2026-06-04-storage-delivery-variants-production-sql-proof.md` so the storage/delivery production-proof lane includes the current Supabase transform guard behavior and routine `validate:media-rendering-guardrails` wiring. This is a handoff evidence refresh only; no readiness score or state changed.
- Validation for handoff refresh: `npm -C frontend run docs:check` passed; `git diff --check` passed.
- Generation handoff refresh checkpoint: refreshed `docs/agents/copperknot/handoffs/2026-06-04-generation-runtime-provider-contract-audit.md` so Bactuo receives current Fal/Kie canonical route-wrapper evidence, `17` route-family `fal:routes:check` coverage, and the updated `validate` / `validate:phase11:fal-regression` route-check wiring. This is a handoff evidence refresh only; no readiness score or state changed.
- Validation for generation handoff refresh: `npm -C frontend run docs:check` passed; `git diff --check` passed.
- Create/Pulse handoff refresh checkpoint: refreshed `docs/agents/copperknot/handoffs/2026-06-04-create-pulse-workflow-production-proof.md` so the production-proof lane includes current AI Studio task-submission guardrail cleanup evidence and its validation boundary. This is a handoff evidence refresh only; no readiness score or state changed.
- Validation for Create/Pulse handoff refresh: `npm -C frontend run docs:check` passed; `git diff --check` passed.
- Projects/workspace restore checkpoint: hardened project workspace snapshot canonicalization so failed output task state is trimmed/lowercased before persistence filtering and treats both `fail` and `failed` as failed states. The regression variant includes generated outputs with delivery URLs so the test proves stale padded/cased failed outputs cannot survive save/reopen snapshots. No UI, UX, route, billing, media, or intended behavior changed.
- Validation for Projects/workspace restore checkpoint: `npm -C frontend run test -- --run lib/server/__tests__/projectWorkspaceStatesService.test.ts` passed with `51` tests; `npm -C frontend run type-check:touched` passed for `40` touched frontend TS paths; `git diff --check` passed.
- Follow-up Projects/workspace restore checkpoint: extended the same sanitizer to treat legacy failed `status` as the fallback failure state when `taskState` is absent, so status-only failed rows with preview/result URLs cannot survive project save/reopen snapshots.
- Validation for follow-up Projects/workspace restore checkpoint: `npm -C frontend run test -- --run lib/server/__tests__/projectWorkspaceStatesService.test.ts` passed with `51` tests; `npm -C frontend run type-check:touched` passed for `42` touched frontend TS paths; `git diff --check` passed; `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts` remains `500` lines.
