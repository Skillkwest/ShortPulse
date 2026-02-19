## Summary
- What does this change do?

## Testing
- [ ] `npm -C frontend run lint`
- [ ] `npm -C frontend run build`
- [ ] `npm -C frontend run test` (when logic/API behavior is touched)

## AI Studio Perf Gates (when AI Studio behavior is touched)
- [ ] `window.__shortpulseAiStudioPerf.runReferenceGridAudit({ counts: [40, 60], clickSamples: 24 })` passes.
- [ ] `window.__shortpulseAiStudioPerf.runStudioShellAudit({ counts: [40, 60] })` passes.
- [ ] `NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE` changed in this PR: `yes` / `no`

## Adaptive Media V2 Gates (when adaptive paths are touched)
- [ ] `npm -C frontend run test:adaptive-v2-gate`
- [ ] Manual smoke confirms: no stuck `loading preview...` cards in Quick Slot/Reference Grid.
- [ ] Detail modals remain full quality (AI Studio detail + Character overlay).

## UX / Accessibility (UI-touching changes)
- [ ] Keyboard-only interactions validated for touched flows (including modal open/close and tab navigation where applicable).
- [ ] Semantics validated (`h1`, landmarks, dialog labeling, tab roles, and `aria-*` states for changed surfaces).
- [ ] Focus behavior validated (initial focus, Escape behavior, focus return, and visible focus indicators).
- [ ] Before/after screenshots attached for `P0` UX layout/navigation fixes.

## Risk / rollout notes
- Any migrations, data-contract changes, or user-visible behavior changes?
