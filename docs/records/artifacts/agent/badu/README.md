# Badu Retained Artifacts

Purpose: retained artifact home for Badu, the ShortPulse accountant agent.

This folder stores non-authoritative retained Badu artifacts:

- reports,
- training history,
- run logs,
- templates,
- tool notes,
- non-sensitive training data.

Authoritative Badu operating docs live under `docs/agents/badu/`.

## Layout

- `reports/`: dated import reports and accounting-source reviews.
- `templates/`: retained report and import templates.
- `training-data/`: safe training examples and sanitized source examples.
- `training-history.md`: supervised-run learning log.
- `run-log.md`: concise chronological run register.
- `tools.md`: retained helper-tool notes.

Do not store secrets, cookies, auth tokens, raw provider credentials, card details, customer payment data, or tax/legal filings here.
