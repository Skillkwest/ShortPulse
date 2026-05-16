# Unified Phase 12: Cleanup and Decommission

Status: In Progress (Execution Locked; Awaiting Signoff Gates)
Owner: Engineering

## Objective
Deliver this phase with no regressions, no duplicated logic, and complete docs/evidence traceability.

## In Scope
1. Items defined in `docs/planning/shortpulse-unified-buildout-master-plan.md` for Phase 12.
2. Tests and documentation updates directly required by those items.

## Out of Scope
1. Unrelated feature work.
2. Broad refactors not required for this phase objective.

## Implementation Slices
1. Slice A: smallest safe functional increment.
2. Slice B: test hardening and edge-case completion.
3. Slice C: docs + evidence + tracker update.

## Current Slice A Update (2026-03-01)
Implemented:
1. Added pre-cleanup inventory and execution checklist packet:
   - `docs/planning/evidence/unified-buildout/phase-12/2026-03-01-phase-12-slice-a-precleanup-inventory-and-execution-checklist.md`
2. Cataloged cleanup targets now (flags, compatibility shims, provider adapters, docs references) without removing any runtime behavior.
3. Added explicit guard: no compatibility removals before Phase 04 and Phase 11 canary/cutover signoff.

Remaining:
1. Execute cleanup removals only after cutover gates pass.
2. Complete post-cleanup validation and two green release cycles.

## Current Slice B Update (2026-03-01)
Implemented:
1. Added concrete path-level decommission map:
   - `docs/planning/evidence/unified-buildout/phase-12/2026-03-01-phase-12-slice-b-concrete-decommission-inventory-map.md`
2. Captured explicit post-signoff disposition for:
   - transition flags,
   - Fal compatibility wrapper modules,
   - deferred-window decisioning artifacts.
3. Defined deterministic post-signoff removal order and per-slice validation packet.

Remaining:
1. Run removals only after signoff gates are complete.
2. Validate each removal slice with full no-regression packet.

## Current WS-0 Update (2026-03-01)
Implemented:
1. Recorded a single Phase 12 execution-start lock entry with UTC timestamp:
   - `docs/planning/evidence/unified-buildout/phase-12/2026-03-01-phase-12-ws0-execution-readiness-lock.md`
2. Linked prerequisite signoff references for Phase 04 and Phase 11 in the execution lock packet.
3. Captured gate-status snapshot (`met` vs `blocked`) and froze cleanup scope for post-signoff slices.

Remaining:
1. Do not start WS-1 through WS-6 until signoff gates are satisfied.
2. Begin WS-1 immediately after gates clear, using the conservative slice order already documented.

## Current WS-0.5 Update (2026-03-01)
Implemented:
1. Added deterministic execution gate helper:
   - `scripts/phase12_execution_gate.mjs`
2. Added shortcut command:
   - `npm -C frontend run phase12:execution-gate`
3. Added evidence packet:
   - `docs/planning/evidence/unified-buildout/phase-12/2026-03-01-phase-12-ws0-execution-gate-helper.md`

Remaining:
1. Continue using WS gate helper as preflight check before every Phase 12 removal slice.
2. Keep WS-1..WS-6 blocked until helper indicates prerequisites are satisfied.

## Validation Gates
1. 
> shortflow@1.0.0 lint
> eslint .
2. 
> shortflow@1.0.0 type-check
> tsc --noEmit
3. 
> shortflow@1.0.0 build
> next build

▲ Next.js 16.1.6 (Turbopack)
- Environments: .env.local

  Running TypeScript ...
  Creating an optimized production build ...
✓ Compiled successfully in 1848.7ms
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (0/18) ...
  Generating static pages using 9 workers (4/18) 
  Generating static pages using 9 workers (8/18) 
  Generating static pages using 9 workers (13/18) 
✓ Generating static pages using 9 workers (18/18) in 103.0ms
  Finalizing page optimization ...

Route (pages)
┌ ○ /
├   /_app
├ ○ /404
├ ○ /admin
├ ○ /admin/generation-trace
├ ○ /ai-studio
├ ƒ /api/admin/credits/adjust
├ ƒ /api/admin/credits/ledger
├ ƒ /api/admin/error-events
├ ƒ /api/admin/errors
├ ƒ /api/admin/errors-status
├ ƒ /api/admin/errors-test
├ ƒ /api/admin/generation-recovery/replay
├ ƒ /api/admin/generation-trace
├ ƒ /api/admin/users
├ ƒ /api/ai/describe-image
├ ƒ /api/ai/generate-prompt
├ ƒ /api/ai/studio-agent
├ ƒ /api/billing/credit-packages
├ ƒ /api/billing/stripe/checkout
├ ƒ /api/billing/stripe/portal
├ ƒ /api/billing/stripe/webhook
├ ƒ /api/credits/snapshot
├ ƒ /api/fal/flux2-edit-status
├ ƒ /api/fal/flux2-edit-submit
├ ƒ /api/fal/flux2-status
├ ƒ /api/fal/flux2-submit
├ ƒ /api/fal/flux2klein-status
├ ƒ /api/fal/flux2klein-submit
├ ƒ /api/fal/flux2pro-edit-status
├ ƒ /api/fal/flux2pro-edit-submit
├ ƒ /api/fal/flux2pro-status
├ ƒ /api/fal/flux2pro-submit
├ ƒ /api/fal/kling-status
├ ƒ /api/fal/kling-v3-image-to-video-status
├ ƒ /api/fal/kling-v3-image-to-video-submit
├ ƒ /api/fal/kling-v3-text-submit
├ ƒ /api/fal/nano-banana-edit-status
├ ƒ /api/fal/nano-banana-edit-submit
├ ƒ /api/fal/nano-banana-pro-edit-status
├ ƒ /api/fal/nano-banana-pro-edit-submit
├ ƒ /api/fal/nano-banana-pro-status
├ ƒ /api/fal/nano-banana-pro-submit
├ ƒ /api/fal/nano-banana-status
├ ƒ /api/fal/nano-banana-submit
├ ƒ /api/fal/queue-status
├ ƒ /api/fal/seedance-i2v-status
├ ƒ /api/fal/seedance-i2v-submit
├ ƒ /api/fal/seedance-status
├ ƒ /api/fal/seedance-submit
├ ƒ /api/fal/seedream-edit-submit
├ ƒ /api/fal/seedream-status
├ ƒ /api/fal/seedream-submit
├ ƒ /api/fal/status
├ ƒ /api/fal/submit
├ ƒ /api/fal/veo-first-last-frame-submit
├ ƒ /api/fal/veo-image-to-video-status
├ ƒ /api/fal/veo-image-to-video-submit
├ ƒ /api/fal/veo-status
├ ƒ /api/fal/veo-submit
├ ƒ /api/fal/webhook
├ ƒ /api/internal/generation-recovery/run
├ ƒ /api/log/client-error
├ ƒ /api/media/move
├ ƒ /api/media/move-batch
├ ƒ /api/media/resolve-previews
├ ƒ /api/media/sign-batch
├ ƒ /api/upload-image
├ ƒ /api/upload-video
├ ○ /auth
├ ○ /character
├ ○ /character-soon
├ ○ /creator-studio
├ ○ /dashboard
├ ○ /landing
├ ○ historical implementation
├ ○ /onboarding
├ ○ /performance
├ ○ /performance-soon
├ ○ /profile
└ ○ /saved-creators

ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
4. 
> shortflow@1.0.0 docs:check
> cd .. && node scripts/check_docs_links.js && node scripts/check_docs_semantic_drift.js && node scripts/check_migration_doc_parity.js && node scripts/check_archive_manifest.js && node scripts/check_model_catalog_parity.js && node scripts/check_naming_canonical_drift.js

Documentation checks passed.
Semantic drift checks passed.
Migration/doc parity checks passed.
Archive manifest checks passed.
Model catalog parity checks passed.
Naming canonical drift checks passed.
5. Domain-specific suites tied to touched files.

## Targeted Research Checkpoint
If this phase touches external contracts/standards, add a short research note with primary-source links under:
1. Not required for current pre-signoff cleanup prep; Phase 12 work is repo-local and governance-driven.

## Required Docs Updates
1. Update Phase 12 stage/tracker status.
2. Add evidence summary in phase-12 folder.
3. Update impacted SOP/API/ADR/change-log docs.

## Exit Criteria
1. All validation gates green.
2. Tracker status updated.
3. Evidence note committed.
4. Rollback note documented.

## Rollback Plan
1. Revert only the PR slice(s) from this phase.
2. Keep previous stable phase baseline intact.
