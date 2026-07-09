# Badearsai Crash Log SOP

Purpose: define Badearsai's workflow for `/admin/crashes` browser crash-session review, source tracing, real-vs-noise classification, and safe queue cleanup.

## Trigger

Run this SOP when the user says:

- `check crash log`,
- `check crash logs`,
- `check admin crashes`,
- `admin crash logs`,
- `crash log`,
- `crash logs`,
- or references `https://www.shortpulse.ai/admin/crashes`.

## Source Of Truth

- Admin page: `https://www.shortpulse.ai/admin/crashes`.
- Read API: `frontend/pages/api/admin/crashes.ts`.
- Review API: `frontend/pages/api/admin/crashes-status.ts`.
- Persistence/classification owner: `frontend/lib/server/api/browserCrashSessions.ts`.
- Schema/docs: `docs/data-dictionary.md`, `docs/monitoring.md`, and `docs/api/api-internal-routes.md`.
- Helper: `docs/agents/badearsai/tools/scripts/crash-log-intake.mjs`.

Crash rows are evidence rows in `browser_crash_sessions`; they are not grouped Admin Errors incidents and must not be deleted during review.

## Scope

Badearsai may inspect crash-session rows, classify likely real crashes versus low-confidence browser/session noise, trace owner lanes, update Badearsai-owned docs/reports, and clear reviewed crash rows from the default Needs Review queue by setting `review_status` to `resolved` or `ignored` with a note when the classification is decision-grade.

Badearsai may not change UI/UX, browser instrumentation, crash-detection semantics, security/privacy posture, billing/credits, provider behavior, deploy state, branch state, or another agent's workspace unless the user explicitly approves that work in the current thread.

## Evidence Status Interpretation

- `confirmed_crash`: high-confidence browser crash evidence from Chrome Reporting API; treat as real until proven duplicate, old, or already handled.
- `probable_freeze_or_crash`: high-confidence inferred freeze/crash based on severe pressure, stall, heap, or abandoned-session evidence; usually needs trace/watch or owner-lane review.
- `possible_ungraceful_exit`: low-confidence stale or abandoned session evidence; default to watch/ignore unless recurring, paired with app errors, or tied to a user-visible report.
- `clean_closed`: normal close evidence; ignore unless contradictory adjacent evidence exists.
- `active`: do not resolve as a crash while fresh; if stale, the Admin API may show effective `possible_ungraceful_exit`.

Review status is separate from evidence status:

- `open`: still needs review, proof, or owner-lane work.
- `resolved`: reviewed and no longer active queue work, including watch-resolved rows with a repeat condition.
- `ignored`: expected/noisy/low-confidence evidence that should not occupy Needs Review.

## Required Workflow

### Step 1. Startup And Intake

- Follow the root startup contract and Badearsai default load policy.
- Load this SOP plus the crash source-of-truth docs/code above.
- Use `docs/agents/badearsai/tools/scripts/crash-log-intake.mjs list` to pull current production rows instead of requiring pasted packets.
- Default list scope: `status=needs_review`, `reviewStatus=open`, latest rows first.
- Preserve row IDs, routes, evidence status, confidence, review status, user/session boundary, release/build, last event, timeline fields, and metadata keys.

### Step 2. Triage One Row At A Time

For each open row:

- Identify route, release/build, user/session boundary, event timeline, evidence status, confidence, and metadata keys.
- Inspect the owning route/service/helper/SOP before claiming root cause.
- Correlate with Admin Errors/Event Stream, generation/task/output evidence, browser pressure telemetry, deployment/release timing, and user/session recurrence when feasible.
- Separate a browser/runtime crash from provider, network, admission, expected close, auth, or deploy-skew noise.
- Preserve privacy: do not print raw emails, tokens, cookies, signed URLs, private customer content, prompts, DOM text, or provider payloads in reports.

### Step 3. Classify

Use these classifications:

- `real issue`: likely user-impacting crash/freeze or product correctness risk needing owner-lane fix/proof.
- `queue noise`: clean close, low-confidence stale singleton, known expected browser lifecycle behavior, stale release, duplicate already tracked elsewhere, or no actionable signal.
- `watch`: plausible singleton or same-signature recurrence below the implementation threshold.
- `blocked pending proof`: needs Event Detail, Admin Errors correlation, browser trace, account/generation evidence, or owner-lane reproduction before classification is safe.
- `out of scope`: belongs to another owner or requires approval-gated mutation/spend/deploy/UI/security work.

Each classification must include confidence, owner lane, proof achieved, missing proof, and the stop boundary.

### Step 4. Decide Review Treatment

- Keep `open` when the row still needs implementation, owner-lane work, correlation proof, or human review.
- Set `resolved` when the row has been reviewed, fixed elsewhere, recovered, is a duplicate of tracked work, or is watch-resolved with a concrete repeat condition.
- Set `ignored` when the evidence is expected/noisy/low-confidence and should not stay in Needs Review.
- Never delete crash rows or change their evidence `status` as a review shortcut.

### Step 5. Apply Cleanup Only When Safe

Use the canonical Admin semantics in `frontend/pages/api/admin/crashes-status.ts` and `frontend/lib/server/api/browserCrashSessions.ts`.

The helper command may be used for reviewed rows only:

```bash
node docs/agents/badearsai/tools/scripts/crash-log-intake.mjs review \
  --session <browser-crash-session-row-id> \
  --status resolved \
  --note "Badearsai: reviewed; no repeat after deploy; watch same route/release recurrence." \
  --reviewer-email "<admin-or-operator-email>"
```

Stop before review-status mutation when:

- the row ID is unclear,
- the classification is a guess,
- the note would omit the reason or repeat condition,
- the correct owner lane still needs proof,
- the mutation would affect more rows than the reviewed row,
- or the next step would alter UI/UX, product semantics, security/privacy, billing, spend, deploy, branch, or another agent's workspace.

### Step 6. Validate

After any review-status change:

- run a focused readback with `list --review-status all --session <id>` or the Admin page,
- confirm the row no longer appears in default `needs_review/open` scope when marked `resolved` or `ignored`,
- record the proof in Badearsai run log or a retained report when the run has durable value.

## Owner Handoff Shortcuts

- Browser pressure, media display, right-rail runtime freezes: Holomony.
- Generation lifecycle, provider recovery, stale outputs: Bactuo.
- Workspace save/restore or project state: Datserok.
- Admin Crash Logs UI/UX or operator ergonomics: Gottspan The Admin.
- Security/privacy/auth/session boundaries: Dave The Security Guy.
- Deploy/release/infra skew: Gear Ball or Nuclo.

## Closeout Template

```text
Checked Crash Logs from /admin/crashes.

Rows reviewed:
- <row id>: <classification>, <status treatment>, <owner>, <proof>, <missing proof/watch condition>

Kept open:
- <row id>: <why>

Cleanup:
- <resolved/ignored/readback proof or none>

Changes:
- <files/tools changed or none>

Boundary:
- <exact stop condition>
```
