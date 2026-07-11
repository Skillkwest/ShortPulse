# Badearsai SOP

Purpose: define Badearsai's repeatable workflow for ShortPulse Admin Errors triage intake, source tracing, real-vs-noise classification, and launch-rollout queue hygiene.

## Trigger

Run this SOP when the user says:

- `run Badearsai`,
- `Badearsai, audit these errors`,
- `audit these triage packets`,
- `error manager`,
- `are these errors real or noise`,
- `trace these issues`,
- `check crash log`,
- `check crash logs`,
- or asks to classify Admin Errors during launch rollout.

If the trigger references `/admin/crashes`, Crash Logs, browser crashes, freezes, or the phrase `check crash log`, run `docs/agents/badearsai/sop-crash-log-triage.md` as the scoped workflow for that surface.

## Scope

This SOP covers triage packet intake, source tracing, incident grouping, real-vs-noise decisions, queue-pruning recommendations, Admin Errors panel cleanup, owner-lane routing, proof boundaries, narrow source fixes for proven app-owned defects, and retained reports.

It does not cover production mutation outside reviewed Admin Errors status treatment for the current pasted batch, live replay, provider-spend smoke tests, deploys, pushes, broad refactors, UI/UX changes, security posture changes, or another agent's implementation lane unless explicitly authorized. Badearsai may still implement a narrow canonical source fix when the current thread authorizes solving discovered issues, production/repo evidence proves the defect is app-owned, the fix is high-ROI and scoped, and the change preserves UI/UX, product semantics, security/privacy, billing/credits, deploy/branch policy, and adjacent owner boundaries.

## Required Workflow

### Step 1. Startup And Scope

- Follow the root startup contract.
- Load Badearsai contract, memory, SOP, and ownership manifest.
- Confirm task mode. Default to audit plus queue cleanup for pasted triage batches, but do not let queue cleanup substitute for source correction. Default to no product-code edits until evidence proves a narrow app-owned defect or the user explicitly promotes the lane to implementation.
- Identify the packet source, copied-at time, production environment, affected route(s), and whether the user supplied a single packet or a batch.
- Check the worktree before edits or broad commands; ignore unrelated dirty files.

### Step 2. Parse Packets Structurally

- Parse every copied packet into an inventory table.
- Preserve incident/event IDs, fingerprints, source, scope, severity, status, route, endpoint, request id, status code, user boundary, first/last seen, occurrence count, release/build, model/task/output/generation identifiers, and metadata keys.
- Group likely causal chains, but never drop individual IDs.
- When packet output is too large, use structured parsing rather than reading the packet as raw prose.
- Use `node docs/agents/badearsai/tools/scripts/admin-errors-intake.mjs status --incident <id>` for exact live status/readback when pasted packet state may be stale.

### Step 3. Check Watch Context

Before treating a pasted row as brand-new work:

- Check whether the incident ID is already resolved/watch, ignored, or resolved in Admin Errors.
- Check whether the fingerprint, source/message, provider/model, endpoint, task family, or failure reason matches a known watch item.
- Treat exact already-resolved/watch incident IDs as already handled unless new packet evidence contradicts the prior rationale.
- Treat new same-signature rows as watch candidates, not automatic new implementation work.
- Promote a watched signature back to `real issue` when fresh repeats cross the watch condition: multiple new rows after the last cleanup, multiple users, current-release recurrence after deploy, a new provider/model/route shape, a new user-visible symptom, or production evidence showing unresolved/corrupt canonical state.
- If the row is a same-signature singleton and production evidence still matches the watched rationale, mark it `resolved` with `watch: true` and add a note linking it to the repeat condition.

Use `docs/agents/badearsai/workspace/watch-list.md` as the lightweight working index for known watched signatures. Admin Errors status metadata remains the live queue source of truth; the workspace watch list is an aid for consistent triage.

### Step 4. Trace The Owning Source

For each incident or causal chain:

- Search for exact route, endpoint, source, message, route label, and metadata keys.
- Read the owning route/service/helper/SOP before classifying.
- Trace far enough to distinguish the external trigger from the app-owned failure mode. A provider, browser, network, or user-action trigger can still expose an app bug if ShortPulse reports the wrong state, fails to reconcile canonical data, leaks noise into the wrong queue, double-charges, loses saved output, or leaves the UI/runtime inconsistent.
- Do not mark a row as provider noise, watch, or resolved merely because the provider was involved. First ask: did the provider actually fail, did the app handle that failure correctly, did canonical production state settle correctly, and did the user-facing/runtime state match canonical state?
- Identify whether the headline is:
  - route missing/stale deploy,
  - intentional auth/rate/admission gating,
  - provider upstream/provider policy,
  - durable app defect,
  - queue-policy issue,
  - client/browser/network singleton,
  - or insufficient packet detail.
- Name the owner lane and repo path when available.

### Step 5. Classify

Use these classifications:

- `real issue`: user impact or product correctness risk that needs owner-lane proof or fix.
- `queue noise`: expected/old/deploy-skew/rate/safety/admission signal that should not occupy the default operator queue.
- `watch`: plausible but low-proof or singleton signal; retain, look for repeats, do not implement yet.
- `blocked pending proof`: packet is too compact; Event Detail, Admin trace, Supabase read-only evidence, or production proof is required.
- `out of scope`: belongs to another owner lane or requires approval-gated mutation/spend/deploy.

Each classification must include confidence: high, medium, or low.

Classification must also state whether there is an app-owned source defect. If yes, the default next action is source fix or owner-lane escalation before queue cleanup; if no, the item may be pruned, ignored, or resolved/watch with proof and a recurrence condition.

When a `client.api_response` incident omits machine-readable failure fields even though the owning route returns a typed JSON error envelope, treat that loss as an app-owned observability defect. Fix the canonical client logger before resolving the cluster: clone the response, retain only bounded allowlisted machine fields (for example `code`, `reason_code`, `traceId`, and retryability), never consume the caller response body, and never copy freeform error text or payload details into telemetry.

### Step 5A. Fix Real App-Owned Defects Before Cleanup

When evidence shows a real app-owned issue:

- Keep the incident `open` until the fix is made or the owner-lane blocker is explicit.
- Locate the canonical source path and make the smallest high-ROI source fix when it is inside Badearsai's approved scope.
- Do not add fallbacks, duplicate authorities, backup implementations, broad refactors, or patch-on-patch behavior.
- Preserve UI/UX, intended runtime behavior, launch posture, security/privacy posture, billing/credit behavior, persistence contracts, branch policy, and deploy state unless the current thread explicitly authorizes a change.
- Run focused validation for the touched surface and audit the diff for regressions before treating the issue as handled.
- If the correct fix belongs to another owner lane or requires approval-gated mutation/spend/deploy/security/UI work, do not clear the row as noise. Keep it `open` or explicitly hand it off with the proof, owner, required fix/proof, and stop boundary.
- If an incident has both a provider-side failure and an app-side handling bug, fix or escalate the app-side bug and classify the provider side separately as watch/noise only after source tracing.

### Step 6. Decide Queue Treatment

For default Admin Errors queue hygiene, decide whether the item should be:

- kept open as operator work,
- kept open because a real app-owned source fix or owner-lane proof is still pending,
- resolved after current proof or verified no-repeat condition,
- ignored with explicit rationale,
- marked resolved as a watch item with a concrete repeat condition,
- or escalated to an owner lane.

Use the canonical Admin Errors status vocabulary:

- `open`: still requires implementation, owner-lane work, Event Detail proof, or human review.
- `resolved`: fixed, verified clean, no longer actionable, or ready to leave the default queue.
- `ignored`: expected noise, routine non-actionable telemetry, stale/deploy-skew, duplicate already tracked elsewhere, rate/admission/safety behavior, or not useful in the default queue.
- `resolved` plus `watch: true`: leave the default queue while retaining a watch label and concrete recurrence condition.

Never use `resolved`, `ignored`, or `resolved` plus `watch: true` to hide a real app-owned defect that has not been fixed, validated, or explicitly handed off.

### Step 7. Clean Up Reviewed Rows

After classification, remove reviewed items from the default Admin Errors panel through the correct status treatment when all of these are true:

- the row came from the current pasted packet or an explicitly selected same-fingerprint family,
- the incident/event ID is known,
- the status treatment is clear,
- the note/rationale is ready,
- the canonical Admin status path is available,
- and the operation does not require replay, spend, provider calls, billing mutation, security posture changes, deploys, or product-code edits.

Use `frontend/pages/api/admin/errors-status.ts` or `frontend/pages/api/admin/errors-status-bulk.ts` as the canonical status semantics. Existing Ophestivus tools may be used only when their workflow is the correct fit for the current cleanup path; do not create duplicate status authorities.

Badearsai's repo-local helper `docs/agents/badearsai/tools/scripts/admin-errors-intake.mjs` may be used to call the canonical status RPC for one reviewed incident at a time. It is a convenience wrapper, not a separate authority.

Run a dry-run or read-only status check first when the tool supports it or when same-fingerprint scope is unclear. After mutation, verify the row or same-fingerprint family is no longer `open` in the default queue, and record failures separately instead of silently dropping them.

If the user points at the visible Admin Errors panel, asks why rows are still showing, asks Badearsai to handle the queue, or supplies a pasted batch from the current queue, the cleanup scope includes:

- every reviewed incident ID from the pasted/screenshot/current queue evidence,
- exact same-request siblings needed to avoid leaving a split causal chain visible,
- exact same-signature watched rows that are currently visible and match the watch rationale,
- and any fresh visible row that appears during cleanup and already matches a documented watch/noise signature.

Do not leave a watched row visible just because Badearsai has seen the signature before. A watched row must be either:

- cleared as `resolved` with `watch: true` after recurrence/proof checks,
- promoted back to `open` owner-lane work because the watch condition was crossed,
- or explicitly named as blocked/kept-open with the missing proof.

Stop before cleanup when:

- the packet lacks the ID needed to update the row,
- the item still needs owner-lane implementation or Event Detail proof,
- the status treatment would be a guess,
- multiple rows share a fingerprint and the correct scope is unclear,
- safe Admin authentication/status tooling is unavailable,
- or the change would affect rows outside the current reviewed set.

### Step 8. Validate Without Mutating

Use non-mutating checks for source proof and recurrence decisions:

- repo static trace,
- focused local tests if code was already changed in an approved implementation lane,
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` for deploy-skew/route surface questions,
- unauthenticated protected-route fail-closed probes when useful,
- Admin status/read checks for reviewed rows,
- docs or route inventory checks.

Do not use service-role env, Supabase writes outside the reviewed Admin Errors status path, provider submits, generation replay, billing/subscription changes, or credit-spend tests unless explicitly approved.

### Step 9. Final Queue Readback

Before closing any Admin Errors cleanup run, perform a production readback that mirrors the default Admin Errors Queue visibility rules in `frontend/pages/api/admin/errors.ts`:

- query current visible `status=open` incidents after applying the queue's non-actionable message filters,
- confirm every reviewed incident ID is no longer visible as `open`,
- if the default queue is not empty, triage each visible row as either in-scope watched/noise cleanup, real owner-lane work, blocked pending proof, or explicitly out of current scope,
- clear in-scope watched/noise rows through the canonical status path,
- keep real or blocked rows open and name the exact reason,
- then repeat the readback until the visible queue is clean or only intentionally open rows remain.

The run is not complete if Badearsai has only handled pasted packets but has not checked whether the default panel still shows actionable reviewed/watch rows. Packet-level cleanup and panel-level cleanup are separate proof steps.

Preferred command for this readback:

```bash
node docs/agents/badearsai/tools/scripts/admin-errors-intake.mjs queue --limit 20
```

### Step 10. Report

Close with:

- packet source and count,
- grouped root-cause clusters,
- real issues and owner lanes,
- noise/prune candidates and why they are safe to hide from the default queue,
- watch items and repeat conditions,
- Admin Errors cleanup performed, skipped, or blocked,
- proof achieved,
- proof still missing,
- exact stop boundary,
- suggested next highest-ROI action.

### Step 11. Record Durable Lessons

Update Badearsai memory, training history, run log, or retained reports when:

- a new recurring classification rule appears,
- a new owner boundary is learned,
- a reusable command or parser is created,
- queue pruning policy changes,
- Admin cleanup policy or status semantics change,
- or a supervised run exposes SOP friction.

Do not create long retained reports for tiny packet batches unless the run produces durable owner/proof decisions or training value.

## Stop Rules

Stop and ask for human review when:

- required proof depends on Admin Event Detail that was not copied,
- the next step would mutate production or provider/account state outside reviewed Admin Errors status treatment for the current packet,
- the next step would spend credits or replay generation/provider jobs,
- the owner lane is unclear and implementation would risk broad churn,
- the only available fix is a workaround or duplicate path,
- the packet contains sensitive data that should not be retained in repo,
- or classification would require secrets/env values not safely available.

## Closeout Template

Use a concise closeout:

```text
Audited <count> packet(s) from <source/time>.

Real issues:
- <cluster>: <owner>, <proof>, <next step>

Queue noise/prune:
- <cluster>: <reason>, <retain/watch condition>

Watch/blocked:
- <cluster>: <missing proof>, <repeat condition>

No changes made / Changes made:
- <files or none>

Admin Errors cleanup:
- <resolved/ignored/watch/kept-open/blocked rows and verification>

Next:
- <highest-ROI proof or owner handoff>
```
