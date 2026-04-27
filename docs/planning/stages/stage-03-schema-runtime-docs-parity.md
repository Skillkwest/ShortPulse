# STG-03 Schema/Runtime/Docs Parity

## Summary
Align migration docs, runtime contracts, and route/auth/API documentation with current implementation.

## Checklist
- [x] Add `018` and `028` migration references to runbooks.
- [x] Document `ai_agent_conversation_state` and RPC contract in data dictionary.
- [x] Align security docs to route/proxy auth boundaries.
- [x] Resolve README architecture contradiction.
- [x] Add parity scripts and wire checks.

## Verification
- `npm -C frontend run docs:check`
- `node scripts/check_docs_semantic_drift.js`
- `node scripts/check_migration_doc_parity.js`

## Owners and validators
- Owner: Engineering
- Validator: Docs governance

## KPI
- Parity scripts report zero drift.

## Evidence
- `docs/database-migrations.md`
- `docs/sops/sop_sql_migration_operations.md`
- `docs/data-dictionary.md`
- `README.md`
- `docs/routes.md`
- `docs/security-checklist.md`
- `docs/records/evidence/docs/2026-02-20-stg-03-parity-validation.md`
