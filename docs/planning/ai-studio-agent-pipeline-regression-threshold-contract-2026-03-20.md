# AI Studio Agent Prompt-Compiler Threshold Contract

Date: 2026-03-20  
Authority: Working  
Owner: Platform Ops + Platform + AI Platform  
Scope: OpenAI remediation lanes only (`studio-agent`, `generate-prompt`, `describe-image`)

## Purpose
Define one canonical numeric contract for promote/hold/rollback decisions used in Phase 3 and Phase 4.

## References
1. `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-agent-pipeline-regression-phase-3-openai-execution-plan-2026-03-20.md`
4. `docs/planning/ai-studio-agent-pipeline-regression-phase-4-openai-execution-plan-2026-03-20.md`

## Metric Definitions
1. `schema_failure_rate`: percent of responses that fail schema validation before bounded repair success.
2. `fallback_rate`: percent of turns returning infra fallback behavior.
3. `false_refusal_rate`: percent of approved-corpus prompts incorrectly refused.
4. `repair_rate`: percent of turns requiring repair pass before acceptance.
5. `p95_latency_ms`: p95 end-to-end route latency by dominant flow mix.
6. `error_rate`: percent of requests returning 5xx or hard processing errors.

## Baseline Contract
1. Baseline window must be from the immediately prior stable control period.
2. Baseline must include at least 5,000 requests for production canary decisions.
3. Metric deltas are absolute percentage-point deltas unless otherwise noted.

## Thresholds
| Metric | Warn | Hold | Rollback |
| --- | --- | --- | --- |
| `schema_failure_rate` delta | `> +0.20pp` | `> +0.35pp` | `> +0.50pp` |
| `fallback_rate` delta | `> +0.50pp` | `> +1.00pp` | `> +1.50pp` |
| `false_refusal_rate` delta | `> +0.75pp` | `> +1.25pp` | `> +1.75pp` |
| `repair_rate` delta | `> +0.75pp` | `> +1.25pp` | `> +1.75pp` |
| `p95_latency_ms` delta | `> +15%` | `> +25%` | `> +35%` |
| `error_rate` absolute | `> 0.60%` | `> 0.80%` | `> 1.00%` |

## Ring Windows
| Ring | Minimum observation window | Minimum volume |
| --- | --- | --- |
| Internal verification | 60 minutes | 200 requests |
| Preview canary | 4 hours | 1,000 requests |
| Production canary | 24 hours | 5,000 requests |
| Broad rollout stabilization | 48 hours | 20,000 requests |

## Decision Rules
1. Any rollback threshold breach in current ring => immediate rollback decision.
2. Any hold threshold breach without rollback breach => hold and extend observation window.
3. Promotion requires all metrics below hold thresholds for full ring window and volume.
4. Warn-only breaches permit promotion only with explicit approver signoff and mitigation note.
5. Threshold bypasses are prohibited without documented risk waiver.

## Change Control
1. Threshold edits require roadmap/tracker amendment record and owner signoff.
2. Template packets must reference this contract version/date.

