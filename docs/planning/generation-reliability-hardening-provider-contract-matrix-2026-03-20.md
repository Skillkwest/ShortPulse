# Generation Reliability Hardening Provider Contract Matrix (2026-03-20)

Last updated: 2026-03-20  
Status: Active (planning)  
Program anchor: `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`

## Purpose
Define one canonical provider-behavior contract for reliability planning across fal and Kie so retry, callback, idempotency, and artifact-handling policy does not drift across phases.

## Contract Matrix
| Contract Surface | fal | Kie | Internal Planning Contract |
| --- | --- | --- | --- |
| Task model | Async queue request with provider request id | Async task creation with task id | Treat provider call as submit + deferred completion; never assume synchronous completion semantics |
| Callback delivery model | At-least-once callback semantics | At-least-once callback semantics | Callback handlers must be idempotent and safe for duplicate deliveries |
| Callback endpoint response budget | 15s callback timeout budget | 15s callback timeout budget | ACK callback fast, enqueue internal work, process asynchronously |
| Callback retry behavior | Retries up to 10 attempts over about 2 hours when delivery fails/times out | Retries are bounded and may stop after repeated callback failures | Keep polling/reconciliation fallback active; do not rely on callback-only convergence |
| Signature verification | JWKS-based signature verification contract | HMAC-based signature verification contract | Signature verification is mandatory in production; rejected signatures are security incidents |
| Replay protection | Timestamp validation with strict freshness window | Timestamp + signed content validation with strict freshness window | Enforce freshness window and reject stale callback envelopes |
| Retryable provider outcomes | transient network/availability outcomes and timeout classes | throttles/transient provider failures and callback delivery failures | Retry with bounded attempts, jitter, and max-age limits |
| Terminal provider outcomes | deterministic input/policy failures and non-retryable 4xx classes | deterministic input/policy failures and explicit policy-denied classes | Fail fast without retry churn; route to terminal status |
| Quarantine outcomes | repeated retryable failures or invariant violations | repeated retryable failures or invariant violations | Move to quarantine with explicit owner, evidence, and replay path |
| Rate-limit behavior | provider-level throttling possible; submit/status calls may transiently degrade | provider throttling explicit; 429 creation responses require client-side reschedule behavior | Treat throttles as retryable with backoff and fairness controls |
| Artifact availability window | provider-managed object retention windows (download promptly) | provider-managed URL retention windows (download promptly; do not defer persistence) | Download and persist artifacts before marking durable completion |

## Contract Detail Notes
1. This matrix is the planning authority for `R3` and `R4` policy slices and must be revalidated during implementation entry.
2. Callback authenticity contract for implementation:
   - fal: JWKS signature validation + timestamp freshness checks.
   - Kie: HMAC signature verification + timestamp validation + constant-time compare.
3. Reliability safety contract:
   - callback is a signal, not source of truth,
   - reconciliation polling remains mandatory,
   - durable completion requires artifact persistence in internal storage.

## Required Operational Rules
1. Callback authenticity checks must be documented in `R3` policy slices before implementation go.
2. Retry policy must classify provider outcomes into `retryable`, `terminal`, and `quarantine` before implementation go.
3. Reconciliation fallback remains mandatory even when callback health is green.
4. Artifact persistence to internal storage is required for durable success semantics.
5. Provider rate-limit behavior must feed fairness policy and backlog response controls.

## Linked Reliability Slices
1. `R1-S2`: provider-facing failure taxonomy context.
2. `R3-S3`: idempotency-key and duplicate-handling contract.
3. `R3-S4`: callback ordering and signature verification contract.
4. `R4-S1`: provider taxonomy and outcome classification.
5. `R5-S1` and `R5-S3`: fairness and overload response controls.
6. `R6-S1`: drill matrix includes callback outage and throttle scenarios.

## References
1. `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-phase-r3-execution-plan-2026-03-20.md`
3. `docs/planning/generation-reliability-hardening-phase-r4-execution-plan-2026-03-20.md`
4. `docs/sops/sop_provider_incident_response.md`
5. `docs/sops/sop_generation_recovery_diagnostics.md`
