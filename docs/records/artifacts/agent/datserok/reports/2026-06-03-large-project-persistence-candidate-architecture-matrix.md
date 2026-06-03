# Large Project Persistence: Candidate Architecture Matrix

Date: 2026-06-03

Purpose: compare the main architecture families that still look viable after the current-state repo audit, production workload measurement, and targeted external pattern research.

This is a prep-lane comparison tool, not a final ADR.

## Scoring Rubric

Each candidate is scored qualitatively across the dimensions that matter most for the confirmed ShortPulse workload:

1. save scalability for very large output-heavy projects
2. restore/read scalability
3. fit with current ShortPulse invariants
4. migration risk
5. operational complexity
6. observability and debuggability
7. leverage of existing repo foundations

Score guide:

- `High` = strong fit
- `Medium` = workable but materially mixed
- `Low` = weak fit for the target problem

## Candidate 1: Improved Checkpoint-Only Persistence

Definition:

- Keep `project_workspace_states` as the hot source-of-truth write unit.
- Optimize around it with better compression, smarter field trimming, maybe more selective restore loading, and further route-level tuning.

Assessment:

- save scalability: `Low`
- restore/read scalability: `Low`
- fit with invariants: `High`
- migration risk: `High`
- operational complexity: `Medium`
- observability: `Medium`
- leverage of existing repo foundations: `High`

Why it is attractive:

- Smallest conceptual change.
- Preserves almost everything about the current architecture.
- Easiest to ship incrementally.

Why it is weak:

- It does not change the core scaling law.
- Large projects still pay cost roughly proportional to whole-project workspace size.
- It keeps `outputs.active` trapped inside the hot checkpoint write unit.
- It risks becoming a long series of local optimizations around a model that is wrong for outliers.

Judgment:

- good fallback only if the lane decides the measured outliers are not important
- current production evidence does not support that conclusion

## Candidate 2: Checkpoint Plus Append-Only Workspace Revision Journal

Definition:

- Keep a durable workspace checkpoint for bootstrap restore.
- Add an ordered project revision log as the hot write lane.
- Periodically compact revisions into a new checkpoint.
- Restore from checkpoint plus newer revisions.

Assessment:

- save scalability: `High`
- restore/read scalability: `Medium`
- fit with invariants: `High`
- migration risk: `Medium`
- operational complexity: `Medium`
- observability: `High`
- leverage of existing repo foundations: `Medium`

Why it is attractive:

- Directly attacks whole-snapshot rewrite cost.
- Matches the strongest Figma-style external pattern.
- Makes sequencing, freshness, and replay first-class.
- Gives a durable path to better save-stage telemetry.

Why it is limited:

- If revisions still carry large serialized `outputs.active` slices too often, write pressure can remain too big.
- Read cost can still drift upward if checkpoint compaction or selective replay is weak.
- By itself, it does not fully normalize the heaviest domain entities.

Judgment:

- strong candidate family
- especially good if ShortPulse wants the smallest real shift that still changes the write model

## Candidate 3: Fully Normalized Per-Entity Project Source Of Truth

Definition:

- Make outputs, quick-slot state, canvas items, prompt blocks, and similar workspace entities first-class persisted records.
- Treat the workspace view as a derived materialization instead of the primary durable write object.
- Use entity versions or revisions for incremental sync and restore.

Assessment:

- save scalability: `High`
- restore/read scalability: `High`
- fit with invariants: `Medium`
- migration risk: `Low`
- operational complexity: `Low`
- observability: `Medium`
- leverage of existing repo foundations: `Medium`

Why it is attractive:

- Best long-term scaling law.
- Heavy project state becomes incrementally writable and selectively readable.
- Fits naturally with versioned or diff-based refresh.

Why it is risky:

- Largest migration and schema expansion.
- Highest implementation surface area.
- Most likely to disturb current restore semantics if done too broadly.
- ShortPulse is not starting from a fully record-native workspace model today.

Judgment:

- architecturally powerful
- probably too disruptive as the first large-project persistence rebuild unless the lane decides to absorb a major migration

## Candidate 4: Hybrid Split Model

Definition:

- Keep a lightweight project workspace checkpoint for restore shell and stable UI structure.
- Move the heaviest output-centric state out of the monolithic snapshot hot path into incrementally versioned or revisioned records.
- Preserve additive association tables and projection refresh, but promote them into a more central role.
- Allow restore to combine:
  - lightweight checkpoint bootstrap,
  - targeted output/materialization refresh,
  - and newer revisions where needed.

Assessment:

- save scalability: `High`
- restore/read scalability: `High`
- fit with invariants: `High`
- migration risk: `Medium`
- operational complexity: `Medium`
- observability: `High`
- leverage of existing repo foundations: `High`

Why it is attractive:

- It matches the measured truth that `outputs.active` is the dominant pressure source.
- It preserves the current useful split already visible in the repo:
  - workspace checkpoint,
  - additive project associations,
  - async generated-output projection refresh.
- It avoids forcing every workspace concern into a giant normalization effort on day one.
- It is easier to migrate incrementally than a full record-native rewrite, but still changes the scaling law where it matters most.

Why it is hard:

- It requires very disciplined boundary design so “lightweight checkpoint” stays lightweight.
- The split between checkpoint-owned state and output/materialization-owned state must be explicit and stable.
- It can become messy if the ownership map is vague.

Judgment:

- best current fit
- most aligned with both the repo's present foundations and the measured hotspot

## Comparative Summary

### What looks weakest

The weakest direction is Candidate 1.

Reason:

- it preserves the exact hot write unit that is already under pressure
- and asks tuning to solve what looks like a model problem

### What looks strongest

The strongest current direction is Candidate 4, with Candidate 2 as the cleanest simpler alternative.

Why Candidate 4 currently leads:

- the production hotspot is specifically output-heavy, not evenly spread across all workspace state
- the repo already has partial separation between:
  - checkpoint workspace restore
  - normalized project membership
  - generated-output refresh/materialization
- the external research strongly favors incremental writes plus derived or selective reads

Why Candidate 2 remains important:

- if the lane wants the smallest architecture shift that still changes the write law, checkpoint plus revision journal is the cleanest simpler option
- it may also be a component of Candidate 4 rather than a competing final choice

## Current Recommendation

The leading path to take into the next decision pass is:

1. design around a hybrid split model
2. assume the hot `outputs.active` seam should move out of whole-snapshot rewrite semantics
3. decide whether the incremental layer under that split is best expressed as:
   - append-only project revisions,
   - per-entity versioned records,
   - or a hybrid of both

That is the next architecture question worth answering.

## What To Decide Next

The next design pass should answer these specific questions:

1. What exact project state remains in the lightweight checkpoint?
2. What exact output-centric state moves to incremental records or revisions?
3. Does the incremental layer use:
   - one ordered project revision stream,
   - entity-level versions,
   - or both?
4. What does restore load first, and what can be streamed or refreshed after first paint?
5. How do current sanitization and fail-closed guarantees survive the split?
