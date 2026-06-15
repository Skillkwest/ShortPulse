# AI Studio Large-Project Canvas Responsiveness Handoff

Date: 2026-06-15

From: Enate Ende, right-rail Canvas steward

To: Datserok, project persistence and project workspace steward

## Purpose

This is a start-here handoff, not a completed Datserok audit.

The user reported that in a large AI Studio project, ordinary Canvas actions can overload or crash the browser: clicking references, clicking text, typing text, adding items, panning, zooming, and dragging. The same user testing previously found that much smaller projects do not show Canvas lag. Enate's no-edit audit suggests the visible trigger is Canvas, but the likely root pressure crosses into large-project workspace autosave, project output snapshot composition, media authority reconciliation, and Reference Grid density.

Datserok should treat this as a launch-relevant project-size responsiveness investigation with a project-persistence seam, not as a Canvas-only interaction bug.

## Why This Belongs On Datserok's Radar

Datserok owns project workspace save/restore authority and the distinction between durable project state, user-global state, and runtime-only state.

This issue touches Datserok's lane because project workspace persistence currently composes autosave snapshots from AI Studio state that includes Canvas session state. Even if persistence correctly strips transient Canvas editing state before saving, the expensive project snapshot path may still be invalidated by transient Canvas interactions before that stripping happens.

This is not a request for Datserok to take over Canvas, Reference Grid, or media display behavior. It is a request for Datserok to audit whether project workspace persistence and large-project snapshot composition are being woken unnecessarily by Canvas interactions.

## Current Evidence From Enate's Audit

Observed/reasoned evidence:

- Small projects reportedly have no Canvas lag; large projects do.
- The Canvas renderer already has local protections such as viewport culling, memoized item views, ghost dragging, and CSS containment tests.
- The main suspected cost is not "Canvas forgot to virtualize," but "Canvas interactions wake global project/media systems."
- Live production browser access opened a fresh non-project AI Studio session with no Canvas items and no perf runtime, so Enate did not obtain production reproduction proof for the affected large project.
- No edits were made during Enate's audit.

Relevant source seams Enate inspected:

- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
  - `canvasSessionState` comes from the dual Canvas workspace state.
  - Media reconciliation effects depend on the full `canvasSessionState`.
  - Those effects call `getOutputSnapshot()`, scan active and archived output ids, resolve projection ids, and may call `hydrateCanvasSessionState(...)`.
- `frontend/features/ai-studio/hooks/useAiStudioPageProjectSessionRuntime.ts`
  - `buildProjectAwareBaseSessionSnapshot` patches `buildProjectWorkspaceSnapshot(...)` with `canvasSessionState`.
  - Its dependency list includes the full `canvasSessionState`.
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`
  - Base snapshot build, session snapshot compose, and autosave candidate selection are measured performance phases.
  - These phases scale with project/output snapshot size.
- `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`
  - `createProjectDurableAiStudioSessionCanvasState(...)` strips transient draft/edit state before project persistence.
  - This is good for persisted data shape, but it does not by itself prove transient state avoids upstream expensive recomputation.
- `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
  - `sessionState` includes `items`, `draftTextEntry`, `textEditSession`, owner ids, and both cameras.
- `frontend/features/ai-studio/components/canvas/useCanvasViewportTextHandlers.ts`
  - Draft typing and text editing update shared Canvas state on each change.
- `frontend/features/ai-studio/logic/perfAuditGates.ts`
  - Existing project workspace autosave typing gates already encode the desired posture that draft-like text work should not cause autosave snapshot builds.

## Working Hypotheses To Re-Audit

Datserok should prove or disprove these from current code and, if possible, runtime counters:

1. Transient Canvas state changes are invalidating project workspace snapshot composition.
   - Examples: draft text typing, text edit sessions, selection, camera changes, pan/zoom.
   - Expected durable contract: transient Canvas interaction should not trigger large project autosave work unless durable board content actually changes.

2. Canvas media repair effects are subscribed too broadly.
   - Current risk: effects depending on full `canvasSessionState` rerun on draft/edit/camera changes even when media identity did not change.
   - Expected durable contract: media repair should depend on durable Canvas media authority signatures, not all Canvas interaction state.

3. Large project size amplifies every accidental wake-up.
   - Current risk: `getOutputSnapshot()` and projection scans are cheap in small projects but expensive in large projects.
   - Expected durable contract: large output count should not make a Canvas text click or pan scan the full output set.

4. Existing perf gates may not cover Canvas-specific transient interactions.
   - Current risk: prompt/reference text typing audits exist, but Canvas draft/edit/pan/zoom may not be included.
   - Expected durable contract: Canvas-specific perf probes should assert no autosave/media repair wake-up for transient interactions.

## Datserok's Recommended Audit Path

Start with Datserok's normal runtime load policy, then load only the source needed for this lane.

Recommended first Datserok-owned files:

- `docs/agents/datserok/runtime-load-policy.md`
- `docs/agents/datserok/project-persistence-source-map.md`
- `docs/sops/sop_ai_studio_projects_foundation.md`
- `docs/adr/0089-large-project-persistence-hybrid-checkpoint-and-output-display-records.md`
- `frontend/features/ai-studio/hooks/useAiStudioPageProjectSessionRuntime.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`
- `frontend/features/ai-studio/logic/perfAuditGates.ts`

Then inspect adjacent, not-owned-by-Datserok seams only as needed:

- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
- `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportTextHandlers.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts`
- `frontend/features/ai-studio/hooks/useReferenceGridPerfWatchdog.ts`
- `frontend/features/ai-studio/logic/referenceGridVirtualization.ts`

## Specific Questions Datserok Should Answer

1. Does a Canvas draft text keystroke cause `buildProjectAwareBaseSessionSnapshot` to change identity or rerun?

2. Does a Canvas text edit keystroke cause project autosave counters to increment?

3. Does Canvas pan or zoom cause project workspace snapshot composition, autosave candidate selection, or serialized snapshot preparation?

4. Does Canvas selection/clicking cause media repair effects to call `getOutputSnapshot()`?

5. Do media repair effects need full `canvasSessionState`, or can they depend on a derived media-only signature?

6. Should project persistence receive a derived durable Canvas state/signature instead of raw live Canvas session state?

7. Are current autosave/perf gates sufficient, or should Datserok add Canvas-specific project workspace perf assertions?

8. If a fix is needed, is the canonical owner Datserok's project persistence seam, Enate's Canvas state model, Holomony's media display authority, or a shared AI Studio performance lane?

## Likely Fix Direction If The Hypotheses Hold

Prefer canonical dependency narrowing over behavior workarounds.

High-ROI options to evaluate:

- Derive a durable Canvas persistence state before passing Canvas state into project autosave snapshot composition.
- Memoize that durable state by a stable durable signature so draft/edit/selection-only changes do not invalidate project autosave.
- Split Canvas media reconciliation dependencies from full Canvas session state into a media-authority signature.
- Ensure media repair effects do not call `getOutputSnapshot()` unless Canvas media item identities or relevant output ids changed.
- Add focused tests proving transient Canvas interactions do not trigger project autosave/media repair work.

Avoid:

- Changing Canvas UI/UX behavior as a first move.
- Adding a second persistence path.
- Reintroducing `sid` durability.
- Weakening project restore, media authority, or output display records.
- Treating Reference Grid or Canvas ownership as Datserok-owned unless the audited seam proves persistence is the culprit.

## Suggested Proof Requirements

Repo/local proof:

- Focused hook/unit tests around project workspace snapshot dependencies.
- Focused hook/unit tests around Canvas media repair dependency narrowing.
- Existing project workspace persistence tests still pass.
- Existing Canvas durability tests still pass if Canvas state contracts are touched.

Runtime proof:

- Use existing perf audit counters where possible.
- If production runtime access is available, test on a large project with `perfAuditRuntime` enabled or an equivalent safe instrumentation path.
- Show that Canvas transient actions do not increment autosave build/compose/candidate counters.
- Show that durable Canvas mutations still persist and restore correctly.

Launch-trust closeout should distinguish:

- code-backed proof,
- test-backed proof,
- production-backed proof,
- and any remaining manual-only or unproven areas.

## Suggested Stop Condition

Stop when Datserok can make one of these decision-grade conclusions:

1. The issue is Datserok-owned and fixed at the canonical project persistence/autosave seam, with tests proving transient Canvas interactions no longer wake large project snapshot work.

2. The issue is not Datserok-owned, with repo-backed evidence identifying the correct owner seam and a narrow handoff to that owner.

3. The issue requires production-only large-project runtime proof that is unavailable, with the exact missing proof and safe next validation step documented.

Do not continue by momentum into broad AI Studio refactors or Reference Grid redesign.

## Datserok Completion Update

Date: 2026-06-15

Outcome: Datserok audited the handoff against current code and completed the Datserok-owned part of the fix at the canonical project persistence/media-repair seams.

Code-backed findings:

- `useAiStudioPageProjectSessionRuntime` passed full live Canvas session state into the project-aware base snapshot builder. Because that live state included draft text, text edit sessions, owner ids, and per-item selection, transient Canvas edits could invalidate the project autosave builder even though project persistence later strips those transient fields.
- `useAiStudioPageMediaReferenceRuntime` had Canvas media reconciliation effects subscribed to full Canvas session state. That meant selection, draft/edit state, cameras, or other non-media Canvas changes could rerun effects that call `getOutputSnapshot()` and scan active/archived output ids.
- Current project docs still treat durable Canvas cameras as project workspace state, so this pass did not reclassify pan/zoom as non-durable. A separate product-contract decision would be needed before removing camera persistence.

Fixes made:

- `frontend/features/ai-studio/hooks/useAiStudioPageProjectSessionRuntime.ts`
  - derives and memoizes a project-durable Canvas state before patching the project workspace snapshot;
  - keeps the same durable Canvas object when only draft text, text edit session, owner ids, or selection changed;
  - preserves committed Canvas items and durable cameras.
- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
  - adds a Canvas media-authority signature over media item ids, output/media ids, URLs, and storage paths;
  - makes Canvas media repair/signing effects depend on that media-only signature instead of the full Canvas session state;
  - keeps effect bodies reading the latest Canvas state from the existing ref so real media authority changes still repair current items.
- Added focused regression tests:
  - `useAiStudioPageProjectSessionRuntime.test.ts` proves transient Canvas draft/edit/selection churn keeps the project snapshot builder stable and strips transient Canvas fields.
  - `useAiStudioPageMediaReferenceRuntime.test.ts` proves transient Canvas changes do not trigger additional output-authority scans.

Validation:

- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioPageProjectSessionRuntime.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioPageMediaReferenceRuntime.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioProjectWorkspacePersistenceController.test.ts`
- `npm -C frontend run type-check`

Remaining proof boundary:

- This is code-backed and test-backed local proof. It is not production-backed proof that the affected large project no longer crashes in the browser.
- Pan/zoom can still be durable camera state under the current project contract. If large-project pan/zoom remains a crash trigger after this patch, the next decision is whether to change Canvas camera persistence semantics or introduce a dedicated idle/throttled camera persistence contract.
