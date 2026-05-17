Source-only file. Open the rich view here: `docs/records/artifacts/agent/copperknot/reports/2026-05-16-managed-lane-review-and-reference-grid-clear.html`

# Managed Lane Review And Reference Grid Clear

Date: `2026-05-16`

Scope: review the managed Copperknot subagent closeouts for:

- `Reference Grid` runtime verification rerun
- `Project / workspace persistence`
- `Edit workflow` second bounded hardening pass

## Decisions

### `Reference Grid`

- previous score: `6/10`
- new score: `7/10`
- decision: move to ship floor and clear `KI-AI-RG-STYLES-001`

Why:

- fresh browser runtime evidence now exists for the internal `Reference Grid -> Styles` drag/drop path
- the protected-route audit account entered `/ai-studio?perfAuditRuntime=1` successfully
- the internal drag/drop flow created a new style tile in-browser
- the intentionally external blocked-source path still failed in the expected deterministic way
- targeted owned-surface tests remained green

What did **not** change:

- no product code patch was needed in this rerun
- the checked-in `test:e2e:style-drop` harness still needs a tooling-only follow-up because it enters plain `/ai-studio` instead of the perf-runtime route

### `Project / workspace persistence`

- previous score: `6/10`
- new score: `6/10`
- decision: hold score

Why:

- the bounded patch is real and valuable
- eager project-generation association now fails closed when the generation id is not user-owned
- focused persistence tests passed
- but the lane did not yet provide enough broader production-trust evidence to justify lifting the whole system to floor

### `Edit workflow`

- previous score: `6/10`
- new score: `6/10`
- decision: hold score

Why:

- the bounded seam hardening is real and valuable
- prompt-reference submission preparation now uses one shared token-analysis pass
- seam-level and integration tests were added and passed
- but the lane intentionally stayed away from the larger dirty runtime files and the broader panel/runtime risk still remains

## Validation Anchors

### `Reference Grid`

- `cd frontend && set -a && source .env.local && set +a && PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e:style-drop`
- direct Playwright runtime verification against `/ai-studio?perfAuditRuntime=1`
- `cd frontend && npm run test -- features/ai-studio/components/style-creator/__tests__/intake.test.ts features/ai-studio/components/style-creator/__tests__/characterization.test.ts features/ai-studio/components/style-creator/__tests__/internalDropResolver.test.ts features/ai-studio/components/__tests__/StylesLibraryPanel.test.tsx features/ai-studio/hooks/__tests__/useAiStudioInternalDropResolvers.test.ts`

### `Project / workspace persistence`

- `npm run test -- lib/server/__tests__/projectGenerationAssociationsService.test.ts`
- `npm run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts`

### `Edit workflow`

- `npm -C frontend run test -- expertEditSubmissionPreparation`
- `npm -C frontend run test -- expertEditPromptReferences`

## Next Copperknot Outcome

- remove `Reference Grid` from the active blocker set
- move `Reference Grid` to at-floor validation
- keep `Project / workspace persistence` in Copperknot review state, not user-facing paste state
- keep `Edit workflow` in Copperknot review state, not user-facing paste state
- move the operator brief to the next open lanes:
  - `Characters workflow`
  - `Elements workflow`

## Optional Follow-Up

- tooling-only follow-up: align `frontend/tests/e2e/ai-studio-style-drop.audit.js` with the perf-runtime route so the checked-in audit command stops producing a false negative
