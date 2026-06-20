# Next-Agent Handoff: AI Studio Shell And Navigation Preservation Audit

## Lane Id

`ai-studio-shell-navigation-preservation-audit-2026-06-04`

## Copy/Paste Use

- This packet is intended for Abismia as the UI/UX and visible-runtime owner.
- Copperknot owns final readiness interpretation after the returned closeout.
- Execution authorization: Abismia should work through this lane as a preservation-minded audit and blocker-fix lane. Classify issues first, then implement narrow blocker fixes that preserve current UI/UX/design/behavior.
- Do not redesign AI Studio, re-theme the product, or change intended behavior unless current evidence proves a smaller preserve-behavior fix cannot protect launch readiness.

## Current Freshness Addendum - 2026-06-19

- Current queue state: P5 `AI Studio shell and navigation` is `Below Floor - Handoff Ready` with `Repo Inspected` evidence.
- This packet is handoff-ready for Abismia. It authorizes audit plus narrow blocker fixes; it does not authorize indiscriminate patching of every listed surface.
- The exact dirty-file list below is historical. Refresh `git status --short` as the first step, identify owner overlap, then work clean/assigned files only.
- Current product scope is desktop-first. Do not spend this lane on mobile-specific layouts, touch-only UX, mobile polish, or mobile breakpoints unless the user explicitly approves mobile scope in the current thread.
- Current local repo has active dirty AI Studio/right-rail/Create-adjacent work from other lanes. Treat dirty files as ownership boundaries unless assigned, but continue on clean/assigned surfaces inside the lane.
- Remaining proof boundary: preservation-minded classification of workflow navigation, shell layout, shared right rail, modal/detail behavior, drag/drop overlays, and blocker/watch/polish issues. Preserve current UI/UX/design/behavior; no redesign by default.

## Why This Task

- Launch system: `AI Studio shell and navigation`
- Launch state: `Below Floor - Handoff Ready`
- Evidence level: `Repo Inspected`
- Human risk: `High`
- Operational risk: `Medium`
- Technical risk: `High`
- Why now: after Recovery, Media Library, Storage, and Create/Pulse lanes were handed off or locally strengthened, this is the next unblocked July 7 queue item.
- Why Copperknot is stopping: this is now assigned execution/proof work for Abismia. The lane spans workflow navigation, left-rail/tool ownership, shared right rail, modal/detail behavior, drag/drop overlays, and desktop fit, so Abismia should execute the preservation-minded audit/fix loop instead of Copperknot patching it by momentum.

## Current Copperknot Evidence

- Branch and branch guard are `production`.
- Historical note: this packet was created while the worktree was dirty with overlapping AI Studio changes. Do not assume the current shell is a clean committed baseline; refresh `git status --short` before action.
- Dirty AI Studio shell-adjacent files currently include:
  - `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
  - `frontend/features/ai-studio/components/canvas/canvasWorkspaceContracts.ts`
  - `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`
  - `frontend/features/ai-studio/components/__tests__/DetailModal.test.tsx`
  - `frontend/features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceGridProps.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioPageProjectSessionRuntime.test.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPageProjectSessionRuntime.ts`
  - `frontend/styles/ai-studio-canvas-workspace.css`
  - `frontend/styles/ai-studio-voices-properties.css`
- `frontend/features/ai-studio/components/AiStudioToolbar.tsx` owns top-level workflow/tool entry, Dashboard/Projects controls, Create/Video/Sound/Edit parent behavior, library shortcuts, and lower shortcut groups.
- `frontend/features/ai-studio/components/AiStudioShellFrame.tsx` owns shell structure, properties rail, right-column Reference Grid/Preview composition, divider, and right-column drag/drop overlay.
- `frontend/features/ai-studio/logic/panelVisibility.ts` owns expandable right-rail/header shortcut visibility.
- `frontend/features/ai-studio/logic/shellResize.ts` owns left/right rail resize/collapse decisions.
- `frontend/features/ai-studio/components/modal-layer/AiStudioModalLayer.tsx` owns shared modal portal mounting and modal-open activity coordination.
- ADR 0083 says `Reference Grid`, `Quick Slot Inventory`, and `Canvas` are workspace-global right-rail surfaces across Standard/Pulse and must not be forked into per-mode or route-local state.

## Required Context

Read first:

- `AGENTS.md`
- `docs/agents/abismia/AGENTS.md`
- `docs/agents/abismia/README.md`
- `docs/agents/abismia/memory.md`
- `docs/agents/abismia/standard-operating-procedure.md`
- `docs/agents/copperknot/july-7-launch-authority.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- `docs/product/shortpulse_ai_studio.md`
- `docs/routes.md`
- `docs/styles-structure.md`
- `docs/ux-decision-framework.md`
- `docs/adr/0083-create-mode-global-right-rail-authority.md`

Inspect first:

- `frontend/pages/ai-studio.tsx`
- `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx`
- `frontend/features/ai-studio/routes/AiStudioRouteApp.tsx`
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/features/ai-studio/components/AiStudioToolbar.tsx`
- `frontend/features/ai-studio/components/AiStudioToolbarRail.tsx`
- `frontend/features/ai-studio/components/AiStudioShellFrame.tsx`
- `frontend/features/ai-studio/components/AiStudioPropertiesRail.tsx`
- `frontend/features/ai-studio/components/AiStudioReferenceRail.tsx`
- `frontend/features/ai-studio/components/AiStudioPreviewRail.tsx`
- `frontend/features/ai-studio/components/DetailModal.tsx`
- `frontend/features/ai-studio/components/modal-layer/AiStudioModalLayer.tsx`
- `frontend/features/ai-studio/logic/panelVisibility.ts`
- `frontend/features/ai-studio/logic/shellResize.ts`
- `frontend/features/ai-studio/hooks/useAiStudioShellRuntime.ts`
- `frontend/features/ai-studio/hooks/useAiStudioShellDndController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioShellResize.ts`
- `frontend/styles/ai-studio-layout.css`
- `frontend/styles/ai-studio-responsive.css`
- `frontend/styles/ai-studio-canvas-workspace.css`

## Scoped Task

Audit and, only if narrow blockers are found, fix AI Studio shell/navigation launch readiness while preserving the current visual design, UI, UX, and intended behavior.

Answer:

1. Can a user enter AI Studio, identify the active workflow, switch workflows, and return to Dashboard/Projects without route, mode, or panel confusion?
2. Do left-rail workflow/tool controls behave consistently for Create, Edit, Video, Sound, Libraries, Projects, and Dashboard?
3. Do `Reference Grid`, `Quick Slot Inventory`, and `Canvas` remain workspace-global right-rail surfaces across workflow and Standard/Pulse changes?
4. Do detail modals, model/preset/media modals, and modal-open background behavior remain coherent and non-blocking?
5. Do desktop and mobile breakpoints preserve usable shell navigation without hiding critical launch actions?
6. Which findings are true launch blockers, watch items, or post-launch polish?

## Owned Write Surface

Preferred output is a findings/closeout report. Code changes are allowed only for narrow visible-runtime blockers that preserve current UI/UX.

Allowed code/docs changes if needed:

- `frontend/features/ai-studio/components/AiStudio*`
- `frontend/features/ai-studio/components/modal-layer/*`
- `frontend/features/ai-studio/logic/panelVisibility.ts`
- `frontend/features/ai-studio/logic/shellResize.ts`
- `frontend/features/ai-studio/hooks/useAiStudioShell*`
- `frontend/features/ai-studio/components/canvas/*` only when the issue directly affects shell/right-rail launch behavior
- `frontend/styles/ai-studio-layout.css`
- `frontend/styles/ai-studio-responsive.css`
- `frontend/styles/ai-studio-canvas-workspace.css`
- directly corresponding tests
- Abismia memory/report surfaces if durable UI learning is created

## Forbidden Scope

- No visual redesign, theme change, or new UX direction.
- No major behavior changes without explicit evidence and Copperknot/user approval.
- No Standard/Pulse runtime changes unless shell-visible leakage is proven and the fix is narrow.
- No right-rail state fork; preserve ADR 0083.
- No generation provider, billing, pricing, credit, auth, storage, or media-delivery changes.
- No commit, push, deploy, release, destructive data operation, Docker Supabase flow, secret exposure, credit-consuming production test, or Supabase image transformation.

## Suggested Validation

Local/non-credit:

- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioShellRuntime.test.ts features/ai-studio/hooks/__tests__/useAiStudioShellDndController.test.ts features/ai-studio/hooks/__tests__/useAiStudioShellResize.test.ts features/ai-studio/hooks/__tests__/useReferenceGridHorizontalSplit.test.ts features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts features/ai-studio/hooks/__tests__/useAiStudioReferenceGridProps.test.ts features/ai-studio/components/modal-layer/__tests__/AiStudioModalLayer.test.tsx features/ai-studio/components/modal-layer/__tests__/AiStudioModalLayer.portal.test.tsx`
- Add or run focused component tests for any touched toolbar, shell frame, modal, panel visibility, or responsive contract.
- `npm -C frontend run type-check`
- `npm -C frontend run lint`
- `npm -C frontend run docs:check` if docs change.

Production-safe visual proof:

- Use `https://www.shortpulse.ai`.
- No credit-consuming generation.
- Capture desktop and mobile observations for:
  - entering `/ai-studio`
  - Dashboard/Projects controls
  - workflow switching
  - right-rail visibility/global behavior
  - modal open/close behavior
  - primary shell responsiveness

## Done State

Stop when one of these is true:

- Findings classify AI Studio shell/navigation as launch blocker, watch item, or polish with evidence, and any narrow blocker fixes are validated.
- Production-safe browser proof confirms the current shell/navigation behavior is acceptable with only watch/polish items remaining.
- A narrow source regression is fixed and validated, with remaining production visual proof named.
- The lane requires redesign, major behavior change, broader shell architecture, or product strategy. Stop and return the exact decision needed instead of continuing.

## Stop Rules

- Stop immediately if the next change would be a redesign, product-policy decision, broad shell rewrite, cross-lane architecture change, or credit-consuming proof.
- Stop instead of patching if validation begins oscillating or if the source problem spans more than a couple focused passes.
- If a non-UI owner is needed, create a focused follow-on handoff rather than absorbing that work into Abismia.

## Required Closeout Report

Create:

- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/YYYY-MM-DD-ai-studio-shell-navigation-preservation-audit-closeout.md`

Required contents:

- lane id
- source handoff path
- execution status
- production target and freshness
- surfaces inspected
- files changed
- blocker/watch/polish classification
- desktop observations
- mobile observations
- right-rail/global-state proof
- modal/navigation proof
- validation commands
- self-audit findings
- residual risk
- recommended Copperknot readiness decision
