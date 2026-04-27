# D1-02 Agent Bridge Reset Hardening (2026-03-17)

- `slice_id`: `D1-02`
- `date_utc`: `2026-03-17`
- `scope`: `Remove the agent-bridge reset effect warning by keying bridge-owned UI state to session context and extend direct hook coverage`
- `linked_pr`: `none`

## Commands Run
1. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioAgentBridge.test.ts`
2. `npm -C frontend run lint`
3. `cd frontend && npx eslint pages features lib --ext .ts,.tsx,.js,.jsx --rule 'react-hooks/set-state-in-effect:error' --rule 'react-hooks/exhaustive-deps:error'`
4. `npm -C frontend run type-check`
5. `npm -C frontend run build`
6. `npm -C frontend run check:architecture-boundary`
7. `npm -C frontend run check:size-budget`
8. `npm -C frontend run docs:check`

## Results
1. Targeted bridge test: pass (`1` file, `1` test).
2. `lint`: pass with `4` warnings.
3. Strict runtime lint profile: fail with `2` errors and `2` warnings.
4. `type-check`: pass.
5. `build`: pass.
6. `check:architecture-boundary`: pass.
7. `check:size-budget`: pass in warn mode; pre-existing reference-grid warnings unchanged.
8. `docs:check`: pass.

## Warning Inventory Before After
Before:
1. `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts:233`
   - `react-hooks/set-state-in-effect`.
2. Global lint baseline: `6` warnings.
3. Strict runtime lint profile: `3` errors, `3` warnings.

After:
1. `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`
   - no `react-hooks/set-state-in-effect` warning remains.
2. Global lint baseline: `4` warnings.
3. Strict runtime lint profile: `2` errors, `2` warnings.
4. Remaining strict-runtime error surfaces:
   - `frontend/features/ai-studio/components/DetailModal.tsx:310`
   - `frontend/features/ai-studio/components/DetailModal.tsx:328`

## Suppression Delta
1. No suppression changes in `D1-02`.
2. `frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts:359` remains deferred to `D2-01`.

## Failure Modes Asserted
1. Bridge-owned UI state (`latestAgentPrompt`, `promptOrigin`, `agentActions`, `isAgentChatOpen`) now resets by session-context key instead of direct effect setters.
2. Composer reset behavior still runs when `sessionId`, `selectedTool`, or `mode` changes.
3. The direct hook test now proves bridge-owned UI state is repopulatable and then reset by session-context rerender.
4. No behavior drift was introduced in the bridge public contract.

## LOC Delta Summary
1. `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`: `329 -> 402`
2. `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentBridge.test.ts`: `178 -> 224`
3. Rationale for LOC growth:
   - the warning removal required a keyed state surface plus typed dispatch wrappers,
   - the seam stayed inside the bridge hotspot and replaced effect-driven reset work with an explicit state model,
   - the primary file remains under the repo’s ~500-line guideline.

## Rollback Note
1. Revert this slice if session/tool/mode changes stop clearing bridge-owned UI state or break agent chat interactions.
2. If rollback is required, restore the prior direct reset effect only as a temporary recovery step while a cleaner reset model is prepared.
