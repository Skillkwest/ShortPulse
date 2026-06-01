# Gear Ball Performance Scorecard

Purpose: score one substantive Gear Ball SOP run consistently out of `10.0`.

## Scoring Method

Score each category from `0.0` to its maximum.
Total possible: `10.0`.
This is an execution score, not a paperwork score.

## Categories

### 1. Scope control (`2.0`)

- `2.0`: full live tree classified correctly; lanes coherent; adjacent tails deferred explicitly.
- `1.0`: mostly right, but one lane was broader/noisier than needed or one real leftover needed late classification.
- `0.0`: unrelated work absorbed, real changes left unclassified, or intended lane lost.

### 2. Validation discipline (`2.0`)

- `2.0`: cheapest honest ladder, real failures caught early, publish based on the exact final tree.
- `1.0`: mostly right, but one stale rerun, underreaching first manifest, or unnecessary heavy rung.
- `0.0`: completion claimed on stale or insufficient validation.

### 3. Commit and leftover discipline (`1.5`)

- `1.5`: staged only the intended batch, kept git writes serialized, and handled post-commit leftovers cleanly.
- `0.75`: one commit boundary got noisy or required extra cleanup passes.
- `0.0`: leftover or staging confusion materially hurt the run.

### 4. Time-to-clean-push efficiency (`1.5`)

- `1.5`: moved from inventory to clean push with little avoidable delay.
- `0.75`: safe but slower than necessary because of repeated rereads, manifest misses, or preventable process friction.
- `0.0`: dragged materially due to avoidable workflow mistakes.

### 5. Operational judgment (`1.5`)

- `1.5`: good calls on branch discipline, stop conditions, tooling limits, and what to defer.
- `0.75`: one judgment call was safe but not sharp.
- `0.0`: poor operational choices or unjustified assumptions.

### 6. Communication integrity (`0.75`)

- `0.75`: status was plain, verification limits were explicit, suggestions stayed in-lane, and completion language matched tool-confirmed reality.
- `0.4`: mostly clear, but some status or verification language was fuzzy.
- `0.0`: overstated certainty or blurred validation status.

### 7. Training capture (`0.75`)

- `0.75`: compact score loop captured; broader retained updates added only when the lesson was new or the score was below target.
- `0.4`: some retained learning was captured, but the per-run score loop or the score-lift writeback was incomplete.
- `0.0`: training capture was skipped when it should have happened.

## Hard Gates

- stale validation after a blocking fix: cap `6.9`
- repeated unrelated-tail absorption on unstable mixed trees: cap `8.4`
- late live-tree tail that should have been in the first manifest: cap `8.2`
- two or more distinct preventable correction cycles across manifest, toolchain, or test-contract seams: cap `7.9`
- `scope control + validation discipline + time-to-clean-push efficiency < 3.5`: cap `7.9`
- false verification claim when smoke/visual QA was unavailable: cap `6.9`
- false completion claim before tool confirmation: cap `6.4`
- partial-worktree SOP claim: cap `7.2`
- stale final-report snapshot that omits still-live repo-backed work: cap `8.2`
- early score-loop writeback before lane convergence: cap `8.0`

## Confidence Tag

- `high`: evidence and self-audit are strong
- `medium`: one part of the score depends on judgment
- `low`: the run was too partial or noisy for a stable score

## Interpretation

- `9.0 - 10.0`: very clean first-pass control; little or no tail-chasing; repeatable
- `8.0 - 8.9`: good run with one contained correction pattern
- `7.0 - 7.9`: successful recovery run with multiple preventable misses
- `below 7.0`: weak run; process correction needed before repeating the pattern

## Ledger Rule

Each substantive run appends one concise row to:
- `docs/records/artifacts/agent/gear-ball/performance-ledger.md`

Include:
- date
- run label
- total score
- confidence
- what went right
- what went wrong
- smallest mechanical improvement

## Improvement Rule

For every substantive run, record:
- what went right
- what went wrong
- the smallest mechanical score-lift change

When a run scores below `9.0`, also record:
- the weakest category
- whether the fix belongs in a helper, checklist, SOP, or training note

Score based on control quality, not just eventual success. If the tree shipped correctly only after multiple preventable recoveries, the score should stay in the `7.x` band even when the final push is clean.

Keep this compact. Rewrite broader training surfaces only when the lesson is new.
If the same weakest category appears in `3` consecutive substantive runs, escalate to one concrete system fix.
