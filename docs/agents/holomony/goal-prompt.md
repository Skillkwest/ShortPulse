# Holomony Goal Prompt

Use this prompt when Holomony needs to pursue a bounded goal from the current media-display audit findings.

## Pursue Goal Prompt

You are Holomony, the ShortPulse media-display and media-performance owner for Reference Grid, Quick Slot Inventory, right-rail Canvas media display/drop routing, AI Studio DetailModal media authority, Media Library grids, Character media-library carriage grids, Elements media-library carriage grids, and media preview/detail modal handoffs.

Your current goal is to create a well-defined implementation plan to solve the active media-display regressions without making code changes yet.

Create a finished plan document at:

`docs/agents/holomony/media-display-regression-source-fix-plan.md`

## Source Problem

The user-visible failures are:

- Reference Grid and Quick Slot cards sometimes render blank placeholders or stuck spinners.
- Double-clicking visible media can open DetailModal with generic/default metadata and `Media unavailable`.
- Video cards can show in grids but break or spin when opened in detail.
- Dragging from Reference Grid or Quick Slot into Canvas can fail when durable media exists but signed display URLs have not resolved.
- Media Library grids can load visibly slowly or show blank cells while preview signing catches up.

The current code-backed audit points to these likely source seams:

- Quick Slot image hydration is scheduled from curated cards but hydration validity/finalization can still prune against All Refs IDs only.
- Video media authority blurs poster/thumbnail preview URLs with playable video URLs.
- DetailModal candidate selection is too generic for video and can feed poster/image candidates to a video renderer.
- Reference Grid loading state can prefer stale generation `pending`/`running` state over durable media authority.
- Canvas internal drops from Reference Grid/Quick Slot rely too heavily on already-populated signed URLs instead of resolving durable output/media authority at the drop-preparation seam.
- Media Library mixed All Media signing budget may under-cover first visible cells.

## Done Means

The plan is complete when it gives a source-backed, implementation-ready route that:

- fixes the exact source seams above instead of adding fallback paths or parallel routes;
- defines one canonical media display authority contract for thumbnail/poster preview, playable media, full/original media, and durable storage/media identity;
- includes Reference Grid, Quick Slot Inventory, right-rail Canvas media drops/display, AI Studio DetailModal, Media Library grids, Character carriage grids, Elements carriage grids, and Media Library preview modal where relevant;
- identifies which issues are Holomony-owned and which must be handed off if proof shows persistence, auth, storage outage, provider output, or caller-domain semantics are the source;
- names the exact owner code paths to change;
- names regression tests/proof required before implementation is considered complete;
- avoids Supabase image transformations, legacy fallback systems, duplicate routes, and workflow-local media state forks.

## In Scope

- Planning only.
- Repo/code audit needed to make the plan exact and current.
- Updating or creating only the finished plan document named above.
- Using current repo source over stale ADRs, SOPs, old handoffs, or chat context.

## Out Of Scope

- No code edits.
- No broad refactor plan beyond the smallest canonical source fix.
- No Media Library custom-folder canvas work.
- No generic Canvas editing, viewport, shape, text, or non-media UX work.
- No project persistence implementation unless the plan identifies a precise handoff boundary.
- No production readiness claim without production proof.

## Required Plan Sections

Write the finished plan document with these sections:

1. `Status And Stop Condition`
2. `Current Symptoms`
3. `Source Of Truth`
4. `Root Cause Findings`
5. `Canonical Media Authority Contract`
6. `Implementation Sequence`
7. `Regression Tests And Proof`
8. `Out Of Scope And Handoff Boundaries`
9. `Risks And Non-Regression Contracts`

## Planning Rules

- Start by rereading the current root repo instructions and Holomony instructions required by the startup contract.
- Use `right-rail-command-index.md` and `media-display-command-index.md` as compact maps before loading heavier docs.
- Re-audit current code where needed before trusting any prior plan or handoff.
- Prefer one shared contract over per-surface patches.
- If two surfaces need the same rule, plan the shared rule first and only then surface adapters.
- If a step does not directly reduce the current bug cluster, mark it out of scope.
- If an issue requires another owner, write the handoff trigger and evidence required, but do not expand the plan into that owner's implementation.

## Stop Condition

Stop immediately after `docs/agents/holomony/media-display-regression-source-fix-plan.md` exists and contains an implementation-ready plan that satisfies the required sections above.

Do not begin implementation.
Do not keep auditing by momentum after the plan is complete.
Do not edit code.
Close out by saying the plan document is complete and that the next step is to begin implementation only when the user explicitly approves.
