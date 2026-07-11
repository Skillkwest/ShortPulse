# Next-Agent Handoff: Generated-Media Convergence

Lane id: `architecture-audit-10-generated-media-convergence`

Status: begin after Lane 04 defines truthful project restore/conflict responses. Current AI Studio/media files may be overlap-gated.

## Copy/Paste Assignment

Make generated-media reads and deletes converge across database rows, storage objects, signed URLs, project restore, and open tabs. Preserve known-good visible state during dependency outages and never report an uncertain read as an empty library.

## Required Context

Read first:

- `AGENTS.md` and startup spine
- project persistence/right-rail ADRs and Media Library/storage SOPs
- Lane 04 response-state contract

Inspect first:

- generated-media authority/data services and API routes
- `generatedMediaAuthority` and maintenance hooks
- media-library data effects and delete flows
- signed URL cache/registry modules
- project restore/materialization consumers
- mounted media surfaces and cross-tab synchronization

## Confirmed Problems

- Generated-media reads need explicit `ok`, `empty`, `unavailable`, and `degraded` semantics.
- Dependency failure can be consumed as an ordinary empty state and clear known-good UI.
- Delete success must account for every canonical row/object path and invalidate all visible signed references.
- Signed URL reuse can race deletion or replacement without an authority epoch/version.
- Open tabs and mounted surfaces need a durable invalidation signal.

## Owned Write Surface

- generated-media read authority/result contract
- delete result/receipt and maintenance convergence
- signed URL epoch/version fencing and cache invalidation
- cross-tab invalidation transport and mounted-surface consumers
- focused media authority/delete/cache/project-materialization tests
- related storage/media documentation

## Avoid Surface

- custom voice samples, owned by Lane 07
- project checkpoint CAS, owned by Lane 04
- new media-library UX or global right-rail ownership
- Supabase image transformations, prohibited everywhere

## Required Contract

1. Reads discriminate `ok`, true `empty`, `unavailable`, and `degraded`.
2. Unavailable/degraded reads preserve last known-good state and expose freshness/error state.
3. Delete is idempotent and returns a receipt for canonical rows, storage objects, derivatives, and unresolved obligations.
4. Provider/storage already-absent outcomes converge when identity matches.
5. Signed references carry or are keyed by an authority epoch that advances on delete/replace.
6. Invalidation reaches every mounted consumer and other tabs through `BroadcastChannel` with a tested storage-event fallback.

## Required Failure Tests

- library dependency outage after a successful load
- row deleted but object cleanup retries; object absent before row cleanup
- stale signed URL resolves after delete/replace
- delete in tab A while tab B and project restore are mounted
- duplicate delete and delayed maintenance response

## Acceptance Criteria

- An outage cannot masquerade as an empty library.
- A completed deletion cannot reappear from cache, restore, or another tab.
- Partial deletion remains visible and retryable until its receipt converges.
- Existing workspace-global Reference Grid, Quick Slot Inventory, and Canvas behavior remains unchanged.

## Validation And Proof

- Run focused service/API/hook/cache/restore tests and multi-tab browser tests.
- Verify no Supabase transform URL or signed transform parameter is introduced.
- Separate local contract proof from authenticated production readback.
- Never delete customer media for validation; use a purpose-created test artifact only with authorization.

## Stop Rules

- Stop while Lane 04 response semantics or overlapping media changes are unresolved.
- Stop before hosted mutation, deployment, or destructive production test without authority.
- Do not add a second media authority or hide partial deletion with optimistic clearing.
