# July 7 Launch Authority

Purpose: preserve the ShortPulse launch-readiness authority model used for the July 7, 2026 launch decision.

## Status

ShortPulse launched on `2026-07-07`. This file is the authoritative record of the launch decision and its evidence model, not the active phase instruction. Current work follows `docs/launch-week-production-operations.md` while preserving this file's evidence discipline.

## Controlling Promise

ShortPulse is launch-ready when a real user can arrive, understand the product, make something valuable, save it, return to it, reuse and organize assets, and trust credits, media, projects, account state, and failures without the solo owner manually rescuing normal use.

This promise is the controlling launch standard. System scores, queue order, handoffs, production checks, and agent reviews exist to support this promise, not to preserve old table structure.

## Active Date

- Launch decision date: `2026-07-07` (completed)
- Active branch: `production`
- Active production URL for browser/manual validation: `https://www.shortpulse.ai`

The date was a decision target, not permission to create false confidence. During launch week, use current production evidence to route the smallest customer-impacting recovery action.

## Readiness Model

The old `/10` score is now a secondary architecture maturity index. It can help compare system health, but it does not decide whether a launch lane is ready for July 7. The July 7 launch board uses these fields as the primary authority:

| Field              | Meaning                                                                              |
| ------------------ | ------------------------------------------------------------------------------------ |
| `Launch state`     | Whether the system can support the launch promise today.                             |
| `Evidence level`   | The strongest proof currently available.                                             |
| `Human risk`       | Risk that the user experience breaks trust, task completion, or paid-use confidence. |
| `Operational risk` | Risk that normal usage creates solo-owner rescue or support burden.                  |
| `Technical risk`   | Risk that the implementation is fragile, unclear, or hard to repair quickly.         |
| `Next proof`       | The next concrete proof needed to move the system forward.                           |

## Human Launch Gates

For every launch system, ask these questions before lifting readiness:

1. Can a normal customer arrive and understand what the product is for?
2. Can that customer take the intended action without hidden owner rescue?
3. Does the path create visible value quickly enough to justify continued use?
4. Are save, return, reopen, reuse, and organization behavior trustworthy?
5. Are credits, billing, account state, media ownership, and security boundaries understandable and safe enough for paid use?
6. When something fails, is the failure state honest, recoverable, and diagnosable?
7. Would the human experience feel coherent enough that a user is not confused or turned away by normal use?

These questions classify launch risk. They do not authorize redesign by default. Preserve the current UI, UX, visual design, and intended behavior unless current evidence proves a smaller source-level or validation-focused fix cannot meet the launch promise.

## Launch States

| State                   | Use When                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Blocked`               | A known unresolved defect, missing proof, or control gap can directly break the launch promise or prevents decision-grade evaluation.              |
| `Below Floor`           | The system may work, but current evidence, reliability, or human/owner trust is not strong enough for launch reliance.                             |
| `Floor With Watch`      | The system meets the minimum launch floor for a bounded scope, but watch proof or residual risk remains too important to call launchable outright. |
| `Launchable With Watch` | The system can support launch if monitored; residual risk is named, bounded, and not expected to break normal customer use.                        |
| `Launch Ready`          | The system had production-grade proof, low owner burden, no active launch blocker, and no required launch work remaining at the decision point.    |
| `Post-Launch Improve`   | The system is not required for the July 7 launch promise or is good enough for launch with only improvement work remaining.                        |

Use `Below Floor` instead of the older `Below Bar` wording for new July 7 launch-control updates. If an older handoff or retained report says `Below Bar`, interpret it as `Below Floor` until refreshed.

## Evidence Levels

| Evidence level       | Meaning                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `Assumed`            | A claim exists, but current repo or production evidence has not been checked.  |
| `Repo Inspected`     | Current docs/code were inspected and support the claim.                        |
| `Locally Tested`     | Targeted local checks were run against the current worktree.                   |
| `Production Checked` | Non-mutating production checks or route/manual observations passed.            |
| `Production Proven`  | Mutating or end-to-end production behavior passed with real workflow evidence. |

Never claim a launch state stronger than the evidence level can support. Local fixes can improve the board, but production readiness needs production evidence when user-facing runtime behavior is involved.

Evidence also decays. Treat production proof as current only for the exact deployed surface and commit/deployment window it names. Treat local proof as current only for the current branch/worktree or the commit anchor it names. If a lane is actively moving, use the proof to guide source hardening, then rerun final proof when the lane stabilizes.

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

The July 7 launch decision required all of these conditions. They remain useful production-health signals, but the active response model is now launch-week operations:

1. Core user journey is production-proven or explicitly waived with current evidence: arrive, auth, enter AI Studio, create/edit/generate, save, reopen, reuse assets, and understand failure state.
2. Credits, pricing, billing, and entitlement behavior is production-checked at minimum and production-proven for any path relied on for paid launch.
3. Media ingest, storage, signing, preview, and save/restore behavior is production-proven across the hot path.
4. Generation submission, provider result handling, recovery, settlement, and visible output delivery have current validation that covers normal success and degraded cases.
5. Projects/workspace restore and asset association behavior is trustworthy enough that saved work is not silently lost or misattributed.
6. Auth, RLS, storage scope, and admin-only boundaries have current evidence and no unresolved cross-user or protected-route risk.
7. Admin, observability, and issue-reporting surfaces give the solo owner enough truth to operate launch without hunting through raw internals first.
8. UX/design issues that damage task completion, trust, or paid-use confidence are resolved or explicitly classified as watch items.
9. The final launch board and execution queue are current, internally consistent, and used as the authority for every agent handoff.

## Priority Method

Rank launch work by these factors, in order:

1. Customer task failure or trust damage in the core create/save/reuse loop.
2. Money, credits, billing, entitlement, account, ownership, security, or media integrity.
3. Recovery, settlement, output publication, and failure honesty.
4. Evidence gap between current state and the launch claim being made.
5. Blast radius across workflows or provider/runtime surfaces.
6. Solo-owner operational burden if normal usage goes wrong.
7. ROI of source hardening plus narrow invariant/variant checks while lanes are still moving.

Do not prioritize cosmetic score lifts, duplicate documentation, or broad final proof when the owning source seam is still changing.

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
