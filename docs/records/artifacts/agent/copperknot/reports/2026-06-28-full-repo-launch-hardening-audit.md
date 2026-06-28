# Full Repo Launch Hardening Audit - 2026-06-28

Purpose: running audit-only ledger for high-ROI ShortPulse launch-hardening findings before the July 7, 2026 launch decision.

Status: active audit in progress.

Authority: this is a retained evidence/report artifact, not a source-of-truth contract. Current repo instructions, Copperknot launch authority, launch board, queue, ADRs, SOPs, source code, and fresh validation evidence override this ledger.

## Goal Prompt

Audit the entire ShortPulse repo in no-edit mode, except for updating this running audit ledger and its index entry. Scour the repo systematically for launch-hardening changes that would strengthen, harden, simplify, or de-risk the app before July 7 without changing UI, UX, visual design, copy, navigation, or intended behavior unless a later explicit approval changes that scope.

At each checkpoint:

- append evidence, findings, and next audit lane to this document;
- separate current source facts from retained-memory or historical evidence;
- classify each proposed change by launch ROI, owner/source seam, evidence level, behavior-change risk, and validation path;
- prefer canonical-source fixes over workaround layers, fallbacks, duplicate authorities, or broad rewrites;
- stop before implementation, production mutations, credit spend, destructive data work, commit/push/deploy/release, owner-lane crossing, secrets, or UI/UX/behavior change.

Do not consider the audit complete until every repo area that is in launch scope has been inspected, findings are deduplicated, and the remaining worklist is prioritized against the July 7 launch promise.

## Scope And Non-Goals

In scope:

- `frontend/` app source, API routes, tests, scripts, config, styles, and runtime helpers.
- `docs/` active product, architecture, SOP, ADR, systems, launch, and retained-evidence surfaces relevant to July 7 launch readiness.
- `sql/` migrations, hosted SQL diagnostics, RLS/security posture, and bootstrap scripts.
- Repo-level tooling, package scripts, validation gates, and branch/launch safety contracts.

Out of scope unless explicitly reopened:

- Product code edits or docs that change current behavior.
- Mobile-specific optimization or polish.
- Mini Ecosystem scope.
- Credit-consuming provider smokes, production data mutation, deploy/release actions, commit/push, or policy/public-promise changes.
- Supabase Docker/local-stack workflows.

## Startup Checkpoint

Date/time context: 2026-06-28, America/Phoenix.

Mode: audit-only. The only approved mutation is this running report and the index entry that makes it discoverable.

Fresh startup sources loaded:

- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/README.md`
- `docs/troubleshooting.md` (large file; relevant sections will be reopened as lanes require exact detail)
- `docs/glossary.md`
- `frontend/AGENTS.md`
- `docs/AGENTS.md`
- `skills/skill-session-startup-contract/SKILL.md`
- `skills/skill-subagent-audit-research/SKILL.md`
- `docs/agents/copperknot/README.md`
- `docs/agents/copperknot/goal-prompt.md`
- `docs/agents/copperknot/july-7-launch-authority.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md` (large file; table details will be reopened in targeted chunks)
- `docs/records/artifacts/agent/copperknot/AGENTS.md`
- `docs/records/artifacts/agent/copperknot/reports/README.md`

Fresh repo facts:

- Current branch: `production`.
- Local `shortpulse.allowedBranch`: `production`.
- Initial worktree: clean.
- Workspace safety check found expected generated/dependency directories only: `frontend/.next`, `frontend/node_modules`, `node_modules`, and nested package `dist` folders.

Subagent note:

- Repo policy encourages subagents for broad audits, but the active subagent tool contract requires an explicit current-task subagent/delegation request. No subagents were spawned in this checkpoint.

## Finding Intake Format

Each finding should use this shape:

- ID:
- Status: candidate, accepted, duplicate, deferred, blocked, or closed.
- Launch lane:
- Evidence level: Assumed, Repo Inspected, Locally Tested, Production Checked, or Production Proven.
- Source seam:
- Problem:
- Why it matters for July 7:
- Proposed change:
- Behavior/UI/UX impact:
- Validation path:
- Gate/owner:

## Findings

### F-001 - Extend size-budget coverage to current oversized launch surfaces

- ID: F-001
- Status: candidate
- Launch lane: tooling/tests/scripts/config; AI Studio shell; admin/operator; media/generation maintainability
- Evidence level: Locally Tested
- Source seam: `scripts/check_size_budgets.js`
- Problem: the repo guideline says files should aim for roughly 500 lines, and `npm -C frontend run check:size-budget` only enforces or warns on a small historic hotspot set. A fresh inventory found many current source/test files far above that guideline, including production files outside the active budget set such as `frontend/features/admin/components/AdminAgentInstructionsSection.tsx` at 2,590 lines, `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx` at 2,118 lines, `frontend/features/ai-studio/components/AiStudioPageContent.tsx` at 1,968 lines, `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts` at 1,992 lines, `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts` at 1,977 lines, `frontend/lib/server/mediaUploadService.ts` at 1,914 lines, and `frontend/lib/server/projectWorkspaceStatesService.ts` at 1,742 lines.
- Why it matters for July 7: very large source files raise patch risk, review burden, ownership ambiguity, and regression risk during launch-week hardening. The current budget check can pass while major launch files continue growing.
- Proposed change: do not broad-refactor by default. Add a conservative "inventory/warn" budget group for the largest current production files, then pick one high-ROI source seam at a time for behavior-preserving extraction only when tied to a concrete launch risk. Keep tests beside the seam.
- Behavior/UI/UX impact: none intended.
- Validation path: `npm -C frontend run check:size-budget`; targeted tests for any file later split; `npm -C frontend run check:architecture-boundary`; touched-file type-check.
- Gate/owner: Copperknot/Gottspan source-governance lane. Any actual module split should be a separate implementation lane with a concrete risk statement.

### F-002 - Add an automated production 404 probe for the dev-only bakeoff route

- ID: F-002
- Status: candidate
- Launch lane: route surface / public trust / launch operations
- Evidence level: Production Checked
- Source seam: `frontend/pages/dev/ai-studio-stage-bakeoff.tsx`, `scripts/verify_deployment_route_parity.mjs`, and production route probe harnesses
- Problem: `frontend/pages/dev/ai-studio-stage-bakeoff.tsx` intentionally remains in source and returns `notFound` when `NODE_ENV=production`. `README.md` documents `/dev/ai-studio-stage-bakeoff` as dev-only and production-404. The default route parity forbidden list is build-manifest based and correctly targets retired routes that should not exist at all; it does not prove this special source-present/dev-only page returns 404 in production.
- Why it matters for July 7: dev-only surfaces should stay non-public. The current production behavior is safe, but the proof is not part of the default automated launch gate.
- Proposed change: add `/dev/ai-studio-stage-bakeoff` to the anonymous production route-probe set as an expected `404`, not to `DEFAULT_FORBIDDEN_ROUTES` unless the source route is retired entirely.
- Behavior/UI/UX impact: none intended; production should continue returning 404.
- Validation path: current manual probe returned `404` for `https://www.shortpulse.ai/dev/ai-studio-stage-bakeoff`; keep `npm -C frontend run test -- tests/scripts/deployment-route-parity.test.mjs` green and add/extend a route-probe test if the probe list lives in script code.
- Gate/owner: Copperknot/Gottspan route-surface lane.

### F-003 - Refresh the launch board header so stale snapshot facts do not lead the current truth

- ID: F-003
- Status: candidate
- Launch lane: launch-control docs / queue authority
- Evidence level: Repo Inspected
- Source seam: `docs/agents/copperknot/july-7-launch-board.md`
- Problem: the launch board begins with `Snapshot date: 2026-06-08`, commit anchor `a621b6f54`, and a dirty-worktree note, while the current repo is on commit `7ef871892`, current branch/config are `production`, and the only worktree changes are this audit report and its index entry. The queue has fresher June 28 evidence, but the board's top metadata still foregrounds old context.
- Why it matters for July 7: launch-control docs are delegated authority surfaces. Stale top-of-file facts can cause agents to classify current clean files as dirty/parallel-owned, rely on old validation counts, or waste time reconciling evidence that has already been superseded.
- Proposed change: refresh the launch board's opening snapshot into a "baseline retained" section plus a current freshness header that points to the June 28 queue rows. Do not rewrite historical bullets; clearly mark them as retained history and keep current branch/worktree/commit freshness separate.
- Behavior/UI/UX impact: none.
- Validation path: `npm -C frontend run docs:check`; manual check that `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md` remains the exact queue authority.
- Gate/owner: Copperknot launch-control docs lane.

### F-004 - Reconcile stale systems-catalog launch-facing fields with the June 28 queue

- ID: F-004
- Status: candidate
- Launch lane: systems catalog / launch-control docs
- Evidence level: Repo Inspected
- Source seam: `docs/systems/catalog.md`, `docs/systems/README.md`, `docs/systems/launch-fitness-scorecard-2026-06-16.md`
- Problem: `docs/systems/README.md` says launch-facing catalog fields are stale when more than 7 calendar days have passed since the execution snapshot, but `docs/systems/catalog.md` still has many `Last reviewed` dates in May and points to the June 16 launch-fitness scorecard as the current easy-read scorecard. The active launch queue now contains June 28 evidence and state changes.
- Why it matters for July 7: agents use the systems catalog for inventory and boundary mapping. If launch-facing fields look current when they are stale, agents can pick the wrong seam, rerun old proof, or underweight fresh queue evidence.
- Proposed change: either refresh the launch-facing catalog/scoreboard rows from the June 28 launch queue, or add a prominent stale/secondary banner that routes launch-readiness decisions to the queue until a catalog refresh is performed. Keep `/10` maturity scoring separate from July 7 launch state.
- Behavior/UI/UX impact: none.
- Validation path: `npm -C frontend run docs:check`; targeted grep for references that call the June 16 scorecard "current" after the refresh decision.
- Gate/owner: Copperknot/Gottspan system-catalog lane.

### F-005 - Investigate native test-runtime warning from `canvas` plus `sharp`

- ID: F-005
- Status: candidate
- Launch lane: tooling/tests/scripts/config
- Evidence level: Locally Tested
- Source seam: `frontend/package.json`, Vitest/jsdom test environment, `fabric`/`canvas`/`sharp` dependency interaction
- Problem: route/security Vitest runs pass, but macOS emits repeated Objective-C warnings: `Class GNotificationCenterDelegate is implemented in both ... canvas ... libgio-2.0.0.dylib and ... sharp-libvips ... libvips-cpp... This may cause spurious casting failures and mysterious crashes.` `npm -C frontend ls canvas sharp --depth=3` shows `canvas@3.2.3` arrives through `fabric` and `jsdom`, while `sharp@0.34.5` is direct and deduped through Next.
- Why it matters for July 7: this is not a product-runtime failure, but noisy or unstable validation undercuts confidence when launch-week agents rely on fast route/security tests. The warning itself names possible spurious crashes.
- Proposed change: investigate whether Vitest can isolate image-processing tests, lazy-load Fabric/canvas only where needed, or document/contain the warning in the test environment. Do not remove `sharp` or `fabric` without a dedicated source-owner lane.
- Behavior/UI/UX impact: none intended.
- Validation path: rerun `npm -C frontend run test:frontend-fast-lane` and the image/Fabric-heavy suites before/after any tooling change; verify warning reduction without test coverage loss.
- Gate/owner: Gottspan/tooling or relevant AI Studio canvas owner.

### F-006 - Strengthen migration-doc parity around the newest migration stream

- ID: F-006
- Status: candidate
- Launch lane: SQL/migration operations; docs/SOP guardrails
- Evidence level: Repo Inspected
- Source seam: `scripts/check_migration_doc_parity.js`, `docs/database-migrations.md`, `docs/sops/sop_sql_migration_operations.md`, `sql/migrations/`
- Problem: `sql/migrations/` currently contains 167 forward migration files through `168_retire_saved_creators.sql`, with no duplicate numeric prefixes and an intentional numeric gap at `134`. `docs/database-migrations.md` mentions `164`-`167` only in the auth-signup paragraph and lists `168_retire_saved_creators.sql` in the long required set, while `docs/sops/sop_sql_migration_operations.md` describes `164`-`167` in the top layout but its ordered "Current set" stops at `163`. `npm -C frontend run docs:check` passed because `scripts/check_migration_doc_parity.js` only requires each migration to be mentioned somewhere across the two docs, not that the ordered/operator inventories are current and coherent.
- Why it matters for July 7: launch-week SQL work depends on exact operator runbooks. If the newest signup/auth and saved-creators migrations are only partially represented, agents can miss an apply prerequisite or trust a stale ordered list while production signup gates are under active launch scrutiny.
- Proposed change: extend the migration parity check to verify the ordered migration inventory sections contain every forward migration that should be in operator scope, then refresh the SQL SOP/database migration docs to make `164`-`168` placement explicit. Preserve the intentional `134` gap as documented history rather than forcing a renumber.
- Behavior/UI/UX impact: none.
- Validation path: `npm -C frontend run docs:check`; direct `node scripts/check_migration_doc_parity.js`; manual check that the auth-signup migration paragraph still points to the Supabase Auth hook requirement.
- Gate/owner: Nuclo/Copperknot SQL-operations documentation lane.

### F-007 - Close the Stripe webhook endpoint proof gap in billing launch-readiness

- ID: F-007
- Status: candidate
- Launch lane: billing/signup-to-paid-use proof
- Evidence level: Production Checked
- Source seam: `scripts/check_billing_launch_readiness.mjs`, Stripe webhook endpoint configuration, local/ops credential packet
- Problem: `npm -C frontend run billing:launch-readiness` passed production route, Vercel env, public pricing catalog, production Supabase billing catalog, hidden-free-tier, signup-trigger, and billing-renewal worker checks, but warned that Stripe webhook endpoint event proof is unproven because `STRIPE_SECRET_KEY` is unavailable locally. `npm -C frontend run billing:launch-readiness -- --strict` exits non-zero for that warning.
- Why it matters for July 7: the signup-to-paid-use path depends on Stripe webhook projection. Vercel env presence is useful, but it is not the same as proof that Stripe has an enabled production endpoint pointed at `https://www.shortpulse.ai/api/billing/stripe/webhook` with the required events.
- Proposed change: before launch signoff, run the existing strict billing readiness check with a valid read-capable Stripe secret in the approved local credential boundary, or capture equivalent Stripe dashboard/CLI proof in a retained billing/Copperknot artifact. Do not change billing behavior unless the proof reveals a real endpoint/event mismatch.
- Behavior/UI/UX impact: none.
- Validation path: `npm -C frontend run billing:launch-readiness -- --strict` returns exit code `0`; retained artifact includes endpoint id/status and required-event coverage without exposing secrets.
- Gate/owner: Money Stuff/Copperknot billing launch-readiness lane.

### F-008 - Harden project-persistence E2E cleanup before any live run

- ID: F-008
- Status: candidate
- Launch lane: project/workspace persistence; test/ops hygiene
- Evidence level: Repo Inspected
- Source seam: `frontend/tests/e2e/project-persistence.audit.js`, `frontend/package.json` script `test:e2e:project-persistence`
- Problem: the project-persistence audit is a mutating browser/API audit: it signs in, creates a real project, creates/renames/moves a global Media Library folder, writes a project workspace snapshot, then verifies reopen behavior. The script deletes the created project in `finally`, but the temporary Media Library folder is deleted only on the happy path before the UI reopen. If the audit fails after folder creation and before folder deletion, it can leave a real user-global folder behind in the audit account. In this no-edit audit, the local run failed early because the script defaulted to `http://localhost:3000` with no server, and it was not rerun against production because that would create live data.
- Why it matters for July 7: project persistence needs production/authenticated proof, but launch proof scripts should be safe to rerun without accumulating operator/test residue or changing user-visible state more than necessary.
- Proposed change: move folder cleanup into the same `finally` cleanup path as project deletion, track `folderId` outside the happy-path block, and make the script's startup output clearly state that it is mutating and which base URL/account it will use. Consider requiring an explicit `PLAYWRIGHT_PROJECT_BASE_URL` for non-local runs so production execution is intentional.
- Behavior/UI/UX impact: none.
- Validation path: run the audit against a controlled local/staging environment with an induced failure after folder creation and verify both project and folder cleanup occur; only run against production with explicit user approval and a dedicated audit account.
- Gate/owner: Copperknot/Gottspan project-persistence proof lane.

### F-009 - Reconcile dashboard account-summary test with the API-backed billing contract

- ID: F-009
- Status: candidate
- Launch lane: dashboard/account summary; billing signup-to-paid-use proof; test reliability
- Evidence level: Locally Tested
- Source seam: `frontend/tests/pages/dashboard.actions.test.tsx`, `frontend/features/dashboard/components/AuthenticatedDashboardRoute.tsx`, `frontend/features/billing/accountSummary.ts`
- Problem: the dashboard actions suite has one failing test in the admin/dashboard smoke lane. The test expects the signed-in AI credits card accessible name to be `AI credits: 86 / 12,000`, which matches `AuthenticatedDashboardRoute` after `fetchBillingAccountSummary()` resolves a `monthlyCreditsCents` value. The test's `fetchWithAuthMock` handles announcements and projects, but does not handle `/api/billing/account-summary`; that makes the component fall back to a baseline account summary and render the observed accessible name `AI credits: 86` while the link still points to `/profile?section=credits`.
- Why it matters for July 7: this is not evidence of a broken credits link, but it is a broken launch smoke test around the dashboard account summary and billing-plan projection. It can hide a real regression by making agents discount the suite as stale.
- Proposed change: update the test fixture to mock `/api/billing/account-summary` with the current API payload shape, wait for the settled account-summary state, and keep the assertion focused on the accessible link name plus destination. If the intended product contract has changed to hide the denominator, update the expectation and add a separate assertion that plan metadata is loaded from the account-summary API.
- Behavior/UI/UX impact: none intended; test-only unless investigation proves the product should change.
- Validation path: `npm -C frontend run test -- tests/pages/dashboard.actions.test.tsx`; rerun the dashboard/admin smoke cluster that failed in this checkpoint.
- Gate/owner: dashboard/billing boundary owner; Copperknot launch smoke-test lane.

### F-010 - Centralize jsdom media-element mocks for dashboard/tutorial tests

- ID: F-010
- Status: candidate
- Launch lane: tooling/tests/scripts/config; dashboard/tutorial validation
- Evidence level: Repo Inspected
- Source seam: `frontend/vitest.setup.ts`, `frontend/tests/pages/dashboard-tutorial-grid.test.tsx`, `frontend/tests/pages/dashboard.guest-route.test.tsx`, `frontend/tests/pages/public-home-video-gallery.test.tsx`
- Problem: the shared Vitest setup already suppresses jsdom's noisy canvas `getContext` warning, but dashboard/tutorial runs still emit repeated `Not implemented: HTMLMediaElement's pause/load/play method` errors unless individual tests install local spies. Multiple page tests mock `HTMLMediaElement.prototype.play` and `pause` ad hoc, while the dashboard smoke cluster that failed for F-009 also emitted repeated media-method warnings.
- Why it matters for July 7: noisy validation output makes real launch failures harder to see, especially when agents are running broad smoke clusters under time pressure. This is test-harness signal quality, not product behavior.
- Proposed change: add conservative default `HTMLMediaElement` no-op mocks in shared test setup, preserving per-test override ability. Include `load`, `play`, and `pause` because all three appear in jsdom warnings or local mocks.
- Behavior/UI/UX impact: none; test environment only.
- Validation path: rerun dashboard/tutorial page tests and confirm warnings drop without reducing assertions around video hover, modal playback, or gallery behavior.
- Gate/owner: Gottspan/tooling or dashboard tutorial validation lane.

### F-011 - Stabilize the Expert Edit Reset All integration gate

- ID: F-011
- Status: candidate
- Launch lane: AI Studio Edit / Expert Edit release gate
- Evidence level: Locally Tested
- Source seam: `frontend/features/ai-studio/components/edit/__tests__/ExpertEditPanelView.integration.test.tsx`, `frontend/features/ai-studio/components/edit/useExpertEditStageHistory.ts`, `frontend/features/ai-studio/components/edit/useExpertEditTransformHistory.ts`
- Problem: `npm -C frontend run test:expert-edit:coordinate-parity:core` consistently fails in the full Expert Edit core gate on `keeps layers while Reset All clears transform, markup, and inpaint session state`. The failing assertion expects the second dropped layer transform scale to reset from `0.5` to `1`, but the last published session-state update still has `0.5`. Running only that filtered test passes, while running the full `ExpertEditPanelView.integration.test.tsx` file fails, which points to intra-file isolation or async session-publication ordering rather than a clean deterministic single-test failure.
- Why it matters for July 7: Expert Edit is a high-risk stage surface, and its coordinate/reset gate should be trustworthy. A flaky or order-dependent reset/session-state assertion weakens release proof and may hide a real state-publication bug around reset, markup, inpaint, and layer transforms.
- Proposed change: investigate the integration-file order dependency, then make the reset/session-state publication deterministic. Likely seams are the multi-step `handleResetGeneralAction()` sequence and the test's use of the last `onSessionStateChange` call. Preserve current UI/UX behavior; do not redesign Reset All.
- Behavior/UI/UX impact: none intended. If the product bug is real, the behavior-preserving intent is that Reset All reliably clears all layer transforms, markup, viewport, and inpaint session state exactly as the existing test describes.
- Validation path: `npm -C frontend run test:expert-edit:coordinate-parity:core` passes repeatedly; `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/ExpertEditPanelView.integration.test.tsx` passes as a full file; the filtered single test remains green.
- Gate/owner: Expert Edit source owner / Gottspan tooling gate.

### F-012 - Make AI Studio browser release-check proof boundaries explicit and cleanup-safe

- ID: F-012
- Status: candidate
- Launch lane: AI Studio Create/Pulse/perf/style/audio browser proof
- Evidence level: Repo Inspected
- Source seam: `frontend/scripts/pulse-custom-contract-release-check.mjs`, `frontend/scripts/pulse-builtin-contract-release-check.mjs`, `frontend/scripts/ai-studio-perf-release-check.mjs`, `frontend/tests/e2e/pulse-custom-contract.audit.js`, `frontend/tests/e2e/pulse-builtin-contract.audit.js`, `frontend/tests/e2e/ai-studio-style-drop.audit.js`, `frontend/tests/e2e/ai-studio-audio-exclusivity.audit.js`, `frontend/tests/e2e/ai-studio-loading-gate.audit.js`
- Problem: AI Studio has useful browser audit gates, but they cannot run in this audit shell without `PLAYWRIGHT_AUDIT_EMAIL` and related credentials. Several are not pure read-only checks: the custom Pulse contract audit creates and later deletes a custom Pulse, the style-drop audit seeds runtime Reference Grid items, and the audio-exclusivity audit creates/deletes Media Library audio fixtures. The loading-gate audit defaults to a production URL, while the Pulse/perf release checks build/start a local production server by default and then run real-account browser flows.
- Why it matters for July 7: these gates are the closest proof for live Create/Pulse/perf/audio behavior, but launch agents need a crisp boundary between local production-server proof, production URL proof, and live account mutations. Without that boundary, the checks are easy to skip or run unsafely.
- Proposed change: add a short browser-audit proof runbook or script preflight summary that states, before execution, the target URL, required credentials, whether the audit mutates account state, cleanup behavior, and the retained artifact location. Where practical, add a `--preflight` or `--dry-run` mode that prints this without launching a browser. Harden cleanup for any created audit account records before using these as July 7 signoff evidence.
- Behavior/UI/UX impact: none.
- Validation path: run each release check with approved audit credentials and retained artifacts; verify custom Pulse/audio cleanup succeeds after induced failures; keep browser production checks pointed at `https://www.shortpulse.ai` when the proof claim is production behavior.
- Gate/owner: Copperknot/Gottspan AI Studio browser-proof lane.

### F-013 - Add section-index parity checks for SOP and ADR inventories

- ID: F-013
- Status: candidate
- Launch lane: docs/SOP/ADR/index drift; tooling
- Evidence level: Locally Tested
- Source seam: `docs/sops/README.md`, `docs/adr/README.md`, `scripts/check_docs_links.js`, `npm -C frontend run docs:check`
- Problem: `npm -C frontend run docs:check` passes, but manual inventory checks found real section-index omissions. `docs/sops/README.md` is missing `docs/sops/sop_account_health_snapshot.md` and `docs/sops/sop_ai_studio_internal_drag_drop_intake.md`; both are active operational docs and both are already listed in top-level `docs/README.md`. `docs/adr/README.md` is missing `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md` and `docs/adr/0096-google-oauth-signup-intent-match.md`; ADR 0096 is the newest Google OAuth signup-intent launch ADR and is listed in top-level `docs/README.md`.
- Why it matters for July 7: agents rely on section indexes to find the current runbook/ADR before editing. Missing index entries can make an agent miss the canonical drag/drop intake SOP, the account-health operator snapshot SOP, or the current Google OAuth signup-intent decision during launch work.
- Proposed change: update the SOP and ADR indexes, then extend docs checks with section-index parity for `docs/sops/sop_*.md` and numbered `docs/adr/*.md`. Keep planning-folder parity separate because the planning corpus still includes historical/working-doc transition state.
- Behavior/UI/UX impact: none.
- Validation path: `npm -C frontend run docs:check`; a new or extended docs-index check fails if active SOP/ADR files are missing from their section README.
- Gate/owner: Gottspan/docs-governance lane.

### F-014 - Restore the full TypeScript gate by fixing AI Studio test-fixture type drift

- ID: F-014
- Status: candidate
- Launch lane: tooling/tests/scripts/config; AI Studio media/reference-grid test contracts
- Evidence level: Locally Tested
- Source seam: `frontend/features/ai-studio/components/__tests__/MediaLibraryMediaGrid.test.tsx`, `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`, `frontend/features/ai-studio/reference-grid/components/__tests__/ReferenceGridCard.test.tsx`, `frontend/features/ai-studio/logic/generationReplay.ts`, `frontend/features/ai-studio/components/MediaLibraryMediaGrid.tsx`
- Problem: `npm -C frontend run type-check` fails on test fixtures. `MediaLibraryMediaGrid.test.tsx` passes `dangerActionMode="delete"` where the component type now accepts only `"separate" | "exclusive"`. Two Reference Grid tests create generated-video replay fixtures with `generationReplay.mode: "video"` and `submitTool: "video"`, while `GenerationReplaySubmitTool` and the current replay config type are image-only. `npm -C frontend run build` still passes, so production compile is healthy, but the CI `type_check` job runs `npm run type-check` and would reject this state.
- Why it matters for July 7: a red TypeScript gate blocks safe production-branch coordination and trains agents to distrust validation output. Because the errors are in launch-adjacent AI Studio media/reference tests, they should be resolved rather than bypassed.
- Proposed change: update the tests or the shared replay types to match the intended contract. If video replay metadata is intentionally supported, extend the typed replay union and parser. If video tests only need workflow reload/duration behavior, remove or narrow the invalid image replay fixture. Update `dangerActionMode` test setup to the current component contract.
- Behavior/UI/UX impact: none intended; likely test/type-only unless the replay type union is intentionally expanded to reflect existing runtime data.
- Validation path: `npm -C frontend run type-check` passes; `npm -C frontend run build` remains green; rerun the affected Reference Grid and Media Library suites.
- Gate/owner: Gottspan/tooling plus Holomony/media-display or AI Studio reference owner.

### F-015 - Add explicit dry-run/apply gates to production-touching Supabase sync helpers

- ID: F-015
- Status: candidate
- Launch lane: ops/database/storage cutover safety
- Evidence level: Repo Inspected
- Source seam: `scripts/ops/supabase_hot_table_delta_sync.sh`, `scripts/ops/supabase_media_generation_delta_sync.sh`, `scripts/ops/supabase_public_acl_sync.sh`, `scripts/ops/supabase_storage_rclone_sync.sh`, `scripts/ops/README.md`
- Problem: the ops toolkit is useful and discoverable, but several production-touching helpers default to mutation once the relevant credentials are present. The hot-table and media-generation delta scripts read `SHORTPULSE_STAGING_DB_URL` and `SHORTPULSE_PRODUCTION_DB_URL`, export rows from source, and immediately upsert into the target database. `supabase_public_acl_sync.sh` supports `--mode emit|apply` but defaults to `apply` and can fall back to `SHORTPULSE_PRODUCTION_DB_URL` when no development target is set. `supabase_storage_rclone_sync.sh` supports `--dry-run`, `check`, and `size`, but defaults to `--mode copy` with `dry_run=false`. Other nearby high-impact scripts already use safer patterns, for example `supabase_seed_single_user_staging_to_dev.mjs` requires `--apply` and `rollout_shortpulse_subscription_catalog.mjs` supports `--dry-run`.
- Why it matters for July 7: launch-week database/storage reconciliation may happen under pressure, and these scripts touch production rows, grants, auth refresh tokens, credit ledgers, generation/media lineage, and storage objects. A missing explicit apply gate raises operator-error risk even if the script logic is otherwise correct.
- Proposed change: add a consistent preflight/apply contract to production-touching ops scripts. At minimum, print source/target labels, target host/project identity, mode, row/object counts, and mutation scope before writes; require `--apply` or `--mode apply` for DB upserts/copy operations; make ACL sync emit-only by default or require explicit apply when the target is production; make rclone default to `size` or `check` unless `--mode copy --apply` is explicit. Preserve existing command names and documented operator flows.
- Behavior/UI/UX impact: none; operator tooling only.
- Validation path: shell syntax checks for touched scripts, dry-run/preflight invocation without production credentials, an induced bad-target test that refuses to mutate without `--apply`, and a documented production runbook update in `scripts/ops/README.md`.
- Gate/owner: Nuclo/Copperknot ops-safety lane.

### F-016 - Reconcile Vercel env contract required keys with `frontend/.env.example`

- ID: F-016
- Status: candidate
- Launch lane: env contract / admin access / launch tooling
- Evidence level: Repo Inspected
- Source seam: `scripts/lib/vercel_env_contract.mjs`, `scripts/check_vercel_env_contract.mjs`, `frontend/.env.example`
- Problem: `scripts/lib/vercel_env_contract.mjs` requires `SHORTPULSE_ADMIN_EMAILS` for both preview and production Vercel environments, but `frontend/.env.example` does not declare that key. The same contract uses `frontend/.env.example` as the source for `KNOWN_VERCEL_KEYS`, so a correctly configured Vercel project containing the required admin key can also be reported as an undeclared/unknown key. The same quick diff shows mirrored media-list flags `SHORTPULSE_MEDIA_LIST_API_ENABLED` and `NEXT_PUBLIC_MEDIA_LIST_API_ENABLED` referenced in the env contract but absent from `frontend/.env.example`; those are not currently required keys, so the admin key is the launch-relevant issue.
- Why it matters for July 7: admin access is launch-critical and Vercel env audits are part of production proof. A self-contradicting contract creates warning noise at exactly the place agents need a crisp pass/fail signal.
- Proposed change: add `SHORTPULSE_ADMIN_EMAILS` to `frontend/.env.example` with a safe placeholder and, if the media-list mirror flags remain active contract members, declare them there too with explicit default values. Consider adding a small unit check that every `REQUIRED_VERCEL_KEYS_BY_ENVIRONMENT`, mirrored flag key, and guarded flag key is present in either `frontend/.env.example` or the local/tooling-only allowlist.
- Behavior/UI/UX impact: none.
- Validation path: `node scripts/check_vercel_env_contract.mjs --environment production` with approved Vercel auth; a focused script/unit check for required-key declaration parity; `npm -C frontend run docs:check` if docs are updated.
- Gate/owner: Nuclo/Copperknot env-contract lane.

### F-017 - Hide framework disclosure and decide public crawler discovery files

- ID: F-017
- Status: candidate
- Launch lane: deployment/runtime config; public trust; SEO/discovery
- Evidence level: Production Checked
- Source seam: `frontend/next.config.js`, `frontend/pages/_document.tsx`, `frontend/public/`
- Problem: production root currently returns strong baseline headers, including CSP, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`, and HSTS from Vercel, but it also returns `x-powered-by: Next.js`. Production probes for `https://www.shortpulse.ai/robots.txt` and `https://www.shortpulse.ai/sitemap.xml` both return `404`. There is no `robots.txt` or sitemap route/file in the repo.
- Why it matters for July 7: this is not a product blocker, but launch-hardening should reduce unnecessary framework disclosure and make an explicit public-crawler decision. A 404 robots file is ambiguous: maybe acceptable for an app-first launch, but it is not an intentional launch posture.
- Proposed change: set `poweredByHeader: false` in `frontend/next.config.js`. Add an explicit `frontend/public/robots.txt` with the desired launch crawl posture, and add or intentionally defer `sitemap.xml` based on whether the public homepage/pricing/docs pages are meant to be discoverable at launch. If sitemap is deferred, document the decision in the public-route or launch checklist instead of leaving it as an accidental 404.
- Behavior/UI/UX impact: none; HTTP metadata/static discovery only.
- Validation path: `npm -C frontend run build`; production header probe confirms `x-powered-by` is absent after deploy; `curl https://www.shortpulse.ai/robots.txt` returns the intended policy; route/docs checks if sitemap or route docs are updated.
- Gate/owner: Copperknot/Nuclo deployment-public-surface lane.

### F-018 - Deduplicate runtime SQL security audit so the summary covers the full function set

- ID: F-018
- Status: candidate
- Launch lane: SQL/security release gate accuracy
- Evidence level: Repo Inspected
- Source seam: `sql/check_runtime_sql_security_audit.sql`
- Problem: `sql/check_runtime_sql_security_audit.sql` contains two full `with expected_functions as` query blocks. The first block emits detailed per-check rows and includes 49 expected runtime RPC signatures. The second block emits the summary with `total_checks`, `passing_checks`, and `failing_checks`, but its expected-function list has only 43 signatures. The summary list is missing `activate_billing_plan_offer`, `activate_billing_storage_addon_offer`, `get_media_folder_item_counts`, `reorder_dashboard_tutorials`, `get_active_legal_policy`, and `publish_legal_policy`. Current launch docs cite the summary form, so operators can see `failing_checks = 0` while the summary is not covering the same function set as the detailed report.
- Why it matters for July 7: runtime SQL security audit is a release gate for service-role-only RPC posture. A drifted summary undermines the trustworthiness of the exact number agents report during launch readiness, especially for billing, media-folder, dashboard tutorial, and legal policy control-plane functions.
- Proposed change: refactor the SQL audit so the expected-function list is declared once and reused for both detailed and summary outputs, or make the script emit one summary over the same `all_checks` CTE as the detailed output. Add a lightweight static parity test that fails if duplicated expected-function blocks drift.
- Behavior/UI/UX impact: none; read-only audit script/tooling only.
- Validation path: run the audit against staging/production with approved hosted SQL credentials and require `failing_checks = 0`; verify the reported total includes all expected functions; add a script/unit check that finds exactly one expected-function list or proves list parity.
- Gate/owner: Dave/Nuclo/Copperknot SQL security release-gate lane.

## Checkpoint Log

### 2026-06-28 Checkpoint 1 - Startup, Inventory, First Static Signals

Commands/checks run:

- `git branch --show-current` -> `production`.
- `git config --local shortpulse.allowedBranch` -> `production`.
- `git status --short` before report creation -> clean.
- `rg --files ... | wc -l` over repo excluding `node_modules`, `frontend/.next`, and `mini-ecosystem` -> 5,185 files.
- File-type inventory: top counts were 2,019 Markdown, 1,979 TypeScript, 440 TSX, 339 SQL, 93 MJS, 82 CSS, and 40 JSON files.
- Page/API inventory: 171 API route files under `frontend/pages/api`; 28 non-API page files under `frontend/pages`; 927 test/audit files across frontend source/test roots.
- Ignored local output directories present but untracked: `.vercel/output` 245 files, `frontend/.vercel/output` 3, `frontend/coverage` 83, `frontend/playwright-report` 18, `frontend/test-results` 2, `.tmp` 21, `supabase/.temp` 9. These are ignored by `.gitignore` or scoped `.gitignore`; no tracked output files were found in those paths.
- Supabase transform scan over non-test runtime source found only guard/rejection/inventory references: `frontend/lib/mediaPreviewTrustPolicy.ts`, `frontend/features/media-library/logic/mediaPreviewSigningBatch.ts`, and helper scripts. `npm -C frontend run test:supabase-transform-guard` passed.
- `npm -C frontend run check:size-budget` passed, but warned that `frontend/features/ai-studio/hooks/useAiStudioState.ts` is 953 lines against a 950-line reference-grid warning budget.
- `npm -C frontend run test -- tests/scripts/deployment-route-parity.test.mjs` passed.
- Production read-only probe for `https://www.shortpulse.ai/dev/ai-studio-stage-bakeoff` returned `404`.
- Launch-board top metadata still carries June 8 snapshot facts and a dirty-worktree note; current repo freshness is commit `7ef871892` with only this audit artifact/index modified.
- Systems catalog launch-facing metadata is older than its own 7-day freshness rule for many rows; active exact queue evidence is fresher in the June 28 launch queue.

Inventory notes:

- The root `package.json` has no scripts; operational scripts live in `frontend/package.json`.
- Existing validation coverage is broad, including `validate`, `docs:check`, `check:size-budget`, `check:architecture-boundary`, `fal:routes:check`, `model:doctor`, `check:generation-pipeline-legacy`, `check:generate-cta-contract`, `test:supabase-transform-guard`, and production-facing audit scripts.
- `frontend/tsconfig.tsbuildinfo` is ignored and untracked but can pollute broad explicit-path `rg` searches; future audit commands should exclude it with `-g '!frontend/tsconfig.tsbuildinfo'`.

### 2026-06-28 Checkpoint 2 - Launch-Control And Route/Security Guardrails

Commands/checks run:

- `npm -C frontend run docs:check` passed.
- `npm -C frontend run test -- tests/api/protected-api-paths.parity.test.ts tests/api/auth-guarded-ai-routes.test.ts tests/api/internal-route-inventory-regression.test.ts` passed: 3 files / 8 tests.
- `npm -C frontend run test:frontend-fast-lane` passed: 6 files / 36 tests.
- `npm -C frontend run check:generation-pipeline-legacy` passed: 220 files scanned.
- `npm -C frontend run check:test-script-paths` passed: 7 scripts checked.
- `npm -C frontend ls canvas sharp --depth=3` showed `canvas@3.2.3` via `fabric@7.4.0` and `jsdom`, and `sharp@0.34.5` directly plus via `next@16.2.6`.

Route/security notes:

- Protected API path parity, auth-guarded AI route coverage, internal route inventory, Fal status auth/ownership, and auth latency benchmark tests are green locally.
- Legacy generation-path guard is green and confirms retired generic generation routes are not active in scanned code/docs.
- The local route/security test lane emitted the native `canvas`/`sharp` duplicate-class warning recorded in F-005.

### 2026-06-28 Checkpoint 3 - SQL/Security Guardrails And Migration Parity

Commands/checks run:

- Read SQL/security authorities: `docs/sops/sop_sql_migration_operations.md`, `docs/database-migrations.md`, `docs/security-checklist.md`, and `sql/README.md`.
- Migration inventory: `sql/migrations/` has 167 forward migration files through `168_retire_saved_creators.sql`; `sql/migrations/rollback/` has 126 rollback files.
- Numeric-prefix check: no duplicate forward migration prefixes; missing prefix `134` is the only gap from `001` through `168`.
- Newest forward files present: `164_add_paid_signup_intent_gate.sql`, `165_account_first_signup_intent_gate.sql`, `166_grant_signup_hook_schema_usage.sql`, `167_add_google_ip_signup_intent.sql`, and `168_retire_saved_creators.sql`.
- Service-role key scan over production frontend source found only server-side references under `frontend/lib/server/**`; no browser component/feature/page source hit was identified in this pass.
- Active script/CI scan found SQL lint aligned with hosted explicit targeting: `.github/workflows/ci.yml` runs `npx supabase db lint --db-url "$DB_URL" --schema public --fail-on warning`; `scripts/run_repo_sweep.sh` requires `SUPABASE_DB_URL` when optional SQL lint is enabled; `frontend/package.json` blocks `db:reset` by design.
- Supabase transform guard remains the stronger runtime authority for image-transform prohibition; broad text scans include many intentional policy/doc references and CSS `transform:` noise, so follow-up scans should keep using the dedicated guard plus targeted runtime-only patterns.

SQL/security notes:

- Current CLI/script posture looks aligned with the no-Docker Supabase policy. Historical planning/evidence docs still mention local Supabase bootstrap work, but active scripts and CI no longer prescribe `supabase db lint --local`.
- `scripts/check_migration_doc_parity.js` passes because every migration appears somewhere across `docs/database-migrations.md` and `docs/sops/sop_sql_migration_operations.md`; it does not prove the ordered inventories themselves are fresh. This is recorded as F-006.

### 2026-06-28 Checkpoint 4 - Media Library And Reference Delivery

Commands/checks run:

- Read media authorities: `docs/sops/sop_ai_studio_media_library_operations.md` and `docs/sops/sop_media_performance_operations.md`.
- Inspected hot routes: `frontend/pages/api/media/list.ts`, `frontend/pages/api/media/sign-batch.ts`, `frontend/pages/api/media/resolve-previews.ts`, and `frontend/pages/api/internal/media-derivatives/run.ts`.
- `npm -C frontend run media:checkpoint:preview-authority` passed: 4 focused media preview/signing suites green.
- `npm -C frontend run media:checkpoint:count-hot-path` passed: 2 focused media list/count suites green.
- `npm -C frontend run media:checkpoint:deep-scroll-performance` passed: 8 focused suites plus `type-check:touched` green.
- `npm -C frontend run media:checkpoint:panel-runtime-churn` passed: 4 focused panel runtime/churn suites green.
- `npm -C frontend run media:readiness` reported local repo diagnostics ready and linked Supabase inspect healthy, with live app phase0 probe blocked by missing bearer token env and raw SQL shell path blocked by missing `psql`.
- `npm -C frontend run test -- lib/server/api/__tests__/mediaDerivativesRuntimeFlags.test.ts lib/server/api/__tests__/mediaDeliveryPaths.test.ts lib/server/__tests__/mediaUploadService.directUpload.test.ts lib/server/__tests__/mediaLibraryDeleteService.test.ts lib/server/__tests__/mediaFoldersService.test.ts` passed: 5 files / 28 tests.
- `npm -C frontend run test -- tests/api/media-list.test.ts tests/api/media-resolve-previews.test.ts tests/api/media-sign-batch.test.ts tests/api/media-prepare-upload-route.test.ts tests/api/media-finalize-upload-route.test.ts tests/api/internal-media-derivatives-run.test.ts tests/api/media-delete.test.ts tests/api/media-folders-crud.test.ts tests/api/media-folders-membership-batch.test.ts tests/api/media-copy-from-url.test.ts` was split/rerun after filename correction; route coverage passed across the existing media API suites, including prepare/finalize upload and internal derivative auth.
- `npm -C frontend run test -- features/ai-studio/utils/__tests__/audioUpload.test.ts features/ai-studio/utils/__tests__/imageUpload.test.ts features/ai-studio/logic/__tests__/mediaLibraryPanelApi.test.ts` passed: 3 files / 36 tests.

Media notes:

- The inspected media routes enforce bearer auth, user-scoped path checks, bounded request sizes, fixed `media_library` bucket authority, transform-free Supabase signing calls, and cron-secret protection for the derivative worker.
- The current repo has strong local media proof. The remaining gap is proof level: authenticated production/staging media probes and hosted SQL diagnostics require bearer/SQL access that is not available in this shell. `media:readiness` already reports that boundary accurately, so no separate repo fix is recorded from this checkpoint.
- The native `canvas`/`sharp` duplicate-class warning recurred in media server-side test runs and remains covered by F-005.

### 2026-06-28 Checkpoint 5 - Generation, Provider, Pricing, And Billing Boundaries

Commands/checks run:

- `npm -C frontend run fal:routes:check` passed: 17 route families checked.
- `npm -C frontend run model:doctor` passed: 30 catalog entries checked and 5 Character Mode models verified.
- `npm -C frontend run test -- tests/api/fal-route-inventory-regression.test.ts tests/api/fal-submit-proxy.test.ts tests/api/fal-status-proxy.test.ts tests/api/fal-status.auth-context.test.ts tests/api/fal-status.ownership.test.ts tests/api/fal-status-persisted-results.test.ts tests/api/kie-status-route-config.test.ts` passed: 7 files / 100 tests.
- `npm -C frontend run test -- tests/api/generation-billing.reservations.test.ts tests/api/generation-billing.pricing-params.test.ts tests/sql/generation-reservation-metadata.test.ts tests/api/generation-reconcile.route.test.ts tests/api/generation-reconcile.test.ts tests/api/generation-abandon.route.test.ts tests/api/internal-generation-recovery-run.test.ts` passed: 7 files / 56 tests.
- `npm -C frontend run test -- lib/server/providerIntegration/__tests__/canonicalProviderPayload.test.ts lib/server/providerIntegration/__tests__/kieEnvelopeNormalizer.test.ts lib/server/providerIntegration/__tests__/kieModelContracts.test.ts lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts lib/server/providerIntegration/__tests__/kieSubmitMediaGuards.test.ts lib/server/providerIntegration/__tests__/kieSubmitTransportContracts.test.ts lib/server/providerIntegration/__tests__/providerRuntimeConfig.test.ts lib/server/providerIntegration/__tests__/recoveryProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts` passed: 11 files / 102 tests.
- `npm -C frontend run test -- lib/server/falIntegration/__tests__/falWebhookIngress.test.ts lib/server/falIntegration/__tests__/providerTrustPolicy.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts lib/server/falIntegration/__tests__/recoveryFetchWithTimeout.test.ts lib/server/falIntegration/__tests__/recoveryGenerationLookup.test.ts lib/server/falIntegration/__tests__/recoveryLifecycleTransitions.test.ts lib/server/falIntegration/__tests__/recoveryMediaPersistence.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts lib/server/falIntegration/__tests__/submitEngine.test.ts` passed: 11 files / 95 tests.
- `npm -C frontend run test -- lib/server/generationControlPlane/__tests__/controlPlaneWake.test.ts lib/server/generationControlPlane/__tests__/observationBatchExecution.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchAcquisition.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts lib/server/generationControlPlane/__tests__/runCycle.test.ts lib/server/generationControlPlane/__tests__/workerLoop.test.ts` passed: 6 files / 25 tests.
- `npm -C frontend run test -- tests/api/billing-catalog.test.ts tests/api/billing-credit-packages.test.ts tests/api/model-pricing-policy.test.ts tests/api/admin-pricing-state.test.ts tests/api/admin-pricing-mutations.test.ts tests/api/admin-billing-contracts-update.test.ts tests/api/admin-billing-customer-sync.test.ts tests/api/admin-billing-diagnostics.test.ts tests/api/admin-billing-portal.test.ts tests/api/internal-billing-contract-renewals-run.test.ts` passed: 10 files / 57 tests.
- `npm -C frontend run test -- lib/server/api/__tests__/modelPricingControlPlane.test.ts lib/server/api/generationAdmission/__tests__/generationAdmissionPolicy.test.ts lib/server/api/generationAdmission/__tests__/generationAdmissionService.test.ts lib/server/api/__tests__/activeProviderCapacity.test.ts lib/server/api/__tests__/directGenerationSettlement.test.ts lib/server/api/__tests__/generationBilling.ownershipResolver.test.ts lib/server/api/generationBilling/__tests__/ownershipResolver.test.ts lib/server/api/generationBilling/__tests__/pricingParams.test.ts` passed: 8 files / 57 tests.
- `npm -C frontend run test -- tests/api/elevenlabs-voices.test.ts tests/api/elevenlabs-voice-delete-route.test.ts tests/api/elevenlabs-voice-clone-route.test.ts tests/api/elevenlabs-voice-design-route.test.ts tests/api/elevenlabs-speech-to-speech-route.test.ts tests/api/elevenlabs-text-to-speech-route.test.ts tests/api/elevenlabs-music-route.test.ts tests/api/elevenlabs-sound-effects-route.test.ts tests/api/voiceover-enhance-route.test.ts` passed: 9 files / 73 tests.
- `npm -C frontend run billing:launch-readiness` passed production checks with summary `pass=9 warn=1 fail=0`.
- `npm -C frontend run billing:launch-readiness -- --strict` failed with the same `stripe_webhook_endpoint` warning because `STRIPE_SECRET_KEY` is unavailable locally.

Generation/billing notes:

- Local route, provider-contract, billing-reservation, generation-recovery, and direct audio-provider guardrails are broad and green.
- The one launch-signoff gap found in this checkpoint is proof-level: Stripe endpoint/event evidence is not available to the strict billing readiness gate in this shell. This is recorded as F-007.
- The native `canvas`/`sharp` duplicate-class warning recurred in generation/provider tests and remains covered by F-005.

### 2026-06-28 Checkpoint 6 - Project Workspace Persistence

Commands/checks run:

- Read project authority: `docs/sops/sop_ai_studio_projects_foundation.md`.
- Inspected hot seams: `frontend/lib/server/projectApiRoutes/workspace.ts` and the opening of `frontend/lib/server/projectWorkspaceStatesService.ts`.
- `npm -C frontend run test -- tests/api/projects-auth-boundary.test.ts tests/api/projects-create.test.ts frontend/tests/pages/ai-studio.project-modal-boundary.test.ts frontend/tests/pages/ai-studio.project-route-hardening.test.ts` passed, with Vitest finding the two actual matching page/API test files in this invocation: 2 files / 40 tests.
- `npm -C frontend run test -- lib/server/__tests__/projectsService.test.ts lib/server/__tests__/projectWorkspaceStatesService.test.ts lib/server/__tests__/projectGenerationAssociationsService.test.ts features/ai-studio/reference-projections/__tests__/referenceProjections.test.ts` passed: 4 files / 126 tests.
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/projectWorkspaceApiClient.test.ts features/ai-studio/logic/__tests__/projectWorkspaceAutosavePerf.test.ts features/ai-studio/logic/__tests__/projectWorkspaceQuickSlotDiagnostics.test.ts features/ai-studio/logic/__tests__/sessionIdentity.test.ts features/ai-studio/logic/__tests__/sessionSnapshot.test.ts features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts features/ai-studio/createRuntime/__tests__/sessionAgentHydrationBoundary.test.ts` passed: 7 files / 133 tests.
- `npm -C frontend run test:e2e:project-persistence` failed locally with `net::ERR_CONNECTION_REFUSED` because the script defaulted to `http://localhost:3000` and no local server was running.
- The E2E audit was not rerun against `https://www.shortpulse.ai` because it creates live project/folder/workspace data, and this lane is audit-only with no live mutation approval.

Project persistence notes:

- Focused unit/API/page tests for project identity, project route hardening, workspace services, snapshot parsing/hydration, autosave perf, quick-slot diagnostics, and reference projections are green locally.
- The production/browser proof path exists but is mutating. Its cleanup should be hardened before launch-week production use; this is recorded as F-008.

### 2026-06-28 Checkpoint 7 - Admin, Observability, Issue Reporting, And Dashboard Smoke

Commands/checks run:

- Read admin safety authority: `docs/sops/sop_ai_studio_agent_safety_control_plane.md`.
- `npm -C frontend run test -- tests/api/admin-access.test.ts tests/api/admin-agent-safety.test.ts tests/api/admin-agent-instructions-route.test.ts tests/api/admin-agent-instructions-route-auth.test.ts tests/api/admin-agent-instructions-route-normalization.test.ts tests/api/admin-agent-instructions-route-versions.test.ts tests/api/admin-agent-instructions-apply.test.ts tests/api/admin-agent-instructions-archive.test.ts tests/api/admin-agent-instructions-order.test.ts tests/api/admin-agent-instructions-style-extract-prompt.test.ts` passed: 10 files / 65 tests.
- `npm -C frontend run test -- tests/api/admin-reports.test.ts tests/api/admin-report-errors.test.ts tests/api/admin-error-events-ingest.test.ts tests/api/admin-error-events-route.test.ts tests/api/admin-kanban.test.ts tests/api/admin-user-health.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/admin-users.test.ts tests/api/admin-users-credits.test.ts tests/api/admin-public-reads.test.ts tests/api/internal-admin-snapshot-run.test.ts tests/api/internal-issue-maintenance-run.test.ts tests/api/internal-user-health-fleet-run.test.ts` passed: 13 files / 80 tests.
- `npm -C frontend run test -- tests/api/admin-announcements.test.ts tests/api/admin-announcements-route.test.ts tests/api/admin-tutorials-route.test.ts tests/api/admin-tutorials-reorder-route.test.ts tests/api/admin-tutorials-youtube-metadata-route.test.ts tests/api/admin-offers.test.ts tests/api/admin-offers-route.test.ts tests/api/report-issue-route.test.ts tests/api/report-issue-screenshot.test.ts tests/api/public-report-issue.test.ts` passed: 10 files / 54 tests.
- `npm -C frontend run test -- tests/api/admin-generation-recovery-trace.test.ts tests/api/admin-generation-recovery-stats.test.ts tests/api/admin-credits.test.ts tests/api/admin-credits-events-route.test.ts tests/api/admin-credits-savings-route.test.ts tests/api/admin-pricing-state.test.ts tests/api/lib-error-events-service.test.ts tests/api/lib-error-fingerprint.test.ts tests/api/lib-issue-screenshot-storage.test.ts tests/api/lib-issueStore.test.ts` passed: 10 files / 42 tests.
- `npm -C frontend run test -- tests/pages/admin.agent-instructions.test.tsx tests/pages/admin.analytics.test.tsx tests/pages/admin.announcements.test.tsx tests/pages/admin.billing-customer-sync.test.tsx tests/pages/admin.billing-diagnostics.test.tsx tests/pages/admin.error-events.test.tsx tests/pages/admin.generation-recovery.test.tsx tests/pages/admin.offer-form.test.tsx tests/pages/admin.public-reads.test.tsx tests/pages/admin.users-credits.test.tsx` passed: 10 files / 42 tests.
- `npm -C frontend run test -- features/admin/components/__tests__/AdminAgentInstructionsSection.test.tsx features/admin/components/__tests__/AgentInstructionEditForm.test.tsx features/admin/components/__tests__/AgentInstructionFormFields.test.tsx features/admin/components/__tests__/AgentInstructionSectionPicker.test.tsx features/admin/components/__tests__/AgentInstructionRow.test.tsx features/admin/components/__tests__/AgentInstructionVersionHistoryModal.test.tsx features/admin/components/__tests__/DashboardAnnouncementForm.test.tsx features/admin/components/__tests__/IssueReportScreenshotPreview.test.tsx features/admin/utils/__tests__/adminAgentInstructionsSubmission.test.ts features/admin/utils/__tests__/adminAgentInstructionsValidation.test.ts` passed: 10 files / 28 tests.
- `npm -C frontend run test -- tests/pages/dashboard-modal-portal.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.actions.test.tsx tests/pages/dashboard.announcements.test.tsx tests/pages/dashboard.bootstrap.test.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/report-issue.test.tsx` failed: 1 failed / 6 passed files, 1 failed / 55 passed tests. The failing assertion is recorded in F-009.

Admin/dashboard notes:

- Admin auth boundaries, agent-instruction control plane routes, issue-reporting APIs, announcement/tutorial/offer APIs, internal maintenance routes, admin pages, and admin components are broadly green locally.
- The dashboard smoke failure is localized to account-summary test setup and does not show a broken profile link. It does show that a key billing/dashboard test fixture has drifted from the current `/api/billing/account-summary` client contract.
- The same dashboard smoke run emitted repeated jsdom media-method warnings, recorded as F-010.

### 2026-06-28 Checkpoint 8 - AI Studio Create/Pulse/Edit/Video/Sound/Voice/Right Rail

Commands/checks run:

- Read current AI Studio contract authorities: `docs/sops/sop_ai_studio_pulse_mode.md`, `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`, and `docs/adr/0083-create-mode-global-right-rail-authority.md`.
- AI Studio source inventory: 981 source files and 285 test files under `frontend/features/ai-studio` at max depth 3.
- `npm -C frontend run check:generate-cta-contract` passed.
- `npm -C frontend run check:style-literal-guard` passed.
- `npm -C frontend run test:pulse-custom-contract:release-check` failed at preflight because `PLAYWRIGHT_AUDIT_EMAIL` is required.
- `npm -C frontend run test:pulse-builtin-contract:release-check` failed at preflight because `PLAYWRIGHT_AUDIT_EMAIL` is required.
- `npm -C frontend run test:character-panel` passed: 9 files / 87 tests.
- `npm -C frontend run test:expert-edit:coordinate-parity:core` failed: 1 failed / 6 passed files, 1 failed / 77 passed tests. The failing Expert Edit reset assertion is recorded in F-011. A filtered run of that single test passed, while the full integration file still failed.
- Create/Pulse runtime tests passed: 7 files / 37 tests.
- Create/Pulse component tests passed: 9 files / 91 tests.
- Create/Pulse hook/orchestration/Pulse-chat tests passed: 10 files / 67 tests.
- Reference Grid controller tests passed: 17 files / 110 tests.
- Reference Grid component/logic/projection tests passed: 15 files / 250 tests.
- Canvas/right-rail shared surface tests passed: 14 files / 143 tests.
- Right-rail/drop/reference-state tests passed: 12 files / 112 tests.
- Video panel/payload tests passed: 10 files / 202 tests.
- Sound/music/audio tests passed: 8 files / 86 tests.
- Voice changer/audio-generation tests passed: 7 files / 127 tests.
- Model policy/view-model tests passed: 7 files / 106 tests.

AI Studio notes:

- Local unit/integration coverage is broad and mostly green across Standard/Pulse isolation, global right-rail authority, reference/canvas behavior, Video, Sound, Voice, Character Mode, model policy, and provider payload seams.
- Expert Edit's core coordinate/reset gate is not currently green as a full release gate; record and fix F-011 before relying on it for launch signoff.
- Browser audits for Pulse contracts, performance, style drop, loading gate, Character Mode picker, and audio exclusivity are available but credential/live-surface gated. Some mutate the dedicated audit account. This proof boundary is recorded in F-012.
- The jsdom `HTMLMediaElement` warning recurred in Reference Grid, Canvas, and Video tests, reinforcing F-010.

### 2026-06-28 Checkpoint 9 - Docs, ADR/SOP Indexes, Tooling, Build, And Branch Safety

Commands/checks run:

- Loaded doc-governance helpers: `skills/skill-doc-index/SKILL.md` and `skills/skill-mvp-docs-sop-governance/SKILL.md`.
- Docs inventory: 2,060 files under `docs/`; top-level docs section indexes exist for `docs/`, `docs/adr/`, `docs/agents/`, `docs/api/`, `docs/archive/`, `docs/brainstorming/`, `docs/design/`, `docs/planning/`, `docs/product/`, `docs/records/`, `docs/sops/`, `docs/systems/`, and the newly present `docs/testers/`.
- Read index authorities: `docs/README.md`, `docs/documentation_overview.md`, `docs/sops/README.md`, `docs/adr/README.md`, and `docs/known-issues.md`.
- `npm -C frontend run docs:check` passed.
- `node scripts/check_docs_links.js` passed.
- `node scripts/check_migration_doc_parity.js` passed, with the F-006 caveat that the check does not prove ordered migration inventories are coherent.
- Manual SOP index parity found missing section entries for `docs/sops/sop_account_health_snapshot.md` and `docs/sops/sop_ai_studio_internal_drag_drop_intake.md`. Both are listed in top-level `docs/README.md`, but not `docs/sops/README.md`.
- Manual ADR index parity found missing section entries for `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md` and `docs/adr/0096-google-oauth-signup-intent-match.md`. ADR 0096 is listed in top-level `docs/README.md`; ADR 0050 is missing there too.
- `npm -C frontend run lint` passed.
- `npm -C frontend run type-check` failed with five AI Studio test-fixture type errors, recorded in F-014.
- `npm -C frontend run build` passed.
- `npm -C frontend run check:architecture-boundary` passed.
- `npm -C frontend run check:naming-legacy-usage` passed.
- `npm -C frontend run deadcode:check` passed.
- `npm -C frontend run docs:check:frontend-contracts` passed.
- `npm -C frontend run check:test-script-paths` passed.
- `npm -C frontend run check:size-budget` passed in warn mode, with the existing `useAiStudioState.ts` 953-line warning against the 950-line reference-grid budget.
- `npm -C frontend run test:supabase-transform-guard` passed.
- `npm -C frontend run fal:routes:check` passed.
- `npm -C frontend run model:doctor` passed.
- Inspected `.husky/pre-commit`, `.husky/pre-push`, and `scripts/git-enforce-current-branch.sh`; branch enforcement blocks commit/push unless current and pushed branch match local `shortpulse.allowedBranch`.
- Inspected `.github/workflows/ci.yml`; `push` is limited to `production`, and the split frontend compatibility gate depends on `type_check`, so the current local type-check failure is CI-relevant even though build passes.

Docs/tooling notes:

- The docs/link checks are healthy for broken links, API doc top-level indexing, semantic route/API drift, archive manifest integrity, model catalog parity, naming drift, operator-map drift, and migration mention parity.
- The docs checks do not currently catch active SOP or ADR section-index omissions; this is recorded as F-013.
- Production build is green; full TypeScript is not. This is recorded as F-014 and should be fixed before relying on the CI frontend compatibility gate.
- Current worktree contains unrelated user/external changes in `docs/README.md`, `docs/planning/backlog.md`, AI Studio view-model files, `docs/records/evidence/ux/*`, and `docs/testers/`; this audit did not modify those files.

### 2026-06-28 Checkpoint 10 - Security, Dependency, And Ops Mutation Safety Recheck

Commands/checks run:

- Workspace safety check for generated backup/build artifacts returned no `.next.bak`, `.next-*`, `*backup*`, or `*bak*` paths at max depth 3.
- Current branch remains `production`; local `shortpulse.allowedBranch` remains `production`.
- `node scripts/check_secret_exposure.js` passed.
- CI security job inspection confirmed the production dependency audit is the blocking gate: `npm audit --omit=dev --audit-level=moderate`.
- Local production dependency audit summary for `npm -C frontend audit --omit=dev --audit-level=moderate --json` reported zero production vulnerabilities: info `0`, low `0`, moderate `0`, high `0`, critical `0`, total `0`.
- `npm -C frontend run deadcode:check` passed.
- Inspected `scripts/ops/README.md`, `scripts/ops/secret_rotation_validate.sh`, `scripts/ops/rollout_shortpulse_subscription_catalog.mjs`, `scripts/ops/supabase_hot_table_delta_sync.sh`, `scripts/ops/supabase_media_generation_delta_sync.sh`, `scripts/ops/supabase_public_acl_sync.sh`, `scripts/ops/supabase_storage_rclone_sync.sh`, and `scripts/ops/supabase_seed_single_user_staging_to_dev.mjs`.

Security/dependency/ops notes:

- Secret scanning and production dependency posture are green locally and align with CI's blocking security gate.
- The ops toolkit has strong discoverability and several good safety examples: secret-rotation validation defaults to `https://www.shortpulse.ai` for production proof, the subscription catalog rollout supports `--dry-run`, and the single-user staging-to-development seed script requires `--apply`.
- Production-touching Supabase sync helpers are the main ops hardening opportunity from this pass. Hot-table/media-generation delta scripts immediately upsert into the target once URLs are present, ACL sync defaults to apply mode and can fall back to production target env, and rclone storage sync defaults to copy mode with `dry_run=false`. This is recorded as F-015.

### 2026-06-28 Checkpoint 11 - Env Contract, Public Assets, And Static Surface Hygiene

Commands/checks run:

- Inventory of `frontend/public` showed a local ignored `frontend/public/.DS_Store` plus expected brand, dashboard, gallery, loading-entry, and style assets.
- `git ls-files '*DS_Store*'` returned no tracked `.DS_Store` files; `git check-ignore -v frontend/public/.DS_Store` confirmed `.gitignore:5:.DS_Store`.
- Production probe for `https://www.shortpulse.ai/.DS_Store` returned `404`; production probe for `https://www.shortpulse.ai/Fav.png` returned `200 image/png`, confirming static public asset serving works but the local `.DS_Store` is not deployed.
- Largest public assets are gallery/homepage videos, with top sizes around `9.9M`, `8.1M`, `7.4M`, and several `3.4M`-`5.2M` MP4 files. This pass did not find a launch-blocking static asset issue because current homepage/gallery media coverage already has dedicated performance/readiness lanes.
- Compared keys declared in `.env.agent.local.example` and `frontend/.env.example`.
- Inspected `scripts/check_vercel_env_contract.mjs`, `scripts/lib/vercel_env_contract.mjs`, and `scripts/check_billing_launch_readiness.mjs`.
- Quick required-key declaration diff found `SHORTPULSE_ADMIN_EMAILS` is required by `REQUIRED_VERCEL_KEYS_BY_ENVIRONMENT` for preview and production but absent from `frontend/.env.example`. This is recorded as F-016.

Env/static notes:

- The local `.DS_Store` under `frontend/public` is ignored/untracked and production returns 404, so it is not being promoted to the launch worklist. It can be deleted during ordinary local cleanup but is not a current production-source finding.
- The env contract is otherwise pointed at the right kind of proof: production billing readiness enforces the production URL, uses the Vercel env contract, probes billing-critical routes, checks public pricing, and keeps Stripe webhook proof optional unless a local live Stripe key is available.
- The env-contract self-drift around `SHORTPULSE_ADMIN_EMAILS` is worth fixing because it affects launch-proof signal quality rather than product behavior.

### 2026-06-28 Checkpoint 12 - Deployment Runtime Headers And Public Discovery

Commands/checks run:

- Inspected `frontend/next.config.js`, `frontend/pages/_document.tsx`, and `frontend/pages/_app.tsx`.
- Production root header probe for `https://www.shortpulse.ai/` returned `200` with CSP, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`, Vercel HSTS, and `x-powered-by: Next.js`.
- Production probes: `/robots.txt` returned `404`; `/sitemap.xml` returned `404`; `/pricing` returned `200`; `/dashboard` returned `200`.
- Static shell inspection confirmed favicon is set through `_document.tsx` as `/Fav.png`.

Deployment/public-surface notes:

- Baseline deployment headers are present and production-aligned. The CSP is broad enough to support current media/provider/runtime needs and should not be tightened casually before launch without browser proof.
- The remaining low-risk hardening opportunity is framework disclosure plus explicit crawler/discovery posture. This is recorded as F-017.

### 2026-06-28 Checkpoint 13 - Public Legal, Policy, And Support Routes

Commands/checks run:

- Inspected public/admin legal surfaces: `frontend/pages/terms.tsx`, `frontend/pages/privacy.tsx`, `frontend/pages/refund-policy.tsx`, `frontend/pages/admin/legal.tsx`, `frontend/pages/api/admin/legal/policies/**`, `frontend/features/legal/**`, `frontend/content/legal/*.md`, and `frontend/features/dashboard/components/PublicHomeFooter.tsx`.
- Read legal-policy architecture authority `docs/adr/0093-legal-policy-control-plane.md`.
- Compared against retained stale handoff `docs/agents/copperknot/handoffs/2026-06-20-public-legal-policy-pages-launch-gate.md`; the handoff's original missing-route problem is resolved in current source.
- Production probes returned `200` for `/terms`, `/privacy`, `/refund-policy`, and signed-in support route `/report-issue`; `/contact` returned `404`, but footer/legal content routes users to support/billing/privacy/legal/copyright/safety email addresses and the signed-in issue-reporting route instead of a public contact page.
- Focused validation passed: `npm -C frontend run test -- tests/pages/admin.legal.test.tsx tests/api/admin-legal-policies.test.ts tests/api/report-issue.test.ts tests/pages/report-issue.test.tsx tests/pages/legal-policy-pages.test.tsx` -> 5 files / 18 tests.

Legal/support notes:

- No new implementation finding from this pass. The previously retained legal-route gate is stale relative to current code: public legal pages exist, route docs list them, footer links point to them, and tests cover the public/admin/reporting seams.
- Residual legal risk remains content-authority risk, not repo implementation risk. The audit cannot certify that policy language is counsel-approved; it can only prove route/runtime/test posture.

### 2026-06-28 Checkpoint 14 - Static SQL/RLS/Runtime Security Audit Posture

Commands/checks run:

- Re-read `docs/security-checklist.md`, especially RLS, Data API grants, service-role-only control planes, runtime SQL audit, and route-auth boundary expectations.
- Static SQL scan over migrations and rollback files counted 293 SQL files under `sql/migrations`, 133 `create policy` lines, 79 `enable row level security` lines, 19 permissive `using (true)` / `with check (true)` lines, and 4 `grant ... to anon` lines.
- Permissive-policy samples were consistent with public pricing/catalog reads or service-role-only management policies in billing/admin migrations, not an obvious user-owned-data exposure from static inspection.
- `grant ... to anon` samples were only in rollback scripts for historical grants, including `rollback/132_harden_public_data_api_default_privileges_rollback.sql`.
- Inspected `sql/storage_policies.sql`; `media_library` storage policies are scoped to service role or `auth.uid()` path prefix.
- Inspected runtime security audit references in scripts/docs. `scripts/reliability_control_plane_diagnostics.sh` invokes `sql/check_runtime_sql_security_audit.sql`, and docs require `failing_checks = 0` before release signoff.
- Inspected `sql/check_runtime_sql_security_audit.sql`; found duplicated expected-function query blocks with drift between detailed output and summary output. This is recorded as F-018.

SQL/security notes:

- Static RLS/storage policy posture did not surface a new obvious data-isolation defect. The meaningful source issue is the audit script's self-drift: its summary gate omits six functions checked by the detailed result set.
- Retained/current launch docs report recent production `failing_checks = 0` evidence, but F-018 means the summary count should be fixed and re-run before treating the runtime SQL security gate as clean for final July 7 signoff.

### 2026-06-28 Checkpoint 15 - Auth, Signup, Profile, And Account Bootstrap

Commands/checks run:

- Inspected auth/account entry surfaces: `frontend/pages/auth.tsx`, `frontend/pages/sign-up.tsx`, `frontend/pages/log-in.tsx`, `frontend/pages/auth/callback.tsx`, `frontend/pages/api/auth/callback-url.ts`, `frontend/pages/api/auth/signup-intent.ts`, `frontend/pages/api/account/bootstrap.ts`, profile/account pages, auth redirect helpers, and signup-intent migrations `164`-`167`.
- Read route/security expectations for `/sign-up`, `/log-in`, `/auth/callback`, `/api/auth/signup-intent`, account bootstrap, zero-credit account-first signup, and Google OAuth signup-intent gating from `docs/routes.md` and `docs/security-checklist.md`.
- First attempted auth test command only matched 2 files / 19 tests because several requested filenames were stale; reran with current filenames.
- Focused current auth/account/profile validation passed: `npm -C frontend run test -- tests/api/auth-callback-url.test.ts tests/api/auth-signup-intent.test.ts tests/api/account-identity.test.ts tests/lib/authRedirects.test.ts tests/pages/auth.route-behavior.test.tsx tests/pages/auth.callback.route-behavior.test.tsx tests/pages/profile.account-actions.test.tsx tests/pages/profile.account-settings.test.tsx tests/pages/profile.billing-actions.test.tsx tests/pages/profile.route-state.test.tsx tests/pages/profile.storage-actions.test.tsx tests/pages/profile.subscription-actions.test.tsx tests/pages/profile.transactions-actions.test.tsx tests/pages/protected-route-bootstrap-gate.test.tsx features/pricing/components/__tests__/PricingRoute.auth-bootstrap.test.tsx features/billing/__tests__/accountSummary.test.ts features/billing/__tests__/useResolvedAccountPlan.test.ts` -> 17 files / 151 tests.

Auth/account notes:

- Local source/test posture for callback URL safety, signup-intent route behavior, Google signup/sign-in routing, profile account actions, protected-route bootstrap, pricing auth bootstrap, billing account summary helpers, and account identity/bootstrap is green.
- No new source finding from this pass. Live production signup/OAuth/provider-hook proof was not attempted because this lane is audit-only and live signup/auth mutation requires explicit approval and a current production credential/proof plan.

### 2026-06-28 Checkpoint 16 - Final Dedupe And July 7 Worklist

Commands/checks run:

- Ledger consistency script found 18 finding headings: F-001 through F-018.
- Duplicate finding headings: none.
- Every finding heading appears in the Current July 7 Priority Stack.
- `npm -C frontend run docs:check` passed after the final report additions.
- Final worktree review still shows unrelated user/external changes outside this report lane; this audit did not modify product/UI/UX/code behavior files.

Final dedupe notes:

- P0 remains the only true "fix before relying on launch gates" bucket: TypeScript gate red (F-014), Expert Edit core gate red (F-011), and Stripe webhook endpoint proof unavailable to strict billing readiness (F-007).
- P1 contains launch-hardening work that reduces proof/operator risk without changing user-visible behavior: dashboard billing smoke fixture (F-009), project-persistence cleanup (F-008), browser-audit preflight/cleanup boundaries (F-012), runtime SQL audit summary accuracy (F-018), production-touching ops apply gates (F-015), and expected-404 route proof (F-002).
- P2/P3 are docs/tooling/public-surface signal improvements and governed maintainability cleanup. They should not displace red gates unless a lane owner explicitly changes launch priority.

## Current July 7 Priority Stack

This is the final deduped pre-launch worklist from this audit pass. It is not launch signoff; it is the next best implementation queue if the audit lane is promoted from no-edit to fix mode.

### P0 - Fix before relying on launch gates

1. F-014: restore `npm -C frontend run type-check`.
   - Reason: CI `type_check` is part of the split frontend compatibility gate. Build is green, but production-branch safety still depends on full TypeScript.
2. F-011: stabilize `npm -C frontend run test:expert-edit:coordinate-parity:core`.
   - Reason: Expert Edit reset/session-state proof is currently red as a full gate.
3. F-007: close the Stripe webhook endpoint proof gap.
   - Reason: signup-to-paid-use launch proof remains warning-only without read-capable Stripe evidence.

### P1 - High-ROI launch hardening

4. F-009: fix dashboard account-summary test drift.
   - Reason: dashboard/billing smoke coverage is currently red for a stale API-backed fixture.
5. F-008: harden project-persistence E2E cleanup before any live production run.
   - Reason: the most relevant project-persistence browser proof mutates real audit data and should be failure-clean.
6. F-012: add explicit browser-audit preflight/runbook for AI Studio Pulse/perf/style/audio checks.
   - Reason: these are the closest live-browser proofs, but target URL, credentials, mutation, and cleanup boundaries need to be explicit.
7. F-018: deduplicate runtime SQL security audit so summary proof covers the full function set.
   - Reason: the current summary gate can pass while omitting billing, media-folder, dashboard tutorial, and legal policy control-plane functions from the counted check set.
8. F-015: add explicit dry-run/apply gates to production-touching Supabase sync helpers.
   - Reason: launch-week data/storage reconciliation should require an intentional apply step before touching production rows, grants, or objects.
9. F-002: add automated production expected-404 probe for `/dev/ai-studio-stage-bakeoff`.
   - Reason: current production behavior is safe, but not part of the standard proof set.

### P2 - Documentation and validation signal quality

10. F-016: reconcile Vercel env contract required keys with `frontend/.env.example`.

- Reason: required production admin env should not also appear as an undeclared/unknown key in env audits.

11. F-013: add SOP/ADR section-index parity and refresh missing entries.

- Reason: active docs exist but are missing from their section indexes.

12. F-006: strengthen migration-doc parity for ordered migration inventories.

- Reason: the current check proves mentions, not operator-list coherence.

13. F-003 and F-004: refresh stale launch board/systems catalog headers or route readers to the fresher queue.

- Reason: delegated-authority docs should not foreground outdated launch facts.

14. F-010 and F-005: reduce noisy jsdom/native validation warnings.

- Reason: noisy tests make launch-week failure triage slower and less trustworthy.

15. F-017: hide framework disclosure and decide public crawler discovery files.

- Reason: small deployment/public-surface hardening with no intended UI behavior change.

### P3 - Keep as governed cleanup

16. F-001: extend size-budget inventory/warn coverage to current oversized source surfaces.

- Reason: worthwhile governance, but broad refactors should not jump ahead of red gates or proof gaps.

## Audit Coverage

- [x] Startup and authority load.
- [x] Branch/config/worktree freshness check.
- [x] Repo inventory and generated-artifact guardrail pass.
- [x] Launch queue and board consistency pass.
- [x] Routes and API inventory pass.
- [x] Auth/security route-manifest pass.
- [x] Media Library and reference delivery pass.
- [x] AI Studio Create/Edit/Video/Sound/Voice/Pulse pass.
- [x] Generation lifecycle, pricing, credits, and provider route pass.
- [x] Project/workspace persistence pass.
- [x] Admin/observability/issue-reporting pass.
- [x] Docs/SOP/ADR/index drift pass.
- [x] SQL/migration/diagnostic script pass.
- [x] Tooling/tests/scripts/config pass.
- [x] Security/dependency/ops mutation-safety pass.
- [x] Env contract and public/static asset hygiene pass.
- [x] Deployment headers and public discovery pass.
- [x] Public legal/policy/support route pass.
- [x] Static SQL/RLS/runtime security audit posture pass.
- [x] Auth/signup/profile/account bootstrap pass.
- [x] Final dedupe and prioritized July 7 worklist.

## Next Checkpoint

If this audit lane is promoted from no-edit to fix mode, start with P0 in order: F-014, F-011, then F-007. Do not begin adjacent fixes without a concrete repo-backed problem statement, preserved UI/UX behavior, and a validation plan tied to the owning source seam.
