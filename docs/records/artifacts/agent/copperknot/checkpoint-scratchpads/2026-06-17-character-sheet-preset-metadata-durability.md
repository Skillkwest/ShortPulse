# Copperknot checkpoint scratchpad: Character Sheet preset metadata durability

Time: 2026-06-17 09:10 MST

Lane:
- `Creative libraries`, queue priority 13.
- Higher-priority rows skipped because they are handed off, active Media-owned, or gated by production/provider/auth/spend proof.

Touched:
- `frontend/features/character-manager/logic/__tests__/characterManagerPersistenceCore.test.ts`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/systems/launch-fitness-scorecard-2026-06-16.md`

Did:
- Added a focused Character Manager invariant proving serialized Character Sheet preset metadata persists durable storage paths and preview variant paths, not signed preview URLs.
- Updated launch-control wording without lifting score/state.

Validation:
- `npm -C frontend run test -- --run features/character-manager/logic/__tests__/characterManagerPersistenceCore.test.ts` passed: `6` tests.
- `npm -C frontend run test -- --run features/character-manager/logic/__tests__/characterManagerPersistenceCore.test.ts features/character-manager/logic/__tests__/characterManagerPersistence.presets.test.ts features/character-manager/logic/__tests__/characterSheetPresetTabs.test.ts features/ai-studio/logic/__tests__/characterModePayload.test.ts` passed: `29` tests across `4` files.
- `npm -C frontend run type-check:touched` passed.
- `npm -C frontend run docs:check` passed.
- `git diff --check` passed.

Proof boundary:
- Local metadata-durability invariant only; this does not prove integrated authenticated library save/reopen/select/reuse.
