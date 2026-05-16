# ADR 0044: Media Rendering Surface Delivery Policy and ADR Reconciliation

## Status
Accepted

## Context
The repo had three different image-delivery behaviors in active use:
1. Media Library route/modal/panel surfaces already favored Supabase signed preview URLs and bypassed `/_next/image` for signed storage URLs.
2. Reference Grid and quick-slot surfaces explicitly used adaptive compaction with trusted optimizer wrapping for heterogeneous remote inputs.
3. Character Manager card surfaces used the shared adaptive resolver in some paths, but still rendered through `next/image` with `unoptimized` and had no explicit policy lock.

Planning work showed this was not one accidental bug. It was a mix of:
- different source classes,
- different signing contracts,
- different failure modes,
- and different product expectations for detail/full-quality views.

We needed a durable policy decision that:
- reconciles ADR 0018 and ADR 0036,
- stays aligned with ADR 0039,
- promotes the missing `quick-swap` hot path into the protected surface set,
- and stops later implementation from forcing one universal renderer where the repo already requires more than one strategy.

We also have an explicit operational constraint now: current Supabase transform usage has already exceeded the included quota materially, so transform-dependent steady-state delivery is not economically acceptable.

## Decision
Adopt a split-but-explicit surface policy model.

### 1. Media Library managed card surfaces
Surfaces:
- `media-library-modal`
- `media-library-panel`

Historical note:
- The former standalone Media Library page used the same policy family before that page was retired.

Policy:
- Image cards target durable stored preview variants/derivatives as the steady-state path.
- Video cards use direct signed originals.
- Signed storage URLs are not wrapped with `/_next/image`.
- Existing transform-backed preview URLs are compatibility-only during migration; they are not the target architecture.

### 2. Media Library preview/detail modal surfaces
Surfaces:
- `media-library-file-modal`
- `media-library-panel-preview-modal`

Policy:
- Modal rendering stays direct and full-quality-first.
- These surfaces do not adopt card-preview delivery rules as their primary display policy.
- `/_next/image` is not introduced into these modal bodies.

### 3. Reference Grid and quick-slot surfaces
Surfaces:
- `reference-grid`
- `quick-slot`

Policy:
- Keep adaptive heterogeneous-source compaction.
- Prefer durable preview candidates first.
- When no durable preview exists, trusted/signed Supabase object URLs or other trusted remote image URLs may still use `/_next/image`.
- Supabase render-image transform URLs are legacy compatibility, not a steady-state dependency.
- Local blobs, videos, and untrusted URLs remain direct-render paths.

### 4. Character Manager card surfaces
Surfaces:
- `character-grid`
- `quick-swap`

Policy:
- Use the shared adaptive resolver for card-surface compaction.
- Do not force Media Library sign-batch preview profiles into Character Manager in `P1`.
- Keep quick-swap/detail preview overlays on direct full-quality signed URLs.
- `quick-swap` is a first-class protected hot-path surface, not a hidden child of `character-grid`.

### 5. Detail/full-quality surfaces
Surfaces:
- `detail-modal`
- Character reference preview overlay

Policy:
- Full-quality direct rendering remains authoritative.
- Candidate fallback chains are preserved.
- Card-preview compaction policy does not control the primary hero render.

### 6. Long-tail and UI-chrome surfaces
Surfaces:
- dashboard/landing/performance/saved-creators/agent/prompt/canvas long-tail
- static logos and picker chrome

Policy:
- Long-tail media surfaces remain `P8` policy work.
- Static/UI-chrome surfaces stay tracked in inventory but do not become protected delivery-policy rows unless later implementation proves they need one.

## ADR Reconciliation
### ADR 0018
ADR 0018 remains authoritative for:
- the shared adaptive-media core under `frontend/lib/adaptive-media/`,
- opt-in surface adapters,
- and the rule that detail/full-quality surfaces remain non-adaptive.

This ADR narrows nothing in ADR 0018. It applies ADR 0018 to concrete surface groups.

### ADR 0036
ADR 0036 remains authoritative for:
- Media Library managed card surfaces using signed preview delivery as the stabilization path that removed signed-URL `/_next/image` failures,
- signed-preview profile wiring,
- and the rule that signed Media Library URLs should not be routed back through `/_next/image`.

ADR 0036 is narrowed in scope:
- it does not become the universal policy for Reference Grid, quick-slot, Character Manager card surfaces, or long-tail static surfaces.
- it does not define the new steady-state economic target for hot-path delivery.
- it does not override ADR 0039's derivative-first hot-path posture or the transform-cost constraint accepted in the decision log.

### ADR 0039
ADR 0039 remains authoritative for:
- transform sunset posture,
- local derivative generation direction,
- and the rule that preview hot paths should not depend on Supabase transforms by default.

This ADR adopts ADR 0039 as the steady-state cost and delivery constraint for Media Library managed surfaces.

## Consequences
- Positive:
  - The repo now has one explicit policy per protected surface.
  - Media Library and Reference Grid keep the strategies they already rely on, but with the steady-state target shifted toward durable previews instead of transform billing.
  - Character Manager and quick-swap are now properly represented in the protected surface set.
  - Later `P3` implementation can unify contracts without pretending all surfaces should share one renderer.
- Negative:
  - The system deliberately keeps more than one delivery strategy.
  - Telemetry and tests must prove the correct strategy per surface, not just globally.
  - Some existing transform-backed paths now become explicit migration/compatibility debt instead of accepted end state.
- Follow-ups:
  - `P3` must implement the accepted surface contract without widening auth or signed-URL trust boundaries.
  - `P4` must keep only tests that enforce this accepted split.
  - `P8` will decide long-tail surfaces individually.

## Alternatives considered
- Option A: force all surfaces onto Next optimizer wrapping.
  - Rejected: contradicts Media Library signed-preview stabilization and reopens the signed-URL failure class ADR 0036 addressed.
- Option B: force all protected surfaces onto signed Supabase transforms only.
  - Rejected: does not fit Reference Grid and Character Manager source heterogeneity without larger server-contract changes.
- Option C: leave the current drift undocumented and resolve it during implementation.
  - Rejected: invites regressions and makes later parity work incoherent.
