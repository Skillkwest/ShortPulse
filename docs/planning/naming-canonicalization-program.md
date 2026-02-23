# Naming Canonicalization Program

Status: Active  
Owner: Frontend + Docs Governance  
Start date: 2026-02-23

Purpose: deliver a zero-regression naming canonicalization program using parallel change (`expand -> migrate -> contract`) across active docs, user-facing copy, internal symbols, and asset paths.

## Scope
- In scope:
  - AI Studio naming canonicalization (`Reference Grid`, `CreatePropertiesPanel`, workflow panel naming consistency).
  - Active documentation naming/path drift fixes.
  - Internal compatibility aliases and migration scaffolding.
  - Asset filename canonicalization with dual-path compatibility.
- Out of scope:
  - Functional behavior changes.
  - DB compatibility term removal (`reference_pack_*`) during this program.
  - Rewriting historical/archive documents for lexical parity.

## Canonical Decisions
1. Reference surface canonical name: `Reference Grid`.
2. Create panel canonical name: `CreatePropertiesPanel`.
3. Workflow panel canonical names remain `EditPropertiesPanel` and `VideoPropertiesPanel`.
4. Historical/dead docs are non-authoritative for naming decisions.
5. Asset rename strategy: dual-path compatibility before any removal.

## Program Controls
1. Parallel change only:
- Expand: add canonical names + compatibility aliases.
- Migrate: move callsites in bounded slices.
- Contract: remove aliases only after stability and approval.
2. Deprecation window:
- Minimum two release cycles before removing aliases.
- All legacy aliases must carry `@deprecated` markers and tracker entries.
3. One-domain slices:
- Each slice may touch one primary domain only (docs, UI copy, symbols, paths, assets).
4. Mandatory evidence:
- Every slice must attach an evidence artifact under `docs/planning/evidence/naming-canonicalization/`.
5. Stop-point approvals:
- Required before phase transitions and before any contraction/deletion.

## Phase Matrix

### Phase 0: Baseline Freeze
- Build term inventory for active scope.
- Capture baseline non-inferiority gates:
  - `npm -C frontend run validate`
  - `npm -C frontend run test:adaptive-v2-gate`
  - `npm -C frontend run perf:ai-studio:release-check`
  - `npm -C frontend run docs:check`
- Publish baseline evidence.

### Phase 1: Active Docs Canonicalization
- Correct active SOP/architecture path drift.
- Standardize active doc language to `Reference Grid`.
- Mark archive docs as non-authoritative for naming audits.

### Phase 2: User-Facing Copy Canonicalization
- Align visible UI copy with canonical terms.
- Preserve behavior and layout.

### Phase 3: Bridge Layer (Expand)
- Add canonical exports/types for `ReferenceGrid*` and `CreatePropertiesPanel`.
- Preserve legacy aliases with `@deprecated` markers.

### Phase 4: Callsite Migration (Migrate)
- Migrate import/callsites in bounded slices.
- Dry-run migration transforms before real writes.

### Phase 5: File/Path Renames
- Rename files in minimal batches.
- Keep re-export shims until all imports converge.

### Phase 6: Asset Canonicalization
- Add canonical kebab-case/lowercase assets.
- Keep legacy filenames during compatibility window.

### Phase 7: Alias Sunset (Contract)
- Remove deprecated aliases only after two release cycles and explicit approval.

## Completion Criteria
1. Active docs use canonical naming and valid file references.
2. User-facing naming is canonical and behavior-equivalent.
3. Internal naming converges to canonical symbols with no regressions.
4. Deprecated aliases removed only after stability window and approval.
5. Evidence exists for each slice and final closeout.

## Current Execution Snapshot (2026-02-23)
1. Phase 1 completed with active docs canonicalization evidence recorded.
2. Phase 2 completed with user-facing copy canonicalization evidence recorded.
3. Phase 3 completed with bridge-layer aliases/shim files in code.
4. Phase 4 completed with bounded callsite migration slices A-G and closeout audit.
5. Phase 5 is in progress; batches A-C completed (reference-grid component + drop-controller path canonicalization with shims, plus canonical test file path/script alignment).
6. Perf release-check gate is currently blocked by missing `PLAYWRIGHT_AUDIT_EMAIL` in local environment.
