# Media Library UI Redesign Plan (2026-03-28)

Status: draft  
Owner: Frontend Engineering  
Scope: `legacy standalone Media Library page`, AI Studio Media Library modal, AI Studio Media Library panel  
Depends on: completed Media Library runtime rebuild

## Purpose
Define the next lane for Media Library work now that the runtime rebuild is complete. This lane is visual and interaction-focused. It must preserve the rebuilt runtime seams and avoid reopening the finished stability work.

## Problem Statement
The Media Library runtime is now stable, but the three user-facing surfaces still reflect an incremental build history:
- `legacy standalone Media Library page` is serviceable but visually heavy and operationally dense.
- AI Studio modal is functional but compacted around legacy modal assumptions.
- AI Studio panel is structurally correct but still feels like an operations panel, not a polished library surface.

The next value is not more runtime refactoring. The next value is a deliberate UX redesign built on the stabilized runtime.

## Goals
1. Improve information hierarchy across route, modal, and panel.
2. Make folder navigation, filtering, previewing, and bulk actions easier to scan.
3. Increase perceived performance through better loading states and clearer progressive reveal.
4. Unify Media Library visual language across route, modal, and panel without forcing identical layouts.
5. Preserve the rebuilt runtime and heavy browser audit gate.

## Non-Goals
- No new runtime architecture lane.
- No backend schema redesign.
- No reopening the completed Media Library runtime tracker.
- No folder-canvas redesign unless a concrete UX issue requires it after route/modal/panel work.
- No speculative cleanup outside the redesign surfaces.

## Locked Constraints
1. Keep the shared runtime seams in place:
   - `frontend/features/media-library/runtime/store.ts`
   - `frontend/features/media-library/hooks/useMediaSurfacePreviewRuntime.ts`
   - `frontend/features/media-library/hooks/useMediaSurfacePreviewSigning.ts`
2. Keep the heavy browser audit runnable:
   - `cd frontend && npm run test:e2e:media-library-runtime`
3. Do not reintroduce surface-owned signing loops, duplicate observer stacks, or broad row rewrite patterns.
4. Preserve current product semantics:
   - `All Media` root behavior
   - folder membership semantics
   - root images/videos/prompts split
   - modal select behavior
   - panel ingest behavior
   - folder-canvas isolation

## Redesign Priorities
### 1. Route page
Target outcomes:
- clearer split between filters, metrics, and content
- better visual distinction between media tabs, prompts, and bulk actions
- improved loading and empty states
- stronger card density/readability balance on large screens

### 2. AI Studio modal
Target outcomes:
- simpler selection flow
- clearer tab state and search hierarchy
- stronger emphasis on quick-pick behavior
- reduced “legacy utility modal” feel

### 3. AI Studio panel
Target outcomes:
- more intentional relationship between folders, root tabs, and content
- cleaner panel rhythm for drag-to-grid workflows
- better root-folder versus custom-folder visual transitions

### 4. Shared visual system
Target outcomes:
- one typography and spacing system across the three surfaces
- consistent loading, empty, and error states
- consistent media-card treatment where appropriate

## Implementation Order
1. Route redesign first
2. Modal redesign second
3. Panel redesign third
4. Folder-canvas adjustments only if required by the redesigned panel shell

## Execution Method
1. Redesign one surface at a time.
2. Keep each slice visually meaningful and runtime-safe.
3. Validate every behavior-changing surface slice with:
   - targeted component tests where relevant
   - `cd frontend && npm run build` for meaningful surface wiring changes
   - `cd frontend && npm run test:e2e:media-library-runtime` at route/modal/panel checkpoints
4. Prefer CSS and composition changes over new runtime logic.

## Done State
This redesign lane is complete when:
1. Route, modal, and panel all have deliberate redesigned UI shells.
2. Shared runtime seams remain intact.
3. The heavy browser audit still passes.
4. No new Media Library freeze or overload regression is introduced.
5. Any further work is polish, not structural redesign.

## Immediate Next Slice
Start with the route surface:
1. audit current route composition and style ownership
2. define the new route information hierarchy
3. implement the route redesign without changing runtime ownership
