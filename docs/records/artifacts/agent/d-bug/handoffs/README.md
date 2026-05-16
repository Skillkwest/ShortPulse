# D-Bug Handoffs

Purpose: retain inbound debugging packets when another agent or the user wants the handoff itself preserved as a repo artifact.

## Rules

- Use `docs/agents/d-bug/handoff-template.md` as the default intake format.
- Keep one file per handoff when the issue is substantial enough to merit durable intake.
- Name files `YYYY-MM-DD-<short-issue-label>.md`.
- Keep secrets, raw tokens, and sensitive customer data out of handoff files.
- If D-Bug resolves the diagnosis but another agent owns the next lane, name that downstream owner explicitly in the handoff closeout:
  - `Gear Ball` for commit/push/branch-hygiene execution
  - `Nuclo` for hosted environment or SQL remediation

## Status

- Active retained handoff:
  - `2026-05-15-character-route-bootstrap-stall.md`
  - `2026-05-15-media-library-search-empty-state-mismatch.md`
  - `2026-05-15-public-home-dashboard-title-mismatch.md`
  - `2026-05-15-ai-studio-top-tab-panel-mismatch.md`
  - `2026-05-15-ai-studio-generate-noop.md`
  - `2026-05-15-dashboard-ai-studio-cta-mismatch.md`
  - `2026-05-15-dashboard-new-project-project-unavailable.md`
  - `2026-05-15-media-library-stale-thumb-variant.md`
  - `2026-05-14-nuclo-hosted-sql-lint-remediation.md`
