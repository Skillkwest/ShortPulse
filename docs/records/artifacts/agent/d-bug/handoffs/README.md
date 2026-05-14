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
  - `2026-05-14-nuclo-hosted-sql-lint-remediation.md`
