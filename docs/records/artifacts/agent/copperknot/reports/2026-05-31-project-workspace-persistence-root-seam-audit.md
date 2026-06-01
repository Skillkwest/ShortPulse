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

The current highest-ROI remaining source seam is the read-time generated-output restore predicate in `projectWorkspaceStatesService`.

Today, read canonicalization is stricter than the older broad fallback suggested, but it still has one exact blind spot:

1. `collectSnapshotGenerationIds(...)` only resolves generation ownership for rows that still carry a `generationId`
2. `sanitizeProjectWorkspaceOutputs(...)` only drops rows when a disallowed `generationId` is still present
3. a row can therefore survive if it still presents as generated output but has already lost `generationId`, `promptId`, and `savedMediaIds`

That means restore can stay structurally valid while still preserving one orphan generated-output class that is no longer backed by any durable project-owned association anchor.

## Evidence

Source seam:

- `frontend/lib/server/projectWorkspaceStatesService.ts:702`
- `frontend/lib/server/projectWorkspaceStatesService.ts:729`

Current behavior:

- read canonicalization first shape-sanitizes the snapshot
- owned media/prompt/generation ids are then resolved from the remaining snapshot rows
- generated rows are dropped when they still carry a disallowed `generationId`
- a shape-valid generated row can still survive if it has already lost every durable association field before owned-id filtering runs

Test proof:

- `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts:2234`
  - malformed generated rows are dropped when the bad `generationId` is still present
- `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts:1788`
  - unrelated generation-ownership failure already degrades generated rows out while preserving valid media-backed rows
- no current read-path test yet covers the narrower orphan class where a generated row has already lost `generationId`, `promptId`, and `savedMediaIds` but still looks displayable
- `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`
  - current project snapshot persistence already distinguishes:
    - durable output authority
    - recoverable runtime identity via `generationId`, `taskId`, or `sourceRef`
  - `shouldPersistOutputInProjectWorkspaceSnapshot(...)` already defines the write-time keep/drop contract for project workspace outputs
- `frontend/features/ai-studio/logic/referenceOutputAuthority.ts`
  - current UI logic still treats `mediaSource === "generated"` as enough to classify a row as generated output for preview-policy purposes
- `frontend/features/ai-studio/logic/__tests__/sessionSnapshot.test.ts:1912`
  - existing write-path tests already prove the intended contract: local-only upload refs are dropped while durable or recoverable generated outputs are kept

## Why This Matters

This is exactly the kind of trust boundary that can keep the row below floor:

- the project route is supposed to be project-owned restore authority
- the current read path fails closed on several bad-state classes already, but it does not yet fail closed on this exact orphan generated-row shape
- that means the route can still preserve one stale generated-output class without durable authority, which is the wrong bias near ship for a persistence authority surface
- the likely source mistake is that restore-time persistence truth is still broader than the existing project-owned write contract, and may be implicitly inheriting the looser UI notion of a previewable generated row

This is no longer just a theoretical weakness: the production persistence audit exposed this orphan generated-output class directly.

## Best Current Interpretation

This looks more like a `root fix` candidate than another generic seam patch because:

- the owning module is clear
- the missing fail-closed predicate is concentrated in one canonical read path
- the needed correction is likely a predicate/source-truth clarification, not a new parallel path

The likely decision for the next execution lane should be:

- fail closed on rows that still present as generated output when they no longer carry any durable project-owned association anchor
- keep the distinction clear between:
  - a row that is still previewable in the live UI
  - a row that is safe to preserve in project-owned restore state
- align the read path with the existing write-time `shouldPersistOutputInProjectWorkspaceSnapshot(...)` contract if practical
- and add a direct regression test for that exact orphan-row shape

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

- `sanitizeProjectWorkspaceOutputs(...)`
- inner `sanitizeRows(...)`
- the exact predicate for when a row still counts as generated output after `generationId` is already gone
- a read-path regression test for the orphan generated-output class seen on production
