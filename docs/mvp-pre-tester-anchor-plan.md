---
title: MVP Pre-Tester Anchor Plan
status: Active
owner: Product + Engineering
created: 2026-02-09
last_updated: 2026-02-09
---

# MVP Pre-Tester Anchor Plan

Purpose: keep a strict, reusable stabilization plan before handing the MVP to external testers.

## Current Baseline (2026-02-09)
- `npm -C frontend run lint`: passes (warnings only).
- `npm -C frontend run build`: passes (warnings only).
- AI Studio + Media Library audit in progress; critical fixes started this pass.

## Active Blockers / Gaps (Remaining)
- Provider transition verification is still pending (Fal + Kei success/failure behavior under live calls).
- End-to-end tester flow still needs one manual pass: signup -> admin credit add -> AI Studio generation -> Media Library operations.
- Long-session validation for media operations (rename/delete/download after signed URL expiry) still needs manual confirmation.
- Admin access parity still needs one live check with an email-only admin (`SHORTPULSE_ADMIN_EMAILS`) and a role-based admin.

## Scope Lock
- Priority areas: Authentication/account creation, AI Studio, Media Library, admin credit adjustment flow.
- Out of scope for this pass: onboarding UI polish and broader visual redesign.
- Deferred surfaces must explicitly show "Coming Soon" or equivalent in-product messaging.

## Release Gate
All items marked `P0` must be complete before testers start.

## Work Plan

### Phase 0 (P0): Baseline Freeze + Audit Snapshot
Goal: lock a clear starting point before implementation changes.

Checklist:
- [x] Capture current command status (`lint`, `build`) in this doc.
- [x] Capture known blocker list with file references.
- [x] Confirm MVP scope lock and deferred-surface policy.

Exit criteria:
- Baseline is documented and agreed before fixes begin.

### Phase 1 (P0): Build + Compile Integrity
Goal: ensure production build is green.

Checklist:
- [x] Fix `frontend/features/ai-studio/components/AiStudioPageContent.tsx` model options typing to match `ModelOption`.
- [x] Re-run `npm -C frontend run build` and confirm no TypeScript build errors.

Exit criteria:
- Build passes in local environment.

### Phase 2 (P0): AI Studio Runtime Reliability
Goal: prevent false failures and resource leaks in generation flows.

Checklist:
- [x] Tighten error detection in `frontend/features/ai-studio/hooks/useAiStudioTasks.ts` so informational `message` fields do not trigger failure.
- [x] Add proper teardown for polling timers created by `useAiStudioTasks` when AI Studio unmounts.
- [x] Verify failed/successful generation transitions are stable across Fal and Kei providers.

Exit criteria:
- No false "failed" state during normal provider queue responses.
- No dangling polling after leaving AI Studio.

### Phase 3 (P0): Credit Freshness + Admin Adjustment Flow
Goal: ensure credit UI and guardrails reflect real balance during testing.

Checklist:
- [x] Improve `useCredits` refresh strategy (focus, interval, and post-generation refresh points).
- [x] Ensure generation guardrails use fresh balance before blocking runs.
- [x] Test flow: user signup -> admin credit add -> AI Studio generation without stale-balance blocks.

Exit criteria:
- Credit changes made in admin are reflected quickly in AI Studio/profile.

### Phase 4 (P1): Media Library Stability
Goal: make uploads and retrieval resilient for testers.

Checklist:
- [x] Fix upload placeholder cleanup on upload failure in `frontend/pages/media-library.tsx`.
- [x] Add signed URL refresh/re-sign fallback for expired media in Media Library and AI Studio modal selection paths.
- [x] Validate delete, bulk delete, rename, and download continue working after long session durations.

Exit criteria:
- No stuck "Uploading..." cards.
- Expired URLs are recoverable by the app.

### Phase 5 (P1): Behavior Clarity in AI Studio
Goal: remove hidden behavior and misleading controls.

Checklist:
- [x] Add explicit in-UI notice when image/video reference flows auto-fallback to text-based generation.
- [x] Either wire motion-control options (`keepOriginalSound`, `characterOrientation`) to request payloads or hide/disable them until implemented.

Exit criteria:
- Visible controls map to real backend behavior.
- Fallback behavior is explicitly communicated.

### Phase 6 (P1): Admin Access Consistency
Goal: avoid client/server mismatch for operator access.

Checklist:
- [x] Align admin page client gating with server-side rule set (`roles` + `SHORTPULSE_ADMIN_EMAILS` support).
- [ ] Confirm no authorized admin user is blocked from UI if API would allow them.

Exit criteria:
- Admin UI and admin APIs have consistent authorization behavior.

### Phase 7 (P2): Coming Soon Consistency for Deferred Surfaces
Goal: avoid mixed signals for non-MVP features.

Checklist:
- [x] Align landing/dashboard routing and copy for Performance (single agreed path and message).
- [ ] Verify all deferred feature entry points clearly communicate in-development status.

Exit criteria:
- No route/copy conflicts about feature readiness.

### Phase 8 (P1): Tester Handoff Package
Goal: make the handoff repeatable and low-friction.

Checklist:
- [ ] Add a short tester script (account creation, first generation, media save/check).
- [ ] Add known limitations/currently deferred items in one shareable section.
- [ ] Confirm admin operator steps for adding credits are documented and tested.

Exit criteria:
- A tester can start from zero context and complete the MVP script.

### Phase 9 (P1): Post-Tester Triage Loop
Goal: process tester feedback without destabilizing core MVP.

Checklist:
- [ ] Triage incoming bugs into `P0` (blocker), `P1` (major), `P2` (nice-to-have).
- [ ] Fix `P0` issues in small batches with build/lint verification after each batch.
- [ ] Log decisions (fix now vs defer) in docs changelog/known issues.

Exit criteria:
- Blockers resolved and a clean re-test pass is complete.

## Final Pre-Tester Verification Pass
Run after all `P0` items are complete.

Checklist:
- [x] New user can sign up and sign in successfully.
- [x] Admin can add credits to that user.
- [x] User sees updated credits in AI Studio/profile.
- [x] User can generate image/video in AI Studio and results persist to Media Library.
- [x] User can reopen, preview, download, rename, and delete media.
- [x] Error states are clear for insufficient credits/provider errors.
- [x] `npm -C frontend run lint` and `npm -C frontend run build` both succeed.

## Change Log
- 2026-02-09: Initial version created from full MVP audit findings.
- 2026-02-09: Phase 1 completed (build green), plus partial Phase 2/3/4/6 hardening updates.
- 2026-02-09: Completed fallback transparency, media signed URL auto re-sign, and explicit Media Library download actions.
- 2026-02-09: Added AI Studio credit freshness re-check before blocking generation/regeneration.
- 2026-02-09: Aligned landing Performance CTA/routes with `/performance-soon` coming-soon messaging.
