# Mini Production SOP (Solo, Multi-Role)

Purpose: provide a complete, practical operating procedure for running delivery work like a production team while one person wears multiple role hats.

Status: Working, non-authoritative planning/lab SOP.

## Operating model
- One operator, seven role hats, one shared gate system.
- Use the same lifecycle for every change to avoid ad hoc execution.
- Keep artifacts lightweight: checklist-first with short notes.

## Role hats in scope
1. Product
2. Engineer
3. Senior Engineer
4. QA Engineer
5. Platform/Release
6. Security Reviewer
7. Product Design

Role details and handoffs are defined in `team-model/roles/`.

## Lifecycle stages
1. Work item definition (ticket/spec).
2. Implementation branch + PR.
3. Senior/peer review gate.
4. CI verification gate.
5. Staging + QA validation.
6. Controlled release.
7. Post-release monitoring + feedback.

## Gate model contract (A-E)
- Gate A: Ready to implement.
- Gate B: Ready for review.
- Gate C: Ready to merge.
- Gate D: Ready to release.
- Gate E: Release complete.

A gate may be marked `PASS`, `HOLD`, or `FAIL`.

## Solo hat-switching protocol
1. Explicitly declare active hat at each gate checkpoint.
2. Complete that hat's checklist before switching hats.
3. For any `HOLD`/`FAIL`, document reason and required fix under the active hat.
4. Resume progression only when blocking checklist items are cleared.

## Escalation protocol
- If two hats conflict, use `decision-precedence.md` to resolve.
- If unresolved after precedence rules, mark gate `HOLD` and log a decision note before continuing.
- Security and release risks can block progression at any gate.

## Required artifacts per change
- Feature intake checklist.
- Implementation/PR checklist.
- Review checklist.
- QA/release checklist.
- Post-release checklist.

Use templates under `templates/`.

## Workflow entry points
- Feature changes: `workflow-feature-delivery.md`.
- Baseline quality audits: `workflow-codebase-audit.md`.

## Minimum completion rule
A change is complete only when:
- Gates A-E are all `PASS`, or
- Explicitly deferred items are documented with owner/date in post-release notes.
