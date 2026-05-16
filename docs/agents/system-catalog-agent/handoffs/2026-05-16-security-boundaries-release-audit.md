# Next-Agent Handoff: Security Boundaries Release Audit

## Lane Id

`security-boundaries-release-audit`

Purpose: tighten the launch-critical security boundary enough to reduce ship risk or produce a sharply bounded release findings packet.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not expand into broad product-surface refactors unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Security boundaries`
- Current score: `6/10`
- Target score: `7/10`
- Ship floor: `7/10`
- This system still sits below ship floor in a launch-critical trust boundary.
- Why the score is currently low:
  - protected-route manifests, internal/webhook carve-outs, RLS/storage assumptions, and runtime SQL posture live across several layers that can drift independently
  - the row is evidence-backed, but it was still queue-only, which meant the launch queue identified the risk without yet packaging the release audit needed to move it

## Recommended agent profile

Security-boundary auditor with route-manifest, auth-adjacent, and SQL-posture discipline.

## Scoped task

Find the highest-ROI bounded hardening or release-audit change that improves confidence in the fail-closed security posture without turning this lane into a broad platform rewrite.

## Owned write surface

- `frontend/lib/server/api/protectedApiPaths.ts`
- `frontend/proxy.ts`
- `frontend/lib/server/api/auth.ts`
- `sql/check_runtime_sql_security_audit.sql`
- directly related security docs and targeted tests

## Avoid surface

- broad billing or pricing runtime changes
- unrelated AI Studio workflow behavior
- schema redesign outside explicit security-posture fixes
- feature copy or admin-surface polish

## In scope

- protected-route manifest parity
- internal/webhook carve-out review
- release-time runtime SQL security audit posture
- service-role-only runtime assumptions when directly tied to the scoped files
- targeted validation docs or tests that make the chosen seam more trustworthy

## Out of scope

- broad auth product redesign
- storage UX or media-surface feature work
- new security feature expansion unrelated to launch posture

## Required context

Read first:

- `docs/systems/catalog.md`
- `docs/security-checklist.md`
- `docs/sops/sop_sql_migration_operations.md`
- `docs/architecture-overview.md`
- `docs/routes.md`

Inspect first:

- protected route manifest and proxy boundary
- runtime SQL security audit script
- directly related auth/security tests and docs

## Questions to answer

1. Which launch-critical security posture is still too implicit or weakly enforced?
2. Is the biggest risk route-classification drift, SQL posture drift, or cross-layer documentation/validation drift?
3. What single bounded hardening change or release audit would move confidence fastest?

## Expected output

- one bounded hardening patch with tests or doc-enforced validation, or
- one findings packet that identifies the best next scoped release fix

## Suggested validation

- targeted auth/proxy/security tests
- `npm -C frontend run docs:check` if docs change
- if SQL audit logic changes, capture the exact local validation limits in the closeout

## Mandatory endgame

- After the main patch or findings work, audit the touched security-boundary repo area before stopping.
- Fix any high-value issue found during that self-audit if it stays inside the owned write surface.
- Do not stop at first success. Stop only after:
  - the main implementation or findings work is complete
  - validation is complete
  - self-audit is complete
  - high-value in-scope follow-on fixes are handled
  - closeout is written

## Done state

- one major security-boundary ambiguity or validation gap is reduced
- the closeout makes the ship-floor posture easier to judge

## Stop rules

- Stop before opening a cross-system security rewrite with no sharply bounded fix.
- Stop if the work requires production infrastructure access that is unavailable locally; return a findings packet with the exact missing release proof instead.

## Required closeout report

- Path:
  - `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`
- Filename:
  - `YYYY-MM-DD-security-boundaries-release-audit-closeout.md`
- Required contents:
  - lane id
  - source handoff path
  - execution status
  - systems touched
  - files changed
  - summary of what changed
  - acceptance criteria reached
  - evidence snapshot
  - validation run
  - validation evidence
  - self-audit findings
  - issues fixed during self-audit
  - issues intentionally left out of scope
  - blockers encountered
  - residual risk
  - recommended score effect
  - recommended next step for Catalog Agent review

## Send To Catalog

When the user says `send this to the catalog`, do not stop at a chat summary.

Do all of these:

1. Write the closeout report in:
   - `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`
2. Use the filename:
   - `YYYY-MM-DD-security-boundaries-release-audit-closeout.md`
3. Follow the required closeout contents exactly.
4. Then tell the user:
   - the closeout filename
   - the files changed
   - whether the lane is:
     - `bounded hardening patch complete`
     - `findings packet complete`
     - `blocked with evidence`

## Closeout And Archive

- Return one of:
  - bounded hardening patch complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - what self-audit found
  - what was fixed during self-audit
  - residual risk
  - exact next step if unresolved
- Create the closeout report in the required report path before considering the lane finished.
- After returning the result, this lane should be considered ready to archive unless the user explicitly reopens it.
