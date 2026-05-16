# D-Bug Handoff: media-library-stale-thumb-variant

Historical note: the standalone Media Library page was removed from the product. Keep this handoff as reference only and reopen it only if the same bug is reproduced on current AI Studio media surfaces.

### Source

- Source agent: Beeper
- Source task: production core route audit
- Date: 2026-05-15

### Failing surface

- Route, component, script, command, or subsystem: production historical implementation first-paint preview seeding through `/api/media/list`
- Environment: production
- User-visible symptom: one media card burns a failed preview request before recovering to the full original image
- Exact error text or signature: `net::ERR_BLOCKED_BY_ORB` on signed Supabase image URL for `.../variants/images/4bd51927-1a92-4ee4-add6-711103921cdf/thumb_480`

### Why this is a D-Bug lane

- Why the source agent stopped: Beeper isolated the issue and wrote the evidence packet, but did not start a code patch because the next step is debugging whether the stale pointer is data drift, signing policy drift, or a missing existence check in the route-first seed path.
- Why this should be treated as debugging instead of feature work: the product already has recovery behavior; the open problem is explaining why a missing derivative path is reaching the browser on production first paint.

### Current evidence

- Reproduction steps:
  1. Sign into production as the Beeper audit user.
  2. Open the historical implementation.
  3. Watch initial image-card requests on first paint.
  4. Observe a failed signed request for media row `4bd51927-1a92-4ee4-add6-711103921cdf`.
- Expected behavior: route-first preview seeding should only hand the browser a valid lightweight preview URL or a safe fallback that does not force a failed image request first.
- Actual behavior: `/api/media/list` seeds `signedById` with a signed `thumb_variant_path` that resolves to a missing object; Chromium reports `ERR_BLOCKED_BY_ORB`, then the client falls back to the original upload URL.
- Logs, stack traces, screenshots, or file references:
  - Beeper retained report: `beeper/reports/2026-05-15-prod-core-audit.md`
  - Packet notes: `beeper/runs/2026-05-15-120659-prod-core-audit/notes.md`
  - Route sweep packet: `beeper/runs/2026-05-15-120659-prod-core-audit/evidence/audit-summary.json`
  - Focused media packet: `beeper/runs/2026-05-15-120659-prod-core-audit/evidence/media-library-focused.json`
  - Captured in-app API body: `beeper/runs/2026-05-15-120659-prod-core-audit/evidence/media-library-list-network.json`
- Frequency: reproduced in the first production audit run; currently confirmed for at least one row.

### Scope control

- Owned write surface: media preview debug lane only; likely `frontend/pages/api/media/list.ts` plus adjacent preview-resolution helpers if a fix is warranted
- Avoid surface: unrelated product copy, broad Media Library UX redesign, audit-account data cleanup unless needed for the root cause
- In scope:
  - explain why stale `thumb_variant_path` reaches `signedById`
  - confirm whether the missing object is data drift or route policy drift
  - propose the smallest safe debug/fix path
- Out of scope:
  - new Media Library features
  - general production data hygiene work
  - branch/push/commit execution

### Attempts already made

1. Ran the production walkthrough and isolated the only concrete runtime failure from the broad route pass.
2. Probed the failing signed URL directly and confirmed the response body is JSON `404 Not found`, not an image payload.
3. Captured the actual `/api/media/list` network body and confirmed the row is seeded with `thumb_variant_path=.../4bd51927-1a92-4ee4-add6-711103921cdf/thumb_480`.
4. Verified the client recovers by swapping to the original upload URL.
5. Ruled out a false positive derivative bug for nearby `1x1` cards by confirming those rows are `1x1` source fixtures in the API payload.

### Current hypotheses

1. `media_files.thumb_variant_path` for row `4bd51927-1a92-4ee4-add6-711103921cdf` is stale and points at a deleted or never-written storage object.
2. `/api/media/list` route-first seeding signs the preferred preview candidate without verifying object existence, so stale pointers leak into `signedById`.
3. Client recovery is functioning as designed, but it is masking an upstream delivery integrity problem that should be diagnosed server-side.

### Required context

Read first:

- `beeper/reports/2026-05-15-prod-core-audit.md`
- [docs/troubleshooting.md](../../../../../troubleshooting.md)
- [docs/systems/catalog.md](../../../../../systems/catalog.md)

Inspect first:

- `frontend/pages/api/media/list.ts` around line `403`
- `frontend/lib/mediaPreviewPathCore.ts` around line `174`
- `frontend/features/media-library/hooks/useMediaPreviewRecoveryController.ts` around line `60`
- historical implementation gallery grid component
- `frontend/lib/server/mediaDerivatives/processMediaDerivative.ts`

### Questions for D-Bug

1. What is the smallest credible failing surface: stale row data, storage-object drift, or route-first signing policy?
2. Can the issue be reproduced or narrowed further from current evidence without broad production mutation?
3. What is the next safest debug step: query the row/object state, add a targeted existence guard, or add a diagnostic script/query first?

### Expected output

- debug plan, or
- bounded patch with validation, or
- blocked-with-evidence escalation

### Recommended downstream owner after D-Bug

- Stay with D-Bug, or
- Nuclo for hosted environment/Supabase/data remediation if the root cause is production storage/data drift rather than repo logic

### Suggested validation

- Reproduce on the former production standalone Media Library page with the same audit account
- Confirm row/object state for `4bd51927-1a92-4ee4-add6-711103921cdf`
- If code changes are made, run targeted Media Library tests only where relevant

### Done state

- D-Bug can explain why the stale preview path reaches production first paint, name the smallest fix or remediation path, and show how to validate that the browser no longer burns the failing request before recovery.

### Closeout artifact

- Preferred retained path:
  - `docs/records/artifacts/agent/d-bug/reports/`
- Suggested filename:
  - `2026-05-15-media-library-stale-thumb-variant.md`
