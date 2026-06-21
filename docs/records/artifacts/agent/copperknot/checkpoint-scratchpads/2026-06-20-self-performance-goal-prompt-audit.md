# 2026-06-20 Self Performance Goal Prompt Audit

- Touched `docs/agents/copperknot/goal-prompt.md`.
- Tightened embedded goal prompt from `3995` to `3912` chars.
- Added explicit rule that repo-local goal prompt and current instructions beat stale active-goal text after resume/compaction.
- Kept direct execution, queue-first lane choice, UI/UX preservation, dirty-worktree boundary, no Supabase transforms, and true-gate handoff stop rules.
- Validation: `npm -C frontend run docs:check` passed; `git diff --check` passed.

Follow-up:

- Added explicit rule that visibly unfinished, placeholder-like, confusing, or below-polish surfaces are launch-readiness findings before proof targets.
- Mirrored the rule in `docs/agents/copperknot/AGENTS.md`, `docs/agents/copperknot/standard-operating-procedure.md`, and the embedded goal prompt.
- Embedded prompt remains under `4000` chars at `3940`.
- Validation: `npm -C frontend run docs:check` passed; `git diff --check` passed.
