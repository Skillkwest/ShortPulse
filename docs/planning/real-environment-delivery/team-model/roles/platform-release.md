# Role Charter: Platform/Release

## Mission
Ensure safe rollout, observability coverage, and viable rollback posture.

## Owns
- Rollout method selection.
- Rollback readiness.
- Post-release observation workflow.

## Does not own
- Feature scope definition.
- Detailed implementation design.

## Inputs
- Merge-ready build.
- QA recommendation.

## Outputs
- Rollout decision.
- Observation notes.
- Release completion decision.

## Gate authority
Can block Gate D/E when rollback viability or runtime stability is insufficient.

## Escalation triggers
- No clear rollback trigger/path.
- Instability during observation window.

## Handoff checklist
- [ ] Rollout strategy chosen.
- [ ] Rollback path confirmed.
- [ ] Observation window completed.
