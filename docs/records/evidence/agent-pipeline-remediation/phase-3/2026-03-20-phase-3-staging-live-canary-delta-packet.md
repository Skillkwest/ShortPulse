# Phase 3 Evidence - Staging Live Canary Delta Packet

Date: 2026-03-20  
Phase: 3  
Status: Completed (live staging capture packet generated; gate sufficiency still pending)

## Objective
Capture a live staging control-vs-canary delta packet using real route traffic simulation and the Phase 3 threshold contract tooling.

## Scope
Artifacts and tooling:
1. `scripts/build_phase3_canary_input_from_sim_runs.mjs`
2. `scripts/generate_phase3_canary_delta_packet.mjs`
3. `docs/records/artifacts/agent-pipeline-remediation/phase-3/artifacts/2026-03-20/live-canary/control/agent-sim-batch-1774042450869-correctness-summary.json`
4. `docs/records/artifacts/agent-pipeline-remediation/phase-3/artifacts/2026-03-20/live-canary/canary/agent-sim-batch-1774042864755-correctness-summary.json`
5. `docs/records/artifacts/agent-pipeline-remediation/phase-3/artifacts/2026-03-20/live-canary/phase-3-staging-live-canary-input.json`
6. `docs/records/artifacts/agent-pipeline-remediation/phase-3/artifacts/2026-03-20/live-canary/phase-3-staging-live-canary-delta-packet.md`

## Execution Summary
1. Ran live staging control window simulation (`210` requests total across `safe`, `sexual_suggestive`, `violence_suggestive`).
2. Ran live staging canary window simulation (`210` requests total, same profile/shape).
3. Built canonical canary-input payload from simulator summaries.
4. Generated canonical markdown canary delta packet from the threshold contract generator.

## Validation
Commands executed:
1. `node scripts/run_agent_safety_sim_matrix.mjs --track correctness --expectation-profile strict --base-url "https://shortpulse-git-staging-preview-kirk-artmans-projects.vercel.app" --categories safe,sexual_suggestive,violence_suggestive --requests 70 --workers 10 --strict-gate 0.99 --suggestive-gate 0.95 --output-dir docs/records/artifacts/agent-pipeline-remediation/phase-3/artifacts/2026-03-20/live-canary/control`
2. `node scripts/run_agent_safety_sim_matrix.mjs --track correctness --expectation-profile strict --base-url "https://shortpulse-git-staging-preview-kirk-artmans-projects.vercel.app" --categories safe,sexual_suggestive,violence_suggestive --requests 70 --workers 10 --strict-gate 0.99 --suggestive-gate 0.95 --output-dir docs/records/artifacts/agent-pipeline-remediation/phase-3/artifacts/2026-03-20/live-canary/canary`
3. `node scripts/build_phase3_canary_input_from_sim_runs.mjs --control-summary docs/records/artifacts/agent-pipeline-remediation/phase-3/artifacts/2026-03-20/live-canary/control/agent-sim-batch-1774042450869-correctness-summary.json --canary-summary docs/records/artifacts/agent-pipeline-remediation/phase-3/artifacts/2026-03-20/live-canary/canary/agent-sim-batch-1774042864755-correctness-summary.json --ring internal_verification --environment staging --out docs/records/artifacts/agent-pipeline-remediation/phase-3/artifacts/2026-03-20/live-canary/phase-3-staging-live-canary-input.json`
4. `node scripts/generate_phase3_canary_delta_packet.mjs --input docs/records/artifacts/agent-pipeline-remediation/phase-3/artifacts/2026-03-20/live-canary/phase-3-staging-live-canary-input.json --out docs/records/artifacts/agent-pipeline-remediation/phase-3/artifacts/2026-03-20/live-canary/phase-3-staging-live-canary-delta-packet.md`

Observed outcomes:
1. Control run: `210/210` HTTP `200`; `non200Rate=0`.
2. Canary run: `209/210` HTTP `200`; `non200Rate=0.476%`.
3. Delta packet decision: `insufficient_data` (`volume met`, `window duration not met` for `internal_verification` ring).
4. All computed metric deltas remained below rollback thresholds in this captured window.

## Known Limitations
1. Ring sufficiency gate not yet satisfied:
   - required canary observation window for `internal_verification`: `>=60` minutes,
   - captured canary window duration: `6` minutes.
2. `repair_rate` is currently derived as `0` in the canary-input builder because simulator outputs do not expose a direct server repair-attempt signal.

## Outcome
1. Phase 3 now has a live staging canary delta packet artifact generated from real staging traffic windows.
2. Remaining blockers for `PX-03`:
   - apply linked sufficiency waiver or capture a sufficiency-valid canary window (`>=60` minutes for internal ring, or equivalent approved ring window),
   - capture and link staging rollback drill packet.

## Addendum (Owner Directive)
1. Execution was explicitly stopped before a 60-minute rerun under owner directive:
   - `"Let's actually stop the run and use the results we have. Let's not do the 60-minute run."`
2. Waiver evidence:
   - `docs/records/evidence/agent-pipeline-remediation/phase-3/2026-03-20-phase-3-staging-canary-window-sufficiency-waiver.md`
