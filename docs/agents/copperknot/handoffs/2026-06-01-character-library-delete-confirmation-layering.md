# Next-Agent Handoff: Character Library Delete Confirmation Layering

## Lane Id

`character-library-delete-confirmation-layering`

Purpose: fix or conclusively characterize the Character Library delete-confirmation hit-test layering risk found during production save/reopen verification.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded source-level bug investigation/fix lane.
- Do not redesign Character Library, Character Manager, picker cards, modal styling, or deletion semantics.

## Why This Task

- System: `Characters workflow`
- Current score after latest Copperknot review: `6/10`
- Ship floor: `6/10`
- Evidence packet: `docs/records/artifacts/agent/copperknot/reports/2026-06-01-characters-workflow-measurement-refresh.md`
- Production save/reopen continuity passed on `https://www.shortpulse.ai`, but the audit found a residual delete-confirmation hit-test risk:
  - the Character Library delete confirmation was visible
  - normal Playwright pointer clicks on the confirmation `Delete` button were intercepted by the Character Library card layer
  - the audit used a DOM click only for cleanup, not as product proof

## Scoped Task

Trace the modal/layering source of the Character Library delete-confirmation pointer interception and make the smallest source-level fix that restores normal pointer-click behavior without changing intended UI/UX or deletion behavior.

## Owned Write Surface

- Character Manager delete-confirmation rendering path
- Character Library picker modal layering/portal interaction
- Confirmation modal stacking/backdrop behavior only if it is the source seam
- Targeted tests and the existing production audit guard

## Avoid Surface

- No Character Manager redesign
- No Character Library visual restyling beyond a necessary source-level layering fix
- No changes to character save/reopen persistence semantics
- No broad AI Studio modal system rewrite unless the root cause is proven there
- No unrelated Elements, Create, Project, media, billing, or storage work

## Required Context

Read first:

- `docs/systems/catalog.md`
- `docs/sops/sop_character_manager_operations.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-06-01-characters-workflow-measurement-refresh.md`

Inspect first:

- `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`
- `frontend/features/ai-studio/components/picker/AiStudioPickerPrimitives.tsx`
- the shared `ConfirmationModal` implementation
- `frontend/tests/e2e/character-manager-save-reopen.audit.js`

## Questions To Answer

1. Which element is actually intercepting the pointer event?
2. Is the confirmation modal rendered inside the picker modal layer when it should be above it?
3. Is the issue caused by stacking context, portal order, z-index, pointer-events, or event delegation?
4. Can the fix be made at the owning modal/layer source instead of adding test-only workarounds?

## Expected Output

- Preferred: one bounded source-level fix with targeted regression coverage and the production audit using normal pointer clicks for cleanup.
- Acceptable: one findings packet proving the root cause and explaining why the fix should belong to a wider modal-layer authority surface.

## Suggested Validation

From `frontend/`:

```bash
./node_modules/.bin/eslint tests/e2e/character-manager-save-reopen.audit.js
npm run test:character-panel
PLAYWRIGHT_BASE_URL=https://www.shortpulse.ai npm run test:e2e:character-manager-save-reopen
```

If docs change:

```bash
npm -C frontend run docs:check
```

## Acceptance Criteria

- The production audit no longer needs DOM-click cleanup for the Character Library delete path.
- A normal pointer click can activate the visible delete confirmation button.
- Character Manager save/reopen continuity still passes.
- No intended UI/UX or deletion semantics change.
- Any remaining risk is named with exact source evidence.

## Stop Rules

- Stop if the fix would require broad modal-system redesign without proving the source seam.
- Stop if the only possible next proof depends on commit, push, redeploy, or release operations outside the execution agent's lane.
- Stop if investigation shows the issue is test-environment-only and cannot be reproduced through normal browser pointer behavior; provide evidence instead of patching.

## Closeout

Return:

- what changed or what root cause was proven
- validation run and results
- whether production cleanup now uses normal pointer clicks
- residual risk
- exact next step if unresolved
