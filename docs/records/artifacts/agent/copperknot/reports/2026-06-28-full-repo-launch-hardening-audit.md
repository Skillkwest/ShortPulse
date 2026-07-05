# Full Repo Launch Hardening Audit - 2026-06-28

Purpose: running audit-only ledger for high-ROI ShortPulse launch-hardening findings before the July 7, 2026 launch decision.

Status: original audit-list implementation and proof gates complete as of Checkpoint 35 on 2026-06-28. Checkpoint 36 cleaned the local proof residue, tightened the public-surface regression guard, and preserved older unresolved/blocked checkpoint text as historical evidence only.

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
- Status: resolved locally during Checkpoint 32
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
- Status: resolved locally during Checkpoint 25, with production-safe proof
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
- Status: resolved locally during Checkpoint 29
- Launch lane: launch-control docs / queue authority
- Evidence level: Repo Inspected
- Source seam: `docs/agents/copperknot/july-7-launch-board.md`
- Problem: the launch board begins with `Snapshot date: 2026-06-08`, commit anchor `a621b6f54`, and a dirty-worktree note, while the current repo is on commit `7910dadc1`, current branch/config are `production`, and the only current worktree change in this lane is this audit report. The board does include fresher June 28 evidence and a warning that older snapshot bullets are retained history, but the top metadata still foregrounds old context.
- Why it matters for July 7: launch-control docs are delegated authority surfaces. Stale top-of-file facts can cause agents to classify current clean files as dirty/parallel-owned, rely on old validation counts, or waste time reconciling evidence that has already been superseded.
- Proposed change: refresh the launch board's opening snapshot into a "baseline retained" section plus a current freshness header that points to the June 28 queue rows. Do not rewrite historical bullets; clearly mark them as retained history and keep current branch/worktree/commit freshness separate.
- Behavior/UI/UX impact: none.
- Validation path: `npm -C frontend run docs:check`; manual check that `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md` remains the exact queue authority.
- Gate/owner: Copperknot launch-control docs lane.

### F-004 - Reconcile stale systems-catalog launch-facing fields with the June 28 queue

- ID: F-004
- Status: resolved locally during Checkpoint 29
- Launch lane: systems catalog / launch-control docs
- Evidence level: Repo Inspected
- Source seam: `docs/systems/catalog.md`, `docs/systems/README.md`, `docs/systems/launch-fitness-scorecard-2026-06-16.md`
- Problem: `docs/systems/README.md` now correctly routes active July 7 readiness decisions to Copperknot launch-control docs and marks the June 16 scorecard as historical, but `docs/systems/catalog.md` still has many `Last reviewed` dates in May and points to the June 16 launch-fitness scorecard as the current easy-read scorecard. The active launch queue now contains June 28 evidence and state changes.
- Why it matters for July 7: agents use the systems catalog for inventory and boundary mapping. If launch-facing fields look current when they are stale, agents can pick the wrong seam, rerun old proof, or underweight fresh queue evidence.
- Proposed change: refresh the launch-facing catalog/scoreboard rows from the June 28 launch queue, or change the catalog's top note so it matches `docs/systems/README.md` and treats the June 16 scorecard as historical/secondary. Keep `/10` maturity scoring separate from July 7 launch state.
- Behavior/UI/UX impact: none.
- Validation path: `npm -C frontend run docs:check`; targeted grep for references that call the June 16 scorecard "current" after the refresh decision.
- Gate/owner: Copperknot/Gottspan system-catalog lane.

### F-005 - Investigate native test-runtime warning from `canvas` plus `sharp`

- ID: F-005
- Status: resolved locally during Checkpoint 30
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
- Status: resolved locally during Checkpoint 28
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
- Status: production-checked during Checkpoint 35
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
- Status: resolved locally during Checkpoint 21
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
- Status: resolved locally during Checkpoint 20
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
- Status: resolved locally during Checkpoint 30
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
- Status: resolved locally during Checkpoint 19
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
- Status: resolved locally during Checkpoint 22
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
- Status: resolved locally during Checkpoint 27
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
- Status: resolved locally during Checkpoint 19
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
- Status: resolved locally during Checkpoint 24
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
- Status: resolved locally during Checkpoint 26, with production audit pass
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
- Status: resolved locally during Checkpoint 31 and production-checked during Checkpoint 34
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
- Status: resolved locally during Checkpoint 23
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
- Docs inventory: 2,060 files under `docs/`; top-level docs section indexes exist for `docs/`, `docs/adr/`, `docs/agents/`, `docs/api/`, `docs/archive/`, `docs/brainstorming/`, `docs/design/`, `docs/planning/`, `docs/product/`, `docs/records/`, `docs/sops/`, `docs/systems/`, and the newly present `docs/agents/testers/`.
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
- Current worktree contains unrelated user/external changes in `docs/README.md`, `docs/planning/backlog.md`, AI Studio view-model files, `docs/records/evidence/ux/*`, and `docs/agents/testers/`; this audit did not modify those files.

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

### 2026-06-28 Checkpoint 17 - Re-audit Against Current Repo State

Mode: audit-only refresh of this list. No product source, UI, UX, route behavior, SQL, env, or ops script files were changed.

Fresh repo boundary:

- Current branch remains `production`.
- Local `shortpulse.allowedBranch` remains `production`.
- Worktree was clean before this report update.
- Workspace safety check found no generated backup/build artifact paths matching `.next.bak`, `.next-*`, `*backup*`, or `*bak*` at max depth 3.
- Subagents were skipped for this refresh because the known finding list needed direct local proof checks rather than new disjoint research lanes.

Re-audit commands/checks run:

- `npm -C frontend run type-check` still fails with the same five AI Studio test-fixture type errors in `MediaLibraryMediaGrid.test.tsx`, `ReferenceGrid.curated.test.tsx`, and `ReferenceGridCard.test.tsx`.
- `npm -C frontend run test:expert-edit:coordinate-parity:core` still fails the full Expert Edit core gate at `ExpertEditPanelView.integration.test.tsx:449`, with the second layer transform scale remaining `0.5` instead of resetting to `1`.
- `npm -C frontend run test -- tests/pages/dashboard.actions.test.tsx` still fails the dashboard account-summary card test because the rendered credits link is `AI credits: 86` instead of the expected `AI credits: 86 / 12,000`; the run also still emits many jsdom `HTMLMediaElement.pause()` warnings.
- `npm -C frontend run billing:launch-readiness -- --strict` still exits non-zero only because Stripe webhook endpoint event proof is unavailable without local `STRIPE_SECRET_KEY`; production env, route parity, public pricing, Supabase catalog, hidden free tier, signup trigger, and renewal-worker checks pass.
- Static parity for `sql/check_runtime_sql_security_audit.sql` still finds two expected-function lists: `49` signatures in the detailed block and `43` in the summary block. The summary still omits billing offer activation, media folder counts, tutorial reorder, and legal policy functions.
- Env contract grep still shows `SHORTPULSE_ADMIN_EMAILS` required in `scripts/lib/vercel_env_contract.mjs`, while `frontend/.env.example` still lacks that declaration. Mirrored media-list flags remain referenced in the contract and absent from `.env.example`.
- Manual SOP/ADR section-index parity still finds `docs/sops/sop_account_health_snapshot.md`, `docs/sops/sop_ai_studio_internal_drag_drop_intake.md`, `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md`, and `docs/adr/0096-google-oauth-signup-intent-match.md` missing from their section README indexes.
- `node scripts/check_migration_doc_parity.js` still passes, but targeted grep confirms `docs/sops/sop_sql_migration_operations.md` mentions migrations `164`-`167` in the top layout while its ordered `Current set` still stops at `163`; `docs/database-migrations.md` lists `168_retire_saved_creators.sql` in the long required set.
- `npm -C frontend run check:size-budget` still passes in warn mode, with `frontend/features/ai-studio/hooks/useAiStudioState.ts` at `953` lines over the `950` line reference-grid budget.
- Production probe for `https://www.shortpulse.ai/dev/ai-studio-stage-bakeoff` still returns `404`, so the route behavior remains safe but still deserves automated expected-404 coverage.
- Production root header probe showed CSP, Permissions-Policy, Referrer-Policy, HSTS, and `X-Frame-Options`; the second-pass probe in Checkpoint 18 also returned `x-powered-by: Next.js`, so framework disclosure remains open. `robots.txt` and `sitemap.xml` still return `404`, and no root `frontend/public/robots.txt` or `frontend/public/sitemap.xml` file exists.
- `docs/agents/copperknot/july-7-launch-board.md` now includes a freshness warning that latest active evidence lives in the table plus June 28 entries, but the header still foregrounds the June 8 snapshot date, old commit anchor, and dirty-worktree note.
- `docs/systems/README.md` now correctly routes active July 7 readiness to Copperknot launch-control docs and marks the June 16 scorecard as historical. `docs/systems/catalog.md` still says to use `docs/systems/launch-fitness-scorecard-2026-06-16.md` for the "current easy-read" launch-fitness scores.
- `frontend/tests/e2e/project-persistence.audit.js` still declares `folderId` inside the happy-path block and deletes the audit folder before UI reopen; the `finally` cleanup still deletes only the project/browser context. The cleanup-hardening finding remains open despite retained production proof that one successful run completed.
- Browser audit scripts still require real audit credentials and mix local default server proof, production URL proof, and mutating audit-account behavior without a shared dry-run/preflight boundary.
- Ops script grep still shows `supabase_public_acl_sync.sh` defaulting to `MODE="apply"` and `supabase_storage_rclone_sync.sh` defaulting to `MODE="copy"` with `DRY_RUN="false"`, while safer adjacent scripts use `--apply` or dry-run patterns.
- `npm -C frontend ls canvas sharp --depth=3` still shows `canvas@3.2.3` through `fabric`/`jsdom` and `sharp@0.34.5` through Next/direct dependency, so the native warning's dependency shape remains plausible.
- Supporting safety checks passed: `npm -C frontend run docs:check:frontend-contracts`, `node scripts/check_secret_exposure.js`, and `npm -C frontend run test:supabase-transform-guard`.

Re-audited finding status:

| Finding | Current status                                                                                                                                                                            | Priority impact                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| F-014   | Still open and still P0. `type-check` remains red on the same five AI Studio fixture/type-contract errors.                                                                                | No change.                                                       |
| F-011   | Still open and still P0. Expert Edit full core gate remains red on Reset All session-state publication.                                                                                   | No change.                                                       |
| F-007   | Still open and still P0 proof gap. Strict billing readiness still passes all non-Stripe checks but fails strict mode on missing Stripe endpoint event proof.                              | No change.                                                       |
| F-009   | Still open and still P1. Dashboard account-summary test remains red for stale billing-summary fixture behavior.                                                                           | No change.                                                       |
| F-008   | Still open and still P1, but not because the successful production proof is missing. The current repo script still has failure-cleanup risk for the created folder path.                  | No change.                                                       |
| F-012   | Still open and still P1. Browser audit proof boundaries remain scattered across credential-gated, mutating, local-default, and production-default checks.                                 | No change.                                                       |
| F-018   | Still open and still P1. Runtime SQL security audit summary still counts a smaller function set than the detailed audit.                                                                  | No change.                                                       |
| F-015   | Still open and still P1. Production-touching Supabase sync helpers still have mutation-friendly defaults.                                                                                 | No change.                                                       |
| F-002   | Still open and still P1. Production currently returns the desired `404`, but the expected-404 proof is still manual rather than part of the default automated gate.                       | No change.                                                       |
| F-016   | Still open and still P2. Required admin env declaration drift remains.                                                                                                                    | No change.                                                       |
| F-013   | Still open and still P2. The same SOP/ADR section-index omissions remain.                                                                                                                 | No change.                                                       |
| F-006   | Still open and still P2. Mention parity passes, but ordered operator inventories remain stale around the newest migration stream.                                                         | No change.                                                       |
| F-003   | Partially mitigated but still open. The board now warns that fresher evidence lives in current table/June 28 entries, but stale top metadata remains prominent.                           | Keep P2, lower urgency within the docs-cleanup cluster.          |
| F-004   | Partially mitigated but still open. `docs/systems/README.md` now routes readiness to Copperknot, but `docs/systems/catalog.md` still calls the June 16 scorecard current.                 | Keep P2, lower urgency within the docs-cleanup cluster.          |
| F-010   | Still open and still P2. Dashboard test output confirms repeated jsdom media-method warnings.                                                                                             | No change.                                                       |
| F-005   | Still open as a lower-confidence/noise item. Dependency shape remains, but this refresh did not reproduce the native duplicate-class warning directly.                                    | Keep P2/P3-level only; do not let it outrank concrete red tests. |
| F-017   | Still open. A second-pass production header probe returned `x-powered-by: Next.js`, and crawler/discovery posture remains accidental with `robots.txt` and `sitemap.xml` returning `404`. | Keep original public-surface hardening scope.                    |
| F-001   | Still open and still P3. Size-budget check remains green only in warn mode while large current source surfaces are outside conservative inventory coverage.                               | No change.                                                       |

Updated judgment:

- The P0 stack is unchanged: F-014, F-011, and F-007 remain the first fix/proof targets if this audit is promoted into implementation mode.
- The most meaningful status changes are partial mitigations, not closures: F-003/F-004 now have clearer freshness routing but still carry stale top-level/catalog language.
- No finding should be removed from the worklist yet. F-017 should remain the broader public-surface hardening item because the second-pass header probe still shows framework disclosure.

### 2026-06-28 Checkpoint 18 - Second-Pass Audit And Rewrite

Purpose: re-check the latest checkpoint and rewrite any wording that overstated a fix or carried stale facts from the first audit pass.

Second-pass checks:

- Report consistency script found `18` finding headings, `18` unique IDs, no duplicates, no missing expected IDs from F-001 through F-018, no missing findings from the priority stack, and no missing findings from the Checkpoint 17 status table.
- Current branch remains `production`; local `shortpulse.allowedBranch` remains `production`; no generated backup/build artifact paths were found by the workspace safety check.
- Current commit anchor for this audit refresh is `7910dadc1`; this supersedes the earlier retained F-003 wording that named `7ef871892`.
- `npm -C frontend run type-check` still fails on the same five AI Studio fixture/type-contract errors, so F-014 remains P0.
- `npm -C frontend run test:expert-edit:coordinate-parity:core` still fails the Reset All integration assertion at `ExpertEditPanelView.integration.test.tsx:449`, so F-011 remains P0.
- `npm -C frontend run billing:launch-readiness -- --strict` still has `9` pass, `1` warn, and `0` fail, but exits non-zero because Stripe webhook endpoint event proof is unavailable without local `STRIPE_SECRET_KEY`; F-007 remains P0 proof work.
- `npm -C frontend run test -- tests/pages/dashboard.actions.test.tsx` still fails the account-summary card assertion; the rendered credits link remains `AI credits: 86`, so F-009 remains P1.
- Production header recheck returned `x-powered-by: Next.js`. This corrects the softer Checkpoint 17 wording and keeps F-017 fully open.
- Production probes still returned `404` for `/dev/ai-studio-stage-bakeoff`, `robots.txt`, and `sitemap.xml`. Bakeoff behavior is safe but manually proven; crawler posture remains undecided.
- Static SQL audit recheck still found two expected-function lists in `sql/check_runtime_sql_security_audit.sql`, with `49` signatures in the detailed block, `43` in the summary block, and `6` functions missing from the summary set; F-018 remains P1.

Rewrite decisions:

- F-003 now names the current commit anchor and clarifies that the board has some freshness warning already, while stale top metadata still needs cleanup.
- F-004 now reflects the improved `docs/systems/README.md` wording and narrows the remaining issue to `docs/systems/catalog.md` and scorecard language.
- F-017 is restored to the broader framework-disclosure plus crawler-discovery scope because current production evidence still shows `x-powered-by: Next.js`.
- The priority stack remains unchanged after the second pass: P0 is F-014, F-011, F-007; P1 is F-009, F-008, F-012, F-018, F-015, F-002.

### 2026-06-28 Checkpoint 19 - P0 Implementation Pass And Stop Gate

Mode: implementation promotion for the existing audit list. Scope stayed limited to canonical P0 validation gates and the retained audit artifact; no UI, UX, route behavior, product semantics, billing policy, production data, commit, push, deploy, or release state was changed.

Issue-list source of truth:

- Active list: this report's `Current July 7 Priority Stack`, refreshed by Checkpoints 17 and 18.
- Active lane: Copperknot launch hardening, with F-007 owned by the Money Stuff/Copperknot billing launch-readiness seam.
- Protected contracts: preserve current UI/UX/design/copy/navigation/intended behavior, keep work on `production`, do not mutate production data or Stripe state, do not expose secrets, and do not change billing/credit behavior without explicit product authority.
- Stop condition hit: F-007 requires approved read-capable Stripe endpoint proof or equivalent Stripe dashboard/CLI evidence. The repo-owned checker is already correctly warning when `STRIPE_SECRET_KEY` is unavailable locally, and no source-code defect was proven.

Implementation/audit results:

| Finding | Current status                                  | Source fix or blocker                                                                                                                                                                                                 | Validation proof                                                                                                                                                                                                                                                                                                                                                 | Remaining risk                                                                                                                                    |
| ------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-014   | Solved locally.                                 | Corrected AI Studio test fixtures to match canonical type contracts: `dangerActionMode` uses `exclusive`, and video Reference Grid items use workflow reload instead of image-only `generationReplay`.                | `npm -C frontend run type-check` passed. `npm -C frontend run test -- features/ai-studio/components/__tests__/MediaLibraryMediaGrid.test.tsx features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx features/ai-studio/reference-grid/components/__tests__/ReferenceGridCard.test.tsx` passed: 3 files / 165 tests.                              | Local proof only until the changed tree is committed/deployed/CI-checked. Related jsdom media-method warnings remain tracked separately as F-010. |
| F-011   | Solved locally.                                 | Stabilized the Expert Edit Reset All integration assertion so it waits for the eventual published session-state reset instead of sampling an earlier post-reset publication. No runtime Expert Edit behavior changed. | `npm -C frontend run test:expert-edit:coordinate-parity:core` passed: 7 files / 78 tests. `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/ExpertEditPanelView.integration.test.tsx` passed: 1 file / 10 tests. A combined `npm -C frontend run type-check && npm -C frontend run test:expert-edit:coordinate-parity:core` also passed. | Local proof only until commit/deploy/CI.                                                                                                          |
| F-007   | Blocked on proof boundary; no code change made. | The readiness script intentionally requires local `STRIPE_SECRET_KEY` to prove the live Stripe endpoint and required events. Without that credential, strict mode correctly exits non-zero on the warning.            | `npm -C frontend run billing:launch-readiness -- --strict --json` returned 9 pass / 1 warn / 0 fail, with the only warning `stripe_webhook_endpoint`. `npm -C frontend run test -- tests/api/stripe-webhook.test.ts` passed: 1 file / 20 tests.                                                                                                                  | Production Stripe may still lack the enabled endpoint or required event set; this cannot be closed without approved live Stripe proof.            |

Updated judgment:

- The local repo no longer has the F-014 or F-011 P0 red-gate failures in the current worktree.
- F-007 remains the only unresolved P0 from this list, but it is now an external proof gate rather than an implementation target unless the approved Stripe proof reveals a real mismatch.
- The next implementation lane would normally be P1 F-009, but this run stops here because the current highest-priority remaining item depends on production/billing proof outside this agent's available credential boundary.

### 2026-06-28 Checkpoint 20 - F-009 Dashboard Account-Summary Gate

Mode: continued implementation after recording F-007 as an external proof gate. Scope stayed limited to the dashboard/account-summary smoke-test seam; no dashboard UI, UX, route behavior, billing policy, credit behavior, or account-summary runtime code changed.

Issue boundary:

- Active issue: F-009.
- Owner/lane: dashboard/account summary, billing signup-to-paid-use proof, Copperknot launch smoke-test lane.
- Source boundary: `frontend/tests/pages/dashboard.actions.test.tsx` fixture coverage for the already-canonical `fetchBillingAccountSummary()` API path.
- Protected behavior: signed-in dashboard account-summary cards must keep linking to the profile sections, and plan/credit display must continue to come from the authenticated account-summary boundary rather than test-only Supabase fixture assumptions.

Implementation/audit result:

- Reproduced the failure with `npm -C frontend run test -- tests/pages/dashboard.actions.test.tsx`: the suite rendered `AI credits: 86` because the test's `fetchWithAuth` mock did not handle `/api/billing/account-summary`, causing `AuthenticatedDashboardRoute` to fall back to the baseline account summary.
- Inspected `frontend/features/dashboard/components/AuthenticatedDashboardRoute.tsx`, `frontend/features/billing/accountSummary.ts`, and `frontend/pages/api/billing/account-summary.ts`. The product path is intentionally API-backed and caches successful summaries by user.
- Updated the dashboard actions test to reset `fetchBillingAccountSummary` client state before each test and to return the current account-summary payload shape for `/api/billing/account-summary`.

Validation:

- `npm -C frontend run test -- tests/pages/dashboard.actions.test.tsx` passed: 1 file / 16 tests.
- `npm -C frontend run test -- features/billing/__tests__/accountSummary.test.ts features/billing/__tests__/useMediaStorageQuotaSummary.test.ts features/billing/__tests__/useResolvedAccountPlan.test.ts` passed: 3 files / 11 tests.

Residual risk:

- The dashboard suite still emits repeated jsdom `HTMLMediaElement.pause()` warnings. That warning stream remains tracked separately as F-010 and was not folded into the F-009 fixture fix.

### 2026-06-28 Checkpoint 21 - F-008 Project-Persistence Audit Cleanup

Mode: continued implementation on the project-persistence proof harness. Scope stayed limited to the audit script's cleanup and preflight messaging; no product persistence behavior, project APIs, media-folder APIs, UI, UX, or production data changed.

Issue boundary:

- Active issue: F-008.
- Owner/lane: Copperknot/Gottspan project-persistence proof lane.
- Source boundary: `frontend/tests/e2e/project-persistence.audit.js`.
- Protected behavior: keep the existing project create/list/read/delete, global folder create/rename/move/delete, workspace save/read canonicalization, and project reopen checks intact; avoid running the mutating audit against production without explicit approval.

Implementation/audit result:

- Confirmed the audit creates a real project and a real global Media Library folder under the authenticated audit user.
- Confirmed `projectId` already lived outside the happy path and was deleted from `finally`, while `folderId` was local to the happy-path block and could not be cleaned up after failures between folder creation and folder deletion.
- Added a `deleteMediaFolder()` helper with required and best-effort modes.
- Moved `folderId` to the outer cleanup scope, kept the required folder-delete assertion on the happy path, and added best-effort folder cleanup in `finally` when any later failure leaves `folderId` set.
- Added startup JSON that identifies the audit as mutating and prints the base URL, masked audit account, and cleanup domains before browser launch.

Validation:

- `node --check frontend/tests/e2e/project-persistence.audit.js` passed.
- `PLAYWRIGHT_AUDIT_EMAIL=audit@example.com NODE_PATH=frontend/node_modules node frontend/tests/e2e/project-persistence.audit.js` exited before browser launch with the expected dedicated-account guard.

Residual risk:

- Full end-to-end cleanup proof still requires a controlled audit account and explicit approval because the script mutates real project and Media Library folder state. Production execution was not attempted in this implementation pass.

### 2026-06-28 Checkpoint 22 - F-012 Browser-Audit Preflight Boundary

Mode: continued implementation on browser-proof safety and runbook clarity. Scope stayed limited to a read-only preflight script, npm wiring, and testing documentation; no browser audit behavior, app UI/UX, account data, production data, or release/deploy behavior changed.

Issue boundary:

- Active issue: F-012.
- Owner/lane: Copperknot/Gottspan AI Studio browser-proof lane.
- Source boundary: browser audit command/runbook layer for Pulse custom/built-in contracts, Pulse release checks, AI Studio perf release, style-drop, audio-exclusivity, and loading-gate audits.
- Protected behavior: existing audit scripts and release-check wrappers should keep their current execution behavior; preflight must not launch browsers, start servers, sign in, create records, or spend credits.

Implementation/audit result:

- Added `frontend/scripts/browser_audit_preflight.mjs`.
- Added `npm run browser-audit:preflight`.
- Updated `docs/testing-guide.md` so the preflight is listed before the credentialed/mutating browser audit commands.
- The preflight prints credential status, resolved target URL, production proof policy, mutation class, cleanup expectation, and retained-artifact expectation. It supports `--json` and `--audit <name>`.

Validation:

- `node --check frontend/scripts/browser_audit_preflight.mjs` passed.
- `npm -C frontend run browser-audit:preflight -- --json` passed and printed the full audit matrix without credentials or browser launch.
- `npm -C frontend run browser-audit:preflight -- --audit audio` passed and filtered to the audio-exclusivity audit.
- `npm -C frontend run check:test-script-paths` passed.
- `npm -C frontend run docs:check` passed.

Residual risk:

- This closes the preflight/runbook boundary, not the live browser proof itself. The actual Pulse/perf/style/audio/loading browser audits still require approved credentials and, where applicable, explicit production or local-production-bundle proof selection.

### 2026-06-28 Checkpoint 23 - F-018 Runtime SQL Security Audit Summary Parity

Mode: continued implementation on SQL release-gate accuracy. Scope stayed limited to the read-only runtime SQL security audit and its static guardrail test; no hosted SQL was executed, and no production/staging database state changed.

Issue boundary:

- Active issue: F-018.
- Owner/lane: Dave/Nuclo/Copperknot SQL security release-gate lane.
- Source boundary: `sql/check_runtime_sql_security_audit.sql` and `frontend/tests/lib/runtime-sql-security-audit-script.test.ts`.
- Protected behavior: keep the audit read-only, keep the detailed and summary query shape usable in hosted Supabase SQL execution, and do not claim fresh hosted security proof without approved DB credentials.

Implementation/audit result:

- Confirmed the script had two `expected_functions` lists because detailed rows and summary counters are separate SQL statements.
- Added the six missing signatures to the summary block: `activate_billing_plan_offer`, `activate_billing_storage_addon_offer`, `get_media_folder_item_counts`, `reorder_dashboard_tutorials`, `get_active_legal_policy`, and `publish_legal_policy`.
- Added a static regression test that extracts both expected-function blocks and requires the sorted signature sets to remain identical.

Validation:

- `npm -C frontend run test -- tests/lib/runtime-sql-security-audit-script.test.ts` passed: 1 file / 3 tests.
- Static extraction found `2` expected-function blocks, with signature counts `[48, 48]`, and equal sorted signature sets.

Residual risk:

- Hosted SQL proof remains required before final launch security signoff. The local fix proves summary/list parity in source, not that the target database currently returns `failing_checks = 0`.

### 2026-06-28 Checkpoint 24 - F-015 Supabase Sync Helper Apply Gates

Mode: continued implementation on production-touching ops safety. Scope stayed limited to operator script entrypoint contracts and the ops README; no database rows, storage objects, grants, UI, UX, product behavior, release, deploy, commit, or push state changed.

Issue boundary:

- Active issue: F-015.
- Owner/lane: Nuclo/Copperknot ops-safety lane.
- Source boundary: `scripts/ops/supabase_hot_table_delta_sync.sh`, `scripts/ops/supabase_media_generation_delta_sync.sh`, `scripts/ops/supabase_public_acl_sync.sh`, `scripts/ops/supabase_storage_rclone_sync.sh`, and `scripts/ops/README.md`.
- Protected behavior: preserve the canonical hot-table/media-generation SQL upsert logic, public ACL SQL generation/apply path, rclone copy/check/size wrapper, command names, and documented cutover sequence while making mutation intent explicit.

Implementation/audit result:

- Confirmed the hot-table and media-generation delta scripts immediately upserted into the target database once source/target URLs were present.
- Confirmed `supabase_public_acl_sync.sh` defaulted to `MODE="apply"` and could fall back to `SHORTPULSE_PRODUCTION_DB_URL` as target.
- Confirmed `supabase_storage_rclone_sync.sh` defaulted to `MODE="copy"` with `DRY_RUN="false"`.
- Added explicit `--apply` gates to the hot-table and media-generation delta scripts before URL/tool checks or target writes.
- Changed ACL sync to default to emit mode and require `--mode apply --apply` before target mutation.
- Changed rclone sync to default to `size` mode and require either `--apply` or `--dry-run` for `--mode copy`.
- Updated `scripts/ops/README.md` so the recommended order now uses emit/dry-run/read-only defaults first and marks mutating steps with `--apply`.

Validation:

- `bash -n scripts/ops/supabase_hot_table_delta_sync.sh scripts/ops/supabase_media_generation_delta_sync.sh scripts/ops/supabase_public_acl_sync.sh scripts/ops/supabase_storage_rclone_sync.sh` passed.
- `bash scripts/ops/supabase_hot_table_delta_sync.sh` refused with `refusing to mutate target without explicit --apply` before credential access.
- `bash scripts/ops/supabase_media_generation_delta_sync.sh` refused with `refusing to mutate target without explicit --apply` before credential access.
- `bash scripts/ops/supabase_public_acl_sync.sh --mode apply` refused with `refusing to mutate target without explicit --apply` before credential access.
- `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode copy` refused with `refusing to copy objects without explicit --apply or --dry-run` before rclone/env access.
- `npm -C frontend run docs:check` passed.

Residual risk:

- This proves local mutation gates and documentation, not an approved live production cutover. Any actual DB/storage apply still requires the operator to provide the correct credentials and intentionally pass `--apply`.

### 2026-06-28 Checkpoint 25 - F-002 Dev-Only Bakeoff Expected 404 Probe

Mode: continued implementation on route-surface launch proof. Scope stayed limited to the deployment route-parity gate and its focused test coverage; no route was removed, no UI/UX changed, and no product behavior changed.

Issue boundary:

- Active issue: F-002.
- Owner/lane: Copperknot/Gottspan route-surface lane.
- Source boundary: `scripts/verify_deployment_route_parity.mjs` and `frontend/tests/scripts/deployment-route-parity.test.mjs`.
- Protected behavior: keep `/dev/ai-studio-stage-bakeoff` source-present for local/development use, keep production returning `404`, and keep retired build-manifest route checks separate from source-present expected-status probes.

Implementation/audit result:

- Added `DEFAULT_EXPECTED_STATUS_ROUTES` to the deployment route-parity verifier with `/dev/ai-studio-stage-bakeoff` expected to return anonymous `404`.
- Added `--expected-status-route <status>:<path>` for additive anonymous status probes and `--ignore-default-expected-status-routes` for controlled older-deployment inspection.
- The verifier now performs GET probes with manual redirect handling and includes expected-status results/failures in the JSON summary and pass/fail decision.
- Added focused tests proving the dev-only bakeoff route is checked by expected status, not by the forbidden route list, and that the source-present page file remains allowed.

Validation:

- `node --check scripts/verify_deployment_route_parity.mjs` passed.
- `npm -C frontend run test -- tests/scripts/deployment-route-parity.test.mjs` passed: 1 file / 10 tests.
- Anonymous production probe `curl https://www.shortpulse.ai/dev/ai-studio-stage-bakeoff` returned `404`.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` passed against deployment `shortpulse-mde2xbvig-kirk-artmans-projects.vercel.app`, created `2026-06-28T23:55:11.096Z`, with `187` route entries inspected and expected anonymous route status `404 /dev/ai-studio-stage-bakeoff`.
- `npm -C frontend run docs:check` passed.
- `cd frontend && npx eslint tests/scripts/deployment-route-parity.test.mjs ../scripts/verify_deployment_route_parity.mjs` returned no errors; ESLint warned that the root script is outside the frontend base path.

Residual risk:

- The source fix is local until committed/deployed/CI-checked. The production route currently returns the intended `404`, and the local launch gate now enforces that expectation for future runs.

### 2026-06-28 Checkpoint 26 - F-016 Vercel Env Contract Declaration Parity

Mode: continued implementation on env-contract signal quality. Scope stayed limited to the canonical frontend env template and focused env-contract tests; no live Vercel variables, secrets, production runtime values, UI/UX, billing behavior, or release state changed.

Issue boundary:

- Active issue: F-016.
- Owner/lane: Nuclo/Copperknot env-contract lane.
- Source boundary: `frontend/.env.example` and `frontend/tests/scripts/vercel-env-contract.test.mjs`, with `scripts/lib/vercel_env_contract.mjs` treated as the canonical contract source.
- Protected behavior: keep the current required-key contract intact, do not change any live Vercel env values, and do not broaden into unrelated undeclared-key cleanup from the live project.

Implementation/audit result:

- Confirmed `SHORTPULSE_ADMIN_EMAILS` is required for preview and production but was absent from `frontend/.env.example`, while `KNOWN_VERCEL_KEYS` is derived from that file.
- Confirmed the media-list mirror pair `SHORTPULSE_MEDIA_LIST_API_ENABLED` / `NEXT_PUBLIC_MEDIA_LIST_API_ENABLED` was referenced by the contract but absent from the env template.
- Added `SHORTPULSE_ADMIN_EMAILS=ops@example.com` as a non-secret placeholder to the frontend env template.
- Added both media-list rollout flags to the frontend env template with `false` defaults.
- Added a focused regression test requiring all required, mirrored, and guarded Vercel contract keys to be declared in `frontend/.env.example` unless explicitly local/tooling-only.

Validation:

- `npm -C frontend run test -- tests/scripts/vercel-env-contract.test.mjs tests/scripts/vercel-env-file-cli.test.mjs` passed: 2 files / 11 tests.
- `node --check scripts/lib/vercel_env_contract.mjs scripts/check_vercel_env_contract.mjs scripts/check_vercel_env_file.mjs` passed.
- Static import check confirmed `SHORTPULSE_ADMIN_EMAILS`, `SHORTPULSE_MEDIA_LIST_API_ENABLED`, and `NEXT_PUBLIC_MEDIA_LIST_API_ENABLED` are present in `KNOWN_FRONTEND_ENV_EXAMPLE_KEYS`.
- `node scripts/check_vercel_env_contract.mjs --environment production` passed.
- `npm -C frontend run docs:check` passed.

Residual risk:

- The live production env audit still reports unrelated undeclared-key warnings for existing project variables outside the F-016 source boundary. This checkpoint closes the listed self-contradiction around required admin env and the media-list mirrored flags, not every env-template drift warning in production.

### 2026-06-28 Checkpoint 27 - F-013 SOP/ADR Section-Index Parity

Mode: continued implementation on docs-governance signal quality. Scope stayed limited to active SOP/ADR section indexes and the existing docs-link checker; no product behavior, UI/UX, architecture decision content, or operational SOP content changed.

Issue boundary:

- Active issue: F-013.
- Owner/lane: Gottspan/docs-governance lane.
- Source boundary: `docs/sops/README.md`, `docs/adr/README.md`, and `scripts/check_docs_links.js`.
- Protected behavior: preserve existing docs-check command shape and keep planning/archive parity out of scope because those folders intentionally contain historical and transition material.

Implementation/audit result:

- Reproduced the section-index omissions: `docs/sops/README.md` missed `sop_account_health_snapshot.md` and `sop_ai_studio_internal_drag_drop_intake.md`; `docs/adr/README.md` missed ADR `0050` and ADR `0096`.
- Added the missing SOP and ADR links to their section READMEs.
- Extended `scripts/check_docs_links.js` with `checkSectionReadmeInventory()`, which requires active `docs/sops/sop_*.md` files and numbered `docs/adr/*.md` files to be linked from their section README.

Validation:

- `node --check scripts/check_docs_links.js` passed.
- `npm -C frontend run docs:check` passed.
- Static inventory check reported `docs/sops/README.md: missing=0` and `docs/adr/README.md: missing=0`.

Residual risk:

- This intentionally covers active SOP and ADR section indexes only. It does not enforce parity for planning or archive material.

### 2026-06-28 Checkpoint 28 - F-006 Migration-Doc Ordered Inventory Parity

Mode: continued implementation on SQL-operations docs guardrails. Scope stayed limited to migration inventory documentation and the existing migration-doc parity checker; no SQL, database state, migration files, app behavior, UI/UX, release, deploy, commit, or push state changed.

Issue boundary:

- Active issue: F-006.
- Owner/lane: Nuclo/Copperknot SQL-operations documentation lane.
- Source boundary: `scripts/check_migration_doc_parity.js`, `docs/database-migrations.md`, `docs/sops/sop_sql_migration_operations.md`, and read-only inventory of `sql/migrations/`.
- Protected behavior: preserve the intentional migration-number gap at `134`, preserve Supabase operations policy, and do not infer hosted migration state from docs-only parity.

Implementation/audit result:

- Added migration inventory parity checks for the SQL SOP `Current set` block and the database migration doc `Current required migration set`.
- Proved the new checker failed before the docs refresh on missing `098`-`102`, missing `164`-`168`, duplicate `090`/`138`/`144`, out-of-order SOP inventory, and missing database-doc required-set entries `164`-`167`.
- Regenerated the SQL SOP `Current set` from the canonical `sql/migrations/` directory.
- Added an explicit note that migration number `134` is intentionally unused.
- Added `164_add_paid_signup_intent_gate.sql`, `165_account_first_signup_intent_gate.sql`, `166_grant_signup_hook_schema_usage.sql`, and `167_add_google_ip_signup_intent.sql` to the database migration required set immediately before `168_retire_saved_creators.sql`.

Validation:

- `node --check scripts/check_migration_doc_parity.js` passed.
- `node scripts/check_migration_doc_parity.js` passed.
- `npm -C frontend run docs:check` passed.
- Static inventory check confirmed the SQL SOP inventory has `167` entries, matching the `167` forward migration files exactly, with tail `164`-`168`.

Residual risk:

- This is documentation/tooling parity only. It does not prove any hosted database has applied the newest migrations.

### 2026-06-28 Checkpoint 29 - F-003/F-004 Launch-Control Freshness Labels

Mode: continued implementation on launch-control truth labeling. Scope stayed limited to stale authority wording in launch/system docs; no product behavior, UI/UX, readiness score, launch state, queue order, release, deploy, commit, or push state changed.

Issue boundary:

- Active issues: F-003 and F-004.
- Owner/lane: Copperknot launch-control docs and system-catalog lane.
- Source boundary: `docs/agents/copperknot/july-7-launch-board.md` and `docs/systems/catalog.md`.
- Protected behavior: preserve historical evidence, preserve the current queue authority, and avoid silently rerating systems or changing launch state.

Implementation/audit result:

- Replaced the launch board's leading `2026-06-08` snapshot header with a `Current Freshness Pointer` that names the active July 7 authority docs, production-only branch policy, current repo anchor `7910dadc1`, and the rule to use fresh `git status` instead of the retained June 8 dirty-worktree note.
- Moved the old snapshot date, branch, commit anchor, and dirty-worktree note into a `Retained Evidence Snapshot` section labeled as historical context.
- Updated the systems catalog top note so the June 16 launch-fitness scorecard is explicitly a historical fast-read score snapshot unless Copperknot refreshes and re-accepts it.

Validation:

- `npm -C frontend run docs:check` passed.
- Targeted grep found no remaining active references that call `docs/systems/launch-fitness-scorecard-2026-06-16.md` the current easy-read scorecard, nor the old unqualified launch-board `Snapshot date`, `Commit anchor`, or `Worktree: dirty` labels.

Residual risk:

- This resolves misleading top-level authority labels only. It does not rerate systems, refresh every catalog row date, or change launch readiness.

### 2026-06-28 Checkpoint 30 - F-010/F-005 Validation Warning Cleanup

Mode: continued implementation on test-signal quality. Scope stayed limited to Vitest setup and test-environment declarations; no product runtime, UI/UX, media playback behavior, dependencies, or build configuration changed.

Issue boundary:

- Active issues: F-010 and F-005.
- Owner/lane: Gottspan/tooling validation-signal lane.
- Source boundary: `frontend/vitest.setup.ts`, `frontend/tests/api/fal-upload-url.test.ts`, and `frontend/tests/api/kie-upload-url.test.ts`.
- Protected behavior: keep media/video tests able to install spies and preserve API upload-url assertions without replacing or removing `sharp`, `canvas`, `fabric`, or `jsdom`.

Implementation/audit result:

- Reproduced the F-010 warning stream: `tests/pages/dashboard.actions.test.tsx` passed but emitted repeated `Not implemented: HTMLMediaElement's pause() method`.
- Added shared writable no-op implementations for `HTMLMediaElement.load`, `pause`, and `play` in `frontend/vitest.setup.ts`; `play` resolves a promise to match browser call sites.
- Reproduced the F-005 warning: `tests/api/fal-upload-url.test.ts` passed but emitted the native duplicate `GNotificationCenterDelegate` warning because jsdom/canvas and sharp were loaded in the same test process.
- Marked the Fal and Kie upload-url API tests with `// @vitest-environment node`, isolating sharp-heavy API tests from jsdom/canvas.

Validation:

- `npm -C frontend run test -- tests/pages/dashboard.actions.test.tsx` passed: 1 file / 16 tests, with the prior media-method warning stream gone.
- `npm -C frontend run test -- tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/public-home-video-gallery.test.tsx` passed: 3 files / 34 tests, without media-method warnings.
- `npm -C frontend run test -- tests/api/fal-upload-url.test.ts tests/api/kie-upload-url.test.ts` passed: 2 files / 31 tests, with `environment 0ms` and without the native `canvas`/`sharp` duplicate-class warning.
- Combined dashboard/tutorial/gallery validation passed: 4 files / 50 tests.
- Targeted ESLint passed for the changed setup/test files.
- `npm -C frontend run type-check` passed.

Residual risk:

- This closes the reproduced warning classes in the focused suites. Other future native warnings should be handled by moving similarly DOM-free, sharp-heavy API tests to node environment rather than changing runtime dependencies.

### 2026-06-28 Checkpoint 31 - F-017 Public Header And Discovery Posture

Mode: continued implementation on public metadata and static discovery posture. Scope stayed limited to HTTP framework disclosure configuration, static crawler/discovery files, and route-doc checker support; no visible UI, UX, navigation, product behavior, billing/credit behavior, deploy, commit, or push state changed.

Issue boundary:

- Active issue: F-017.
- Owner/lane: Copperknot/Nuclo deployment-public-surface lane.
- Source boundary: `frontend/next.config.js`, `frontend/public/robots.txt`, `frontend/public/sitemap.xml`, `docs/routes.md`, and `scripts/check_docs_semantic_drift.js`.
- Protected behavior: preserve the current public route set and legal/support pages; do not invent policy promises or add app routes for static files that belong under `frontend/public`.

Implementation/audit result:

- Reproduced the production issue before editing: `https://www.shortpulse.ai/` returned `x-powered-by: Next.js`, while `/robots.txt` and `/sitemap.xml` returned `404`.
- Set `poweredByHeader: false` in `frontend/next.config.js`.
- Added `frontend/public/robots.txt` with explicit public crawl allowance and a sitemap pointer.
- Added `frontend/public/sitemap.xml` listing only the current public, legal, pricing, and support routes.
- Documented `/robots.txt` and `/sitemap.xml` in `docs/routes.md`.
- Updated `scripts/check_docs_semantic_drift.js` so static public files listed in `docs/routes.md` are checked against `frontend/public` instead of being treated as missing page routes under `frontend/pages`.

Validation:

- `npm -C frontend run build` passed.
- Static config inspection confirmed `poweredByHeader` is `false` and custom headers are still configured.
- Static file inspection confirmed the intended robots and sitemap content exists in `frontend/public`.
- `node --check scripts/check_docs_semantic_drift.js` passed.
- `npm -C frontend run docs:check` passed.

Residual risk:

- This is local/source proof only until the next deployment. Post-deploy proof still needs a production header probe showing no `x-powered-by`, plus production `200` responses for `/robots.txt` and `/sitemap.xml` with the intended content.

### 2026-06-28 Checkpoint 32 - F-001 Size-Budget Inventory Ratchets

Mode: continued implementation on source-governance tooling. Scope stayed limited to the size-budget checker and this report; no oversized launch files were split, refactored, reformatted, or behavior-changed.

Issue boundary:

- Active issue: F-001.
- Owner/lane: Copperknot/Gottspan source-governance lane.
- Source boundary: `scripts/check_size_budgets.js`.
- Protected behavior: preserve current UI/UX/runtime behavior, avoid broad cleanup, and avoid turning F-001 into a stealth refactor of unrelated oversized files.

Implementation/audit result:

- Reconfirmed current behavior before editing: `npm -C frontend run check:size-budget` passed but only warned on the existing `useAiStudioState.ts` reference-grid target.
- Refreshed the current oversized production inventory, excluding generated outputs, tests, `node_modules`, `.next`, `.vercel`, and Mini Ecosystem scope.
- Added `LAUNCH_SOURCE_INVENTORY_BUDGETS` for the largest current production TypeScript/TSX launch surfaces that were outside the historical target groups.
- Added `LAUNCH_STYLE_INVENTORY_BUDGETS` for the largest current production stylesheets.
- Set both groups as ratchet ceilings at today's observed line counts. They do not demand launch-week splits, but they warn if these already-large surfaces grow further. Enforce mode is available through `LAUNCH_SOURCE_INVENTORY_SIZE_BUDGET_MODE=enforce` and `LAUNCH_STYLE_INVENTORY_SIZE_BUDGET_MODE=enforce`.

Validation:

- `node --check scripts/check_size_budgets.js` passed.
- `npm -C frontend run check:size-budget` passed, with only the pre-existing `useAiStudioState.ts` reference-grid warning.
- `LAUNCH_SOURCE_INVENTORY_SIZE_BUDGET_MODE=enforce LAUNCH_STYLE_INVENTORY_SIZE_BUDGET_MODE=enforce npm -C frontend run check:size-budget` passed, again with only the existing reference-grid warn-mode warning.
- `npm -C frontend run check:architecture-boundary` passed.
- `npm -C frontend run docs:check` passed.

Residual risk:

- This is governance coverage, not maintainability debt payoff. Actual file splits remain separate issue-specific lanes that should start only from a concrete launch risk and local owner seam.

### 2026-06-28 Checkpoint 33 - Re-Audit Of Completed Lane Against Current Worktree

Mode: audit-only recheck after the completed list was challenged. Scope stayed limited to verifying the completed Copperknot list against the current worktree and recording drift; no product code, tests, config, route behavior, billing behavior, deploy, commit, or push state changed.

Fresh boundary:

- Current branch remains `production`.
- Local `shortpulse.allowedBranch` remains `production`.
- Workspace safety check found only expected `frontend/.next` and `docs/records/artifacts` directories in the broad backup/artifact scan.
- The active subagent tool contract required an explicit current-task delegation request, so no subagents were spawned for this re-audit.
- The current worktree contains additional dirty files outside the completed Copperknot list, including Voice panel, Generate CTA, billing/auth, and tester-doc changes. Treat those as current-worktree drift unless a lane owner assigns them back to this report.

Re-audit result:

- Report structure remains coherent: `18` unique finding headings, `32` prior checkpoints, and no actual `- Status: candidate` finding rows.
- `npm -C frontend run docs:check` passed.
- `npm -C frontend run type-check` passed.
- `npm -C frontend run build` passed.
- `git diff --check` passed.
- `node --check` passed for the touched checker scripts: `scripts/verify_deployment_route_parity.mjs`, `scripts/check_docs_links.js`, `scripts/check_docs_semantic_drift.js`, `scripts/check_migration_doc_parity.js`, `scripts/check_size_budgets.js`, `scripts/lib/vercel_env_contract.mjs`, and `scripts/check_vercel_env_contract.mjs`.
- `bash -n` passed for the four production-touching Supabase sync helpers changed in F-015.
- `npm -C frontend run test -- tests/scripts/deployment-route-parity.test.mjs tests/scripts/vercel-env-contract.test.mjs tests/lib/runtime-sql-security-audit-script.test.ts` passed: `3` files / `22` tests.
- `npm -C frontend run test -- tests/api/fal-upload-url.test.ts tests/api/kie-upload-url.test.ts` passed: `2` files / `31` tests.
- `npm -C frontend run test -- tests/pages/dashboard.actions.test.tsx` passed: `1` file / `16` tests.
- `npm -C frontend run test -- features/ai-studio/components/edit/__tests__/ExpertEditPanelView.integration.test.tsx` passed: `1` file / `10` tests, proving the original F-011 Reset All/session-state failure remains fixed.
- `npm -C frontend run check:generate-cta-contract` passed.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` passed against deployment `shortpulse-mde2xbvig-kirk-artmans-projects.vercel.app`, with `187` route entries and expected anonymous `404 /dev/ai-studio-stage-bakeoff`.
- `npm -C frontend run billing:launch-readiness -- --strict --json` still returned `9` pass / `1` warn / `0` fail and exited non-zero only because local `STRIPE_SECRET_KEY` is unavailable for Stripe webhook endpoint proof.

Current-worktree drift found:

- `npm -C frontend run check:size-budget` still exits `0`, but now warns on the new launch inventory ratchets because later dirty changes grew `frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx` from `1687` to `1701` lines and `frontend/styles/ai-studio-voices-properties.module.css` from `4382` to `4406` lines. Enforcing only the new launch inventory groups now exits non-zero on those two files. This proves F-001's ratchet is working; it also means the Checkpoint 32 "inventory enforce mode passed" evidence is stale for the current worktree.
- `npm -C frontend run test:expert-edit:coordinate-parity:core` is red again in the current worktree: `ExpertEditPanelView.launch-lock.test.tsx` cannot find a button with accessible name `Generate` because current dirty Generate CTA code exposes `Generate: cost estimate pending`. The original F-011 Reset All integration failure is still fixed, but the full Expert Edit core gate is no longer green under the current Generate CTA/test contract.
- Production still reflects the pre-F-017 deployment: `https://www.shortpulse.ai/` returns `x-powered-by: Next.js`, while `/robots.txt` and `/sitemap.xml` return `404`. This matches the known F-017 post-deploy proof boundary.

Updated boundary:

- The completed Copperknot source fixes still stand, but the current worktree is no longer a clean "all repo-local checks green except F-007" state.
- Next safe work is not broad reopening of this entire list. It is targeted owner-lane cleanup for the new current-worktree drift: either reduce/accept the Voice panel line growth against the F-001 ratchet, and reconcile the Generate CTA accessible-name change with the Expert Edit launch-lock tests.
- F-007 still requires approved read-capable Stripe endpoint proof or equivalent retained Stripe dashboard/CLI evidence.

### 2026-06-28 Checkpoint 34 - Fresh Deploy Public Surface And Stripe Boundary Refresh

Mode: production-safe refresh after the user reported a fresh deploy and provided Stripe keys in chat. Scope stayed read-only: production HTTP probes, route parity, billing-readiness audit without local secret access, and report update only. No product code, tests, config, billing behavior, Stripe state, production data, deploy, commit, or push state changed.

Secret-handling boundary:

- The live Stripe secret was not repeated in commands, output, or this report.
- Local process environment check found `STRIPE_SECRET_KEY=missing` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=missing`.
- Because the key was not available through a local env/secret boundary, the Stripe endpoint proof was not run with the secret. This avoids copying the live secret into shell command history or retained tool logs.

Fresh production proof:

- Production root `https://www.shortpulse.ai/` returned `200` with security headers still present and no `x-powered-by` header in the sampled response.
- `https://www.shortpulse.ai/robots.txt` returned `200` with:
  - `User-agent: *`
  - `Allow: /`
  - sitemap pointer to `https://www.shortpulse.ai/sitemap.xml`
- `https://www.shortpulse.ai/sitemap.xml` returned `200` and listed the intended public/legal/support launch pages: `/`, `/pricing`, `/terms`, `/privacy`, `/refund-policy`, and `/report-issue`.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` passed against deployment `shortpulse-cpi4eyi8u-kirk-artmans-projects.vercel.app`, created `2026-06-29T01:45:40.392Z`, with `187` route entries inspected and expected anonymous `404 /dev/ai-studio-stage-bakeoff`.
- `npm -C frontend run docs:check` passed.

Billing proof refresh:

- `npm -C frontend run billing:launch-readiness -- --strict --json` returned `9` pass / `1` warn / `0` fail and exited non-zero only because local `STRIPE_SECRET_KEY` is unavailable for the `stripe_webhook_endpoint` proof.
- The readiness script's required Stripe webhook event set is `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_succeeded`.
- F-007 remains open only as a proof boundary: run the strict billing readiness check with the live secret loaded through an approved local env/secret boundary, or capture equivalent Stripe dashboard/CLI proof for an enabled endpoint at `https://www.shortpulse.ai/api/billing/stripe/webhook` with the required event set. Do not paste the live secret into commands or retained docs.

Updated boundary:

- F-017 is now production-checked after deploy.
- F-007 remains the only original audit-list item requiring external Stripe proof.
- Checkpoint 33 current-worktree drift remains separate: Voice panel size-ratchet growth and Generate CTA versus Expert Edit launch-lock test contract should be handled in targeted owner lanes if still active.

### 2026-06-28 Checkpoint 35 - F-007 Stripe Webhook Endpoint Proof Closed

Mode: read-only Stripe/billing proof after the live keys were placed into the ignored local env boundary. Scope stayed limited to local env key presence, the strict billing readiness checker, and this report update; no billing behavior, Stripe configuration, production data, product code, deploy, commit, or push state changed.

Secret-handling boundary:

- The live Stripe values were loaded into ignored `.env.agent.local`, which is gitignored by `.gitignore` and set to mode `600`.
- The secret value is not repeated in this report.
- The strict billing checker used the local env boundary through the existing `loadLocalEnv()` path.

Proof:

- `npm -C frontend run billing:launch-readiness -- --strict --json` passed with `10` pass / `0` warn / `0` fail.
- The `stripe_webhook_endpoint` check passed: Stripe has an enabled production billing webhook endpoint with required events.
- Endpoint id observed by the checker: `we_1TicAwHutZQpiTlZ4Y1WDkRV`.
- Required Stripe event coverage checked by the script:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`

Updated boundary:

- F-007 is now production-checked.
- The original F-001 through F-018 audit list has no remaining unresolved implementation or proof item.
- Separate current-worktree drift from Checkpoint 33 still exists outside the original list: Voice panel size-ratchet growth and Generate CTA versus Expert Edit launch-lock test contract.
- Because the live Stripe secret was pasted into chat before this proof, rotate it in Stripe after the proof window.

### 2026-06-29 Checkpoint 36 - Stale Cleanup And Regression Hardening

Mode: cleanup and hardening after the completed list was challenged again. Scope stayed limited to local proof residue, this retained report, and a narrow docs-check regression guard. No UI, UX, route behavior, billing behavior, Stripe state, production data, deploy, commit, or push state changed.

Cleanup result:

- Removed live Stripe values from ignored `.env.agent.local` after the proof window and preserved mode `600`.
- Removed temporary local proof files under `/tmp` that were no longer source-of-truth evidence.
- Confirmed tracked source does not contain a pasted live Stripe key; the only tracked `sk_live_` match is the intentional Stripe key-prefix validation literal in the rollout helper.
- Re-audited this report for stale current-state claims. Older checkpoint text that says F-007 or F-017 was open/blocked is retained as historical evidence and superseded by Checkpoints 34 and 35. The active status is the top `Status`, this checkpoint, the refreshed priority stack, and `Next Checkpoint`.

Regression hardening:

- Extended `scripts/check_docs_semantic_drift.js` so `docs:check` now fails if `frontend/next.config.js` stops setting `poweredByHeader: false`.
- Existing `docs:check` coverage still verifies documented static public routes against `frontend/public/robots.txt` and `frontend/public/sitemap.xml`.
- This converts the F-017 source-side public-surface fix from manual memory into a recurring local regression gate.

Validation:

- `node --check scripts/check_docs_semantic_drift.js` passed.
- `npm -C frontend run docs:check` passed.
- `git diff --check` passed.
- Local secret-residue scan found no live Stripe key in tracked files or `.env.agent.local`; `.env.agent.local` remains mode `600`.
- Temporary proof files `/tmp/billing-readiness-strict.json`, `/tmp/stripe_webhook_endpoints.json`, `/tmp/stripe_webhook_endpoints.txt`, and `/tmp/stripe_cli_err.txt` are absent.
- Read-only production probes on `2026-06-29` returned `200` and no `x-powered-by` header for `https://www.shortpulse.ai/`, `/robots.txt`, and `/sitemap.xml`.

Updated boundary:

- No original F-001 through F-018 audit-list item remains unresolved.
- Remaining known issues are not stale report items; they are separate current-worktree drift from Checkpoint 33: Voice panel size-ratchet growth and Generate CTA versus Expert Edit launch-lock test contract.
- Rotate the live Stripe secret in Stripe because it was pasted into chat before local proof cleanup.

## Current July 7 Priority Stack

This is the final deduped pre-launch worklist from this audit pass, refreshed by Checkpoints 17 through 36. It is not launch signoff. The original F-001 through F-018 implementation and proof items are complete; Checkpoint 33 found newer current-worktree validation drift outside those original fixes.

### P0 - Fix before relying on launch gates

Resolved during Checkpoint 35:

- F-007: strict billing readiness is green with live Stripe endpoint proof: `10` pass / `0` warn / `0` fail.

Resolved locally during Checkpoint 19:

- F-014: `npm -C frontend run type-check` is green in the current worktree.
- F-011: the original Reset All/session-state failure remains fixed; `ExpertEditPanelView.integration.test.tsx` is green in the current worktree. As of Checkpoint 33, the broader `test:expert-edit:coordinate-parity:core` gate is red again on a newer Generate CTA accessible-name/test-contract mismatch in `ExpertEditPanelView.launch-lock.test.tsx`.

### P1 - High-ROI launch hardening

Resolved locally during Checkpoint 20:

- F-009: `npm -C frontend run test -- tests/pages/dashboard.actions.test.tsx` is green in the current worktree.

Resolved locally during Checkpoint 21:

- F-008: project-persistence audit folder cleanup now reaches `finally`; static syntax and no-mutation guard checks are green in the current worktree.

Resolved locally during Checkpoint 22:

- F-012: `npm -C frontend run browser-audit:preflight -- --json`, `npm -C frontend run check:test-script-paths`, and `npm -C frontend run docs:check` are green in the current worktree.

Resolved locally during Checkpoint 23:

- F-018: `npm -C frontend run test -- tests/lib/runtime-sql-security-audit-script.test.ts` is green, and static extraction confirms both expected-function blocks contain the same `48` primary signatures.

Resolved locally during Checkpoint 24:

- F-015: production-touching Supabase sync helpers now require explicit `--apply` for mutating paths; shell syntax, no-apply refusal checks, and `docs:check` are green in the current worktree.

Resolved locally during Checkpoint 25:

- F-002: deployment route parity now includes an anonymous expected-404 probe for `/dev/ai-studio-stage-bakeoff`; local tests and the production route-parity run are green.

Resolved locally during Checkpoint 26:

- F-016: required/mirrored/guarded Vercel env contract keys are declared in `frontend/.env.example`; focused tests and the production Vercel env audit are green, with unrelated undeclared-key warnings still outside this issue.

Resolved locally during Checkpoint 27:

- F-013: active SOP/ADR section indexes are complete and `docs:check` now enforces SOP/ADR section-index parity.

Resolved locally during Checkpoint 28:

- F-006: migration-doc parity now checks ordered operator inventories; SQL SOP and database migration docs include the current `164`-`168` migration stream.

Resolved locally during Checkpoint 29:

- F-003/F-004: launch board and systems catalog now route active readiness to current Copperknot authority docs while retaining older score/snapshot material as history.

Resolved locally during Checkpoint 30:

- F-010/F-005: shared Vitest media no-ops remove jsdom media-method warnings, and sharp-heavy upload-url API tests now run in node environment to avoid the native canvas/sharp duplicate-class warning.

Resolved locally during Checkpoint 31:

- F-017: public framework disclosure is disabled in source, explicit robots/sitemap files exist, route docs list the static discovery files, docs semantic drift checking recognizes static public files, and fresh production probes after deploy show no `x-powered-by` header plus `200` responses for `/robots.txt` and `/sitemap.xml`.

Resolved locally during Checkpoint 32:

- F-001: size-budget tooling now has ratchet-style warn/enforce inventory coverage for the largest current launch source and stylesheet surfaces without triggering broad refactors. As of Checkpoint 33, the ratchet warns on later current-worktree growth in the Voice panel and Voice panel CSS.

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

Current boundary: no original F-001 through F-018 audit-list item remains unresolved, and Checkpoint 36 has cleaned the local proof residue plus added a recurring `poweredByHeader: false` guard to `docs:check`. Current-worktree drift should be handled in targeted owner lanes: Voice panel size-ratchet growth and Generate CTA versus Expert Edit launch-lock test contract. Rotate the live Stripe secret after this proof window because it was pasted into chat.
