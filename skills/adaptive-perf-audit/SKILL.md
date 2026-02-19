---
name: adaptive-perf-audit
description: Run local quality/performance audit loop for Adaptive Media V2 rollout gates.
---

# Adaptive Perf Audit

## When to use
- During shadow compare and parity cutover.
- Before enabling tuned policy in shared environments.

## Steps
1. Ensure lint + types are green:
```bash
cd frontend
npm run lint
npm run type-check
```

2. Run adaptive regression suite:
```bash
cd frontend
npm test -- --run \
  lib/adaptive-media/__tests__/policy.test.ts \
  lib/adaptive-media/__tests__/pressure.test.ts \
  lib/adaptive-media/__tests__/resolver.test.ts \
  features/ai-studio/logic/__tests__/referenceGridMedia.parity.test.ts
```

3. Run AI Studio perf gate command:
```bash
cd frontend
npm run test:perf:ai-studio
```

4. In browser DevTools on `/ai-studio`, inspect:
```js
window.__shortpulseMediaPerf?.durationStats();
window.__shortpulseMediaPerf?.snapshot?.();
```

## Pass criteria
- No test regressions.
- Perf gate remains at or better than baseline.
- No sustained `media.adaptive.resolve.mismatch` events in shadow mode.
