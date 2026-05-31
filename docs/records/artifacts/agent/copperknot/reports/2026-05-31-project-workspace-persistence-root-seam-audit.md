# Copperknot May 31 Project / Workspace Persistence Root-Seam Audit

Purpose: identify the highest-ROI remaining source seam keeping `Project / workspace persistence` below floor before any new execution lane is dispatched.

## System

- `Project / workspace persistence`
- current score: `6/10`
- ship floor: `7/10`
- queue status: exact next after the `2026-05-31` approved-panel post-deploy verification

## Audit Scope

Code surfaces inspected:

- `frontend/lib/server/projectWorkspaceStatesService.ts`
- `frontend/lib/server/projectGenerationAssociationsService.ts`
- `frontend/lib/server/projectsService.ts`
- `frontend/pages/api/projects/[...projectPath].ts`
- `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts`
- `frontend/lib/server/__tests__/projectGenerationAssociationsService.test.ts`

Authority references:

- `docs/sops/sop_ai_studio_projects_foundation.md`
- `docs/adr/0062-project-identity-foundation.md`
- `docs/adr/0063-project-workspace-authority.md`
- `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`
- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-16-project-workspace-persistence-hardening-closeout.md`

## Main Finding

The current highest-ROI remaining source seam is the read-time ownership-sanitization fallback in `projectWorkspaceStatesService`.

Today, `canonicalizeProjectWorkspaceSnapshotForRead(...)` attempts full ownership sanitization, but if owned-id resolution fails it:

1. logs a warning
2. writes telemetry
3. returns the shape-sanitized snapshot anyway

That means restore can stay structurally valid while still preserving snapshot rows that were not fully re-verified against owned generation/media/prompt authority at read time.

## Evidence

Source seam:

- `frontend/lib/server/projectWorkspaceStatesService.ts:702`
- `frontend/lib/server/projectWorkspaceStatesService.ts:729`

Current behavior:

- full ownership sanitization path runs first
- catch path returns `baseSanitizedSnapshot`
- catch path message:
  - `"[project-workspace] read sanitization failed; returning shape-sanitized snapshot"`

Test proof:

- `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts:1679`
- the current test explicitly expects the read path to return generation rows even when ownership resolution fails

## Why This Matters

This is exactly the kind of trust boundary that can keep the row below floor:

- the project route is supposed to be project-owned restore authority
- the current fallback keeps the route available, but it does not fail closed on ownership uncertainty
- that favors continuity over trust, which is the wrong bias near ship for a persistence authority surface

This is not yet proof of a user-visible bug on production, but it is a meaningful source-level weakness in the restore contract.

## Best Current Interpretation

This looks more like a `root fix` candidate than another generic seam patch because:

- the owning module is clear
- the fallback behavior is explicit and isolated
- the trust decision is concentrated in one canonical read path

The likely decision for the next execution lane should be:

- either fail closed on read-time ownership resolution failure for generated rows and related associations
- or narrow the fallback so it removes unresolved generation/prompt/media authority instead of returning the broader shape-sanitized snapshot unchanged

## Secondary Follow-Up Risk

The May 16 closeout already noted a possible one-time cleanup need for historic bad `project_generation_items` rows.

That still looks real, but it is probably a second-order follow-up behind the live read-path trust seam above.

## Queue Consequence

- no queue reorder
- no score change
- exact next remains `Project / workspace persistence`
- the next handoff should explicitly point at the read-time ownership-sanitization fallback as the first candidate source seam to audit/fix

## Recommended Next Step

Use the existing persistence handoff, but sharpen execution around:

- `canonicalizeProjectWorkspaceSnapshotForRead(...)`
- read-time ownership verification failure behavior
- whether the canonical restore path should fail closed or partially degrade while preserving only fully re-verified rows
