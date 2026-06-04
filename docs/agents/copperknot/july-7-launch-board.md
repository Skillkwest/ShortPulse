# July 7 Launch Board

Purpose: provide the first Copperknot-owned launch-control board for the July 7, 2026 launch decision.

## Evidence Snapshot

- Snapshot date: `2026-06-04`
- Branch: `production`
- Commit anchor: `28165603d`
- Worktree: dirty; broad uncommitted work is present across docs, AI Studio, media, billing, profile, performance, and tests.
- Production non-mutating check: `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` passed on `2026-06-04`; resolved deployment `https://shortpulse-ff8i9n78o-kirk-artmans-projects.vercel.app`, created at `2026-06-04T00:42:27.114Z`, inspected `161` route entries, and verified required internal routes.
- Production fail-closed check: `node scripts/verify_internal_route_runtime.mjs --base-url https://www.shortpulse.ai --skip-auth --route generation_recovery --route user_health_fleet --route media_derivatives` passed on `2026-06-04`; unauthenticated probes returned `401` for generation recovery, user health fleet, and media derivatives. This does not prove authenticated operator success because auth was skipped.
- Recovery/settlement source hardening: lineage resolver, settle-before-visible-recovery/failure invariants, status persisted-result lineage fallback, admin trace projection expansion, direct OpenAI/ElevenLabs pre-visible settlement gates, and admin-health projection lineage evidence advanced on `2026-06-03`; targeted lint passed and `266` targeted recovery/billing/webhook/control-plane/status/admin/direct-provider tests passed.
- Media Library focused pass: canonical folder/global membership, save-to-library/project association, copy-from-url, upload/finalize, media list, and panel runtime tests advanced on `2026-06-03`; one stale upload metadata assertion was updated to the current `image_admission` contract.
- Repo evidence used: `README.md`, `docs/routes.md`, `docs/product/shortpulse_ai_studio.md`, `docs/operator-map.md`, `docs/systems/catalog.md`, current Copperknot queue and reports.

This is the first launch-control board under the July 7 model. It is not a final launch-ready claim. It identifies where evidence is strong enough to rely on today and where the next proof must come from. It also treats the current UI, UX, and intended behavior as the preferred baseline; visible redesign or behavior changes are launch work only when smaller strengthening cannot protect the launch promise.

## Board

| Priority | Launch system | Launch state | Evidence level | Human risk | Operational risk | Technical risk | Next proof |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `Recovery, settlement, and output integrity` | `Blocked - Handed Off` | `Locally Tested` | Critical | Critical | Critical | Bactuo continues from `docs/agents/copperknot/handoffs/2026-06-03-recovery-settlement-output-integrity.md`; prove production-safe lifecycle evidence, then decide whether a full shared terminal convergence coordinator is still needed. |
| 2 | `Media library and organization` | `Below Bar - Handed Off` | `Locally Tested` | Critical | High | High | Holomony continues from `docs/agents/copperknot/handoffs/2026-06-03-media-library-organization-launch-readiness.md`; prove canonical ingest/save paths, autosave-off behavior, global folder membership, project association, and save-to-library continuity. |
| 3 | `Storage, delivery, and variants` | `Below Bar` | `Production Checked` | High | High | High | Prove signed delivery, preview variants, derivative backlog posture, and transform prohibition across production plus current source. |
| 4 | `Create and Pulse workflow` | `Below Bar` | `Repo Inspected` | Critical | High | High | Run a current source audit of Standard/Pulse runtime boundaries, Generate CTA contract, prompt/reference composition, and production non-mutating launch-surface proof; credit-consuming generation proof remains an autonomy gate. |
| 5 | `AI Studio shell and navigation` | `Below Bar` | `Repo Inspected` | High | Medium | High | Inspect workflow navigation, left-panel/tool ownership, shared right rail, modal/detail routes, and mobile/desktop fit while preserving the current UX unless evidence proves a visible change is required. |
| 6 | `Projects and workspace restore` | `Launchable With Watch` | `Production Checked` | High | Medium | Medium | Reconfirm project open/save/restore against current dirty worktree and production evidence before using it as a final launch-ready dependency. |
| 7 | `Generation runtime and providers` | `Below Bar` | `Repo Inspected` | High | High | High | Audit active OpenAI, Kie, Fal compatibility, and ElevenLabs provider contracts for submit/status/result normalization and current model ids. |
| 8 | `Credits, pricing, billing, and entitlements` | `Launchable With Watch` | `Repo Inspected` | Critical | High | High | Review Money Stuff/current pricing work, estimate-vs-debit paths, live catalog surfaces, and identify which paid-flow proof requires approval. |
| 9 | `Security and ownership boundaries` | `Launchable With Watch` | `Repo Inspected` | Critical | High | Medium | Intake current Dave reports and run the release security evidence path before final launch classification. |
| 10 | `Expert Edit workflow` | `Launchable With Watch` | `Production Proven` | Medium | Medium | Medium | Keep as watch item; current retained production smoke supports floor, but deeper restore/billing/multi-reference proof is needed for stronger readiness. |
| 11 | `Right-rail asset reuse` | `Launchable With Watch` | `Repo Inspected` | High | Medium | Medium | Reconcile current dirty right-rail/canvas/reference-grid changes with ADR 0083 and production behavior before final readiness. |
| 12 | `Video workflow` | `Below Bar` | `Repo Inspected` | High | Medium | High | Validate active Kie model constraints, media references, output insertion, and non-credit production surface behavior; generation proof is gated. |
| 13 | `Sound workflow` | `Below Bar` | `Repo Inspected` | Medium | Medium | High | Audit ElevenLabs voice ownership/staging/autosave paths and decide launch-critical subset. |
| 14 | `Creative libraries` | `Below Bar` | `Repo Inspected` | Medium | Medium | Medium | Recheck Characters, Elements, Styles, Presets, and Pulse library behavior as one creative reuse cluster; split blockers only when source boundaries require it. |
| 15 | `Public entry and account trust` | `Below Bar` | `Repo Inspected` | High | Medium | Medium | Verify auth/callback, media compliance, profile account changes, and public pricing/account surfaces against production-safe checks. |
| 16 | `Admin and launch operations` | `Below Bar` | `Production Checked` | Medium | Critical | Medium | Prove admin errors, reports, user health, pricing state, and route parity give enough solo-operator truth for launch week. |
| 17 | `Quality of experience` | `Below Bar` | `Repo Inspected` | High | Medium | Medium | Run a preservation-minded cross-route UX/readiness pass and classify issues as launch blockers, watch items, or post-launch polish. |

## Current Judgment

ShortPulse is not yet July 7 launch-ready. The top launch blockers are recovery/settlement/output integrity, media ingest/save, storage/delivery, and Create/Pulse workflow proof. Recovery/settlement source hardening is now locally tested across direct settlement, webhook, recovery, billing, control-plane, status-route, admin-trace, admin-health, and direct OpenAI/ElevenLabs settlement-gate slices, but production-safe lifecycle proof is still incomplete. Because Copperknot has already made five focused passes in that lane, it is now marked for Bactuo continuation instead of more Copperknot momentum work. Media Library and organization has one focused Copperknot pass with targeted local tests and one stale upload-metadata assertion fixed, but full launch-readiness proof is broad enough to hand off to Holomony. The strongest current production evidence is route parity plus retained Edit and project/workspace evidence.

Current data-backed decision: continue launch-readiness work, but do not reopen the handed-off recovery or Media Library lanes locally. The next Copperknot-owned lane is `Storage, delivery, and variants` unless fresh evidence from Bactuo, Holomony, or production checks reranks the queue. Start that lane with a bounded acceptance question and no UI/UX or major behavior changes.

## Board Rules

- `Blocked` and `Below Bar` systems drive the queue unless fresh evidence reranks them.
- `Launchable With Watch` systems still need final proof before launch, but they should not outrank a known blocker unless fresh incidents reopen them.
- No system may move to `Launch Ready` from this board without production evidence or a clearly justified waiver.
- This board supersedes the old July 2 score-first posture for launch prioritization.
