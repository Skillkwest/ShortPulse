# Unified Phase 07: AI Studio Foundation Modularization

Status: Planned
Owner: Engineering

## Objective
Deliver this phase with no regressions, no duplicated logic, and complete docs/evidence traceability.

## In Scope
1. Items defined in `docs/planning/shortpulse-unified-buildout-master-plan.md` for Phase 07.
2. Tests and documentation updates directly required by those items.

## Out of Scope
1. Unrelated feature work.
2. Broad refactors not required for this phase objective.

## Implementation Slices
1. Slice A: smallest safe functional increment.
2. Slice B: test hardening and edge-case completion.
3. Slice C: docs + evidence + tracker update.

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
✓ Compiled successfully in 1909.3ms
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (0/18) ...
  Generating static pages using 9 workers (4/18) 
  Generating static pages using 9 workers (8/18) 
  Generating static pages using 9 workers (13/18) 
✓ Generating static pages using 9 workers (18/18) in 104.5ms
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
├ ƒ /api/fal/sora-status
├ ƒ /api/fal/sora-submit
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
├ ○ /media-library
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
- 

## Required Docs Updates
1. Update  phase status.
2. Add evidence summary in phase-07 folder.
3. Update impacted SOP/API/ADR/change-log docs.

## Exit Criteria
1. All validation gates green.
2. Tracker status updated.
3. Evidence note committed.
4. Rollback note documented.

## Rollback Plan
1. Revert only the PR slice(s) from this phase.
2. Keep previous stable phase baseline intact.

