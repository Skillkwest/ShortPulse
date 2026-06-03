# Large Project Persistence: External Pattern Memo

Date: 2026-06-03

Purpose: capture targeted external pattern research for the large-project persistence architecture lane after the current ShortPulse repo and production workload shape were measured.

This memo is intentionally selective. It focuses on primary-source patterns that are relevant to ShortPulse's confirmed pressure shape:

- a small number of very large outlier projects,
- `outputs.active` dominating workspace payload mass,
- near-full snapshot autosave on the hot path,
- and user-visible read/write cost already rising with project size.

## What Mature Systems Commonly Do

Across the strongest primary sources reviewed for this lane, the pattern is consistent:

1. They do not treat every user change as a whole-document rewrite.
2. They separate durable coarse checkpoints from finer-grained incremental change flow.
3. They keep the server authoritative, but they move the hot write unit closer to the size of the change.
4. They compute or materialize derived client views from smaller authoritative units instead of persisting one giant UI document on every save.
5. They usually add explicit versioning, sequencing, or per-entity change tracking so both save and restore can scale predictably.

That overall shape strongly matches the direction already implied by the current ShortPulse repo.

## Primary Source Patterns

### 1. Figma: checkpoint plus journal

Primary sources:

- [Making multiplayer more reliable](https://www.figma.com/blog/making-multiplayer-more-reliable/)
- [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
- [Improving Performance with Incremental Frame Loading](https://www.figma.com/blog/incremental-frame-loading/)

Relevant pattern:

- Figma originally relied on periodic whole-file checkpoints.
- They explicitly call out the downside: checkpoint writes scale with the size and complexity of the entire file.
- They added a journal / transaction log of incremental changes, each with a sequence number.
- Checkpoints remain useful, but recovery and persistence reliability improve because the hot write path is incremental.
- They also evolved read behavior toward piecewise loading instead of loading the entire file at once when only part is needed.

Why this matters for ShortPulse:

- This is the clearest external validation that full-checkpoint persistence alone becomes a bad fit for very large long-lived workspaces.
- ShortPulse's current large-project pressure is also dominated by “entire workspace row” cost, especially from `outputs.active`.
- The Figma pattern suggests a strong candidate direction:
  - keep checkpoints,
  - add a revision or journal layer,
  - and allow restore/load to become more selective over time.

Important caution:

- Figma is multiplayer-first and far more concurrent than current ShortPulse project workspaces.
- ShortPulse should learn from the checkpoint plus journal split, not copy the whole CRDT or multiplayer system.

## 2. Notion: record-level operations, batched transactions, background derivatives

Primary source:

- [The data model behind Notion's flexibility](https://www.notion.com/blog/data-model-behind-notion)

Relevant pattern:

- Notion models content as records / blocks, not one giant persisted page blob.
- Client actions become operations grouped into transactions.
- The server loads only the relevant records, applies the transaction to an in-memory before/after picture, validates, commits the changed records, and then schedules additional derivative work in the background.
- Local persistence and queueing exist separately from canonical server acceptance.

Why this matters for ShortPulse:

- ShortPulse already has additive project membership tables and generated-output projections. That means it is not far from a more record-oriented architecture.
- Notion reinforces the idea that the durable write unit should be closer to the touched records than to the whole workspace shell.
- It also reinforces a healthy split:
  - commit authoritative core changes first,
  - schedule secondary derived work after commit.

Important caution:

- Notion's block model is more naturally normalized than ShortPulse's current workspace snapshot.
- ShortPulse would likely need a hybrid model rather than an immediate “everything becomes a row-level record” rewrite.

## 3. Linear: local queue plus sync engine, but offline conflict semantics are bounded

Primary sources:

- [Scaling the Linear Sync Engine](https://linear.app/now/scaling-the-linear-sync-engine)
- [Download Linear](https://linear.app/docs/get-the-app)

Relevant pattern:

- Linear presents real-time sync and local retry as core product behavior.
- Changes that cannot be sent are stored locally and retried after connectivity returns, even across app restarts.
- But Linear is explicit that offline mode is a failsafe, not a full no-surprises collaboration model, and they note that older offline edits can overwrite newer remote ones in some cases.

Why this matters for ShortPulse:

- The useful lesson is not “copy Linear's exact sync model.”
- The useful lesson is that mature systems often separate:
  - fast local intent capture,
  - canonical server reconciliation,
  - and explicit limits on which consistency guarantees they promise.
- For ShortPulse, this argues for making the new persistence contract explicit:
  - what is optimistic,
  - what is canonical,
  - and what ordering/conflict rules are guaranteed.

Important caution:

- Linear's public primary sources are lighter on implementation detail than Figma's and Notion's.
- Use it as a product-contract signal, not as the main architecture template.

## 4. Replicache: canonical server state plus row-versioned pull diffs

Primary sources:

- [How Replicache Works](https://doc.replicache.dev/concepts/how-it-works)
- [Row Version Strategy](https://doc.replicache.dev/strategies/row-version)

Relevant pattern:

- Replicache separates speculative local mutations from canonical server state.
- The server stays authoritative.
- Sync is incremental in both directions:
  - pushed mutations go up,
  - pull responses return patches / diffs,
  - pending local mutations are replayed over newly pulled canonical state.
- The row-version strategy tracks per-entity versions and uses a lightweight client-view record to diff what the client previously had versus what it should now have.

Why this matters for ShortPulse:

- It provides a very concrete model for what a checkpoint-plus-delta or revisioned architecture can look like without requiring every read to rebuild the world from scratch.
- The especially relevant idea is:
  - durable per-entity or per-change versioning,
  - plus a materialized client-facing view that can be diffed and refreshed incrementally.
- This could map well onto a future ShortPulse architecture where:
  - project membership and output entities become incrementally versioned,
  - project checkpoint state becomes a materialized view,
  - and large restores can be updated through change-aware fetches rather than giant rewrites.

Important caution:

- Replicache is a sync framework, not a direct drop-in for ShortPulse.
- Its value here is architectural vocabulary and proven patterns, not literal adoption.

## Pattern Translation For ShortPulse

The external research narrows the plausible good directions.

The strongest candidate family now looks like:

1. Keep a durable project checkpoint for simple restore bootstrap.
2. Introduce a revision, journal, or transaction layer so the hot write unit is incremental.
3. Move the heaviest `outputs.active` state away from “rewrite the whole workspace row” semantics.
4. Track changed entities or changed project slices with explicit versions or ordered revisions.
5. Let restore combine:
   - checkpoint bootstrap,
   - plus incremental refresh of newer or selectively loaded project state.
6. Preserve current server-authoritative sanitization and fail-closed restore behavior.

That family is much better supported than these weaker directions:

- “make the current full snapshot path faster”
- “add more snapshot fallback variants”
- “keep one giant checkpoint as the hot write unit but optimize around the edges”

## What This Research Changes

It does not yet choose the final ShortPulse architecture.

It does change the confidence level of the lane:

- a revisioned or delta-capable design is no longer just a plausible idea,
- it is now the most evidence-backed family of solutions from both:
  - ShortPulse's own measured workload,
  - and mature external patterns.

## Next Architecture Questions

The next comparison pass should score at least these candidates:

1. improved checkpoint-only persistence
2. checkpoint plus append-only revision journal
3. checkpoint plus per-entity/versioned delta model
4. hybrid materialized workspace view backed by normalized output/membership records

The key question is no longer whether ShortPulse needs something more scalable than whole-snapshot autosave for very large projects.

The key question is which incremental architecture best fits:

- current ShortPulse product invariants,
- current restore contract,
- current normalized membership foundations,
- and the solo-owner operational model.
