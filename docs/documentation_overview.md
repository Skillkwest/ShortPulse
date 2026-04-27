# Documentation Overview And Governance

Purpose: define the documentation information architecture, ownership rules, and the quality bar for repository docs.

## Information architecture
- `docs/` root: engineering governance and cross-cutting runbooks.
- `docs/api/`: provider/API integration references.
- `docs/sops/`: operational runbooks and workflows.
- `docs/product/`: product/domain source-of-truth documents.
- `docs/planning/`: active plans, backlogs, and stabilization tracks only.
  - `docs/planning/policies/`: machine-checkable policy artifacts for planning/governance enforcement.
  - `docs/planning/evidence/`: retained evidence namespaces and packet records for phase gates, promote/hold/rollback decisions, and closeout signoff. During the current cleanup transition, keep this namespace out of the primary reading path even while the evidence files remain preserved here.
- `docs/adr/`: durable architecture decisions.
- `docs/agents/`: agent workflow helpers and execution guard aids.
- `docs/design/`: design rationale used by implementation.
- `docs/archive/`: historical or superseded docs (non-authoritative).
- `docs/brainstorming/`: early ideas and exploratory notes (non-authoritative).
- `mini-ecosystem/` (repo root): standalone operational role-based workflow system and performable-core contracts, intentionally separate from `docs/planning/`.

## Document authority levels
1. Authoritative:
- ADRs, SOPs, schema/security docs, route maps, deployment/migration runbooks.

2. Working:
- Planning docs and backlogs under `docs/planning/`.
- Standalone operational system docs under `mini-ecosystem/` (separate entity with no runtime activation by default).

3. Historical:
- Files in `docs/archive/` and `docs/brainstorming/`.
- Historical docs are non-authoritative for naming/terminology canonicalization unless explicitly designated by a migration plan.

## Lifecycle states and archive policy
- `Active`: current source-of-truth docs used for implementation/operations.
- `Working`: in-flight plans and execution artifacts under `docs/planning/`.
- `Archived`: superseded or historical docs under `docs/archive/` only.

Working-doc metadata:
- Active planning docs should use the normalized status vocabulary: `draft`, `active`, `complete`, `superseded`, or `archived`.
- Docs marked `superseded`, `complete`, `historical`, `temporary`, `dormant`, or `reference only` do not belong in active planning indexes.

Archive requirements:
- Move superseded docs into `docs/archive/` (use subfolders like `docs/archive/planning/`, `docs/archive/sops/`, and `docs/archive/product/` when helpful).
- Add an explicit archive note at the top of archived docs (for example: moved date + superseded-by path).
- Keep `Status: Legacy` markers only in files under `docs/archive/`.
- Update `docs/README.md` and all affected section indexes when docs move (for example `docs/planning/README.md`, `docs/archive/README.md`, `docs/product/README.md`, and `docs/design/README.md`).
- Controlled exception: source-plan evidence for governance synthesis may live under `docs/planning/archive/original-plans/` with manifest + checksum validation.

## Done state for docs cleanup
A docs cleanup is complete when all are true:
- Every doc is in the correct category folder.
- `docs/README.md` and any section README indexes are updated.
- `docs/planning/` contains only genuinely active working docs.
- Cross-doc links point to existing files.
- Durable decisions are captured in ADRs, not only planning docs.
- Superseded docs are moved to `docs/archive/` and no longer treated as source of truth.

## Update triggers
- Route/UI behavior changes: update `README.md`, `docs/routes.md`, and relevant SOPs.
- Supabase schema/storage/policy changes: update `docs/supabase_full_schema.sql`, `docs/data-dictionary.md`, `docs/security-checklist.md`, and migration docs.
- Model/pricing/provider changes: update `docs/product/ai-studio-pricing.md`, relevant `docs/api/` references, and relevant `docs/sops/` tables.
- Architecture changes: add or update ADRs in `docs/adr/`.
- Planning readiness-governance changes (state model, gate semantics, immediate-start SLA): update `docs/planning/README.md`, `docs/documentation_overview.md`, and `docs/change_log.md`.
- Behavior-changing planning programs: require and index a readiness-state doc plus implementation-entry checklist before implementation starts.

## Current coverage status
Covered after this cleanup:
- Structured taxonomy for API/SOP/Product/Planning/Archive docs.
- Unique ADR numbering with index parity.
- Monitoring, disaster recovery, and performance operations baseline docs.

Remaining improvement opportunities:
- Add explicit owner/review cadence metadata for high-churn docs.
- Extend docs-index drift checks to cover `docs/agents/` and `docs/planning/policies/` inventories explicitly.
