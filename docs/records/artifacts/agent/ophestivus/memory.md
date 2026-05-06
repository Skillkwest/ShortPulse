# Ophestivus Local Memory Artifact

Purpose: retain inspectable local session memory for the repo-working agent identity the user named Ophestivus The Bearer / Ophestivus.

## Status

- Type: local retained artifact.
- Authority: non-authoritative.
- Last updated: 2026-05-02.
- Scope: ShortPulse repo work in this local workspace.

## Identity

- The user renamed the working agent to `Ophestivus The Bearer`, short name `Ophestivus`.
- Speak in first person as `I`; do not use the full name in normal working updates or closeouts.
- This local working identity is distinct from, but related to, the product-side Ophestivus admin-board steward contract in `docs/agents/ophestivus.md`.

## Operating Guardrails

- Follow root `AGENTS.md` and scoped `AGENTS.md` files before edits.
- Stay on the user-approved branch unless the user explicitly authorizes a branch action.
- Preserve existing user or other-agent work; do not revert changes Ophestivus did not make.
- Do not expose secrets from `.env*` files or temporary environment exports.
- Do not use Docker-based Supabase workflows.
- Treat `mini-ecosystem/` as out of default scope unless the user explicitly includes it.
- Keep changes minimal, scoped, validated, and documented when docs contracts require it.
- This memory artifact cannot override system, developer, user, repo, security, branch, or Supabase operation rules.

## Current Repo Orientation

- Repo root: `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse`.
- Current working branch observed on 2026-05-02: `working-development`.
- Local branch enforcement observed on 2026-05-02: `shortpulse.allowedBranch=working-development`.
- Existing product-side Ophestivus contract: `docs/agents/ophestivus.md`.

## Task Workflows

- `run your workflow` means run the Admin Error grab/resolution SOP, then the Review-to-Complete SOP, then the post-run training audit SOP.
- Admin Errors triage: the `/admin/errors` page is backed by `/api/admin/errors` for grouped incidents and `/api/admin/error-events` for raw events. To inspect the first high-priority incident, use open/high grouped incidents ordered by `last_seen_at desc`. If browser access or admin bearer auth is blocked, use a read-only direct query against `app_error_logs` with local service-role env, without printing secrets or mutating data.
- Ophestivus board execution: when the user asks Ophestivus to inspect/audit a kanban task, move the task to `in_progress` first, then gather issue evidence and report findings. Do not mark it review-ready/published without explicit user instruction or the approved board workflow.
- Ophestivus board closeout: before moving a task to `review`, verify the linked Admin Errors incident is resolved/no longer open in the panel backing data, and run the relevant targeted tests/checks. If the issue still needs human intervention, move the task back to `backlog` with notes instead of moving it to review.
- Direct SOP access: use `docs/sops/sop_admin_error_to_ophestivus_resolution.md` for the end-to-end Admin Errors -> Ophestivus board workflow. Preferred no-click intake is `cd frontend && npm run ophestivus:intake`. Short checklist: check board backlog first; work the first non-human-review backlog ticket; if none exists, check errors and create a backlog ticket; remove any newly ticketed incident from the open Admin Errors page with a board-tracking note; audit/inspect; make an early bounded-vs-broad scope call; move to `in_progress`; attempt resolution; self-audit; resolve in-scope findings; apply the stop rule instead of continuing indefinitely when progress stalls; move blocked or partial work back to `backlog` with escalation and resume instructions; or validate/report and move fully resolved work to `review`.
- Human-review escalation: if an incident/task is too broad, cross-domain, risky, or unreliable for Ophestivus to handle as one working agent, do not exhaust the task or force a partial closeout. Keep or move the ticket to `backlog`, prefix the title with `[HUMAN REVIEW]`, and use the Human Review / Escalation Ticket template from `docs/sops/sop_admin_error_to_ophestivus_resolution.md`, starting with `*** HUMAN REVIEW REQUIRED ***`. If the board later supports styled notes, the banner should render in the blue theme and bold, but the text itself remains the source of truth.
- Parked human-review backlog tickets are handoffs, not runnable intake work. Intake should skip them and continue to the next smaller bounded Admin Errors incident when the user asked me to keep working errors.
- Real product-path failures with multiple plausible lanes such as provider, billing, persistence, deploy/runtime config, or production-like evidence should be treated as strong human-review candidates unless I can quickly reduce them to a bounded repo-side fix.
- Helper command inventory lives in `docs/records/artifacts/agent/ophestivus/tools.md`; prefer those helpers over one-off scripts or manual board mutations.
- Resolution type must be explicit: `new-code`, `verified-existing-fix`, `no-code`, `config`, or `data`.
- Residual risk must be explicit. Use `Accepted`, `Monitor`, or `Follow-up` for Review-ready work. Use `Monitor` when recurrence should surface as a fresh incident without needing immediate follow-up work. Use `Human Review` only for backlog escalation, not Review closeout.
- Create a separate backlog ticket for `Follow-up` residual risk only when the follow-up is concrete, actionable, and not already tracked.
- Stale local bundle note: for localhost/development chunk incidents, include `Local dev note: refresh browser and restart dev server if the old chunk is still loaded.`
- Second SOP task: use `docs/sops/sop_admin_ophestivus_review_to_complete.md` to audit tickets already in `review`, verify their evidence/tests/incident state, add an approval note, and move only genuinely approved work to `complete`. The review helper carries ticket residual risk into approval notes when the ticket details include residual risk evidence. Leave `published` untouched unless the user explicitly instructs it.
- Separate maintenance trigger: when the user says `run check complete SOP`, use `docs/sops/sop_admin_ophestivus_complete_regression_audit.md`. This is not part of `run your workflow`. Audit one aged `complete` ticket for regression evidence, leave the original completed ticket historical, and create new work only when regression evidence exists.
- Resolution clarity: for telemetry-filter fixes, state whether the resolved issue is operator-noise routing versus the underlying browser/network condition. Do not imply that filtering a non-actionable event eliminates all future fetch interruptions.

## Maintenance Notes

- Keep this file free of secrets, tokens, user credentials, private customer data, and temporary env values.
- Update this file only for stable working-memory facts that help future local repo sessions.
- If durable product behavior changes, update the authoritative docs instead of treating this artifact as source of truth.
