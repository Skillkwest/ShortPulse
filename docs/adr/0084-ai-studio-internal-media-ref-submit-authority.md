# ADR 0084: AI Studio Internal Media Ref Submit Authority

- Date: 2026-05-25
- Status: Accepted
- Deciders: Frontend Engineering
- Related:
  - `docs/adr/0027-ai-studio-reference-grid-reroll-replay-snapshot.md`
  - `docs/adr/0053-ai-studio-character-surface-ownership-and-image-performance-contract.md`
  - `docs/adr/0063-project-workspace-authority.md`
  - `docs/adr/0083-create-mode-global-right-rail-authority.md`
  - `docs/sops/sop_image_generation.md`
  - `docs/sops/sop_character_manager_operations.md`

## Context

AI Studio had drifted into storing and replaying provider-ready signed URLs for
app-owned media across several boundaries:

1. Workspace snapshot state persisted internal refs as raw URLs.
2. Generation replay/reroll preserved preflighted reference URLs.
3. Character Mode refreshed signed URLs on the client and handed those URLs
   back into generation as durable state.

That made restore, reroll, and later submit attempts vulnerable to stale signed
URLs even when the app still knew the canonical storage object identity.

The repo already had the beginnings of a stronger pattern:

1. App-owned media often retained storage-path authority elsewhere in the repo.
2. Image/edit submit routes were the correct seam for last-mile provider input
   resolution.
3. Right-rail and workspace authority contracts already favored canonical shared
   state over per-lane derived copies.

We needed one durable rule for image/edit app-owned refs so replay, restore,
Character Mode, and submit stop drifting apart.

## Decision

1. App-owned image/edit refs must persist as canonical internal media refs
   whenever storage authority is known.
2. Provider-facing signed URLs are derived data, not durable app state, for
   app-owned image/edit refs.
3. Image/edit submit routes own the final conversion from canonical internal
   refs to fresh provider-safe request inputs immediately before provider
   dispatch.
4. Replay and reroll may still carry raw URL refs, but only for truly external
   references or URL-only fallback cases.
5. Character Mode participates in the same contract:
   - when Character Sheet storage authority is known, Character Mode hands refs
     into generation as canonical internal media refs,
   - replay/reroll must preserve those canonical refs,
   - submit resolves fresh provider URLs at dispatch time.
6. Replay `v2` is used only when usable canonical internal refs are present.
   Replay should not promote itself to `v2` for placeholder/null-only
   descriptor arrays.

## Consequences

Positive:

1. Restore and reroll stop depending on stale signed URLs for app-owned
   image/edit refs.
2. Character Mode no longer reintroduces URL-authority drift after the generic
   image/edit path was hardened.
3. Submit becomes the single authoritative seam that resolves provider-facing
   request inputs for app-owned image/edit refs.
4. The runtime carries fewer conflicting representations of the same internal
   media object.

Tradeoffs:

1. Client preflight still exists for unavoidable local uploads and URL-only
   fallback cases, so the runtime remains mixed until broader server authority
   work happens.
2. Character Mode bundle assembly is still client-owned before the canonical ref
   handoff, even though provider URL minting is no longer client-authoritative.
3. Adjacent lanes outside image/edit, especially broader video/media contracts,
   still need separate scoping instead of inheriting this ADR by assumption.

## Validation

This decision is implemented correctly only when:

1. Workspace restore can recover app-owned image/edit refs without depending on
   old signed URLs.
2. Reroll prefers canonical internal refs when replay `v2` exists.
3. Character Mode hands app-owned refs into generation via canonical internal
   refs instead of durable signed URLs.
4. Image/edit submit routes resolve provider-safe request inputs for canonical
   refs at dispatch time.
5. External URLs still pass through unchanged when no internal storage authority
   exists.
