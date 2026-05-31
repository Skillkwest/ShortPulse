# Generated Image Admitted Variant Post-Smoke Closeout

Purpose: record Gutan's completion evidence for the generated-image admitted variant lane after migration, deployment, and manual production smoke testing.

Date: 2026-05-31

Owner: Gutan, ShortPulse Media Ingestion Normalization Steward

## Outcome

Status: complete for Phase 5 generated-image reuse admission.

User-reported production smoke result:

```text
After manual tests, large images seem to be working in the surfaces I tested.
```

Per the prior user instruction, this response is treated as confirmation that:

- Gearball committed and pushed the changes;
- deployment completed;
- the user completed manual smoke testing;
- prior Phase 5 prerequisites and checks are complete unless explicitly reopened.

## Evidence Recorded Before Smoke

- Nuclo approved the schema/storage shape in `docs/records/artifacts/agent/nuclo/reports/2026-05-30-generated-image-admitted-variant-nuclo-review.md`.
- Dave approved the server-authoritative/fail-closed security boundary in `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-05-30-generated-image-admitted-variant-security-review.md`.
- Migration `sql/migrations/140_add_admitted_reference_image_variant.sql` added `admitted_reference_25mb` to `media_asset_variants_variant_kind_check`.
- The user reported the migration was applied.
- Gutan created a Nuclo post-migration proof handoff at `docs/records/artifacts/agent/gutan/generated-image-admitted-variant-post-migration-nuclo-handoff.md`.
- Repo-side proof passed before deployment:
  - focused image-admission/admitted-variant tests;
  - targeted ESLint;
  - docs checks;
  - whitespace diff check;
  - Supabase transformation guard.

## Product Behavior Confirmed

- Large images are working in the manually tested surfaces.
- Generated/full-quality originals remain the intended authority for detail, save, download, and export.
- Product/provider references may use the admitted `admitted_reference_25mb` derivative where needed.
- No Supabase image transformation usage was introduced by the Gutan lane.

## Post-Smoke Runtime Proof

- The user later confirmed that Nuclo's post-smoke proof came back clean.
- Treat this as confirmation that the hosted storage/schema/runtime follow-up did not reveal drift in the admitted-variant lane.
- With the clean Nuclo proof plus manual production smoke, Gutan can fully close Phase 5 and move on.

## Remaining Known Limitations

- Over-25 MB animated images remain intentionally rejected in v1.
- Ephemeral local/blob/data product-use references remain the next unresolved Gutan lane if the user wants to continue beyond Phase 5.
- Full `npm -C frontend run type-check` remains blocked by unrelated AI Studio test fixture errors outside the Gutan-touched files.

## Stop Condition

Do not continue by momentum alone. Reopen this lane only if:

- a production smoke surface fails with an oversized still image;
- `admitted_reference_25mb` rows show scope/path/accounting drift;
- a provider submit path still receives an over-25 MB generated still image;
- original full-quality save/download/export authority regresses;
- any Supabase image transformation usage appears.
