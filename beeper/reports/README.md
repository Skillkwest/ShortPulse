# Beeper Reports

Purpose: keep Beeper's fuller workflow/UI/UX audit write-ups inside Beeper's owned folder.

## Rules

- Use this folder for denser product-analysis reports that go beyond the compact retained ledger.
- Keep one file per substantive audit run or per major workflow lane.
- Do not use this folder for process-only maintenance notes unless the user explicitly asks for operational review.
- Prefer filenames like `YYYY-MM-DD-<short-label>.md`.
- Keep secrets and raw private data out of these reports.
- When a report needs evidence references, point to a redacted manifest or a run packet rather than using raw screenshot/network payloads as the durable truth.
- If a report captures a real issue or error that needs engineering follow-up, pair it with a D-Bug handoff in `docs/records/artifacts/agent/d-bug/handoffs/`.

## Relationship To Retained Artifacts

- `docs/records/artifacts/agent/beeper/reports/` is the compact durable retained report path.
- `beeper/reports/` is the fuller Beeper-owned analysis path for workflow bottlenecks, UI/UX notes, and fix thinking.
