# Hybervees Tooling Roadmap

Purpose: track small helper tools that would make Hybervees faster, safer, and more consistently valuable.

## Tooling Principles

- Tools should reduce manual admin-query risk.
- Tools should protect secrets by using canonical local env/config without printing secret values.
- Tools should improve review quality, not create process theater.
- Tools should keep Hybervees inside its lane: insight analysis, backlog recommendations, and review metadata.

## Available Helpers

Hybervees now has repo scripts for the top helper needs:

```bash
npm -C frontend run hybervees:next-report -- --limit 1
npm -C frontend run hybervees:mark-reviewed -- --external-run-id <run-id> --summary "<summary>" --artifact-path <path>
npm -C frontend run hybervees:output-check
```

Implementation lives under:

- `scripts/hybervees/next-report.mjs`
- `scripts/hybervees/mark-reviewed.mjs`
- `scripts/hybervees/output-check.mjs`

Use `--help` on each command for details.

## Highest-ROI Helpers

### 1. `hybervees-next-report`

Goal: fetch the earliest unreviewed Admin Tester Report and print a safe intake packet.

Status: implemented as `npm -C frontend run hybervees:next-report`.

Should output:

- row id,
- external run id,
- tester slug/display name,
- scenario,
- created date,
- production surface,
- report artifact paths,
- evidence keys,
- current Hybervees review state.

Should not output:

- service-role key,
- auth tokens,
- full private customer data,
- unrelated report bodies unless explicitly requested.

### 2. `hybervees-mark-reviewed`

Goal: mark one reviewed report using only Hybervees-owned review metadata.

Status: implemented as `npm -C frontend run hybervees:mark-reviewed`.

Inputs:

- row id or external run id,
- short insight summary,
- retained artifact path.

Safety checks:

- refuse empty summary,
- refuse missing artifact path,
- update only `hybervees_review_*` and `hybervees_insight_*` fields,
- print the updated review state after success.

### 3. `hybervees-output-check`

Goal: check Hybervees outputs before closeout.

Status: implemented as `npm -C frontend run hybervees:output-check`.

Checks:

- owner summaries do not include `Do Not Overreact`, `Best Next Owner`, routing, or caveat sections,
- owner summaries include `Short Version`, `What This Means`, and `Do This`,
- backlog additions include problem, why it matters, exact surface, first action, acceptance criteria, validation, non-goals, and source,
- retained report and workspace mirror exist when expected.

## Admin Surface Helper

Future admin UI idea: add a `Copy Hybervees packet` action on each tester report row.

Packet should include:

- report metadata,
- persona report path/body,
- engineering handoff path/body,
- evidence paths,
- current Hybervees review state.

This would make intake cleaner without requiring Hybervees to use the browser for normal report analysis.

## Current Priority

The first three scripts now exist. Keep improving them only when the manual process reveals a real bottleneck or source of errors.

Current top priority:

1. Use the scripts during every `run sop`.
2. Add tests or stricter checks if the scripts catch or miss a real issue.
3. Consider the admin `Copy Hybervees packet` affordance if browser/API intake remains slow.
