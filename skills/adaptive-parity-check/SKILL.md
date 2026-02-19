---
name: adaptive-parity-check
description: Run parity-first checks for Adaptive Media V2 by comparing reference-grid legacy and V2 resolver outputs.
---

# Adaptive Parity Check

## When to use
- Before enabling `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED` in any environment.
- After touching adaptive policy/resolver logic.

## Steps
1. Ensure parity mode flags:
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY=false`
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES=reference-grid`

2. Run parity fixture suite:
```bash
cd frontend
npm test -- --run features/ai-studio/logic/__tests__/referenceGridMedia.parity.test.ts
```

3. Run baseline resolver suite:
```bash
cd frontend
npm test -- --run features/ai-studio/logic/__tests__/referenceGridMedia.test.ts lib/adaptive-media/__tests__/resolver.test.ts
```

## Pass criteria
- Zero parity mismatches.
- All resolver tests green.
