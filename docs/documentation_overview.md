# Documentation Overview And Governance

Purpose: define the documentation information architecture, ownership rules, and the quality bar for repository docs.

## Information architecture
- `docs/` root: engineering governance and cross-cutting runbooks.
- `docs/api/`: provider/API integration references.
- `docs/sops/`: operational runbooks and workflows.
- `docs/product/`: product/domain source-of-truth documents.
- `docs/planning/`: active plans, backlogs, and stabilization tracks.
- `docs/adr/`: durable architecture decisions.
- `docs/design/`: design rationale used by implementation.
- `docs/archive/`: historical or superseded docs (non-authoritative).
- `docs/brainstorming/`: early ideas and exploratory notes (non-authoritative).

## Document authority levels
1. Authoritative:
- ADRs, SOPs, schema/security docs, route maps, deployment/migration runbooks.

2. Working:
- Planning docs and backlogs under `docs/planning/`.

3. Historical:
- Files in `docs/archive/` and `docs/brainstorming/`.

## Lifecycle states and archive policy
- `Active`: current source-of-truth docs used for implementation/operations.
- `Working`: in-flight plans and execution artifacts under `docs/planning/`.
- `Archived`: superseded or historical docs under `docs/archive/` only.

Archive requirements:
- Move superseded docs into `docs/archive/` (use subfolders like `docs/archive/sops/` and `docs/archive/product/` when helpful).
- Add an explicit archive note at the top of archived docs (for example: moved date + superseded-by path).
- Keep `Status: Legacy` markers only in files under `docs/archive/`.
- Update `docs/README.md` and relevant section indexes when docs move.

## Done state for docs cleanup
A docs cleanup is complete when all are true:
- Every doc is in the correct category folder.
- `docs/README.md` and any section README indexes are updated.
- Cross-doc links point to existing files.
- Durable decisions are captured in ADRs, not only planning docs.
- Superseded docs are moved to `docs/archive/` and no longer treated as source of truth.

## Update triggers
- Route/UI behavior changes: update `README.md`, `docs/routes.md`, and relevant SOPs.
- Supabase schema/storage/policy changes: update `docs/supabase_full_schema.sql`, `docs/data-dictionary.md`, `docs/security-checklist.md`, and migration docs.
- Model/pricing/provider changes: update `docs/product/ai-studio-pricing.md`, relevant `docs/api/` references, and relevant `docs/sops/` tables.
- Architecture changes: add or update ADRs in `docs/adr/`.

## Current coverage status
Covered after this cleanup:
- Structured taxonomy for API/SOP/Product/Planning/Archive docs.
- Unique ADR numbering with index parity.
- Monitoring, disaster recovery, and performance operations baseline docs.

Remaining improvement opportunities:
- Add explicit owner/review cadence metadata for high-churn docs.
- Add contract validation between documented route inventories and `frontend/pages/api/*` to catch drift automatically.
