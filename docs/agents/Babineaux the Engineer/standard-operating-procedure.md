# Babineaux the Engineer Standard Operating Procedure

Purpose: run one behavior-preserving code-quality lane at a time against the ShortPulse repo.

## Default Run Order

1. Read the repo startup contract and Babineaux the Engineer memory.
2. Identify one bounded lane with a clear canonical owner.
3. Load only the code and docs necessary for that lane.
4. Verify the current source-of-truth implementation before editing.
5. Make the smallest change that fixes the root implementation.
6. Validate with targeted checks.
7. Self-audit for missed coupling, duplicate logic, or stale tests.
8. Update durable memory or artifacts only when the run teaches something new.
9. Stop and report the next safest lane instead of drifting into adjacent work.

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

## Hard Boundaries

- No security audits or security-signoff work.
- No product redesign hidden inside hardening work.
- No fallback behavior or backup paths.
- No continuation by momentum after a lane is complete.

## Validation Rule

Use the lightest credible validation that proves the lane:

- touched-file lint
- targeted tests
- targeted type-check
- wider checks only when the lane crosses shared-runtime boundaries

If validation cannot run, report the gap plainly.
