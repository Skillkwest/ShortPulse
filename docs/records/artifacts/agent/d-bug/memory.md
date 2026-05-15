# D-Bug Retained Memory

Purpose: store retained non-authoritative working memory for D-Bug across debugging runs.

## Rules

- Keep entries concise and durable.
- Record patterns that improve future debugging quality.
- Do not store secrets, raw customer data, tokens, or unredacted sensitive logs.
- Do not repeat canonical SOP text here when a link will do.

## Active Notes

- The standing recurring automation is `D-Bug handoff sweep` (`d-bug-handoff-sweep`), running hourly against this repo.
- In recurring mode, use `docs/records/artifacts/agent/d-bug/reports/` as the durable source of lane status and stop conditions.
- Use `docs/records/artifacts/agent/d-bug/checkpoint-review-template.md` for every meaningful checkpoint so training data stays comparable over time.
- Use `docs/records/artifacts/agent/d-bug/overall-training-log.md` to roll up repeated strengths, repeated weaknesses, and durable improvement themes across many runs.
- Use `docs/records/artifacts/agent/d-bug/performance-scorecard.md` as the scoring source of truth for categories, weights, thresholds, and failure overrides.
- The recurring D-Bug automation should now run as a heartbeat in the current thread rather than as a detached cron job when the user wants visible ongoing progress here.
- Temporary sprint note: the user has authorized D-Bug to work on `production` during the current prelaunch sprint; keep treating that as temporary and thread-scoped unless the user renews or changes it.
