# 0098: Media Storage Lifecycle Stewardship

## Status

Accepted - 2026-07-01

## Context

ShortPulse has two different storage ledgers that must not be conflated.

1. Customer-facing storage quota counts canonical saved media in `media_files.file_size`.
2. Operator-facing infrastructure storage and egress count every private storage object, including staged uploads, transient references, generated-output objects, derivatives, voice/source assets, and domain assets.

ADR 0060 intentionally keeps derivative and transient infrastructure bytes out of customer quota. That is still correct product behavior, but it means Supabase bucket growth needs its own lifecycle authority. The existing cleanup manifest (`sql/check_media_storage_cleanup_manifest.sql`) proved the right shape for safe read-only classification, but it is an operator diagnostic rather than a scheduled lifecycle system.

## Decision

1. Media lifecycle stewardship is a shared Supabase/media-operations lane, not a Media Library UI lane.
   - Nuclo owns hosted Supabase/storage/scheduler operation shape.
   - Dave owns RLS, private-storage, service-role, and internal-route safety review boundaries.
   - Holomony, Gutan, and workflow owners participate only when cleanup policy changes their display or ingestion semantics.

2. Customer quota remains unchanged.
   - `media_files.file_size` remains the customer-facing quota source.
   - Derived variants, staged uploads, workflow references, and internal source assets remain operator infrastructure bytes unless a future product decision changes quota policy.

3. Lifecycle classification must be manifest-first and delete-last.
   - Read-only aggregate diagnostics come before any deletion proposal.
   - Row-level object paths stay local-only and must not be pasted into tracked reports or chat.
   - Unknown, invalid, voice-source, motion-reference-without-verified-leases, and otherwise ambiguous classes require manual review.
   - Active-user-owned private storage objects must not be deleted by lifecycle cleanup, even when they are transient, unreferenced, and older than TTL. A lifecycle object under an active auth user remains report-only until a separate explicit user/account-retirement, account-deletion, or customer-approved cleanup authority proves deletion is allowed.

4. Automated cleanup must use Supabase Storage API deletion, not direct SQL deletion from `storage.objects`.
   - SQL may classify candidates and produce aggregate health.
   - Actual object deletion, when separately approved for non-active-user-owned objects, must go through the Storage API in bounded batches with before/after proof.

5. The first durable runtime step is a disabled-by-default dry-run internal route backed by a service-role-only aggregate RPC.
   - The route reports counts/bytes by lifecycle action, reason, and path class.
   - It does not return object paths, user ids, signed URLs, or secrets.
   - It does not delete storage objects.
   - It uses the same cron-secret fail-closed pattern as existing internal workers.

6. Forward lifecycle proof is required for voice-source cleanup decisions.
   - `voice_source_lifecycle` records staged, submitted, terminal, and retained custom-voice source states for Voice Changer and Voice Clone source objects, including Voice Changer video-derived extracted audio under `voice-changer/staged-audio`.
   - Registry-backed decisions outrank path heuristics for supported new voice-source writes.
   - Existing manifest classification remains the migration and audit bridge for historical objects.

7. Inactive-account proof is separate from deletion.
   - `get_account_storage_ownership_proof_details(...)` and `get_account_storage_ownership_proof_summary(...)` may report whether an account/storage prefix has recent activity, billing blockers, credit reservation blockers, deleted Auth state, or missing owner state.
   - These RPCs are service-role-only and report-only. They do not authorize deletion, enqueue cleanup, call Supabase Storage deletion, or decide final inactive-user data removal.
   - The default operator report must stay aggregate-only. Row-level user proof is local service-role evidence for human review, not a browser/customer payload.

## Lifecycle Classes

Protected or durable classes:

- canonical `media_files.storage_path`
- media variant hints and `media_asset_variants`
- generation projection/publication/display item paths
- character and element media assets
- custom voice sample paths
- legacy or ambiguous user-scoped uploads until reviewed

Candidate cleanup classes after TTL, no blocking reference, and no active-user ownership:

- upload staging paths
- transient reference image paths
- retired motion-reference paths only when lease and retirement tables prove no active lease
- voice changer and voice clone source paths, including video-derived Voice Changer staged audio, only when `voice_source_lifecycle` proves retention has elapsed and no blocking source lifecycle remains

Manual-review classes:

- voice changer and voice clone source paths, including video-derived Voice Changer staged audio, when lifecycle proof is missing, ambiguous, active, or still inside retention
- motion-reference paths when lease tables or retirement evidence are absent
- invalid-prefix or integrity-problem rows
- unknown buckets or path classes

## Consequences

Positive:

- Storage cleanup gets a canonical source boundary instead of ad hoc operator deletes.
- Customer quota/product behavior stays stable while operator infrastructure bytes become measurable.
- Dry-run health can be scheduled without risking customer data.
- Future deletion work has a clear proof boundary.

Tradeoffs:

- Initial automation reports risk but does not reclaim bytes until a separate guarded delete lane is approved.
- Historical objects still require manifest heuristics until forward writes are registered in a lifecycle table, and ambiguous legacy voice sources remain manual-review.
- Motion-reference cleanup depends on production schema parity for the lease/retirement tables from migration 139.

## Validation

This decision is implemented correctly only when:

1. Aggregate lifecycle diagnostics can run without exposing raw object paths, user ids, signed URLs, or secrets.
2. The internal dry-run route is disabled by default and cron-secret protected when enabled.
3. The diagnostic RPC is service-role-only.
4. `voice_source_lifecycle` remains service-role-only and never becomes customer quota, voice ownership, or provider access authority.
5. Delete behavior remains absent or separately gated behind explicit approval, bounded Storage API batches, and before/after manifests.
6. Active-user-owned private storage objects remain report-only unless a separate account/user-retirement authority proves deletion is allowed.
7. Existing customer quota, Media Library UI behavior, private bucket policy, and Supabase image transformation prohibition remain unchanged.
8. Inactive-account proof diagnostics remain service-role-only, report-only, and separate from any manual human deletion process.

## References

- `docs/adr/0060-billing-storage-entitlements-and-recurring-storage-addons.md`
- `docs/product/media-storage-save-blocking.md`
- `docs/adr/0086-motion-reference-video-lease-cleanup.md`
- `docs/adr/0087-supabase-image-transformation-prohibition.md`
- `sql/check_media_storage_cleanup_manifest.sql`
- `sql/check_storage_object_egress_risk_breakdown.sql`
- `frontend/lib/server/mediaUploadService.ts`
- `frontend/lib/server/mediaLibraryDeleteService.ts`
