# Security Decision Framework

Purpose: keep my security work focused on real ShortPulse risk, pre-launch fit, and return on effort.

This document is for decision-making, not ceremony. I use it to decide what to do next, what to defer, and when to stop.

## Core Judgment

ShortPulse is a pre-launch production-readiness app that already touches:

- production auth,
- production billing,
- production user data,
- private storage,
- service-role server paths,
- and admin/operator flows.

That means security work is justified when it closes a real trust-boundary flaw or meaningfully reduces user/account/business risk before launch.

Security work is **not** justified just because it sounds generally prudent.

## What Counts As High ROI

Prioritize a security change when most of these are true:

1. It sits on a real trust boundary.
   - auth, account recovery, billing, storage scope, admin access, service-role routes, webhook trust, route abuse
2. The flaw is concrete, not speculative.
   - actual unsafe code path, exposure path, missing control on a sensitive route, or strong evidence-backed weakness
3. The blast radius is meaningful.
   - cross-user access, account takeover leverage, billing abuse, credential/session exposure, or expensive abuse path
4. The fix is local and repo-sympathetic.
   - small or medium scoped, uses existing patterns, does not require a new subsystem
5. The fix improves the default path.
   - removes a weak repeated pattern, not just one isolated symptom
6. The change is testable.
   - regression test, route test, or focused behavior proof is practical

If a proposed task misses most of those, it is probably not the next best lane.

## What We Need Now

These are the lanes that fit ShortPulse well right now.

### Keep doing

- concrete user/account/storage boundary fixes
- route-level abuse throttling on sensitive or costly authenticated mutation routes
- step-up or reauth protection for sensitive account pivots
- removal of raw internal/provider error reflection on user-facing APIs
- promotion of already-existing secure patterns into the weaker neighboring surfaces
- focused regression coverage around the exact failure class we fixed

### Why these fit

- They reduce real pre-launch risk.
- They match how the app will actually be used.
- They protect production auth, billing, and private media surfaces.
- They are small enough to validate confidently.

## What We Do Not Need Next

These are not the right next moves unless new evidence appears.

### Defer

- broad repo-wide hardening for its own sake
- sweeping CSP tightening across the app in one pass
- a large custom security framework or generic security platform layer
- mass rewriting every API error contract in one giant batch
- speculative edge-case chasing without a concrete trust-boundary flaw
- admin-auth redesign beyond what launch readiness actually needs today

### Why defer

- High coordination cost
- Higher regression risk
- Lower immediate launch ROI
- Easy to continue by momentum without reducing the most important risks

## Working Discipline

To perform well, I must be stricter than "I already have context loaded."

### Lane lock

- I work one security lane at a time.
- A lane is one trust boundary or one small cluster of closely related routes.
- I do not widen a lane just because nearby files look soft.
- If I want to widen scope, I must stop and re-rank first.

### Change ledger

Before and after edits, I keep a crisp internal ledger with three buckets:

- already true before this turn
- changed by me this turn
- still risky after this turn

If I cannot separate those three clearly, my summaries are not sharp enough yet.

### Stop and re-rank points

I must pause and re-rank when any of these happen:

- I finish the first intended route/helper cluster
- I catch myself saying "while I'm here"
- the next fix touches a different trust boundary
- the next fix needs broader product or workflow redesign

### Small-batch default

- Prefer smaller implementation batches over broad passes.
- Prefer one completed and validated security boundary over three half-finished ones.
- Prefer a clean stop with a clear next recommendation over squeezing in adjacent work.

## Current Security Priority Order

Use this order unless fresh evidence changes it.

1. User/account/storage boundary flaws
2. Sensitive account mutation protection
3. Abuse throttling on authenticated mutation routes
4. User-facing raw error exposure on sensitive surfaces
5. Launch auth policy decisions
6. Browser blast-radius hardening such as CSP tightening

## Current "Do / Hold / Avoid" Table

### Do now

- finish the highest-risk authenticated route throttling pass
- continue safe error-contract cleanup on sensitive user-facing routes
- keep fixes scoped to routes and helpers already proven risky
- add tests when the fix changes a trust boundary

### Hold for later

- CSP tightening after the concrete auth/storage/billing gaps are closed
- deeper admin-boundary redesign after the primary user-security lanes settle
- broad telemetry expansion unless it directly supports a risky fix

### Avoid

- opening new security lanes just because they are adjacent
- building abstractions before repeated pain clearly justifies them
- widening a pass from "high-risk routes" to "all routes" without re-ranking

## Stop Conditions

Pause or stop a lane when any of these are true:

1. The next change is mostly hygiene, not risk reduction.
2. The change stops being local and starts becoming architectural churn.
3. Validation cost rises faster than risk reduction.
4. The next step exists mainly because we are already "in the area."
5. The same security class is already reduced to an acceptable pre-launch level.

## Required Question Before Starting The Next Security Change

I must be able to answer all of these in one or two sentences:

- What concrete risk does this reduce?
- Why is it a good fit for ShortPulse specifically?
- Why now, before launch?
- Why is this better ROI than stopping or choosing a different lane?

If those answers are weak, do not start the lane.

## Performance Rules

To raise my performance, I should optimize for:

1. tighter lane control
2. clearer change accounting
3. better stop timing
4. stronger distinction between concrete exposure reduction and general hardening

Signs I am slipping:

- I describe a wide area instead of one risk boundary.
- I mix finished changes with merely identified issues.
- I keep editing after the highest-ROI fix in the lane is already done.
- I justify the next step mainly with adjacency or convenience.

## Current Decision

Based on the work already completed, I should:

- continue with **targeted authenticated-route throttling**
- continue with **safe error-contract cleanup on sensitive user-facing APIs**
- avoid widening into broad platform-style hardening yet

The next recommended targets are:

- subscription/storage mutation routes
- remaining high-value billing/account mutation routes
- project/media mutation routes with meaningful abuse cost or user-impact risk

The next recommended non-targets are:

- repo-wide CSP crusade
- generalized security framework work
- low-risk cosmetic cleanup presented as security work

## Maintenance Rule

Update this framework only when fresh repo evidence changes prioritization or proves an existing assumption wrong.
