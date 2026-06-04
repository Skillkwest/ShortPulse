# July 7 Launch Authority

Purpose: define the active ShortPulse launch-readiness authority model for the July 7, 2026 launch decision.

## Controlling Promise

ShortPulse is launch-ready when a real user can arrive, understand the product, make something valuable, save it, return to it, reuse and organize assets, and trust credits, media, projects, account state, and failures without the solo owner manually rescuing normal use.

This promise is the controlling launch standard. System scores, queue order, handoffs, production checks, and agent reviews exist to support this promise, not to preserve old table structure.

## Active Date

- Active launch decision date: `2026-07-07`
- Active branch: `production`
- Active production URL for browser/manual validation: `https://www.shortpulse.ai`

The date is a decision target, not permission to create false confidence. If evidence shows the promise cannot be met by July 7, Copperknot must say so and route the smallest recovery plan.

## Readiness Model

The old `/10` score is now a secondary planning index. The July 7 launch board uses these fields as the primary authority:

| Field | Meaning |
| --- | --- |
| `Launch state` | Whether the system can support the launch promise today. |
| `Evidence level` | The strongest proof currently available. |
| `Human risk` | Risk that the user experience breaks trust, task completion, or paid-use confidence. |
| `Operational risk` | Risk that normal usage creates solo-owner rescue or support burden. |
| `Technical risk` | Risk that the implementation is fragile, unclear, or hard to repair quickly. |
| `Next proof` | The next concrete proof needed to move the system forward. |

## Launch States

| State | Use When |
| --- | --- |
| `Blocked` | A known unresolved defect, missing proof, or control gap can directly break the launch promise. |
| `Below Bar` | The system may work, but evidence or reliability is not strong enough for launch reliance. |
| `Launchable With Watch` | The system can support launch if monitored; residual risk is named and bounded. |
| `Launch Ready` | The system has production-grade proof, low owner burden, and no active launch blocker. |
| `Post-Launch Improve` | The system is not required for the July 7 launch promise or is good enough for launch with only improvement work remaining. |

## Evidence Levels

| Evidence level | Meaning |
| --- | --- |
| `Assumed` | A claim exists, but current repo or production evidence has not been checked. |
| `Repo Inspected` | Current docs/code were inspected and support the claim. |
| `Locally Tested` | Targeted local checks were run against the current worktree. |
| `Production Checked` | Non-mutating production checks or route/manual observations passed. |
| `Production Proven` | Mutating or end-to-end production behavior passed with real workflow evidence. |

Never claim a launch state stronger than the evidence level can support. Local fixes can improve the board, but production readiness needs production evidence when user-facing runtime behavior is involved.

## Risk Scale

Use `Low`, `Medium`, `High`, or `Critical`.

- `Human risk` is highest when a normal user would be confused, lose work, distrust the product, or fail to complete the core job.
- `Operational risk` is highest when the solo owner would need to manually intervene, reconcile state, or inspect logs for normal use.
- `Technical risk` is highest when source ownership is unclear, duplicated, fragile, or difficult to validate under launch pressure.

## UI/UX Preservation Rule

The current ShortPulse UI, UX, and intended behavior are the preferred launch baseline. Copperknot should work hard to preserve the app as it already looks and functions.

UI, UX, or behavior changes are allowed only when the evidence shows that preserving the current experience would materially weaken the July 7 launch promise. Prefer source-level strengthening, validation, bug fixes, state reliability, performance improvements, and clearer failure handling before proposing visible redesign or workflow changes.

If a major UI, UX, or behavior change becomes necessary, the launch artifact or handoff must explain:

- the launch risk that makes the change necessary
- why a smaller preservation-minded fix is not enough
- which parts of the current experience must remain intact
- the proof required before Copperknot accepts the change

## July 7 Completion Gates

ShortPulse is not ready for the July 7 launch decision until all of these are true:

1. Core user journey is production-proven or explicitly waived with current evidence: arrive, auth, enter AI Studio, create/edit/generate, save, reopen, reuse assets, and understand failure state.
2. Credits, pricing, billing, and entitlement behavior is production-checked at minimum and production-proven for any path relied on for paid launch.
3. Media ingest, storage, signing, preview, and save/restore behavior is production-proven across the hot path.
4. Generation submission, provider result handling, recovery, settlement, and visible output delivery have current validation that covers normal success and degraded cases.
5. Projects/workspace restore and asset association behavior is trustworthy enough that saved work is not silently lost or misattributed.
6. Auth, RLS, storage scope, and admin-only boundaries have current evidence and no unresolved cross-user or protected-route risk.
7. Admin, observability, and issue-reporting surfaces give the solo owner enough truth to operate launch without hunting through raw internals first.
8. UX/design issues that damage task completion, trust, or paid-use confidence are resolved or explicitly classified as watch items.
9. The final launch board and execution queue are current, internally consistent, and used as the authority for every agent handoff.

## Agent Handoff Contract

Every launch handoff must name:

- launch system
- launch state and evidence level
- human, operational, and technical risk
- exact source area
- allowed write scope
- forbidden scope
- done proof
- stop condition
- whether the expected change is a root fix, bounded risk reduction, or temporary containment

Agents may execute within the handoff. They may not change Copperknot readiness state, queue priority, or launch scoring unless Copperknot reviews and accepts the evidence.

## Autonomy Gates

Copperknot can continue without user arbitration for ordinary code, docs, tests, UX/design triage, scoring, priority, source audit, validation planning, queue maintenance, and handoff design.

Copperknot must stop and report the exact decision when the next step requires destructive data operations, secret exposure risk, billing/business-policy changes, credit-consuming production tests, commit/push/deploy/release actions, or a major public product-promise change.
