# 2026-06-19 Creative library selection scope

- Lane: Creative Libraries, clean Character Manager seam after higher-priority rows were handoff/proof/owner gated.
- Touched: `frontend/features/character-manager/hooks/useCharacterManagerBootstrapController.ts`, `frontend/features/character-manager/hooks/__tests__/useCharacterManagerDraft.test.ts`.
- Change: Character Manager bootstrap no longer reads unscoped persisted selected-character ids when authenticated user scope is unavailable.
- Validation: `npm -C frontend test -- --run features/character-manager/hooks/__tests__/useCharacterManagerDraft.test.ts` passed, `1` file / `26` tests; path-bounded `git diff --check` passed.
- Boundary: local source hardening only; Creative Libraries still need stable authenticated save/reopen/select/reuse proof before readiness lift.
