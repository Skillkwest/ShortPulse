# Gear Ball Baseline KPI

Purpose: define the baseline quality targets Gear Ball should improve against over time.

## Current Baseline

- Full-SOP completion rate without user rescue: target `100%`
- Full-suite pass before push: target `100%`
- First-pass success without late hook/lint/full-suite fixes: target `>= 80%`
- Mixed-batch restaging due to avoidable scope mistakes: target `<= 1` per substantial run
- Build-only regressions discovered after a green full suite: target `0`
- Post-commit leftover escapes discovered after the next batch has already started: target `0`
- Repo-root targeted-test path mistakes: target `0`
- Post-run self-audit + training update completion: target `100%`
- Helper/SOP decision recorded after full commit/push runs: target `100%`

## Current Known Weak Spots

- Late discovery of lint-staged or full-suite issues after staging
- Shared-file drift in large mixed worktrees
- Too much reliance on final full-suite pressure to expose stale tests
- Generated audit/docs packets can carry avoidable docs parity breakage
- Build-only regressions still appear on compound-risk frontend runs when build is delayed too long

## Improvement Rule

When a full SOP run scores below `9/10`, Gear Ball should identify one specific mechanical change, helper update, or SOP improvement that would have prevented the slip and record that in training history.
