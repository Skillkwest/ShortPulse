# AI Studio Properties Panels Modularization Program

> Archived on 2026-04-27 during docs cleanup because this completed modularization program is retained as historical execution context after delivery, with the durable workflow contract preserved in `docs/adr/0042-ai-studio-properties-panel-workflow-contract.md`.

Date: 2026-02-23
Owner: Frontend Engineering
Status: complete

## Summary
This program hardens AI Studio properties-panel architecture into explicit workflow modules with canonical tool identity and robust beginner-mode persistence.

Goals:
1. Keep primary toolbar mapping stable and test-protected.
2. Remove dead character panel wiring from AI Studio page orchestration.
3. Normalize legacy tool aliases to canonical workflow identity.
4. Harden beginner-mode preference updates against async race rollbacks.
5. Preserve behavior while reducing coupling and future regression risk.

## Scope Lock
In scope:
1. Create/edit/video/character panel routing and modular prop composition.
2. Canonical workflow identity helpers with alias compatibility.
3. Beginner-mode sync-state exposure and race-safe persistence.
4. Test matrix expansion for routing and preference synchronization.
5. AI Studio docs/ADR updates for architectural durability.

Out of scope:
1. Backend schema/API/provider changes.
2. Route-layer migration away from Next.js Pages Router.
3. New dependency/framework additions for state machines or plugin runtime.

## Canonical Workflow Contract
Canonical workflow IDs:
1. `create`
2. `edit`
3. `video`
4. `character`
5. `none`

Alias mapping:
1. `create | text -> create`
2. `edit | image -> edit`
3. `video | kling -> video`
4. `character | canvas -> character`

Behavioral compatibility:
1. Primary re-click toggle-off remains enabled.
2. `canvas` remains supported as legacy alias in this cycle.
3. Workflow settings storage key remains unchanged.

## Implementation Workstreams
1. Workflow identity layer:
   1. Add canonical workflow helpers.
   2. Migrate targeted hotspot branching to workflow predicates.
2. Panel modularization:
   1. Replace duplicated panel switch rendering with internal registry.
   2. Split panel-prop composition into create/edit/video hooks.
   3. Remove dead `propertiesCharacter` path from AI Studio page content.
3. Beginner-mode robustness:
   1. Add `syncState` to preference hook.
   2. Add write-version guarding for stale async failures.
   3. Apply explicit workflow beginner policy object for panel props.
4. Validation and guardrails:
   1. Extend routing/policy/persistence tests.
   2. Run lint/type-check/build and targeted suites.

## Public Interface Changes
1. Added workflow identity helpers and canonical normalization.
2. Added beginner preference `syncState` and exported `BeginnerSyncState`.
3. Removed unused `propertiesCharacter` prop from `AiStudioPageContent`.
4. Added internal panel registry render model keyed by canonical workflow ID.

## Acceptance Criteria
1. Primary toolbar mapping opens correct panel for create/edit/video/character.
2. Character workflow remains embedded through `CharacterManagerShell`.
3. Beginner mode persistence is race-safe and exposes sync lifecycle.
4. No regressions in generation, reference ingest, or character mode injection.
5. No new runtime dependency bloat.

## Test Matrix
1. `workflowIdentity` canonical + alias matrix tests.
2. `propertiesPanelRouting` canonical + alias matrix tests.
3. Toolbar character mapping and toggle-off behavior tests.
4. Beginner preference hook tests (including stale async write failure path).
5. Existing character-mode and AI Studio integration suites remain green.

## Risks and Mitigations
1. Risk: alias migration breaks legacy assumptions.
   1. Mitigation: keep alias compatibility and add mapping tests.
2. Risk: beginner async persistence regressions.
   1. Mitigation: write-version guard + hook tests.
3. Risk: page-content refactor introduces render regressions.
   1. Mitigation: registry stays local and behavior-preserving; drop tests retained.

## Completion Evidence
1. Code changes merged under this program.
2. Test/lint/type/build results recorded in tracker.
3. ADR finalized and linked.
