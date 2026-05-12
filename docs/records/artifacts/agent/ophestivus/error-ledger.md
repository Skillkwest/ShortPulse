# Ophestivus Error Ledger

Purpose: maintain a durable cross-run history of Admin Errors incidents Ophestivus has handled, verified, or escalated.

## Authority

- This file is a repo-local operational history artifact.
- Canonical board state still lives in the admin kanban and Admin Errors backing data.
- Local run reports remain the full per-run narrative. This ledger is the cross-run index.

## Controlled Vocabulary

Use these values consistently so entries stay comparable over time.

- `Disposition`
  - `resolved`: Ophestivus fixed the issue and the incident family was verified clean.
  - `verified-existing-fix`: the incident was closed based on current code and fresh verification rather than a new code change.
  - `human-review`: Ophestivus escalated the issue because it was too broad, risky, or externally blocked.
  - `noise-filtered`: Ophestivus changed filtering or skip behavior so non-actionable noise no longer reaches the queue.
- `Scope`
  - `bounded`: one lane, safe to own in a normal SOP run.
  - `broad`: multi-lane, risky, or cross-domain.
- `Verification`
  - `live-route-verified`
  - `tests-and-data-verified`
  - `telemetry-filter-verified`
  - `blocked-live-verification`
- `Residual risk`
  - `Accepted`
  - `Monitor`
  - `Follow-up`

## Entry Rules

- Add one row for every incident Ophestivus intakes and works to a final board outcome.
- Include `human-review` rows for escalations once they have a durable local report or equivalent exported evidence.
- Do not add rows for helper-only/tooling work unless it directly changed incident handling.
- Prefer incident-specific run reports as the source when backfilling older rows.

## Known Gap

- Historical human-review backlog escalations created before this ledger was introduced are not fully backfilled here yet because they do not all have durable local report artifacts in the repo.

## Ledger

| Date | Incident | Ticket | Error | Route / Endpoint | Disposition | Scope | Resolution type | Verification | Residual risk | Report |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-01 | `2ae04e13-6b60-451f-bf70-481064d870d0` | `9624c5dc-0373-445f-91e0-5f71bcd4d93b` | `Failed to fetch` | `/api/admin/billing-diagnostics` | `noise-filtered` | `bounded` | `new-code` | `telemetry-filter-verified` | `Monitor` | [2026-05-01-failed-to-fetch-9624c5dc-2ae04e13.md](reports/2026-05-01-failed-to-fetch-9624c5dc-2ae04e13.md) |
| 2026-05-01 | `fd40e746-71b1-4c95-8550-9ab708711dd5` | `e3596d51-5b8c-4f77-96c8-2273bb9eb0eb` | `Failed to fetch` | `/api/admin/errors`, `/api/admin/error-events` | `noise-filtered` | `bounded` | `new-code` | `telemetry-filter-verified` | `Monitor` | [2026-05-01-hidden-admin-errors-refresh-fetch-skipped-in-local-dev-e3596d51-fd40e746.md](reports/2026-05-01-hidden-admin-errors-refresh-fetch-skipped-in-local-dev-e3596d51-fd40e746.md) |
| 2026-05-01 | `9faa60b8-0e1b-48ef-8715-555b9bd60dd1` | `fec6f4c1-be76-4907-a4bc-de5371bb8cf9` | `Failed to fetch` | `/api/admin/error-events`, `/api/admin/errors` | `verified-existing-fix` | `bounded` | `verified-existing-fix` | `telemetry-filter-verified` | `Monitor` | [2026-05-01-hidden-admin-error-events-refresh-fetch-skipped-in-local-dev-fec6f4c1-9faa60b8.md](reports/2026-05-01-hidden-admin-error-events-refresh-fetch-skipped-in-local-dev-fec6f4c1-9faa60b8.md) |
| 2026-05-01 | `897c3e00-2752-4db9-81a8-88c15a7ae2ab` | `26e9131c-c83a-4f76-95ca-ff39bdb1395c` | `Failed to fetch` | `/api/pricing/model-policy` | `resolved` | `bounded` | `new-code` | `tests-and-data-verified` | `Monitor` | [2026-05-01-pricing-policy-fetch-retries-transient-network-failure-26e9131c-897c3e00.md](reports/2026-05-01-pricing-policy-fetch-retries-transient-network-failure-26e9131c-897c3e00.md) |
| 2026-05-01 | `c3c6658a-993a-4515-bbb5-0cc0df68b67a` | `a46dcb2d-064a-4d14-8dbb-1e10908f5356` | `PricingCatalogSections is not defined` | `/admin/pricing` | `noise-filtered` | `bounded` | `new-code` | `tests-and-data-verified` | `Monitor` | [2026-05-01-pricingcatalogsections-is-not-defined-a46dcb2d-c3c6658a.md](reports/2026-05-01-pricingcatalogsections-is-not-defined-a46dcb2d-c3c6658a.md) |
| 2026-05-02 | `3e254edd-6a8d-4465-bcb5-1cf3175758d7` | `1cdc9df4-5f6a-4a74-8db5-92ee862d0f77` | `Failed to fetch` | `/api/projects/<id>` | `noise-filtered` | `bounded` | `new-code` | `telemetry-filter-verified` | `Monitor` | [2026-05-02-failed-to-fetch-hidden-project-identity-noise-1cdc9df4-3e254edd.md](reports/2026-05-02-failed-to-fetch-hidden-project-identity-noise-1cdc9df4-3e254edd.md) |
| 2026-05-02 | `e40a2391-0111-4dbf-9bcd-cdea4d75e8fc` | `c62c2a43-65ea-487e-9e02-dc7b4a089044` | `Failed to fetch` | `/api/projects/<id>` | `resolved` | `bounded` | `new-code` | `tests-and-data-verified` | `Monitor` | [2026-05-02-failed-to-fetch-project-identity-retry-c62c2a43-e40a2391.md](reports/2026-05-02-failed-to-fetch-project-identity-retry-c62c2a43-e40a2391.md) |
| 2026-05-06 | `c9ec9816-96c2-4231-8773-93fc42f4782a` | `f1efb683-0d5c-4742-b703-33d17e4ca3c8` | `roundingInputValue is not defined` | `/admin/pricing` | `verified-existing-fix` | `bounded` | `verified-existing-fix` | `tests-and-data-verified` | `Monitor` | [2026-05-06-pricing-runtime.md](reports/2026-05-06-pricing-runtime.md) |
| 2026-05-10 | `7aa4cf2b-1b26-483e-8966-91822ebb4c07` | `b220a307-f50a-4e5d-87b8-815b99e57389` | `Failed to fetch` | `/api/projects/<id>/workspace` | `resolved` | `bounded` | `new-code` | `tests-and-data-verified` | `Monitor` | [r-20260510-workspace-save.md](r-20260510-workspace-save.md) |
| 2026-05-11 | `df804dd0-b095-4dc4-9aae-921ab4fa209d` | `fdb0cca3-4a5e-4aca-86e8-e444ebbf0563` | `navigateToProjectRoute is not defined` | `/ai-studio` | `resolved` | `bounded` | `new-code` | `tests-and-data-verified` | `Monitor` | [2026-05-11-navigatetoprojectroute-is-not-defined-fdb0cca3-df804dd0.md](reports/2026-05-11-navigatetoprojectroute-is-not-defined-fdb0cca3-df804dd0.md) |
| 2026-05-11 | `e06e5ee8-44fb-49a6-b576-3202ca5332fb` | `c4ea66f4-270b-4efb-8712-96570ecb673a` | `Generation failed to start before task initialization.` | `/ai-studio`, `/api/elevenlabs/music` | `resolved` | `bounded` | `new-code` | `tests-and-data-verified` | `Monitor` | [2026-05-11-direct-request-audio-placeholders-misclassified-as-submit-start-failur-c4ea66f4-e06e5ee8.md](reports/2026-05-11-direct-request-audio-placeholders-misclassified-as-submit-start-failur-c4ea66f4-e06e5ee8.md) |
| 2026-05-11 | `adc40283-0dd5-4747-826c-8da27b0a6ca2` | `e115b8c5-3f8b-41b0-8712-3ccdd3859f51` | `Invalid request` | `/ai-studio`, `/api/elevenlabs/music` | `resolved` | `bounded` | `new-code` | `tests-and-data-verified` | `Monitor` | [2026-05-11-custom-music-prompt-overflow-reached-invalid-request-route-e115b8c5-adc40283.md](reports/2026-05-11-custom-music-prompt-overflow-reached-invalid-request-route-e115b8c5-adc40283.md) |
| 2026-05-11 | `4145d759-4eeb-41e5-b947-f7ce7a163027` | `afedab97-24a3-47d4-9339-e53adaa20146` | `Cannot access 'buildSubmissionText' before initialization` | `/ai-studio` | `verified-existing-fix` | `bounded` | `verified-existing-fix` | `tests-and-data-verified` | `Monitor` | [2026-05-11-buildsubmissiontext-initialization-regression-already-corrected-afedab97-4145d759.md](reports/2026-05-11-buildsubmissiontext-initialization-regression-already-corrected-afedab97-4145d759.md) |
| 2026-05-11 | `ad407c6c-cb32-43a3-b4b6-b1b35656f0e4` | `ac4ac671-eb69-433a-ade4-dce45f17f43e` | `Failed to fetch` | `/ai-studio`, `/api/account/media-compliance` | `noise-filtered` | `bounded` | `new-code` | `telemetry-filter-verified` | `Monitor` | [2026-05-11-hidden-media-compliance-fetch-noise-filtered-in-local-ai-studio-ac4ac671-ad407c6c.md](reports/2026-05-11-hidden-media-compliance-fetch-noise-filtered-in-local-ai-studio-ac4ac671-ad407c6c.md) |
| 2026-05-11 | `1c11a9fb-7c06-4f9b-9009-64ceed91a27c` | `e6235de1-38d7-4828-a28c-223010b2e4d6` | `Cannot read properties of undefined (reading 'requestPlay')` | `/ai-studio` | `resolved` | `bounded` | `new-code` | `tests-and-data-verified` | `Monitor` | [2026-05-11-reference-grid-audio-controller-missing-guard-caused-runtime-crash-e6235de1-1c11a9fb.md](reports/2026-05-11-reference-grid-audio-controller-missing-guard-caused-runtime-crash-e6235de1-1c11a9fb.md) |
