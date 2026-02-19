# Adaptive Media V2 Migration Checklist

## Goals
- Keep UX behavior unchanged while modularizing adaptive media logic.
- Roll out with parity-first gates before tuned quality settings.
- Preserve full-quality behavior in detail modals.

## Phase Checklist

### Phase 0: Guardrails
- [x] Shared adaptive module scaffolded (`frontend/lib/adaptive-media`).
- [x] Resolver parity harness test added.
- [x] Policy + pressure unit tests added.
- [x] Detail-quality coverage added for AI Studio detail and Character preview overlay.

### Phase 1: Reference Grid Shadow Compare
- [x] Reference grid resolver wrapped with legacy + V2 shadow compare support.
- [x] Mismatch telemetry event added (`media.adaptive.resolve.mismatch`).
- [ ] Run shadow compare in QA and capture mismatch summary.

### Phase 2: Reference Grid Parity Cutover
- [x] Surface adapter routing enabled by `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES`.
- [x] Pressure recovery no longer ratchets down for entire session.
- [ ] Perf gate comparison run against baseline profile.

### Phase 3: Tuned Policy
- [x] Tuned policy contract implemented (DPR/card-aware targets + quality ladder).
- [ ] Enable tuned policy in QA and validate visual quality/perf.
- [ ] Confirm no regressions in drag/drop, curated split, and hydration.

### Phase 4: Media Library Grids
- [x] Route grid adapter wired (`media-library-grid`).
- [x] AI Studio media modal grid adapter wired (`media-library-modal-grid`).
- [x] Media Library file modal now refreshes full-quality signed URL on open.

### Phase 5: Character Surfaces
- [x] Character grid adapter wired (`character-grid`).
- [x] Character reference preview overlay upgraded to full-quality signed URL.
- [ ] Run character flow regression suite with adaptive flags enabled.

### Phase 6: Post-Stability
- [ ] Consider automated fallback path after stability window.
- [ ] Decide production default for tuned policy.

## Rollout Flags
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED`
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SHADOW_COMPARE`
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY`
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES`
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_FORCE_FULL_QUALITY`

## Regression Gates
- `npm -C frontend run lint`
- `npm -C frontend run type-check`
- `npm -C frontend run test -- --run features/ai-studio/logic/__tests__/referenceGridMedia.parity.test.ts`
- `npm -C frontend run test -- --run features/ai-studio/components/__tests__/ReferenceCanvas.curated.test.tsx`
- `npm -C frontend run test -- --run features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx`
- `npm -C frontend run test -- --run features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx`
