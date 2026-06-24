# Video Motion Control Provider-Admission Acceptance

Date: 2026-06-23

Purpose: record Copperknot acceptance of the Gutan Motion Control provider-admission handoff after fresh deploy/worktree refresh.

Touched:

- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`

Inspected:

- `docs/records/artifacts/agent/gutan/reports/2026-06-18-kie-motion-control-provider-admission-handoff.md`
- `frontend/lib/server/kieMotionControlMediaAdmission.ts`
- `frontend/pages/api/kie/upload-url.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/videoHandlers.ts`
- Focused Motion Control/Kie tests

Result:

- Fresh production route parity passed against `https://www.shortpulse.ai`, deployment `shortpulse-1kvje6s4i`, created `2026-06-23T22:39:58.437Z`.
- Secret exposure checks passed.
- Worktree was clean before the acceptance audit.
- Current source implements explicit `kie_motion_control_character_image` provider admission through local/blob, remote URL, and owned-storage Kie upload paths.
- Server admission converts product-valid WebP/oversized character images into Kie-compatible JPEG/PNG bytes, rejects invalid dimensions/aspect deterministically, preserves originals, and uses no Supabase image transformations.
- Focused validation passed: `6` files / `113` tests for Motion Control admission, Kie upload URL, Video handler submission, motion-reference upload, Kie media guards, and model contracts.
- Generate CTA contract passed.
- Targeted Supabase transform scan found no transform usage in the Kie/Motion seams.

Launch Truth:

- Video workflow moves from `Blocked - Gutan Handoff` / `Repo Inspected` to `Below Floor - Source Hardened` / `Locally Tested`.
- Remaining proof is authenticated production/provider Motion Control behavior and accepted-output lifecycle. Credit-consuming proof remains approval-gated.
