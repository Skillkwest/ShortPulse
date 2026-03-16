# Workflow: Feature Delivery

Purpose: run a new feature request through a production-style lifecycle with checklist gates.

Status: Working, non-authoritative planning/lab workflow.

## Inputs
- Feature/request trigger.
- Relevant product context and constraints.

## Ordered execution flow
1. Run `templates/feature-intake-template.md`.
2. Evaluate Gate A.
3. Run `templates/implementation-pr-template.md` during build/PR work.
4. Evaluate Gate B and Gate C.
5. Run `templates/review-template.md` and capture review outcome.
6. Confirm CI checks and re-evaluate Gate C.
7. Run `templates/qa-release-template.md` on staging and rollout prep.
8. Evaluate Gate D.
9. Execute controlled rollout and observation window.
10. Run `templates/post-release-template.md`.
11. Evaluate Gate E and log follow-up actions.

## Gate checklist summary
### Gate A (Ready to implement)
- [ ] Scope and non-goals documented.
- [ ] Acceptance criteria testable.
- [ ] Dependencies/risks noted.

### Gate B (Ready for review)
- [ ] Implementation complete for scoped requirements.
- [ ] PR notes include what changed and risks.
- [ ] Local checks completed.

### Gate C (Ready to merge)
- [ ] Review concerns resolved.
- [ ] Required CI checks pass.
- [ ] No unresolved blocking comments.

### Gate D (Ready to release)
- [ ] Staging QA complete for critical path.
- [ ] Rollout method selected (flag/canary/ring).
- [ ] Rollback trigger and path documented.

### Gate E (Release complete)
- [ ] Observation window completed.
- [ ] Post-release health reviewed.
- [ ] Follow-up tasks captured.

## Outputs
- Completed checklists for all stages.
- Clear gate decisions (A-E).
- Post-release follow-up backlog notes.
