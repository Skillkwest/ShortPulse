# Copperknot Checkpoint Scratchpad - 2026-06-20

Lane: Copperknot behavior/SOP/goal prompt performance tuning.

Touched:

- `docs/agents/copperknot/AGENTS.md`
- `docs/agents/copperknot/standard-operating-procedure.md`
- `docs/agents/copperknot/goal-prompt.md`
- `docs/agents/copperknot/measurement-and-learning.md`

Change:

- Re-centered Copperknot on direct execution by default when the source seam is clear, files are clean or assigned, behavior is preserved, and validation is bounded.
- Narrowed handoffs to true gates: active owner conflict, documented external authority, broad architecture redesign, UI/UX/behavior change, credentials/spend/release gate, or repeated fix-regression churn.
- Updated the review system so Copperknot scores direct ownership and learns from unnecessary coordination/handoff behavior.

Validation:

- `git diff --check` for touched Copperknot instruction files: pass.
- Goal prompt embedded text length check: pass at 3,995 characters.
- `npm -C frontend run docs:check`: pass.

Boundary:

- Behavior/instruction docs only. No app code, UI, UX, behavior, SQL, or production runtime changes.
