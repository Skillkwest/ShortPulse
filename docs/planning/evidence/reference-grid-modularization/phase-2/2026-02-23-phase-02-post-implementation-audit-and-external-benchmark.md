# Phase 2 Post-Implementation Audit + External Best-Practice Benchmark

Date: 2026-02-23
Owner: Frontend
Authority: Working
Scope: Audit of Phase 1 (`ba37eadb`) and Phase 2 (`4a35d819`) deliverables before Phase 3 kickoff.

## Verification Baseline
- Branch: `reference-grid-audit`
- Working tree: clean
- Commits audited:
  - `ba37eadb` (Phase 1 domain core + governance docs)
  - `4a35d819` (Phase 2 ingestion unification)
- Validation run:
  - `npm -C frontend run type-check`
  - `npm -C frontend run check:architecture-boundary`
  - `npm -C frontend run docs:check`
  - `npm -C frontend run test -- features/ai-studio/reference-domain/__tests__/referenceDomain.reducer.test.ts features/ai-studio/reference-domain/__tests__/referenceDomain.adapters.test.ts features/ai-studio/reference-ingestion/__tests__/buildFromInput.test.ts features/ai-studio/hooks/__tests__/useAiStudioWorkspaceActions.test.ts features/ai-studio/hooks/__tests__/useAiStudioState.outputStoreBridge.test.tsx`

## Delta Findings (Misses)

### High
1. Library full/preview URL semantics are still incomplete in canonical ingestion.
- `buildFromInput.ts` accepts `payload.fullUrl` but does not use it.
- Current mapping can still collapse full-vs-preview behavior when only one URL path is used.
- Evidence: `frontend/features/ai-studio/reference-ingestion/types.ts:40`, `frontend/features/ai-studio/reference-ingestion/buildFromInput.ts:119`, `frontend/features/ai-studio/reference-ingestion/buildFromInput.ts:121`

2. File ingestion source tagging is not behaviorally consumed downstream.
- `source` (`filePicker` vs `drop`) is passed to ingestion, but lower-level file mapping receives no source and applies one timestamp semantics.
- This limits parity enforcement across ingress sources.
- Evidence: `frontend/features/ai-studio/reference-ingestion/buildFromInput.ts:235`, `frontend/features/ai-studio/logic/stateParsers.ts:197`, `frontend/features/ai-studio/logic/stateParsers.ts:235`

### Medium
3. Ingestion acceptance matrix tests are incomplete for source parity.
- Current tests validate file ingestion routing for `filePicker`, but not explicit `drop` parity assertions in the canonical ingestion suite.
- Evidence: `frontend/features/ai-studio/reference-ingestion/__tests__/buildFromInput.test.ts:49`

4. Reference-domain reducer can perform avoidable write churn on repeated `addMany`.
- `addMany` compares object identity and can re-write equivalent entities when new wrappers are passed, increasing state version churn risk.
- Evidence: `frontend/features/ai-studio/reference-domain/reducer.ts:120`

5. Keyboard curated reorder coverage remains open at flow level.
- Domain reorder tests exist, but end-user keyboard interaction parity for quick-slot reorder is not yet proven in curated UI suites.
- Evidence: `frontend/features/ai-studio/reference-domain/__tests__/referenceDomain.reducer.test.ts:48`, `frontend/features/ai-studio/components/__tests__/ReferenceCanvas.curated.test.tsx:488`

### Low
6. Size-target budgets remain in warn lane and are currently over target on legacy hotspots.
- This is expected for current phase ordering, but still an active debt item.
- Evidence: `scripts/check_size_budgets.js:68`, `frontend/features/ai-studio/components/ReferenceCanvas.tsx`, `frontend/features/ai-studio/components/MediaLibraryModal.tsx`, `frontend/features/ai-studio/hooks/useAiStudioState.ts`

## External Best-Practice Benchmark (Official Sources)

### Aligned
1. Reducer extraction and purity model
- Current direction aligns with React guidance to centralize complex state transitions in reducers and keep reducer logic pure.
- Source: https://react.dev/learn/extracting-state-logic-into-a-reducer

2. Normalized state shape and ordered id lists
- `ids + entities + projection id arrays` matches Redux normalized-state guidance.
- Source: https://redux.js.org/usage/structuring-reducers/normalizing-state-shape

3. Discriminated union direction
- `ReferenceEntity` kind-based union follows TypeScript discriminated-union best practice.
- Source: https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html

4. Strangler migration style with compatibility adapters
- Phase-by-phase replacement with rollbackable compatibility paths aligns with Strangler Fig modernization practice.
- Source: https://martinfowler.com/bliki/StranglerFigApplication.html

### Partially Aligned
5. Entity adapter ergonomics (selectors + CRUD helpers)
- Current reducer/selectors are custom and correct, but do not yet provide equivalent adapter ergonomics (uniform CRUD helper surface + selector generation discipline).
- Source: https://redux-toolkit.js.org/api/createEntityAdapter

6. Tests should resemble user behavior
- Strong unit coverage exists, but there is still no single end-to-end interaction coverage for full ingress-to-projection behavior.
- Source: https://testing-library.com/docs/guiding-principles

7. Keyboard-first reorder accessibility
- Pointer reorder behavior exists; keyboard parity is not yet fully validated for quick-slot inventory.
- Sources:
  - https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
  - https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-rearrangeable/

8. Drag/drop data contracts
- Existing code uses custom drag payloads; phase plan should enforce explicit payload contract tests across all producers/consumers to match MDN guidance on `DataTransfer` types and allowed read/write windows.
- Sources:
  - https://developer.mozilla.org/docs/Web/API/HTML_Drag_and_Drop_API
  - https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/types

9. Object URL lifecycle hygiene
- Cleanup mechanisms exist, but this remains a hard no-regression guardrail during decomposition and should stay in mandatory test coverage.
- Source: https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static

10. Flag lifecycle governance
- Program includes temporary-flag policy, but enforcement automation is still manual; adding automated expiry/owner checks remains best-practice-aligned debt.
- Source: https://docs.getunleash.io/concepts/feature-flags

## Required Additions Before Phase 3 Promotion
1. Add ingestion test cases that explicitly assert `filePicker` vs `drop` parity behavior under canonical ingestion.
2. Decide and document full-vs-preview URL precedence for `libraryMedia` input (`fullUrl`, `previewUrl`, `fullStoragePath`, `previewStoragePath`) and add contract tests.
3. Add one integration test that covers: media-library select -> reference insertion -> quick-slot reorder -> archive/restore.
4. Add at least one keyboard-driven quick-slot reorder test path in curated UI behavior tests.
5. Keep Phase 3 in planned state until items 1-4 are complete or explicitly waived in tracker decision log.

## Promotion Decision
- Status: Conditional hold for Phase 3 kickoff.
- Rationale: Foundation is strong and green, but parity-hardening items above should close first to maintain no-regression standard.
