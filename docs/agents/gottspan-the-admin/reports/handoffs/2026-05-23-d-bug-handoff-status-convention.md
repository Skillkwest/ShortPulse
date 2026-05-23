# Handoff: D-Bug Handoff Status Convention

Owner: D-Bug

## Problem

D-Bug's handoff queue has useful status information, but the convention is still mostly a manual list in `handoffs/README.md`. This makes it easy for closed, downstream-owned, and active handoffs to drift over time.

## Evidence

- Current status sections exist in `docs/records/artifacts/agent/d-bug/handoffs/README.md`:
  - still-active retained handoff
  - resolved on current branch
  - historical reference only
  - downstream owned
- The handoff folder still contains many dated files, including resolved, historical, and downstream-owned packets.
- Retained reports mention old active-lane language, so the README status needs to stay the authority.

## Requested Cleanup

1. Add a durable status convention to the handoff README:
   - `active`
   - `blocked`
   - `downstream-owned`
   - `resolved`
   - `historical-reference`
2. Either add status metadata to each handoff file or create an index table with one row per handoff.
3. Define when a closed handoff should be moved to an archive subfolder versus kept in-place with status.
4. Ensure future D-Bug closeout reports update the handoff status index as part of Definition of Done.

## Validation

- Run `npm -C frontend run docs:check`.
- Confirm the D-Bug handoff README names exactly which handoffs are currently runnable.
