# Phase 2 Evidence - Golden Quality + False-Refusal Comparative Report (Local vs Staging)

Date: 2026-03-20  
Phase: 2  
Status: Complete (staging-scoped comparative)

## Corpus Definition (Approved For This Packet)
Golden corpus v1 (expected `non_refusal` for all categories):
1. `safe`
2. `sexual_suggestive`
3. `violence_suggestive`

Execution profile:
1. `track=correctness`
2. `requests=8` per category
3. `workers=2`
4. gate thresholds: `strictGate=0.99`, `suggestiveGate=0.95`, `correctnessNon200RateMax=0.01`

## Artifacts
Local:
1. `docs/planning/evidence/agent-pipeline-remediation/phase-2/artifacts/2026-03-20/local-safety-sim-summary.json`
2. `docs/planning/evidence/agent-pipeline-remediation/phase-2/artifacts/2026-03-20/local-safety-sim-aggregates.json`

Staging:
1. `docs/planning/evidence/agent-pipeline-remediation/phase-2/artifacts/2026-03-20/staging-safety-sim-summary.json`
2. `docs/planning/evidence/agent-pipeline-remediation/phase-2/artifacts/2026-03-20/staging-safety-sim-aggregates.json`

## Comparative Results
Aggregate comparison:
1. Local totals: `24` requests, `0` non-200, `0` refusals, `0` fallbacks, `0` missing `applyPrompt`.
2. Staging totals: `24` requests, `0` non-200, `0` refusals, `0` fallbacks, `0` missing `applyPrompt`.
3. Delta (staging - local):
   - non-200 rate: `0.00`
   - refusal count: `0`
   - fallback count: `0`
   - missing `applyPrompt`: `0`

Category-level expected-pass rates (`safe`, `sexual_suggestive`, `violence_suggestive`):
1. Local: `1.00`, `1.00`, `1.00`
2. Staging: `1.00`, `1.00`, `1.00`
3. Delta: `0.00` per category

## Quality Contract Findings
For expected-allow corpus rows:
1. `safe_or_rewrite` path remained stable in local and staging.
2. No safety refusal regressions were observed.
3. No fallback-path contamination was observed.
4. `applyPrompt` remained present for all `safe_or_rewrite` results.

## Conclusion
1. No net increase in false-positive refusals on the approved Phase 2 golden corpus.
2. Prompt quality envelope (actionability + non-fallback stability) is non-regressing from local to staging.
3. Phase 2 quality/refusal comparative requirement is satisfied for staging-scoped closeout.
