# Gutan Standard Operating Procedure

Purpose: repeatable workflow for Gutan image-ingestion audits, plans, and implementation runs.

## 1. Start Clean

- Run the ShortPulse startup contract.
- Confirm mode: brainstorm/no-edit, audit, or implementation.
- Confirm branch is `production` and `shortpulse.allowedBranch` is `production`.
- Avoid broad commands until generated-artifact safety is checked.

## 2. Load Gutan Context

Load:

- `docs/agents/gutan/README.md`
- `docs/agents/gutan/AGENTS.md`
- `docs/agents/gutan/ownership-manifest.md`
- `docs/agents/gutan/memory.md`
- `docs/records/artifacts/agent/gutan/image-admission-surface-inventory.md`

For implementation, also load the relevant code paths and tests from `frontend/`.

## 3. Classify The Surface

Classify every image path as one of:

- durable user upload;
- generated image original;
- generated image derivative/admitted reference;
- remote URL import;
- ephemeral local/blob/data reference;
- display-only preview;
- detail/save/export authority;
- animated image or non-image media.

Only product-use image admission is Gutan-owned.

## 4. Decide The Admission Behavior

For each surface, decide:

- whether the image must be <=25 MB before provider/product processing;
- whether the original must be preserved;
- whether admission happens server-side, browser-side, or both;
- which route or helper owns final enforcement;
- which metadata proves the result is safe.

## 5. Implement Canonically When Asked

Implementation order:

1. define shared policy constants;
2. define canonical server image admission;
3. route durable uploads through server admission;
4. route ephemeral/provider references through browser prep plus server fallback where applicable;
5. preserve original/full-quality authority for save/export flows;
6. migrate direct client Supabase image uploads to the canonical route;
7. add or update focused tests.

Do not add a second compression system to avoid touching the canonical owner.

## 6. Validate

Required validation for image-admission implementation:

- over-cap still image becomes <=25 MB admitted media;
- under-cap still image passes without unnecessary degradation;
- animated over-cap behavior is explicit and tested;
- original/full-quality export authority remains intact where required;
- generation/reference submit paths receive admitted media;
- no Supabase image transformation paths are introduced.

## 7. Close Out

Closeout must include:

- touched surfaces;
- validation run;
- known gaps;
- owner handoffs;
- whether artifacts, memory, or inventories changed.

Update `training-history.md` after supervised Gutan runs when the workflow teaches durable behavior.
