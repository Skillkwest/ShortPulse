# In-Practice Delivery Flow (Real Company Baseline)

Purpose: define the default delivery path for a feature from initial request through post-release learning.

## Step 1: Problem framing and ticket definition
Owner: Product lead + engineering lead.

Expected outputs:
- Prioritized backlog item.
- Clear acceptance criteria (what must be true for completion).
- Scope boundaries and known risks.

Exit criteria:
- Engineers can implement without guessing product intent.
- Success/failure conditions are testable.

## Step 2: Implementation on a feature branch
Owner: Engineer.

Expected outputs:
- Scoped code changes tied to the ticket.
- Local verification evidence (basic tests/checks run).
- Draft PR with context for reviewers.

Exit criteria:
- PR explains what changed, why, and expected user impact.
- Diff is small enough for effective review.

## Step 3: Technical review and risk scrutiny
Owner: Senior engineer/peer reviewers.

Expected outputs:
- Review feedback on correctness, security, maintainability, and regression risk.
- Required approval(s) before merge.

Exit criteria:
- High-risk concerns are resolved or explicitly accepted.
- Branch protection/review policy conditions are met.

## Step 4: CI verification gates
Owner: Engineering system (CI) + engineer who opened PR.

Expected outputs:
- Passing required checks (lint/build/tests/security or policy checks as defined).
- No unresolved failing status checks.

Exit criteria:
- All required checks pass on the final PR commit.
- Merge gate is satisfied.

## Step 5: Staging validation and QA signoff
Owner: QA + feature engineer.

Expected outputs:
- Staging verification for core and edge flows.
- Regression confirmation on impacted surfaces.
- Defect log for issues found.

Exit criteria:
- Blocking defects are fixed or explicitly deferred with owner/date.
- Release candidate is acceptable for controlled rollout.

## Step 6: Production rollout with blast-radius control
Owner: Engineer + release manager/platform owner.

Expected outputs:
- Controlled launch (flag, canary, ring, or staged percentage).
- Rollback path and release notes.

Exit criteria:
- Early cohort metrics are stable.
- Ramp decision (continue, hold, rollback) is documented.

## Step 7: Post-release monitoring and feedback loop
Owner: Engineering + ops.

Expected outputs:
- Monitoring review (errors, latency, failures, user impact).
- Incident response if thresholds are crossed.
- Follow-up tickets for reliability/product learning.

Exit criteria:
- Release considered stable for full traffic.
- Learnings captured in backlog and process docs.

## What "real" looks like in practice
- Steps 3-7 are enforced as gates, not optional etiquette.
- "Done" means merged, validated, released safely, and observed in production.
- Quality is shared responsibility: engineers, reviewers, QA, and ops each own a gate.
