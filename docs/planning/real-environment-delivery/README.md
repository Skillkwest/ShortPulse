# Real Environment Delivery Mini-Project

Purpose: build a practical, company-style operating model for how features move from idea to production in ShortPulse.

Status: Working (planning artifact).

## Why this exists
- Convert "how real teams work" into concrete, reusable process docs.
- Clarify handoffs between product, engineering, QA, and ops.
- Make release quality gates explicit instead of informal.

## Scope
- End-to-end delivery flow (idea -> ticket -> implementation -> review -> validation -> release -> monitoring).
- Roles and ownership boundaries.
- Required artifacts and decision gates.

## Out of scope (for now)
- Team-specific staffing model and org chart.
- SLA/SLO numeric commitments.
- Detailed on-call rotations and pager policy.

## Files in this mini-project
- `in-practice-flow.md`: real-world 7-step delivery flow with expected outcomes.
- `roles-and-handoffs.md`: responsibilities, handoff criteria, and anti-patterns by role.
- `artifacts-and-gates.md`: required artifacts, pass/fail checks, and maturity rubric.

## How to use this package
1. Start with `in-practice-flow.md` to align on the baseline operating model.
2. Use `roles-and-handoffs.md` to assign clear ownership for each step.
3. Use `artifacts-and-gates.md` to convert agreement into auditable checks.
4. Promote stable sections to SOPs under `docs/sops/` as they harden.

## External references used for this baseline
- GitHub Flow and pull request/review mechanics.
- GitHub branch protection and status checks.
- Staged/protected deployments and required reviewers.
- Progressive rollouts/feature flags.
- SRE-style monitoring and incident response.
- DORA delivery/reliability metrics.

Reference links are listed inline in `artifacts-and-gates.md`.
