# Systems Rating Pass Template

Purpose: provide one repeatable workflow for rating or refining a system row in `docs/systems/catalog.md`.

## Use this template when

- rating a system for the first time
- revisiting a stale score
- refining a boundary that feels too broad or too vague
- mapping a user-facing panel or page to the correct system row

## Inputs to review

- `docs/systems/catalog.md`
- `docs/systems/rating-rubric.md`
- `docs/routes.md`
- `docs/operator-map.md` when relevant
- relevant `docs/product/*`, `docs/sops/*`, ADRs, and core code paths

## Rating pass checklist

### 1. Identify the system

- Requested surface or concept:
- Mapped system row:
- Why this row is the right match:

### 2. Confirm the boundary

- What is included:
- What is excluded:
- Boundary still correct? `yes/no`
- If no, what should change:

### 3. Confirm the surfaces

- Primary surfaces:
- Any shorthand mappings worth noting:

### 4. Confirm the dependencies

- Main dependencies:
- Related operator systems:

### 5. Review evidence

- Source-of-truth docs:
- Core code paths:
- Known incidents or operational signals:
- Open questions:

### 6. Score the system

- `Criticality`:
- `Health`:
- `Risk`:
- `Confidence`:
- Rating state: `seeded/provisional/calibrated`
- `Current score (/10)`:
- Why this `/10` sits at this part of the `Health` band:
- `Ship floor`:
- `Ship status`:
- `Priority band`:
- `Active blocker`:
- `Active lane`:
- `Review basis`:

### 7. Justify the score

Write one short paragraph:

- why the scores make sense
- what the biggest weaknesses are
- what would most likely change the rating later

### 8. Calibrate when relevant

If this system belongs to an actively-rated cluster, compare it against nearby rows before finalizing:

- Which related systems did you compare against:
- Should any score move for consistency:
- Should any row split or merge:
- Is the `/10` shorthand still fair after comparison:

## Done criteria

A system rating pass is complete when:

- the mapped system row is correct
- the boundary is clear
- surfaces and dependencies are listed
- source-of-truth references were checked
- the four core scores are assigned
- `Rating state`, `Ship floor`, `Ship status`, `Priority band`, `Active blocker`, `Active lane`, and `Review basis` are assigned
- the `/10` shorthand is assigned when the evidence is strong enough
- `Notes` captures the rationale or uncertainty
