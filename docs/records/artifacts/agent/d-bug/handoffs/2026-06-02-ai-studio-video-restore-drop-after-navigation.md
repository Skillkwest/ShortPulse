# D-Bug Handoff: ai-studio-video-restore-drop-after-navigation

### Source

- Source agent: Codex
- Source task: June 2, 2026 AI Studio video-generation reliability audit and fix lane
- Date: 2026-06-02

### Failing surface

- Route, component, script, command, or subsystem: AI Studio generated-output restore/reconcile path after video generation succeeds upstream but the user navigates away before canonical owned media persistence fully settles
- Environment: repo workspace on local `production` branch; user-reported production behavior on `https://www.shortpulse.ai`
- User-visible symptom:
  - video generation enters normal polling,
  - a spinner/placeholder appears in the Reference Grid,
  - no warning banner appears,
  - navigating away from AI Studio or reloading can cause the successful generation to disappear,
  - the finished video may exist in Kai/Kie but not return into ShortPulse
- Exact error text or signature:
  - no guaranteed user-facing error
  - production logs previously showed `Error: write after end` on `/api/fal/kie-kling-status`
  - repo restore logic intentionally filtered provider-url-only success rows without durable media authority before this lane

### Why this is a D-Bug lane

- Why the source agent stopped:
  - the core disappearing-generation seam has been patched locally in the canonical server lifecycle and the AI Studio restore authority path,
  - but this deserves a separate verification/debug lane so the current conversation can stay focused on ongoing video-generation errors.
- Why this should be treated as debugging instead of feature work:
  - the user expectation is non-negotiable: a successful generation must not be lost when leaving AI Studio,
  - this is a restore/reliability bug across existing authority layers, not a UX redesign or product-scope expansion.

### Current evidence

- Reproduction steps that motivated the lane:
  1. Submit a Kie/Kai-backed video generation from AI Studio.
  2. Wait for the placeholder spinner to appear in the Reference Grid.
  3. Let the provider finish successfully upstream.
  4. Navigate away from AI Studio, reload, or return later before canonical owned media persistence fully settles.
  5. Observe that the finished generation can disappear from ShortPulse even though the video exists upstream.
- Expected behavior:
  - once provider generation succeeds and ShortPulse has a trusted visible projection, the generation remains visible and restorable across navigation/reload until canonical ownership catches up or an explicit failure occurs.
- Actual behavior before the local fix:
  - the live polling path could recover from transient provider success,
  - but the restore/list/reconcile path filtered successful provider-url-only rows and dropped them after navigation.
- Logs, stack traces, screenshots, or file references:
  - current thread audit findings:
    - `frontend/lib/server/api/terminalConvergenceVisibility.ts`
    - `frontend/lib/server/api/terminalConvergenceViewSync.ts`
    - `frontend/lib/server/api/generationProjection.ts`
    - `frontend/lib/server/api/falStatusProxy.ts`
    - `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
  - prior persistence authority packet that already named the restore filter:
    - `docs/records/artifacts/agent/datserok/reports/2026-05-31-project-persistence-authority-audit.md`
      - explicitly states: `provider-url-only success rows without durable media authority are filtered out of visible restore/reconcile paths`
  - related production context from this thread:
    - successful Kai video existed upstream while ShortPulse lost it
    - `/api/fal/kie-kling-status` production logs showed `write after end`
- Frequency:
  - user-reported as meaningful product risk
  - reproducibility was strong enough in code that the restore filter and status crash were both auditable from source and targeted tests

### Scope control

- Owned write surface:
  - AI Studio generated-output restore/reconcile authority
  - terminal convergence visibility for successful transient provider outputs
  - status polling lifecycle only where it affects restore/drop reliability
- Avoid surface:
  - unrelated video prompt tuning
  - broad UI redesign
  - pricing/auth/env/provider-key lanes unless directly needed for repro
  - unrelated dirty-worktree files already present in this repo
- In scope:
  - verify the local restore/drop fix is complete across AI Studio reload/navigation surfaces
  - prove whether any remaining restore path still drops successful transient outputs
  - identify the next canonical fix if provider URL expiry or another restore authority seam remains
- Out of scope:
  - introducing new persistence systems
  - redesigning Reference Grid behavior
  - broad media-library authority changes unrelated to generated-output restore

### Attempts already made

1. Audited the server-side terminal convergence logic and proved that successful Kie/Kai outputs were being suppressed from the Reference Grid when canonical owned media was not yet established.
2. Patched the terminal success visibility rule so Reference Grid visibility depends on trusted displayable result media, not only canonical owned media:
   - `frontend/lib/server/api/terminalConvergenceVisibility.ts`
   - `frontend/lib/server/api/terminalConvergenceViewSync.ts`
   - `frontend/lib/server/api/generationProjection.ts`
3. Hardened `/api/fal/kie-kling-status` with a one-response guard after production evidence of `write after end`:
   - `frontend/lib/server/api/falStatusProxy.ts`
4. Added regression coverage for transient successful visibility and status single-send behavior:
   - `frontend/lib/server/api/__tests__/directGenerationSettlement.test.ts`
   - `frontend/lib/server/api/__tests__/generationProjection.test.ts`
   - `frontend/tests/api/fal-status-proxy.test.ts`
5. Audited the restore/list/reconcile client path and found a second stricter authority gate:
   - `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
   - `listVisibleGeneratedOutputs()` filtered provider-url-only success rows
   - `resolveVisibleGenerationReconcile()` returned `null` for provider-url-only success rows
6. Patched the restore authority path so successful visible transient outputs remain restorable across navigation/reload:
   - `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
7. Added regression coverage for restore visibility and reconcile behavior:
   - `frontend/features/ai-studio/logic/__tests__/generatedMediaAuthority.test.ts`
   - `frontend/features/ai-studio/hooks/taskPolling/__tests__/visibleGenerationSettle.test.ts`

### Current hypotheses

1. The main disappearing-generation bug was caused by two mismatched truths:
   - active polling accepted successful transient provider outputs,
   - restore/reload authority rejected the same outputs unless they already had durable storage authority.
2. The production `write after end` status crash was a separate but compounding bug in the same lifecycle, increasing the chance that successful provider outcomes would not settle cleanly.
3. The next real residual risk is not “navigation loses it immediately” anymore, but:
   - provider URL expiry before canonical ownership persists, or
   - another AI Studio restore surface outside the tested generated-output authority helpers still applying stricter rules.

### Required context

Read first:

- `README.md`
- `docs/records/artifacts/agent/datserok/reports/2026-05-31-project-persistence-authority-audit.md`
- `docs/records/artifacts/agent/nuclo/reports/2026-06-02-kie-vercel-production-env-audit.md`
- this handoff file

Inspect first:

- `frontend/lib/server/api/terminalConvergenceVisibility.ts`
- `frontend/lib/server/api/terminalConvergenceViewSync.ts`
- `frontend/lib/server/api/generationProjection.ts`
- `frontend/lib/server/api/falStatusProxy.ts`
- `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`
- `frontend/features/ai-studio/hooks/taskPolling/visibleGenerationSettle.ts`
- `frontend/lib/generatedMediaDisplayAuthority.ts`

Inspect first tests:

- `frontend/lib/server/api/__tests__/directGenerationSettlement.test.ts`
- `frontend/lib/server/api/__tests__/generationProjection.test.ts`
- `frontend/tests/api/fal-status-proxy.test.ts`
- `frontend/features/ai-studio/logic/__tests__/generatedMediaAuthority.test.ts`
- `frontend/features/ai-studio/hooks/taskPolling/__tests__/visibleGenerationSettle.test.ts`

### Questions for D-Bug

1. After the local restore-authority patch, can any AI Studio navigation/reload surface still hide a successful transient generation before canonical ownership persists?
2. If canonical ownership never arrives quickly enough, what is the smallest credible expiry/fallback risk around provider transient URLs?
3. Does any project-scoped restore path, quick-slot path, or output hydration path still depend on `hasDurableGeneratedMediaDisplayAuthority(...)` in a way that could silently drop successful transient results?

### Expected output

- bounded verification packet, or
- debug plan for any remaining restore/drop seam, or
- narrowly scoped follow-up patch with targeted validation, or
- blocked-with-evidence escalation if the remaining issue is production-only/provider-url expiry

### Recommended downstream owner after D-Bug

- Stay with D-Bug for restore/drop verification and any narrowly scoped follow-up patch
- If the remaining issue is hosted-only or needs production proof, hand to `Nuclo`
- If the lane becomes primarily project-persistence authority rather than debugging, consult `Datserok`

### Suggested validation

- Existing focused suites that passed in this lane:

```bash
cd frontend
npm test -- lib/server/api/__tests__/directGenerationSettlement.test.ts
npm test -- lib/server/api/__tests__/generationProjection.test.ts
npm test -- tests/api/fal-status-proxy.test.ts
npm test -- features/ai-studio/logic/__tests__/generatedMediaAuthority.test.ts
npm test -- features/ai-studio/hooks/taskPolling/__tests__/visibleGenerationSettle.test.ts
```

- Production/manual proof recommended for the new lane:
  1. Submit a Kie/Kai-backed video generation on `https://www.shortpulse.ai`.
  2. Wait for normal polling to begin.
  3. Navigate away from AI Studio before canonical save likely finishes.
  4. Return to AI Studio and confirm the generation is still visible.
  5. Repeat with:
     - soft navigation inside the app
     - full browser refresh
     - longer delay before returning

### Suggested stop condition

- Stop when the receiving agent can prove one of these with confidence:
  - successful transient video generations remain visible/restorable across navigation and reload until canonical ownership settles, or
  - the only remaining failure mode is a narrower provider URL expiry or hosted-only condition with a clear next owner.
- If a remaining issue cannot be fixed from repo code alone, stop with:
  - the exact restore surface,
  - the exact authority gate,
  - the exact production proof still needed.

### Done state

- Another engineer or agent can pick this up without re-auditing the entire June 2 video lane.
- They know:
  - what was broken,
  - what was already fixed locally,
  - which files and tests are authoritative,
  - and what residual questions still need proof.

### Closeout artifact

- Preferred retained path:
  - `docs/records/artifacts/agent/d-bug/handoffs/`
- Suggested filename:
  - `2026-06-02-ai-studio-video-restore-drop-after-navigation.md`
