# Supabase Egress Optimization Production Audit

Date: 2026-06-20
Agent: Nuclo
Scope: ShortPulse production Supabase egress optimization lane
Mode: audit/report only; no app, SQL, Vercel, or Supabase mutations

## Goal

Preserve the current production evidence for the Supabase egress optimization lane, identify the highest-confidence root-cause direction, and define the stop boundary while Gearball owns dirty media API files.

## Environment And Branch Evidence

- Local branch: `production`.
- Local branch guard: `shortpulse.allowedBranch = production`.
- Production URL in scope: `https://www.shortpulse.ai`.
- Production Supabase project ref verified from a temporary Vercel production env pull: `ftgrqgjrchpimronuhop`.
- Temporary env file path used for the read-only audit: `/tmp/shortpulse-production-egress-audit.env`.
- Secret-bearing temp env file was deleted after use.

## Validation Run

- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai --required-route /api/internal/media-derivatives/run`
  - Result: pass.
  - Live deployment resolved to `https://shortpulse-l7d8cjqfs-kirk-artmans-projects.vercel.app`.
  - Required route `/api/internal/media-derivatives/run` was present.
- Wrong-secret probe against `POST https://www.shortpulse.ai/api/internal/media-derivatives/run`
  - Result: `401`.
  - Interpretation: route is deployed and fail-closed for an invalid cron secret.
- `npm -C frontend run test:supabase-transform-guard`
  - Result: pass.
  - Coverage: 1 test file, 3 tests.
  - Interpretation: the repo guard against Supabase image transformations is still passing.

## Production Data Snapshot

Read-only production REST/storage audit results:

- `media_files`: 3331 rows.
- `media_asset_variants`: 5810 rows.
- Source/kind counts:
  - `ai_studio|audio`: 317
  - `ai_studio|image`: 1857
  - `ai_studio|video`: 239
  - `upload|audio`: 34
  - `upload|image`: 862
  - `upload|video`: 22
- Image variant coverage:
  - Images: 2719 total.
  - Images with thumb variant path: 2719.
  - Image thumb coverage: 100.00%.
- Video variant coverage:
  - Videos: 261 total.
  - Videos with poster: 185.
  - Poster coverage: 70.88%.
  - Videos with preview: 187.
  - Preview coverage: 71.65%.
  - Videos with both poster and preview: 184.
  - Paired video poster+preview coverage: 70.50%.
- Image processing status:
  - `ai_studio|ready`: 1857.
  - `upload|ready`: 862.
- Terminal image failures:
  - Count: 0.

## Object Delivery Samples

Signed object HEAD samples against production storage:

- Recent image thumbs: 50/50 returned `200`.
- Upload image thumbs: 50/50 returned `200`.
- AI Studio image thumbs: 50/50 returned `200`.
- Video posters: 50/50 returned `200`.
- Video previews: 50/50 returned `200`.

Interpretation: current sampled variant object delivery is healthy. The earlier stale/broken image-thumb delivery concern did not reproduce in this production sample.

## Current Diagnosis

The best evidence-backed diagnosis is:

- Image thumbnail generation and sampled delivery are currently healthy.
- Supabase image transformations are still prohibited and the transform guard passes.
- The strongest repo/database-backed media gap is incomplete video poster+preview coverage: about 29.5% of production videos do not have the paired durable video variants.
- If Supabase Dashboard confirms Storage is the dominant egress service, the next likely root-cause lanes are video original delivery/preload behavior, signed URL churn, tutorial/dashboard media usage, or remaining video variant backfill/workflow health.

This report does not prove the exact Supabase egress driver by service. Supabase Dashboard usage/observability breakdown is still needed to distinguish Storage from Database/PostgREST, Auth, Realtime, Edge Functions, Pooler, or Log Drains.

## Stop Boundary

The local worktree currently has Gearball-owned dirty files in the exact media delivery seam:

- `frontend/pages/api/media/list.ts`
- `frontend/pages/api/media/resolve-previews.ts`
- `frontend/pages/api/media/sign-batch.ts`

Nuclo should not inspect, patch, or build conclusions on those files until Gearball cleans/deploys or explicitly hands this seam back. The remaining implementation-grade root-cause work depends on those files if the cause is signed URL churn, preview resolution, or media API selection behavior.

## Next Proof Needed

After Gearball cleans/deploys:

1. Re-run the production egress audit and confirm object delivery and video variant coverage against the settled deployed code path.
2. In Supabase Dashboard, filter Usage to production project `ftgrqgjrchpimronuhop`, not all projects.
3. Capture daily egress breakdown for the high-usage days, especially service split between Storage, cached egress, Database/PostgREST, Auth, Realtime, Edge Functions, Pooler, and Log Drains.
4. If Storage dominates, inspect whether high-byte paths are video originals, dashboard/tutorial thumbnails/videos, AI Studio media previews, or repeated signed original fetches.
5. If Database/PostgREST dominates, pivot away from media and inspect high-volume API/query behavior.
6. If Storage dominates and dirty media files are clean, trace the canonical media delivery path before changing anything:
   - `frontend/pages/api/media/list.ts`
   - `frontend/pages/api/media/resolve-previews.ts`
   - `frontend/pages/api/media/sign-batch.ts`
   - any UI surface that preloads video originals or asks for original URLs when poster/preview variants would do.

## Non-Goals

- Do not use Supabase image transformations.
- Do not change current UI/UX without a concrete root-cause-backed plan.
- Do not patch around Gearball-owned dirty work.
- Do not use `vercel env run` as production proof for Supabase targeting; local env contamination has already been observed in this lane. Use a temporary `vercel env pull` file, verify the project ref, run the read-only audit, then delete the temp file.
