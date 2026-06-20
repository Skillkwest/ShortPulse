# AI Studio Shell Navigation Preservation Audit Closeout

## Lane

- Lane id: `ai-studio-shell-navigation-preservation-audit-2026-06-04`
- Source handoff: `docs/agents/copperknot/handoffs/2026-06-04-ai-studio-shell-navigation-preservation-audit.md`
- Execution status: completed as a preservation-minded source and contract audit; one narrow source fix applied and validated.
- Production target and freshness: `https://www.shortpulse.ai`; non-authenticated `HEAD` checks reached `/ai-studio` and `/dashboard` with `200` on `2026-06-20T04:40Z` server time / `2026-06-19T21:40 MST` local time. This proves route availability only, not authenticated workspace behavior.

## Surfaces Inspected

- Repo authority: `AGENTS.md`, `docs/agents/copperknot/*`, `docs/agents/abismia/*`, `docs/agents/solo-owner-launch-trust-standard.md`, `docs/adr/0083-create-mode-global-right-rail-authority.md`, `docs/sops/sop_ai_studio_index.md`, `docs/sops/sop_ai_studio_pulse_mode.md`, `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`, `docs/product/shortpulse_ai_studio.md`, `docs/routes.md`, `docs/styles-structure.md`, `docs/ux-decision-framework.md`.
- Route and shell source: `frontend/pages/ai-studio.tsx`, `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx`, `frontend/features/ai-studio/routes/AiStudioRouteApp.tsx`, `frontend/features/ai-studio/components/AiStudioPageContent.tsx`, `frontend/features/ai-studio/components/AiStudioToolbar.tsx`, `frontend/features/ai-studio/components/AiStudioToolbarRail.tsx`, `frontend/features/ai-studio/components/AiStudioShellFrame.tsx`, `frontend/features/ai-studio/components/AiStudioReferenceRail.tsx`, `frontend/features/ai-studio/components/AiStudioPreviewRail.tsx`, `frontend/features/ai-studio/components/DetailModal.tsx`, `frontend/features/ai-studio/components/modal-layer/AiStudioModalLayer.tsx`.
- Shell logic and styles: `frontend/features/ai-studio/logic/panelVisibility.ts`, `frontend/features/ai-studio/logic/shellResize.ts`, `frontend/features/ai-studio/hooks/useAiStudioShellRuntime.ts`, `frontend/features/ai-studio/hooks/useAiStudioShellResize.ts`, `frontend/features/ai-studio/hooks/useAiStudioShellDndController.ts`, `frontend/styles/ai-studio-layout.css`, `frontend/styles/ai-studio-responsive.css`, `frontend/styles/ai-studio-canvas-workspace.css`.
- Focused tests inspected: `AiStudioPageContent.header.test.tsx`, `AiStudioToolbar.current-mode.test.tsx`, `AiStudioShellFrame.test.tsx`, `panelVisibility.test.ts`, `useAiStudioShellDndController.test.ts`, modal-layer tests, and DetailModal tests.

## Files Changed

- Added this closeout report.
- Updated `frontend/features/ai-studio/components/DetailModal.tsx` so workflow reload clicks use the shared media-kind inference helper. This preserves the legacy image replay fallback for availability while passing the visible media kind (`image`, `video`, or `audio`) as the reload hint.
- Existing dirty worktree changes were treated as out-of-lane unless directly inspected as evidence. Notable existing dirty shell-adjacent diffs included `DetailModal.tsx` style-preview fallback removal and `CanvasPropertiesPanel.tsx` textarea selection preservation; neither was reverted.

## Blocker Watch Polish Classification

### Blockers

- One narrow source blocker was found and fixed: generated video/audio-capable detail modal reload actions could derive reload availability from a legacy image replay path while sending an `image` reload hint from `output.mode`. The fix now sends the visible media-kind hint while keeping the legacy image replay fallback available.
- No broader shell/navigation blocker was found in the inspected source contracts. Current code gives the user a stable entry path through the protected `/ai-studio` route, left-rail workflow switching, hard Dashboard exit, in-studio Projects modal entry, global right-rail toggles, shared modal portal mounting, and right-column drop handling.

### Watch Items

- Authenticated production visual proof remains open. The production checks in this pass were route reachability only and did not exercise an authenticated user switching workflows, opening Projects, toggling right-rail sections, opening detail modals, or dragging references.
- The worktree is heavily dirty across AI Studio and adjacent launch lanes. This audit was performed against the current moving worktree at `50820bdfc` plus local modifications, so final launch-week proof should rerun after the lane stabilizes or deploys.
- Desktop fit remains the active launch target. Basic responsive CSS exists, but mobile-specific polish was intentionally not audited because current repo policy is desktop-first unless mobile scope is explicitly approved.

### Post-Launch Polish

- None promoted from this pass. Cosmetic tuning would be lower ROI than authenticated production proof.

## Desktop Observations

- Header exposes `Canvas`, `Quick Slot Inventory`, and `Reference Grid` toggles. Tests prove those toggles write into the durable right-rail layout without resetting split ratios.
- The left rail keeps primary workflows visible: Create, Video, Sound, Edit, plus Libraries and Creations groups. Repeat-click coverage confirms active rail panels stay open instead of collapsing to `null`.
- `DashboardNavPrefab` is used with hard navigation for the Dashboard exit, matching the SOP requirement that the user can leave AI Studio even if client runtime state is degraded.
- `Projects` opens the in-studio Projects modal through `useAiStudioShellRuntime`, and project route handoff has timeout/interruption handling before route push failures become silent confusion.
- Shell resize logic supports split, compact-split, stacked, and right-rail-focus modes. For desktop workflows, Create/Edit/Video/Sound can collapse the properties column while keeping shared right-rail state authoritative.

## Mobile Observations

- Mobile-specific launch polish was not in scope under the current desktop-first repo policy.
- Static CSS inspection shows a basic stacked shell below `1100px` and simpler hero/toolbar layout below `768px`; this is responsive integrity evidence only, not a mobile launch-readiness claim.

## Right-Rail Global-State Proof

- `rightRailLayout` is page/project-level state passed from page runtime into `AiStudioPageContent`, then into `ReferenceGrid` through `AiStudioShellFrame`; it is not forked per Standard/Pulse mode.
- ADR 0083 is reflected in source: `Reference Grid`, `Quick Slot Inventory`, and `Canvas` are controlled as workspace-global surfaces. Styles is intentionally transient and availability-gated because it is workflow/tool eligible, not part of the ADR 0083 global trio.
- `panelVisibility.test.ts` proves every normal-mode Canvas/Quick Slot/Reference Grid visibility combination is reachable.
- `AiStudioPageContent.header.test.tsx` proves header toggles persist into `rightRailLayout.panels` and preserve existing split ratios.

## Modal Navigation Proof

- `AiStudioModalLayer` creates one shared portal root and tracks active modal ids through `AiStudioModalActivityProvider`.
- `DetailModal` and `SharedMediaDetailPreviewModal` mount outside the shell frame, so detail/modal behavior is not tied to a per-workflow panel fork.
- Existing modal-layer tests cover portal mounting and activity tracking. DetailModal tests now confirm restorable generated media keeps the reload action available and passes the visible media-kind hint.

## Validation Commands

- `git branch --show-current` -> `production`
- `git config --local shortpulse.allowedBranch` -> `production`
- `git rev-parse --short HEAD` -> `50820bdfc`
- `curl -I -L --max-time 20 https://www.shortpulse.ai/ai-studio` -> `200`, `x-matched-path: /ai-studio`
- `curl -I -L --max-time 20 https://www.shortpulse.ai/dashboard` -> `200`, `x-matched-path: /dashboard`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/DetailModal.test.tsx` -> `56` passed.
- `npm -C frontend run test -- features/ai-studio/components/__tests__/AiStudioPageContent.header.test.tsx features/ai-studio/components/__tests__/AiStudioToolbar.current-mode.test.tsx features/ai-studio/components/__tests__/AiStudioShellFrame.test.tsx features/ai-studio/logic/__tests__/panelVisibility.test.ts features/ai-studio/hooks/__tests__/useAiStudioShellDndController.test.ts features/ai-studio/components/modal-layer/__tests__/AiStudioModalLayer.test.tsx features/ai-studio/components/modal-layer/__tests__/AiStudioModalLayer.portal.test.tsx features/ai-studio/components/__tests__/DetailModal.test.tsx` -> `8` files / `144` passed.
- `npm -C frontend run docs:check` -> passed.

## Self-Audit

- The only patched source blocker was inside detail modal workflow reload hinting. The broader shell contracts already satisfied the preservation contract for shell entry, workflow switching, Dashboard/Projects navigation, right-rail global authority, and modal layering.
- Evidence quality is `Locally Tested` for the source contracts above plus production route reachability. It is not authenticated production visual proof for the shell workflow.
- Subagents were not used because Copperknot's current lane has dirty overlapping AI Studio files and the active handoff is a direct UI authority packet; splitting inspection would increase ownership ambiguity more than it would reduce risk.

## Residual Risk

- Authenticated browser proof is still required before this lane can move above `Below Floor`.
- Production visual proof should cover: entering `/ai-studio`, Dashboard exit, Projects modal open/select/create path where safe, Create/Edit/Video/Sound workflow switching, Canvas/Quick Slot/Reference Grid toggle persistence, detail modal open/close behavior, and right-column drag/drop overlay behavior. Do not spend credits or run provider generation without approval.

## Recommended Copperknot Readiness Decision

- Move `AI Studio shell and navigation` to `Below Floor - Source Hardened` / `Locally Tested`.
- Do not lift above `Below Floor` until authenticated production visual proof is collected for the shell/navigation workflow.
