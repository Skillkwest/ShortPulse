# Severity And Gate Policy

Purpose: map finding severity to mandatory gate behavior and blocking rules.

Status: Inactive specification.

## Severity taxonomy
- `P0` Critical: security exposure, data integrity break, release safety failure, or severe production risk.
- `P1` High: major correctness/regression risk likely to impact users.
- `P2` Medium: meaningful quality or maintainability risk with bounded impact.
- `P3` Low: minor issue with low operational impact.

## Gate blocking matrix
- Any open `P0` impacting the current gate -> `FAIL`.
- Any open `P1` impacting the current gate -> default `HOLD`.
- `P2` findings -> may `PASS` only when explicitly accepted with owner/date.
- `P3` findings -> non-blocking unless aggregated risk indicates otherwise.

## Gate-specific hard stops
- Gate A: block on unclear acceptance criteria or missing scope boundaries.
- Gate B: block on incomplete implementation or missing validation context.
- Gate C: block on unresolved high-severity technical/security findings.
- Gate D: block on critical staging regressions or missing rollback path.
- Gate E: block on unresolved production-critical risk without ownership.

## Mandatory blocker authority
- Security reviewer may block any gate for unresolved `P0/P1` security risk.
- Platform/release may block Gate D/E for rollout/rollback risk.
- QA may block Gate D for reproducible critical-path failures.
- Senior engineer may block Gate C for severe correctness/architecture risk.

## Decision algorithm
1. Collect all open findings for the gate.
2. Apply severity rules and blocker authority.
3. Emit structured gate decision packet.
4. If `HOLD`/`FAIL`, include exact next action and owning role.

## Risk acceptance rule
Only `P2/P3` findings may be accepted as risk, and only when owner/date is explicit.
