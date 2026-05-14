# Lever Run Log

Purpose: keep an append-only ledger of substantive Lever runs so model maintenance work remains traceable and reusable as training data.

## Usage

- Append one row for every substantive add/reverify/retire/remove run.
- Link the corresponding full report when one exists.
- Keep entries concise and factual.

| Date | Run Type | Model(s) | Outcome | Validation | Report |
| --- | --- | --- | --- | --- | --- |
| 2026-05-11 | retirement | `kie-ai/seedance-1.5-pro` | Deprecated with replacement to `kie-ai/seedance-2`; visible app residue removed; compatibility route/docs retained | Focused AI Studio/runtime tests, `npm -C frontend run model:doctor` | Pending first Lever report backfill |
| 2026-05-13 | residue audit | `kie-ai/seedance-1.5-pro` | Removed remaining active wording from compatibility-only UI label and top-level docs; compatibility runtime references intentionally retained | Focused UI tests, `node scripts/check_docs_links.js` | `docs/records/artifacts/agent/lever/reports/2026-05-13-seedance-1-5-residue-audit.md` |
| 2026-05-13 | hard removal | `kie-ai/seedance-1.5-pro` | Removed active catalog/runtime/pricing/route/test/doc support; only historical records remain | Focused video/runtime/provider tests, `node scripts/model_doctor.js`, `node scripts/check_docs_links.js`, `npm -C frontend run fal:routes:check` | `docs/records/artifacts/agent/lever/reports/2026-05-13-seedance-1-5-hard-removal.md` |
