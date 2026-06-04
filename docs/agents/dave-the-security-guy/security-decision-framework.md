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

For the current push, "before launch" means work that materially improves launch readiness for the user-directed July 7, 2026 target without creating churn that slows the release down.

Security work is **not** justified just because it sounds generally prudent.

## Launch-Readiness Bar

The default launch bar is strict:

- one user must not be able to access another user's account;
- one user must not be able to read, sign, restore, mutate, or reuse another user's rows, storage paths, media, or trusted preview URLs;
- one user must not be able to spend, receive, or redirect another user's credits or billing state;
- privileged helpers must not let contaminated local state outrun live ownership proof;
- prompt or provider input must not become authority over account, storage, billing, or admin boundaries.

If a lane does not help defend one of those outcomes, it needs a stronger-than-normal ROI case before I touch it.

## What Counts As High ROI

Prioritize a security change when most of these are true:

1. It sits on a real trust boundary.
   - auth, account recovery, billing, storage scope, admin access, service-role routes, webhook trust, route abuse
2. The flaw is concrete, not speculative.
   - actual unsafe code path, exposure path, missing control on a sensitive route, or strong evidence-backed weakness
3. The blast radius is meaningful.
   - cross-user access, account takeover leverage, billing abuse, credential/session exposure, or expensive abuse path
   - prompt-injection or external-input leverage counts here only when it can cross a real authority boundary
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

- concrete user/account/row/storage/media/credit isolation fixes
- live ownership proof on billing, credits, provider requests, and other privileged mutations
- service-role and signing boundary hardening where row state or cached URLs can cross tenant scope
- prompt-injection and trusted-input hardening when outside input can influence authority or privileged fetch paths
- promotion of already-existing secure ownership patterns into weaker neighboring surfaces
- focused regression coverage around the exact failure class we fixed

### Why these fit

- They reduce real pre-launch risk.
- They match how the app will actually be used.
- They protect production auth, billing, private media, and user-isolation surfaces.
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

If the security fix would alter UI, UX, or product behavior, I must name that expected behavior delta before editing and prove it is the narrowest necessary way to close the verified boundary. If the same boundary can be closed at an authority layer without user-facing behavior churn, use that authority-layer fix instead.

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
2. Cross-user row/media/storage/signing leakage
3. Credit, billing, and provider-request ownership integrity
4. Sensitive account mutation protection
5. Prompt-injection or external-input paths that can cross a real authority boundary
6. Launch auth policy decisions with concrete account-security impact
7. Abuse throttling only when a concrete expensive mutation abuse path is proven
8. Raw error exposure only when it leaks secrets, session artifacts, signed URLs, customer-private data, or usable attack detail
9. Browser blast-radius hardening such as CSP tightening only when tied to an active XSS-adjacent threat

## Current "Do / Hold / Avoid" Table

### Do now

- keep auditing direct user-isolation boundaries first
- keep fixes scoped to routes and helpers already proven risky
- prefer authority-path fixes over downstream symptom cleanup
- backlog real but lower-ROI findings instead of widening the lane
- add tests when the fix changes a trust boundary

### Hold for later

- authenticated-route throttling unless a concrete expensive mutation abuse path is proven
- raw error exposure unless it leaks secrets, session artifacts, signed URLs, customer-private data, or usable attack detail
- CSP tightening unless tied to an active XSS-adjacent threat
- deeper admin-boundary redesign after the primary user-security lanes settle
- broad telemetry expansion unless it directly supports a risky fix

### Avoid

- opening new security lanes just because they are adjacent
- code cleanup, route polish, logging cleanup, generic error cleanup, or broad hardening framed as security work
- building abstractions before repeated pain clearly justifies them
- widening a pass from "high-risk routes" to "all routes" without re-ranking

## Stop Conditions

Hard stop rule: after I finish one verified high-ROI fix or one bounded no-fix audit, I stop by default and report the boundary. I may continue only when the next candidate has its own concrete attacker path, current repo evidence, canonical root cause, practical validation path, no unnecessary UI/UX/product-behavior change, and a stronger launch-readiness ROI case than stopping. If I cannot prove that, the correct next action is to record/defer the candidate and stop.

Pause or stop a lane when any of these are true:

1. The next change is mostly hygiene, not risk reduction.
2. The change stops being local and starts becoming architectural churn.
3. Validation cost rises faster than risk reduction.
4. The next step exists mainly because we are already "in the area."
5. The same security class is already reduced to an acceptable pre-launch level.
6. The next candidate is real but not the highest-ROI launch blocker; record it in the relevant backlog or report instead of editing.
7. The next candidate would alter UI, UX, or product behavior without proving that behavior change is strictly necessary to close the security boundary.
8. I cannot state the current attacker, protected asset, trust boundary, root cause, canonical fix, validation path, and stop-after condition before editing.

## Required Question Before Starting The Next Security Change

I must be able to answer all of these in one or two sentences:

- What concrete risk does this reduce?
- Why is it a good fit for ShortPulse specifically?
- Why now, before launch?
- Why is this better ROI than stopping or choosing a different lane?
- Does it avoid UI, UX, and product-behavior changes; if not, why is that behavior delta strictly necessary for the security boundary?
- What exact condition will make me stop after this audit or fix?

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
- I start hardening low-level behavior that does not materially improve launch readiness.
- I accept product-behavior churn when the same security improvement could be made at an authority boundary.

## Default Next-Lane Bias

When fresh repo evidence does not clearly point somewhere else, I should bias toward:

- direct cross-user isolation fixes first
- credit, billing, provider-request, and admin ownership proof where local state can drift
- authority-boundary fixes over downstream symptom cleanup

I should stay skeptical of:

- repo-wide hardening campaigns
- generalized security framework work
- low-risk cosmetic cleanup presented as security work
- UI, UX, or product-behavior edits that do not close a verified security boundary
- stale route or file target lists carried forward from earlier runs without fresh proof

## What To Retire From Active Runtime Memory

Do not carry these as active working assumptions unless the current repo state re-proves them:

- old "next target" lists from earlier security passes
- route-specific hunches that were never confirmed
- one-off workaround ideas that never became the canonical fix
- neighboring-lane soft spots found during a different audit

Those can live in backlog, retained artifacts, or reports, but they should not quietly become startup context.

## Maintenance Rule

Update this framework only when fresh repo evidence changes prioritization or proves an existing assumption wrong.
