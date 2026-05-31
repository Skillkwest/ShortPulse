# Gutan Agent Artifacts

Purpose: store retained, non-authoritative artifacts for Gutan's image-ingestion normalization workflow.

## Status

Gutan is at `Level 1: Supervised`.

The first training/build lane is the ShortPulse product image admission system for <=25 MB generation/product-use images while preserving original/full-quality media authority where required.

## Artifact Layout

- `image-admission-surface-inventory.md`: current inventory of surfaces that must use or explicitly bypass the admission system.
- `image-admission-policy.md`: Gutan's accepted product decisions for original preservation, derivative timing, animated images, messaging, metadata, and storage shape.
- `image-admission-implementation-plan.md`: phased build plan for the product image admission system.
- `generated-image-admitted-variant-review-packet.md`: Nuclo/Dave review packet and copy/paste prompts required before Phase 5 generated-image reuse implementation.
- `generated-image-admitted-variant-post-migration-nuclo-handoff.md`: Nuclo proof packet for hosted lint, constraint verification, storage drift, and admitted-variant baseline after migration `140`.
- `tools.md`: helper scripts and recurring audit commands.
- `training-history.md`: supervised runs, learned behavior, tool changes, and next training focus.
- `reports/`: detailed audits, implementation reports, and validation packets.
- `templates/`: reusable report and handoff templates.

Gutan-owned helper scripts live under:

- `scripts/ops/gutan/`

## Recommended Read Order

For a substantive Gutan run:

1. `docs/agents/gutan/README.md`
2. `docs/agents/gutan/AGENTS.md`
3. `docs/agents/gutan/standard-operating-procedure.md`
4. `docs/agents/gutan/ownership-manifest.md`
5. `docs/agents/gutan/memory.md`
6. `docs/records/artifacts/agent/gutan/image-admission-surface-inventory.md`
7. `docs/records/artifacts/agent/gutan/image-admission-policy.md`
8. `docs/records/artifacts/agent/gutan/image-admission-implementation-plan.md`
9. `docs/records/artifacts/agent/gutan/generated-image-admitted-variant-review-packet.md` when generated-image reuse admission or variant schema is in scope
10. `docs/records/artifacts/agent/gutan/tools.md`

## Authority

These artifacts support Gutan training and traceability. They do not override canonical repo rules, product docs, current user instructions, direct validation evidence, or adjacent agent contracts.

Gutan operates inside the ShortPulse solo-owner model and current pre-launch production-only branch policy. Launch-relevant Gutan reports must follow `docs/agents/solo-owner-launch-trust-standard.md`.
