# AI Studio Live Session Check Media Panel Handoff (2026-04-05)

Status: Active handoff  
Branch: `codex/live-seesion-check-up`  
Scope: staging preview AI Studio Media Library panel lag investigation and fix plan  
Audience: follow-on Codex/engineering agent picking up implementation and validation

## Purpose

Capture the current state of the AI Studio live session lag investigation so another agent can continue without re-deriving the same evidence.

This handoff is intentionally execution-oriented:
- it records only evidence we were able to verify,
- separates trusted facts from hypotheses,
- defines decision gates for the next agent,
- and gives an ordered remediation plan with rollback posture.

## Original User Problem

The user reported that a live staging AI Studio session felt laggy:

- URL: `https://shortpulse-git-staging-preview-kirk-artmans-projects.vercel.app/ai-studio?sid=2b3a5520-dc55-43ec-a3e5-e6de91e72854`
- suspected causes:
  - adaptive compression may not be working correctly,
  - optimization-related environment variables may not be set correctly.

The user explicitly asked for:

1. a live check,
2. repo-backed investigation,
3. data-backed decision making,
4. and finally a handoff-quality plan that can be used by another agent.

No product code was changed during the investigation that produced this handoff.

## Executive Summary

Current highest-confidence conclusion:

- the first fix should be a staging preview configuration correction, not a derivative-worker remediation.

Why:

1. The staging deployment bundle shows Adaptive Media V2 compiled with a surface allowlist that excludes `media-library-panel-grid`.
2. The AI Studio panel runtime still explicitly gates adaptive preview quality on `media-library-panel-grid`.
3. Remote staging DB evidence shows `ai_studio` image derivative coverage is already very high (`99.78%` thumb coverage), with only `3` fresh pending rows and `0` terminal derivative failures.
4. Therefore, the primary root cause is more likely panel adaptive gating being disabled on the preview build than a broad derivative backlog.

Secondary conclusion:

- the repo’s SOP/troubleshooting docs are stale and currently describe the panel compaction contract incorrectly.

## Trusted Evidence

### 1. Staging deployment identity and route parity

Verified via `vercel inspect`:

- deployment id: `dpl_3WogmffBxQAMVXejy18D8xo8tGh2`
- preview alias: `shortpulse-git-staging-preview-kirk-artmans-projects.vercel.app`
- ready state: `READY`

Relevant routes confirmed present in the deployment output:

- `/api/media/list`
- `/api/media/sign-batch`
- `/api/media/resolve-previews`
- `/api/credits/snapshot`
- `/api/internal/media-derivatives/run`

Implication:

- this is not a missing-route deployment parity problem.

## 2. Live preview bundle evidence: panel surface omitted from compiled adaptive allowlist

The deployed adaptive-media chunk contains the compiled allowlist:

`reference-grid,media-library-grid,media-library-modal-grid`

The same compiled code still uses the fallback string:

`reference-grid,media-library-grid,media-library-modal-grid,media-library-panel-grid`

but the actual built invocation is using the explicit three-surface list above.

This was captured from the staging bundle at:

- `/_next/static/chunks/2dd648f6ecba21ef.js`

Observed snippet shape:

```text
... e?.trim()?e.trim():"reference-grid,media-library-grid,media-library-modal-grid,media-library-panel-grid" ...
... })( "reference-grid,media-library-grid,media-library-modal-grid" ) ...
```

Implication:

- the preview build was compiled with `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES` explicitly set to
  `reference-grid,media-library-grid,media-library-modal-grid`
- `media-library-panel-grid` is excluded in the deployed preview bundle

### 3. Live preview bundle evidence: panel still keys off `media-library-panel-grid`

The deployed panel chunk shows the AI Studio Media Library panel still uses:

- `isAdaptiveSurfaceEnabled("media-library-panel-grid")`

Captured from:

- `/_next/static/chunks/5091a39e5d2ce696.js`

Implication:

- on this preview build, the panel’s adaptive preview-quality gate is off because the panel surface is not in the allowlist

### 4. Remote staging database evidence: derivative coverage is already strong

Using the staging Supabase project visible from the local environment:

- project ref: `jwmcytzyhcvacjwqtynn`
- project name from `supabase projects list`: `STAGING ShortPulse`

Remote evidence computed from `media_files` equivalent to the repo diagnostic intent in
`sql/check_media_preview_variant_coverage_and_size.sql`:

- `ai_studio` images:
  - total rows: `1393`
  - rows with `thumb_variant_path`: `1390`
  - thumb coverage: `99.78%`
  - `p50_bytes`: `6,404,148`
  - `p90_bytes`: `12,033,419`
- `ai_studio` videos:
  - total rows: `11`
  - no paired video variants yet

Implication:

- “low preview variant coverage across `ai_studio` images” is not supported by the current staging data

### 5. Remote staging database evidence: derivative backlog is minimal

Image processing backlog summary from staging:

- `ai_studio` image rows:
  - `ready`: `1390`
  - `pending`: `3`
- `upload` image rows:
  - `ready`: `710`
- `private_upload` image rows:
  - `ready`: `127`

Terminal derivative failures:

- total terminal failures: `0`

Details of the only unresolved `ai_studio` image rows:

- `3` rows
- all are very recent
- all are `processing_status='pending'`
- all have `processing_attempts=0`
- all have `thumb_variant_path is null`

Implication:

- there is no evidence of a stuck or exhausted derivative queue causing broad panel slowness

### 6. Remote staging signability sample: variants are usable

Sampled the 50 newest `ai_studio` image rows from staging and attempted signed URL creation:

- `sample_size`: `50`
- `thumb_success`: `47`
- `orig_success`: `50`
- `both_success`: `47`
- `thumb_missing`: `3`
- `failures`: `[]`

The `3` thumb misses were exactly the `3` fresh pending derivative rows.

Implication:

- existing `thumb_variant_path` values are not merely populated; they are signable and usable

## 7. Repo contract evidence: the panel is explicitly owned by `media-library-panel-grid`

The code and tests agree on the panel adaptive contract:

- [flags.ts](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/frontend/lib/adaptive-media/flags.ts)
  - default fallback allowlist includes `media-library-panel-grid`
- [MediaLibraryPanel.tsx](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/frontend/features/ai-studio/components/MediaLibraryPanel.tsx)
  - panel adaptive preview quality is gated by `isAdaptiveSurfaceEnabled("media-library-panel-grid")`
- [surfaceConfig.ts](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/frontend/features/media-library/runtime/surfaceConfig.ts)
  - panel config declares `adaptiveSurface: "media-library-panel-grid"`
- [MediaLibraryPanel.test.tsx](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/frontend/features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx)
  - test explicitly asserts route/modal surfaces alone do not enable panel adaptive preview quality
- [flags.test.ts](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/frontend/lib/adaptive-media/__tests__/flags.test.ts)
  - fallback allowlist tests expect panel inclusion

Implication:

- the intended contract is explicit: the panel is not controlled by `media-library-grid` or `media-library-modal-grid`

### 8. Repo contract evidence: panel compression is not the primary steady-state path

Relevant code:

- [mediaLibraryPanelPreviewResolver.ts](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/frontend/features/ai-studio/logic/mediaLibraryPanelPreviewResolver.ts)
- [mediaSignedTransformPolicy.ts](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/frontend/lib/mediaSignedTransformPolicy.ts)
- [mediaSignedUrlCache.ts](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/frontend/lib/mediaSignedUrlCache.ts)

What this means:

- the panel compression experiment only modifies Supabase render-image URLs
- signed transforms are dual-flag gated and disabled by default unless both server and client flags are true
- the repo’s durable architecture points toward stored preview variants as the steady-state performance path

Implication:

- even if panel compression is disabled, that alone should not explain broad slowness when durable variants already exist

## Mismatch Between Runtime Contract and Current Docs

The following docs are stale relative to code/tests/runtime:

- [docs/sops/sop_ai_studio_media_library_operations.md](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/docs/sops/sop_ai_studio_media_library_operations.md)
  - currently states panel compaction activates when either `media-library-grid` or `media-library-modal-grid` is enabled
- [docs/sops/sop_media_performance_operations.md](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/docs/sops/sop_media_performance_operations.md)
  - currently instructs operators to verify route/modal adaptive surfaces for panel slowness
- [docs/troubleshooting.md](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/docs/troubleshooting.md)
  - repeats the same route/modal guidance

This guidance is contradicted by:

- [MediaLibraryPanel.test.tsx](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/frontend/features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx)
- [flags.test.ts](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/frontend/lib/adaptive-media/__tests__/flags.test.ts)
- [flags.ts](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/frontend/lib/adaptive-media/flags.ts)

## What We Could Not Prove

These remain evidence gaps:

1. We do not yet have trusted `window.__shortpulseMediaPerf?.signStats()` output from the user’s exact authenticated live session.
2. We do not yet have a direct browser replay of the same authenticated `sid` flow inside the agent session.
3. We do not have Vercel plaintext env value output from the dashboard/CLI because the relevant values are encrypted.

Important constraint:

- the built bundle evidence is still strong enough to infer the effective compiled client value for
  `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES` on the staging preview.

## Conclusion

Current highest-confidence diagnosis:

- staging preview client config excludes `media-library-panel-grid` from `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES`
- the panel runtime still requires `media-library-panel-grid`
- therefore panel adaptive preview quality is disabled on staging
- derivative coverage is already strong enough that derivative backlog should not be treated as the primary root cause

## Decision Gates For The Next Agent

Use these gates. Do not skip to code changes unless the earlier gates fail.

### Gate 1: Confirm operational root cause

Treat the issue as a configuration/gating problem if all are true:

1. deployed bundle compiled allowlist excludes `media-library-panel-grid`
2. panel runtime still gates on `media-library-panel-grid`
3. derivative coverage remains high and backlog remains low

This gate is already effectively satisfied by the evidence above.

### Gate 2: Determine whether derivative follow-up is still needed

Treat derivative work as primary only if any of these become true:

1. `ai_studio` image thumb coverage drops materially
2. pending/failed derivative rows rise meaningfully
3. terminal derivative failures appear
4. thumb paths are populated but no longer sign successfully

This gate is currently not satisfied.

### Gate 3: Decide whether code hardening is needed after env fix

After the env/config fix and redeploy, only proceed to code changes if:

1. panel still feels slow in the same flow, and
2. trusted telemetry still shows poor sign-batch behavior or poor panel responsiveness, and
3. no derivative/data-path issue reappears

## Ordered Remediation Plan

### Phase 1: Lowest-risk operational fix

Correct the preview client env for Adaptive Media V2 surfaces.

Target:

- ensure `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES` includes `media-library-panel-grid`

Minimum acceptable value:

- `reference-grid,media-library-grid,media-library-modal-grid,media-library-panel-grid`

Safer posture:

- if no custom surface pruning is required, remove the explicit override so the code fallback applies

Also verify:

- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED=true`
- `NEXT_PUBLIC_MEDIA_LIBRARY_PANEL_CONSTANT_COMPRESSION_ENABLED=true` if panel compaction is intentionally part of the staging test

### Phase 2: Redeploy and re-verify the build output

After updating preview env:

1. redeploy staging preview
2. inspect the rebuilt client chunk
3. confirm compiled allowlist now contains `media-library-panel-grid`

Do not trust env dashboards alone; verify the built client output again.

### Phase 3: Re-run runtime validation

Preferred validation:

1. load the staging AI Studio panel in an authenticated browser session
2. clear perf buffer:

```js
window.__shortpulseMediaPerf?.clear();
```

3. reproduce the laggy panel flow
4. inspect:

```js
window.__shortpulseMediaPerf?.durationStats();
window.__shortpulseMediaPerf?.signStats();
```

Primary telemetry to compare:

- `p95_duration_ms`
- `failed_ratio`
- `total_primary_durable`
- `total_primary_original`
- `total_resolved_durable`
- `total_resolved_original`

Do not use as rollout truth:

- `preview_delivery_mode`
- `optimizer_bypassed`

Those are blocked by the telemetry truth spec:

- [media-rendering-hardening-v2-telemetry-baseline-truth-spec-2026-03-18.md](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/docs/planning/media-rendering-hardening-v2-telemetry-baseline-truth-spec-2026-03-18.md)

### Phase 4: Only if still slow, harden code

Only after the env fix is proven insufficient should the next agent consider code changes.

Likely code hardening targets:

1. reduce panel sensitivity to fragile surface-allowlist misconfiguration
2. make panel fallback behavior more explicitly robust when adaptive panel gating is off
3. audit whether panel compression should depend on the same gate or whether that coupling is too brittle

Important:

- do not widen behavior casually
- preserve the repo’s explicit panel-surface contract unless there is a deliberate architecture decision to change it

### Phase 5: Update stale operational docs

After behavior is fixed and verified:

1. update [docs/sops/sop_ai_studio_media_library_operations.md](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/docs/sops/sop_ai_studio_media_library_operations.md)
2. update [docs/sops/sop_media_performance_operations.md](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/docs/sops/sop_media_performance_operations.md)
3. update [docs/troubleshooting.md](/Users/worldbuilder/Desktop/Desktop%20Clean/Projects/Coding%20Projects/ShortPulse%20Dev/ShortPulse/docs/troubleshooting.md)

Required correction:

- panel adaptive/compaction guidance must reference `media-library-panel-grid`, not route/modal surfaces

## Recommended Implementation Sequence For The Next Agent

1. Verify current branch is still `codex/live-seesion-check-up`.
2. Capture current `git status` and avoid disturbing unrelated work.
3. Update preview env to include `media-library-panel-grid`.
4. Redeploy preview.
5. Verify compiled bundle now includes the panel surface.
6. Reproduce panel flow and gather `window.__shortpulseMediaPerf?.signStats()`.
7. If improved, update stale docs and stop.
8. If not improved, produce a focused code-hardening plan before editing runtime behavior.

## Suggested Validation Checklist

Use this after the env fix:

1. open AI Studio panel root `All Media`
2. switch into the heavy image tab / user-reported laggy path
3. scroll enough to force sign-batch behavior
4. confirm panel no longer feels materially delayed relative to current staging baseline
5. capture:
   - `durationStats()`
   - `signStats()`
   - a fresh check of pending derivative rows
6. confirm no regression in:
   - `/api/media/list`
   - `/api/media/sign-batch`
   - folder navigation
   - panel selection/open behavior

## Commands / Techniques Already Used In This Investigation

### Deployment parity

```bash
cd frontend
vercel inspect shortpulse-git-staging-preview-kirk-artmans-projects.vercel.app --format=json
```

### Preview env presence

```bash
cd frontend
vercel env ls preview
```

Note:

- this confirms env variable presence, but not encrypted values

### Staging database access

The local environment already exposed a staging Supabase project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

These were used read-only for evidence gathering against the staging project.

### Built bundle inspection

Pulled the deployed JS chunks from the staging alias and searched them for:

- `media-library-panel-grid`
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES`
- `NEXT_PUBLIC_MEDIA_LIBRARY_PANEL_CONSTANT_COMPRESSION_ENABLED`

## Stop Rules

The next agent should stop and report back if any of these happen:

1. the preview env already includes `media-library-panel-grid`, but the deployed bundle still excludes it
2. post-fix telemetry shows no improvement and there is no new supporting evidence for a runtime code change
3. staging derivative metrics worsen while the env work is in progress
4. unrelated branch drift appears in touched files

## Deliverables Expected From The Next Agent

At minimum:

1. one short evidence update confirming whether the preview env/build now includes `media-library-panel-grid`
2. one validation packet after redeploy with:
   - panel behavior summary
   - sign stats
   - whether the issue is resolved
3. if resolved:
   - docs cleanup patch for the stale panel guidance
4. if unresolved:
   - a precise code-hardening proposal with file targets and risk notes

## Bottom Line

Do not start with derivative-worker changes.

The current evidence supports this order:

1. fix staging Adaptive Media V2 surface configuration for the panel
2. redeploy and validate
3. only then consider code hardening
4. update stale docs after the runtime behavior is confirmed
