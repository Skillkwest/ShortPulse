# Systems Catalog

Purpose: define the authoritative ShortPulse systems catalog used for architecture visibility, risk rating, and ship-readiness prioritization.

## What this namespace is for

Use `docs/systems/` to answer:

- what systems exist
- what each system owns
- what product surfaces depend on each system
- which systems are most critical or fragile
- which operational systems in `docs/operator-map.md` support a broader product or platform system

This namespace is the canonical architecture and ship-readiness catalog.

## Relationship to other docs

- `docs/operator-map.md` remains the canonical operations map for schedulers, recovery controls, signals, and runbooks.
- `docs/routes.md` remains the canonical route inventory.
- `docs/product/` remains the product/domain source of truth.
- `docs/sops/` remains the operational workflow source of truth.

The systems catalog does not replace those documents. It connects them.

## Catalog model

The catalog uses three concepts:

- `Domain`: top-level grouping such as `AI Studio Product` or `Billing`
- `System`: the rated unit
- `Surface tags`: user-facing pages, panels, or views that depend on the system

System types:

- `product workflow`
- `shared platform`
- `control plane`
- `ops/support`

The catalog is intentionally doing two jobs:

- canonical system registry
- ship-readiness control surface

The row model should make both jobs clear without forcing the reader to cross-reference multiple docs just to answer whether a system is ready to ship.

## Natural-language mapping

Use workflow/system rows as the primary unit even when the request is phrased in UI shorthand.

Examples:

- `create panel` -> `Create workflow`
- `edit panel` -> `Edit workflow`
- `video panel` -> `Video workflow`
- `sound panel` -> `Sound workflow`
- `reference grid` -> `Reference Grid`

Panels and pages usually belong in `Primary surfaces`, not as top-level system rows.

## What counts as a system

A row belongs in the catalog when it has at least one distinct boundary in:

- user-facing workflow
- runtime behavior
- persistence authority
- failure mode
- operational handling

## What does not count as a system

Do not create top-level system rows for:

- panels
- modals
- components
- helper files
- one-off scripts
- isolated routes with no broader system boundary

Those belong in `Primary surfaces`, `Source of truth`, or supporting references.

## Catalog columns

The catalog row schema is:

- `Domain`
- `System`
- `System ID`
- `Type`
- `Definition`
- `Boundary`
- `Primary surfaces`
- `Depends on`
- `Related operator systems`
- `Steward`
- `Criticality`
- `Health`
- `Risk`
- `Confidence`
- `Rating state`
- `Current score (/10)`
- `Ship floor`
- `Ship status`
- `Priority band`
- `Blocker status`
- `Blocker refs`
- `Active lane`
- `Execution status`
- `Review basis`
- `Source of truth`
- `Last reviewed`
- `Notes`

## Rating method

Ratings should be evidence-backed, not intuition-only.

For each system:

1. confirm the boundary
2. confirm the primary surfaces
3. inspect source-of-truth docs and core code paths
4. inspect dependencies and related operator systems
5. assign provisional scores using `docs/systems/rating-rubric.md`
6. write a short justification in `Notes`

When evidence is thin, lower `Confidence` instead of forcing stronger `Health` or `Risk` claims.

## Fast-scan score

`Current score (/10)` is the required fast-scan maturity signal for this catalog.

- It represents current system health/maturity, not business importance.
- It does not replace the four core ratings.
- Derive it from the four core scores using `docs/systems/rating-rubric.md`.
- Treat it as less trustworthy when `Rating state` is not yet `calibrated`.

## Ship-readiness fields

Use the catalog to distinguish system maturity from execution urgency.

- `Ship floor` is the minimum acceptable `/10` score for the current production window.
- `Ship status` compares `Current score (/10)` against `Ship floor`.
- `Priority band` expresses execution urgency, not maturity.
- `Blocker status` expresses whether the system currently has no blocker, an active blocker, a waived blocker, multiple blockers, or is blocked by another system.
- `Blocker refs` names the current known blocker id or ids when they exist.
- `Active lane` names the current handoff lane id or `queue-only`.
- `Execution status` expresses the current lane state such as `not dispatched`, `ready`, `running externally`, or `completed externally, pending review`.
- `Review basis` names the evidence snapshot or review mode behind the row.

Do not use `Priority band` as a proxy for health. A lower-priority row can still be below floor.

Priority bands should be used like this:

- `P0 ship-critical`: current hot-path systems that materially block release
- `P1 ship-relevant`: next systems that can still block or destabilize ship readiness
- `P2 validation`: important systems that should be validated or selectively hardened, but are not the first release-control lane

## Queue precedence

The catalog uses two urgency layers on purpose:

- `Priority band`:
  - urgency class
- handoff queue:
  - exact next-work order

When they disagree or seem to conflict:

- use `Priority band` to understand why a system matters
- use the current dated handoff queue to decide exact execution order

The queue always wins for exact sequencing.

## Launch-state freshness

The launch-facing fields in the catalog are:

- `Ship status`
- `Priority band`
- `Blocker status`
- `Blocker refs`
- `Active lane`
- `Execution status`
- `Review basis`

Treat those fields as stale when either of these is true:

- more than `7` calendar days have passed since the execution snapshot in `Review basis`
- a blocker, lane, or external execution result changed after the last refresh

When stale:

- the catalog remains useful as a baseline
- but exact launch-control decisions should wait for a refresh pass

## Score vs execution state

Keep these concepts separate:

- system maturity:
  - `Current score (/10)`
  - `Ship floor`
  - `Ship status`
- execution state:
  - `Priority band`
  - `Active lane`
  - `Execution status`
  - `Blocker status`
  - `Blocker refs`

## Rating pass workflow

Use this sequence every time:

1. Pick the system row to rate or refine.
2. Confirm that the user’s language maps to the right system row.
3. Read the linked source-of-truth docs and inspect the main code paths.
4. Refine `Boundary`, `Primary surfaces`, `Depends on`, and `Related operator systems` if needed.
5. Score `Criticality`, `Health`, `Risk`, and `Confidence`.
6. Set `Rating state`, `Ship floor`, `Ship status`, `Priority band`, `Blocker status`, `Blocker refs`, `Active lane`, `Execution status`, and `Review basis`.
7. Add a short note explaining the score and any open questions.

Use `docs/systems/rating-pass-template.md` for the working checklist.

## Update rules

Update `docs/systems/catalog.md` when:

- a major system is added, removed, split, or merged
- a product workflow boundary changes materially
- a platform dependency or control-plane boundary changes materially
- a major incident or refactor changes system health/risk assumptions

Update `docs/systems/ship-readiness-scoreboard.md` in the same pass when:

- any launch-facing catalog field changes
- the queue order changes
- the dispatch log changes
- blocker state changes

Update the taxonomy docs when:

- `docs/systems/` gains or loses durable top-level artifacts
- the meaning of `Domain`, `System`, or `Surface tags` changes

## Review cadence

- Update the catalog in the same change when a durable system boundary changes.
- Do a lightweight architecture review at least monthly or at milestone boundaries.
- Refresh launch-facing fields at least weekly during an active production window.
- Refresh launch-facing fields immediately when blocker status, lane status, or external completion state changes.
- Keep `Last reviewed` current on edited rows.

## Validation

After editing this namespace or the related docs indexes, run:

```bash
npm -C frontend run docs:check
```

## Files in this namespace

- `docs/systems/catalog.md`
- `docs/systems/rating-rubric.md`
- `docs/systems/rating-pass-template.md`
- `docs/systems/ship-readiness-scoreboard.md`
- `docs/systems/next-agent-handoff-generation-recovery-hardening.md`
