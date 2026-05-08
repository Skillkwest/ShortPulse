---
name: adaptive-change-gate
description: Run the mandatory adaptive media regression gate and report pass/fail evidence before merging changes that touch adaptive media, reference grid, quick slot, media-library modal grid, or character adaptive surfaces.
---

# Adaptive Change Gate

## Steps
1. Run the required adaptive gate command:
```bash
cd frontend
npm run test:adaptive-media-runtime
```

2. If the gate fails, identify the first failing suite and stop rollout work until it is fixed.

3. If the gate passes, record:
- command used
- timestamp
- branch or commit
- whether any known low-severity issues were observed during manual smoke

## Pass criteria
- `test:adaptive-media-runtime` exits successfully.
- No stuck `loading preview...` / `generating...` cards in quick slot or reference grid during follow-up smoke.
