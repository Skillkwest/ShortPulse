# Phase 13 Research Checkpoints

Status: Active  
Owner: Engineering

## RCP-1: Browser Lifecycle And Exit-Path Reliability
Trigger: before Session Persistence implementation.
Status: Complete (2026-03-02)
Evidence: `2026-03-02-phase-13-rcp-1-browser-lifecycle-save-strategy.md`

Required focus:
1. `visibilitychange` (`hidden`) and `pagehide` save triggers.
2. `fetch(..., { keepalive: true })` and `sendBeacon` tradeoffs.
3. bfcache-safe behavior and avoidance of `unload` dependence.

Evidence output:
1. chosen implementation strategy,
2. rejected alternatives with reasons,
3. tests/gates impacted.

## RCP-2: Supabase/Postgres Persistence Security Posture
Trigger: before Session SQL/API finalize.
Status: Complete (2026-03-02)
Evidence: `2026-03-02-phase-13-rcp-2-supabase-rls-security-definer-upsert-pruning.md`

Required focus:
1. RLS isolation (`user_id = auth.uid()`).
2. `SECURITY DEFINER` execute posture and service-role boundaries.
3. deterministic prune/cap/TTL strategy and upsert contention semantics.

Evidence output:
1. SQL function boundary decisions,
2. grant model and role restrictions,
3. migration validation checklist.

## RCP-3: Safety Control Plane Contract Alignment
Trigger: before Safety Control Plane rollout.
Status: Complete (2026-03-02)
Evidence: `2026-03-02-phase-13-rcp-3-provider-safety-error-normalization.md`

Required focus:
1. provider safety/error payload shapes by environment.
2. production normalization vs development verbatim behavior.
3. hard-floor rollback/cooldown trigger semantics.

Evidence output:
1. normalization matrix,
2. immutable-floor enforcement mapping,
3. rollout/rollback trigger criteria.

## RCP-4: Runtime Canary Threshold Tuning
Trigger: before webhook canary promotion.
Status: Complete (2026-03-02)
Evidence: `2026-03-02-phase-13-rcp-4-runtime-canary-threshold-tuning.md`

Required focus:
1. Fal/Kie webhook/status contract deltas.
2. canary thresholds and hold/rollback criteria.
3. windowed evaluation inputs and noise filtering.

Evidence output:
1. threshold packet,
2. explicit promote/hold/rollback decision rules,
3. counter-metric mapping and alert thresholds.
