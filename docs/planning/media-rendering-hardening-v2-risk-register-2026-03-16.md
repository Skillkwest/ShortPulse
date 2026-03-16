# Media Rendering Hardening v2 Risk Register (2026-03-16)

Last updated: 2026-03-16  
Status: Active

## Severity Scale
- `S0`: critical outage/data risk
- `S1`: major regression risk
- `S2`: medium delivery risk
- `S3`: low operational risk

## Risks
| risk_id | severity | owner | description | mitigation | rollback_trigger | status |
| --- | --- | --- | --- | --- | --- | --- |
| MRH2-R-001 | S1 | Engineering | Signed URL policy drift across route/modal/panel/reference-grid can regress previews. | Lock policy contract + parity tests before behavior edits. | Preview resolution mismatch above threshold or repeated 500s in rollout ring. | Open |
| MRH2-R-002 | S1 | Engineering | Folder query id fan-in can degrade list performance at scale. | Replace with scalable query shape and benchmark dataset tiers. | P95 latency regression beyond gate or timeout/error spike. | Open |
| MRH2-R-003 | S1 | Engineering | Legacy upload endpoint retirement can break hidden consumers. | Adapter compatibility stage + telemetry-based sunset gates. | Any adapter parity mismatch in staging/limited ring. | Open |
| MRH2-R-004 | S2 | Engineering | `minimal` list profile can break implicit metadata-dependent consumers. | Add explicit `expanded` profile and consumer compatibility tests. | Consumer parse/render failures in ring 1/2. | Open |
| MRH2-R-005 | S1 | Engineering | MIME acceptance vs dimension parser mismatch can create metadata drift. | Authoritative fallback policy + invariant tests. | Null/incorrect dimension propagation in hot paths. | Open |
| MRH2-R-006 | S2 | Engineering | Anti-bloat enforcement may block merges with noisy checks. | Start in warn mode with strict sunset and fixtures. | High false-positive rate blocks essential slices. | Open |
| MRH2-R-007 | S2 | Engineering | Sequential upload bottlenecks can worsen user upload latency during transition. | Parallelization with bounded concurrency and parity assertions. | Upload failure/error-rate increase after change. | Open |
| MRH2-R-008 | S0 | Engineering | Decommission too early could cause production ingest outage. | Require two clean release windows + adapter usage threshold. | Any post-decommission upload failure regression. | Open |

## Operational Rule
Update this register in the same slice whenever risk posture changes.
