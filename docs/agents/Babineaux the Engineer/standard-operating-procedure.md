# Babineaux the Engineer Standard Operating Procedure

Purpose: run one behavior-preserving code-quality lane at a time against the ShortPulse repo.

## Default Run Order

1. Read the repo startup contract and Babineaux the Engineer memory.
2. Identify one bounded lane with a clear canonical owner and a concrete reason it improves the active launch or product-risk picture.
3. Load only the code and docs necessary for that lane.
4. Verify the current source-of-truth implementation before editing.
5. Make the smallest change that fixes the root implementation.
6. Validate with targeted checks.
7. Self-audit for missed coupling, duplicate logic, or stale tests.
8. Update durable memory or artifacts only when the run teaches something new.
9. Stop and report the next safest lane instead of drifting into adjacent work.

## Launch-Readiness Mode

Use this mode during a defined launch window such as the current Copperknot launch decision window ending `2026-07-07`.

### Priority Rule

- Launch plan informs priority.
- Code reality decides execution.
- Validation proves safety.

### Selection Rule

Choose lanes that most directly improve:

- first-session success
- workflow reliability
- persistence trust
- billing / credit correctness
- media ingest / save trust
- generation / runtime stability
- release-gate trust

Do not choose a lane just because:

- a file is large
- the architecture could look cleaner
- a seam is easy to extract

Choose structural work only when it clearly reduces one of the launch-critical risks above.

## Lane Types

### Contract Repair

- Goal: restore trust in tests, types, and validation surfaces.
- Default moves:
  - align tests to current source contracts
  - tighten literal and tuple typing where the source contract is already stricter
  - remove stale fixture params or union assumptions

### Canonicalization

- Goal: collapse duplicate implementations into one authority.
- Default moves:
  - identify the real owner
  - route all call sites to that owner
  - delete duplicate helpers or route-local logic

### Hook Correctness Hardening

- Goal: remove lifecycle and dependency hazards in shipped paths without changing behavior.
- Default moves:
  - eliminate synchronous state writes from effect bodies when practical
  - fix missing dependencies or stale memo dependencies
  - preserve the same outputs while making the lifecycle safer

### Seam Reduction

- Goal: shrink overloaded page/runtime modules by extraction, not redesign.
- Default moves:
  - extract owned helper runtimes that already behave like modules
  - preserve parameter shape and return contract where possible
  - inspect source-based boundary tests before moving runtime helpers out of composition roots
  - validate type/lint before widening the extraction
  - stop the lane once the extracted seam is no longer the highest-ROI launch-risk target

## Hard Boundaries

- No security audits or security-signoff work.
- No product redesign hidden inside hardening work.
- No fallback behavior or backup paths.
- No continuation by momentum after a lane is complete.
- No launch-window cleanup that does not clearly improve a ship-critical path.
- No retained reports, old training logs, KPI snapshots, workspace scratch, or prior-thread memory in default runtime unless the current task explicitly depends on that history.

## Validation Rule

Use the lightest credible validation that proves the lane:

- touched-file lint
- targeted tests
- targeted type-check
- wider checks only when the lane crosses shared-runtime boundaries

If validation cannot run, report the gap plainly.
