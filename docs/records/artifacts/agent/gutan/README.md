# Gutan Agent Artifacts

Purpose: store retained, non-authoritative artifacts for Gutan's image-ingestion normalization workflow.

## Status

Gutan is at `Level 1: Supervised`.

The first training/build lane is the ShortPulse product image admission system for <=25 MB generation/product-use images while preserving original/full-quality media authority where required.

## Artifact Layout

- `image-admission-surface-inventory.md`: current inventory of surfaces that must use or explicitly bypass the admission system.
- `image-admission-policy.md`: Gutan's accepted product decisions for original preservation, derivative timing, animated images, messaging, metadata, and storage shape.
- `image-admission-implementation-plan.md`: historical phased build plan for the broad product image admission system; load only when broad/legacy phase context is in scope.
- `generated-image-admitted-variant-review-packet.md`: Nuclo/Dave review packet and copy/paste prompts required before Phase 5 generated-image reuse implementation.
- `generated-image-admitted-variant-post-migration-nuclo-handoff.md`: Nuclo proof packet for hosted lint, constraint verification, storage drift, and admitted-variant baseline after migration `140`.
- `phase-6-ephemeral-provider-submit-admission-plan.md`: parked implementation plan for local/blob/data product-use image admission before provider submit; load only when that lane is explicitly opened.
- `tools.md`: helper scripts and recurring audit commands.
- `training-history.md`: supervised runs, learned behavior, tool changes, and next training focus.
- `reports/`: detailed audits, implementation reports, and validation packets. Key reports:
  - `2026-05-31-generated-image-admitted-variant-post-smoke-closeout.md` for completed Phase 5 generated-image admitted variant proof.
  - `2026-06-18-kie-motion-control-provider-admission-handoff.md` for current Kie Motion Control provider-admission build planning.
- `templates/`: reusable report and handoff templates.

Gutan-owned helper scripts live under:

- `scripts/ops/gutan/`

## Recommended Read Order

For a substantive Gutan run, load the lean operating spine first:

1. `docs/agents/gutan/README.md`
2. `docs/agents/gutan/AGENTS.md`
3. `docs/agents/gutan/standard-operating-procedure.md`
4. `docs/agents/gutan/ownership-manifest.md`
5. `docs/agents/gutan/memory.md`

Then load only the current lane artifact:

- product image admission inventory/policy: `image-admission-surface-inventory.md` and `image-admission-policy.md`;
- broad legacy phase work: `image-admission-implementation-plan.md`;
- Kie Motion Control provider-admission work: `reports/2026-06-18-kie-motion-control-provider-admission-handoff.md`;
- local/blob/data provider-submit admission work: `phase-6-ephemeral-provider-submit-admission-plan.md`;
- generated-image variant schema/security review: `generated-image-admitted-variant-review-packet.md`.

Do not load `training-history.md`, old proof packets, or post-smoke reports by default.

## Authority

These artifacts support Gutan training and traceability. They do not override canonical repo rules, product docs, current user instructions, direct validation evidence, or adjacent agent contracts.

Gutan operates inside the ShortPulse solo-owner model and current pre-launch production-only branch policy. Launch-relevant Gutan reports must follow `docs/agents/solo-owner-launch-trust-standard.md`.
