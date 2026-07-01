# ADR 0086: Motion Reference Video Lease Cleanup

- Date: 2026-05-29
- Status: Accepted
- Deciders: Frontend Engineering
- Related:
  - `docs/adr/0084-ai-studio-internal-media-ref-submit-authority.md`
  - `docs/sops/sop_video_generation.md`
  - `docs/routes.md`

## Context

Motion Control stages temporary source videos under the private
`<user>/videos/motion-control/*` namespace and then sends the signed delivery URL
to the provider as part of the video-generation payload.

That created two competing cleanup pressures:

1. We want cleared or replaced motion clips removed quickly so temporary private
   storage does not drift into orphaned objects.
2. We must not delete a committed motion clip while an already-started
   generation may still need to fetch that source video from storage.

Immediate client-timed deletion is correct for stale uploads that never became
authoritative, but it is unsafe once the clip has already been submitted into a
generation.

## Decision

1. Motion Control keeps the staged storage object path as the canonical cleanup
   identity for temporary motion clips.
2. Submit captures that storage-path identity in `shortpulse_context` and the
   server records a generation lease for the motion asset when provider submit is
   accepted.
3. Clearing or replacing a committed motion clip tombstones the old storage path
   instead of deleting it unconditionally.
4. Terminal generation settlement releases leases server-side.
5. A tombstoned motion clip becomes cleanup-eligible only when no active
   generation lease still references that storage path and the lifecycle TTL has
   elapsed. Actual object deletion remains a later Storage API cleanup lane that
   requires separate approval.
6. Stale pre-authoritative uploads continue using immediate best-effort delete,
   because they were never submitted into provider work.

## Consequences

Positive:

1. Replacing or clearing Motion Control clips no longer risks breaking an
   in-flight generation payload fetch.
2. Cleanup authority moves to the same server lifecycle that owns generation
   terminal state instead of staying in panel-local UI timing.
3. The browser can still use the legacy upload adapter contract without becoming
   the authority for committed-asset deletion.

Tradeoffs:

1. This ADR adds dedicated lease and retirement tables for the motion-control
   temporary-video namespace.
2. Lease creation/release failures must be logged and repaired operationally;
   they should not break already-accepted provider work.
3. This decision is scoped to Motion Control temporary source videos and does
   not generalize all transient media cleanup paths automatically.

## Validation

This decision is implemented correctly only when:

1. Motion Control submit includes motion asset identity when the selected clip
   came from the private motion-control upload namespace.
2. Server accept writes a generation lease for that motion asset identity.
3. Clearing or replacing a committed motion clip retires the asset without
   deleting it while an active lease still exists.
4. Direct-settlement and recovery terminal transitions release leases.
5. Once all leases are released, tombstoned motion assets are reported as
   delete candidates only after the lifecycle TTL has elapsed. They are not
   deleted by the replacement/clear route or by lease release.
