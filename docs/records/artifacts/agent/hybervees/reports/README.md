# Hybervees Reports

Purpose: dated retained analysis reports created by Hybervees after reviewing Admin Tester Reports or local tester-report artifacts.

## Naming

Use:

```text
YYYY-MM-DD-<short-scenario>-insight-review.md
YYYY-MM-DD-<short-scenario>-owner-summary.md
```

Examples:

- `2026-07-06-maya-reference-grid-insight-review.md`
- `2026-07-06-maya-reference-grid-owner-summary.md`
- `2026-07-06-recent-admin-tester-reports-rollup.md`

## Required Shape

Use `../templates/tester-report-insight-review-template.md` unless the user asks for a different format.

Each report should preserve:

- source and freshness,
- reports reviewed,
- top insights,
- emotional/product understanding signal,
- engineering follow-up candidates,
- product decision candidates,
- confidence and missing proof,
- next best actions.

Use `../templates/owner-summary-template.md` for the owner summary.

Owner summaries should preserve only:

- short version,
- what this means,
- exactly what to do next.

Do not include `Do Not Overreact`, `Best Next Owner`, owner routing, caveats, lane assignment, or "what not to overreact to" sections in owner summaries unless the user explicitly asks for them.
