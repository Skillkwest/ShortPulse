# Roles And Handoffs

Purpose: clarify who owns each part of delivery and what must be true before work is handed to the next role.

## Core roles

### Product Lead
Primary responsibilities:
- Define problem, user outcome, and priority.
- Set acceptance criteria and non-goals.
- Approve scope changes.

Hands off to engineering when:
- Ticket is prioritized.
- Acceptance criteria are explicit.
- Unknowns and dependencies are recorded.

### Engineer (Developer)
Primary responsibilities:
- Implement the requested behavior.
- Add/update tests and docs for changed behavior.
- Prepare clear PR context and evidence.

Hands off to reviewers when:
- PR is complete and self-reviewed.
- Required checks are configured and running.
- Known tradeoffs are documented in PR notes.

### Senior Engineer
Primary responsibilities:
- Review architecture and long-term maintainability.
- Catch security, reliability, and scaling risks.
- Gate merges for high-impact changes.

Hands off to QA/release when:
- Technical concerns are resolved.
- Merge requirements are satisfied.
- Rollout/rollback expectations are clear.

### QA Engineer (Quality Control)
Primary responsibilities:
- Validate behavior against acceptance criteria.
- Run regression checks on impacted areas.
- Report reproducible defects with severity.

Hands off to release owner when:
- Blocking defects are closed.
- Non-blocking defects are triaged and accepted.
- Test evidence is captured.

### DevOps/Platform (or engineering owner in small teams)
Primary responsibilities:
- Ensure deployment pipeline reliability.
- Manage staging/production promotion controls.
- Monitor release health and support rollback.

Hands off to steady-state ownership when:
- Rollout is complete.
- Runtime health is stable.
- Operational follow-ups are created.

## RACI-style summary (simplified)
- Ticket definition: Product (A), Senior Engineer (C), Engineer (C), QA (I), Platform (I)
- Implementation: Engineer (A/R), Senior Engineer (C), QA (I), Platform (I)
- PR review and merge gate: Senior Engineer (A/R), Engineer (R), QA (I)
- Staging QA: QA (A/R), Engineer (R), Senior Engineer (C)
- Rollout: Platform/Release owner (A/R), Engineer (R), QA (C)
- Post-release monitoring: Platform + Engineer (R), Senior Engineer (C), Product (I)

Legend:
- R = Responsible (does work)
- A = Accountable (final owner)
- C = Consulted
- I = Informed

## Common failure patterns to avoid
- Vague tickets that force engineers to infer product intent.
- PRs merged with unresolved high-severity review concerns.
- Treating staging validation as optional when CI is green.
- Releasing to 100% traffic without canary/flag guardrails.
- No explicit post-release observation window.
