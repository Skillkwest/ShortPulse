# Copperknot checkpoint scratchpad: project workspace route failure invariants

Time: 2026-06-17 09:06 MST

Lane:
- `Projects and workspace restore`, queue priority 9.
- Higher-priority rows skipped because they are handed off, active Media-owned, or gated by production/provider/approval proof.

Touched:
- `frontend/tests/api/projects-create.test.ts`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/systems/launch-fitness-scorecard-2026-06-16.md`

Did:
- Added focused route tests proving project workspace read and reset failures return structured `500` responses with route labels, failure stages, and log metadata.
- Updated launch-control wording without lifting score/state.

Validation:
- `npm -C frontend run test -- --run tests/api/projects-create.test.ts` passed: `32` tests.
- `npm -C frontend run type-check:touched` passed.
- `git diff --check` passed before docs update.

Proof boundary:
- Local route-observability invariant only; this does not prove stable save/open/restore or authenticated production project persistence.
