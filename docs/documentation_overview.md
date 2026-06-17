# Documentation Overview And Governance

Purpose: define the documentation information architecture, ownership rules, and the quality bar for repository docs.

## Information architecture
- `docs/` root: engineering governance and cross-cutting runbooks.
- `docs/api/`: provider/API integration references.
- `docs/sops/`: operational runbooks and workflows.
- `docs/product/`: product/domain source-of-truth documents.
- `docs/systems/`: authoritative architecture/risk catalog for current systems, boundaries, architecture maturity ratings, and launch-fitness scorecards.
- `docs/planning/`: active plans, backlogs, and stabilization tracks only.
  - `docs/planning/execution-authority.md`: authoritative execution entrypoint for active programs, lane-entry rules, and planning reading priority.
  - `docs/planning/policies/`: machine-checkable policy artifacts for planning/governance enforcement.
  - `docs/planning/evidence/`: temporary physical location for retained evidence namespaces during the current cleanup transition; keep this namespace out of the primary reading path.
- `docs/records/`: retained records/evidence governance entrypoint and target namespace for evidence packets, templates, and raw artifacts.
  - `docs/records/evidence/`: migrated human-readable retained evidence namespaces.
  - `docs/records/artifacts/`: migrated raw retained artifact namespaces.
- `docs/adr/`: durable architecture decisions.
- `docs/agents/`: agent workflow helpers, execution guard aids, and task-specific agent folders with inspectable memory.
- `agent-teaching/` (repo root): standalone teaching system that mirrors the final Notion "Building AI Employees" curriculum for reusable agent onboarding, training, KPI baselines, automation, and maintenance guidance.
- `docs/design/`: design rationale used by implementation.
- `docs/archive/`: historical or superseded docs (non-authoritative).
- `docs/brainstorming/`: early ideas and exploratory notes (non-authoritative).
- `mini-ecosystem/` (repo root): standalone operational role-based workflow system and performable-core contracts, intentionally separate from `docs/planning/`.

## Document authority levels
1. Authoritative:
- ADRs, SOPs, schema/security docs, route maps, deployment/migration runbooks, and the systems catalog.

2. Working:
- Planning docs and backlogs under `docs/planning/`.
- Standalone operational system docs under `mini-ecosystem/` (separate entity with no runtime activation by default).

3. Records:
- Files retained for evidence, validation history, rollback context, and raw artifact preservation.
- Records support active docs but do not replace them as current truth.

4. Historical:
- Files in `docs/archive/` and `docs/brainstorming/`.
- Historical docs are non-authoritative for naming/terminology canonicalization unless explicitly designated by a migration plan.

## Lifecycle states and archive policy
- `Active`: current source-of-truth docs used for implementation/operations.
- `Working`: in-flight plans and execution artifacts under `docs/planning/`.
  - Default readers should start with `docs/planning/execution-authority.md` and `docs/planning/backlog.md`, not the full planning corpus.
- `Archived`: superseded or historical docs under `docs/archive/` only.

Working-doc metadata:
- Active planning docs should use the normalized status vocabulary: `draft`, `active`, `complete`, `superseded`, or `archived`.
- Docs marked `superseded`, `complete`, `historical`, `temporary`, `dormant`, or `reference only` do not belong in active planning indexes.

Records policy:
- Use `docs/records/README.md` as the retained-records entrypoint.
- Prefer namespace indexes and summary packets over raw payload links in top-level reading paths.
- Raw logs, JSON exports, and other machine-generated artifacts belong in the records model, not the active planning reading path.

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
- `docs/systems/` remains indexed and aligned with `docs/operator-map.md` and the active docs taxonomy.
- The top-level reading path points readers to records entrypoints instead of raw retained evidence payloads.
- Cross-doc links point to existing files.
- Durable decisions are captured in ADRs, not only planning docs.
- Superseded docs are moved to `docs/archive/` and no longer treated as source of truth.

## Update triggers
- Route/UI behavior changes: update `README.md`, `docs/routes.md`, and relevant SOPs.
- Supabase schema/storage/policy changes: update `docs/supabase_full_schema.sql`, `docs/data-dictionary.md`, `docs/security-checklist.md`, and migration docs.
- Model/pricing/provider changes: update `docs/product/ai-studio-pricing.md`, relevant `docs/api/` references, and relevant `docs/sops/` tables.
- Architecture changes: add or update ADRs in `docs/adr/`.
- System boundary or rating-model changes: update `docs/systems/`, `docs/documentation_overview.md`, and `docs/README.md`.
- Planning readiness-governance changes (state model, gate semantics, immediate-start SLA): update `docs/planning/README.md`, `docs/documentation_overview.md`, and `docs/change_log.md`.
- Planning portfolio or lane-entry changes: update `docs/planning/execution-authority.md`, `docs/planning/README.md`, and `docs/planning/backlog.md`.
- Behavior-changing planning programs: require and index a readiness-state doc plus implementation-entry checklist before implementation starts.

## Current coverage status
Covered after this cleanup:
- Structured taxonomy for API/SOP/Product/Planning/Archive docs.
- Structured taxonomy for API/SOP/Product/Systems/Planning/Archive docs.
- Unique ADR numbering with index parity.
- Monitoring, disaster recovery, and performance operations baseline docs.

Remaining improvement opportunities:
- Add explicit owner/review cadence metadata for high-churn docs.
- Extend docs-index drift checks to cover `docs/agents/` and `docs/planning/policies/` inventories explicitly.
- Migrate retained evidence physically from `docs/planning/evidence/` into the `docs/records/` namespace in indexed batches.
