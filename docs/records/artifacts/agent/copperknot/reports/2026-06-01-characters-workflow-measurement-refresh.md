# Characters Workflow Measurement Refresh

Date: 2026-06-01

## System

- `Characters workflow`

## Evidence Class

- Repo-durable measurement/tooling refresh.
- Production Character Mode model-picker verification on `https://www.shortpulse.ai`.
- Production Character Manager save/reopen continuity verification on `https://www.shortpulse.ai`.

## What Changed

- Updated the page-level Character Mode test to exercise the current AI Studio route runtime instead of the dynamic page wrapper.
- Updated the Character Mode test fixture to match the current output-store contract.
- Updated the production Character Mode model-picker audit to wait for the current Create composer and read the current model-chip DOM contract.
- Added `test:e2e:character-mode-model-picker` as the package script for the production audit.
- Added `test:e2e:character-manager-save-reopen` as the production save/reopen continuity audit. It creates a disposable character with a reference image, verifies the character appears before and after reload, and deletes the audit fixture.

No product UI, UX, intended behavior, or runtime feature code changed in this pass.

## Proof

- `./node_modules/.bin/eslint tests/pages/ai-studio.character-mode.test.tsx tests/e2e/ai-studio-character-mode-model-picker.audit.js` passed.
- `npm run test:character-panel` passed: 9 files, 82 tests.
- Focused Character/AI Studio Vitest bundle passed: 10 files, 67 tests.
- `PLAYWRIGHT_BASE_URL=https://www.shortpulse.ai npm run test:e2e:character-mode-model-picker` passed.
- Production model-picker audit captured 5 Character Mode chips: `Seedream 4.5`, `Seedream 5 Lite`, `Nano Banana 2`, `Nano Banana Pro`, and `ChatGPT Image 2`.
- `PLAYWRIGHT_BASE_URL=https://www.shortpulse.ai npm run test:e2e:character-manager-save-reopen` passed at `2026-06-01T01:14:48.419Z`.
- The production save/reopen audit created `Copperknot Audit 1780276479758` with `frontend/public/brand-logo.png` as a reference image, verified it appeared before reload, verified it appeared after reload/reopen, and deleted the audit fixture.
- `npm -C frontend run docs:check` passed.

## Decision

- Move `Characters workflow` to `6/10`, at ship floor.
- This pass proves the Character Mode model-picker lane, local Character/AI Studio guards, and production Character Manager save/reopen continuity with a real reference image.
- Do not move above floor. The pass found a residual Character Library delete-confirmation hit-test risk: the confirmation is visible, but normal Playwright pointer clicks were intercepted by the library card layer, so the audit used a DOM click for cleanup.

## Next Proof

If the Characters lane reopens, the next source-level proof is a Character Library delete-confirmation layering audit/fix. Otherwise, the launch-readiness queue should move to `Elements workflow`.
