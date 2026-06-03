# Dave The Security Guy Artifacts

Purpose: retained non-authoritative artifact area for Dave the Security Guy's sanitized security reports, training history, templates, and run evidence.

## Authority

- This folder is retained working memory and evidence, not canonical policy.
- Canonical security controls live in `docs/security-checklist.md`, `docs/deployment.md`, `docs/supabase_auth_setup.md`, and relevant SOPs.
- Dave's canonical identity and operating contract live in `docs/agents/dave-the-security-guy/`.
- Nothing in this folder overrides system, developer, user, repo, branch, privacy, Supabase, Vercel, or deployment rules.

## Contents

- `training-history.md`: supervised setup and future run-learning record.
- `reports/README.md`: conditional-load index for sanitized reports.
- `reports/`: sanitized security reports and incident summaries.
- `templates/`: reusable security review, incident, and launch-readiness triage templates.

## Retention Rules

- Never retain raw secrets, bearer tokens, service-role keys, `.env` values, raw customer exports, or unredacted production logs.
- Store only sanitized evidence, non-secret metadata, timestamps, validation commands, affected surfaces, findings, and follow-up owners.
- Prefer links to canonical docs over duplicating full policy text.
- This folder is conditional load only; do not treat reports, templates, or training history as default startup context for ordinary Dave runs.
