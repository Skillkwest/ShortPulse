# Next-Agent Handoff: Model Lifecycle Governance

Lane id: `architecture-audit-11-model-lifecycle-governance`

Status: medium-high ROI; runtime admission gate first. Pricing changes are explicitly excluded.

## Copy/Paste Assignment

Define and enforce model lifecycle semantics so inactive or retired models cannot accept new submissions while historical runs remain explainable and retrievable. Add retirement/default-role tooling without changing providers, models, or prices unless separately authorized.

## Required Context

Read first:

- `AGENTS.md`, model registry/adapter docs, pricing docs, route docs, and provider SOPs
- current model doctor, parity, and pricing drift scripts
- Lane 05 boundary: pricing authority remains separate

Inspect first:

- canonical model registry and workflow/model selectors
- server submission routes and provider adapters
- default-model role resolution
- historical run/status/retrieval/rendering paths
- admin/model operations and retirement docs

## Confirmed Problems

- Existing doctor/parity checks can pass without proving activation-transition semantics.
- New-submit admission needs a server-side active lifecycle gate.
- Retired model compatibility for historical runs must be distinct from permission to submit new work.
- Default roles need an active, unique, verifiable assignment.

## Owned Write Surface

- model lifecycle enum/state and server admission gate
- historical compatibility/status contract
- default-role uniqueness/active invariants
- retirement preflight/doctor tooling and operator documentation
- focused lifecycle transition, submission, and historical-run tests

## Avoid Surface

- prices, billing evidence, credit amounts, or pricing policies, owned by Lane 05
- provider migration, model removal, or default change without explicit product authority
- deletion of historical records
- client-only enforcement as the canonical gate

## Required Contract

1. Lifecycle states and allowed transitions are documented and server enforced.
2. Only submission-eligible active models accept new commands.
3. Historical runs retain immutable model/provider/version identity.
4. Retired compatibility adapters may serve status/retrieval without reopening submission.
5. Every required default role resolves to exactly one active compatible model.
6. Retirement tooling lists active references, defaults, in-flight work, pricing references, docs, and rollback conditions before mutation.

## Required Failure Tests

- model retires between UI selection and server submission
- historical run references a retired model
- duplicate, missing, inactive, or incompatible default-role assignment
- retirement attempted with in-flight work or unresolved references
- provider status webhook arrives after retirement

## Acceptance Criteria

- New work cannot enter a non-submittable lifecycle state.
- Existing historical work remains intelligible and recoverable where the provider permits.
- Doctor tooling fails on invalid transition/default/reference conditions.
- No provider/model/default/price is actually changed by this lane without separate authorization.

## Validation And Proof

- Run model doctor/parity plus new lifecycle-transition tests.
- Test all server submission entry points, not only UI selectors.
- Use fixtures for retired historical work and late provider events.
- Production proof is read-only registry/admission inspection unless a lifecycle change is separately authorized.

## Stop Rules

- Stop before retiring, disabling, migrating, or defaulting any production model.
- Do not solve lifecycle defects through pricing edits or client hiding.
- Stop if registry authority is duplicated or unclear; resolve the canonical source first.
