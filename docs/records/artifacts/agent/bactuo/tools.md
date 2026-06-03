# Bactuo Tools

Purpose: retain Bactuo's helper inventory and future tooling needs for generation, recovery, and settlement work.

## Current Tools

- `docs/agents/bactuo/generation-recovery-settlement-source-map.md` owns the current doc stack, code-owner map, table model, invariants, and validation anchors.
- Targeted repo inspection should start from the source map, then load only the specific route, helper, test, or SQL surface needed for the lane.
- Retained artifact surfaces are support tools only: memory, run log, training history, reports, and this inventory. They are not default startup context.

## Future Tooling Needs

- reusable generation-incident packet template
- lineage and settlement invariant checklist
- cross-provider identifier contract matrix
- regression checklist for settlement-before-visibility ordering
