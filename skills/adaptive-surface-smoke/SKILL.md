---
name: adaptive-surface-smoke
description: Run cross-surface regression smoke checks for adaptive media ingress paths and grid/detail behavior.
---

# Adaptive Surface Smoke

## When to use
- Before merging adaptive-media changes.
- Before expanding `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES`.

## Steps
1. Run targeted ingestion and surface suites:
```bash
cd frontend
npm test -- --run \
  features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx \
  features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx \
  features/ai-studio/components/__tests__/DetailModal.test.tsx \
  features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts \
  features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx
```

2. Run policy/pressure validation:
```bash
cd frontend
npm test -- --run \
  lib/adaptive-media/__tests__/policy.test.ts \
  lib/adaptive-media/__tests__/pressure.test.ts
```

## Pass criteria
- No failures in the listed suites.
- Detail modal tests confirm full-quality behavior remains intact.
