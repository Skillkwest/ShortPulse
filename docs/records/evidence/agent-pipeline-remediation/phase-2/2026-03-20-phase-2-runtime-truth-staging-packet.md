# Phase 2 Evidence - Runtime Truth Packet (Staging)

Date: 2026-03-20  
Phase: 2  
Status: Complete (staging capture)

## Scope
Capture runtime-truth evidence for staging preview deployment behavior, including:
1. Route accessibility and auth-path contract.
2. Control-plane safety profile snapshot.
3. Runtime behavior under the Phase 2 allowed-content corpus.

Note:
1. Production runtime-truth capture is intentionally deferred by owner directive on 2026-03-20 (`"Skip the production; only staging is relevant."`).

## Environment Snapshot
Staging base URL:
1. `https://shortpulse-git-staging-preview-kirk-artmans-projects.vercel.app`

Control-plane snapshot artifact:
1. `docs/records/artifacts/agent-pipeline-remediation/phase-2/artifacts/2026-03-20/control-plane-policy-snapshot.json`

Captured snapshot values:
1. `activeProfileId=prod_safe_v1`
2. `activePolicyVersion=3`
3. `schemaVersion=2`
4. `postprocessMode=shadow`

## Route/Auth Contract Probe
Staging route probe (with Vercel bypass token) confirms API lane is reachable and auth-enforced:
1. `GET /api/ai/studio-agent` -> `401 Unauthorized` when no bearer token is supplied.

## Staging Runtime Corpus Execution
Command:
1. `node scripts/run_agent_safety_sim_matrix.mjs --track correctness --expectation-profile strict --base-url "https://shortpulse-git-staging-preview-kirk-artmans-projects.vercel.app" --categories safe,sexual_suggestive,violence_suggestive --requests 8 --workers 2 --strict-gate 0.99 --suggestive-gate 0.95 --output-dir /tmp/agent-phase2-preview`

Artifacts:
1. `docs/records/artifacts/agent-pipeline-remediation/phase-2/artifacts/2026-03-20/staging-safety-sim-summary.json`
2. `docs/records/artifacts/agent-pipeline-remediation/phase-2/artifacts/2026-03-20/staging-safety-sim-aggregates.json`

Observed runtime results:
1. `24/24` requests returned HTTP `200` (`non200Rate=0`).
2. `0` safety refusals for expected-allow categories.
3. `0` infra fallback responses.
4. `0` missing `applyPrompt` cases in `safe_or_rewrite` responses.
5. Overall matrix gate: `PASS`.

## Runtime-Truth Conclusion
1. Staging runtime behavior matches the Phase 2 expected-allow corpus contract for this packet.
2. Control-plane profile snapshot is captured and linked.
3. Staging runtime-truth requirement is satisfied for the staging-scoped Phase 2 closeout.
