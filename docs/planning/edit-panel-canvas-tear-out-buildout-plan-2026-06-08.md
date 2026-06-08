# Edit Panel Canvas Tear-Out Buildout Plan

Date: `2026-06-08`

Owner/Lane: AI Studio Edit panel / Canvas-to-workflow handoff

Status: `approved-for-implementation`

## Objective

Complete Canvas image tear-out support for the Expert Edit panel so an image item
dragged out of the shared right-rail Canvas can be copied into:

1. the Expert Edit primary stage/frame stack, using existing primary image
   ingress and layer insertion behavior;
2. visible Expert Edit secondary reference slots, using existing reference image
   stabilization and slot update behavior.

Also complete Canvas text tear-out support into the Expert Edit prompt composer
so text items dragged out of Canvas can be inserted at the active textarea
selection or appended to the current prompt when the textarea is not active.

Canvas remains the workspace-global right-rail source. Dropping into Edit is a
copy action; the Canvas source item stays unchanged.

## Source Of Truth

Use current repo code and these docs as authority:

- `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`
- `frontend/features/ai-studio/hooks/useAiStudioCanvasTearOutTargets.ts`
- `frontend/features/ai-studio/components/canvas/canvasTearOutPayload.ts`
- `frontend/features/ai-studio/components/edit/useExpertEditPrimaryIngress.ts`
- `frontend/features/ai-studio/components/useReferencePropertiesInteractions.ts`
- `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
- `frontend/features/ai-studio/components/edit/ExpertEditPromptComposer.tsx`
- `frontend/features/ai-studio/components/edit/ExpertEditReferenceControls.tsx`
- `frontend/features/ai-studio/components/promptStep/agentComposerDrop.ts`
- `frontend/features/ai-studio/hooks/useAiStudioEditVideoPanelRuntimes.ts`
- `frontend/features/ai-studio/hooks/useAiStudioEditExpertPanelProps.ts`
- `docs/agents/enate-ende/canvas-boundary-tear-out-build-plan-2026-06-05.md`
- `docs/adr/0083-create-mode-global-right-rail-authority.md`
- `docs/sops/sop_image_generation.md`
- `docs/sops/sop_ai_studio_expert_edit_prompt_references.md`

If this plan and current code disagree, current code wins and the plan should be
tightened before implementation continues.

## Approved Scope

In scope:

- Thread the existing Canvas tear-out target registry into Expert Edit.
- Add direct image accept paths for the primary stage and secondary reference
  slots.
- Register the primary frame stack and visible secondary slots as Canvas tear-out
  targets.
- Register the Expert Edit prompt composer as a Canvas text tear-out target.
- Reuse existing image resolution, object URL stabilization, internal reference
  resolution, and layer/slot mutation paths.
- Reuse existing prompt text insertion behavior for text tear-out.
- Merge Canvas tear-out active state into existing drag-active styling.
- Add focused tests for the touched behavior.

Out of scope:

- Video or audio Canvas drops into Edit.
- Removing or mutating Canvas source items after Edit drop.
- Multi-item export.
- Cross-window or OS-native drag/drop.
- Modal-stage parity unless the inline implementation directly requires it.
- New UI/UX affordances beyond existing drag-active styling.
- Broad registry renames, large refactors, route changes, security changes,
  launch/deploy/commit/push work, or adjacent cleanup.

## Implementation Batches

### Batch 1: Registry Prop Threading

- Add `canvasTearOutTargetRegistry` to the Expert Edit panel contract.
- Pass `base.canvasTearOutTargetRegistry` through the Edit/Video runtime builder
  into `ExpertEditPanelView`.
- Keep the registry implementation shared and page-local.

Proof:

- TypeScript accepts the prop thread.
- Existing Create registry tests continue to describe the shared registry
  behavior.

### Batch 2: Direct Primary Image Accept

- Extract the image-resolution core from `handlePrimaryDrop` into a helper that
  can accept a normalized image drop snapshot.
- Keep native `handlePrimaryDrop` using that helper.
- Add a direct Canvas accept function for `AgentComposerDirectDropPayload` image
  payloads.
- Mutate the primary stage only through `applyPrimaryImageIngress`.

Proof:

- `useExpertEditPrimaryIngress` tests cover direct Canvas image accept.
- Native primary image drop tests still pass.

### Batch 3: Direct Secondary Image Accept

- Add a direct image accept path to the shared reference interactions helper or a
  narrowly scoped extracted helper used by it.
- Keep native secondary drops using the same stabilization/resolution path.
- Mutate secondary slots only through `onExtraImageChange(index, url)`.

Proof:

- `useReferencePropertiesInteractions` tests cover direct secondary Canvas image
  accept.
- Native secondary image drop behavior remains covered.

### Batch 4: Edit Target Registration

- Register the primary canvas frame stack as the primary Edit target.
- Add slot element refs for visible secondary reference slots and register each
  visible slot as its own target.
- Register the Edit prompt composer shell as a text target.
- Primary and secondary targets accept only `payload.kind === "image"`.
- Prompt composer target accepts only non-empty `payload.kind === "text"`.
- Merge target active state into existing primary/secondary `is-dragging`
  visuals.

Proof:

- Focused Edit component tests show primary and secondary targets register and
  accept image payloads.
- Focused Edit component tests show the prompt composer target registers and
  accepts text payloads.
- Unsupported payloads do not activate or mutate the wrong Edit surface.

### Batch 5: Validation And Self-Audit

Run focused tests first:

```bash
npm -C frontend run test -- \
  features/ai-studio/components/edit/__tests__/useExpertEditPrimaryIngress.test.tsx \
  features/ai-studio/components/__tests__/useReferencePropertiesInteractions.test.tsx \
  features/ai-studio/hooks/__tests__/useAiStudioCanvasTearOutTargets.test.ts \
  features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx \
  features/ai-studio/components/create/__tests__/StandardCreatePanelView.test.tsx \
  features/ai-studio/components/create/__tests__/PulseCreatePanelView.test.tsx
```

Then run broader feasible checks:

```bash
npm -C frontend run lint
npm -C frontend run build
```

Document unrelated failures instead of expanding scope to fix them.

## Stop Condition

Stop when:

- Canvas image tear-out can be accepted by the Edit primary stage and visible
  secondary reference slots through the shared registry path;
- Canvas text tear-out can be accepted by the Edit prompt composer through the
  shared registry path;
- focused tests for the touched behavior pass, or any remaining validation
  failure is clearly unrelated and documented;
- no next step remains that is both in-scope and higher value than stopping.

Stop early if:

- implementation requires synthetic `DragEvent`/`DataTransfer` as the primary
  path;
- implementation would require Canvas to know Edit-specific DOM classes;
- implementation would fork the global right rail or create duplicate image
  ingress authority;
- proof depends on deployment, production browser validation, commit, push, or a
  different owner/lane.
