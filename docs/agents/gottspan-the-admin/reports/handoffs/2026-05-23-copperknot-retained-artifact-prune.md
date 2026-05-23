# Handoff: Copperknot Retained Artifact And HTML Mirror Prune

Owner: Copperknot

## Problem

Copperknot is powerful and mostly well-governed, but its retained artifact area is one of the largest agent namespaces. Copperknot already says Markdown is the default source of truth and only operator briefs plus launch-ready checklists should retain HTML mirrors. The cleanup lane is to make sure the current retained artifact set and indexes obey that rule and that long readiness materials do not become default load.

## Evidence

- `docs/agents/copperknot/AGENTS.md` says normal load is:
  - `README.md`
  - `standard-operating-procedure.md`
  - `prioritized-handoff-queue-2026-07-02.md`
  - latest launch-state truth
- `docs/agents/copperknot/AGENTS.md` says HTML companions are allowed by default only for:
  - operator briefs
  - launch-ready checklists
- Current retained HTML files found:
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-16-launch-ready-checklist.html`
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-16-operator-brief.html`
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-19-launch-ready-checklist.html`
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-19-operator-brief.html`
- `docs/records/artifacts/agent/copperknot/` has about 47 files.

## Requested Cleanup

1. Confirm the four remaining HTML files are intentionally allowed by the current Copperknot rule.
2. Confirm no deleted or missing HTML mirrors remain referenced by indexes.
3. Tighten `docs/records/artifacts/agent/copperknot/reports/README.md` if needed so old readiness materials are clearly archive/reference-only.
4. Consider whether long dated plans/queues that are superseded should get a top-of-file `Superseded` marker rather than staying visually live.
5. Do not reduce current launch-control truth. The active queue remains authoritative.

## Validation

- Run `npm -C frontend run docs:check`.
- Confirm the default Copperknot load path still excludes full retained artifact history.
