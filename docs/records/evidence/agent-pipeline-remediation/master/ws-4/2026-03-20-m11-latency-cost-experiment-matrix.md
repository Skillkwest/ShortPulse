# M-11 Latency/Cost Experiment Matrix

Date: 2026-03-20  
Tracker Row: `M-11`  
Workstream: `WS-4`  
Owner: Platform + Frontend  
Environment Scope: Staging only

## Scope
Define the staging experiment contract for fast-validator vs strong-compiler lanes across remediation routes:
1. `/api/ai/studio-agent`
2. `/api/ai/generate-prompt`
3. `/api/ai/describe-image`

## Lane Contract
1. `L1_fast_validator`
   - objective: lowest latency/cost path.
   - expected route path telemetry: `single_stage`.
   - provider call budget: `<= 1.2` calls per turn.
2. `L2_strong_compiler`
   - objective: higher-fidelity lane for hard turns.
   - expected route path telemetry: `v2_orchestration`.
   - provider call budget: `<= 2.2` calls per turn.

Source artifact:
1. `docs/records/artifacts/agent-pipeline-remediation/master/ws-4/artifacts/2026-03-20/staging-latency-cost-experiment-matrix.json`

## Pass/Fail Threshold Contract
Hold-level thresholds for lane promotion decisions:
1. `schema_failure_rate` delta `<= +0.35pp`
2. `fallback_rate` delta `<= +1.00pp`
3. `false_refusal_rate` delta `<= +1.25pp`
4. `repair_rate` delta `<= +1.25pp`
5. `p95_latency_ms` delta `<= +25%`
6. `error_rate` absolute `<= 0.80%`
7. strong-compiler token multiplier `<= 1.9x` fast-validator lane.

Notes:
1. Rows 1-6 align to the threshold contract hold gates (`docs/planning/ai-studio-agent-pipeline-regression-threshold-contract-2026-03-20.md`).
2. Row 7 is the explicit cost guard for `M-11`.

## Traffic And Evidence Contract
1. Minimum sample window per lane:
   - `>= 200` requests
   - `>= 60` minutes
2. Corpus mix for lane comparison:
   - safe `60%`
   - sexual_suggestive `20%`
   - violence_suggestive `20%`
3. Required telemetry fields in packet:
   - `path`
   - `latency_ms_total`
   - `latency_ms_stage`
   - `policy_version`
   - `policy_schema_version`
   - `prompt_template_version`
   - `runtime_scope_key`

## Command Template
1. Staging lane run:
```bash
node scripts/run_agent_safety_sim_matrix.mjs \
  --base-url <staging-url> \
  --track correctness \
  --expectation-profile strict \
  --categories safe,sexual_suggestive,violence_suggestive \
  --requests 200 \
  --workers 10 \
  --request-timeout-ms 45000 \
  --output-dir docs/records/artifacts/agent-pipeline-remediation/master/ws-4/artifacts/2026-03-20 \
  --vercel-bypass-token <token>
```

## Validation
Commands run for this planning/evidence slice:
1. `rg -n "M-11|WS-4|latency|cost|lane" docs/planning/ai-studio-agent-pipeline-regression-* docs/planning/evidence/agent-pipeline-remediation -g '*.md'`
2. `rg -n "single_stage|v2_orchestration|latency_ms_total|runtime_scope_key" frontend/features/agent-runtime frontend/pages/api/ai/studio-agent.ts frontend/tests/api/studio-agent.runtime.test.ts`
3. `npm -C frontend run docs:check`

Outcome:
1. Experiment matrix and pass/fail thresholds are now explicit and linkable for `M-11` gate decisions.
